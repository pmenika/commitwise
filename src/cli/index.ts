#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "../config/loadConfig.js";
import { autoCommitFlow } from "../commands/auto.js";
import { suggestOnly } from "../commands/suggest.js";
import { scanOnly } from "../commands/scan.js";

/**
 * Handle command errors consistently.
 */
async function handleCommandError(action: () => Promise<void>): Promise<void> {
    try {
        await action();
    } catch (err: any) {
        console.error(err?.message ?? err);
        process.exit(1);
    }
}

// ================= CLI Setup =================

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
        await handleCommandError(() => suggestOnly(config));
    });

program
    .command("scan")
    .description("Run checks and AI scan on staged changes (does not commit)")
    .action(async () => {
        const config = loadConfig();
        await handleCommandError(() => scanOnly(config));
    });

program
    .command("auto")
    .description(
        "Scan (optional), generate a message, and interactively commit"
    )
    .action(async () => {
        const config = loadConfig();
        await handleCommandError(() => autoCommitFlow(config));
    });

program.parse(process.argv);
