import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { buildMonitorState } from '../src/commands/monitor-state.js';
import { createCliTestTempDir } from './support/test-paths.js';

function createTempDir(): string {
  return createCliTestTempDir('monitor-state');
}

describe('monitor state governance aggregate', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('uses recent failed traces when building governance aggregates', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'monitor-failed-001',
      workflowId: 'workflow-skill-trust',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-25T00:00:00.000Z',
      completedAt: '2026-03-25T00:00:05.000Z',
      stepResults: [],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        message: 'Runtime governance blocked workflow execution.',
      },
      metadata: {
        guardSummary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        guardBlockedByRuntimeGovernance: true,
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
      },
    });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'monitor-success-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-25T00:00:10.000Z',
      completedAt: '2026-03-25T00:00:12.000Z',
      stepResults: [],
      metadata: {},
    });

    const state = await buildMonitorState(
      runtime,
      async () => ({
        source: 'unavailable',
        detectedProviders: [],
        enabledProviders: [],
        installedButDisabledProviders: [],
      }),
      tempDir,
      undefined,
      1,
    );

    expect(state.governance).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'monitor-failed-001',
      },
    });
  });
});
