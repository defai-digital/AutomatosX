import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { findUnexpectedFlag } from '../utils/validation.js';
import { WORKFLOW_COMMAND_DEFINITIONS } from './workflows.js';

export async function listCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createRuntime(options);

  const describeTarget = parseDescribeTarget(args);
  if (describeTarget.error !== undefined) {
    return usageError(describeTarget.error);
  }

  if (describeTarget.workflowId !== undefined) {
    const workflow = await runtime.describeWorkflow({
      workflowId: describeTarget.workflowId,
      workflowDir: options.workflowDir,
      basePath,
    });

    if (workflow === undefined) {
      return failure(`Workflow not found: ${describeTarget.workflowId}`);
    }

    const stableCommands: Set<string> = new Set(WORKFLOW_COMMAND_DEFINITIONS.map((definition) => definition.command));
    const stable = stableCommands.has(workflow.workflowId);
    const lines = [
      `Workflow: ${workflow.workflowId}`,
      `Version: ${workflow.version}`,
      `Stable surface: ${stable ? 'yes' : 'no'}`,
      `Directory: ${workflow.workflowDir}`,
      workflow.name === undefined ? undefined : `Name: ${workflow.name}`,
      workflow.description === undefined ? undefined : `Description: ${workflow.description}`,
      'Steps:',
      ...workflow.steps.map((step, index) => `- ${index + 1}. ${step.stepId} (${step.type})`),
    ].filter((line): line is string => line !== undefined);

    return success(lines.join('\n'), {
      ...workflow,
      stableSurface: stable,
    });
  }

  const workflows = await runtime.listWorkflows({
    workflowDir: options.workflowDir,
    basePath,
  });

  const stableCommands: Set<string> = new Set(WORKFLOW_COMMAND_DEFINITIONS.map((definition) => definition.command));
  const data = workflows.map((workflow) => ({
    workflowId: workflow.workflowId,
    name: workflow.name,
    version: workflow.version,
    steps: workflow.steps,
    stableSurface: stableCommands.has(workflow.workflowId),
  }));

  if (data.length === 0) {
    return success('No workflows found.', data);
  }

  const lines = [
    'Available workflows:',
    ...data.map((workflow) => (
      `- ${workflow.workflowId} (${workflow.version}, ${workflow.steps} steps${workflow.stableSurface ? ', stable' : ''})`
    )),
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
