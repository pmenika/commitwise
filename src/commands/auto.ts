import type { AiCommitConfig } from "../config/types.js";
import { generateCommitMessage } from "../scan/scanDiff.js";
import { getStagedDiff, validateStagedChanges } from "../git/diff.js";
import { commitWithMessage } from "../git/commit.js";
import { runFrontendChecks } from "../checks/runChecks.js";
import { handleScanPhase } from "../scan/filterIssues.js";
import { approveCommitMessage } from "../commit/messageApproval.js";

/**
 * Main flow: scan (optional) -> generate message -> allow accept/edit/regenerate/cancel -> commit.
 */
export async function autoCommitFlow(config: AiCommitConfig): Promise<void> {
    const diff = getStagedDiff();
    validateStagedChanges(diff);

    // 1) Scan for issues (if enabled)
    if (config.scanEnabled) {
        const systemPrompt = await runFrontendChecks(config);
        await handleScanPhase(config, diff, systemPrompt);
    }

    // 2) Generate and approve commit message
    const initialMessage = await generateCommitMessage(config, diff);
    const finalMessage = await approveCommitMessage(
        config,
        diff,
        initialMessage
    );

    // 3) Commit
    console.log("\nCommitting...\n");
    commitWithMessage(finalMessage);
}
