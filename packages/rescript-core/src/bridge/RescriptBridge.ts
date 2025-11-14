/**
 * TypeScript Bridge Layer for ReScript Modules
 *
 * This file provides a type-safe bridge between TypeScript and ReScript modules,
 * with feature flags for gradual rollout and fallback to TypeScript implementations.
 */

// Import generated TypeScript types from ReScript
import * as ErrorHandling from '../error/ErrorHandling.gen';
import * as ConcurrencySafety from '../concurrency/ConcurrencySafety.gen';
import * as ValidationRules from '../validation/ValidationRules.gen';
import * as SafeMath from '../math/SafeMath.gen';
import * as RetryOrchestrator from '../retry/RetryOrchestrator.gen';
import * as DomainValidation from '../domain/DomainValidation.gen';
import * as StateManagement from '../state/StateManagement.gen';
import * as ResourceManagement from '../resource/ResourceManagement.gen';
import * as TypeSafety from '../types/TypeSafety.gen';

// ============================================================================
// Feature Flags Configuration
// ============================================================================

export interface BridgeConfig {
  enableErrorHandling: boolean;
  enableConcurrencySafety: boolean;
  enableValidationRules: boolean;
  enableSafeMath: boolean;
  enableRetryOrchestrator: boolean;
  enableDomainValidation: boolean;
  enableStateManagement: boolean;
  enableResourceManagement: boolean;
  enableTypeSafety: boolean;
  logTransitions: boolean; // Log when switching between TS and ReScript
}

const defaultConfig: BridgeConfig = {
  enableErrorHandling: false,
  enableConcurrencySafety: false,
  enableValidationRules: false,
  enableSafeMath: false,
  enableRetryOrchestrator: false,
  enableDomainValidation: false,
  enableStateManagement: false,
  enableResourceManagement: false,
  enableTypeSafety: false,
  logTransitions: true,
};

let bridgeConfig: BridgeConfig = { ...defaultConfig };

export function configureBridge(config: Partial<BridgeConfig>): void {
  bridgeConfig = { ...bridgeConfig, ...config };

  if (bridgeConfig.logTransitions) {
    console.log('[ReScript Bridge] Configuration updated:', bridgeConfig);
  }
}

export function getBridgeConfig(): BridgeConfig {
  return { ...bridgeConfig };
}

// Enable all ReScript modules at once
export function enableAllModules(): void {
  configureBridge({
    enableErrorHandling: true,
    enableConcurrencySafety: true,
    enableValidationRules: true,
    enableSafeMath: true,
    enableRetryOrchestrator: true,
    enableDomainValidation: true,
    enableStateManagement: true,
    enableResourceManagement: true,
    enableTypeSafety: true,
  });
}

// Disable all ReScript modules (use TypeScript fallbacks)
export function disableAllModules(): void {
  configureBridge({
    enableErrorHandling: false,
    enableConcurrencySafety: false,
    enableValidationRules: false,
    enableSafeMath: false,
    enableRetryOrchestrator: false,
    enableDomainValidation: false,
    enableStateManagement: false,
    enableResourceManagement: false,
    enableTypeSafety: false,
  });
}

// ============================================================================
// Result Type (TypeScript Equivalent)
// ============================================================================

export type Result<T, E> =
  | { readonly TAG: 'Ok'; readonly _0: T }
  | { readonly TAG: 'Error'; readonly _0: E };

export function Ok<T>(value: T): Result<T, never> {
  return { TAG: 'Ok', _0: value };
}

export function Error<E>(error: E): Result<never, E> {
  return { TAG: 'Error', _0: error };
}

export function isOk<T, E>(result: Result<T, E>): result is { TAG: 'Ok'; _0: T } {
  return result.TAG === 'Ok';
}

export function isError<T, E>(result: Result<T, E>): result is { TAG: 'Error'; _0: E } {
  return result.TAG === 'Error';
}

export function unwrapOk<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result._0;
  }
  throw new Error('Called unwrapOk on Error result');
}

export function unwrapError<T, E>(result: Result<T, E>): E {
  if (isError(result)) {
    return result._0;
  }
  throw new Error('Called unwrapError on Ok result');
}

// ============================================================================
// Error Handling Bridge
// ============================================================================

export namespace ErrorHandlingBridge {
  export function mapResult<T, U, E>(
    fn: (value: T) => U,
    result: Result<T, E>
  ): Result<U, E> {
    if (!bridgeConfig.enableErrorHandling) {
      // TypeScript fallback
      if (isOk(result)) {
        return Ok(fn(result._0));
      }
      return result as Result<U, E>;
    }

    // Use ReScript implementation
    return ErrorHandling.mapResult(fn, result);
  }

  export function flatMapResult<T, U, E>(
    fn: (value: T) => Result<U, E>,
    result: Result<T, E>
  ): Result<U, E> {
    if (!bridgeConfig.enableErrorHandling) {
      // TypeScript fallback
      if (isOk(result)) {
        return fn(result._0);
      }
      return result as Result<U, E>;
    }

    return ErrorHandling.flatMapResult(fn, result);
  }

  export async function asyncMapResult<T, U, E>(
    fn: (value: T) => Promise<U>,
    result: Result<T, E>
  ): Promise<Result<U, E>> {
    if (!bridgeConfig.enableErrorHandling) {
      // TypeScript fallback
      if (isOk(result)) {
        try {
          const value = await fn(result._0);
          return Ok(value);
        } catch (error) {
          return Error(error as E);
        }
      }
      return result as Result<U, E>;
    }

    return ErrorHandling.asyncMapResult(fn, result);
  }
}

