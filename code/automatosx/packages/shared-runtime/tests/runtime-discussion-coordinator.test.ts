import { describe, expect, it } from 'vitest';
import { createDiscussionCoordinator } from '../src/runtime-discussion-coordinator.js';

describe('runtime discussion coordinator', () => {
  it('applies provider budget and round clamping before provider execution', async () => {
    const coordinator = createDiscussionCoordinator({
      maxConcurrentDiscussions: 1,
      maxProvidersPerDiscussion: 2,
      maxDiscussionRounds: 2,
      providerBridge: {
        async executePrompt(request) {
          return {
            type: 'response',
            response: {
              success: true,
              provider: request.provider,
              content: `ok:${request.provider}`,
              latencyMs: 5,
              mode: 'subprocess',
            },
          };
        },
      },
    });

    const result = await coordinator.run({
      traceId: 'discussion-budget-unit',
      config: {
        pattern: 'synthesis',
        rounds: 4,
        providers: ['claude', 'openai', 'gemini'],
        prompt: 'Compare rollout options.',
        consensus: {
          method: 'synthesis',
        },
        providerTimeout: 0,
        continueOnProviderFailure: true,
        minProviders: 2,
        temperature: 0.2,
        verbose: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.participatingProviders).toEqual(['claude', 'openai']);
    expect(result.failedProviders).toEqual(['gemini']);
    expect(result.rounds).toHaveLength(2);
    expect(result.metadata).toMatchObject({
      providerBudget: 2,
      roundsExecuted: 2,
      queueDepth: 0,
    });
  });

  it('queues concurrent runs and records queue depth metadata', async () => {
    const coordinator = createDiscussionCoordinator({
      maxConcurrentDiscussions: 1,
      maxProvidersPerDiscussion: 2,
      maxDiscussionRounds: 1,
      providerBridge: {
        async executePrompt(request) {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return {
            type: 'response',
            response: {
              success: true,
              provider: request.provider,
              content: `ok:${request.provider}`,
              latencyMs: 25,
              mode: 'subprocess',
            },
          };
        },
      },
    });

    const [first, second] = await Promise.all([
      coordinator.run({
        traceId: 'discussion-queue-unit-1',
        config: {
          pattern: 'synthesis',
          rounds: 1,
          providers: ['claude', 'openai'],
          prompt: 'Plan rollout A.',
          consensus: {
            method: 'synthesis',
          },
          providerTimeout: 0,
          continueOnProviderFailure: true,
          minProviders: 2,
          temperature: 0.2,
          verbose: false,
        },
      }),
      coordinator.run({
        traceId: 'discussion-queue-unit-2',
        config: {
          pattern: 'synthesis',
          rounds: 1,
          providers: ['claude', 'openai'],
          prompt: 'Plan rollout B.',
          consensus: {
            method: 'synthesis',
          },
          providerTimeout: 0,
          continueOnProviderFailure: true,
          minProviders: 2,
          temperature: 0.2,
          verbose: false,
        },
      }),
    ]);

    expect([first.success, second.success]).toEqual([true, true]);
    expect([first.metadata.queueDepth, second.metadata.queueDepth]).toContain(1);
  });
});
