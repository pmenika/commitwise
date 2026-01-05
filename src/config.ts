import fs from "fs";
import path from "path";
import os from "os";
import type { AiCommitConfig } from "./configTypes.js";
import { defaultConfig } from "./configTypes.js";

function readJsonIfExists(filePath: string): Partial<AiCommitConfig> | null {
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function loadConfig(): AiCommitConfig {
    // 1) Global config: ~/.commitwiserc.json
    const globalPath = path.join(os.homedir(), ".commitwiserc.json");
    const globalCfg = readJsonIfExists(globalPath) ?? {};

    // 2) Project config: <repo>/.commitwiserc.json
    // Using process.cwd() assumes user runs the command from the repo directory.
    const projectPath = path.join(process.cwd(), ".commitwiserc.json");
    const projectCfg = readJsonIfExists(projectPath) ?? {};

    // 3) Merge: defaults <- global <- project
    return {
        ...defaultConfig,
        ...globalCfg,
        ...projectCfg,
    };
}
