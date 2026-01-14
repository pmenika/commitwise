import { execSync } from "child_process";

/**
 * Read staged changes (what will be committed).
 */
export function getStagedDiff(): string {
    try {
        return execSync("git diff --cached", { encoding: "utf8" });
    } catch (err) {
        console.error("Error running `git diff --cached`:", err);
        process.exit(1);
    }
}

/**
 * Validate that there are staged changes, exit if not.
 */
export function validateStagedChanges(diff: string): void {
    if (!diff.trim()) {
        console.error("No staged changes detected. Run `git add` first.");
        process.exit(1);
    }
}
