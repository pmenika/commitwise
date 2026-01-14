import type { AiCommitConfig } from "../config/types.js";
import { generateCommitMessage } from "../scan/scanDiff.js";
import { getStagedDiff, validateStagedChanges } from "../git/diff.js";

/**
 * Only generate + print a commit message (no commit).
 */
export async function suggestOnly(config: AiCommitConfig): Promise<void> {
    const diff = getStagedDiff();
    validateStagedChanges(diff);

    const msg = await generateCommitMessage(config, diff);
    console.log(msg);
}
