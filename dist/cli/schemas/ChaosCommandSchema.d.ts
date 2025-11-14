import { z } from 'zod';
/**
 * Chaos scenario enum
 */
export declare const ChaosScenarioSchema: z.ZodEnum<{
    timeout: "timeout";
    "provider-failure": "provider-failure";
    "network-latency": "network-latency";
    "memory-corruption": "memory-corruption";
    "disk-full": "disk-full";
    "cache-miss": "cache-miss";
    "slow-query": "slow-query";
    "connection-error": "connection-error";
}>;
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
    failureRate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    scenarios: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        timeout: "timeout";
        "provider-failure": "provider-failure";
        "network-latency": "network-latency";
        "memory-corruption": "memory-corruption";
        "disk-full": "disk-full";
        "cache-miss": "cache-miss";
        "slow-query": "slow-query";
        "connection-error": "connection-error";
    }>>>;
    seed: z.ZodOptional<z.ZodNumber>;
    minDelay: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxDelay: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
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
    reset: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
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
    events: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    stats: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
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
    iterations: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    failureRate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    scenario: z.ZodOptional<z.ZodEnum<{
        timeout: "timeout";
        "provider-failure": "provider-failure";
        "network-latency": "network-latency";
        "memory-corruption": "memory-corruption";
        "disk-full": "disk-full";
        "cache-miss": "cache-miss";
        "slow-query": "slow-query";
        "connection-error": "connection-error";
    }>>;
    parallel: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type ChaosTest = z.infer<typeof ChaosTestSchema>;
//# sourceMappingURL=ChaosCommandSchema.d.ts.map