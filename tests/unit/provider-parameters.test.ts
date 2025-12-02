import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, type ProviderConfig } from '../../src/types/config';
import type { ExecutionRequest } from '../../src/types/provider';

describe('Provider Model Parameters', () => {
  describe('DEFAULT_CONFIG Provider Settings', () => {
    it('should not have defaults for claude-code provider', () => {
      const claudeConfig = DEFAULT_CONFIG.providers['claude-code'];
      expect(claudeConfig).toBeDefined();
      expect(claudeConfig?.defaults).toBeUndefined();
    });

    it('should not have defaults for gemini-cli provider', () => {
      const geminiConfig = DEFAULT_CONFIG.providers['gemini-cli'];
      expect(geminiConfig).toBeDefined();
      expect(geminiConfig?.defaults).toBeUndefined();
    });

    it('should not have defaults for openai provider', () => {
      const openaiConfig = DEFAULT_CONFIG.providers['openai'];
      expect(openaiConfig).toBeDefined();
      expect(openaiConfig?.defaults).toBeUndefined();
    });
  });

  describe('Optional Provider Defaults Configuration', () => {
    it('should allow setting maxTokens in provider config', () => {
      const providerConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        },
        defaults: {
          maxTokens: 2048
        }
      };

      expect(providerConfig.defaults).toBeDefined();
      expect(providerConfig.defaults?.maxTokens).toBe(2048);
    });

    it('should allow setting temperature in provider config', () => {
      const providerConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        },
        defaults: {
          temperature: 0
        }
      };

      expect(providerConfig.defaults).toBeDefined();
      expect(providerConfig.defaults?.temperature).toBe(0);
    });

    it('should allow setting both maxTokens and temperature', () => {
      const providerConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        },
        defaults: {
          maxTokens: 4096,
          temperature: 0.7
        }
      };

      expect(providerConfig.defaults?.maxTokens).toBe(4096);
      expect(providerConfig.defaults?.temperature).toBe(0.7);
    });
  });

  describe('ExecutionRequest Parameters', () => {
    it('should support maxTokens in execution request', () => {
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        maxTokens: 2048
      };

      expect(request.maxTokens).toBe(2048);
    });

    it('should support temperature in execution request', () => {
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        temperature: 0.5
      };

      expect(request.temperature).toBe(0.5);
    });

    it('should support both parameters in execution request', () => {
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        maxTokens: 4096,
        temperature: 0.7
      };

      expect(request.maxTokens).toBe(4096);
      expect(request.temperature).toBe(0.7);
    });

    it('should allow undefined parameters', () => {
      const request: ExecutionRequest = {
        prompt: 'Test prompt'
      };

      expect(request.maxTokens).toBeUndefined();
      expect(request.temperature).toBeUndefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should accept valid maxTokens values', () => {
      const validValues = [1, 1024, 2048, 4096, 8192, 100000];

      validValues.forEach(value => {
        const request: ExecutionRequest = {
          prompt: 'Test',
          maxTokens: value
        };
        expect(request.maxTokens).toBe(value);
      });
    });

    it('should accept valid temperature values', () => {
      const validValues = [0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0];

      validValues.forEach(value => {
        const request: ExecutionRequest = {
          prompt: 'Test',
          temperature: value
        };
        expect(request.temperature).toBe(value);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility with existing configs that have defaults', () => {
      const legacyConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        },
        defaults: {
          maxTokens: 4096,
          temperature: 0.7,
          topP: 1.0
        }
      };

      expect(legacyConfig.defaults).toBeDefined();
      expect(legacyConfig.defaults?.maxTokens).toBe(4096);
      expect(legacyConfig.defaults?.temperature).toBe(0.7);
      expect(legacyConfig.defaults?.topP).toBe(1.0);
    });

    it('should work without defaults (new behavior)', () => {
      const newConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        }
      };

      expect(newConfig.defaults).toBeUndefined();
    });
  });

  describe('Use Case Scenarios', () => {
    it('should support cost control scenario with maxTokens limit', () => {
      const costControlConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        },
        defaults: {
          maxTokens: 2048
        }
      };

      expect(costControlConfig.defaults?.maxTokens).toBe(2048);
      expect(costControlConfig.defaults?.temperature).toBeUndefined();
    });

    it('should support QA scenario with deterministic temperature', () => {
      const qaConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        },
        defaults: {
          temperature: 0
        }
      };

      expect(qaConfig.defaults?.temperature).toBe(0);
      expect(qaConfig.defaults?.maxTokens).toBeUndefined();
    });

    it('should support default scenario with no parameters (provider optimal)', () => {
      const defaultConfig: ProviderConfig = {
        enabled: true,
        priority: 1,
        timeout: 900000,
        command: 'codex',
        healthCheck: {
          enabled: true,
          interval: 300000,
          timeout: 5000
        }
      };

      expect(defaultConfig.defaults).toBeUndefined();
    });
  });

  describe('Provider-Specific Behavior', () => {
    it('should define OpenAI provider without defaults (supports parameters via CLI)', () => {
      const openaiConfig = DEFAULT_CONFIG.providers['openai'];

      expect(openaiConfig?.command).toBe('codex');
      expect(openaiConfig?.defaults).toBeUndefined();
    });

    it('should define Gemini provider without defaults (no parameter support yet)', () => {
      const geminiConfig = DEFAULT_CONFIG.providers['gemini-cli'];

      expect(geminiConfig?.command).toBe('gemini');
      expect(geminiConfig?.defaults).toBeUndefined();
    });

    it('should define Claude provider without defaults (no parameter support)', () => {
      const claudeConfig = DEFAULT_CONFIG.providers['claude-code'];

      expect(claudeConfig?.command).toBe('claude');
      expect(claudeConfig?.defaults).toBeUndefined();
    });
  });

  describe('Configuration Priority', () => {
    it('should allow agent-level defaults to override provider defaults', () => {
      const agentDefaults = {
        maxTokens: 1024,
        temperature: 0
      };

      const providerDefaults = {
        maxTokens: 4096,
        temperature: 0.7
      };

      const effectiveMaxTokens = agentDefaults.maxTokens ?? providerDefaults.maxTokens;
      const effectiveTemperature = agentDefaults.temperature ?? providerDefaults.temperature;

      expect(effectiveMaxTokens).toBe(1024);
      expect(effectiveTemperature).toBe(0);
    });

    it('should use provider defaults when agent defaults are undefined', () => {
      const providerDefaults = {
        maxTokens: 4096,
        temperature: 0.7
      };

      // Simulate no agent-level override
      const effectiveMaxTokens = providerDefaults.maxTokens;
      const effectiveTemperature = providerDefaults.temperature;

      expect(effectiveMaxTokens).toBe(4096);
      expect(effectiveTemperature).toBe(0.7);
    });
  });
});
