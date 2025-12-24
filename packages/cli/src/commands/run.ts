import type { CommandResult, CLIOptions } from '../types.js';
import {
  createWorkflowRunner,
  createWorkflowLoader,
  findWorkflowDir,
  defaultStepExecutor,
} from '@automatosx/workflow-engine';
import type { StepContext, StepResult, StepExecutor } from '@automatosx/workflow-engine';
import type { WorkflowStep } from '@automatosx/contracts';
import { getStepExecutor } from '../bootstrap.js';

// Check if we're in test environment
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
    return {
      success: false,
      message: 'Workflow ID is required. Usage: ax run <workflow-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    // Find workflow directory
    const workflowDir = options.workflowDir ?? findWorkflowDir(process.cwd());

    if (!workflowDir) {
      return {
        success: false,
        message: 'No workflow directory found. Create examples/workflows/ or use --workflow-dir.',
        data: undefined,
        exitCode: 1,
      };
    }

    // Load workflow from file
    const loader = createWorkflowLoader({ workflowsDir: workflowDir });
    const workflow = await loader.load(workflowId);

    if (!workflow) {
      // Try to list available workflows for help
      const available = await loader.loadAll();
      const ids = available.map(w => w.workflowId).slice(0, 5).join(', ');
      return {
        success: false,
        message: `Workflow "${workflowId}" not found.\n\nAvailable workflows: ${ids}${available.length > 5 ? '...' : ''}\nRun 'ax list' to see all workflows.`,
        data: undefined,
        exitCode: 1,
      };
    }

    // Parse input JSON if provided
    let input: Record<string, unknown> = {};
    if (options.input) {
      try {
        input = JSON.parse(options.input) as Record<string, unknown>;
      } catch {
        return {
          success: false,
          message: 'Invalid JSON in --input parameter',
          data: undefined,
          exitCode: 1,
        };
      }
    }

    if (options.verbose) {
      console.log(`Loading workflow: ${workflow.workflowId}`);
      console.log(`  Name: ${workflow.name ?? workflowId}`);
      console.log(`  Version: ${workflow.version}`);
      console.log(`  Steps: ${workflow.steps.length}`);
      console.log('');
    }

    // Create workflow runner with step execution logging
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

    // Execute workflow
    const result = await runner.run(workflow, input);

    // Format result message
    const duration = (result.totalDurationMs / 1000).toFixed(2);
    const stepSummary = result.stepResults.map(s => `${s.stepId}: ${s.success ? '✓' : '✗'}`).join(', ');

    if (result.success) {
      return {
        success: true,
        message: `Workflow "${workflowId}" completed successfully in ${duration}s\n\nSteps: ${stepSummary}`,
        data: {
          workflowId,
          success: true,
          durationMs: result.totalDurationMs,
          output: result.output,
          steps: result.stepResults.map((s) => ({
            stepId: s.stepId,
            success: s.success,
            durationMs: s.durationMs,
          })),
        },
        exitCode: 0,
      };
    } else {
      return {
        success: false,
        message: `Workflow "${workflowId}" failed: ${result.error?.message ?? 'Unknown error'}\n\nSteps: ${stepSummary}`,
        data: {
          workflowId,
          success: false,
          error: result.error,
          steps: result.stepResults.map((s) => ({
            stepId: s.stepId,
            success: s.success,
            error: s.error?.message,
          })),
        },
        exitCode: 1,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to run workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Creates a step executor that logs progress
 * Uses the production step executor for real LLM calls in production,
 * or the default placeholder executor in test environments.
 */
function createLoggingStepExecutor(verbose: boolean): StepExecutor {
  // Use placeholder executor in test environment to avoid real LLM calls
  const baseExecutor = isTestEnv
    ? defaultStepExecutor
    : getStepExecutor({
        defaultProvider: 'claude',
        defaultTimeout: 120000,
        checkProviderHealth: false,
      });

  return async (step: WorkflowStep, context: StepContext): Promise<StepResult> => {
    // Execute step (real LLM in prod, placeholder in tests)
    const result = await baseExecutor(step, context);

    // In verbose mode, show step details
    if (verbose && result.output) {
      const outputStr = JSON.stringify(result.output, null, 2);
      if (outputStr.length < 500) {
        console.log(`    Output: ${outputStr.replace(/\n/g, '\n    ')}`);
      } else {
        console.log(`    Output: (${outputStr.length} chars)`);
      }
    }

    return result;
  };
}
