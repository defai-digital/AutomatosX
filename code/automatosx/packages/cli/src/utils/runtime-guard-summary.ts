import {
  createRuntimeBridgeService,
  type BridgeLoadSuccess,
} from '@defai.digital/shared-runtime/bridge';
import {
  buildDeniedImportedSkillAggregate as buildDeniedImportedSkillAggregateShared,
  buildRuntimeGovernanceAggregate as buildRuntimeGovernanceAggregateShared,
  evaluateBridgeExecutionTrust,
  extractRuntimeTraceGuardSummary,
  type DeniedImportedSkillAggregate,
  type DeniedImportedSkillAggregateEntry,
  type RuntimeGovernanceAggregate,
  type RuntimeGovernanceAggregateEntry,
  type RuntimeGovernanceTraceLike,
  type RuntimeTraceGuardSummary,
} from '@defai.digital/shared-runtime/governance';

export type RuntimeGuardSummary = RuntimeTraceGuardSummary;
export type {
  DeniedImportedSkillAggregate,
  DeniedImportedSkillAggregateEntry,
  RuntimeGovernanceAggregate,
  RuntimeGovernanceAggregateEntry,
  RuntimeGovernanceTraceLike,
};

export interface DeniedInstalledBridgeAggregateEntry {
  bridgeId: string;
  relativePath: string;
  installedAt?: string;
  summary: string;
  trustState: string;
  approvalMode?: string;
  sourceRef?: string;
}

export interface DeniedInstalledBridgeAggregate {
  deniedCount: number;
  latest?: DeniedInstalledBridgeAggregateEntry;
}

export interface CliGovernanceSnapshot {
  governance: RuntimeGovernanceAggregate;
  deniedInstalledBridges: DeniedInstalledBridgeAggregate;
}

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
  return formatDeniedInventorySummaryLines(
    aggregate,
    (latest) => `${latest.skillId} ${latest.trustState} ${latest.relativePath}`,
    prefix,
  );
}

export const buildRuntimeGovernanceAggregate = buildRuntimeGovernanceAggregateShared;
export const buildDeniedImportedSkillAggregate = buildDeniedImportedSkillAggregateShared;

export function createEmptyCliGovernanceSnapshot(): CliGovernanceSnapshot {
  return {
    governance: buildRuntimeGovernanceAggregate([]),
    deniedInstalledBridges: {
      deniedCount: 0,
    },
  };
}

export async function buildCliGovernanceSnapshot(
  basePath: string,
  recentFailedTraces: RuntimeGovernanceTraceLike[],
): Promise<CliGovernanceSnapshot> {
  const [deniedImportedSkills, deniedInstalledBridges] = await Promise.all([
    buildDeniedImportedSkillAggregate(basePath),
    buildDeniedInstalledBridgeAggregate(basePath),
  ]);

  return {
    governance: buildRuntimeGovernanceAggregate(recentFailedTraces, {
      deniedImportedSkills,
    }),
    deniedInstalledBridges,
  };
}

export function hasCliGovernanceWarnings(snapshot: CliGovernanceSnapshot): boolean {
  return snapshot.governance.blockedCount > 0
    || snapshot.governance.deniedImportedSkills.deniedCount > 0
    || snapshot.deniedInstalledBridges.deniedCount > 0;
}

export async function buildDeniedInstalledBridgeAggregate(basePath: string): Promise<DeniedInstalledBridgeAggregate> {
  const discovered = await createRuntimeBridgeService({ basePath }).discoverBridgeDefinitions();
  const denied: DeniedInstalledBridgeAggregateEntry[] = [];

  for (const entry of discovered) {
    if (!entry.success || !isInstalledBridge(entry)) {
      continue;
    }

    const trust = await evaluateBridgeExecutionTrust(basePath, entry.definition);
    if (trust.allowed) {
      continue;
    }

    denied.push({
      bridgeId: entry.definition.bridgeId,
      relativePath: entry.relativePath,
      installedAt: entry.definition.provenance?.importedAt,
      summary: [
        `Installed bridge "${entry.definition.bridgeId}" is currently denied (${trust.state}).`,
        trust.reason,
      ].join(' '),
      trustState: trust.state,
      approvalMode: trust.approvalMode,
      sourceRef: trust.sourceRef ?? entry.definition.provenance?.ref,
    });
  }

  denied.sort((left, right) => compareTimestampsDescending(left.installedAt, right.installedAt));

  return {
    deniedCount: denied.length,
    latest: denied[0],
  };
}

