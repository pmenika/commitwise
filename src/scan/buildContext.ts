/**
 * Build framework context string for the LLM.
 */
export function buildFrameworkContext(
    framework: string,
    language: string
): string {
    return `
        Project context:
        - framework: ${framework}
        - language: ${language}

        Guardrails (apply to any project/language):
        - Do NOT report framework best-practice advice as issues (e.g., "not reactive", "should be computed",
        "avoid calling functions in templates").
        - Only report reactivity/state-update issues if the diff shows a concrete broken update path.
        - Only report performance issues if the diff shows a meaningful regression (not micro-optimizations).
        - Avoid uncertainty wording like "may/might/could" unless the diff shows a definite failure path.
        `.trim();
}
