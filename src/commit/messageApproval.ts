import type { AiCommitConfig } from "../config/types.js";
import { generateCommitMessage } from "../scan/scanDiff.js";
import { askChoice, editMessageInEditor, isNo, isYes } from "../shared/ui.js";

/**
 * Handle user choice during commit message approval.
 */
async function handleApprovalChoice(
    choice: string,
    currentMessage: string,
    config: AiCommitConfig,
    diff: string
): Promise<{ action: "commit" | "continue"; message?: string }> {
    if (isNo(choice)) {
        console.log("Cancelled. No commit was made.");
        process.exit(0);
    }

    if (choice === "r") {
        const newMessage = await generateCommitMessage(config, diff);
        return { action: "continue", message: newMessage };
    }

    if (choice === "e" || choice === "edit") {
        const edited = editMessageInEditor(currentMessage);
        if (!edited) {
            console.log("Empty commit message. Cancelling.");
            process.exit(1);
        }
        return { action: "continue", message: edited };
    }

    if (isYes(choice)) {
        return { action: "commit", message: currentMessage };
    }

    console.log("Please choose y, e, r, or n.");
    return { action: "continue", message: currentMessage };
}

/**
 * Interactive loop for commit message approval.
 * Returns the final approved message.
 */
export async function approveCommitMessage(
    config: AiCommitConfig,
    diff: string,
    initialMessage: string
): Promise<string> {
    let msg = initialMessage;

    while (true) {
        console.log("\nProposed commit message:\n");
        console.log(msg + "\n");

        const choice = await askChoice(
            "(y) accept & commit  (e) edit  (r) regenerate  (n) cancel: "
        );

        const result = await handleApprovalChoice(choice, msg, config, diff);

        if (result.action === "commit") {
            return result.message!;
        }

        if (result.message) {
            msg = result.message;
        }
    }
}
