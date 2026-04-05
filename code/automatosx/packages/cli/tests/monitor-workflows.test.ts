import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { loadMonitorWorkflowDetail, loadMonitorWorkflows } from '../src/commands/monitor-workflows.js';
import { resolveBundledWorkflowDir } from '../src/workflow-paths.js';
import { createCliTestTempDir } from './support/test-paths.js';

describe('monitor workflows', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('surfaces stable catalog workflows even when no workflow directory is provided', async () => {
    const tempDir = createCliTestTempDir('monitor-workflows');
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const workflows = await loadMonitorWorkflows(runtime, tempDir, undefined);
    const shipWorkflow = workflows.find((workflow) => workflow.workflowId === 'ship');

    expect(shipWorkflow).toMatchObject({
      workflowId: 'ship',
      stableSurface: true,
      source: 'stable-catalog',
    });
  });

  it('prefers bundled workflow definitions when they are available', async () => {
    const tempDir = createCliTestTempDir('monitor-workflows');
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const bundledWorkflowDir = resolveBundledWorkflowDir();
    const workflows = await loadMonitorWorkflows(runtime, tempDir, bundledWorkflowDir);
    const shipWorkflow = workflows.find((workflow) => workflow.workflowId === 'ship');

    expect(shipWorkflow).toMatchObject({
      workflowId: 'ship',
      stableSurface: true,
      source: 'bundled-definition',
    });

    const detail = await loadMonitorWorkflowDetail(runtime, 'ship', tempDir, bundledWorkflowDir, workflows);

    expect(detail).toMatchObject({
      workflowId: 'ship',
      stableSurface: true,
      source: 'bundled-definition',
    });
    expect(detail?.stepDefinitions?.length ?? 0).toBeGreaterThan(0);
  });
});
