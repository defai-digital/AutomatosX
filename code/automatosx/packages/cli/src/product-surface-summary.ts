import {
  ADVANCED_SUPPORT_COMMANDS,
  DEFAULT_ENTRY_PATH_COMMANDS,
  STABLE_SUPPORT_COMMANDS,
  WORKFLOW_PRIMARY_USAGES,
} from './command-metadata.js';

export interface ProductSurfaceSummaryData {
  defaultEntryPaths: readonly string[];
  workflowCommands: readonly string[];
  stableSupportCommands: readonly string[];
  advancedCommands: readonly string[];
}

export function getProductSurfaceSummaryData(): ProductSurfaceSummaryData {
  return {
    defaultEntryPaths: DEFAULT_ENTRY_PATH_COMMANDS,
    workflowCommands: WORKFLOW_PRIMARY_USAGES,
    stableSupportCommands: STABLE_SUPPORT_COMMANDS,
    advancedCommands: ADVANCED_SUPPORT_COMMANDS,
  };
}

export function stripAxPrefix(usage: string): string {
  return usage.replace(/^ax\s+/, '');
}

export function formatSurfaceSection(
  title: string,
  usages: readonly string[],
  options: {
    bullet?: boolean;
    indent?: string;
    stripPrefix?: boolean;
    limit?: number;
    ellipsis?: string;
  } = {},
): string[] {
  const {
    bullet = false,
    indent = '',
    stripPrefix = false,
    limit,
    ellipsis = ', ...',
  } = options;
  const values = usages.map((usage) => (stripPrefix ? stripAxPrefix(usage) : usage));

  if (limit !== undefined) {
    const limited = values.slice(0, limit);
    const summary = limited.join(', ');
    return [`${indent}${title}: ${values.length > limit ? `${summary}${ellipsis}` : summary}`];
  }

  return [
    `${indent}${title}:`,
    ...values.map((usage) => `${indent}${bullet ? '- ' : ''}${usage}`),
  ];
}