export function formatDeniedInstalledBridgeSummaryLines(
  aggregate: DeniedInstalledBridgeAggregate,
  prefix = '  governance:',
): string[] {
  return formatDeniedInventorySummaryLines(
    aggregate,
    (latest) => `${latest.bridgeId} ${latest.trustState} ${latest.relativePath}`,
    prefix,
  );
}

export function formatRuntimeGovernanceLatestLines(
  latest: RuntimeGovernanceAggregate['latest'],
): string[] {
  if (latest === undefined) {
    return ['- none'];
  }

  const lines = [
    `- ${latest.traceId}${latest.workflowId === undefined ? '' : ` ${latest.workflowId}`}`,
    `  governance: ${latest.summary}`,
  ];
  if (latest.toolName !== undefined) {
    lines.push(`  tool: ${latest.toolName}`);
  }
  if (latest.trustState !== undefined) {
    lines.push(`  trust: ${latest.trustState}`);
  }
  if (latest.requiredTrustStates !== undefined && latest.requiredTrustStates.length > 0) {
    lines.push(`  requires: ${latest.requiredTrustStates.join(', ')}`);
  }
  if (latest.sourceRef !== undefined) {
    lines.push(`  source: ${latest.sourceRef}`);
  }
  return lines;
}

export function formatCliGovernanceWarningSummary(
  snapshot: CliGovernanceSnapshot,
  maxLength = 140,
): string | undefined {
  const parts: string[] = [];

  if (snapshot.governance.blockedCount > 0) {
    parts.push(
      `Recent runtime-governance blocks detected (${snapshot.governance.blockedCount} trace${snapshot.governance.blockedCount === 1 ? '' : 's'}). Latest: ${snapshot.governance.latest?.traceId}: ${truncate(snapshot.governance.latest?.summary ?? 'Unknown runtime governance block.', maxLength)}`,
    );
  }

  const deniedImportedSkills = snapshot.governance.deniedImportedSkills;
  if (deniedImportedSkills.deniedCount > 0) {
    parts.push(
      `Denied imported skills detected (${deniedImportedSkills.deniedCount} skill${deniedImportedSkills.deniedCount === 1 ? '' : 's'}). Latest: ${deniedImportedSkills.latest?.skillId}: ${truncate(deniedImportedSkills.latest?.summary ?? 'Unknown denied imported skill.', maxLength)}`,
    );
  }

  const deniedInstalledBridges = snapshot.deniedInstalledBridges;
  if (deniedInstalledBridges.deniedCount > 0) {
    parts.push(
      `Denied installed bridges detected (${deniedInstalledBridges.deniedCount} bridge${deniedInstalledBridges.deniedCount === 1 ? '' : 's'}). Latest: ${deniedInstalledBridges.latest?.bridgeId}: ${truncate(deniedInstalledBridges.latest?.summary ?? 'Unknown denied installed bridge.', maxLength)}`,
    );
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function formatDeniedInventorySummaryLines<T extends { summary: string; sourceRef?: string }>(
  aggregate: { deniedCount: number; latest?: T },
  formatHeadline: (latest: T) => string,
  prefix: string,
): string[] {
  if (aggregate.deniedCount === 0 || aggregate.latest === undefined) {
    return ['- none'];
  }

  const latest = aggregate.latest;
  const lines = [
    `- ${formatHeadline(latest)}`,
    `${prefix} ${latest.summary}`,
  ];
  if (latest.sourceRef !== undefined) {
    lines.push(`  source: ${latest.sourceRef}`);
  }
  return lines;
}

function isInstalledBridge(entry: BridgeLoadSuccess): boolean {
  return entry.definition.provenance?.importer === 'ax.bridge.install';
}

function compareTimestampsDescending(left: string | undefined, right: string | undefined): number {
  const leftValue = left === undefined ? 0 : Date.parse(left);
  const rightValue = right === undefined ? 0 : Date.parse(right);
  const safeLeft = Number.isFinite(leftValue) ? leftValue : 0;
  const safeRight = Number.isFinite(rightValue) ? rightValue : 0;
  return safeRight - safeLeft;
}
