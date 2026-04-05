import { describe, expect, it } from 'vitest';
import type { SessionEntry, StateStore } from '@defai.digital/state-store';
import type { TraceRecord } from '@defai.digital/trace-store';
import { createRuntimeProviderCallService } from '../src/runtime-provider-call-service.js';

describe('runtime provider call service', () => {
  it('records subprocess provider responses as completed traces', async () => {
    const traces: TraceRecord[] = [];
    const createdSessions: SessionEntry[] = [];
    const traceStore = {
      upsertTrace: async (trace: TraceRecord) => {
        traces.push(trace);
        return trace;
      },
    };
    const stateStore: Pick<StateStore, 'getSession' | 'createSession'> = {
      getSession: async () => undefined,
      createSession: async (entry) => {
        const now = '2026-03-27T00:00:00.000Z';
        const session: SessionEntry = {
          sessionId: entry.sessionId ?? 'generated-session',
          task: entry.task,
          initiator: entry.initiator,
          status: 'active',
          workspace: entry.workspace,
          metadata: entry.metadata,
          participants: [],
          createdAt: now,
          updatedAt: now,
        };
        createdSessions.push(session);
        return session;
      },
    };
    const service = createRuntimeProviderCallService({
      basePath: '/tmp/runtime-call',
      traceStore: traceStore as never,
      stateStore: stateStore as StateStore,
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
    const traces: TraceRecord[] = [];
    const traceStore = {
      upsertTrace: async (trace: TraceRecord) => {
        traces.push(trace);
        return trace;
      },
    };
    const stateStore: Pick<StateStore, 'getSession' | 'createSession'> = {
      getSession: async () => undefined,
      createSession: async (entry) => ({
        sessionId: entry.sessionId ?? 'generated-session',
        task: entry.task,
        initiator: entry.initiator,
        status: 'active',
        workspace: entry.workspace,
        metadata: entry.metadata,
        participants: [],
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
      }),
    };
    const service = createRuntimeProviderCallService({
      basePath: '/tmp/runtime-call',
      traceStore: traceStore as never,
      stateStore: stateStore as StateStore,
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
