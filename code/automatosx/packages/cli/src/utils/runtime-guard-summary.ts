import {
  buildDeniedImportedSkillAggregate as buildDeniedImportedSkillAggregateShared,
  buildRuntimeGovernanceAggregate as buildRuntimeGovernanceAggregateShared,
  extractRuntimeTraceGuardSummary,
  type DeniedImportedSkillAggregate,
  type DeniedImportedSkillAggregateEntry,
  type RuntimeGovernanceAggregate,
  type RuntimeGovernanceAggregateEntry,
  type RuntimeGovernanceTraceLike,
  type RuntimeTraceGuardSummary,
} from '@defai.digital/shared-runtime';

export type RuntimeGuardSummary = RuntimeTraceGuardSummary;
export type {
  DeniedImportedSkillAggregate,
  DeniedImportedSkillAggregateEntry,
  RuntimeGovernanceAggregate,
  RuntimeGovernanceAggregateEntry,
  RuntimeGovernanceTraceLike,
};

export function extractRuntimeGuardSummary(metadata: unknown): RuntimeGuardSummary | undefined {
  return extractRuntimeTraceGuardSummary(metadata);
}

export function formatRuntimeGuardSummaryLine(
  metadata: unknown,
  prefix = 'Guard:',
  maxLength = 120,
): string | undefined {
  const guard = extractRuntimeGuardSummary(metadata);
  if (guard === undefined) {
    return undefined;
  }

  const compact = truncate(guard.summary, maxLength);
  return `${prefix} ${compact}`;
}

export function formatRuntimeGuardSummaryDetails(
  guard: RuntimeGuardSummary | undefined,
  prefix = 'Guard',
): string[] {
  if (guard === undefined) {
    return [];
  }

  const lines = [`${prefix}: ${guard.summary}`];
  if (guard.toolName !== undefined) {
    lines.push(`${prefix} tool: ${guard.toolName}`);
  }
  if (guard.trustState !== undefined) {
    lines.push(`${prefix} trust: ${guard.trustState}`);
  }
  if (guard.requiredTrustStates !== undefined && guard.requiredTrustStates.length > 0) {
    lines.push(`${prefix} requires: ${guard.requiredTrustStates.join(', ')}`);
  }
  if (guard.sourceRef !== undefined) {
    lines.push(`${prefix} source: ${guard.sourceRef}`);
  }
  return lines;
}

export function formatDeniedImportedSkillSummaryLines(
  aggregate: DeniedImportedSkillAggregate,
  prefix = '  governance:',
): string[] {
  if (aggregate.deniedCount === 0 || aggregate.latest === undefined) {
    return ['- none'];
  }

  const latest = aggregate.latest;
  const lines = [
    `- ${latest.skillId} ${latest.trustState} ${latest.relativePath}`,
    `${prefix} ${latest.summary}`,
  ];
  if (latest.sourceRef !== undefined) {
    lines.push(`  source: ${latest.sourceRef}`);
  }
  return lines;
}

export const buildRuntimeGovernanceAggregate = buildRuntimeGovernanceAggregateShared;
export const buildDeniedImportedSkillAggregate = buildDeniedImportedSkillAggregateShared;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}
