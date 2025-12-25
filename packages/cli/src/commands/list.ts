import type { CommandResult, CLIOptions } from '../types.js';
import { createWorkflowLoader, findWorkflowDir } from '@defai.digital/workflow-engine';
import * as path from 'node:path';

/**
 * Handles the 'list' command - lists available workflows
 */
export async function listCommand(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  try {
    // Find workflow directory
    const workflowDir = options.workflowDir ?? findWorkflowDir(process.cwd());

    if (!workflowDir) {
      return {
        success: true,
        message: 'No workflow directory found. Create examples/workflows/ or use --workflow-dir.',
        data: [],
        exitCode: 0,
      };
    }

    // Load workflows from directory
    const loader = createWorkflowLoader({ workflowsDir: workflowDir });
    const workflows = await loader.listAll();

    if (workflows.length === 0) {
      return {
        success: true,
        message: `No workflows found in ${workflowDir}`,
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
    const header = 'ID                           | Name                           | Version | Steps | Status';
    const separator = '-'.repeat(header.length);
    const rows = limited.map((w) =>
      `${w.id.padEnd(28)} | ${(w.name ?? w.id).substring(0, 30).padEnd(30)} | ${w.version.padEnd(7)} | ${String(w.stepCount).padEnd(5)} | ${w.status}`
    );

    const footer = `\n${workflows.length} workflow(s) found in ${path.basename(workflowDir)}/`;

    return {
      success: true,
      message: [header, separator, ...rows, footer].join('\n'),
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
