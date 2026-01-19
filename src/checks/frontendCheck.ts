/**
 * Frontend check runner (package.json-first) with very clear step-by-step comments.
 *
 * Goal:
 * - For frontend projects (React/Vue/Next/Vite/Svelte/etc.), try "real checks" first:
 *     1) test
 *     2) typecheck
 *     3) lint
 *     4) build
 * - If none exist, caller can fall back to LLM.
 *
 * Design principles:
 * - package.json scripts are the source of truth for frontend checks.
 * - Only use safe fallbacks (TypeScript) when scripts are missing:
 *     - if tsconfig.json exists, run `npx tsc --noEmit`
 *     - if vue project + tsconfig exists, prefer `npx vue-tsc --noEmit`
 * - Run checks in a temporary worktree with staged changes applied
 *   so we test "what will be committed" without touching the user's working tree.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

// -------------------- Types --------------------

export type CheckKind = "tests" | "typecheck" | "lint" | "build";

export interface CheckResult {
    ran: boolean; // Did we run a real check?
    ok: boolean; // Did it pass?
    kind?: CheckKind; // What kind of check was run?
    name?: string; // Display label for logs (e.g. "pnpm test")
    output?: string; // Combined stdout/stderr
}

interface CheckCommand {
    kind: CheckKind;
    name: string;
    program: string;
    args: string[];
}

// -------------------- Step 0: Small utilities --------------------

/**
 * STEP 0A: Check if a file exists.
 * We use this for package.json, lockfiles, tsconfig.json, etc.
 */
