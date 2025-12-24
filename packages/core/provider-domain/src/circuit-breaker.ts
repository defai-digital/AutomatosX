/**
 * Circuit Breaker Implementation
 *
 * Implements the circuit breaker pattern for provider resilience.
 * Prevents cascading failures by failing fast when a provider is unhealthy.
 *
 * Invariants:
 * - INV-CB-001: State transitions follow closed→open→halfOpen→closed
 * - INV-CB-002: Failure count resets on success in closed state
 * - INV-CB-003: Half-open allows limited requests for recovery testing
 */

import {
  type CircuitState,
  type ProviderCircuitBreakerConfig as CircuitBreakerConfig,
  type ProviderCircuitBreakerState as CircuitBreakerState,
  type ProviderCircuitBreakerEvent as CircuitBreakerEvent,
  type ProviderCircuitBreakerEventType as CircuitBreakerEventType,
  createDefaultProviderCircuitBreakerConfig as createDefaultCircuitBreakerConfig,
  createInitialProviderCircuitBreakerState as createInitialCircuitBreakerState,
  ProviderCircuitBreakerErrorCodes as CircuitBreakerErrorCodes,
} from '@automatosx/contracts';

/**
 * Circuit breaker instance for a single provider
 */
export interface CircuitBreaker {
  /** Get current state */
  getState(): CircuitBreakerState;

  /** Check if request is allowed */
  canExecute(): boolean;

  /** Record a successful request */
  recordSuccess(): void;

  /** Record a failed request */
  recordFailure(error?: string): void;

  /** Force circuit to open state */
  forceOpen(): void;

  /** Force circuit to closed state */
  forceClose(): void;

  /** Get event history */
  getEvents(): CircuitBreakerEvent[];

  /** Reset the circuit breaker */
  reset(): void;
}

/**
 * Circuit breaker event listener
 */
export type CircuitEventListener = (event: CircuitBreakerEvent) => void;

/**
 * Creates a circuit breaker for a provider
 */
export function createCircuitBreaker(
  providerId: string,
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  const cfg = { ...createDefaultCircuitBreakerConfig(), ...config };

  let state: CircuitBreakerState = createInitialCircuitBreakerState();
  const events: CircuitBreakerEvent[] = [];
  const listeners: CircuitEventListener[] = [];

  function emitEvent(
    type: CircuitBreakerEventType,
    details?: Record<string, unknown>
  ): void {
    const event: CircuitBreakerEvent = {
      eventId: crypto.randomUUID(),
      type,
      providerId,
      timestamp: new Date().toISOString(),
      previousState: state.state,
      currentState: state.state,
      details,
    };
    events.push(event);
    listeners.forEach((listener) => { listener(event); });
  }

  function transitionTo(newState: CircuitState): void {
    const previousState = state.state;
    const now = new Date().toISOString();

    state = {
      ...state,
      state: newState,
      lastTransitionTime: now,
    };

    if (newState === 'open') {
      state.nextAttemptTime = new Date(Date.now() + cfg.resetTimeoutMs).toISOString();
      emitEvent('circuit.opened', { failureCount: state.failureCount });
    } else if (newState === 'halfOpen') {
      state.successCount = 0;
      state.nextAttemptTime = undefined;
      emitEvent('circuit.halfOpen');
    } else if (newState === 'closed') {
      state.failureCount = 0;
      state.successCount = 0;
      state.nextAttemptTime = undefined;
      emitEvent('circuit.closed');
    }

    const stateEvent = events[events.length - 1];
    if (stateEvent) {
      stateEvent.previousState = previousState;
      stateEvent.currentState = newState;
    }
  }

  function shouldAttemptReset(): boolean {
    if (state.state !== 'open' || !state.nextAttemptTime) return false;
    return Date.now() >= new Date(state.nextAttemptTime).getTime();
  }

  return {
    getState(): CircuitBreakerState {
      return { ...state };
    },

    canExecute(): boolean {
      state.totalRequests++;

      // INV-CB-001: State transitions
      if (state.state === 'closed') {
        emitEvent('circuit.requestAllowed');
        return true;
      }

      if (state.state === 'open') {
        if (shouldAttemptReset()) {
          transitionTo('halfOpen');
          emitEvent('circuit.requestAllowed');
          return true;
        }
        emitEvent('circuit.requestRejected');
        return false;
      }

      // INV-CB-003: Half-open allows limited requests
      if (state.state === 'halfOpen') {
        if (state.successCount < cfg.halfOpenRequests) {
          emitEvent('circuit.requestAllowed');
          return true;
        }
        emitEvent('circuit.requestRejected');
        return false;
      }

      return false;
    },

    recordSuccess(): void {
      const now = new Date().toISOString();
      state.lastSuccessTime = now;

      if (state.state === 'closed') {
        // INV-CB-002: Reset failure count on success
        state.failureCount = 0;
        emitEvent('circuit.successRecorded');
      } else if (state.state === 'halfOpen') {
        state.successCount++;
        emitEvent('circuit.successRecorded');

        // All half-open requests succeeded, close circuit
        if (state.successCount >= cfg.successThreshold) {
          transitionTo('closed');
        }
      }
    },

    recordFailure(error?: string): void {
      const now = new Date().toISOString();
      state.failureCount++;
      state.totalFailures++;
      state.lastFailureTime = now;
      state.successCount = 0;

      emitEvent('circuit.failureRecorded', { error });

      if (state.state === 'closed') {
        if (state.failureCount >= cfg.failureThreshold) {
          transitionTo('open');
        }
      } else if (state.state === 'halfOpen') {
        // Any failure in half-open returns to open
        transitionTo('open');
      }
    },

    forceOpen(): void {
      if (state.state !== 'open') {
        transitionTo('open');
      }
    },

    forceClose(): void {
      if (state.state !== 'closed') {
        transitionTo('closed');
      }
    },

    getEvents(): CircuitBreakerEvent[] {
      return [...events];
    },

    reset(): void {
      state = createInitialCircuitBreakerState();
      events.length = 0;
    },
  };
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(
    public readonly code: string,
    public readonly providerId: string,
    message: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }

  static circuitOpen(providerId: string): CircuitBreakerError {
    return new CircuitBreakerError(
      CircuitBreakerErrorCodes.CIRCUIT_OPEN,
      providerId,
      `Circuit breaker is open for provider ${providerId}`
    );
  }
}
