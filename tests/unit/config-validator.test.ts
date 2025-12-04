/**
 * Config Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { validateConfig, formatValidationErrors } from '../../src/core/config/validator.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';

describe('Config Validator', () => {
  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const result = validateConfig(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing providers', () => {
      const config = { ...DEFAULT_CONFIG };
      delete (config as any).providers;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'providers',
        message: 'Required field "providers" is missing'
      });
    });

    it('should detect missing memory', () => {
      const config = { ...DEFAULT_CONFIG };
      delete (config as any).memory;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'memory',
        message: 'Required field "memory" is missing'
      });
    });

    it('should detect missing workspace', () => {
      const config = { ...DEFAULT_CONFIG };
      delete (config as any).workspace;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'workspace',
        message: 'Required field "workspace" is missing'
      });
    });

    it('should detect missing logging', () => {
      const config = { ...DEFAULT_CONFIG };
      delete (config as any).logging;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'logging',
        message: 'Required field "logging" is missing'
      });
    });
  });

  describe('Provider Validation', () => {
    it('should require at least one provider', () => {
      const config = {
        ...DEFAULT_CONFIG,
        providers: {}
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'providers',
        message: 'At least one provider must be configured'
      });
    });

    it('should require at least one enabled provider', () => {
      const config = {
        ...DEFAULT_CONFIG,
        providers: {
          'claude-code': {
            ...DEFAULT_CONFIG.providers['claude-code'],
            enabled: false
          },
          'gemini-cli': {
            ...DEFAULT_CONFIG.providers['gemini-cli'],
            enabled: false
          }
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'providers',
        message: 'At least one provider must be enabled'
      });
    });

    it('should validate provider.enabled is boolean', () => {
      const config = {
        ...DEFAULT_CONFIG,
        providers: {
          'claude-code': {
            ...DEFAULT_CONFIG.providers['claude-code'],
            enabled: 'yes' as any
          }
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'providers.claude-code.enabled' &&
        e.message === 'enabled must be a boolean'
      )).toBe(true);
    });

    it('should validate provider.priority is number >= 1', () => {
      const config = {
        ...DEFAULT_CONFIG,
        providers: {
          'claude-code': {
            ...DEFAULT_CONFIG.providers['claude-code'],
            priority: 0
          }
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'providers.claude-code.priority' &&
        e.message === 'priority must be >= 1'
      )).toBe(true);
    });

    it('should validate provider.timeout is number >= 1000', () => {
      const config = {
        ...DEFAULT_CONFIG,
        providers: {
          'claude-code': {
            ...DEFAULT_CONFIG.providers['claude-code'],
            timeout: 500
          }
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'providers.claude-code.timeout' &&
        e.message === 'timeout must be >= 1000ms'
      )).toBe(true);
    });

    it('should validate provider.command is non-empty string', () => {
      const config = {
        ...DEFAULT_CONFIG,
        providers: {
          'claude-code': {
            ...DEFAULT_CONFIG.providers['claude-code'],
            command: ''
          }
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'providers.claude-code.command' &&
        e.message === 'command cannot be empty'
      )).toBe(true);
    });
  });

  describe('Memory Validation', () => {
    it('should validate maxEntries >= 100', () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: {
          ...DEFAULT_CONFIG.memory,
          maxEntries: 50
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'memory.maxEntries' &&
        e.message === 'maxEntries must be >= 100'
      )).toBe(true);
    });

    it('should validate persistPath is non-empty string', () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: {
          ...DEFAULT_CONFIG.memory,
          persistPath: ''
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'memory.persistPath' &&
        e.message === 'persistPath cannot be empty'
      )).toBe(true);
    });

    it('should validate autoCleanup is boolean', () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: {
          ...DEFAULT_CONFIG.memory,
          autoCleanup: 'true' as any
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'memory.autoCleanup' &&
        e.message === 'autoCleanup must be a boolean'
      )).toBe(true);
    });

    it('should validate cleanupDays >= 1', () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: {
          ...DEFAULT_CONFIG.memory,
          cleanupDays: 0
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'memory.cleanupDays' &&
        e.message === 'cleanupDays must be >= 1'
      )).toBe(true);
    });
  });

  describe('Workspace Validation (v5.2.0)', () => {
    it('should validate prdPath is non-empty string', () => {
      const config = {
        ...DEFAULT_CONFIG,
        workspace: {
          ...DEFAULT_CONFIG.workspace,
          prdPath: ''
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'workspace.prdPath' &&
        e.message === 'prdPath cannot be empty'
      )).toBe(true);
    });

    it('should validate tmpPath is non-empty string', () => {
      const config = {
        ...DEFAULT_CONFIG,
        workspace: {
          ...DEFAULT_CONFIG.workspace,
          tmpPath: ''
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'workspace.tmpPath' &&
        e.message === 'tmpPath cannot be empty'
      )).toBe(true);
    });

    it('should validate autoCleanupTmp is boolean', () => {
      const config = {
        ...DEFAULT_CONFIG,
        workspace: {
          ...DEFAULT_CONFIG.workspace,
          autoCleanupTmp: 'yes' as any
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'workspace.autoCleanupTmp' &&
        e.message === 'autoCleanupTmp must be a boolean'
      )).toBe(true);
    });

    it('should validate tmpCleanupDays >= 1', () => {
      const config = {
        ...DEFAULT_CONFIG,
        workspace: {
          ...DEFAULT_CONFIG.workspace,
          tmpCleanupDays: 0
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'workspace.tmpCleanupDays' &&
        e.message === 'tmpCleanupDays must be >= 1'
      )).toBe(true);
    });
  });

  describe('Logging Validation', () => {
    it('should validate level is valid log level', () => {
      const config = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          level: 'verbose' as any
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'logging.level' &&
        e.message.includes('must be one of')
      )).toBe(true);
    });

    it('should validate path is non-empty string', () => {
      const config = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          path: ''
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'logging.path' &&
        e.message === 'path cannot be empty'
      )).toBe(true);
    });

    it('should validate console is boolean', () => {
      const config = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          console: 'yes' as any
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.path === 'logging.console' &&
        e.message === 'console must be a boolean'
      )).toBe(true);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format empty errors', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('No validation errors');
    });

    it('should format single error', () => {
      const formatted = formatValidationErrors([{
        path: 'providers',
        message: 'Required field is missing'
      }]);

      expect(formatted).toContain('Configuration validation failed');
      expect(formatted).toContain('1. providers: Required field is missing');
    });

    it('should format multiple errors', () => {
      const formatted = formatValidationErrors([
        {
          path: 'providers',
          message: 'Required field is missing'
        },
        {
          path: 'memory.maxEntries',
          message: 'Must be >= 100',
          value: 50
        }
      ]);

      expect(formatted).toContain('1. providers: Required field is missing');
      expect(formatted).toContain('2. memory.maxEntries: Must be >= 100');
      expect(formatted).toContain('Current value: 50');
    });
  });

  describe('Execution Validation', () => {
    it('should validate execution.maxConcurrentAgents boundaries', () => {
      const config = {
        ...DEFAULT_CONFIG,
        execution: {
          ...DEFAULT_CONFIG.execution,
          maxConcurrentAgents: 0
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'execution.maxConcurrentAgents',
        message: 'maxConcurrentAgents must be >= 1',
        value: 0
      });
    });
  });
});
