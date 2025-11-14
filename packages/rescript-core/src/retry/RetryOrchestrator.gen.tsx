/* TypeScript file generated from RetryOrchestrator.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as RetryOrchestratorJS from './RetryOrchestrator.bs.js';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type retryConfig = {
  readonly maxAttempts: number; 
  readonly initialDelayMs: number; 
  readonly maxDelayMs: number; 
  readonly backoffMultiplier: number; 
  readonly jitter: boolean
};

export type retryStrategy = 
    { TAG: "Exponential"; _0: retryConfig }
  | { TAG: "Linear"; _0: number; _1: number }
  | { TAG: "Immediate"; _0: number }
  | { TAG: "Fixed"; _0: number; _1: number };

export type retryable<ok,err> = {
  readonly operation: () => Promise<ErrorHandling_result<ok,err>>; 
  readonly shouldRetry: (_1:err) => boolean; 
  readonly onRetry: (_1:number, _2:err) => void; 
  readonly onSuccess: (_1:ok) => void; 
  readonly onFailure: (_1:err) => void
};

export type circuitState = 
    "Closed"
  | "HalfOpen"
  | { TAG: "Open"; _0: number };

export type circuitBreakerConfig = {
  readonly failureThreshold: number; 
  readonly successThreshold: number; 
  readonly cooldownPeriodMs: number; 
  readonly timeoutMs: number
};

export type circuitBreaker<ok,err> = {
  state: circuitState; 
  failureCount: number; 
  successCount: number; 
  readonly config: circuitBreakerConfig; 
  readonly operation: retryable<ok,err>
};

export const defaultRetryConfig: retryConfig = RetryOrchestratorJS.defaultRetryConfig as any;

export const createRetryable: <err,ok>(operation:(() => Promise<ErrorHandling_result<ok,err>>), shouldRetry:(undefined | (((_1:err) => boolean))), onRetry:(undefined | (((_1:number, _2:err) => void))), onSuccess:(undefined | (((_1:ok) => void))), onFailure:(undefined | (((_1:err) => void)))) => retryable<ok,err> = RetryOrchestratorJS.createRetryable as any;

export const calculateExponentialDelay: (config:retryConfig, attemptNumber:number) => number = RetryOrchestratorJS.calculateExponentialDelay as any;

export const calculateLinearDelay: (baseDelayMs:number, attemptNumber:number) => number = RetryOrchestratorJS.calculateLinearDelay as any;

export const getDelayForStrategy: (strategy:retryStrategy, attemptNumber:number) => number = RetryOrchestratorJS.getDelayForStrategy as any;

export const getMaxAttempts: (strategy:retryStrategy) => number = RetryOrchestratorJS.getMaxAttempts as any;

export const retry: <err,ok>(retryable:retryable<ok,err>, strategy:retryStrategy) => Promise<ErrorHandling_result<ok,err>> = RetryOrchestratorJS.retry as any;

export const defaultCircuitBreakerConfig: circuitBreakerConfig = RetryOrchestratorJS.defaultCircuitBreakerConfig as any;

export const createCircuitBreaker: <err,ok>(operation:retryable<ok,err>, config:(undefined | circuitBreakerConfig)) => circuitBreaker<ok,err> = RetryOrchestratorJS.createCircuitBreaker as any;

export const shouldAllowOperation: <err,ok>(breaker:circuitBreaker<ok,err>) => ErrorHandling_result<void,string> = RetryOrchestratorJS.shouldAllowOperation as any;

export const recordSuccess: <err,ok>(breaker:circuitBreaker<ok,err>) => void = RetryOrchestratorJS.recordSuccess as any;

export const recordFailure: <err,ok>(breaker:circuitBreaker<ok,err>) => void = RetryOrchestratorJS.recordFailure as any;

export const executeWithCircuitBreaker: <ok>(breaker:circuitBreaker<ok,string>) => Promise<ErrorHandling_result<ok,string>> = RetryOrchestratorJS.executeWithCircuitBreaker as any;

export const retryWithCircuitBreaker: <ok>(retryable:retryable<ok,string>, strategy:retryStrategy, circuitConfig:circuitBreakerConfig) => Promise<ErrorHandling_result<ok,string>> = RetryOrchestratorJS.retryWithCircuitBreaker as any;

export const retryBatch: <err,ok>(operations:retryable<ok,err>[], strategy:retryStrategy) => Promise<ErrorHandling_result<ok[],err>> = RetryOrchestratorJS.retryBatch as any;

export const retryBatchParallel: <err,ok>(operations:retryable<ok,err>[], strategy:retryStrategy) => Promise<ErrorHandling_result<ok,err>[]> = RetryOrchestratorJS.retryBatchParallel as any;

export const getStrategyName: (strategy:retryStrategy) => string = RetryOrchestratorJS.getStrategyName as any;

export const getCircuitStateName: (state:circuitState) => string = RetryOrchestratorJS.getCircuitStateName as any;

export const isNetworkError: (statusCode:number) => boolean = RetryOrchestratorJS.isNetworkError as any;

export const isTimeoutError: (message:string) => boolean = RetryOrchestratorJS.isTimeoutError as any;

export const isConnectionError: (message:string) => boolean = RetryOrchestratorJS.isConnectionError as any;
