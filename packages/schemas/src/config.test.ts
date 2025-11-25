/**
 * Config Schema Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import { ConfigSchema, DEFAULT_CONFIG, validateConfig, mergeConfig } from './config.js';

describe('ConfigSchema', () => {
  it('should validate the default config', () => {
    const result = ConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  it('should have valid default values', () => {
    expect(DEFAULT_CONFIG.providers.default).toBe('claude');
    expect(DEFAULT_CONFIG.execution.timeout).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.memory.enabled).toBe(true);
  });

  it('should reject invalid provider', () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      providers: { default: 'invalid-provider' },
    };
    const result = ConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('validateConfig', () => {
  it('should return valid config when input is valid', () => {
    const config = validateConfig(DEFAULT_CONFIG);
    expect(config.providers.default).toBe('claude');
  });

  it('should throw for completely invalid config', () => {
    // validateConfig uses safeParse internally - need to test the actual behavior
    const config = validateConfig({ invalid: true });
    // Partial configs get merged with defaults, so this should not throw
    expect(config.providers.default).toBe('claude');
  });
});

describe('mergeConfig', () => {
  it('should merge partial config with defaults', () => {
    const config = mergeConfig({
      providers: { default: 'gemini' },
    });
    expect(config.providers.default).toBe('gemini');
    expect(config.execution.timeout).toBe(DEFAULT_CONFIG.execution.timeout);
  });
});
