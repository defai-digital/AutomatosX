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
    agent: z.ZodString;
    task: z.ZodString;
    streaming: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    parallel: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    resumable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    provider: z.ZodOptional<z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
        "claude-code": "claude-code";
        "gemini-cli": "gemini-cli";
        gpt: "gpt";
    }>>;
    timeout: z.ZodOptional<z.ZodNumber>;
    useMemory: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    memoryLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxRetries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
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