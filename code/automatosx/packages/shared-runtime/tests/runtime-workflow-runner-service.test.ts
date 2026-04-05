import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { computeWorkflowHash } from '@defai.digital/workflow-engine';
import { createRuntimeWorkflowRunnerService } from '../src/runtime-workflow-runner-service.js';

const SHARED_RUNTIME_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createTempDir(): string {
  const dir = join(SHARED_RUNTIME_PACKAGE_ROOT, '.tmp', `runtime-workflow-runner-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('runtime workflow runner service', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('records missing workflows as failed traces', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const traces: Array<Record<string, unknown>> = [];

    const service = createRuntimeWorkflowRunnerService({
      basePath: tempDir,
      traceStore: {
        upsertTrace: async (trace: unknown) => {
          traces.push(trace as Record<string, unknown>);
          return trace;
        },
      } as never,
      stateStore: {
        getSession: async () => undefined,
        createSession: async (session: unknown) => session,
      } as never,
      resolveProviderBridge: () => ({
        executePrompt: async () => ({
          type: 'unavailable',
          error: 'unused',
        }),
      }),
      resolveDiscussionCoordinator: () => ({
        run: async () => ({
          success: true,
          pattern: 'quick',
          topic: 'unused',
          participatingProviders: [],
          failedProviders: [],
          rounds: [],
          synthesis: '',
          consensus: {
            method: 'synthesis',
          },
          totalDurationMs: 0,
          metadata: {
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(0).toISOString(),
          },
        }),
      }),
      resolveWorkflowDir: (workflowDir, requestBasePath, defaultBasePath) => workflowDir ?? requestBasePath ?? defaultBasePath,
      resolveGuardPolicies: async () => [],
      tokenize: (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      createTraceId: () => 'workflow-missing-001',
      runAgent: async () => {
        throw new Error('runAgent should not be called');
      },
    });

    const result = await service.runWorkflow({
      workflowId: 'missing-workflow',
      workflowDir: tempDir,
      surface: 'cli',
    });

    expect(result).toMatchObject({
      traceId: 'workflow-missing-001',
      workflowId: 'missing-workflow',
      success: false,
      error: {
        code: 'WORKFLOW_NOT_FOUND',
      },
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      workflowId: 'missing-workflow',
      status: 'failed',
    });
  });

  it('runs a simple prompt workflow and persists running/completed trace states', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const traces: Array<Record<string, unknown>> = [];

    await writeFile(
      join(tempDir, 'prompt-workflow.json'),
      `${JSON.stringify({
        workflowId: 'prompt-workflow',
        name: 'Prompt Workflow',
        version: '1.0.0',
        steps: [
          {
            stepId: 'summarize',
            type: 'prompt',
            config: {
              prompt: 'Summarize the release risk.',
            },
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const service = createRuntimeWorkflowRunnerService({
      basePath: tempDir,
      traceStore: {
        upsertTrace: async (trace: unknown) => {
          traces.push(trace as Record<string, unknown>);
          return trace;
        },
      } as never,
      stateStore: {
        getSession: async () => undefined,
        createSession: async (session: unknown) => session,
      } as never,
      resolveProviderBridge: () => ({
        executePrompt: async (request) => ({
          type: 'response',
          response: {
            success: true,
            provider: request.provider,
            model: request.model,
            content: `REAL:${request.prompt}`,
            latencyMs: 9,
            mode: 'subprocess',
          },
        }),
      }),
      resolveDiscussionCoordinator: () => ({
        run: async () => ({
          success: true,
          pattern: 'quick',
          topic: 'unused',
          participatingProviders: [],
          failedProviders: [],
          rounds: [],
          synthesis: '',
          consensus: {
            method: 'synthesis',
          },
          totalDurationMs: 0,
          metadata: {
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(0).toISOString(),
          },
        }),
      }),
      resolveWorkflowDir: (workflowDir, requestBasePath, defaultBasePath) => workflowDir ?? requestBasePath ?? defaultBasePath,
      resolveGuardPolicies: async () => [],
      tokenize: (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      createTraceId: () => 'workflow-run-001',
      runAgent: async () => {
        throw new Error('runAgent should not be called');
      },
    });

    const result = await service.runWorkflow({
      workflowId: 'prompt-workflow',
      workflowDir: tempDir,
      surface: 'cli',
      provider: 'claude',
    });

    expect(result).toMatchObject({
      traceId: 'workflow-run-001',
      workflowId: 'prompt-workflow',
      success: true,
      workflowDir: tempDir,
    });
    expect(result.stepResults).toHaveLength(1);
    // running → running (incremental checkpoint) → completed
    expect(traces.map((entry) => entry.status)).toEqual(['running', 'running', 'completed']);
    expect(traces[1]).toMatchObject({
      status: 'running',
      checkpoint: {
        lastCompletedStepIndex: 0,
        lastCompletedStepId: 'summarize',
      },
    });
    expect(traces[traces.length - 1]).toMatchObject({
      workflowId: 'prompt-workflow',
      status: 'completed',
      checkpoint: {
        lastCompletedStepIndex: 0,
        lastCompletedStepId: 'summarize',
      },
      metadata: {
        workflowDir: tempDir,
      },
    });
  });

  it('resumes a multi-step workflow from checkpoint, skipping cached steps', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const traces: Array<Record<string, unknown>> = [];
    const executedPrompts: string[] = [];

    const workflowDef = {
      workflowId: 'multi-step',
      name: 'Multi Step',
      version: '1.0.0',
      steps: [
        { stepId: 'step-a', type: 'prompt', config: { prompt: 'First.' } },
        { stepId: 'step-b', type: 'prompt', config: { prompt: 'Second.' } },
        { stepId: 'step-c', type: 'prompt', config: { prompt: 'Third.' } },
      ],
    };

    await writeFile(
      join(tempDir, 'multi-step.json'),
      `${JSON.stringify(workflowDef, null, 2)}\n`,
      'utf8',
    );

    const workflowHash = computeWorkflowHash(workflowDef);

    const service = createRuntimeWorkflowRunnerService({
      basePath: tempDir,
      traceStore: {
        upsertTrace: async (trace: unknown) => {
          traces.push(trace as Record<string, unknown>);
          return trace;
        },
      } as never,
      stateStore: {
        getSession: async () => undefined,
        createSession: async (session: unknown) => session,
      } as never,
      resolveProviderBridge: () => ({
        executePrompt: async (request) => {
          executedPrompts.push(request.prompt as string);
          return {
            type: 'response',
            response: {
              success: true,
              provider: request.provider,
              model: request.model,
              content: `EXEC:${request.prompt}`,
              latencyMs: 5,
              mode: 'subprocess',
            },
          };
        },
      }),
      resolveDiscussionCoordinator: () => ({
        run: async () => ({
          success: true,
          pattern: 'quick',
          topic: 'unused',
          participatingProviders: [],
          failedProviders: [],
          rounds: [],
          synthesis: '',
          consensus: { method: 'synthesis' },
          totalDurationMs: 0,
          metadata: { startedAt: new Date(0).toISOString(), completedAt: new Date(0).toISOString() },
        }),
      }),
      resolveWorkflowDir: (workflowDir, requestBasePath, defaultBasePath) => workflowDir ?? requestBasePath ?? defaultBasePath,
      resolveGuardPolicies: async () => [],
      tokenize: (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      createTraceId: () => 'workflow-resume-001',
      runAgent: async () => {
        throw new Error('runAgent should not be called');
      },
    });

    const result = await service.runWorkflow({
      workflowId: 'multi-step',
      workflowDir: tempDir,
      surface: 'cli',
      provider: 'claude',
      resumeFromStepIndex: 1,
      priorStepOutputs: { 'step-a': 'cached-a', 'step-b': 'cached-b' },
      checkpointWorkflowHash: workflowHash,
    });

    expect(result).toMatchObject({
      traceId: 'workflow-resume-001',
      workflowId: 'multi-step',
      success: true,
    });
    expect(result.stepResults).toHaveLength(3);
    // Steps 0 and 1 should be cached (durationMs: 0)
    expect(result.stepResults[0]?.durationMs).toBe(0);
    expect(result.stepResults[0]?.output).toBe('cached-a');
    expect(result.stepResults[1]?.durationMs).toBe(0);
    expect(result.stepResults[1]?.output).toBe('cached-b');
    // Only the third prompt should have been executed via the provider
    expect(executedPrompts).toHaveLength(1);
    expect(executedPrompts[0]).toContain('Third.');
    // Final trace should have checkpoint and completed status
    const finalTrace = traces[traces.length - 1] as Record<string, unknown>;
    expect(finalTrace.status).toBe('completed');
    expect(finalTrace.checkpoint).toMatchObject({
      lastCompletedStepIndex: 2,
      lastCompletedStepId: 'step-c',
    });
  });

  it('fails resume when workflow hash drifts from the stored checkpoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const traces: Array<Record<string, unknown>> = [];

    await writeFile(
      join(tempDir, 'drifted-workflow.json'),
      `${JSON.stringify({
        workflowId: 'drifted-workflow',
        name: 'Drifted Workflow',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step-one',
            type: 'prompt',
            config: {
              prompt: 'Step one.',
            },
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const service = createRuntimeWorkflowRunnerService({
      basePath: tempDir,
      traceStore: {
        upsertTrace: async (trace: unknown) => {
          traces.push(trace as Record<string, unknown>);
          return trace;
        },
      } as never,
      stateStore: {
        getSession: async () => undefined,
        createSession: async (session: unknown) => session,
      } as never,
      resolveProviderBridge: () => ({
        executePrompt: async () => ({
          type: 'response',
          response: {
            success: true,
            provider: 'claude',
            model: 'test-model',
            content: 'unused',
            latencyMs: 1,
            mode: 'subprocess',
          },
        }),
      }),
      resolveDiscussionCoordinator: () => ({
        run: async () => ({
          success: true,
          pattern: 'quick',
          topic: 'unused',
          participatingProviders: [],
          failedProviders: [],
          rounds: [],
          synthesis: '',
          consensus: {
            method: 'synthesis',
          },
          totalDurationMs: 0,
          metadata: {
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(0).toISOString(),
          },
        }),
      }),
      resolveWorkflowDir: (workflowDir, requestBasePath, defaultBasePath) => workflowDir ?? requestBasePath ?? defaultBasePath,
      resolveGuardPolicies: async () => [],
      tokenize: (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      createTraceId: () => 'workflow-drift-001',
      runAgent: async () => {
        throw new Error('runAgent should not be called');
      },
    });

    const result = await service.runWorkflow({
      workflowId: 'drifted-workflow',
      workflowDir: tempDir,
      surface: 'cli',
      checkpointWorkflowHash: 'deadbeefcafebabe',
      resumeFromStepIndex: 0,
      priorStepOutputs: {
        'step-one': { content: 'cached' },
      },
    });

    expect(result).toMatchObject({
      traceId: 'workflow-drift-001',
      workflowId: 'drifted-workflow',
      success: false,
      error: {
        code: 'CHECKPOINT_WORKFLOW_HASH_MISMATCH',
      },
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      traceId: 'workflow-drift-001',
      workflowId: 'drifted-workflow',
      status: 'failed',
      error: {
        code: 'CHECKPOINT_WORKFLOW_HASH_MISMATCH',
      },
    });
  });
});
