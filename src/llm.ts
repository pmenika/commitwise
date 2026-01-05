// src/llm.ts
import OpenAI from "openai";
import type { AiCommitConfig } from "./configTypes.js";

interface ScannedResult {
    issues: string[];
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

        Only report issues that are true NOW and likely to cause:
        - runtime errors
        - incorrect behavior
        - security vulnerabilities
        - crashes

        Do NOT report:
        - speculative future concerns ("if this becomes complex…")
        - performance/micro-optimization advice (memoization, function recreation, etc.)
        - best-practice suggestions
        - refactoring recommendations
        - UI/CSS/layout concerns

        If no real issues exist, return {"issues": []}.
        Output JSON only: {"issues": string[]}
        Keep the response short and to the point.

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
                                type: "string",
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
