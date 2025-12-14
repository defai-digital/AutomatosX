import type { CommandResult, CLIOptions } from '../types.js';
import { createWorkflowRunner } from '@automatosx/workflow-engine';
import type { StepContext } from '@automatosx/workflow-engine';
import type { Workflow, WorkflowStep } from '@automatosx/contracts';

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
      message: 'Workflow ID is required. Usage: automatosx run <workflow-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    // Create workflow runner with a simple step executor
    const runner = createWorkflowRunner({
      stepExecutor: (step: WorkflowStep, context: StepContext) => {
        if (options.verbose) {
          console.log(`Executing step: ${step.stepId}`);
        }
        const startTime = Date.now();
        // Simulate step execution
        const output = { [`${step.stepId}_result`]: 'completed', ...context.input as Record<string, unknown> };
        return Promise.resolve({
          stepId: step.stepId,
          success: true,
          output,
          durationMs: Date.now() - startTime,
          retryCount: 0,
        });
      },
    });

    // Create a sample workflow for demonstration
    const workflow = createSampleWorkflow(workflowId, options.input);

    if (options.verbose) {
      console.log(`Starting workflow: ${workflow.workflowId}`);
    }

    // Execute workflow
    const result = await runner.run(workflow, {});

    return {
      success: result.success,
      message: result.success
        ? `Workflow ${workflowId} completed successfully`
        : `Workflow ${workflowId} failed: ${result.error?.message ?? 'Unknown error'}`,
      data: {
        workflowId,
        result: result.output,
        steps: result.stepResults.map((s) => s.stepId),
      },
      exitCode: result.success ? 0 : 1,
    };
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
 * Creates a sample workflow for demonstration
 */
function createSampleWorkflow(
  workflowId: string,
  inputJson: string | undefined
): Workflow {
  let input: Record<string, unknown> = {};
  if (inputJson !== undefined) {
    try {
      input = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      // Keep empty input
    }
  }

  return {
    workflowId,
    version: '1.0.0',
    name: `Workflow ${workflowId}`,
    steps: [
      {
        stepId: 'step-1',
        name: 'Initialize',
        type: 'tool',
        config: { action: 'initialize', ...input },
      },
      {
        stepId: 'step-2',
        name: 'Process',
        type: 'tool',
        config: { action: 'process' },
      },
      {
        stepId: 'step-3',
        name: 'Finalize',
        type: 'tool',
        config: { action: 'finalize' },
      },
    ],
  };
}
