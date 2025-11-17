/**
 * Effect-TS Utility Functions for AutomatosX
 *
 * Common patterns and helpers for working with Effect-TS.
 */

import { Effect, Schedule, Duration, pipe } from 'effect';
import {
  TimeoutError,
  RetryExhaustedError,
  FileReadError,
  FileWriteError,
  FileNotFoundError
} from './effect-errors.js';
import { readFile as fsReadFile, writeFile as fsWriteFile } from 'fs/promises';

// ========================================
// Retry Utilities
// ========================================

/**
 * Exponential backoff retry schedule
 *
 * @example
 * ```typescript
 * const effect = pipe(
 *   riskyOperation(),
 *   withExponentialRetry(3)
 * );
 * ```
 */
export const withExponentialRetry = <A, E>(maxAttempts: number) =>
  (effect: Effect.Effect<A, E>): Effect.Effect<A, E | RetryExhaustedError> =>
    pipe(
      effect,
      Effect.retry(
        Schedule.exponential(Duration.millis(100), 2.0).pipe(
          Schedule.compose(Schedule.recurs(maxAttempts - 1))
        )
      ),
      Effect.catchAll((error) =>
        Effect.fail(new RetryExhaustedError({
          operation: 'unknown',
          attempts: maxAttempts,
          lastError: error
        }))
      )
    );

/**
 * Retry with exponential backoff and max duration
 *
 * @example
 * ```typescript
 * const effect = pipe(
 *   loadConfig(),
 *   withRetryUntil({ maxAttempts: 5, maxDuration: '30 seconds' })
 * );
 * ```
 */
export const withRetryUntil = <A, E>(options: {
  maxAttempts: number;
  maxDuration: Duration.DurationInput;
}) =>
  (effect: Effect.Effect<A, E>): Effect.Effect<A, E | RetryExhaustedError> =>
    pipe(
      effect,
      Effect.retry(
        Schedule.exponential(Duration.millis(100), 2.0).pipe(
          Schedule.compose(Schedule.recurs(options.maxAttempts - 1)),
          Schedule.compose(Schedule.upTo(options.maxDuration))
        )
      ),
      Effect.catchAll((error) =>
        Effect.fail(new RetryExhaustedError({
          operation: 'unknown',
          attempts: options.maxAttempts,
          lastError: error
        }))
      )
    );

// ========================================
// Timeout Utilities
// ========================================

/**
 * Add timeout to an effect
 *
 * @example
 * ```typescript
 * const effect = pipe(
 *   longRunningTask(),
 *   withTimeout('5 minutes', 'longRunningTask')
 * );
 * ```
 */
export const withTimeout = <A, E>(
  duration: Duration.DurationInput,
  operation: string
) =>
  (effect: Effect.Effect<A, E>): Effect.Effect<A, E | TimeoutError> =>
    pipe(
      effect,
      Effect.timeout(duration),
      Effect.catchTag('TimeoutException', () =>
        Effect.fail(new TimeoutError({
          operation,
          timeoutMs: Duration.toMillis(Duration.decode(duration))
        }))
      )
    );

/**
 * Add timeout with retry
 *
 * @example
 * ```typescript
 * const effect = pipe(
 *   fetchData(),
 *   withTimeoutAndRetry({
 *     timeout: '30 seconds',
 *     operation: 'fetchData',
 *     maxAttempts: 3
 *   })
 * );
 * ```
 */
export const withTimeoutAndRetry = <A, E>(options: {
  timeout: Duration.DurationInput;
  operation: string;
  maxAttempts: number;
}) =>
  (effect: Effect.Effect<A, E>): Effect.Effect<A, E | TimeoutError | RetryExhaustedError> =>
    pipe(
      effect,
      withTimeout(options.timeout, options.operation),
      withExponentialRetry(options.maxAttempts)
    );

// ========================================
// File System Utilities
// ========================================

/**
 * Read file as Effect
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const content = yield* _(readFile('config.json'));
 *   return content;
 * });
 * ```
 */
export const readFile = (
  path: string,
  encoding: BufferEncoding = 'utf-8'
): Effect.Effect<string, FileReadError | FileNotFoundError> =>
  Effect.tryPromise({
    try: () => fsReadFile(path, encoding),
    catch: (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new FileNotFoundError({ path });
      }
      return new FileReadError({ path, cause: error });
    }
  });

/**
 * Write file as Effect
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   yield* _(writeFile('output.txt', 'Hello, World!'));
 * });
 * ```
 */
export const writeFile = (
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): Effect.Effect<void, FileWriteError> =>
  Effect.tryPromise({
    try: () => fsWriteFile(path, content, encoding),
    catch: (error) => new FileWriteError({ path, cause: error })
  });

// ========================================
// JSON Utilities
// ========================================

/**
 * Parse JSON as Effect
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const content = yield* _(readFile('data.json'));
 *   const data = yield* _(parseJSON(content));
 *   return data;
 * });
 * ```
 */
export const parseJSON = <T = unknown>(
  content: string
): Effect.Effect<T, Error> =>
  Effect.try({
    try: () => JSON.parse(content) as T,
    catch: (error) => error instanceof Error
      ? error
      : new Error(String(error))
  });

/**
 * Stringify JSON as Effect
 */
export const stringifyJSON = <T>(
  data: T,
  pretty = false
): Effect.Effect<string, Error> =>
  Effect.try({
    try: () => JSON.stringify(data, null, pretty ? 2 : 0),
    catch: (error) => error instanceof Error
      ? error
      : new Error(String(error))
  });

// ========================================
// Concurrency Utilities
// ========================================

