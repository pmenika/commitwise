import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { execSync } from "child_process";
import fs from "fs";
import { TEMP_COMMIT_MSG_FILE } from "./constants.js";

/**
 * Ask user for a choice (y/n/e/r etc.)
 */
export async function askChoice(question: string): Promise<string> {
    const rl = createInterface({ input, output });
    const answer = (await rl.question(question)).trim().toLowerCase();
    rl.close();
    return answer;
}

/**
 * Open editor for commit message editing using a temp file.
 * Returns the edited message (trimmed). May return empty string.
 */
export function editMessageInEditor(initialMessage: string): string {
    const editor = process.env.GIT_EDITOR || process.env.EDITOR || "vi";

    fs.writeFileSync(TEMP_COMMIT_MSG_FILE, initialMessage + "\n", "utf8");

    // Open editor (blocking until user closes it)
    execSync(`${editor} "${TEMP_COMMIT_MSG_FILE}"`, { stdio: "inherit" });

    const edited = fs.readFileSync(TEMP_COMMIT_MSG_FILE, "utf8").trim();

    // Cleanup temp file
    try {
        fs.unlinkSync(TEMP_COMMIT_MSG_FILE);
    } catch {
        // Ignore cleanup errors
    }

    return edited;
}

/**
 * Normalize user input for yes questions.
 */
export function isYes(answer: string): boolean {
    return answer === "y" || answer === "yes";
}

/**
 * Normalize user input for no questions.
 */
export function isNo(answer: string): boolean {
    return answer === "n" || answer === "no";
}
