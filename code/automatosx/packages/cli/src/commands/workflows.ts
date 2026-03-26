import { failure, success } from '../utils/formatters.js';
import {
  WORKFLOW_COMMAND_METADATA,
  getWorkflowCommandMetadata,
} from '../command-metadata.js';
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

export const WORKFLOW_COMMAND_HANDLERS: Readonly<Record<WorkflowCommandId, CommandHandler>> = {
  ship: async (args, options) => executeWorkflowCommand('ship', args, options),
  architect: async (args, options) => executeWorkflowCommand('architect', args, options),
  audit: async (args, options) => executeWorkflowCommand('audit', args, options),
  qa: async (args, options) => executeWorkflowCommand('qa', args, options),
  release: async (args, options) => executeWorkflowCommand('release', args, options),
};

export const shipCommand = WORKFLOW_COMMAND_HANDLERS.ship;
export const architectCommand = WORKFLOW_COMMAND_HANDLERS.architect;
export const auditCommand = WORKFLOW_COMMAND_HANDLERS.audit;
export const qaCommand = WORKFLOW_COMMAND_HANDLERS.qa;
export const releaseCommand = WORKFLOW_COMMAND_HANDLERS.release;

export const WORKFLOW_COMMAND_DEFINITIONS: readonly WorkflowCommandDefinition[] = [
  ...WORKFLOW_COMMAND_METADATA.map((definition) => ({
    command: definition.command as WorkflowCommandId,
    description: definition.description,
    handler: getWorkflowCommandHandler(definition.command as WorkflowCommandId),
    stable: definition.stable,
  })),
] as const;

export function getWorkflowCommandDefinition(command: string): WorkflowCommandDefinition | undefined {
  const metadata = getWorkflowCommandMetadata(command);
  if (metadata === undefined) {
    return undefined;
  }

  return {
    command: metadata.command as WorkflowCommandId,
    description: metadata.description,
    handler: getWorkflowCommandHandler(metadata.command as WorkflowCommandId),
    stable: metadata.stable,
  };
}

function applyGlobalWorkflowOptions(
  workflowInput: Parameters<typeof validateWorkflowInput>[0],
  options: CLIOptions,
): void {
  if (options.provider !== undefined) {
    workflowInput.options.provider = options.provider;
  }
  if (options.sessionId !== undefined) {
    workflowInput.options.sessionId = options.sessionId;
  }
  if (options.outputDir !== undefined) {
    workflowInput.options.outputDir = options.outputDir;
  }
  if (options.basePath !== undefined) {
    workflowInput.options.basePath = options.basePath;
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

function getWorkflowCommandHandler(command: WorkflowCommandId): CommandHandler {
  return WORKFLOW_COMMAND_HANDLERS[command];
}
