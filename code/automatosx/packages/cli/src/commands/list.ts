import { formatWorkflowInputSummary } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { WORKFLOW_COMMAND_NAMES } from '../command-metadata.js';
import { createRuntime, failure, resolveCliBasePath, success, usageError } from '../utils/formatters.js';
import { findUnexpectedFlag } from '../utils/validation.js';
import {
  getWorkflowCatalogEntry,
  listWorkflowCatalog,
} from '../workflow-adapter.js';
import { isBundledWorkflowDir, resolveEffectiveWorkflowDir } from '../workflow-paths.js';

export async function listCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const basePath = resolveCliBasePath(options);
  const runtime = createRuntime(options);
  const workflowDir = resolveEffectiveWorkflowDir({
    workflowDir: options.workflowDir,
    basePath,
  });

  const describeTarget = parseDescribeTarget(args);
  if (describeTarget.error !== undefined) {
    return usageError(describeTarget.error);
  }

  if (describeTarget.workflowId !== undefined) {
    const catalogEntry = getWorkflowCatalogEntry(describeTarget.workflowId);
    const workflow = workflowDir === undefined
      ? undefined
      : await runtime.describeWorkflow({
        workflowId: describeTarget.workflowId,
        workflowDir,
        basePath,
      });

    if (workflow === undefined && catalogEntry === undefined) {
      return failure(`Workflow not found: ${describeTarget.workflowId}`);
    }

    const stableCommands: Set<string> = new Set(WORKFLOW_COMMAND_NAMES);
    const workflowId = workflow?.workflowId ?? catalogEntry?.workflowId ?? describeTarget.workflowId;
    const stable = stableCommands.has(workflowId);
    const resolvedCatalogEntry = catalogEntry ?? (stable ? getWorkflowCatalogEntry(workflowId) : undefined);
    const lines = [
      `Workflow: ${workflowId}`,
      `Version: ${resolvedCatalogEntry?.version ?? workflow?.version ?? 'unknown'}`,
      `Stable surface: ${stable ? 'yes' : 'no'}`,
      workflow?.workflowDir === undefined ? undefined : `Directory: ${workflow.workflowDir}`,
      resolvedCatalogEntry?.workflowName === undefined ? workflow?.name === undefined ? undefined : `Name: ${workflow.name}` : `Name: ${resolvedCatalogEntry.workflowName}`,
      resolvedCatalogEntry?.description === undefined ? workflow?.description === undefined ? undefined : `Description: ${workflow.description}` : `Description: ${resolvedCatalogEntry.description}`,
      resolvedCatalogEntry?.agentId === undefined ? undefined : `Owner agent: ${resolvedCatalogEntry.agentId}`,
      resolvedCatalogEntry === undefined ? undefined : `Required inputs: ${formatWorkflowInputSummary(resolvedCatalogEntry.requiredInputs, resolvedCatalogEntry.requiredInputMode)}`,
      resolvedCatalogEntry === undefined || resolvedCatalogEntry.optionalInputs.length === 0
        ? undefined
        : `Optional inputs: ${resolvedCatalogEntry.optionalInputs.join(', ')}`,
      resolvedCatalogEntry === undefined ? undefined : 'When to use:',
      ...(resolvedCatalogEntry?.whenToUse.map((value) => `- ${value}`) ?? []),
      resolvedCatalogEntry === undefined || resolvedCatalogEntry.avoidWhen.length === 0 ? undefined : 'Avoid when:',
      ...(resolvedCatalogEntry?.avoidWhen.map((value) => `- ${value}`) ?? []),
      resolvedCatalogEntry === undefined ? undefined : `Artifacts: ${resolvedCatalogEntry.artifactNames.join(', ')}`,
      resolvedCatalogEntry === undefined ? undefined : 'Stages:',
      ...(resolvedCatalogEntry?.stages.map((stage, index) => `- ${index + 1}. ${stage}`) ?? []),
      workflow === undefined ? undefined : 'Steps:',
      ...(workflow?.steps.map((step, index) => `- ${index + 1}. ${step.stepId} (${step.type})`) ?? []),
      resolvedCatalogEntry === undefined ? undefined : 'Examples:',
      ...(resolvedCatalogEntry?.examples.map((example) => `- ${example}`) ?? []),
    ].filter((line): line is string => line !== undefined);

    return success(lines.join('\n'), {
      ...(workflow ?? {}),
      workflowId,
      steps: workflow?.steps ?? [],
      stableSurface: stable,
      catalog: resolvedCatalogEntry,
      workflowDir: workflow?.workflowDir ?? workflowDir,
    });
  }

  const stableCatalog = listWorkflowCatalog();
  const workflows = workflowDir === undefined
    ? []
    : await runtime.listWorkflows({
      workflowDir,
      basePath,
    });

  const stableCommands: Set<string> = new Set(WORKFLOW_COMMAND_NAMES);
  const discoveredMap = new Map(workflows.map((workflow) => [workflow.workflowId, workflow] as const));
  const stableData = stableCatalog.map((workflow) => {
    const discovered = discoveredMap.get(workflow.workflowId);
    return {
      workflowId: workflow.workflowId,
      name: workflow.workflowName,
      version: workflow.version,
      steps: discovered?.steps ?? workflow.stages.length,
      stableSurface: true,
      description: workflow.description,
      agentId: workflow.agentId,
      source: discovered === undefined
        ? (isBundledWorkflowDir(workflowDir) ? 'bundled-catalog' : 'stable-surface')
        : (isBundledWorkflowDir(workflowDir) ? 'bundled-definition' : 'workspace-definition'),
    };
  });
  const customData = workflows
    .filter((workflow) => !stableCommands.has(workflow.workflowId))
    .map((workflow) => ({
      workflowId: workflow.workflowId,
      name: workflow.name,
      version: workflow.version,
      steps: workflow.steps,
      stableSurface: false,
      description: undefined,
      source: isBundledWorkflowDir(workflowDir) ? 'bundled-definition' : 'workspace-definition',
    }));
  const data = [...stableData, ...customData];

  if (data.length === 0) {
    return success('No workflows found.', data);
  }

  const lines = [
    'Available workflows:',
    ...stableData.map((workflow) => (
      `- ${workflow.workflowId} (${workflow.version}, ${workflow.steps} steps, stable, owner ${(workflow.agentId ?? 'unknown')}) — ${workflow.description ?? 'No description.'}`
    )),
    ...(customData.length === 0
      ? []
      : [
        '',
        `Additional ${isBundledWorkflowDir(workflowDir) ? 'bundled' : 'workspace'} workflows:`,
        ...customData.map((workflow) => (
          `- ${workflow.workflowId} (${workflow.version}, ${workflow.steps} steps)${workflow.description === undefined ? '' : ` — ${workflow.description}`}`
        )),
      ]),
  ];

  return success(lines.join('\n'), data);
}
function parseDescribeTarget(args: string[]): { workflowId?: string; error?: string } {
  if (args.length === 0) {
    return {};
  }

  const unexpectedFlag = findUnexpectedFlag(args);
  if (unexpectedFlag !== undefined) {
    return { error: `Unknown list flag: ${unexpectedFlag}.` };
  }

  if (args[0] === 'describe') {
    const workflowId = args[1];
    if (workflowId === undefined || workflowId.length === 0) {
      return { error: 'Usage: ax list describe <workflow-id>' };
    }
    if (args[2] !== undefined) {
      return { error: 'Usage: ax list describe <workflow-id>' };
    }
    return { workflowId };
  }

  if (args[0] !== undefined && args[0].length > 0) {
    if (args[1] !== undefined) {
      return { error: 'Usage: ax list [workflow-id]' };
    }
    return { workflowId: args[0] };
  }

  return {};
}
