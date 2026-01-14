import type { AiCommitConfig } from "../config/types.js";
import { getStagedDiff, validateStagedChanges } from "../git/diff.js";
import { runFrontendChecks } from "../checks/runChecks.js";
import { handleScanPhase } from "../scan/filterIssues.js";

/**
 * Only run the scan phase (checks + AI scan) without generating a commit message.
 */
export async function scanOnly(config: AiCommitConfig): Promise<void> {
    const diff = getStagedDiff();
    validateStagedChanges(diff);

    // Run frontend checks and perform AI scan
    const systemPrompt = await runFrontendChecks(config);
    await handleScanPhase(config, diff, systemPrompt);
}
