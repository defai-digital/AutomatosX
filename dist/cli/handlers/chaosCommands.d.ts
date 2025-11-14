/**
 * Enable chaos mode
 *
 * @example
 * ```bash
 * ax chaos enable --failure-rate 0.3 --scenarios provider-failure,network-latency
 * ```
 */
export declare function chaosEnableCommand(rawArgs: unknown): Promise<void>;
/**
 * Disable chaos mode
 *
 * @example
 * ```bash
 * ax chaos disable --reset
 * ```
 */
export declare function chaosDisableCommand(rawArgs: unknown): Promise<void>;
/**
 * Show chaos mode status
 *
 * @example
 * ```bash
 * ax chaos status --events --verbose
 * ```
 */
export declare function chaosStatusCommand(rawArgs: unknown): Promise<void>;
/**
 * Run chaos tests
 *
 * @example
 * ```bash
 * ax chaos test --iterations 100 --failure-rate 0.5
 * ```
 */
export declare function chaosTestCommand(rawArgs: unknown): Promise<void>;
//# sourceMappingURL=chaosCommands.d.ts.map