import type { CommandResult, CLIOptions } from '../types.js';
import {
  createWorkflowRunner,
  createWorkflowLoader,
  findWorkflowDir,
  defaultStepExecutor,
} from '@defai.digital/workflow-engine';
import type { StepContext, StepResult, StepExecutor } from '@defai.digital/workflow-engine';
import type { WorkflowStep } from '@defai.digital/contracts';
import { TIMEOUT_PROVIDER_DEFAULT } from '@defai.digital/contracts';
import { getStepExecutor } from '../bootstrap.js';
import { success, failure, failureFromError, usageError } from '../utils/formatters.js';

const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

/**
 * Handles the 'run' command - executes a workflow
 */
export async function runCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const workflowId = args[0] ?? options.workflowId;

  if (workflowId === undefined) {
    return usageError('ax run <workflow-id>');
  }

  try {
    const workflowDir = options.workflowDir ?? findWorkflowDir(process.cwd());

    if (!workflowDir) {
      return failure('No workflow directory found. Create examples/workflows/ or use --workflow-dir.');
    }

    const loader = createWorkflowLoader({ workflowsDir: workflowDir });
    const workflow = await loader.load(workflowId);

    if (!workflow) {
      const available = await loader.loadAll();
      const ids = available.map(wf => wf.workflowId).slice(0, 5).join(', ');
      const more = available.length > 5 ? '...' : '';
      return failure(`Workflow "${workflowId}" not found.\n\nAvailable workflows: ${ids}${more}\nRun 'ax list' to see all workflows.`);
    }

    // Parse input JSON
    let input: Record<string, unknown> = {};
    if (options.input) {
      try {
        input = JSON.parse(options.input) as Record<string, unknown>;
      } catch {
        return failure('Invalid JSON in --input parameter');
      }
    }

    if (options.verbose) {
      console.log(`Loading workflow: ${workflow.workflowId}`);
      console.log(`  Name: ${workflow.name ?? workflowId}`);
      console.log(`  Version: ${workflow.version}`);
      console.log(`  Steps: ${workflow.steps.length}\n`);
    }

    const runner = createWorkflowRunner({
      stepExecutor: createLoggingStepExecutor(options.verbose ?? false),
      onStepStart: options.verbose
        ? (step) => console.log(`  → Starting step: ${step.stepId} (${step.type})`)
        : undefined,
      onStepComplete: options.verbose
        ? (step, result) => console.log(`  ${result.success ? '✓' : '✗'} Completed: ${step.stepId} (${result.durationMs}ms)`)
        : undefined,
    });

    if (options.verbose) {
      console.log('Executing workflow...\n');
    }

    const result = await runner.run(workflow, input);
    const duration = (result.totalDurationMs / 1000).toFixed(2);
    const stepSummary = result.stepResults.map(s => `${s.stepId}: ${s.success ? '✓' : '✗'}`).join(', ');

    const data = {
      workflowId,
      success: result.success,
      durationMs: result.totalDurationMs,
      output: result.output,
      error: result.error,
      steps: result.stepResults.map(s => ({
        stepId: s.stepId,
        success: s.success,
        durationMs: s.durationMs,
        error: s.error?.message,
      })),
    };

    if (result.success) {
      return success(`Workflow "${workflowId}" completed successfully in ${duration}s\n\nSteps: ${stepSummary}`, data);
    }
    return {
      success: false,
      message: `Workflow "${workflowId}" failed: ${result.error?.message ?? 'Unknown error'}\n\nSteps: ${stepSummary}`,
      data,
      exitCode: 1,
    };
  } catch (error) {
    return failureFromError('run workflow', error);
  }
}

/**
 * Creates a step executor that logs progress
 */
function createLoggingStepExecutor(verbose: boolean): StepExecutor {
  const baseExecutor = isTestEnv
    ? defaultStepExecutor
    : getStepExecutor({
        defaultProvider: 'claude',
        defaultTimeout: TIMEOUT_PROVIDER_DEFAULT,
        checkProviderHealth: false,
      });

  return async (step: WorkflowStep, context: StepContext): Promise<StepResult> => {
    const result = await baseExecutor(step, context);

    if (verbose && result.output) {
      const outputStr = JSON.stringify(result.output, null, 2);
      const display = outputStr.length < 500 ? outputStr.replace(/\n/g, '\n    ') : `(${outputStr.length} chars)`;
      console.log(`    Output: ${display}`);
    }

    return result;
  };
}
