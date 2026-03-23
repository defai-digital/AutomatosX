import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandResult, CLIOptions } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseOptionalJsonInput } from '../utils/validation.js';

interface WorkflowStepSummary {
  stepId: string;
  success: boolean;
  durationMs: number;
  retryCount: number;
  error?: {
    message?: string;
  };
}

interface WorkflowExecutionSummary {
  traceId: string;
  workflowDir: string;
  success: boolean;
  totalDurationMs?: number;
  output?: unknown;
  error?: {
    code?: string;
    message?: string;
    failedStepId?: string;
  };
  stepResults: WorkflowStepSummary[];
}

export async function runCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const workflowId = args[0] ?? options.workflowId;

  if (workflowId === undefined) {
    return usageError('ax run <workflow-id>');
  }

  const workflowDir = options.workflowDir ?? resolveWorkflowDir();
  if (workflowDir === undefined) {
    return failure('No workflow directory found. Create workflows/ or .automatosx/workflows/.');
  }

  const workflowInputParse = parseOptionalJsonInput(options.input);
  if (workflowInputParse.error !== undefined) {
    return failure(`Invalid JSON in --input parameter: ${workflowInputParse.error}`);
  }

  const basePath = options.outputDir ?? process.cwd();
  const runtime = createRuntime(options);

  try {
    const execution = await runtime.runWorkflow({
      workflowId,
      traceId: options.traceId,
      workflowDir,
      basePath,
      provider: options.provider,
      sessionId: options.sessionId,
      model: 'v14-runtime-bridge',
      input: buildWorkflowInput(workflowId, args, options, workflowInputParse.value ?? {}),
      surface: 'cli',
    });

    if (!execution.success && execution.error?.code === 'WORKFLOW_NOT_FOUND') {
      const available = await listWorkflowIds(runtime, workflowDir, basePath);
      const availableText = available.length === 0 ? '' : `\n\nAvailable workflows: ${available.slice(0, 5).join(', ')}${available.length > 5 ? '...' : ''}`;
      return failure(`Workflow "${workflowId}" not found.${availableText}`, {
        traceId: execution.traceId,
        workflowId,
        workflowDir,
      });
    }

    const stepSummary = formatStepSummary(execution);
    const data = {
      traceId: execution.traceId,
      workflowId,
      workflowDir: execution.workflowDir,
      durationMs: execution.totalDurationMs,
      output: execution.output,
      error: execution.error,
      steps: execution.stepResults.map((stepResult) => ({
        stepId: stepResult.stepId,
        success: stepResult.success,
        durationMs: stepResult.durationMs,
        retryCount: stepResult.retryCount,
        error: stepResult.error?.message,
      })),
    };

    if (execution.success) {
      return success(`Workflow "${workflowId}" completed successfully.${stepSummary}`, data);
    }

    return failure(`Workflow "${workflowId}" failed: ${execution.error?.message ?? 'Unknown error'}.${stepSummary}`, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Failed to run workflow "${workflowId}": ${message}`);
  }
}

function buildWorkflowInput(
  workflowId: string,
  args: string[],
  options: CLIOptions,
  workflowInput: Record<string, unknown>,
): Record<string, unknown> {
  const parsedInput = workflowInput;
  const commandTask = parsedInput.task ?? options.task;
  const positionalArgs = args.slice(1).filter((value) => value.length > 0);

  return {
    workflowId,
    task: commandTask,
    positionalArgs,
    rawArgs: args,
    provider: options.provider,
    ...parsedInput,
    outputDir: options.outputDir,
    verbose: options.verbose,
    quiet: options.quiet,
  };
}

function formatStepSummary(execution: WorkflowExecutionSummary): string {
  if (execution.stepResults.length === 0) {
    return '';
  }

  const stepValues = execution.stepResults.map((step) => `${step.stepId} (${step.success ? '✓' : '✗'})`);
  return `\n\nSteps: ${stepValues.join(', ')}`;
}

async function listWorkflowIds(
  runtime: ReturnType<typeof createRuntime>,
  workflowDir: string,
  basePath: string,
): Promise<string[]> {
  try {
    const workflows = await runtime.listWorkflows({ workflowDir, basePath });
    return workflows.map((workflow) => workflow.workflowId);
  } catch {
    return [];
  }
}

function resolveWorkflowDir(): string | undefined {
  const candidateDirs = ['workflows', '.automatosx/workflows', 'examples/workflows'];
  for (const dir of candidateDirs) {
    const candidate = join(process.cwd(), dir);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
