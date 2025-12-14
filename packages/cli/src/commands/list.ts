import type { CommandResult, CLIOptions } from '../types.js';

/**
 * Workflow info for listing
 */
interface WorkflowInfo {
  id: string;
  name: string;
  version: string;
  stepCount: number;
  status: 'active' | 'inactive' | 'draft';
}

/**
 * Handles the 'list' command - lists available workflows
 */
export async function listCommand(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  try {
    // Get workflows (in a real implementation, this would read from a store)
    const workflows = await getAvailableWorkflows(options.workflowDir);

    if (workflows.length === 0) {
      return {
        success: true,
        message: 'No workflows found.',
        data: [],
        exitCode: 0,
      };
    }

    // Apply limit if specified
    const limited = options.limit !== undefined
      ? workflows.slice(0, options.limit)
      : workflows;

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: limited,
        exitCode: 0,
      };
    }

    // Format as text table
    const header = 'ID                   | Name                 | Version | Steps | Status';
    const separator = '-'.repeat(header.length);
    const rows = limited.map((w) =>
      `${w.id.padEnd(20)} | ${w.name.padEnd(20)} | ${w.version.padEnd(7)} | ${String(w.stepCount).padEnd(5)} | ${w.status}`
    );

    return {
      success: true,
      message: [header, separator, ...rows].join('\n'),
      data: limited,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Gets available workflows from the workflow directory
 * In a real implementation, this would read from filesystem or database
 */
function getAvailableWorkflows(
  _workflowDir: string | undefined
): Promise<WorkflowInfo[]> {
  // Return sample workflows for demonstration
  return Promise.resolve([
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      version: '1.0.0',
      stepCount: 5,
      status: 'active',
    },
    {
      id: 'code-review',
      name: 'Code Review',
      version: '2.1.0',
      stepCount: 3,
      status: 'active',
    },
    {
      id: 'deploy-staging',
      name: 'Deploy to Staging',
      version: '1.2.0',
      stepCount: 7,
      status: 'active',
    },
    {
      id: 'test-suite',
      name: 'Test Suite',
      version: '1.0.0',
      stepCount: 4,
      status: 'draft',
    },
  ]);
}
