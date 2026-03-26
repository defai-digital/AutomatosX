import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
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
          metadata: {},
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
          metadata: {},
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
    expect(traces.map((entry) => entry.status)).toEqual(['running', 'completed']);
    expect(traces[1]).toMatchObject({
      workflowId: 'prompt-workflow',
      status: 'completed',
      metadata: {
        workflowDir: tempDir,
      },
    });
  });
});
