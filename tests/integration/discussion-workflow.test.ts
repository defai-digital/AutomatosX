/**
 * Discussion Workflow Integration Tests
 *
 * Tests the integration between discussion-domain and workflow-engine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRealStepExecutor,
  type DiscussionExecutorLike,
  type DiscussStepConfigLike,
  type DiscussionResultLike,
} from '@defai.digital/workflow-engine';
import { WorkflowRunner } from '@defai.digital/workflow-engine';
import type { Workflow, WorkflowStep } from '@defai.digital/contracts';
import {
  DiscussionExecutor,
  StubProviderExecutor,
  createProviderBridge,
  createSimpleProviderBridge,
  type DiscussionProgressEvent,
} from '@defai.digital/discussion-domain';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock prompt executor for testing
 */
function createMockPromptExecutor(): {
  execute: (request: { prompt: string }) => Promise<{ success: boolean; content: string; latencyMs: number }>;
  getDefaultProvider: () => string;
} {
  return {
    execute: (request: { prompt: string }) =>
      Promise.resolve({
        success: true,
        content: `Mock response to: ${request.prompt.slice(0, 50)}...`,
        latencyMs: 100,
      }),
    getDefaultProvider: () => 'mock',
  };
}

/**
 * Creates a DiscussionExecutor adapter for the workflow engine
 */
function createDiscussionExecutorAdapter(executor: DiscussionExecutor): DiscussionExecutorLike {
  return {
    async execute(
      config: DiscussStepConfigLike,
      options?: { abortSignal?: AbortSignal; onProgress?: (event: unknown) => void }
    ): Promise<DiscussionResultLike> {
      // Build options object conditionally to handle exactOptionalPropertyTypes
      // Cast to the union type that includes undefined for optional properties
      const executorOptions: {
        abortSignal?: AbortSignal | undefined;
        onProgress?: ((event: DiscussionProgressEvent) => void) | undefined;
      } = {};

      if (options?.abortSignal) {
        executorOptions.abortSignal = options.abortSignal;
      }
      if (options?.onProgress) {
        executorOptions.onProgress = options.onProgress as (event: DiscussionProgressEvent) => void;
      }

      // Cast the config to the expected format
      const result = await executor.execute(
        config as Parameters<typeof executor.execute>[0],
        executorOptions as Parameters<typeof executor.execute>[1]
      );

      return result as DiscussionResultLike;
    },
  };
}

// ============================================================================
// Workflow with Discuss Step Tests
// ============================================================================

