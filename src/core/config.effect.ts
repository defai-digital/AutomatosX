/**
 * Effect-TS Config Loader
 *
 * Example implementation of config loading using Effect-TS.
 * Demonstrates service pattern, error handling, retry, and caching.
 *
 * This is a parallel implementation to config.ts - gradually migrate callers.
 */

import { Effect, Context, Layer, Schedule, Duration } from 'effect';
import { load as loadYaml } from 'js-yaml';
import type { AutomatosXConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { deepMerge } from '../utils/deep-merge.js';
import { automatosXConfigSchema } from './config-schemas.js';
import {
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
  FileNotFoundError,
  FileReadError
} from './effect-errors.js';
import {
  readFile,
  parseJSON,
  validateWithZod,
  withTimeout,
  withExponentialRetry
} from './effect-utils.js';
import { resolvePath, extname, existsSync } from '../utils/path-utils.js';

// ========================================
// Config Service Interface
// ========================================

/**
 * Config Service
 *
 * Provides config loading with caching, retry, and validation.
 */
export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    /**
     * Load configuration from project directory
     */
    readonly load: (projectDir: string) => Effect.Effect<
      AutomatosXConfig,
      | ConfigNotFoundError
      | ConfigParseError
      | ConfigValidationError
      | FileReadError
    >;

    /**
     * Load configuration with caching
     */
    readonly loadCached: (projectDir: string) => Effect.Effect<
      AutomatosXConfig,
      | ConfigNotFoundError
      | ConfigParseError
      | ConfigValidationError
      | FileReadError
    >;

    /**
     * Reload configuration (bypass cache)
     */
    readonly reload: (projectDir: string) => Effect.Effect<
      AutomatosXConfig,
      | ConfigNotFoundError
      | ConfigParseError
      | ConfigValidationError
      | FileReadError
    >;
  }
>() {}

// ========================================
// Internal Helpers
// ========================================

/**
 * Find config file path
 */
