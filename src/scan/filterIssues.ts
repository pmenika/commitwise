import type { AiCommitConfig } from "../config/types.js";
import { scanCodeDiff } from "./scanDiff.js";
import { buildFrameworkContext } from "./buildContext.js";
import { detectProjectContext } from "../projectContext.js";
import { SYSTEM_PROMPT_NO_CHECKS } from "../prompts/noChecks.js";
import { askChoice, isNo } from "../shared/ui.js";

/**
 * Display scan issues found by AI.
 */
function displayScanIssues(
    issues: Array<{ file: string; issue: string }>
): void {
    console.log("\n⚠️ Scan findings:\n");
    issues.forEach((it, i) => {
        console.log(`${i + 1}. [${it.file}] ${it.issue}`);
    });
    console.log("");
}

/**
 * Perform AI-based code scanning on the diff.
 */
export async function performCodeScan(
    config: AiCommitConfig,
    diff: string,
    systemPrompt: string
): Promise<void> {
    const ctx = detectProjectContext(process.cwd());
    console.log(
        `Detected project context: framework=${ctx.framework}, language=${ctx.language}\n`
    );

    const frameworkContext = buildFrameworkContext(ctx.framework, ctx.language);
    const scan = await scanCodeDiff(
        config,
        diff,
        systemPrompt,
        frameworkContext
    );

    if (scan.issues.length > 0) {
        displayScanIssues(scan.issues);

        const proceed = await askChoice("Proceed anyway? (y/n): ");
        if (isNo(proceed)) {
            console.log("Commit aborted.");
            process.exit(0);
        }
    } else {
        console.log("\n✅ No issues found in the staged changes.\n");
    }
}

/**
 * Handle the scanning phase: run checks and perform AI scan.
 */
export async function handleScanPhase(
    config: AiCommitConfig,
    diff: string,
    systemPrompt: string | null
): Promise<void> {
    await performCodeScan(
        config,
        diff,
        systemPrompt || SYSTEM_PROMPT_NO_CHECKS
    );
}
