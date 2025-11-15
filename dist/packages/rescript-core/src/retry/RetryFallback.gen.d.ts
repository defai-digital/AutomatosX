export type retryId = string;
export type strategyId = string;
export type retryStrategy = {
    TAG: "FixedDelay";
    readonly delayMs: number;
} | {
    TAG: "ExponentialBackoff";
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
    readonly multiplier: number;
} | {
    TAG: "LinearBackoff";
    readonly initialDelayMs: number;
    readonly incrementMs: number;
} | {
    TAG: "RandomJitter";
    readonly baseDelayMs: number;
    readonly maxJitterMs: number;
};
export type errorType = "Retryable" | "NonRetryable" | "RateLimited" | "Timeout";
export type retryConfig = {
    readonly maxAttempts: number;
    readonly strategy: retryStrategy;
    readonly timeout: (undefined | number);
    readonly shouldRetry: (undefined | ((_1: string) => boolean));
};
export type fallbackStrategy<a> = {
    TAG: "DefaultValue";
    _0: a;
} | {
    TAG: "AlternativeFunction";
    _0: () => Promise<{
        TAG: "Ok";
        _0: a;
    } | {
        TAG: "Error";
        _0: string;
    }>;
} | {
    TAG: "Cached";
    _0: a;
} | {
    TAG: "Degraded";
    _0: a;
};
export type circuitState = "Closed" | "Open" | "HalfOpen";
export type circuitBreakerConfig = {
    readonly failureThreshold: number;
    readonly successThreshold: number;
    readonly timeout: number;
    readonly halfOpenMaxAttempts: number;
};
export type circuitBreaker = {
    readonly id: string;
    readonly state: circuitState;
    readonly failureCount: number;
    readonly successCount: number;
    readonly lastFailureTime: (undefined | number);
    readonly config: circuitBreakerConfig;
};
export type retryAttempt = {
    readonly attemptNumber: number;
    readonly timestamp: number;
    readonly error: (undefined | string);
    readonly delayMs: number;
};
export type retryExecution<a> = {
    readonly result: {
        TAG: "Ok";
        _0: a;
    } | {
        TAG: "Error";
        _0: string;
    };
    readonly attempts: retryAttempt[];
    readonly totalDuration: number;
    readonly usedFallback: boolean;
};
export declare const createCircuitBreakerConfig: (failureThreshold: (undefined | number), successThreshold: (undefined | number), timeout: (undefined | number), halfOpenMaxAttempts: (undefined | number), _5: void) => circuitBreakerConfig;
export declare const createCircuitBreaker: (id: (undefined | string), config: (undefined | circuitBreakerConfig), param: void) => circuitBreaker;
export declare const recordSuccess: (cb: circuitBreaker) => circuitBreaker;
export declare const recordFailure: (cb: circuitBreaker) => circuitBreaker;
export declare const shouldAttempt: (cb: circuitBreaker) => [boolean, circuitBreaker];
export declare const getCircuitState: (cb: circuitBreaker) => circuitState;
export declare const resetCircuitBreaker: (cb: circuitBreaker) => circuitBreaker;
export declare const createRetryConfig: (maxAttempts: (undefined | number), strategy: (undefined | retryStrategy), timeout: (undefined | number), shouldRetry: (undefined | (((_1: string) => boolean))), _5: void) => retryConfig;
export declare const retry: <a>(fn: (() => Promise<{
    TAG: "Ok";
    _0: a;
} | {
    TAG: "Error";
    _0: string;
}>), config: retryConfig) => Promise<retryExecution<a>>;
export declare const retryWithFallback: <a>(fn: (() => Promise<{
    TAG: "Ok";
    _0: a;
} | {
    TAG: "Error";
    _0: string;
}>), config: retryConfig, fallback: fallbackStrategy<a>) => Promise<retryExecution<a>>;
export declare const retryWithCircuitBreaker: <a>(fn: (() => Promise<{
    TAG: "Ok";
    _0: a;
} | {
    TAG: "Error";
    _0: string;
}>), config: retryConfig, circuitBreaker: circuitBreaker) => Promise<[retryExecution<a>, circuitBreaker]>;
export declare const retryBatch: <a>(fns: Array<(() => Promise<{
    TAG: "Ok";
    _0: a;
} | {
    TAG: "Error";
    _0: string;
}>)>, config: retryConfig) => Promise<retryExecution<a>[]>;
export declare const wasSuccessful: <a>(execution: retryExecution<a>) => boolean;
export declare const getAttemptCount: <a>(execution: retryExecution<a>) => number;
export declare const getTotalRetries: <a>(execution: retryExecution<a>) => number;
export declare const getAverageDelay: <a>(execution: retryExecution<a>) => number;
export declare const getLastError: <a>(execution: retryExecution<a>) => (undefined | string);
export declare const classifyError: (error: string) => errorType;
export declare const isRetryable: (error: string) => boolean;
export declare const fixedDelay: (delayMs: number) => retryStrategy;
export declare const exponentialBackoff: (initialDelayMs: (undefined | number), maxDelayMs: (undefined | number), multiplier: (undefined | number), _4: void) => retryStrategy;
export declare const linearBackoff: (initialDelayMs: (undefined | number), incrementMs: (undefined | number), _3: void) => retryStrategy;
export declare const randomJitter: (baseDelayMs: (undefined | number), maxJitterMs: (undefined | number), _3: void) => retryStrategy;
//# sourceMappingURL=RetryFallback.gen.d.ts.map