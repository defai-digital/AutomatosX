import { describe, expect, it } from 'vitest';
import { createWorkflowDiscussionExecutor } from '../src/runtime-workflow-discussion-executor.js';

describe('runtime workflow discussion executor', () => {
  it('passes trace id, provider, and config through to the coordinator', async () => {
    const executor = createWorkflowDiscussionExecutor(
      'workflow-trace-001',
      'claude',
      {
        run: async (request) => ({
          success: true,
          pattern: request.config.pattern,
          topic: request.config.prompt,
          participatingProviders: request.config.providers,
          failedProviders: [],
          rounds: [],
          synthesis: 'done',
          consensus: {
            method: request.config.consensus.method,
          },
          totalDurationMs: 1,
          metadata: {
            traceId: request.traceId,
            provider: request.provider,
          },
        }),
      },
    );

    await expect(executor.execute({
      pattern: 'quick',
      rounds: 1,
      providers: ['claude', 'openai'],
      prompt: 'Compare rollout options.',
      consensus: {
        method: 'synthesis',
      },
      providerTimeout: 0,
      continueOnProviderFailure: true,
      minProviders: 1,
      temperature: 0.2,
      verbose: false,
    })).resolves.toMatchObject({
      success: true,
      pattern: 'quick',
      topic: 'Compare rollout options.',
      participatingProviders: ['claude', 'openai'],
      metadata: {
        traceId: 'workflow-trace-001',
        provider: 'claude',
      },
    });
  });
});
