/**
 * Tests for Test Helpers - Validates the factory functions and MSW handlers
 * @module tests/unit/helpers/test-helpers.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import {
  // Factories
  setTestSeed,
  resetTestSeed,
  createAgentProfile,
  createStage,
  createPersonality,
  createMockProvider,
  createProviderCapabilities,
  createHealthStatus,
  createRateLimitStatus,
  createExecutionResponse,
  createExecutionContext,
  createMemoryEntry,
  createMemoryEntries,
  createDelegationResult,
  createTaskDescription,
  createComplexTask,
  createSessionId,
  createTaskId,
  createDelegationChain,
  // MSW handlers
  defaultHandlers,
  fastHandlers,
  createProviderHandlers,
} from '../../helpers/index.js';

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Functions', () => {
  describe('Seed Management', () => {
    afterEach(() => {
      resetTestSeed();
    });

    it('should generate reproducible data with seed', () => {
      setTestSeed(12345);
      const profile1 = createAgentProfile();

      setTestSeed(12345);
      const profile2 = createAgentProfile();

      expect(profile1.displayName).toBe(profile2.displayName);
      expect(profile1.role).toBe(profile2.role);
    });

    it('should generate different data after reset', () => {
      setTestSeed(12345);
      const profile1 = createAgentProfile();

      resetTestSeed();
      const profile2 = createAgentProfile();

      // Very unlikely to be the same with random seed
      expect(profile1.displayName).not.toBe(profile2.displayName);
    });
  });

  describe('createAgentProfile', () => {
    it('should create valid agent profile with defaults', () => {
      const profile = createAgentProfile();

      expect(profile.name).toBeDefined();
      expect(profile.displayName).toBeDefined();
      expect(profile.role).toBeDefined();
      expect(profile.description).toBeDefined();
      expect(profile.systemPrompt).toBeDefined();
      expect(profile.abilities).toBeInstanceOf(Array);
      expect(profile.team).toBeDefined();
      expect(profile.provider).toBeDefined();
      expect(profile.model).toBeDefined();
      expect(profile.temperature).toBeGreaterThanOrEqual(0);
      expect(profile.temperature).toBeLessThanOrEqual(1);
    });

    it('should respect overrides', () => {
      const profile = createAgentProfile({
        name: 'custom-agent',
        displayName: 'Custom',
        role: 'Tester',
      });

      expect(profile.name).toBe('custom-agent');
      expect(profile.displayName).toBe('Custom');
      expect(profile.role).toBe('Tester');
    });
  });

  describe('createStage', () => {
    it('should create valid stage', () => {
      const stage = createStage();

      expect(stage.name).toBeDefined();
      expect(stage.description).toBeDefined();
      expect(stage.key_questions).toBeInstanceOf(Array);
      expect(stage.key_questions?.length).toBeGreaterThan(0);
      expect(stage.outputs).toBeInstanceOf(Array);
    });
  });

  describe('createPersonality', () => {
    it('should create valid personality', () => {
      const personality = createPersonality();

      expect(personality.traits).toBeInstanceOf(Array);
      expect(personality.traits?.length).toBeGreaterThan(0);
      expect(personality.catchphrase).toBeDefined();
      expect(personality.communication_style).toBeDefined();
      expect(personality.decision_making).toBeDefined();
    });
  });

  describe('createMockProvider', () => {
    it('should create provider with all required methods', () => {
      const provider = createMockProvider();

      expect(provider.name).toBeDefined();
      expect(provider.version).toBeDefined();
      expect(provider.priority).toBeGreaterThan(0);
      expect(provider.capabilities).toBeDefined();
      expect(typeof provider.execute).toBe('function');
      expect(typeof provider.supportsStreaming).toBe('function');
      expect(typeof provider.generateEmbedding).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
      expect(typeof provider.getHealth).toBe('function');
      expect(typeof provider.checkRateLimit).toBe('function');
    });

    it('should have working mock implementations', async () => {
      const provider = createMockProvider();

      const execResult = await provider.execute({ prompt: 'test' });
      expect(execResult.content).toBeDefined();
      expect(execResult.tokensUsed).toBeDefined();

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);

      const health = await provider.getHealth();
      expect(health.available).toBe(true);

      const rateLimit = await provider.checkRateLimit();
      expect(rateLimit.hasCapacity).toBe(true);
    });
  });

  describe('createProviderCapabilities', () => {
    it('should create valid capabilities', () => {
      const caps = createProviderCapabilities();

      expect(typeof caps.supportsStreaming).toBe('boolean');
      expect(typeof caps.supportsEmbedding).toBe('boolean');
      expect(typeof caps.supportsVision).toBe('boolean');
      expect(caps.maxContextTokens).toBeGreaterThan(0);
      expect(caps.supportedModels).toBeInstanceOf(Array);
    });
  });

  describe('createHealthStatus', () => {
    it('should create healthy status by default', () => {
      const status = createHealthStatus();

      expect(status.available).toBe(true);
      expect(status.latencyMs).toBeGreaterThan(0);
      expect(status.errorRate).toBeGreaterThanOrEqual(0);
      expect(status.consecutiveFailures).toBe(0);
    });

    it('should create unhealthy status with override', () => {
      const status = createHealthStatus({ available: false });

      expect(status.available).toBe(false);
      expect(status.consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('createRateLimitStatus', () => {
    it('should create status with capacity', () => {
      const status = createRateLimitStatus();

      expect(status.hasCapacity).toBe(true);
      expect(status.requestsRemaining).toBeGreaterThan(0);
      expect(status.tokensRemaining).toBeGreaterThan(0);
      expect(status.resetAtMs).toBeGreaterThan(Date.now());
    });
  });

  describe('createExecutionResponse', () => {
    it('should create valid response', () => {
      const response = createExecutionResponse();

      expect(response.content).toBeDefined();
      expect(response.model).toBeDefined();
      expect(response.tokensUsed.total).toBe(
        response.tokensUsed.prompt + response.tokensUsed.completion
      );
      expect(response.latencyMs).toBeGreaterThan(0);
      expect(['stop', 'length']).toContain(response.finishReason);
    });
  });

  describe('createExecutionContext', () => {
    it('should create valid context', () => {
      const context = createExecutionContext();

      expect(context.agent).toBeDefined();
      expect(context.task).toBeDefined();
      expect(context.projectDir).toBeDefined();
      expect(context.workingDir).toBe(context.projectDir);
      expect(context.provider).toBeDefined();
      expect(context.createdAt).toBeInstanceOf(Date);
    });

    it('should use provided agent in workspace path', () => {
      const context = createExecutionContext({
        agent: createAgentProfile({ name: 'test-agent' }),
      });

      expect(context.agentWorkspace).toContain('test-agent');
    });
  });

  describe('createMemoryEntry', () => {
    it('should create valid memory entry', () => {
      const entry = createMemoryEntry();

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.content).toBeDefined();
      expect(entry.metadata.agentId).toBeDefined();
      expect(entry.createdAt).toBeInstanceOf(Date);
      expect(entry.accessCount).toBeGreaterThan(0);
      expect(entry.score).toBeGreaterThanOrEqual(0.5);
      expect(entry.score).toBeLessThanOrEqual(1);
      expect(entry.embedding).toHaveLength(1536);
      expect(entry.metadata.type).toBeDefined();
    });
  });

  describe('createMemoryEntries', () => {
    it('should create multiple entries', () => {
      const entries = createMemoryEntries(5);

      expect(entries).toHaveLength(5);
      entries.forEach((entry) => {
        expect(entry.id).toBeDefined();
        expect(entry.content).toBeDefined();
      });
    });

    it('should apply overrides to all entries', () => {
      const entries = createMemoryEntries(3, { score: 0.95 });

      entries.forEach((entry) => {
        expect(entry.score).toBe(0.95);
      });
    });
  });

  describe('createDelegationResult', () => {
    it('should create valid delegation result', () => {
      const result = createDelegationResult();

      expect(result.delegationId).toBeDefined();
      expect(result.fromAgent).toBeDefined();
      expect(result.toAgent).toBeDefined();
      expect(result.task).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.outputs).toBeDefined();
    });
  });

  describe('Task Factories', () => {
    it('should create task description', () => {
      const task = createTaskDescription();
      expect(task.length).toBeGreaterThan(0);
    });

    it('should create complex task with multiple parts', () => {
      const task = createComplexTask();
      expect(task).toContain(' and ');
    });
  });

  describe('ID Generators', () => {
    it('should create valid session ID (UUID)', () => {
      const id = createSessionId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should create valid task ID', () => {
      const id = createTaskId();
      expect(id).toMatch(/^task_[a-zA-Z0-9]{12}$/);
    });

    it('should create delegation chain', () => {
      const chain = createDelegationChain(3);
      expect(chain).toHaveLength(3);
      chain.forEach((agent) => {
        expect(typeof agent).toBe('string');
      });
    });
  });
});

// ============================================================================
// MSW Handler Tests
// ============================================================================

describe('MSW Handlers', () => {
  describe('Handler Presets', () => {
    it('should export default handlers', () => {
      expect(defaultHandlers).toBeInstanceOf(Array);
      expect(defaultHandlers.length).toBeGreaterThan(0);
    });

    it('should export fast handlers', () => {
      expect(fastHandlers).toBeInstanceOf(Array);
      expect(fastHandlers.length).toBeGreaterThan(0);
    });

    it('should create custom handlers', () => {
      const handlers = createProviderHandlers({
        latency: 100,
        content: 'Custom response',
      });

      expect(handlers).toBeInstanceOf(Array);
      expect(handlers.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with MSW Server', () => {
    const server = setupServer(...fastHandlers);

    beforeAll(() => {
      server.listen({ onUnhandledRequest: 'bypass' });
    });

    afterEach(() => {
      server.resetHandlers();
    });

    afterAll(() => {
      server.close();
    });

    it('should mock OpenAI API', async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        id: string;
        choices: Array<{ message: { content: string } }>;
        usage: { total_tokens: number };
      };
      expect(data.id).toBeDefined();
      expect(data.choices).toBeInstanceOf(Array);
      expect(data.choices[0]?.message.content).toBeDefined();
      expect(data.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should mock Anthropic API', async () => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
        }),
      });

      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        id: string;
        type: string;
        content: Array<{ text: string }>;
        usage: { input_tokens: number };
      };
      expect(data.id).toBeDefined();
      expect(data.type).toBe('message');
      expect(data.content[0]?.text).toBeDefined();
      expect(data.usage.input_tokens).toBeGreaterThan(0);
    });

    it('should mock Gemini API', async () => {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }],
          }),
        }
      );

      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        usageMetadata: { totalTokenCount: number };
      };
      expect(data.candidates).toBeInstanceOf(Array);
      expect(data.candidates[0]?.content.parts[0]?.text).toBeDefined();
      expect(data.usageMetadata.totalTokenCount).toBeGreaterThan(0);
    });

    it('should mock GLM API', async () => {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'glm-4',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        id: string;
        choices: Array<{ message: { content: string } }>;
        usage: { total_tokens: number };
      };
      expect(data.id).toBeDefined();
      expect(data.choices[0]?.message.content).toBeDefined();
      expect(data.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should mock Grok API', async () => {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        id: string;
        choices: Array<{ message: { content: string } }>;
        usage: { total_tokens: number };
      };
      expect(data.id).toBeDefined();
      expect(data.choices[0]?.message.content).toBeDefined();
      expect(data.usage.total_tokens).toBeGreaterThan(0);
    });
  });
});
