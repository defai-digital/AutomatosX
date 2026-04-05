import { describe, expect, it } from 'vitest';
import { createWorkflowDiscussionExecutor } from '../src/runtime-workflow-discussion-executor.js';

describe('runtime workflow discussion executor', () => {
  it('passes trace id, provider, and config through to the coordinator', async () => {
    let observedRequest:
      | {
          traceId: string;
          provider?: string;
          config: {
            pattern: string;
            prompt: string;
            providers: string[];
            consensus: {
              method: string;
            };
          };
        }
      | undefined;
    const executor = createWorkflowDiscussionExecutor(
      'workflow-trace-001',
      'claude',
      {
        run: async (request) => {
          observedRequest = request;
          return {
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
            startedAt: '2026-03-27T00:00:00.000Z',
            completedAt: '2026-03-27T00:00:00.001Z',
            traceId: request.traceId,
          },
          };
        },
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
      },
    });
    expect(observedRequest).toMatchObject({
      traceId: 'workflow-trace-001',
      provider: 'claude',
      config: {
        pattern: 'quick',
        prompt: 'Compare rollout options.',
        providers: ['claude', 'openai'],
        consensus: {
          method: 'synthesis',
        },
      },
    });
  });
});
