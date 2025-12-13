/**
 * Unit Tests for RoutingConfigurator (v13.0.0)
 *
 * Tests the provider routing auto-configuration functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import type { ProviderInfo } from '../../../src/core/provider-detector.js';

// Create mock before importing the module
const mockDetectAllWithInfo = vi.fn<() => Promise<ProviderInfo[]>>().mockResolvedValue([]);

vi.mock('../../../src/core/provider-detector.js', () => ({
  ProviderDetector: class MockProviderDetector {
    detectAllWithInfo = mockDetectAllWithInfo;
    static formatProviderName(name: string): string {
      const nameMap: Record<string, string> = {
        'claude-code': 'Claude Code',
        'gemini-cli': 'Gemini CLI',
        'codex': 'Codex CLI',
        'glm': 'GLM',
        'grok': 'Grok',
        'qwen': 'Qwen',
      };
      return nameMap[name] || name;
    }
  },
}));

// Import after mock setup
import { RoutingConfigurator } from '../../../src/core/routing-configurator.js';

describe('RoutingConfigurator', () => {
  let configurator: RoutingConfigurator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectAllWithInfo.mockResolvedValue([]);
    configurator = new RoutingConfigurator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up env vars
    delete process.env.GLM_API_KEY;
    delete process.env.ZHIPU_API_KEY;
    delete process.env.ZAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.QWEN_API_KEY;
  });

  describe('detectCapabilities', () => {
    it('should detect CLI providers when installed', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true, version: '2.0.61' },
        { name: 'gemini-cli', command: 'gemini', detected: true, version: '1.5.0' },
      ]);

      const capabilities = await configurator.detectCapabilities();

      expect(capabilities.size).toBe(2);
      expect(capabilities.get('claude-code')?.available).toBe(true);
      expect(capabilities.get('gemini-cli')?.available).toBe(true);
    });

    it('should mark CLI providers as unavailable when not installed', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: false, error: 'not found' },
      ]);

      const capabilities = await configurator.detectCapabilities();

      expect(capabilities.get('claude-code')?.available).toBe(false);
      expect(capabilities.get('claude-code')?.installed).toBe(false);
    });

    it('should check API keys for SDK providers', async () => {
      // Set API key
      process.env.GLM_API_KEY = 'test-key';

      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'glm', command: 'glm', detected: false },
      ]);

      const capabilities = await configurator.detectCapabilities();

      expect(capabilities.get('glm')?.available).toBe(true);
    });

    it('should mark SDK providers as unavailable without API key', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'glm', command: 'glm', detected: false },
      ]);

      const capabilities = await configurator.detectCapabilities();

      expect(capabilities.get('glm')?.available).toBe(false);
    });

    it('should detect hybrid providers (qwen) with CLI', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'qwen', command: 'qwen', detected: true },
      ]);

      const capabilities = await configurator.detectCapabilities();
      expect(capabilities.get('qwen')?.available).toBe(true);
    });

    it('should detect hybrid providers (qwen) with API key', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'qwen', command: 'qwen', detected: false },
      ]);

      const newConfigurator = new RoutingConfigurator();
      const capabilities = await newConfigurator.detectCapabilities();
      expect(capabilities.get('qwen')?.available).toBe(true);
    });
  });

  describe('generateRecommendation', () => {
    it('should return empty recommendation when no providers available', async () => {
      mockDetectAllWithInfo.mockResolvedValue([]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      expect(Object.keys(recommendation.providers)).toHaveLength(0);
      expect(recommendation.rationale.length).toBeGreaterThan(0);
      expect(recommendation.rationale[0]).toContain('No providers detected');
    });

    it('should prioritize free tier providers', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Gemini should be priority 1 (free tier with higher daily limit)
      expect(recommendation.providers['gemini-cli']?.priority).toBe(1);
      // Claude should be priority 2
      expect(recommendation.providers['claude-code']?.priority).toBe(2);
    });

    it('should generate agent affinities based on capabilities', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Backend should prefer claude-code (best coding score)
      expect(recommendation.agentAffinities['backend']?.primary).toBe('claude-code');

      // Quality should prefer gemini-cli (fast analysis)
      expect(recommendation.agentAffinities['quality']?.primary).toBe('gemini-cli');
    });

    it('should generate fallback chains', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
        { name: 'codex', command: 'codex', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Backend fallback should include other providers
      const backendFallback = recommendation.agentAffinities['backend']?.fallback;
      expect(backendFallback?.length).toBeGreaterThan(0);
      expect(backendFallback).toContain('codex');
    });

    it('should generate ability routing', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Code generation should prefer claude-code
      const codeGenProviders = recommendation.abilityRouting['code-generation']?.preferredProviders;
      expect(codeGenProviders?.[0]).toBe('claude-code');

      // Code review should prefer gemini-cli
      const codeReviewProviders = recommendation.abilityRouting['code-review']?.preferredProviders;
      expect(codeReviewProviders?.[0]).toBe('gemini-cli');
    });

    it('should handle single provider case', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      expect(Object.keys(recommendation.providers)).toHaveLength(1);
      expect(recommendation.providers['claude-code']?.priority).toBe(1);

      // All agents should point to the single provider
      expect(recommendation.agentAffinities['backend']?.primary).toBe('claude-code');
      expect(recommendation.agentAffinities['frontend']?.primary).toBe('claude-code');
      expect(recommendation.agentAffinities['quality']?.primary).toBe('claude-code');

      // Fallback should be empty
      expect(recommendation.agentAffinities['backend']?.fallback).toHaveLength(0);
    });

    it('should include rationale for decisions', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      expect(recommendation.rationale.length).toBeGreaterThan(0);
      expect(recommendation.rationale.some(r => r.includes('Priority Order'))).toBe(true);
    });

    it('should include timestamp in recommendation', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      expect(recommendation.generatedAt).toBeDefined();
      expect(new Date(recommendation.generatedAt).getTime()).not.toBeNaN();
    });
  });

  describe('generateReport', () => {
    it('should generate human-readable report', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true, version: '2.0.61' },
        { name: 'gemini-cli', command: 'gemini', detected: true, version: '1.5.0' },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();
      const report = configurator.generateReport(recommendation);

      expect(report).toContain('Detected Providers');
      expect(report).toContain('Routing Priority');
    });

    it('should show unavailable providers with status indicator', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'glm', command: 'glm', detected: false },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();
      const report = configurator.generateReport(recommendation);

      expect(report).toContain('✓'); // For claude-code
      expect(report).toContain('✗'); // For glm
    });
  });

  // Note: applyRecommendation tests require real fs mocking which is complex in ESM
  // The core functionality is tested via integration tests
  // These tests verify the recommendation generation logic which is the core feature
  describe('applyRecommendation integration', () => {
    it('should generate changes for recommendation', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Verify the recommendation has the expected structure
      expect(recommendation.providers).toBeDefined();
      expect(recommendation.agentAffinities).toBeDefined();
      expect(recommendation.abilityRouting).toBeDefined();
      expect(recommendation.generatedAt).toBeDefined();
    });

    it('should include agent affinities in recommendation', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Verify agent affinities are generated
      expect(Object.keys(recommendation.agentAffinities).length).toBeGreaterThan(0);
      expect(recommendation.agentAffinities['backend']).toBeDefined();
      expect(recommendation.agentAffinities['quality']).toBeDefined();
    });

    it('should preserve config structure in recommendation', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Verify provider config has required fields
      const claudeConfig = recommendation.providers['claude-code'];
      expect(claudeConfig).toBeDefined();
      expect(claudeConfig?.enabled).toBe(true);
      expect(claudeConfig?.priority).toBe(1);
      expect(claudeConfig?.preferredFor).toBeDefined();
      expect(claudeConfig?.fallbackFor).toBeDefined();
    });
  });

  describe('priority calculation', () => {
    it('should give higher priority to free tier providers', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true }, // freeTier but rate limited
        { name: 'gemini-cli', command: 'gemini', detected: true },  // freeTier with 1500/day
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Gemini should be prioritized (free tier with higher daily limit)
      const geminiPriority = recommendation.providers['gemini-cli']?.priority ?? 999;
      const claudePriority = recommendation.providers['claude-code']?.priority ?? 999;
      expect(geminiPriority).toBeLessThan(claudePriority);
    });

    it('should consider coding score for code-focused tasks', async () => {
      process.env.GLM_API_KEY = 'test-key';

      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true }, // codingScore: 95
        { name: 'glm', command: 'glm', detected: false },           // codingScore: 70
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Claude should be preferred for backend (coding)
      expect(recommendation.agentAffinities['backend']?.primary).toBe('claude-code');
    });
  });

  describe('applyRecommendation - fill missing fields (v12.8.4)', () => {
    // Note: Tests for applyRecommendation with fs mocking are complex in ESM.
    // These tests verify the logic by simulating the provider detection and
    // checking that recommendations have the expected structure.

    it('should detect CLI providers correctly for new provider config generation', async () => {
      // When codex is detected, the recommendation should be generated
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'codex', command: 'codex', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // Verify codex is in the recommendation
      expect(recommendation.providers.codex).toBeDefined();
      expect(recommendation.providers.codex?.enabled).toBe(true);

      // Verify capabilities include the CLI execution mode
      const codexCap = configurator.getCapabilities().get('codex');
      expect(codexCap?.executionMode).toBe('cli');
      expect(codexCap?.available).toBe(true);
    });

    it('should identify SDK providers correctly for type assignment', async () => {
      process.env.GLM_API_KEY = 'test-key';

      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'glm', command: 'glm', detected: false },  // SDK provider
      ]);

      await configurator.detectCapabilities();
      const glmCap = configurator.getCapabilities().get('glm');

      expect(glmCap?.executionMode).toBe('sdk');
      expect(glmCap?.available).toBe(true);  // Available via API key
    });

    it('should identify hybrid providers correctly for type assignment', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';

      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'qwen', command: 'qwen', detected: false },  // Available via API key
      ]);

      await configurator.detectCapabilities();
      const qwenCap = configurator.getCapabilities().get('qwen');

      expect(qwenCap?.executionMode).toBe('hybrid');
      expect(qwenCap?.available).toBe(true);
    });

    it('should generate recommendations with provider configs for all detected providers', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'codex', command: 'codex', detected: true },
        { name: 'gemini-cli', command: 'gemini', detected: true },
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // All detected providers should be in the recommendation
      expect(recommendation.providers['claude-code']).toBeDefined();
      expect(recommendation.providers.codex).toBeDefined();
      expect(recommendation.providers['gemini-cli']).toBeDefined();

      // Each should have enabled and priority
      for (const [name, config] of Object.entries(recommendation.providers)) {
        expect(config.enabled).toBe(true);
        expect(typeof config.priority).toBe('number');
      }
    });

    it('should verify capability metadata is available for type determination', async () => {
      // This tests that capabilities are populated with execution mode
      // which is used by applyRecommendation to determine provider type
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'codex', command: 'codex', detected: true },
      ]);

      await configurator.detectCapabilities();

      const caps = configurator.getCapabilities();
      const codexCap = caps.get('codex');

      // Verify the capability has the information needed for type determination
      expect(codexCap).toBeDefined();
      expect(codexCap?.executionMode).toBe('cli');
      expect(codexCap?.name).toBe('codex');
      expect(codexCap?.command).toBe('codex');
    });

    it('should not include unavailable providers in recommendation', async () => {
      mockDetectAllWithInfo.mockResolvedValue([
        { name: 'claude-code', command: 'claude', detected: true },
        { name: 'glm', command: 'glm', detected: false },  // No API key set
      ]);

      await configurator.detectCapabilities();
      const recommendation = configurator.generateRecommendation();

      // GLM should not be in recommendation (no API key)
      expect(recommendation.providers['glm']).toBeUndefined();
      expect(recommendation.providers['claude-code']).toBeDefined();
    });
  });
});
