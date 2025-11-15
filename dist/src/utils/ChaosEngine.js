// Sprint 2 Day 17: Chaos Engineering Framework
// Controlled failure injection for testing resilience
import { EventEmitter } from 'events';
import { SeededRandom } from './DeterministicSeeds.js';
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
export class ChaosEngine extends EventEmitter {
    config;
    random;
    events;
    stats;
    constructor(config = { enabled: false }) {
        super();
        this.config = {
            enabled: config.enabled,
            seed: config.seed || Date.now(),
            failureRate: config.failureRate || 0.2,
            scenarios: config.scenarios || this.getAllScenarios(),
            minDelay: config.minDelay || 100,
            maxDelay: config.maxDelay || 2000,
        };
        this.random = new SeededRandom(this.config.seed);
        this.events = [];
        this.stats = new Map();
        // Initialize stats
        this.getAllScenarios().forEach(scenario => {
            this.stats.set(scenario, 0);
        });
    }
    /**
     * Check if chaos should be injected
     */
    shouldInject(target, metadata) {
        if (!this.config.enabled) {
            return { shouldFail: false };
        }
        const roll = this.random.next();
        if (roll < this.config.failureRate) {
            const scenario = this.selectScenario();
            const error = this.createError(scenario);
            const delay = this.random.nextInRange(this.config.minDelay, this.config.maxDelay);
            this.recordEvent({
                type: scenario,
                timestamp: Date.now(),
                target,
                injected: true,
                metadata,
            });
            this.incrementStat(scenario);
            this.emit('chaos-injected', {
                scenario,
                target,
                error: error.message,
                delay,
            });
            return {
                shouldFail: true,
                scenario,
                delay,
                error,
            };
        }
        return { shouldFail: false };
    }
    /**
     * Inject delay (latency chaos)
     */
    async injectDelay(target) {
        if (!this.config.enabled) {
            return 0;
        }
        const result = this.shouldInject(target || 'latency-injection');
        if (result.shouldFail && result.delay) {
            await new Promise(resolve => setTimeout(resolve, result.delay));
            return result.delay;
        }
        return 0;
    }
    /**
     * Inject error if chaos should trigger
     */
    injectError(target, metadata) {
        const result = this.shouldInject(target, metadata);
        if (result.shouldFail && result.error) {
            throw result.error;
        }
    }
    /**
     * Conditionally inject chaos
     */
    async maybeInjectChaos(target, operation, metadata) {
        const result = this.shouldInject(target, metadata);
        if (result.shouldFail) {
            if (result.delay) {
                await new Promise(resolve => setTimeout(resolve, result.delay));
            }
            if (result.error) {
                throw result.error;
            }
        }
        return await operation();
    }
    /**
     * Enable chaos mode
     */
    enable(config) {
        this.config.enabled = true;
        if (config) {
            this.config = {
                ...this.config,
                ...config,
            };
        }
        this.emit('chaos-enabled', { config: this.config });
    }
    /**
     * Disable chaos mode
     */
    disable() {
        this.config.enabled = false;
        this.emit('chaos-disabled');
    }
    /**
     * Check if enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
        this.emit('config-updated', { config: this.config });
    }
    /**
     * Get chaos events
     */
    getEvents() {
        return [...this.events];
    }
    /**
     * Get chaos statistics
     */
    getStats() {
        return new Map(this.stats);
    }
    /**
     * Get summary statistics
     */
    getSummary() {
        const totalEvents = this.events.length;
        const eventsInjected = this.events.filter(e => e.injected).length;
        const scenarioCounts = {};
        this.stats.forEach((count, scenario) => {
            scenarioCounts[scenario] = count;
        });
        return {
            totalEvents,
            eventsInjected,
            scenarioCounts,
            failureRate: totalEvents > 0 ? eventsInjected / totalEvents : 0,
        };
    }
    /**
     * Reset statistics
     */
    reset() {
        this.events = [];
        this.stats.clear();
        this.getAllScenarios().forEach(scenario => {
            this.stats.set(scenario, 0);
        });
        this.emit('reset');
    }
    /**
     * Clear event history
     */
    clearEvents() {
        this.events = [];
        this.emit('events-cleared');
    }
    /**
     * Select a random chaos scenario
     */
    selectScenario() {
        const scenarios = this.config.scenarios;
        const index = Math.floor(this.random.next() * scenarios.length);
        return scenarios[index];
    }
    /**
     * Create error for scenario
     */
    createError(scenario) {
        const errors = {
            'provider-failure': 'Provider request failed (chaos injected)',
            'network-latency': 'Network latency exceeded timeout (chaos injected)',
            timeout: 'Operation timed out (chaos injected)',
            'memory-corruption': 'Memory corruption detected (chaos injected)',
            'disk-full': 'Disk full error (chaos injected)',
            'cache-miss': 'Cache miss forced (chaos injected)',
            'slow-query': 'Database query timeout (chaos injected)',
            'connection-error': 'Connection refused (chaos injected)',
        };
        const error = new Error(errors[scenario]);
        error.name = `ChaosError:${scenario}`;
        return error;
    }
    /**
     * Record chaos event
     */
    recordEvent(event) {
        this.events.push(event);
    }
    /**
     * Increment scenario stat
     */
    incrementStat(scenario) {
        const current = this.stats.get(scenario) || 0;
        this.stats.set(scenario, current + 1);
    }
    /**
     * Get all available scenarios
     */
    getAllScenarios() {
        return [
            'provider-failure',
            'network-latency',
            'timeout',
            'memory-corruption',
            'disk-full',
            'cache-miss',
            'slow-query',
            'connection-error',
        ];
    }
}
/**
 * Chaos mode helper decorator
 */
export function withChaos(chaos, target) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            return await chaos.maybeInjectChaos(target, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
/**
 * Global chaos engine instance
 */
let globalChaosEngine = null;
/**
 * Get or create global chaos engine
 */
export function getGlobalChaos(config) {
    if (!globalChaosEngine) {
        globalChaosEngine = new ChaosEngine(config);
    }
    return globalChaosEngine;
}
/**
 * Reset global chaos engine
 */
export function resetGlobalChaos() {
    globalChaosEngine = null;
}
//# sourceMappingURL=ChaosEngine.js.map