describe('Discussion Workflow Integration', () => {
  let stubProviderExecutor: StubProviderExecutor;
  let discussionExecutor: DiscussionExecutor;
  let discussionExecutorAdapter: DiscussionExecutorLike;

  beforeEach(() => {
    // Create a stub provider executor with available providers
    stubProviderExecutor = new StubProviderExecutor(['claude', 'grok', 'gemini'], 10);

    // Create the discussion executor with proper options object
    discussionExecutor = new DiscussionExecutor({ providerExecutor: stubProviderExecutor });

    // Create the adapter for workflow engine
    discussionExecutorAdapter = createDiscussionExecutorAdapter(discussionExecutor);
  });

  describe('Discuss Step Execution', () => {
    it('should execute a workflow with a discuss step', async () => {
      // Create the step executor with discussion support
      const stepExecutor = createRealStepExecutor({
        promptExecutor: createMockPromptExecutor(),
        discussionExecutor: discussionExecutorAdapter,
      });

      // Create a simple workflow with a discuss step
      const workflow: Workflow = {
        workflowId: 'test-workflow',
        version: '1.0.0',
        name: 'Discussion Test Workflow',
        steps: [
          {
            stepId: 'discuss-architecture',
            type: 'discuss',
            name: 'Discuss Architecture',
            config: {
              pattern: 'synthesis',
              providers: ['claude', 'grok', 'gemini'],
              prompt: 'What is the best architecture for a microservices application?',
              rounds: 2,
              consensus: { method: 'synthesis', synthesizer: 'claude' },
            },
          },
        ],
      };

      // Run the workflow
      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      // Debug output
      if (!result.success) {
        console.log('Workflow failed:', JSON.stringify(result, null, 2));
      }

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0]?.success).toBe(true);

      // Check the output structure
      const output = result.stepResults[0]?.output as Record<string, unknown>;
      expect(output.type).toBe('discuss');
      expect(output.pattern).toBe('synthesis');
      expect(Array.isArray(output.participatingProviders)).toBe(true);
    });

    it('should fail when no discussion executor is configured', async () => {
      // Create the step executor WITHOUT discussion support
      const stepExecutor = createRealStepExecutor({
        promptExecutor: createMockPromptExecutor(),
        // No discussionExecutor
      });

      const workflow: Workflow = {
        workflowId: 'test-workflow-no-discuss',
        version: '1.0.0',
        name: 'No Discussion Executor Test',
        steps: [
          {
            stepId: 'discuss-step',
            type: 'discuss',
            name: 'Discuss',
            config: {
              pattern: 'synthesis',
              providers: ['claude', 'grok'],
              prompt: 'Test discussion',
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(false);
      expect(result.stepResults[0]?.error?.code).toBe('DISCUSSION_EXECUTOR_NOT_CONFIGURED');
    });

    it('should fail when config is missing required fields', async () => {
      const stepExecutor = createRealStepExecutor({
        promptExecutor: createMockPromptExecutor(),
        discussionExecutor: discussionExecutorAdapter,
      });

      // Missing prompt
      const workflow: Workflow = {
        workflowId: 'test-workflow-invalid',
        version: '1.0.0',
        name: 'Invalid Config Test',
        steps: [
          {
            stepId: 'invalid-discuss',
            type: 'discuss',
            name: 'Invalid Discuss',
            config: {
              pattern: 'synthesis',
              providers: ['claude', 'grok'],
              // Missing prompt!
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(false);
      expect(result.stepResults[0]?.error?.code).toBe('DISCUSS_PROMPT_MISSING');
    });

    it('should fail when not enough providers specified', async () => {
      const stepExecutor = createRealStepExecutor({
        promptExecutor: createMockPromptExecutor(),
        discussionExecutor: discussionExecutorAdapter,
      });

      // Only 1 provider (need at least 2)
      const workflow: Workflow = {
        workflowId: 'test-workflow-few-providers',
        version: '1.0.0',
        name: 'Few Providers Test',
        steps: [
          {
            stepId: 'few-providers',
            type: 'discuss',
            name: 'Few Providers',
            config: {
              pattern: 'synthesis',
              providers: ['claude'], // Only 1!
              prompt: 'Test discussion',
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(false);
      expect(result.stepResults[0]?.error?.code).toBe('DISCUSS_PROVIDERS_INVALID');
    });
  });

  describe('Discussion Patterns in Workflow', () => {
    let stepExecutor: ReturnType<typeof createRealStepExecutor>;

    beforeEach(() => {
      stepExecutor = createRealStepExecutor({
        promptExecutor: createMockPromptExecutor(),
        discussionExecutor: discussionExecutorAdapter,
      });
    });

    it('should execute voting pattern', async () => {
      const workflow: Workflow = {
        workflowId: 'voting-workflow',
        version: '1.0.0',
        name: 'Voting Workflow',
        steps: [
          {
            stepId: 'vote-framework',
            type: 'discuss',
            name: 'Vote on Framework',
            config: {
              pattern: 'voting',
              providers: ['claude', 'grok', 'gemini'],
              prompt: 'Which framework should we use?\n1. React\n2. Vue\n3. Angular',
              rounds: 1,
              consensus: { method: 'voting', threshold: 0.5 },
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(true);
      const output = result.stepResults[0]?.output as Record<string, unknown>;
      expect(output.pattern).toBe('voting');
    });

    it('should execute debate pattern', async () => {
      const workflow: Workflow = {
        workflowId: 'debate-workflow',
        version: '1.0.0',
        name: 'Debate Workflow',
        steps: [
          {
            stepId: 'debate-topic',
            type: 'discuss',
            name: 'Debate Topic',
            config: {
              pattern: 'debate',
              providers: ['claude', 'grok', 'gemini'],
              prompt: 'Is microservices architecture better than monolith?',
              rounds: 2,
              roles: {
                claude: 'proponent',
                grok: 'opponent',
                gemini: 'judge',
              },
              consensus: { method: 'moderator', synthesizer: 'grok' },
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(true);
      const output = result.stepResults[0]?.output as Record<string, unknown>;
      expect(output.pattern).toBe('debate');
    });

    it('should execute critique pattern with 3 rounds', async () => {
      const workflow: Workflow = {
        workflowId: 'critique-workflow',
        version: '1.0.0',
        name: 'Critique Workflow',
        steps: [
          {
            stepId: 'critique-proposal',
            type: 'discuss',
            name: 'Critique Proposal',
            config: {
              pattern: 'critique',
              providers: ['claude', 'grok', 'gemini'],
              prompt: 'Propose a solution for handling rate limiting in distributed systems.',
              rounds: 3, // Needed for one critique-revision cycle
              consensus: { method: 'synthesis', synthesizer: 'claude' },
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(true);
      const output = result.stepResults[0]?.output as Record<string, unknown>;
      expect(output.pattern).toBe('critique');
    });
  });

  describe('Multi-Step Workflows', () => {
    it('should execute workflow with prompt and discuss steps', async () => {
      const stepExecutor = createRealStepExecutor({
        promptExecutor: createMockPromptExecutor(),
        discussionExecutor: discussionExecutorAdapter,
      });

      const workflow: Workflow = {
        workflowId: 'multi-step-workflow',
        version: '1.0.0',
        name: 'Multi-Step Workflow',
        steps: [
          {
            stepId: 'initial-analysis',
            type: 'prompt',
            name: 'Initial Analysis',
            config: {
              prompt: 'Analyze the requirements for a new API design.',
            },
          },
          {
            stepId: 'discuss-design',
            type: 'discuss',
            name: 'Discuss Design',
            config: {
              pattern: 'synthesis',
              providers: ['claude', 'grok'],
              prompt: 'Based on the requirements, what API design approach should we use?',
              context: 'Building a REST API for a e-commerce platform',
              rounds: 2,
            },
          },
        ],
      };

      const runner = new WorkflowRunner({ stepExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0]?.success).toBe(true);
      expect(result.stepResults[1]?.success).toBe(true);
    });
  });
});

// ============================================================================
// Provider Bridge Tests
// ============================================================================

describe('Provider Bridge', () => {
  describe('createSimpleProviderBridge', () => {
    it('should create a working provider bridge', async () => {
      const providers = new Map<
        string,
        (prompt: string, systemPrompt?: string) => Promise<{ content: string }>
      >();

      providers.set('test-provider', (prompt) =>
        Promise.resolve({
          content: `Response to: ${prompt}`,
        })
      );

      const bridge = createSimpleProviderBridge(providers);

      // Test execute
      const result = await bridge.execute({
        providerId: 'test-provider',
        prompt: 'Hello world',
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Hello world');

      // Test isAvailable
      expect(await bridge.isAvailable('test-provider')).toBe(true);
      expect(await bridge.isAvailable('unknown-provider')).toBe(false);

      // Test getAvailableProviders
      const available = await bridge.getAvailableProviders();
      expect(available).toContain('test-provider');
    });

    it('should handle provider errors gracefully', async () => {
      const providers = new Map<
        string,
        (prompt: string) => Promise<{ content: string }>
      >();

      providers.set('failing-provider', () =>
        Promise.reject(new Error('Provider failed'))
      );

      const bridge = createSimpleProviderBridge(providers);

      const result = await bridge.execute({
        providerId: 'failing-provider',
        prompt: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider failed');
      expect(result.retryable).toBe(true);
    });
  });
});

// ============================================================================
// Example Workflow Execution
// ============================================================================

describe('Example Workflows', () => {
  it('should execute a code review discussion workflow', async () => {
    const stubExecutor = new StubProviderExecutor(['claude', 'grok', 'gemini'], 10);
    const discussionExecutor = new DiscussionExecutor({ providerExecutor: stubExecutor });
    const adapter = createDiscussionExecutorAdapter(discussionExecutor);

    const stepExecutor = createRealStepExecutor({
      promptExecutor: createMockPromptExecutor(),
      discussionExecutor: adapter,
    });

    const codeReviewWorkflow: Workflow = {
      workflowId: 'code-review-workflow',
      version: '1.0.0',
      name: 'Multi-Model Code Review',
      description: 'Multiple AI models review code and reach consensus on improvements',
      steps: [
        {
          stepId: 'multi-model-review',
          type: 'discuss',
          name: 'Multi-Model Code Review',
          config: {
            pattern: 'critique',
            providers: ['claude', 'grok', 'gemini'],
            prompt: `Review this code and suggest improvements:

\`\`\`typescript
function processData(data: any[]) {
  let result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].active) {
      result.push(data[i].value * 2);
    }
  }
  return result;
}
\`\`\`

Focus on: type safety, performance, readability.`,
            rounds: 3,
            consensus: {
              method: 'synthesis',
              synthesizer: 'claude',
              includeDissent: true,
            },
          },
        },
      ],
    };

    const runner = new WorkflowRunner({ stepExecutor });
    const result = await runner.run(codeReviewWorkflow);

    expect(result.success).toBe(true);
    expect(result.stepResults[0]?.success).toBe(true);

    const output = result.stepResults[0]?.output as Record<string, unknown>;
    expect(output.synthesis).toBeDefined();
    expect(typeof output.synthesis).toBe('string');
  });
});
