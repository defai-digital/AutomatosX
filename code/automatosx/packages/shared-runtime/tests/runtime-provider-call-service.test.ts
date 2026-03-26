import { describe, expect, it } from 'vitest';
import { createRuntimeProviderCallService } from '../src/runtime-provider-call-service.js';

describe('runtime provider call service', () => {
  it('records subprocess provider responses as completed traces', async () => {
    const traces: Array<Record<string, unknown>> = [];
    const createdSessions: Array<Record<string, unknown>> = [];
    const service = createRuntimeProviderCallService({
      basePath: '/tmp/runtime-call',
      traceStore: {
        upsertTrace: async (trace) => {
          traces.push(trace as Record<string, unknown>);
          return trace;
        },
      } as never,
      stateStore: {
        getSession: async () => undefined,
        createSession: async (session) => {
          createdSessions.push(session as Record<string, unknown>);
          return session;
        },
      } as never,
      resolveProviderBridge: () => ({
        executePrompt: async (request) => ({
          type: 'response',
          response: {
            success: true,
            provider: request.provider,
            model: 'mock-model',
            content: `REAL:${request.prompt}`,
            latencyMs: 12,
            mode: 'subprocess',
          },
        }),
      }),
      tokenize: (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      createTraceId: () => 'generated-call-trace',
    });

    const result = await service.callProvider({
      prompt: 'summarize rollout',
      provider: 'claude',
      sessionId: 'call-session-001',
      surface: 'cli',
    });

    expect(result).toMatchObject({
      traceId: 'generated-call-trace',
      success: true,
      executionMode: 'subprocess',
      content: 'REAL:summarize rollout',
    });
    expect(createdSessions).toHaveLength(1);
    expect(traces.map((entry) => entry.status)).toEqual(['running', 'completed']);
    expect(traces[1]).toMatchObject({
      workflowId: 'call',
      output: {
        executionMode: 'subprocess',
      },
    });
  });

  it('falls back to simulated output when no provider executor is configured', async () => {
    const traces: Array<Record<string, unknown>> = [];
    const service = createRuntimeProviderCallService({
      basePath: '/tmp/runtime-call',
      traceStore: {
        upsertTrace: async (trace) => {
          traces.push(trace as Record<string, unknown>);
          return trace;
        },
      } as never,
      stateStore: {
        getSession: async () => undefined,
        createSession: async (session) => session,
      } as never,
      resolveProviderBridge: () => ({
        executePrompt: async () => ({
          type: 'unavailable',
          error: 'missing executor',
        }),
      }),
      tokenize: (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      createTraceId: () => 'generated-call-trace',
    });

    const result = await service.callProvider({
      prompt: 'summarize rollout',
      systemPrompt: 'You are concise.',
      surface: 'cli',
    });

    expect(result).toMatchObject({
      traceId: 'generated-call-trace',
      success: true,
      executionMode: 'simulated',
      provider: 'claude',
    });
    expect(result.content).toContain('System: You are concise.');
    expect(result.content).toContain('Prompt: summarize rollout');
    expect(traces[1]).toMatchObject({
      status: 'completed',
      output: {
        executionMode: 'simulated',
      },
    });
  });
});