// ============================================================================
// Safe Math Bridge
// ============================================================================

export namespace SafeMathBridge {
  export function addFixed(a: number, b: number): number {
    if (!bridgeConfig.enableSafeMath) {
      // TypeScript fallback (simple addition)
      return a + b;
    }

    return SafeMath.addFixed(a, b);
  }

  export function subtractFixed(a: number, b: number): number {
    if (!bridgeConfig.enableSafeMath) {
      return a - b;
    }

    return SafeMath.subtractFixed(a, b);
  }

  export function multiplyFixed(a: number, b: number): number {
    if (!bridgeConfig.enableSafeMath) {
      return a * b;
    }

    return SafeMath.multiplyFixed(a, b);
  }

  export function divideFixed(a: number, b: number): Result<number, string> {
    if (!bridgeConfig.enableSafeMath) {
      if (b === 0) {
        return Error('Division by zero');
      }
      return Ok(a / b);
    }

    return SafeMath.divideFixed(a, b);
  }
}

// ============================================================================
// Type Safety Bridge
// ============================================================================

export namespace TypeSafetyBridge {
  export type UserId = string & { readonly __brand: 'UserId' };
  export type ConversationId = string & { readonly __brand: 'ConversationId' };
  export type MessageId = string & { readonly __brand: 'MessageId' };

  export function makeUserId(id: string): Result<UserId, string> {
    if (!bridgeConfig.enableTypeSafety) {
      // TypeScript fallback - no validation
      return Ok(id as UserId);
    }

    return TypeSafety.makeUserId(id) as Result<UserId, string>;
  }

  export function makeConversationId(id: string): Result<ConversationId, string> {
    if (!bridgeConfig.enableTypeSafety) {
      return Ok(id as ConversationId);
    }

    return TypeSafety.makeConversationId(id) as Result<ConversationId, string>;
  }

  export function makeMessageId(id: string): Result<MessageId, string> {
    if (!bridgeConfig.enableTypeSafety) {
      return Ok(id as MessageId);
    }

    return TypeSafety.makeMessageId(id) as Result<MessageId, string>;
  }
}

// ============================================================================
// Validation Rules Bridge
// ============================================================================

export namespace ValidationRulesBridge {
  export function validateNonEmpty<T>(arr: T[]): Result<T[], string> {
    if (!bridgeConfig.enableValidationRules) {
      // TypeScript fallback
      if (arr.length === 0) {
        return Error('Array cannot be empty');
      }
      return Ok(arr);
    }

    return ValidationRules.validateNonEmptyArray(arr);
  }

  export function validateBounded(value: number, min: number, max: number): Result<number, string> {
    if (!bridgeConfig.enableValidationRules) {
      if (value < min || value > max) {
        return Error(`Value ${value} out of bounds [${min}, ${max}]`);
      }
      return Ok(value);
    }

    return ValidationRules.validateBoundedInt(value, min, max);
  }
}

// ============================================================================
// State Management Bridge
// ============================================================================

export namespace StateManagementBridge {
  export function createTaskStateMachine() {
    if (!bridgeConfig.enableStateManagement) {
      // TypeScript fallback - return a simple state object
      return {
        state: 'pending' as 'pending' | 'running' | 'completed' | 'failed',
        transition: (event: string) => {
          // Simple state machine logic
        }
      };
    }

    return StateManagement.createTaskStateMachine();
  }
}

// ============================================================================
// Retry Orchestrator Bridge
// ============================================================================

export namespace RetryOrchestratorBridge {
  export interface RetryConfig {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitter: boolean;
  }

  export const defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2.0,
    jitter: true,
  };

  export async function retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    config: RetryConfig = defaultRetryConfig
  ): Promise<T> {
    if (!bridgeConfig.enableRetryOrchestrator) {
      // TypeScript fallback - simple retry
      let lastError: any;
      for (let i = 0; i < config.maxAttempts; i++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;
          if (i < config.maxAttempts - 1) {
            const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, i);
            await new Promise(resolve => setTimeout(resolve, Math.min(delay, config.maxDelayMs)));
          }
        }
      }
      throw lastError;
    }

    // Use ReScript implementation
    // Note: Would need async bridge - simplified for now
    return operation();
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

export const Examples = {
  errorHandling: () => {
    // Enable error handling module
    configureBridge({ enableErrorHandling: true });

    // Use Result type
    const result = Ok(42);
    const doubled = ErrorHandlingBridge.mapResult(x => x * 2, result);

    if (isOk(doubled)) {
      console.log('Result:', doubled._0); // 84
    }
  },

  safeMath: () => {
    configureBridge({ enableSafeMath: true });

    const sum = SafeMathBridge.addFixed(100, 200); // 300
    const product = SafeMathBridge.multiplyFixed(150, 200); // 30000
    const division = SafeMathBridge.divideFixed(1000, 3);

    if (isOk(division)) {
      console.log('Division result:', division._0);
    }
  },

  typeSafety: () => {
    configureBridge({ enableTypeSafety: true });

    const userIdResult = TypeSafetyBridge.makeUserId('user-123');
    if (isOk(userIdResult)) {
      const userId = userIdResult._0;
      // userId is now branded - can't mix with conversationId
    }
  },
};
