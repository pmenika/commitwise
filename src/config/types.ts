export type AiCommitConfig = {
    openaiApiKey?: string;
    maxCommitMessageLength: number;
    scanEnabled: boolean;
    model: string;
};

export const defaultConfig: AiCommitConfig = {
    maxCommitMessageLength: 72,
    scanEnabled: true,
    model: "gpt-4o",
};
