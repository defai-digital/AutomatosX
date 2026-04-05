import { formatWorkflowInputSummary } from '@defai.digital/shared-runtime/catalog';
import { getCommandMetadata, hasCommandMetadata, resolveCommandAlias } from './command-metadata.js';
import { getCommandManifestEntry } from './command-manifest.js';
import { getWorkflowCatalogEntry } from './workflow-adapter.js';

export function formatCommandHelp(command: string): string {
  const canonicalCommand = resolveCommandAlias(command);
  const entry = getCommandManifestEntry(command);
  if (entry === undefined) {
    return 'Command help is not available.';
  }
  const metadata = getCommandMetadata(command);

  const workflow = getWorkflowCatalogEntry(canonicalCommand);
  const aliasNote = canonicalCommand === command
    ? []
    : [
        '',
        `Legacy alias: ax ${command}`,
        `Canonical command: ax ${canonicalCommand}`,
      ];
  if (workflow !== undefined) {
    return [
      `AutomatosX v14 Help: ${canonicalCommand}`,
      '',
      workflow.description,
      '',
      `Owner agent: ${workflow.agentId}`,
      `Required inputs: ${formatWorkflowInputSummary(workflow.requiredInputs, workflow.requiredInputMode)}`,
      workflow.optionalInputs.length === 0 ? undefined : `Optional inputs: ${workflow.optionalInputs.join(', ')}`,
      `Artifacts: ${workflow.artifactNames.join(', ')}`,
      '',
      'Use this when:',
      ...workflow.whenToUse.map((value) => `  - ${value}`),
      ...(workflow.avoidWhen.length === 0
        ? []
        : [
          '',
          'Avoid this when:',
          ...workflow.avoidWhen.map((value) => `  - ${value}`),
        ]),
      '',
      'Usage:',
      ...entry.usage.map((usage) => `  ${usage}`),
      ...aliasNote,
      '',
      'Examples:',
      ...workflow.examples.map((example) => `  ${example}`),
    ].filter((line): line is string => line !== undefined).join('\n');
  }

  return [
    `AutomatosX v14 Help: ${canonicalCommand}`,
    '',
    entry.description,
    '',
    metadata === undefined ? undefined : `Tier: ${metadata.productTier}`,
    metadata === undefined ? undefined : '',
    'Usage:',
    ...entry.usage.map((usage) => `  ${usage}`),
    ...aliasNote,
  ].filter((line): line is string => line !== undefined).join('\n');
}

export function getCommandHelp(command: string): string | undefined {
  return hasCommandMetadata(command) ? formatCommandHelp(command) : undefined;
}
