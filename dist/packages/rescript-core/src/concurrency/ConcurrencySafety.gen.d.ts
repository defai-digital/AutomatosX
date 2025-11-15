import type { Global_timeoutId as Js_Global_timeoutId } from './Js.gen';
import type { ref as PervasivesU_ref } from './PervasivesU.gen';
import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export type mutex<a> = {
    readonly value: PervasivesU_ref<a>;
    readonly state: PervasivesU_ref<mutexState>;
    readonly waitQueue: PervasivesU_ref<Array<() => void>>;
};
export type safeCache<k, v> = {
    readonly data: PervasivesU_ref<{
        [id: string]: v;
    }>;
    readonly mutex: mutex<void>;
    readonly maxSize: number;
};
export type debounceState<a> = {
    readonly timeoutId: PervasivesU_ref<(undefined | Js_Global_timeoutId)>;
    readonly lastArgs: PervasivesU_ref<(undefined | a)>;
};
export type throttleState = {
    readonly lastExecuted: PervasivesU_ref<number>;
    readonly isThrottled: PervasivesU_ref<boolean>;
};
export declare const createMutex: <a>(initialValue: a) => mutex<a>;
export declare const tryLock: <a>(mutex: mutex<a>) => boolean;
export declare const lock: <a>(mutex: mutex<a>, timeoutMs: (undefined | number)) => Promise<ErrorHandling_result<void, string>>;
export declare const unlock: <a>(mutex: mutex<a>) => void;
export declare const isLocked: <a>(mutex: mutex<a>) => boolean;
export declare const getValue: <a>(mutex: mutex<a>) => a;
export declare const atomicRead: <a>(mutex: mutex<a>) => Promise<ErrorHandling_result<a, string>>;
export declare const atomicWrite: <a>(mutex: mutex<a>, newValue: a) => Promise<ErrorHandling_result<void, string>>;
export declare const atomicUpdate: <a>(mutex: mutex<a>, fn: ((_1: a) => a)) => Promise<ErrorHandling_result<a, string>>;
export declare const atomicCAS: <a>(mutex: mutex<a>, expected: a, newValue: a) => Promise<ErrorHandling_result<boolean, string>>;
export declare const createSafeCache: <k, v>(maxSize: (undefined | number)) => safeCache<k, v>;
export declare const cacheGet: <k, v>(cache: safeCache<k, v>, key: string) => Promise<ErrorHandling_result<(undefined | v), string>>;
export declare const cacheSet: <k>(cache: safeCache<k, string>, key: string, value: string) => Promise<ErrorHandling_result<void, string>>;
export declare const cacheDelete: <k>(cache: safeCache<k, string>, key: string) => Promise<ErrorHandling_result<void, string>>;
export declare const cacheClear: <k, v>(cache: safeCache<k, v>) => Promise<ErrorHandling_result<void, string>>;
export declare const cacheSize: <k, v>(cache: safeCache<k, v>) => Promise<ErrorHandling_result<number, string>>;
export declare const sequential: <a>(operations: Array<(() => Promise<a>)>) => Promise<a[]>;
export declare const sequentialResults: <a, err>(operations: Array<(() => Promise<ErrorHandling_result<a, err>>)>) => Promise<ErrorHandling_result<a[], err>>;
export declare const createDebounceState: <a>() => debounceState<a>;
export declare const debounce: <a>(state: debounceState<a>, fn: ((_1: a) => void), args: a, delayMs: number) => void;
export declare const createThrottleState: () => throttleState;
export declare const throttle: <a>(state: throttleState, fn: ((_1: a) => void), args: a, intervalMs: number) => void;
//# sourceMappingURL=ConcurrencySafety.gen.d.ts.map