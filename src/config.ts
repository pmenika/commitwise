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
    // 1) Global config: ~/.safe-commitrc.json
    const globalPath = path.join(os.homedir(), ".safe-commitrc.json");
    const globalCfg = readJsonIfExists(globalPath) ?? {};

    // 2) Project config: <repo>/.safe-commitrc.json
    // Using process.cwd() assumes user runs the command from the repo directory.
    const projectPath = path.join(process.cwd(), ".safe-commitrc.json");
    const projectCfg = readJsonIfExists(projectPath) ?? {};

    // 3) Merge: defaults <- global <- project
    return {
        ...defaultConfig,
        ...globalCfg,
        ...projectCfg,
    };
}
