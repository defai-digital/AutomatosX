import { z } from 'zod';
/**
 * Schema for the `ax run` command
 *
 * Usage: ax run <agent> "<task>" [options]
 *
 * Examples:
 * - ax run backend "Implement user authentication API"
 * - ax run backend "Fix login bug" --streaming --provider claude
 * - ax run product "Design pricing page" --parallel --resumable
 */
export declare const RunCommandSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    agent: z.ZodEffects<z.ZodString, string, string>;
    task: z.ZodEffects<z.ZodString, string, string>;
    streaming: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    parallel: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    resumable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    provider: z.ZodOptional<z.ZodEnum<["claude", "claude-code", "gemini", "gemini-cli", "openai", "gpt"]>>;
    timeout: z.ZodOptional<z.ZodNumber>;
    useMemory: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    memoryLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxRetries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    parallel: boolean;
    agent: string;
    streaming: boolean;
    maxRetries: number;
    debug: boolean;
    task: string;
    quiet: boolean;
    resumable: boolean;
    useMemory: boolean;
    memoryLimit: number;
    provider?: "claude" | "gemini" | "openai" | "gpt" | "claude-code" | "gemini-cli" | undefined;
    timeout?: number | undefined;
}, {
    agent: string;
    task: string;
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    provider?: "claude" | "gemini" | "openai" | "gpt" | "claude-code" | "gemini-cli" | undefined;
    parallel?: boolean | undefined;
    streaming?: boolean | undefined;
    timeout?: number | undefined;
    maxRetries?: number | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
    resumable?: boolean | undefined;
    useMemory?: boolean | undefined;
    memoryLimit?: number | undefined;
}>;
export type RunCommand = z.infer<typeof RunCommandSchema>;
/**
 * Validation helper that throws user-friendly errors
 */
export declare function validateRunCommand(input: unknown): RunCommand;
/**
 * Safe validation that returns success/error result
 */
export declare function safeValidateRunCommand(input: unknown): {
    success: true;
    data: RunCommand;
} | {
    success: false;
    error: z.ZodError;
};
//# sourceMappingURL=RunCommandSchema.d.ts.map