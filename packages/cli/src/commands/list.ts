import type { CommandResult, CLIOptions } from '../types.js';
import { createWorkflowLoader, findWorkflowDir } from '@defai.digital/workflow-engine';
import { success, successJson, failureFromError, formatList } from '../utils/formatters.js';
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
      return success('No workflow directory found. Create examples/workflows/ or use --workflow-dir.', []);
    }

    // Load workflows from directory
    const loader = createWorkflowLoader({ workflowsDir: workflowDir });
    const workflows = await loader.listAll();

    if (workflows.length === 0) {
      return success(`No workflows found in ${workflowDir}`, []);
    }

    // Apply limit if specified
    const limited = options.limit !== undefined
      ? workflows.slice(0, options.limit)
      : workflows;

    if (options.format === 'json') {
      return successJson(limited);
    }

    // Format as text table
    const table = formatList(limited, [
      { header: 'ID', width: 28, getValue: w => w.id },
      { header: 'Name', width: 30, getValue: w => w.name ?? w.id },
      { header: 'Version', width: 7, getValue: w => w.version },
      { header: 'Steps', width: 5, getValue: w => String(w.stepCount) },
      { header: 'Status', width: 10, getValue: w => w.status },
    ]);

    const footer = `\n${workflows.length} workflow(s) found in ${path.basename(workflowDir)}/`;
    return success(table + footer, limited);
  } catch (error) {
    return failureFromError('list workflows', error);
  }
}