/**
 * Execute effects with controlled concurrency
 *
 * @example
 * ```typescript
 * const results = yield* _(
 *   withConcurrency(
 *     [task1, task2, task3, task4, task5],
 *     { concurrency: 2 }
 *   )
 * );
 * ```
 */
export const withConcurrency = <A, E>(
  effects: ReadonlyArray<Effect.Effect<A, E>>,
  options: { concurrency: number | 'unbounded' }
): Effect.Effect<readonly A[], E> =>
  Effect.all(effects, options);

/**
 * Execute effects in parallel (unbounded concurrency)
 */
export const parallel = <A, E>(
  effects: ReadonlyArray<Effect.Effect<A, E>>
): Effect.Effect<readonly A[], E> =>
  Effect.all(effects, { concurrency: 'unbounded' });

/**
 * Execute effects sequentially (concurrency = 1)
 */
export const sequential = <A, E>(
  effects: ReadonlyArray<Effect.Effect<A, E>>
): Effect.Effect<readonly A[], E> =>
  Effect.all(effects, { concurrency: 1 });

// ========================================
// Resource Management
// ========================================

/**
 * Acquire a resource with automatic cleanup
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const db = yield* _(withResource(
 *     Effect.sync(() => new Database()),
 *     (db) => Effect.sync(() => db.close())
 *   ));
 *
 *   const result = yield* _(queryDatabase(db));
 *   return result;
 *   // Database automatically closed here
 * });
 * ```
 */
export const withResource = <R, E, A, E2>(
  acquire: Effect.Effect<R, E>,
  release: (resource: R) => Effect.Effect<void, E2>
) =>
  (use: (resource: R) => Effect.Effect<A, E2>): Effect.Effect<A, E | E2> =>
    Effect.gen(function* (_) {
      const resource = yield* _(acquire);
      yield* _(Effect.addFinalizer(() => release(resource)));
      return yield* _(use(resource));
    });

// ========================================
// Logging Utilities
// ========================================

/**
 * Log effect execution with timing
 *
 * @example
 * ```typescript
 * const effect = pipe(
 *   slowOperation(),
 *   withLogging('slowOperation')
 * );
 * ```
 */
export const withLogging = <A, E>(label: string) =>
  (effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    Effect.gen(function* (_) {
      const start = Date.now();
      yield* _(Effect.log(`[${label}] Starting...`));

      const result = yield* _(
        effect.pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* (_) {
              const duration = Date.now() - start;
              yield* _(Effect.logError(`[${label}] Failed after ${duration}ms`, error));
              return yield* _(Effect.fail(error));
            })
          )
        )
      );

      const duration = Date.now() - start;
      yield* _(Effect.log(`[${label}] Completed in ${duration}ms`));

      return result;
    });

// ========================================
// Caching Utilities
// ========================================

/**
 * Cache effect result with TTL
 *
 * @example
 * ```typescript
 * const cachedConfig = cached(
 *   loadConfig(),
 *   '1 hour'
 * );
 * ```
 */
export const cached = <A, E>(
  effect: Effect.Effect<A, E>,
  ttl: Duration.DurationInput
): Effect.Effect<Effect.Effect<A, E>> =>
  effect.pipe(Effect.cached(ttl));

// ========================================
// Error Handling Utilities
// ========================================

/**
 * Catch specific error tag and recover
 *
 * @example
 * ```typescript
 * const effect = pipe(
 *   riskyOperation(),
 *   catchAndRecover('TimeoutError', () => defaultValue)
 * );
 * ```
 */
export const catchAndRecover = <E extends { _tag: string }, A, E2>(
  tag: E['_tag'],
  recover: (error: E) => Effect.Effect<A, E2>
) =>
  <A2>(effect: Effect.Effect<A2, E>): Effect.Effect<A | A2, Exclude<E, { _tag: typeof tag }> | E2> =>
    effect.pipe(Effect.catchTag(tag, recover));

/**
 * Ignore specific error
 */
export const ignoreError = <E extends { _tag: string }>(tag: E['_tag']) =>
  <A>(effect: Effect.Effect<A, E>): Effect.Effect<A | void, Exclude<E, { _tag: typeof tag }>> =>
    effect.pipe(
      Effect.catchTag(tag, () => Effect.void)
    );

// ========================================
// Validation Utilities
// ========================================

/**
 * Validate with Zod schema as Effect
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const schema = z.object({ name: z.string() });
 *
 * const program = Effect.gen(function* (_) {
 *   const data = yield* _(parseJSON(jsonString));
 *   const validated = yield* _(validateWithZod(schema, data));
 *   return validated;
 * });
 * ```
 */
export const validateWithZod = <T>(
  schema: { parse: (data: unknown) => T },
  data: unknown
): Effect.Effect<T, Error> =>
  Effect.try({
    try: () => schema.parse(data),
    catch: (error) => error instanceof Error
      ? error
      : new Error(String(error))
  });

// ========================================
// Conditional Utilities
// ========================================

/**
 * Execute effect conditionally
 *
 * @example
 * ```typescript
 * const effect = when(
 *   shouldProcess,
 *   () => processData()
 * );
 * ```
 */
export const when = <A, E>(
  condition: boolean,
  effect: () => Effect.Effect<A, E>
): Effect.Effect<A | void, E> =>
  condition ? effect() : Effect.void;

/**
 * Execute effect unless condition is true
 */
export const unless = <A, E>(
  condition: boolean,
  effect: () => Effect.Effect<A, E>
): Effect.Effect<A | void, E> =>
  when(!condition, effect);
