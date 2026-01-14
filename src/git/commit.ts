import { execSync } from "child_process";
import fs from "fs";
import { FINAL_COMMIT_MSG_FILE } from "../shared/constants.js";

/**
 * Commit using a message file. This supports multi-line messages safely.
 */
export function commitWithMessage(message: string): void {
    fs.writeFileSync(FINAL_COMMIT_MSG_FILE, message + "\n", "utf8");

    try {
        execSync(`git commit -F "${FINAL_COMMIT_MSG_FILE}"`, {
            stdio: "inherit",
        });
    } finally {
        // Cleanup temp file
        try {
            fs.unlinkSync(FINAL_COMMIT_MSG_FILE);
        } catch {
            // Ignore cleanup errors
        }
    }
}
