import { success } from '../utils/formatters.js';
import type { CLIOptions, CommandResult } from '../types.js';
import {
  ADVANCED_COMMANDS,
  EXPERIMENTAL_COMMANDS,
  RETAINED_COMMANDS,
} from '../command-metadata.js';
import { formatSurfaceSection, getProductSurfaceSummaryData } from '../product-surface-summary.js';
import { listWorkflowCatalog } from '../workflow-adapter.js';

const PRODUCT_SURFACE = getProductSurfaceSummaryData();

export const WORKFLOW_FIRST_QUICKSTART = [
  'Bootstrap:',
  '  ax setup',
  '  ax doctor',
  '',
  'Workflow-first commands:',
  ...PRODUCT_SURFACE.workflowCommands.map((usage) => `  ${usage}`),
  '',
  'Recommended flow:',
  '  1. Run ax setup once per project.',
  '  2. Start with one of the five workflow commands above.',
  '  3. Use --dry-run to preview artifacts without runtime side effects.',
  '  4. Inspect manifest.json, summary.json, and artifact markdown in .automatosx/workflows/.',
  '',
  ...formatSurfaceSection('Stable support commands', PRODUCT_SURFACE.stableSupportCommands, { indent: '  ' }),
  '',
  ...formatSurfaceSection('Advanced commands', PRODUCT_SURFACE.advancedCommands, { indent: '  ' }),
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
  const experimentalLines = EXPERIMENTAL_COMMANDS.map(
    (definition) => `- ax ${definition.command}: ${definition.description}`,
  );

  return success(
    [
      'AutomatosX v14 Help',
      '',
      'Workflow-first default surface:',
      ...commandLines,
      '',
      'Stable support commands:',
      ...retainedLines,
      '',
      'Advanced commands:',
      ...advancedLines,
      ...(experimentalLines.length === 0
        ? []
        : [
          '',
          'Experimental commands:',
          ...experimentalLines,
        ]),
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
          productTier: 'stable',
        })),
        ...RETAINED_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: true,
          productTier: definition.productTier,
        })),
        ...ADVANCED_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: false,
          productTier: definition.productTier,
        })),
        ...EXPERIMENTAL_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: false,
          productTier: definition.productTier,
        })),
      ],
      workflowCatalog,
    },
  );
}
