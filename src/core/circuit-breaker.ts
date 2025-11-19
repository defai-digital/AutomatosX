/**
 * Circuit Breaker - Prevents cascading failures in provider selection
 *
 * v9.0.2: Extracted from Router for better modularity and testability
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, all requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

import { logger } from '../utils/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Failures before opening circuit
  cooldownMs: number;        // Time to wait before half-open
  successThreshold?: number; // Successes needed to close from half-open
}

export interface CircuitStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 3,
  cooldownMs: 60000, // 1 minute
  successThreshold: 2
};

/**
 * Circuit Breaker Implementation
 *
 * Manages circuit state for multiple resources (providers, services, etc.)
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private circuits = new Map<string, CircuitStats>();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if circuit is open for given resource
   */
  isOpen(resourceName: string): boolean {
    const circuit = this.getOrCreateCircuit(resourceName);
    const now = Date.now();

    // Check if circuit should transition to HALF_OPEN
    if (circuit.state === 'OPEN' && circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
      circuit.state = 'HALF_OPEN';
      circuit.successCount = 0;
      logger.info('[Circuit Breaker] Transitioning to HALF_OPEN', {
        resource: resourceName,
        cooldownMs: this.config.cooldownMs
      });
    }

    return circuit.state === 'OPEN';
  }

  /**
   * Record successful operation
   */
  recordSuccess(resourceName: string): void {
    const circuit = this.getOrCreateCircuit(resourceName);

    if (circuit.state === 'HALF_OPEN') {
      circuit.successCount++;

      if (circuit.successCount >= this.config.successThreshold) {
        this.close(resourceName);
      }
    } else if (circuit.state === 'CLOSED') {
      // Reset failure count on success
      circuit.failureCount = 0;
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(resourceName: string): void {
    const circuit = this.getOrCreateCircuit(resourceName);
    const now = Date.now();

    circuit.failureCount++;
    circuit.lastFailureTime = now;

    if (circuit.state === 'HALF_OPEN') {
      // Fail fast - return to OPEN immediately
      this.open(resourceName);
    } else if (circuit.failureCount >= this.config.failureThreshold) {
      this.open(resourceName);
    }
  }

  /**
   * Manually close circuit (reset)
   */
  close(resourceName: string): void {
    const circuit = this.getOrCreateCircuit(resourceName);
    circuit.state = 'CLOSED';
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.nextAttemptTime = null;

    logger.info('[Circuit Breaker] Circuit closed', {
      resource: resourceName
    });
  }

  /**
   * Manually open circuit
   */
  open(resourceName: string): void {
    const circuit = this.getOrCreateCircuit(resourceName);
    const now = Date.now();

    circuit.state = 'OPEN';
    circuit.nextAttemptTime = now + this.config.cooldownMs;

    logger.warn('[Circuit Breaker] Circuit opened', {
      resource: resourceName,
      failureCount: circuit.failureCount,
      nextAttemptTime: new Date(circuit.nextAttemptTime).toISOString()
    });
  }

  /**
   * Get circuit state
   */
  getState(resourceName: string): CircuitState {
    return this.getOrCreateCircuit(resourceName).state;
  }

  /**
   * Get circuit statistics
   */
  getStats(resourceName: string): CircuitStats {
    return { ...this.getOrCreateCircuit(resourceName) };
  }

  /**
   * Get all circuit statistics
   */
  getAllStats(): Map<string, CircuitStats> {
    const stats = new Map<string, CircuitStats>();
    for (const [name, circuit] of this.circuits) {
      stats.set(name, { ...circuit });
    }
    return stats;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const resourceName of this.circuits.keys()) {
      this.close(resourceName);
    }
  }

  /**
   * Get or create circuit for resource
   */
  private getOrCreateCircuit(resourceName: string): CircuitStats {
    let circuit = this.circuits.get(resourceName);

    if (!circuit) {
      circuit = {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      };
      this.circuits.set(resourceName, circuit);
    }

    return circuit;
  }
}
