import OpenAI from "openai";
import type { AiCommitConfig } from "../config/types.js";

interface ScannedIssue {
    file: string;
    issue: string;
}

interface ScannedResult {
    issues: ScannedIssue[];
}

const MAX_CHARS = 50000;

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

function truncate(diff: string): string {
    if (diff.length > MAX_CHARS) {
        console.log(
            `\n⚠️  Warning: Diff is large (${diff.length} chars). Truncating to ${MAX_CHARS} chars for AI analysis.`
        );
        console.log(
            "   Consider committing in smaller batches for more accurate scanning.\n"
        );
        return diff.slice(0, MAX_CHARS);
    }
    return diff;
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

        max_tokens: 500,
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
