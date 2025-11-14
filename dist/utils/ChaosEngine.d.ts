import { EventEmitter } from 'events';
/**
 * Chaos scenario types
 */
export type ChaosScenario = 'provider-failure' | 'network-latency' | 'timeout' | 'memory-corruption' | 'disk-full' | 'cache-miss' | 'slow-query' | 'connection-error';
/**
 * Chaos configuration
 */
export interface ChaosConfig {
    enabled: boolean;
    seed?: number;
    failureRate?: number;
    scenarios?: ChaosScenario[];
    minDelay?: number;
    maxDelay?: number;
}
/**
 * Chaos event
 */
export interface ChaosEvent {
    type: ChaosScenario;
    timestamp: number;
    target: string;
    injected: boolean;
    metadata?: Record<string, unknown>;
}
/**
 * Chaos injection result
 */
export interface ChaosInjectionResult {
    shouldFail: boolean;
    scenario?: ChaosScenario;
    delay?: number;
    error?: Error;
}
/**
 * Chaos Engine
 *
 * Controlled failure injection for testing system resilience
 *
 * @example
 * ```typescript
 * const chaos = new ChaosEngine({
 *   enabled: true,
 *   failureRate: 0.3,
 *   scenarios: ['provider-failure', 'network-latency'],
 *   seed: 12345
 * })
 *
 * // Check if should inject failure
 * const result = chaos.shouldInject('provider-request')
 * if (result.shouldFail) {
 *   throw result.error
 * }
 *
 * // Add delay
 * await chaos.injectDelay()
 * ```
 */
export declare class ChaosEngine extends EventEmitter {
    private config;
    private random;
    private events;
    private stats;
    constructor(config?: ChaosConfig);
    /**
     * Check if chaos should be injected
     */
    shouldInject(target: string, metadata?: Record<string, unknown>): ChaosInjectionResult;
    /**
     * Inject delay (latency chaos)
     */
    injectDelay(target?: string): Promise<number>;
    /**
     * Inject error if chaos should trigger
     */
    injectError(target: string, metadata?: Record<string, unknown>): void;
    /**
     * Conditionally inject chaos
     */
    maybeInjectChaos(target: string, operation: () => Promise<any>, metadata?: Record<string, unknown>): Promise<any>;
    /**
     * Enable chaos mode
     */
    enable(config?: Partial<ChaosConfig>): void;
    /**
     * Disable chaos mode
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Get configuration
     */
    getConfig(): ChaosConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ChaosConfig>): void;
    /**
     * Get chaos events
     */
    getEvents(): ChaosEvent[];
    /**
     * Get chaos statistics
     */
    getStats(): Map<ChaosScenario, number>;
    /**
     * Get summary statistics
     */
    getSummary(): {
        totalEvents: number;
        eventsInjected: number;
        scenarioCounts: Record<ChaosScenario, number>;
        failureRate: number;
    };
    /**
     * Reset statistics
     */
    reset(): void;
    /**
     * Clear event history
     */
    clearEvents(): void;
    /**
     * Select a random chaos scenario
     */
    private selectScenario;
    /**
     * Create error for scenario
     */
    private createError;
    /**
     * Record chaos event
     */
    private recordEvent;
    /**
     * Increment scenario stat
     */
    private incrementStat;
    /**
     * Get all available scenarios
     */
    private getAllScenarios;
}
/**
 * Chaos mode helper decorator
 */
export declare function withChaos(chaos: ChaosEngine, target: string): (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Get or create global chaos engine
 */
export declare function getGlobalChaos(config?: ChaosConfig): ChaosEngine;
/**
 * Reset global chaos engine
 */
export declare function resetGlobalChaos(): void;
//# sourceMappingURL=ChaosEngine.d.ts.map