import { resolve as resolvePath } from 'node:path';
import {
  createWorkflowLoader,
  type Workflow,
} from '@defai.digital/workflow-engine';
import { resolveBundledWorkflowDir } from './stable-workflow-paths.js';

export async function loadWorkflowWithBundledFallback(
  workflowId: string,
  workflowDir: string,
): Promise<{ workflow: Workflow | undefined; workflowDir: string }> {
  const primaryLoader = createWorkflowLoader({ workflowsDir: workflowDir });
  const primaryWorkflow = await primaryLoader.load(workflowId);
  if (primaryWorkflow !== undefined) {
    return {
      workflow: primaryWorkflow,
      workflowDir,
    };
  }

  const bundledWorkflowDir = resolveBundledWorkflowDir();
  if (bundledWorkflowDir === undefined || sameWorkflowDir(bundledWorkflowDir, workflowDir)) {
    return {
      workflow: undefined,
      workflowDir,
    };
  }

  const bundledLoader = createWorkflowLoader({ workflowsDir: bundledWorkflowDir });
  const bundledWorkflow = await bundledLoader.load(workflowId);
  if (bundledWorkflow === undefined) {
    return {
      workflow: undefined,
      workflowDir,
    };
  }

  return {
    workflow: bundledWorkflow,
    workflowDir: bundledWorkflowDir,
  };
}

export async function loadWorkflowsWithBundledFallback(workflowDir: string): Promise<Workflow[]> {
  const primaryLoader = createWorkflowLoader({ workflowsDir: workflowDir });
  const primaryWorkflows = await primaryLoader.loadAll();

  const bundledWorkflowDir = resolveBundledWorkflowDir();
  if (bundledWorkflowDir === undefined || sameWorkflowDir(bundledWorkflowDir, workflowDir)) {
    return primaryWorkflows;
  }

  const workflowsById = new Map(primaryWorkflows.map((workflow) => [workflow.workflowId, workflow] as const));
  const bundledLoader = createWorkflowLoader({ workflowsDir: bundledWorkflowDir });
  const bundledWorkflows = await bundledLoader.loadAll();
  for (const workflow of bundledWorkflows) {
    if (!workflowsById.has(workflow.workflowId)) {
      workflowsById.set(workflow.workflowId, workflow);
    }
  }

  return [...primaryWorkflows, ...bundledWorkflows.filter((workflow) => !primaryWorkflows.some((entry) => entry.workflowId === workflow.workflowId))];
}

function sameWorkflowDir(left: string, right: string): boolean {
  return resolvePath(left) === resolvePath(right);
}
