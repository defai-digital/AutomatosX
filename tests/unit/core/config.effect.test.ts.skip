/**
 * Tests for Effect-TS Config Loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import {
  ConfigServiceLive,
  loadConfigEffect,
  loadConfigCached,
  reloadConfig
} from '../../../src/core/config.effect.js';
import { ConfigNotFoundError, ConfigParseError } from '../../../src/core/effect-errors.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('Config Effect Loader', () => {
  const testDir = join(process.cwd(), 'test-config-effect-temp');

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('loadConfigEffect', () => {
    it('should load valid JSON config', async () => {
      // Create valid config
      const configPath = join(testDir, 'automatosx.config.json');
      writeFileSync(configPath, JSON.stringify({
        version: '8.3.1',
        providers: {
          'test-provider': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: 'test'
          }
        }
      }));

      // Run Effect
      const program = loadConfigEffect(testDir).pipe(
        Effect.provide(ConfigServiceLive)
      );

      const config = await Effect.runPromise(program);

      expect(config).toBeDefined();
      expect(config.version).toBe('8.3.1');
      expect(config.providers['test-provider']).toBeDefined();
    });

    it('should load valid YAML config', async () => {
      // Create valid YAML config
      const configPath = join(testDir, 'automatosx.config.yaml');
      writeFileSync(configPath, `
version: '8.3.1'
providers:
  test-provider:
    enabled: true
    priority: 1
    timeout: 120000
    command: test
`);

      const program = loadConfigEffect(testDir).pipe(
        Effect.provide(ConfigServiceLive)
      );

      const config = await Effect.runPromise(program);

      expect(config).toBeDefined();
      expect(config.version).toBe('8.3.1');
    });

    it('should use default config when no file found', async () => {
      const program = loadConfigEffect(testDir).pipe(
        Effect.provide(ConfigServiceLive)
      );

      const config = await Effect.runPromise(program);

      expect(config).toBeDefined();
      // Should have default values
      expect(config.version).toBeDefined();
    });

    it('should handle parse errors gracefully', async () => {
      // Create invalid JSON
      const configPath = join(testDir, 'automatosx.config.json');
      writeFileSync(configPath, '{invalid json}');

      const program = loadConfigEffect(testDir).pipe(
        Effect.provide(ConfigServiceLive),
        Effect.catchTag('ConfigParseError', (error) =>
          Effect.succeed({ error: error._tag })
        )
      );

      const result = await Effect.runPromise(program);

      expect(result).toHaveProperty('error', 'ConfigParseError');
    });
  });

  describe('Error Handling', () => {
    it('should catch ConfigParseError', async () => {
      const configPath = join(testDir, 'automatosx.config.json');
      writeFileSync(configPath, 'not valid json');

      const program = loadConfigEffect(testDir).pipe(
        Effect.provide(ConfigServiceLive),
        Effect.catchTag('ConfigParseError', (error) =>
          Effect.succeed({
            recovered: true,
            errorPath: error.path
          })
        )
      );

      const result = await Effect.runPromise(program);

      expect(result.recovered).toBe(true);
      expect(result.errorPath).toContain('automatosx.config.json');
    });

    it('should handle multiple error types', async () => {
      const program = loadConfigEffect('/nonexistent/path').pipe(
        Effect.provide(ConfigServiceLive),
        Effect.catchTags({
          ConfigNotFoundError: () => Effect.succeed({ error: 'not-found' }),
          ConfigParseError: () => Effect.succeed({ error: 'parse-error' }),
          ConfigValidationError: () => Effect.succeed({ error: 'validation-error' })
        })
      );

      const result = await Effect.runPromise(program);

      // Should use default config (no error)
      expect(result).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache config loads', async () => {
      const configPath = join(testDir, 'automatosx.config.json');
      writeFileSync(configPath, JSON.stringify({ version: '8.3.1' }));

      // Load twice
      const program = Effect.gen(function* (_) {
        const config1 = yield* _(loadConfigCached(testDir));
        const config2 = yield* _(loadConfigCached(testDir));

        return { config1, config2 };
      }).pipe(Effect.provide(ConfigServiceLive));

      const { config1, config2 } = await Effect.runPromise(program);

      expect(config1.version).toBe(config2.version);
    });
  });

  describe('Reload', () => {
    it('should reload config bypassing cache', async () => {
      const configPath = join(testDir, 'automatosx.config.json');

      // Initial config
      writeFileSync(configPath, JSON.stringify({ version: '1.0.0' }));

      const program = Effect.gen(function* (_) {
        // Load first time
        const initial = yield* _(loadConfigCached(testDir));

        // Update config file
        writeFileSync(configPath, JSON.stringify({ version: '2.0.0' }));

        // Reload (should see new version)
        const reloaded = yield* _(reloadConfig(testDir));

        return { initial, reloaded };
      }).pipe(Effect.provide(ConfigServiceLive));

      const { initial, reloaded } = await Effect.runPromise(program);

      expect(initial.version).toBe('1.0.0');
      expect(reloaded.version).toBe('2.0.0');
    });
  });
});
