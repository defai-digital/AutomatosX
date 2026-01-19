/**
 * Integration tests for CLI-based provider adapters
 *
 * These tests verify the CLI adapter functionality without
 * requiring actual CLI tools to be installed.
 */

import { describe, it, expect } from 'vitest';
import {
  createCLIAdapter,
  createProviderRegistry,
  createEmptyRegistry,
  claudeConfig,
  geminiConfig,
  codexConfig,
  grokConfig,
  opencodeConfig,
  ALL_PROVIDER_CONFIGS,
  parseOutput,
  estimateTokenUsage,
  classifyError,
  classifySpawnResult,
  buildPromptFromMessages,
  type CLIProviderConfig,
  type SpawnResult,
} from '@defai.digital/provider-adapters';

describe('CLI Adapter', () => {
  describe('createCLIAdapter', () => {
    it('creates adapter with correct providerId', () => {
      const adapter = createCLIAdapter(claudeConfig);
      expect(adapter.providerId).toBe('claude');
    });

    it('creates adapter with config reference', () => {
      const adapter = createCLIAdapter(geminiConfig);
      expect(adapter.config).toBe(geminiConfig);
    });

    it('returns models from config', () => {
      const adapter = createCLIAdapter(codexConfig);
      const models = adapter.getModels();
      expect(models).toBe(codexConfig.models);
      expect(models.length).toBeGreaterThan(0);
    });

    it('supports default model', () => {
      const adapter = createCLIAdapter(claudeConfig);
      // All providers use CLI's default model - we don't specify individual models
      expect(adapter.supportsModel('default')).toBe(true);
      expect(adapter.supportsModel('nonexistent-model')).toBe(false);
    });

    it('estimates tokens at ~4 chars per token', () => {
      const adapter = createCLIAdapter(claudeConfig);
      expect(adapter.estimateTokens('test')).toBe(1);
      expect(adapter.estimateTokens('hello world')).toBe(3);
      expect(adapter.estimateTokens('a'.repeat(100))).toBe(25);
    });
  });

  describe('Provider Configurations', () => {
    it('exports all provider configs', () => {
      expect(ALL_PROVIDER_CONFIGS).toHaveLength(6);
      expect(ALL_PROVIDER_CONFIGS.map((c) => c.providerId)).toEqual([
        'claude',
        'gemini',
        'codex',
        'grok',
        'opencode',
        'local-llm',
      ]);
    });

    it('claude config has correct structure', () => {
      expect(claudeConfig.providerId).toBe('claude');
      expect(claudeConfig.command).toBe('claude');
      expect(claudeConfig.args).toContain('--print');
      expect(claudeConfig.outputFormat).toBe('stream-json');
      expect(claudeConfig.models.length).toBeGreaterThan(0);
    });

    it('gemini config has correct structure', () => {
      expect(geminiConfig.providerId).toBe('gemini');
      expect(geminiConfig.command).toBe('gemini');
      expect(geminiConfig.args).toContain('--approval-mode');
      expect(geminiConfig.outputFormat).toBe('stream-json');
    });

    it('codex config has correct structure', () => {
      expect(codexConfig.providerId).toBe('codex');
      expect(codexConfig.command).toBe('codex');
      expect(codexConfig.outputFormat).toBe('stream-json');
    });

    it('grok config has correct structure', () => {
      expect(grokConfig.providerId).toBe('grok');
      expect(grokConfig.command).toBe('ax-grok');
      expect(grokConfig.outputFormat).toBe('stream-json');
      expect(grokConfig.promptStyle).toBe('arg');
      expect(grokConfig.models.length).toBeGreaterThan(0);
    });

    it('opencode config has correct structure', () => {
      expect(opencodeConfig.providerId).toBe('opencode');
      expect(opencodeConfig.command).toBe('opencode');
      expect(opencodeConfig.outputFormat).toBe('stream-json');  // OpenCode with --format json outputs NDJSON
      expect(opencodeConfig.models.length).toBeGreaterThan(0);
    });

    it('all configs have non-interactive env vars', () => {
      for (const config of ALL_PROVIDER_CONFIGS) {
        expect(config.env.TERM).toBe('dumb');
        expect(config.env.NO_COLOR).toBe('1');
        expect(config.env.CI).toBe('true');
      }
    });

    it('all configs have reasonable timeouts', () => {
      for (const config of ALL_PROVIDER_CONFIGS) {
        expect(config.timeout).toBeGreaterThanOrEqual(60000);
        expect(config.timeout).toBeLessThanOrEqual(300000);
      }
    });
  });

  describe('Provider Registry', () => {
    it('creates registry with all default providers', () => {
      const registry = createProviderRegistry();
      expect(registry.size).toBe(6);
      expect(registry.getProviderIds()).toEqual([
        'claude',
        'gemini',
        'codex',
        'grok',
        'opencode',
        'local-llm',
      ]);
    });

    it('creates empty registry', () => {
      const registry = createEmptyRegistry();
      expect(registry.size).toBe(0);
    });

    it('gets provider by ID', () => {
      const registry = createProviderRegistry();
      const claude = registry.get('claude');
      expect(claude).toBeDefined();
      expect(claude?.providerId).toBe('claude');
    });

    it('returns undefined for unknown provider', () => {
      const registry = createProviderRegistry();
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('gets provider by model', () => {
      const registry = createProviderRegistry();
      // All providers use 'default' model - getByModel returns first match
      const provider = registry.getByModel('default');
      expect(provider).toBeDefined();
    });

    it('returns undefined for unknown model', () => {
      const registry = createProviderRegistry();
      expect(registry.getByModel('unknown-model')).toBeUndefined();
    });

    it('checks if model exists', () => {
      const registry = createProviderRegistry();
      // All providers have 'default' model
      expect(registry.hasModel('default')).toBe(true);
      expect(registry.hasModel('unknown')).toBe(false);
    });

    it('gets all models across providers', () => {
      const registry = createProviderRegistry();
      const models = registry.getAllModels();
      // 6 providers, each with 1 'default' model
      expect(models.length).toBe(6);
      expect(models.some((m) => m.providerId === 'claude')).toBe(true);
      expect(models.some((m) => m.providerId === 'gemini')).toBe(true);
    });

    it('registers custom provider', () => {
      const registry = createEmptyRegistry();
      const customConfig: CLIProviderConfig = {
        providerId: 'custom',
        command: 'custom-cli',
        args: [],
        env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
        outputFormat: 'text',
        timeout: 60000,
        models: [
          { modelId: 'custom-model', name: 'Custom', contextWindow: 4096, capabilities: ['text'] },
        ],
      };
      registry.registerFromConfig(customConfig);
      expect(registry.size).toBe(1);
      expect(registry.get('custom')).toBeDefined();
    });
  });
});

describe('Output Parser', () => {
  describe('parseOutput', () => {
    it('parses plain text', () => {
      const result = parseOutput('Hello world', 'text');
      expect(result.content).toBe('Hello world');
    });

    it('parses JSON with content field', () => {
      const result = parseOutput('{"content": "Hello"}', 'json');
      expect(result.content).toBe('Hello');
    });

    it('parses JSON with text field', () => {
      const result = parseOutput('{"text": "Hello"}', 'json');
      expect(result.content).toBe('Hello');
    });

    it('parses stream-json (multiple lines)', () => {
      const input = '{"content": "Hello "}\n{"content": "world"}';
      const result = parseOutput(input, 'stream-json');
      expect(result.content).toBe('Hello world');
    });

    it('handles empty input', () => {
      expect(parseOutput('', 'text').content).toBe('');
      expect(parseOutput('', 'json').content).toBe('');
      expect(parseOutput('', 'stream-json').content).toBe('');
    });

    it('falls back to text for invalid JSON', () => {
      const result = parseOutput('not valid json', 'json');
      expect(result.content).toBe('not valid json');
    });
  });

  describe('estimateTokenUsage', () => {
    it('estimates tokens at ~4 chars per token', () => {
      const usage = estimateTokenUsage('Hello', 'World');
      expect(usage.inputTokens).toBe(2);
      expect(usage.outputTokens).toBe(2);
      expect(usage.totalTokens).toBe(4);
    });

    it('rounds up for partial tokens', () => {
      const usage = estimateTokenUsage('Hi', 'Bye');
      expect(usage.inputTokens).toBe(1);
      expect(usage.outputTokens).toBe(1);
    });
  });
});

describe('Error Classifier', () => {
  describe('classifyError', () => {
    it('classifies rate limit errors', () => {
      const error = classifyError(new Error('rate_limit_exceeded'));
      expect(error.category).toBe('rate_limit');
      expect(error.shouldRetry).toBe(true);
      expect(error.shouldFallback).toBe(false);
    });

    it('classifies authentication errors', () => {
      const error = classifyError(new Error('invalid_api_key'));
      expect(error.category).toBe('authentication');
      expect(error.shouldRetry).toBe(false);
      expect(error.shouldFallback).toBe(false);
    });

    it('classifies network errors', () => {
      const error = classifyError(new Error('ECONNRESET'));
      expect(error.category).toBe('network');
      expect(error.shouldRetry).toBe(true);
      expect(error.shouldFallback).toBe(true);
    });

    it('classifies quota errors', () => {
      const error = classifyError(new Error('insufficient_quota'));
      expect(error.category).toBe('quota');
      expect(error.shouldRetry).toBe(false);
      expect(error.shouldFallback).toBe(true);
    });

    it('classifies timeout errors', () => {
      const error = classifyError(new Error('request timed out'));
      expect(error.category).toBe('timeout');
      expect(error.shouldRetry).toBe(true);
    });

    it('classifies unknown errors', () => {
      const error = classifyError(new Error('something weird happened'));
      expect(error.category).toBe('unknown');
      expect(error.shouldRetry).toBe(false);
      expect(error.shouldFallback).toBe(true);
    });

    it('extracts retry-after from message', () => {
      const error = classifyError(new Error('rate limited, retry after 30s'));
      expect(error.retryAfterMs).toBe(30000);
    });
  });

  describe('classifySpawnResult', () => {
    it('classifies timeout result', () => {
      const result: SpawnResult = {
        stdout: '',
        stderr: '',
        exitCode: 137,
        timedOut: true,
      };
      const error = classifySpawnResult(result);
      expect(error.category).toBe('timeout');
      expect(error.shouldRetry).toBe(true);
    });

    it('classifies error from stderr', () => {
      const result: SpawnResult = {
        stdout: '',
        stderr: 'Error: rate_limit_exceeded',
        exitCode: 1,
        timedOut: false,
      };
      const error = classifySpawnResult(result);
      expect(error.category).toBe('rate_limit');
    });

    it('uses exit code when stderr empty', () => {
      const result: SpawnResult = {
        stdout: '',
        stderr: '',
        exitCode: 1,
        timedOut: false,
      };
      const error = classifySpawnResult(result);
      expect(error.message).toContain('Exit code: 1');
    });
  });
});

describe('Process Manager', () => {
  describe('buildPromptFromMessages', () => {
    it('builds prompt from user message', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const prompt = buildPromptFromMessages(messages);
      expect(prompt).toBe('Hello');
    });

    it('includes system prompt', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const prompt = buildPromptFromMessages(messages, 'You are helpful');
      expect(prompt).toContain('[System]');
      expect(prompt).toContain('You are helpful');
      expect(prompt).toContain('Hello');
    });

    it('includes assistant messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ];
      const prompt = buildPromptFromMessages(messages);
      expect(prompt).toContain('Hello');
      expect(prompt).toContain('[Assistant]');
      expect(prompt).toContain('Hi there');
      expect(prompt).toContain('How are you?');
    });
  });
});

describe('Grok CLI Adapter', () => {
  describe('Grok adapter', () => {
    it('creates adapter with correct providerId', () => {
      const adapter = createCLIAdapter(grokConfig);
      expect(adapter.providerId).toBe('grok');
    });

    it('uses ax-grok command', () => {
      const adapter = createCLIAdapter(grokConfig);
      expect(adapter.config.command).toBe('ax-grok');
    });

    it('supports Grok default model', () => {
      const adapter = createCLIAdapter(grokConfig);
      // Grok uses CLI's default model - we don't specify individual models
      expect(adapter.supportsModel('default')).toBe(true);
      expect(adapter.supportsModel('nonexistent-model')).toBe(false);
    });
  });
});
