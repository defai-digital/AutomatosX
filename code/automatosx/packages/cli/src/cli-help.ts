import { formatWorkflowInputSummary } from '@defai.digital/shared-runtime/catalog';
import { hasCommandMetadata } from './command-metadata.js';
import { getCommandManifestEntry } from './command-manifest.js';
import { getWorkflowCatalogEntry } from './workflow-adapter.js';

export function formatCommandHelp(command: string): string {
  const entry = getCommandManifestEntry(command);
  if (entry === undefined) {
    return 'Command help is not available.';
  }

  const workflow = getWorkflowCatalogEntry(command);
  if (workflow !== undefined) {
    return [
      `AutomatosX v14 Help: ${command}`,
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
      '',
      'Examples:',
      ...workflow.examples.map((example) => `  ${example}`),
    ].filter((line): line is string => line !== undefined).join('\n');
  }

  return [
    `AutomatosX v14 Help: ${command}`,
    '',
    entry.description,
    '',
    'Usage:',
    ...entry.usage.map((usage) => `  ${usage}`),
  ].join('\n');
}

export function getCommandHelp(command: string): string | undefined {
  return hasCommandMetadata(command) ? formatCommandHelp(command) : undefined;
}
