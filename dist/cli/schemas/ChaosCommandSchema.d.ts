import { z } from 'zod';
/**
 * Chaos scenario enum
 */
export declare const ChaosScenarioSchema: z.ZodEnum<["provider-failure", "network-latency", "timeout", "memory-corruption", "disk-full", "cache-miss", "slow-query", "connection-error"]>;
export type ChaosScenario = z.infer<typeof ChaosScenarioSchema>;
/**
 * Chaos enable command
 *
 * @example
 * ```bash
 * ax chaos enable --failure-rate 0.3 --scenarios provider-failure,network-latency
 * ```
 */
export declare const ChaosEnableSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    failureRate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    scenarios: z.ZodOptional<z.ZodArray<z.ZodEnum<["provider-failure", "network-latency", "timeout", "memory-corruption", "disk-full", "cache-miss", "slow-query", "connection-error"]>, "many">>;
    seed: z.ZodOptional<z.ZodNumber>;
    minDelay: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxDelay: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    debug: boolean;
    quiet: boolean;
    failureRate: number;
    minDelay: number;
    maxDelay: number;
    scenarios?: ("timeout" | "provider-failure" | "network-latency" | "memory-corruption" | "disk-full" | "cache-miss" | "slow-query" | "connection-error")[] | undefined;
    seed?: number | undefined;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
    failureRate?: number | undefined;
    scenarios?: ("timeout" | "provider-failure" | "network-latency" | "memory-corruption" | "disk-full" | "cache-miss" | "slow-query" | "connection-error")[] | undefined;
    seed?: number | undefined;
    minDelay?: number | undefined;
    maxDelay?: number | undefined;
}>;
export type ChaosEnable = z.infer<typeof ChaosEnableSchema>;
/**
 * Chaos disable command
 *
 * @example
 * ```bash
 * ax chaos disable
 * ```
 */
export declare const ChaosDisableSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    reset: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    debug: boolean;
    reset: boolean;
    quiet: boolean;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    debug?: boolean | undefined;
    reset?: boolean | undefined;
    quiet?: boolean | undefined;
}>;
export type ChaosDisable = z.infer<typeof ChaosDisableSchema>;
/**
 * Chaos status command
 *
 * @example
 * ```bash
 * ax chaos status --verbose
 * ```
 */
export declare const ChaosStatusSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    events: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    stats: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    stats: boolean;
    debug: boolean;
    quiet: boolean;
    events: boolean;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    stats?: boolean | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
    events?: boolean | undefined;
}>;
export type ChaosStatus = z.infer<typeof ChaosStatusSchema>;
/**
 * Chaos test command
 *
 * Run chaos tests to validate system resilience
 *
 * @example
 * ```bash
 * ax chaos test --iterations 100 --failure-rate 0.5
 * ```
 */
export declare const ChaosTestSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    iterations: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    failureRate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    scenario: z.ZodOptional<z.ZodEnum<["provider-failure", "network-latency", "timeout", "memory-corruption", "disk-full", "cache-miss", "slow-query", "connection-error"]>>;
    parallel: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    parallel: boolean;
    timeout: number;
    debug: boolean;
    iterations: number;
    quiet: boolean;
    failureRate: number;
    scenario?: "timeout" | "provider-failure" | "network-latency" | "memory-corruption" | "disk-full" | "cache-miss" | "slow-query" | "connection-error" | undefined;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    parallel?: boolean | undefined;
    timeout?: number | undefined;
    debug?: boolean | undefined;
    iterations?: number | undefined;
    quiet?: boolean | undefined;
    failureRate?: number | undefined;
    scenario?: "timeout" | "provider-failure" | "network-latency" | "memory-corruption" | "disk-full" | "cache-miss" | "slow-query" | "connection-error" | undefined;
}>;
export type ChaosTest = z.infer<typeof ChaosTestSchema>;
//# sourceMappingURL=ChaosCommandSchema.d.ts.map