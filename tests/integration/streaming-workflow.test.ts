/**
 * Streaming Workflow Integration Tests
 *
 * Tests the complete streaming workflow from CLI to provider execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import { ContextManager } from '../../src/agents/context-manager.js';
import { ProfileLoader } from '../../src/agents/profile-loader.js';
import { TeamManager } from '../../src/core/team-manager.js';
import { Router } from '../../src/core/router.js';
import { ProgressChannel } from '../../src/core/progress-channel.js';
import { ProgressRenderer } from '../../src/cli/renderers/progress-renderer.js';
import { OpenAIProvider } from '../../src/providers/openai-provider.js';
import { GeminiProvider } from '../../src/providers/gemini-provider.js';
import { ClaudeProvider } from '../../src/providers/claude-provider.js';
import type { ExecutionOptions } from '../../src/agents/executor.js';
import type { ExecutionRequest, ProviderConfig } from '../../src/types/provider.js';
import type { AgentProfile } from '../../src/types/agent.js';

// Mock ora
vi.mock('ora', () => {
  return {
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
      text: '',
    })),
  };
});

// v8.3.0: Skip streaming tests - feature removed in CLI-only refactoring
describe.skip('Streaming Workflow Integration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AX_MOCK_PROVIDERS;
    process.env.AX_MOCK_PROVIDERS = 'true';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AX_MOCK_PROVIDERS;
    } else {
      process.env.AX_MOCK_PROVIDERS = originalEnv;
    }
    vi.restoreAllMocks();
  });

  describe('ProgressChannel + ProgressRenderer Integration', () => {
    it('should integrate ProgressChannel with ProgressRenderer', () => {
      const channel = new ProgressChannel({ throttleMs: 100 });
      const renderer = new ProgressRenderer({ quiet: false });

      renderer.start();

      // Subscribe renderer to channel
      const unsubscribe = channel.subscribe((event) => {
        renderer.handleEvent(event);
      });

      // Emit events
      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 50
      });

      channel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      // Cleanup
      renderer.stop();
      unsubscribe();
      channel.clear();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle multiple stages through channel', () => {
      const channel = new ProgressChannel({ throttleMs: 50 });
      const renderer = new ProgressRenderer({ quiet: false });

      renderer.start();
      channel.subscribe((event) => renderer.handleEvent(event));

      // Stage 1
      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });
      channel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      // Stage 2
      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 1,
        stageName: 'Implementation'
      });
      channel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 1,
        stageName: 'Implementation'
      });

      // Cleanup
      renderer.stop();
      channel.clear();

      expect(true).toBe(true);
    });

    it('should handle error propagation through channel', () => {
      const channel = new ProgressChannel({ throttleMs: 50 });
      const renderer = new ProgressRenderer({ quiet: false });

      renderer.start();
      channel.subscribe((event) => renderer.handleEvent(event));

      // Start stage
      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      // Error occurs
      channel.emit({
        type: 'stage-error',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        message: 'Network timeout'
      });

      // Cleanup
      renderer.stop();
      channel.clear();

      expect(true).toBe(true);
    });
  });

  describe('AgentExecutor Streaming Integration', () => {
    it('should execute agent with streaming enabled', async () => {
      const config: ProviderConfig = {
        name: 'codex',
        enabled: true,
        priority: 1,
        timeout: 10000,
        command: 'codex',
      };

      const provider = new OpenAIProvider(config);
      const executor = new AgentExecutor();

      const mockAgent: AgentProfile = {
        name: 'test-agent',
        team: 'engineering',
        role: 'Test Agent',
        description: 'A test agent for integration testing',
        systemPrompt: 'You are a test agent',
        abilities: [],
      };

      const context = {
        agent: mockAgent,
        task: 'Test task',
        provider,
        memory: [],
        projectDir: process.cwd(),
        workingDir: process.cwd(),
        agentWorkspace: '/tmp/test',
        abilities: '',
        createdAt: new Date(),
      };

      const tokens: string[] = [];
      const progressUpdates: number[] = [];

      const options: ExecutionOptions = {
        verbose: false,
        showProgress: false,
        streaming: {
          enabled: true,
          onToken: (token) => tokens.push(token),
          onProgress: (progress) => progressUpdates.push(progress),
        },
      };

      const result = await executor.execute(context, options);

      // Should receive streaming data
      expect(tokens.length).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Result should be valid
      expect(result.response.content).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should execute without streaming when disabled', async () => {
      const config: ProviderConfig = {
        name: 'codex',
        enabled: true,
        priority: 1,
        timeout: 10000,
        command: 'codex',
      };

      const provider = new OpenAIProvider(config);
      const executor = new AgentExecutor();

      const mockAgent: AgentProfile = {
        name: 'test-agent',
        team: 'engineering',
        role: 'Test Agent',
        description: 'A test agent for integration testing',
        systemPrompt: 'You are a test agent',
        abilities: [],
      };

      const context = {
        agent: mockAgent,
        task: 'Test task',
        provider,
        memory: [],
        projectDir: process.cwd(),
        workingDir: process.cwd(),
        agentWorkspace: '/tmp/test',
        abilities: '',
        createdAt: new Date(),
      };

      const options: ExecutionOptions = {
        verbose: false,
        showProgress: false,
        // No streaming
      };

      const result = await executor.execute(context, options);

      // Should execute successfully
      expect(result.response.content).toBeTruthy();
    });

    it('should handle streaming with provider that does not support it', async () => {
      const config: ProviderConfig = {
        name: 'gemini',
        enabled: true,
        priority: 2,
        timeout: 10000,
        command: 'gemini',
      };

      const provider = new GeminiProvider(config);
      const executor = new AgentExecutor();

      const mockAgent: AgentProfile = {
        name: 'test-agent',
        team: 'business',
        role: 'Test Agent',
        description: 'A test agent for integration testing',
        systemPrompt: 'You are a test agent',
        abilities: [],
      };

      const context = {
        agent: mockAgent,
        task: 'Test task',
        provider,
        memory: [],
        projectDir: process.cwd(),
        workingDir: process.cwd(),
        agentWorkspace: '/tmp/test',
        abilities: '',
        createdAt: new Date(),
      };

      const progressUpdates: number[] = [];

      const options: ExecutionOptions = {
        verbose: false,
        showProgress: false,
        streaming: {
          enabled: true,
          onProgress: (progress) => progressUpdates.push(progress),
        },
      };

      const result = await executor.execute(context, options);

      // Gemini provider does not implement executeStreaming(), so no progress updates
      // The executor falls back to regular execute() method
      expect(progressUpdates.length).toBe(0);

      // Result should still be valid
      expect(result.response.content).toBeTruthy();
    });
  });

  describe('End-to-End Streaming Flow', () => {
    it('should complete full streaming workflow', async () => {
      // Setup components
      const progressChannel = new ProgressChannel({ throttleMs: 50 });
      const progressRenderer = new ProgressRenderer({ quiet: false });

      progressRenderer.start();
      progressChannel.subscribe((event) => progressRenderer.handleEvent(event));

      const config: ProviderConfig = {
        name: 'codex',
        enabled: true,
        priority: 1,
        timeout: 10000,
        command: 'codex',
      };

      const provider = new OpenAIProvider(config);
      const executor = new AgentExecutor();

      const mockAgent: AgentProfile = {
        name: 'test-agent',
        team: 'engineering',
        role: 'Test Agent',
        description: 'A test agent for integration testing',
        systemPrompt: 'You are a test agent',
        abilities: [],
      };

      const context = {
        agent: mockAgent,
        task: 'Test task',
        provider,
        memory: [],
        projectDir: process.cwd(),
        workingDir: process.cwd(),
        agentWorkspace: '/tmp/test',
        abilities: '',
        createdAt: new Date(),
      };

      // Track streaming data
      const tokens: string[] = [];
      const progressUpdates: number[] = [];

      // Emit stage start
      progressChannel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      // Execute with streaming
      const options: ExecutionOptions = {
        verbose: false,
        showProgress: false,
        streaming: {
          enabled: true,
          onToken: (token) => {
            tokens.push(token);
            // Forward to progress channel
            progressChannel.emit({
              type: 'token-stream',
              timestamp: new Date(),
              stageIndex: 0,
              stageName: 'Planning',
              token
            });
          },
          onProgress: (progress) => {
            progressUpdates.push(progress);
            // Forward to progress channel
            progressChannel.emit({
              type: 'stage-progress',
              timestamp: new Date(),
              stageIndex: 0,
              stageName: 'Planning',
              progress
            });
          },
        },
      };

      const result = await executor.execute(context, options);

      // Emit stage complete
      progressChannel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      // Verify results
      expect(tokens.length).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(result.response.content).toBeTruthy();

      // Cleanup
      progressRenderer.stop();
      progressChannel.clear();
    });

    it('should handle multiple providers in streaming workflow', async () => {
      const progressChannel = new ProgressChannel({ throttleMs: 50 });

      const providers = [
        new OpenAIProvider({
          name: 'codex',
          enabled: true,
          priority: 1,
          timeout: 10000,
          command: 'codex',
        }),
        new GeminiProvider({
          name: 'gemini',
          enabled: true,
          priority: 2,
          timeout: 10000,
          command: 'gemini',
        }),
        new ClaudeProvider({
          name: 'claude',
          enabled: true,
          priority: 3,
          timeout: 10000,
          command: 'claude',
        }),
      ];

      const executor = new AgentExecutor();
      const results = [];

      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        if (!provider) continue;

        const mockAgent: AgentProfile = {
          name: `test-agent-${i}`,
          team: 'engineering',
          role: 'Test Agent',
          description: 'A test agent for integration testing',
          systemPrompt: 'You are a test agent',
          abilities: [],
        };

        const context = {
          agent: mockAgent,
          task: 'Test task',
          provider,
          memory: [],
          projectDir: process.cwd(),
          workingDir: process.cwd(),
          agentWorkspace: '/tmp/test',
          abilities: '',
          createdAt: new Date(),
        };

        progressChannel.emit({
          type: 'stage-start',
          timestamp: new Date(),
          stageIndex: i,
          stageName: `Stage ${i + 1}`
        });

        const options: ExecutionOptions = {
          verbose: false,
          showProgress: false,
          streaming: {
            enabled: true,
            onProgress: (progress) => {
              progressChannel.emit({
                type: 'stage-progress',
                timestamp: new Date(),
                stageIndex: i,
                stageName: `Stage ${i + 1}`,
                progress
              });
            },
          },
        };

        const result = await executor.execute(context, options);
        results.push(result);

        progressChannel.emit({
          type: 'stage-complete',
          timestamp: new Date(),
          stageIndex: i,
          stageName: `Stage ${i + 1}`
        });
      }

      // All results should be valid
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.response.content).toBeTruthy();
      });

      progressChannel.clear();
    });
  });

  describe('Error Handling in Streaming Workflow', () => {
    it('should handle errors during streaming', async () => {
      const progressChannel = new ProgressChannel({ throttleMs: 50 });
      const progressRenderer = new ProgressRenderer({ quiet: false });

      progressRenderer.start();
      progressChannel.subscribe((event) => progressRenderer.handleEvent(event));

      // Emit error event
      progressChannel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      progressChannel.emit({
        type: 'stage-error',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        message: 'Execution failed'
      });

      // Cleanup
      progressRenderer.stop();
      progressChannel.clear();

      expect(true).toBe(true);
    });

    it('should recover from callback errors', async () => {
      const config: ProviderConfig = {
        name: 'codex',
        enabled: true,
        priority: 1,
        timeout: 10000,
        command: 'codex',
      };

      const provider = new OpenAIProvider(config);
      const executor = new AgentExecutor();

      const mockAgent: AgentProfile = {
        name: 'test-agent',
        team: 'engineering',
        role: 'Test Agent',
        description: 'A test agent for integration testing',
        systemPrompt: 'You are a test agent',
        abilities: [],
      };

      const context = {
        agent: mockAgent,
        task: 'Test task',
        provider,
        memory: [],
        projectDir: process.cwd(),
        workingDir: process.cwd(),
        agentWorkspace: '/tmp/test',
        abilities: '',
        createdAt: new Date(),
      };

      let errorThrown = false;

      const options: ExecutionOptions = {
        verbose: false,
        showProgress: false,
        streaming: {
          enabled: true,
          onProgress: () => {
            if (!errorThrown) {
              errorThrown = true;
              throw new Error('Callback error');
            }
          },
        },
      };

      // Should throw due to callback error
      await expect(executor.execute(context, options)).rejects.toThrow();
    });
  });
});
