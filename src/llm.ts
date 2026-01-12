// src/llm.ts
import OpenAI from "openai";
import type { AiCommitConfig } from "./configTypes.js";

interface ScannedIssue {
    file: string; // taken from diff headers, e.g. "src/composables/useCart.ts"
    issue: string; // short description
}

interface ScannedResult {
    issues: ScannedIssue[];
}

const MAX_CHARS = 15000; // limit input size to avoid LLM overload

function resolveApiKey(config: AiCommitConfig): string {
    const envKey = process.env.OPENAI_API_KEY?.trim();
    if (envKey) return envKey;

    const cfgKey = config.openaiApiKey?.trim();
    if (cfgKey) return cfgKey;

    throw new Error(
        [
            "OPENAI API key not found.",
            "Set env var:",
            '  export OPENAI_API_KEY="sk-..."',
            "or add to ~/.safe-commitrc.json / .safe-commitrc.json:",
            '  { "openaiApiKey": "sk-..." }',
        ].join("\n")
    );
}

function getClient(config: AiCommitConfig): OpenAI {
    return new OpenAI({ apiKey: resolveApiKey(config) });
}

function truncate(diff: string) {
    return diff.length > MAX_CHARS ? diff.slice(0, MAX_CHARS) : diff;
}

export async function scanCodeDiff(
    config: AiCommitConfig,
    diff: string
): Promise<ScannedResult> {
    const client = getClient(config);
    const model = config.model;
    const truncatedDiff = truncate(diff);
    const SYSTEM_PROMPT = `
        You are a pre-commit safety scanner.

        Report ONLY issues that are TRUE NOW and PROVABLE from the provided staged diff.
        Only report issues likely to cause:
        - runtime errors
        - incorrect behavior
        - security vulnerabilities
        - crashes

        HARD RULES:
        - Do NOT report any issue unless the diff explicitly shows the problem.
        - If you cannot point to a concrete changed line/pattern in the diff, return {"issues":[]}.
        - Do NOT invent "could be undefined/null" scenarios.

        Do NOT report:
        - speculative/hypothetical concerns ("if X is undefined/null…", "ensure X exists…")
        - best practices, refactors, style, performance, UI/CSS
        - "missing/undefined/null" warnings for statically typed code (TypeScript, defineProps<Props>(), typed emits)
        UNLESS the diff introduces optional/nullable/unsafe typing or access (?:, null/undefined unions, any, unknown, casts, optional chaining, non-null assertions, removed guards)

        ASSUME:
        - Required typed props/values are present and correctly shaped at runtime unless the diff weakens types.

        OUTPUT JSON ONLY in this exact shape:
        {
        "issues": [
            {
            "file": "path/from the diff header (+++ b/...) without the leading b/",
            "issue": "short, concrete problem"
            }
        ]
        }

        Rules for "file":
        - Extract it from diff headers (lines like '+++ b/<path>').
        - If an issue spans multiple files, create separate issues per file.
        - Do NOT use placeholders like 'unknown' unless no file headers exist.

        If no evidence-backed issues exist, return {"issues": []}.
        Keep the response short.
    `;

    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `Here is the staged git diff:\n\n${truncatedDiff}`,
            },
        ],

        max_tokens: 150,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "scanned_result",
                schema: {
                    type: "object",
                    properties: {
                        issues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    file: { type: "string" },
                                    issue: { type: "string" },
                                },
                                required: ["file", "issue"],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ["issues"],
                    additionalProperties: false,
                },
            },
        },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        return { issues: [] };
    }

    try {
        const result = JSON.parse(content) as ScannedResult;
        return result;
    } catch (error) {
        console.error("Failed to parse LLM response:", error);
        return { issues: [] };
    }
}

export async function generateCommitMessage(
    config: AiCommitConfig,
    diff: string
): Promise<string> {
    const client = getClient(config);
    const model = config.model;
    const SYSTEM_PROMPT = `
        You are an assistant that writes high-quality Git commit messages.

        Rules:
        - Use Conventional Commits format: <type>: <short summary>
        Examples: "feat: add user login screen", "fix: handle null user id"
        - Keep the subject line under ${config.maxCommitMessageLength} characters.
        - Be specific and describe the intent of the change, not the file names.
        - If the diff is empty or trivial, respond with "chore: update dependencies" or similar.
        `;

    const truncatedDiff = truncate(diff);

    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `Here is the staged git diff:\n\n${truncatedDiff}`,
            },
        ],
        max_tokens: 120,
    });

    const msg =
        completion.choices[0]?.message.content?.trim() ?? "chore: update code";

    // Ensure it's a single line (commit subject)
    return msg.split("\n")[0] ?? msg;
}