function exists(p: string): boolean {
    try {
        fs.accessSync(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * STEP 0B: Read and parse JSON safely.
 * If parsing fails, return null instead of crashing.
 */
function readJson(p: string): any | null {
    try {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * STEP 0C: Run a command safely (no shell) and capture output.
 * We use spawnSync so we can capture stdout/stderr and return success/failure.
 */
function run(
    program: string,
    args: string[],
    cwd: string
): { ok: boolean; output: string } {
    const r = spawnSync(program, args, {
        cwd,
        encoding: "utf8",
        shell: false,
    });
    const output =
        `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? "\n" + r.error.message : ""}`.trim();
    return { ok: (r.status ?? 1) === 0, output };
}

// -------------------- Step 1: Detect package manager --------------------

/**
 * STEP 1:
 * Detect the package manager by checking lockfiles.
 *
 * Why:
 * - Running scripts should use the repo's package manager to match dev environment.
 * - pnpm/yarn/bun may behave slightly differently than npm.
 */
function detectPm(repoRoot: string): "pnpm" | "yarn" | "bun" | "npm" {
    if (exists(path.join(repoRoot, "pnpm-lock.yaml"))) return "pnpm";
    if (exists(path.join(repoRoot, "yarn.lock"))) return "yarn";
    if (
        exists(path.join(repoRoot, "bun.lockb")) ||
        exists(path.join(repoRoot, "bun.lock"))
    )
        return "bun";
    return "npm";
}

// -------------------- Step 2: Detect scripts in package.json --------------------

/**
 * STEP 2:
 * Read package.json scripts and build a list of candidate checks.
 *
 * Why:
 * - For frontend projects, scripts are the "source of truth".
 * - We do NOT guess commands from dependencies (too many false positives).
 */
function detectChecksFromPackageJson(repoRoot: string): CheckCommand[] {
    const pkgPath = path.join(repoRoot, "package.json");

    // STEP 2A: If there is no package.json, this isn't a standard frontend JS/TS project.
    if (!exists(pkgPath)) return [];

    // STEP 2B: Parse package.json. If parsing fails, we can't safely detect scripts.
    const pkg = readJson(pkgPath);
    if (!pkg) return [];

    const scripts: Record<string, string> = pkg.scripts ?? {};
    const pm = detectPm(repoRoot);

    const checks: CheckCommand[] = [];

    // Helper: build "pm run <script>" command (works across npm/pnpm/yarn/bun).
    const runScript = (kind: CheckKind, scriptName: string): CheckCommand => ({
        kind,
        name: `${pm} run ${scriptName}`,
        program: pm,
        args: ["run", scriptName],
    });

    /**
     * STEP 2C: Detect "test" script.
     * If present, this is usually the highest-confidence check.
     * Also check for common variations like test:run, test:ci, test:unit, etc.
     */
    const testScript = scripts.test
        ? "test"
        : scripts["test:run"]
          ? "test:run"
          : scripts["test:ci"]
            ? "test:ci"
            : scripts["test:unit"]
              ? "test:unit"
              : null;

    if (testScript) {
        if (testScript === "test") {
            // Most package managers support "pm test" shorthand
            checks.push({
                kind: "tests",
                name: `${pm} test`,
                program: pm,
                args: ["test"],
            });
        } else {
            // For variants, use "pm run test:xxx"
            checks.push({
                kind: "tests",
                name: `${pm} run ${testScript}`,
                program: pm,
                args: ["run", testScript],
            });
        }
    }

    /**
     * STEP 2D: Detect "typecheck" script.
     * Many TS projects define it explicitly.
     */
    if (scripts.typecheck) {
        checks.push(runScript("typecheck", "typecheck"));
    }

    /**
     * STEP 2E: Detect "lint" script.
     */
    if (scripts.lint) {
        checks.push(runScript("lint", "lint"));
    }

    /**
     * STEP 2F: Detect "build" script.
     * Build can catch missing imports/exports in bundlers.
     */
    if (scripts.build) {
        checks.push(runScript("build", "build"));
    }

    return checks;
}

// -------------------- Step 3: Safe TypeScript fallback when scripts are missing --------------------

/**
 * STEP 3:
 * If no explicit "typecheck" script exists, we can still run a safe universal TS check
 * if tsconfig.json exists.
 *
 * Why:
 * - Many repos forget to add "typecheck" but still use TypeScript.
 * - `tsc --noEmit` is safe and catches cross-file usage issues.
 * - For Vue, `vue-tsc` is more accurate for SFC templates.
 */
function detectTypecheckFallback(
    repoRoot: string,
    alreadyHasTypecheckScript: boolean
): CheckCommand[] {
    // If repo already has a typecheck script, don't add a fallback.
    if (alreadyHasTypecheckScript) return [];

    // If no TS config, we shouldn't try to run TypeScript checks.
    const tsconfig = path.join(repoRoot, "tsconfig.json");
    if (!exists(tsconfig)) return [];

    // Vue detection: check package.json dependencies for Vue packages
    // This is more accurate than checking config files (vite can be React/Svelte/etc.)
    const pkgPath = path.join(repoRoot, "package.json");
    let isVue = false;

    if (exists(pkgPath)) {
        const pkg = readJson(pkgPath);
        if (pkg) {
            const allDeps = {
                ...pkg.dependencies,
                ...pkg.devDependencies,
                ...pkg.peerDependencies,
            };
            // Check for Vue or Nuxt packages
            isVue = Object.keys(allDeps).some(
                (dep) =>
                    dep === "vue" ||
                    dep.startsWith("@vue/") ||
                    dep.startsWith("nuxt")
            );
        }
    }

    // If it's likely Vue, prefer vue-tsc (more accurate for .vue templates).
    // NOTE: This requires vue-tsc to be installed in the project.
    if (isVue) {
        return [
            {
                kind: "typecheck",
                name: "npx vue-tsc --noEmit",
                program: "npx",
                args: ["-y", "vue-tsc", "--noEmit"],
            },
        ];
    }

    // Generic TS fallback
    return [
        {
            kind: "typecheck",
            name: "npx tsc --noEmit",
            program: "npx",
            args: ["-y", "tsc", "--noEmit"],
        },
    ];
}

// -------------------- Step 4: Choose the BEST available check --------------------

/**
 * STEP 4:
 * Combine detected checks and pick the highest priority one.
 *
 * Priority order:
 * - tests (best)
 * - typecheck (very good)
 * - lint
 * - build
 */
function pickBestCheck(repoRoot: string): CheckCommand | null {
    // STEP 4A: Detect checks from package.json
    const scriptChecks = detectChecksFromPackageJson(repoRoot);

    // STEP 4B: See if we already have a typecheck script
    const hasTypecheckScript = scriptChecks.some((c) => c.kind === "typecheck");

    // STEP 4C: Add TS fallback if needed
    const fallbackChecks = detectTypecheckFallback(
        repoRoot,
        hasTypecheckScript
    );

    // STEP 4D: Combine all checks
    const allChecks = [...scriptChecks, ...fallbackChecks];

    if (allChecks.length === 0) return null;

    // STEP 4E: Sort by our priority rules and pick the first one
    const priority: CheckKind[] = ["tests", "typecheck", "lint", "build"];
    allChecks.sort(
        (a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind)
    );

    return allChecks[0] ?? null;
}

// -------------------- Step 5: Create a temp worktree with staged changes --------------------

/**
 * STEP 5:
 * Create a temporary git worktree at HEAD and apply the staged diff.
 *
 * Why:
 * - We want to run checks on the exact code state that will be committed.
 * - We must not modify the user's working directory.
 */
function createStagedWorktree(): { dir: string; cleanup: () => void } {
    // STEP 5A: Create a temp folder for our worktree and patch
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "commitwise-"));
    const wtDir = path.join(base, "wt");
    const patchFile = path.join(base, "staged.patch");

    // STEP 5B: Add a detached worktree at HEAD
    execFileSync("git", ["worktree", "add", "--detach", wtDir, "HEAD"], {
        stdio: "ignore",
    });

    // STEP 5C: Export staged diff into a patch file
    const patch = execFileSync("git", ["diff", "--cached"], {
        encoding: "utf8",
    });
    fs.writeFileSync(patchFile, patch, "utf8");

    // STEP 5D: Apply the staged patch inside the worktree
    if (patch.trim()) {
        try {
            execFileSync("git", ["apply", "--whitespace=nowarn", patchFile], {
                cwd: wtDir,
                stdio: "pipe",
            });
        } catch (e: any) {
            // Cleanup before throwing error
            try {
                execFileSync("git", ["worktree", "remove", "--force", wtDir], {
                    stdio: "ignore",
                });
            } catch {}
            try {
                fs.rmSync(base, { recursive: true, force: true });
            } catch {}

            throw new Error(
                "Failed to apply staged patch in worktree. This can happen with partial hunks, renames, or conflicts.\n" +
                    "Staged changes could not be reproduced for testing.\n" +
                    (e?.stdout?.toString?.() ?? "") +
                    (e?.stderr?.toString?.() ?? "")
            );
        }
    }

    // STEP 5E: Return worktree dir + cleanup function
    const cleanup = () => {
        try {
            execFileSync("git", ["worktree", "remove", "--force", wtDir], {
                stdio: "ignore",
            });
        } catch {}
        try {
            fs.rmSync(base, { recursive: true, force: true });
        } catch {}
    };

    return { dir: wtDir, cleanup };
}

// -------------------- Step 6: Run the best check (or report that none exist) --------------------

/**
 * STEP 6:
 * This is the function your CLI calls.
 *
 * It will:
 * - determine the best check to run
 * - run it inside a staged worktree
 * - return the result
 *
 * If no checks are found, it returns ran:false so you can fallback to LLM.
 */
export function runBestFrontendCheck(repoRoot: string): CheckResult {
    // STEP 6A: Pick the best available check command
    const best = pickBestCheck(repoRoot);

    // STEP 6B: If no check is available, tell caller to fallback to LLM
    if (!best) {
        return { ran: false, ok: true };
    }

    // STEP 6C: Create the staged worktree
    const { dir, cleanup } = createStagedWorktree();

    try {
        // STEP 6D: Ensure dependencies are available in the worktree
        // Strategy:
        // 1) If repo root has node_modules, reuse it (fast, no network).
        // 2) If not, try install (fallback).
        // 3) If install fails, return error clearly.

        const hasNodeModules = fs.existsSync(
            path.join(repoRoot, "node_modules")
        );
        const wtNodeModules = path.join(dir, "node_modules");

        if (hasNodeModules && !fs.existsSync(wtNodeModules)) {
            // Reuse root deps to avoid reinstalling
            try {
                const linkType =
                    process.platform === "win32" ? "junction" : "dir";
                fs.symlinkSync(
                    path.join(repoRoot, "node_modules"),
                    wtNodeModules,
                    linkType
                );
            } catch {
                // If symlink fails (permissions), just continue; check may still work via npx
            }
        }

        // If still no node_modules, install as a fallback
        if (!fs.existsSync(wtNodeModules)) {
            const pm = detectPm(repoRoot);

            // Prefer a reproducible install if lockfile exists
            let program: string;
            let installArgs: string[];

            if (pm === "pnpm") {
                // Use npx for pnpm (not always globally installed)
                program = "npx";
                installArgs = ["-y", "pnpm", "install", "--frozen-lockfile"];
            } else if (pm === "yarn") {
                // Use npx for yarn (safer fallback)
                program = "npx";
                installArgs = ["-y", "yarn", "install", "--frozen-lockfile"];
            } else {
                // npm is always present if node is present - call it directly
                const hasLockfile = exists(
                    path.join(repoRoot, "package-lock.json")
                );
                program = "npm";
                installArgs = hasLockfile ? ["ci"] : ["install"];
            }

            const installResult = run(program, installArgs, dir);

            if (!installResult.ok) {
                return {
                    ran: true,
                    ok: false,
                    kind: best.kind,
                    name: best.name,
                    output: `Failed to install dependencies in worktree:\n${installResult.output}`,
                };
            }
        }

        // STEP 6E: Run the check inside the worktree
        const result = run(best.program, best.args, dir);

        // STEP 6F: Return structured results for CLI printing
        return {
            ran: true,
            ok: result.ok,
            kind: best.kind,
            name: best.name,
            output: result.output,
        };
    } finally {
        // STEP 6G: Always clean up the temp worktree
        cleanup();
    }
}
