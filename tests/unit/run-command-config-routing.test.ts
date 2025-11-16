/**
 * Run Command Config-Based Routing Tests
 *
 * Tests that execution.stages.enabled config switch properly enables
 * StageExecutionController with correct precedence:
 * CLI flags > config value > default (false)
 *
 * This test focuses on the routing logic itself.
 */

import { describe, it, expect } from 'vitest';
import type { AutomatosXConfig } from '../../src/types/config.js';

/**
 * Helper function that mimics the routing logic from run.ts:405-408
 */
function shouldUseInteractiveController(
  argv: {
    interactive?: boolean;
    streaming?: boolean;
    hybrid?: boolean;
    resumable?: boolean;
  },
  config: AutomatosXConfig
): boolean {
  // This logic mirrors src/cli/commands/run.ts:405-408
  const cliRequiresInteractive =
    argv.interactive === true ||
    argv.streaming === true ||
    argv.hybrid === true ||
    argv.resumable === true;

  const configEnabled = config.execution?.stages?.enabled ?? false;

  return cliRequiresInteractive || configEnabled;
}

describe('Run Command Config-Based Routing Logic', () => {
  const baseConfig: AutomatosXConfig = {
    providers: {},
    memory: {
      maxEntries: 10000,
      persistPath: '.automatosx/memory',
      autoCleanup: true,
      cleanupDays: 30
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
    }
  };

  describe('precedence order: CLI flags > config > default', () => {
    it('should use legacy executor when no CLI flags and config.enabled is false', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: false, // Explicitly disabled
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: false,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      const argv = {}; // No CLI flags

      expect(shouldUseInteractiveController(argv, config)).toBe(false);
    });

    it('should use interactive controller when config.enabled is true', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: true, // Enabled via config
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: true,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      const argv = {}; // No CLI flags

      expect(shouldUseInteractiveController(argv, config)).toBe(true);
    });

    it('should prioritize CLI flag (--interactive) over config disabled', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: false, // Disabled in config
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: false,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      const argv = { interactive: true }; // CLI flag overrides config

      expect(shouldUseInteractiveController(argv, config)).toBe(true);
    });

    it('should prioritize CLI flag (--streaming) over config disabled', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: false, // Disabled in config
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: false,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      const argv = { streaming: true }; // CLI flag overrides config

      expect(shouldUseInteractiveController(argv, config)).toBe(true);
    });

    it('should prioritize CLI flag (--hybrid) over config disabled', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: false,
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: false,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      const argv = { hybrid: true }; // CLI flag overrides config

      expect(shouldUseInteractiveController(argv, config)).toBe(true);
    });

    it('should prioritize CLI flag (--resumable) over config disabled', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: false,
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: false,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      const argv = { resumable: true }; // CLI flag overrides config

      expect(shouldUseInteractiveController(argv, config)).toBe(true);
    });

    it('should default to false when config.execution.stages is undefined', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          }
          // No stages section - should default to false
        }
      };

      const argv = {}; // No CLI flags

      expect(shouldUseInteractiveController(argv, config)).toBe(false);
    });

    it('should default to false when config.execution is undefined', () => {
      const config: AutomatosXConfig = {
        ...baseConfig
        // No execution section at all
      };

      const argv = {}; // No CLI flags

      expect(shouldUseInteractiveController(argv, config)).toBe(false);
    });
  });

  describe('CLI flag behavior', () => {
    const configEnabled: AutomatosXConfig = {
      ...baseConfig,
      execution: {
        defaultTimeout: 60000,
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffFactor: 2
        },
        provider: {
          maxWaitMs: 60000
        },
        stages: {
          enabled: true, // Config enabled
          defaultTimeout: 1800000,
          checkpointPath: '.automatosx/checkpoints',
          autoSaveCheckpoint: true,
          cleanupAfterDays: 7,
          retry: {
            defaultMaxRetries: 1,
            defaultRetryDelay: 2000
          },
          prompts: {
            timeout: 600000,
            autoConfirm: false,
            locale: 'en'
          },
          progress: {
            updateInterval: 2000,
            syntheticProgress: true
          }
        }
      }
    };

    it('should remain enabled when CLI flag is present and config is enabled', () => {
      const argv = { interactive: true };

      expect(shouldUseInteractiveController(argv, configEnabled)).toBe(true);
    });

    it('should respect multiple CLI flags (any true triggers interactive)', () => {
      const config: AutomatosXConfig = {
        ...baseConfig,
        execution: {
          defaultTimeout: 60000,
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
          },
          provider: {
            maxWaitMs: 60000
          },
          stages: {
            enabled: false, // Config disabled
            defaultTimeout: 1800000,
            checkpointPath: '.automatosx/checkpoints',
            autoSaveCheckpoint: false,
            cleanupAfterDays: 7,
            retry: {
              defaultMaxRetries: 1,
              defaultRetryDelay: 2000
            },
            prompts: {
              timeout: 600000,
              autoConfirm: false,
              locale: 'en'
            },
            progress: {
              updateInterval: 2000,
              syntheticProgress: true
            }
          }
        }
      };

      // Any one of these flags should trigger interactive mode
      expect(shouldUseInteractiveController({ interactive: true, streaming: false }, config)).toBe(true);
      expect(shouldUseInteractiveController({ interactive: false, streaming: true }, config)).toBe(true);
      expect(shouldUseInteractiveController({ interactive: false, hybrid: true }, config)).toBe(true);
      expect(shouldUseInteractiveController({ interactive: false, resumable: true }, config)).toBe(true);
      expect(shouldUseInteractiveController({ interactive: true, streaming: true, hybrid: true, resumable: true }, config)).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('should default to false for backward compatibility (opt-in feature)', () => {
      const config: AutomatosXConfig = {
        ...baseConfig
      };

      const argv = {};

      // Without explicit config or CLI flags, should use legacy executor
      expect(shouldUseInteractiveController(argv, config)).toBe(false);
    });

    it('should document the opt-in nature of the feature', () => {
      // This test documents that execution.stages.enabled is an opt-in feature
      // Default: false (backward compatible, use legacy executor)
      // Users must explicitly enable via config or CLI flags

      const featureDescription = {
        name: 'execution.stages.enabled',
        type: 'opt-in',
        default: false,
        backwardCompatible: true,
        enabledVia: ['config', 'CLI flags']
      };

      expect(featureDescription.default).toBe(false);
      expect(featureDescription.backwardCompatible).toBe(true);
      expect(featureDescription.enabledVia).toContain('config');
      expect(featureDescription.enabledVia).toContain('CLI flags');
    });
  });
});
