/* TypeScript file generated from ConcurrencySafety.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as ConcurrencySafetyJS from './ConcurrencySafety.bs.js';

import type {Global_timeoutId as Js_Global_timeoutId} from './Js.gen';

import type {ref as PervasivesU_ref} from './PervasivesU.gen';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type mutex<a> = {
  readonly value: PervasivesU_ref<a>; 
  readonly state: PervasivesU_ref<mutexState>; 
  readonly waitQueue: PervasivesU_ref<Array<() => void>>
};

export type safeCache<k,v> = {
  readonly data: PervasivesU_ref<{[id: string]: v}>; 
  readonly mutex: mutex<void>; 
  readonly maxSize: number
};

export type debounceState<a> = { readonly timeoutId: PervasivesU_ref<(undefined | Js_Global_timeoutId)>; readonly lastArgs: PervasivesU_ref<(undefined | a)> };

export type throttleState = { readonly lastExecuted: PervasivesU_ref<number>; readonly isThrottled: PervasivesU_ref<boolean> };

export const createMutex: <a>(initialValue:a) => mutex<a> = ConcurrencySafetyJS.createMutex as any;

export const tryLock: <a>(mutex:mutex<a>) => boolean = ConcurrencySafetyJS.tryLock as any;

export const lock: <a>(mutex:mutex<a>, timeoutMs:(undefined | number)) => Promise<ErrorHandling_result<void,string>> = ConcurrencySafetyJS.lock as any;

export const unlock: <a>(mutex:mutex<a>) => void = ConcurrencySafetyJS.unlock as any;

export const isLocked: <a>(mutex:mutex<a>) => boolean = ConcurrencySafetyJS.isLocked as any;

export const getValue: <a>(mutex:mutex<a>) => a = ConcurrencySafetyJS.getValue as any;

export const atomicRead: <a>(mutex:mutex<a>) => Promise<ErrorHandling_result<a,string>> = ConcurrencySafetyJS.atomicRead as any;

export const atomicWrite: <a>(mutex:mutex<a>, newValue:a) => Promise<ErrorHandling_result<void,string>> = ConcurrencySafetyJS.atomicWrite as any;

export const atomicUpdate: <a>(mutex:mutex<a>, fn:((_1:a) => a)) => Promise<ErrorHandling_result<a,string>> = ConcurrencySafetyJS.atomicUpdate as any;

export const atomicCAS: <a>(mutex:mutex<a>, expected:a, newValue:a) => Promise<ErrorHandling_result<boolean,string>> = ConcurrencySafetyJS.atomicCAS as any;

export const createSafeCache: <k,v>(maxSize:(undefined | number)) => safeCache<k,v> = ConcurrencySafetyJS.createSafeCache as any;

export const cacheGet: <k,v>(cache:safeCache<k,v>, key:string) => Promise<ErrorHandling_result<(undefined | v),string>> = ConcurrencySafetyJS.cacheGet as any;

export const cacheSet: <k>(cache:safeCache<k,string>, key:string, value:string) => Promise<ErrorHandling_result<void,string>> = ConcurrencySafetyJS.cacheSet as any;

export const cacheDelete: <k>(cache:safeCache<k,string>, key:string) => Promise<ErrorHandling_result<void,string>> = ConcurrencySafetyJS.cacheDelete as any;

export const cacheClear: <k,v>(cache:safeCache<k,v>) => Promise<ErrorHandling_result<void,string>> = ConcurrencySafetyJS.cacheClear as any;

export const cacheSize: <k,v>(cache:safeCache<k,v>) => Promise<ErrorHandling_result<number,string>> = ConcurrencySafetyJS.cacheSize as any;

export const sequential: <a>(operations:Array<(() => Promise<a>)>) => Promise<a[]> = ConcurrencySafetyJS.sequential as any;

export const sequentialResults: <a,err>(operations:Array<(() => Promise<ErrorHandling_result<a,err>>)>) => Promise<ErrorHandling_result<a[],err>> = ConcurrencySafetyJS.sequentialResults as any;

export const createDebounceState: <a>() => debounceState<a> = ConcurrencySafetyJS.createDebounceState as any;

export const debounce: <a>(state:debounceState<a>, fn:((_1:a) => void), args:a, delayMs:number) => void = ConcurrencySafetyJS.debounce as any;

export const createThrottleState: () => throttleState = ConcurrencySafetyJS.createThrottleState as any;

export const throttle: <a>(state:throttleState, fn:((_1:a) => void), args:a, intervalMs:number) => void = ConcurrencySafetyJS.throttle as any;
