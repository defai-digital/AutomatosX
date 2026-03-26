import { success } from '../utils/formatters.js';
import type { CLIOptions, CommandResult } from '../types.js';
import { ADVANCED_COMMANDS, RETAINED_COMMANDS, WORKFLOW_PRIMARY_USAGES } from '../command-metadata.js';
import { listWorkflowCatalog } from '../workflow-adapter.js';

export const WORKFLOW_FIRST_QUICKSTART = [
  'Bootstrap:',
  '  ax setup',
  '  ax doctor',
  '',
  'Workflow-first commands:',
  ...WORKFLOW_PRIMARY_USAGES.map((usage) => `  ${usage}`),
  '',
  'Recommended flow:',
  '  1. Run ax setup once per project.',
  '  2. Start with one of the five workflow commands above.',
  '  3. Use --dry-run to preview artifacts without runtime side effects.',
  '  4. Inspect manifest.json, summary.json, and artifact markdown in .automatosx/workflows/.',
  '',
  'Retained high-value commands:',
  '  ax doctor',
  '  ax status',
  '  ax config show',
  '  ax cleanup',
  '  ax resume <trace-id>',
  '  ax call "summarize this diff"',
  '  ax call --autonomous --intent analysis "assess release risk"',
  '  ax list',
  '  ax trace [trace-id]',
  '  ax trace analyze <trace-id>',
  '  ax trace by-session <session-id>',
  '  ax discuss "<topic>"',
  '',
  'Advanced operational commands:',
  '  ax iterate run <workflow-id>',
  '  ax ability list',
  '  ax feedback overview',
  '  ax guard list',
  '  ax agent list',
  '  ax mcp tools',
  '  ax mcp serve',
  '  ax session list',
  '  ax review analyze <paths...>',
  '  ax governance',
].join('\n');

export async function helpCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  const workflowCatalog = listWorkflowCatalog();
  const commandLines = workflowCatalog.map(
    (definition) => `- ax ${definition.commandId}: ${definition.description}`,
  );
  const retainedLines = RETAINED_COMMANDS.map(
    (definition) => `- ax ${definition.command}: ${definition.description}`,
  );
  const advancedLines = ADVANCED_COMMANDS.map(
    (definition) => `- ax ${definition.command}: ${definition.description}`,
  );

  return success(
    [
      'AutomatosX v14 Help',
      '',
      'Workflow-first default surface:',
      ...commandLines,
      '',
      'Retained high-value support commands:',
      ...retainedLines,
      '',
      'Advanced operational commands:',
      ...advancedLines,
      '',
      WORKFLOW_FIRST_QUICKSTART,
    ].join('\n'),
    {
      workflowFirst: true,
      quickstart: WORKFLOW_FIRST_QUICKSTART,
      commands: [
        ...workflowCatalog.map((definition) => ({
          command: definition.commandId,
          description: definition.description,
          stable: true,
        })),
        ...RETAINED_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: true,
        })),
        ...ADVANCED_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: true,
        })),
      ],
      workflowCatalog,
    },
  );
}
