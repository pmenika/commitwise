import OpenAI from "openai";
import type { AiCommitConfig } from "../config/types.js";

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
            "or add to ~/.commitwiserc.json / .commitwiserc.json:",
            '  { "openaiApiKey": "sk-..." }',
        ].join("\n")
    );
}

function getClient(config: AiCommitConfig): OpenAI {
    return new OpenAI({ apiKey: resolveApiKey(config) });
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
