/**
 * Tests for Zod Configuration Schemas
 */

import { describe, it, expect } from 'vitest';
import {
  automatosXConfigSchema,
  validateConfigWithZod,
  safeValidateConfig,
  validatePartialConfig
} from '../../../src/core/config/schemas.js';

describe('Config Schemas - Zod Validation', () => {
  describe('Provider Configuration', () => {
    it('should validate valid provider config', () => {
      const config = {
        providers: {
          'claude-code': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: 'claude'
          }
        },
        execution: {
          defaultTimeout: 120000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          }
        },
        orchestration: {
          session: {
            maxSessions: 100,
            maxMetadataSize: 10240,
            saveDebounce: 1000,
            cleanupAfterDays: 7,
            maxUuidAttempts: 100,
            persistPath: '.automatosx/sessions'
          },
          delegation: {
            maxDepth: 2,
            timeout: 120000
          }
        },
        memory: {
          maxEntries: 10000,
          persistPath: '.automatosx/memory',
          autoCleanup: true,
          cleanupDays: 30,
          busyTimeout: 5000
        },
        abilities: {
          basePath: '.automatosx/abilities',
          fallbackPath: 'examples/abilities',
          cache: {
            enabled: true,
            maxEntries: 50,
            ttl: 600000,
            maxSize: 5242880,
            cleanupInterval: 120000
          },
          limits: {
            maxFileSize: 524288
          }
        },
        workspace: {
          prdPath: 'automatosx/PRD',
          tmpPath: 'automatosx/tmp',
          autoCleanupTmp: true,
          tmpCleanupDays: 7
        },
        logging: {
          level: 'info',
          path: '.automatosx/logs',
          console: true
        },
        performance: {
          profileCache: {
            enabled: true,
            maxEntries: 20,
            ttl: 600000,
            cleanupInterval: 120000
          },
          teamCache: {
            enabled: true,
            maxEntries: 10,
            ttl: 600000,
            cleanupInterval: 120000
          },
          providerCache: {
            enabled: true,
            maxEntries: 100,
            ttl: 600000,
            cleanupInterval: 120000
          },
          adaptiveCache: {
            maxEntries: 1000,
            baseTTL: 300000,
            minTTL: 60000,
            maxTTL: 3600000,
            adaptiveMultiplier: 2,
            lowFreqDivisor: 2,
            frequencyThreshold: 5,
            cleanupInterval: 60000
          }
        },
        router: {
          healthCheckInterval: 60000,
          providerCooldownMs: 30000,
          circuitBreakerThreshold: 3,
          enableFreeTierPrioritization: true,
          enableWorkloadAwareRouting: true
        },
        version: '8.3.0'
      };

      const result = safeValidateConfig(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider names', () => {
      const config = {
        providers: {
          'invalid@provider': {  // Invalid character
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: 'claude'
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });

    it('should reject command injection attempts', () => {
      const config = {
        providers: {
          'claude': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: 'claude; rm -rf /'  // Command injection attempt
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });

    it('should enforce timeout limits', () => {
      const config = {
        providers: {
          'claude': {
            enabled: true,
            priority: 1,
            timeout: 10000000,  // Too large
            command: 'claude'
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });

    it('should allow SDK providers without command field (v12.0.0)', () => {
      const config = {
        providers: {
          'glm': {
            enabled: true,
            priority: 4,
            timeout: 2700000,
            type: 'sdk',  // SDK provider - no command needed
            description: 'GLM provider'
          },
          'grok': {
            enabled: true,
            priority: 5,
            timeout: 2700000,
            type: 'sdk'  // SDK provider - no command needed
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(true);
    });

    it('should require command for CLI providers', () => {
      const config = {
        providers: {
          'claude-code': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            // Missing command for CLI provider
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message.includes('command'))).toBe(true);
      }
    });

    it('should require command for hybrid providers', () => {
      const config = {
        providers: {
          'openai': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            type: 'hybrid',
            // Missing command for hybrid provider
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(e => e.message.includes('command'))).toBe(true);
      }
    });
  });

  describe('Execution Configuration', () => {
    it('should validate retry configuration', () => {
      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2
      };

      const config = {
        execution: {
          defaultTimeout: 120000,
          retry: retryConfig,
          provider: { maxWaitMs: 60000 }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(true);
    });

    it('should reject maxDelay < initialDelay', () => {
      const config = {
        execution: {
          defaultTimeout: 120000,
          retry: {
            maxAttempts: 3,
            initialDelay: 10000,
            maxDelay: 1000,  // Should be >= initialDelay
            backoffFactor: 2
          },
          provider: { maxWaitMs: 60000 }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });

    it('should enforce maxAttempts limit', () => {
      const config = {
        execution: {
          defaultTimeout: 120000,
          retry: {
            maxAttempts: 100,  // Too many
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: { maxWaitMs: 60000 }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });
  });

  describe('Security Validation', () => {
    it('should reject path traversal attempts', () => {
      const config = {
        memory: {
          maxEntries: 10000,
          persistPath: '../../../etc/passwd',  // Path traversal
          autoCleanup: true,
          cleanupDays: 30,
          busyTimeout: 5000
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });

    it('should reject absolute paths', () => {
      const config = {
        logging: {
          level: 'info',
          path: '/var/log/automatosx',  // Absolute path
          console: true
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });

    it('should validate file extensions', () => {
      const config = {
        advanced: {
          security: {
            enablePathValidation: true,
            allowedExtensions: ['.ts', '.js', '.invalid_extension_name']  // Too long
          }
        }
      };

      const result = safeValidateConfig(config as any);
      expect(result.success).toBe(false);
    });
  });

  describe('Partial Config Validation', () => {
    it('should validate partial updates', () => {
      const partialConfig = {
        memory: {
          maxEntries: 5000
        }
      };

      const result = validatePartialConfig(partialConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid partial updates', () => {
      const partialConfig = {
        memory: {
          maxEntries: -1  // Invalid
        }
      };

      const result = validatePartialConfig(partialConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should return empty array for valid config', () => {
      const validConfig = {
        providers: {},
        execution: {
          defaultTimeout: 120000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: { maxWaitMs: 60000 }
        },
        memory: {
          maxEntries: 10000,
          persistPath: '.automatosx/memory',
          autoCleanup: true,
          cleanupDays: 30,
          busyTimeout: 5000
        },
        version: '8.3.0'
      };

      const errors = validateConfigWithZod(validConfig as any);
      expect(errors).toEqual([]);
    });

    it('should return error messages for invalid config', () => {
      const invalidConfig = {
        memory: {
          maxEntries: -1  // Invalid
        }
      };

      const errors = validateConfigWithZod(invalidConfig as any);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('memory.maxEntries');
    });
  });
});