const findConfigPath = (projectDir: string): Effect.Effect<string, ConfigNotFoundError> =>
  Effect.gen(function* (_) {
    // Try project configs in priority order
    const projectConfigs = [
      resolvePath(projectDir, '.automatosx', 'config.yaml'),
      resolvePath(projectDir, '.automatosx', 'config.json'),
      resolvePath(projectDir, 'automatosx.config.yaml'),
      resolvePath(projectDir, 'automatosx.config.json')
    ];

    for (const configPath of projectConfigs) {
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    // Try user home config
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const userConfigs = [
      resolvePath(homeDir, '.automatosx', 'config.yaml'),
      resolvePath(homeDir, '.automatosx', 'config.json')
    ];

    for (const configPath of userConfigs) {
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    // No config found
    return yield* _(Effect.fail(new ConfigNotFoundError({
      path: projectDir
    })));
  });

/**
 * Parse config file content based on extension
 */
const parseConfigContent = (
  content: string,
  path: string
): Effect.Effect<unknown, ConfigParseError> =>
  Effect.gen(function* (_) {
    const ext = extname(path).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      // Parse YAML
      return yield* _(
        Effect.try({
          try: () => loadYaml(content),
          catch: (error) => new ConfigParseError({
            path,
            cause: error
          })
        })
      );
    } else {
      // Parse JSON
      return yield* _(
        parseJSON(content).pipe(
          Effect.mapError((error) => new ConfigParseError({
            path,
            cause: error
          }))
        )
      );
    }
  });

/**
 * Load config file (without caching)
 */
const loadConfigFile = (path: string): Effect.Effect<
  AutomatosXConfig,
  ConfigParseError | ConfigValidationError | FileReadError | FileNotFoundError
> =>
  Effect.gen(function* (_) {
    // Read file
    const content = yield* _(readFile(path));

    // Parse content
    const userConfig = yield* _(parseConfigContent(content, path));

    // Merge with defaults
    const merged = deepMerge(DEFAULT_CONFIG, userConfig as Partial<AutomatosXConfig>);

    // Validate with Zod
    const validated = yield* _(
      validateWithZod(automatosXConfigSchema, merged).pipe(
        Effect.mapError((error) => new ConfigValidationError({
          path,
          errors: [error.message]
        }))
      )
    );

    return validated as AutomatosXConfig;
  });

/**
 * Load config with fallback to default
 */
const loadConfigWithFallback = (projectDir: string): Effect.Effect<
  AutomatosXConfig,
  ConfigParseError | ConfigValidationError | FileReadError
> =>
  Effect.gen(function* (_) {
    const configPathResult = yield* _(
      findConfigPath(projectDir).pipe(
        Effect.either
      )
    );

    // If config file found, load it
    if (configPathResult._tag === 'Right') {
      return yield* _(loadConfigFile(configPathResult.right));
    }

    // Otherwise, use default config
    yield* _(Effect.log('No config file found, using defaults'));
    return DEFAULT_CONFIG;
  });

// ========================================
// Service Implementation
// ========================================

/**
 * Config Service Implementation
 */
export const ConfigServiceLive = Layer.succeed(
  ConfigService,
  ConfigService.of({
    // Load without caching
    load: (projectDir: string) =>
      loadConfigWithFallback(projectDir).pipe(
        // Add timeout
        withTimeout(Duration.seconds(30), 'loadConfig'),
        // Add retry with exponential backoff
        withExponentialRetry(3),
        // Log errors
        Effect.tapError((error) =>
          Effect.logError('Config load failed', error)
        )
      ),

    // Load with caching (1 hour TTL)
    loadCached: (projectDir: string) =>
      Effect.gen(function* (_) {
        const loadEffect = loadConfigWithFallback(projectDir);

        // Cache for 1 hour
        const cachedEffect = yield* _(
          loadEffect.pipe(
            Effect.cached(Duration.hours(1))
          )
        );

        return yield* _(cachedEffect);
      }),

    // Reload (bypass cache)
    reload: (projectDir: string) =>
      loadConfigWithFallback(projectDir).pipe(
        Effect.tapBoth({
          onFailure: (error) => Effect.logError('Config reload failed', error),
          onSuccess: () => Effect.log('Config reloaded successfully')
        })
      )
  })
);

// ========================================
// Convenience Functions
// ========================================

/**
 * Load config (convenience function)
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const config = yield* _(loadConfigEffect('.'));
 *   console.log(config.version);
 * });
 *
 * // Run the program
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(ConfigServiceLive)
 *   )
 * );
 * ```
 */
export const loadConfigEffect = (projectDir: string) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    return yield* _(configService.load(projectDir));
  });

/**
 * Load config with caching (convenience function)
 */
export const loadConfigCached = (projectDir: string) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    return yield* _(configService.loadCached(projectDir));
  });

/**
 * Reload config (convenience function)
 */
export const reloadConfig = (projectDir: string) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    return yield* _(configService.reload(projectDir));
  });

// ========================================
// Example Usage
// ========================================

/**
 * Example: Load config with error handling
 */
export const exampleLoadConfig = Effect.gen(function* (_) {
  const config = yield* _(
    loadConfigEffect('.').pipe(
      // Handle specific errors
      Effect.catchTag('ConfigNotFoundError', () =>
        Effect.gen(function* (_) {
          yield* _(Effect.log('Config not found, using defaults'));
          return DEFAULT_CONFIG;
        })
      ),
      Effect.catchTag('ConfigParseError', (error) =>
        Effect.gen(function* (_) {
          yield* _(Effect.logError('Config parse error', error));
          return DEFAULT_CONFIG;
        })
      ),
      Effect.catchTag('ConfigValidationError', (error) =>
        Effect.gen(function* (_) {
          yield* _(Effect.logError('Config validation failed', error));
          return DEFAULT_CONFIG;
        })
      )
    )
  );

  return config;
});

/**
 * Example: Load multiple configs in parallel
 */
export const exampleLoadMultipleConfigs = (dirs: readonly string[]) =>
  Effect.gen(function* (_) {
    const configs = yield* _(
      Effect.all(
        dirs.map(dir => loadConfigEffect(dir)),
        { concurrency: 3 } // Load max 3 at a time
      )
    );

    return configs;
  });
