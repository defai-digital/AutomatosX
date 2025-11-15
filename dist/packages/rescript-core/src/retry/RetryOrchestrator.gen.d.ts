import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export type retryConfig = {
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
    readonly backoffMultiplier: number;
    readonly jitter: boolean;
};
export type retryStrategy = {
    TAG: "Exponential";
    _0: retryConfig;
} | {
    TAG: "Linear";
    _0: number;
    _1: number;
} | {
    TAG: "Immediate";
    _0: number;
} | {
    TAG: "Fixed";
    _0: number;
    _1: number;
};
export type retryable<ok, err> = {
    readonly operation: () => Promise<ErrorHandling_result<ok, err>>;
    readonly shouldRetry: (_1: err) => boolean;
    readonly onRetry: (_1: number, _2: err) => void;
    readonly onSuccess: (_1: ok) => void;
    readonly onFailure: (_1: err) => void;
};
export type circuitState = "Closed" | "HalfOpen" | {
    TAG: "Open";
    _0: number;
};
export type circuitBreakerConfig = {
    readonly failureThreshold: number;
    readonly successThreshold: number;
    readonly cooldownPeriodMs: number;
    readonly timeoutMs: number;
};
export type circuitBreaker<ok, err> = {
    state: circuitState;
    failureCount: number;
    successCount: number;
    readonly config: circuitBreakerConfig;
    readonly operation: retryable<ok, err>;
};
export declare const defaultRetryConfig: retryConfig;
export declare const createRetryable: <err, ok>(operation: (() => Promise<ErrorHandling_result<ok, err>>), shouldRetry: (undefined | (((_1: err) => boolean))), onRetry: (undefined | (((_1: number, _2: err) => void))), onSuccess: (undefined | (((_1: ok) => void))), onFailure: (undefined | (((_1: err) => void)))) => retryable<ok, err>;
export declare const calculateExponentialDelay: (config: retryConfig, attemptNumber: number) => number;
export declare const calculateLinearDelay: (baseDelayMs: number, attemptNumber: number) => number;
export declare const getDelayForStrategy: (strategy: retryStrategy, attemptNumber: number) => number;
export declare const getMaxAttempts: (strategy: retryStrategy) => number;
export declare const retry: <err, ok>(retryable: retryable<ok, err>, strategy: retryStrategy) => Promise<ErrorHandling_result<ok, err>>;
export declare const defaultCircuitBreakerConfig: circuitBreakerConfig;
export declare const createCircuitBreaker: <err, ok>(operation: retryable<ok, err>, config: (undefined | circuitBreakerConfig)) => circuitBreaker<ok, err>;
export declare const shouldAllowOperation: <err, ok>(breaker: circuitBreaker<ok, err>) => ErrorHandling_result<void, string>;
export declare const recordSuccess: <err, ok>(breaker: circuitBreaker<ok, err>) => void;
export declare const recordFailure: <err, ok>(breaker: circuitBreaker<ok, err>) => void;
export declare const executeWithCircuitBreaker: <ok>(breaker: circuitBreaker<ok, string>) => Promise<ErrorHandling_result<ok, string>>;
export declare const retryWithCircuitBreaker: <ok>(retryable: retryable<ok, string>, strategy: retryStrategy, circuitConfig: circuitBreakerConfig) => Promise<ErrorHandling_result<ok, string>>;
export declare const retryBatch: <err, ok>(operations: retryable<ok, err>[], strategy: retryStrategy) => Promise<ErrorHandling_result<ok[], err>>;
export declare const retryBatchParallel: <err, ok>(operations: retryable<ok, err>[], strategy: retryStrategy) => Promise<ErrorHandling_result<ok, err>[]>;
export declare const getStrategyName: (strategy: retryStrategy) => string;
export declare const getCircuitStateName: (state: circuitState) => string;
export declare const isNetworkError: (statusCode: number) => boolean;
export declare const isTimeoutError: (message: string) => boolean;
export declare const isConnectionError: (message: string) => boolean;
//# sourceMappingURL=RetryOrchestrator.gen.d.ts.map