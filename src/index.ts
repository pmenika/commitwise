#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "child_process";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import fs from "fs";
import path from "path";

import { loadConfig } from "./config.js";
import type { AiCommitConfig } from "./configTypes.js";
import { generateCommitMessage, scanCodeDiff } from "./llm.js";

/**
 * Read staged changes (what will be committed).
 */
function getStagedDiff(): string {
    try {
        return execSync("git diff --cached", { encoding: "utf8" });
    } catch (err) {
        console.error("Error running `git diff --cached`:", err);
        process.exit(1);
    }
}

/**
 * Ask user for a choice (y/n/e/r etc.)
 */
async function askChoice(question: string): Promise<string> {
    const rl = createInterface({ input, output });
    const answer = (await rl.question(question)).trim().toLowerCase();
    rl.close();
    return answer;
}

/**
 * Open editor for commit message editing using a temp file.
 * Returns the edited message (trimmed). May return empty string.
 */
function editMessageInEditor(initialMessage: string): string {
    const editor = process.env.GIT_EDITOR || process.env.EDITOR || "vi";

    // Put temp file inside .git so it won’t get accidentally committed.
    const tempFilePath = path.join(".git", "AI_COMMIT_MSG.tmp");

    fs.writeFileSync(tempFilePath, initialMessage + "\n", "utf8");

    // Open editor (blocking until user closes it)
    execSync(`${editor} "${tempFilePath}"`, { stdio: "inherit" });

    const edited = fs.readFileSync(tempFilePath, "utf8").trim();

    // Cleanup
    try {
        fs.unlinkSync(tempFilePath);
    } catch {
        // ignore
    }

    return edited;
}

/**
 * Commit using a message file. This supports multi-line messages safely.
 */
function gitCommitWithMessage(message: string) {
    const msgFile = path.join(".git", "AI_COMMIT_FINAL.tmp");
    fs.writeFileSync(msgFile, message + "\n", "utf8");

    try {
        execSync(`git commit -F "${msgFile}"`, { stdio: "inherit" });
    } finally {
        try {
            fs.unlinkSync(msgFile);
        } catch {
            // ignore
        }
    }
}

/**
 * Only generate + print a commit message (no commit).
 */
async function suggestOnly(config: AiCommitConfig) {
    const diff = getStagedDiff();

    if (!diff.trim()) {
        console.error("No staged changes detected. Run `git add` first.");
        process.exit(1);
    }

    const msg = await generateCommitMessage(config, diff);
    console.log(msg);
}

/**
 * Main flow: scan (optional) -> generate message -> allow accept/edit/regenerate/cancel -> commit.
 */
async function autoCommitFlow(config: AiCommitConfig) {
    const diff = getStagedDiff();

    if (!diff.trim()) {
        console.error("No staged changes detected. Run `git add` first.");
        process.exit(1);
    }

    // 1) Scan for issues (if enabled)
    if (config.scanEnabled) {
        const scan = await scanCodeDiff(config, diff);

        if (scan.issues.length > 0) {
            console.log("\n⚠️ Scan findings:\n");
            scan.issues.forEach((issue: string, i: number) =>
                console.log(`${i + 1}. ${issue}`)
            );
            console.log("");

            const proceed = await askChoice("Proceed anyway? (y/n): ");
            if (proceed === "n" || proceed === "no") {
                console.log("Commit aborted.");
                process.exit(0);
            }
        } else {
            console.log("\n✅ No issues found in the staged changes.\n");
        }
    }

    // 2) Generate / regenerate loop
    let msg = await generateCommitMessage(config, diff);

    while (true) {
        console.log("\nProposed commit message:\n");
        console.log(msg + "\n");

        const choice = await askChoice(
            "(y) accept & commit  (e) edit  (r) regenerate  (n) cancel: "
        );

        if (choice === "n" || choice === "no") {
            console.log("Cancelled. No commit was made.");
            process.exit(0);
        }

        if (choice === "r") {
            msg = await generateCommitMessage(config, diff);
            continue;
        }

        if (choice === "e" || choice === "edit") {
            const edited = editMessageInEditor(msg);
            if (!edited) {
                console.log("Empty commit message. Cancelling.");
                process.exit(1);
            }
            msg = edited;
            // After editing, loop again so user can confirm
            continue;
        }

        if (choice === "y" || choice === "yes") {
            console.log("\nCommitting...\n");
            gitCommitWithMessage(msg);
            return;
        }

        console.log("Please choose y, e, r, or n.");
    }
}

// ------------------- CLI -------------------

const program = new Command();

program
    .name("commitwise")
    .description("Generate Git commit messages from staged changes using AI")
    .version("1.0.0");

program
    .command("suggest")
    .description("Generate and print a commit message (does not commit)")
    .action(async () => {
        const config = loadConfig();
        try {
            await suggestOnly(config);
        } catch (err: any) {
            console.error(err?.message ?? err);
            process.exit(1);
        }
    });

program
    .command("auto")
    .description(
        "Scan (optional), generate a message, and interactively commit"
    )
    .action(async () => {
        const config = loadConfig();
        try {
            await autoCommitFlow(config);
        } catch (err: any) {
            console.error(err?.message ?? err);
            process.exit(1);
        }
    });

program.parse(process.argv);
