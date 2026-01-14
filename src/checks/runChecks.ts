import type { AiCommitConfig } from "../config/types.js";
import { runBestFrontendCheck } from "./frontendCheck.js";
import { summarizeCheckOutput } from "./summarizeCheckOutput.js";
import { MAX_ISSUES_TO_DISPLAY } from "../shared/constants.js";
import { askChoice, isNo } from "../shared/ui.js";
import { SYSTEM_PROMPT_NO_CHECKS } from "../prompts/noChecks.js";
import { SYSTEM_PROMPT_CHECKS_PASSED } from "../prompts/checksPassed.js";

/**
 * Display check failure summary with LLM-generated explanation.
 */
async function displayCheckFailure(
    config: AiCommitConfig,
    checkName: string,
    checkOutput: string
): Promise<void> {
    console.log(`\n❌ ${checkName} failed.\n`);

    // ✅ Use LLM to summarize the check output for humans
    const explained = await summarizeCheckOutput(
        config,
        checkName,
        checkOutput
    );

    console.log(`Summary: ${explained.summary}\n`);

    if (explained.topIssues.length > 0) {
        console.log("Top issues:");
        explained.topIssues.slice(0, MAX_ISSUES_TO_DISPLAY).forEach((it, i) => {
            const prefix = it.file ? `[${it.file}] ` : "";
            console.log(`${i + 1}. ${prefix}${it.issue}`);
        });
        console.log("");
    } else {
        // fallback: show raw output if LLM couldn't extract anything
        console.log(checkOutput ? checkOutput + "\n" : "(no output)\n");
    }
}

/**
 * Run frontend checks and return the appropriate system prompt.
 * Returns null if no checks ran.
 */
export async function runFrontendChecks(
    config: AiCommitConfig
): Promise<string | null> {
    const check = runBestFrontendCheck(process.cwd());

    if (!check.ran) {
        console.log(
            "\nℹ️ No runnable scripts found in package.json. Falling back to AI scan.\n"
        );
        return null;
    }

    if (!check.ok) {
        await displayCheckFailure(
            config,
            check.name ?? "check",
            check.output ?? ""
        );

        const proceed = await askChoice(
            "Proceed anyway (use AI fallback)? (y/n): "
        );
        if (isNo(proceed)) {
            process.exit(0);
        }

        // ❗ Checks failed but user chose to proceed
        // → We must NOT assume checks passed
        return SYSTEM_PROMPT_NO_CHECKS;
    }

    console.log(`\n✅ ${check.name} passed.\n`);
    // ✅ Checks ran and passed
    // → Safe to assume tooling caught basics
    return SYSTEM_PROMPT_CHECKS_PASSED;
}
