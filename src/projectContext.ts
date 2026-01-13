import fs from "fs";
import path from "path";

export type FrontendFramework =
    | "vue"
    | "react"
    | "next"
    | "nuxt"
    | "svelte"
    | "angular"
    | "vite"
    | "unknown";

export interface ProjectContext {
    framework: FrontendFramework;
    language: "ts" | "js" | "mixed" | "unknown";
}

function readPkg(repoRoot: string): any | null {
    try {
        const p = path.join(repoRoot, "package.json");
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function detectProjectContext(repoRoot: string): ProjectContext {
    const pkg = readPkg(repoRoot);
    const deps = {
        ...(pkg?.dependencies ?? {}),
        ...(pkg?.devDependencies ?? {}),
    };

    const has = (name: string) => Boolean(deps[name]);

    // ---- framework detection (frontend) ----
    let framework: FrontendFramework = "unknown";
    if (has("nuxt") || has("nuxt3")) framework = "nuxt";
    else if (has("next")) framework = "next";
    else if (has("vue")) framework = "vue";
    else if (has("react")) framework = "react";
    else if (has("svelte")) framework = "svelte";
    else if (has("@angular/core")) framework = "angular";
    else if (has("vite")) framework = "vite";

    // ---- language detection ----
    // Simple: if typescript exists, assume TS (most frontend repos)
    const language: ProjectContext["language"] = has("typescript")
        ? "ts"
        : "js";

    return { framework, language };
}
