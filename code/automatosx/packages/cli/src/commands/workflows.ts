import { failure, success } from '../utils/formatters.js';
import type { CLIOptions, CommandHandler, CommandResult } from '../types.js';
import {
  buildWorkflowInput,
  dispatch,
  parseWorkflowCommandInput,
  type WorkflowCommandId,
  validateWorkflowInput,
} from '../workflow-adapter.js';

export interface WorkflowCommandDefinition {
  command: WorkflowCommandId;
  description: string;
  handler: CommandHandler;
  stable: boolean;
}

async function executeWorkflowCommand(
  commandId: WorkflowCommandId,
  args: string[],
  options: CLIOptions,
): Promise<CommandResult> {
  const workflowInput = parseWorkflowCommandInput(commandId, args, options.provider);
  applyGlobalWorkflowOptions(workflowInput, options);

  const validation = validateWorkflowInput(workflowInput);
  if (validation !== null) {
    return failure(`Invalid workflow command input: ${validation}`);
  }

  const result = await dispatch(workflowInput);
  if (!result.success) {
    return failure(
      `Workflow ${commandId} failed${result.errorMessage !== undefined ? `: ${result.errorMessage}` : ''}`,
      result,
    );
  }

  if (workflowInput.options.dryRun) {
    return success(
      `Dry-run completed for ${commandId}. Trace: ${result.traceId}. Output dir: ${result.outputDir}`,
      {
        ...result,
        workflow: buildWorkflowInput(workflowInput),
      },
    );
  }

  return success(`Workflow ${commandId} dispatched with trace ${result.traceId}.`, {
    ...result,
    workflow: buildWorkflowInput(workflowInput),
  });
}

export async function shipCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  return executeWorkflowCommand('ship', _args, _options);
}

export async function architectCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  return executeWorkflowCommand('architect', _args, _options);
}

export async function auditCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  return executeWorkflowCommand('audit', _args, _options);
}

export async function qaCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  return executeWorkflowCommand('qa', _args, _options);
}

export async function releaseCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  return executeWorkflowCommand('release', _args, _options);
}

export const WORKFLOW_COMMAND_DEFINITIONS: readonly WorkflowCommandDefinition[] = [
  {
    command: 'ship',
    description: 'Prepare a change for ship readiness using the shared workflow runtime.',
    handler: shipCommand,
    stable: true,
  },
  {
    command: 'architect',
    description: 'Turn a requirement into an implementation-ready architecture proposal.',
    handler: architectCommand,
    stable: true,
  },
  {
    command: 'audit',
    description: 'Run the audit workflow through the shared workflow runtime.',
    handler: auditCommand,
    stable: true,
  },
  {
    command: 'qa',
    description: 'Run the QA workflow through the shared workflow runtime.',
    handler: qaCommand,
    stable: true,
  },
  {
    command: 'release',
    description: 'Run the release workflow through the shared workflow runtime.',
    handler: releaseCommand,
    stable: true,
  },
] as const;

export function getWorkflowCommandDefinition(command: string): WorkflowCommandDefinition | undefined {
  return WORKFLOW_COMMAND_DEFINITIONS.find((definition) => definition.command === command);
}

function applyGlobalWorkflowOptions(
  workflowInput: Parameters<typeof validateWorkflowInput>[0],
  options: CLIOptions,
): void {
  if (options.provider !== undefined) {
    workflowInput.options.provider = options.provider;
  }
  if (options.outputDir !== undefined) {
    workflowInput.options.outputDir = options.outputDir;
  }
  if (options.dryRun !== undefined) {
    workflowInput.options.dryRun = options.dryRun;
  }
  if (options.verbose !== undefined) {
    workflowInput.options.verbose = options.verbose;
  }
  if (options.quiet !== undefined) {
    workflowInput.options.quiet = options.quiet;
  }
  if (options.traceId !== undefined) {
    workflowInput.traceContext = { parentTraceId: options.traceId };
  }
}
