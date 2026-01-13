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
    diff: string,
    systemPrompt: string,
    contextText?: string
): Promise<ScannedResult> {
    const client = getClient(config);
    const model = config.model;
    const truncatedDiff = truncate(diff);

    const userContent = `
        ${contextText ? contextText : ""}
        Here is the staged git diff:

        ${truncatedDiff}
        `.trim();

    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: userContent,
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

export async function summarizeCheckOutput(
    config: AiCommitConfig,
    checkName: string,
    checkOutput: string
): Promise<{
    summary: string;
    topIssues: Array<{ file?: string; issue: string }>;
}> {
    const client = getClient(config);
    const model = config.model;

    const SYSTEM_PROMPT = `
        You are a build/typecheck/lint/test output explainer for a frontend project.

        Rules:
        - Summarize ONLY what the tool output says (no new speculation).
        - Extract the most actionable issues first.
        - If file paths exist in the output, include them.
        - Keep it short and practical.

        Output JSON only in this exact shape:
        {
        "summary": "short summary",
        "topIssues": [
            { "file": "optional path", "issue": "actionable description" }
        ]
        }
`;

    const trimmed =
        checkOutput.length > 15000 ? checkOutput.slice(0, 15000) : checkOutput;

    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `Command: ${checkName}\n\nOutput:\n${trimmed}`,
            },
        ],
        max_tokens: 300,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "check_explainer",
                schema: {
                    type: "object",
                    properties: {
                        summary: { type: "string" },
                        topIssues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    file: { type: "string" },
                                    issue: { type: "string" },
                                },
                                required: ["issue"],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ["summary", "topIssues"],
                    additionalProperties: false,
                },
            },
        },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { summary: "Check failed.", topIssues: [] };

    try {
        return JSON.parse(content);
    } catch {
        return {
            summary: "Check failed (could not parse summary).",
            topIssues: [],
        };
    }
}
