/* TypeScript file generated from RetryFallback.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as RetryFallbackJS from './RetryFallback.bs.js';

export type retryId = string;

export type strategyId = string;

export type retryStrategy = 
    { TAG: "FixedDelay"; readonly delayMs: number }
  | { TAG: "ExponentialBackoff"; readonly initialDelayMs: number; readonly maxDelayMs: number; readonly multiplier: number }
  | { TAG: "LinearBackoff"; readonly initialDelayMs: number; readonly incrementMs: number }
  | { TAG: "RandomJitter"; readonly baseDelayMs: number; readonly maxJitterMs: number };

export type errorType = 
    "Retryable"
  | "NonRetryable"
  | "RateLimited"
  | "Timeout";

export type retryConfig = {
  readonly maxAttempts: number; 
  readonly strategy: retryStrategy; 
  readonly timeout: (undefined | number); 
  readonly shouldRetry: (undefined | ((_1:string) => boolean))
};

export type fallbackStrategy<a> = 
    { TAG: "DefaultValue"; _0: a }
  | { TAG: "AlternativeFunction"; _0: () => Promise<
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: string }> }
  | { TAG: "Cached"; _0: a }
  | { TAG: "Degraded"; _0: a };

export type circuitState = "Closed" | "Open" | "HalfOpen";

export type circuitBreakerConfig = {
  readonly failureThreshold: number; 
  readonly successThreshold: number; 
  readonly timeout: number; 
  readonly halfOpenMaxAttempts: number
};

export type circuitBreaker = {
  readonly id: string; 
  readonly state: circuitState; 
  readonly failureCount: number; 
  readonly successCount: number; 
  readonly lastFailureTime: (undefined | number); 
  readonly config: circuitBreakerConfig
};

export type retryAttempt = {
  readonly attemptNumber: number; 
  readonly timestamp: number; 
  readonly error: (undefined | string); 
  readonly delayMs: number
};

export type retryExecution<a> = {
  readonly result: 
    {
    TAG: "Ok"; 
    _0: a
  }
  | {
    TAG: "Error"; 
    _0: string
  }; 
  readonly attempts: retryAttempt[]; 
  readonly totalDuration: number; 
  readonly usedFallback: boolean
};

export const createCircuitBreakerConfig: (failureThreshold:(undefined | number), successThreshold:(undefined | number), timeout:(undefined | number), halfOpenMaxAttempts:(undefined | number), _5:void) => circuitBreakerConfig = RetryFallbackJS.createCircuitBreakerConfig as any;

export const createCircuitBreaker: (id:(undefined | string), config:(undefined | circuitBreakerConfig), param:void) => circuitBreaker = RetryFallbackJS.createCircuitBreaker as any;

export const recordSuccess: (cb:circuitBreaker) => circuitBreaker = RetryFallbackJS.recordSuccess as any;

export const recordFailure: (cb:circuitBreaker) => circuitBreaker = RetryFallbackJS.recordFailure as any;

export const shouldAttempt: (cb:circuitBreaker) => [boolean, circuitBreaker] = RetryFallbackJS.shouldAttempt as any;

export const getCircuitState: (cb:circuitBreaker) => circuitState = RetryFallbackJS.getCircuitState as any;

export const resetCircuitBreaker: (cb:circuitBreaker) => circuitBreaker = RetryFallbackJS.resetCircuitBreaker as any;

export const createRetryConfig: (maxAttempts:(undefined | number), strategy:(undefined | retryStrategy), timeout:(undefined | number), shouldRetry:(undefined | (((_1:string) => boolean))), _5:void) => retryConfig = RetryFallbackJS.createRetryConfig as any;

export const retry: <a>(fn:(() => Promise<
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: string }>), config:retryConfig) => Promise<retryExecution<a>> = RetryFallbackJS.retry as any;

export const retryWithFallback: <a>(fn:(() => Promise<
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: string }>), config:retryConfig, fallback:fallbackStrategy<a>) => Promise<retryExecution<a>> = RetryFallbackJS.retryWithFallback as any;

export const retryWithCircuitBreaker: <a>(fn:(() => Promise<
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: string }>), config:retryConfig, circuitBreaker:circuitBreaker) => Promise<[retryExecution<a>, circuitBreaker]> = RetryFallbackJS.retryWithCircuitBreaker as any;

export const retryBatch: <a>(fns:Array<(() => Promise<
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: string }>)>, config:retryConfig) => Promise<retryExecution<a>[]> = RetryFallbackJS.retryBatch as any;

export const wasSuccessful: <a>(execution:retryExecution<a>) => boolean = RetryFallbackJS.wasSuccessful as any;

export const getAttemptCount: <a>(execution:retryExecution<a>) => number = RetryFallbackJS.getAttemptCount as any;

export const getTotalRetries: <a>(execution:retryExecution<a>) => number = RetryFallbackJS.getTotalRetries as any;

export const getAverageDelay: <a>(execution:retryExecution<a>) => number = RetryFallbackJS.getAverageDelay as any;

export const getLastError: <a>(execution:retryExecution<a>) => (undefined | string) = RetryFallbackJS.getLastError as any;

export const classifyError: (error:string) => errorType = RetryFallbackJS.classifyError as any;

export const isRetryable: (error:string) => boolean = RetryFallbackJS.isRetryable as any;

export const fixedDelay: (delayMs:number) => retryStrategy = RetryFallbackJS.fixedDelay as any;

export const exponentialBackoff: (initialDelayMs:(undefined | number), maxDelayMs:(undefined | number), multiplier:(undefined | number), _4:void) => retryStrategy = RetryFallbackJS.exponentialBackoff as any;

export const linearBackoff: (initialDelayMs:(undefined | number), incrementMs:(undefined | number), _3:void) => retryStrategy = RetryFallbackJS.linearBackoff as any;

export const randomJitter: (baseDelayMs:(undefined | number), maxJitterMs:(undefined | number), _3:void) => retryStrategy = RetryFallbackJS.randomJitter as any;
