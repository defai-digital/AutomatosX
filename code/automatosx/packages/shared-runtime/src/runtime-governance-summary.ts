import {
  discoverSkillDefinitions,
  type SkillLoadSuccess,
} from './bridge-runtime-service.js';
import { evaluateSkillExecutionTrust } from './bridge-governance.js';
import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const RuntimeTraceGuardSummarySchema = z.object({
  summary: nonEmptyStringSchema,
  guardId: nonEmptyStringSchema.optional(),
  failedGates: z.array(nonEmptyStringSchema).default([]),
  failedGateMessages: z.array(nonEmptyStringSchema).default([]),
  blockedByRuntimeGovernance: z.boolean(),
  toolName: nonEmptyStringSchema.optional(),
  trustState: nonEmptyStringSchema.optional(),
  requiredTrustStates: z.array(nonEmptyStringSchema).optional(),
  sourceRef: nonEmptyStringSchema.optional(),
});

export const RuntimeGovernanceAggregateEntrySchema = RuntimeTraceGuardSummarySchema.extend({
  traceId: nonEmptyStringSchema,
  workflowId: nonEmptyStringSchema.optional(),
  startedAt: nonEmptyStringSchema.optional(),
});

export const DeniedImportedSkillAggregateEntrySchema = z.object({
  skillId: nonEmptyStringSchema,
  relativePath: nonEmptyStringSchema,
  importedAt: nonEmptyStringSchema.optional(),
  summary: nonEmptyStringSchema,
  trustState: nonEmptyStringSchema,
  approvalMode: nonEmptyStringSchema.optional(),
  sourceRef: nonEmptyStringSchema.optional(),
});

export const DeniedImportedSkillAggregateSchema = z.object({
  deniedCount: z.number().int().nonnegative(),
  latest: DeniedImportedSkillAggregateEntrySchema.optional(),
});

export const RuntimeGovernanceAggregateSchema = z.object({
  blockedCount: z.number().int().nonnegative(),
  latest: RuntimeGovernanceAggregateEntrySchema.optional(),
  deniedImportedSkills: DeniedImportedSkillAggregateSchema,
});

export type RuntimeTraceGuardSummary = z.infer<typeof RuntimeTraceGuardSummarySchema>;
export type RuntimeGovernanceAggregateEntry = z.infer<typeof RuntimeGovernanceAggregateEntrySchema>;
export type DeniedImportedSkillAggregateEntry = z.infer<typeof DeniedImportedSkillAggregateEntrySchema>;
export type DeniedImportedSkillAggregate = z.infer<typeof DeniedImportedSkillAggregateSchema>;
export type RuntimeGovernanceAggregate = z.infer<typeof RuntimeGovernanceAggregateSchema>;

export interface RuntimeGovernanceTraceLike {
  traceId: string;
  workflowId?: string;
  startedAt?: string;
  metadata?: unknown;
}

export function extractRuntimeTraceGuardSummary(metadata: unknown): RuntimeTraceGuardSummary | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }

  const summary = asOptionalString(metadata.guardSummary);
  if (summary === undefined) {
    return undefined;
  }

  return RuntimeTraceGuardSummarySchema.parse({
    summary,
    guardId: asOptionalString(metadata.guardId),
    failedGates: asStringArray(metadata.guardFailedGates),
    failedGateMessages: asStringArray(metadata.guardFailedGateMessages),
    blockedByRuntimeGovernance: metadata.guardBlockedByRuntimeGovernance === true,
    toolName: asOptionalString(metadata.guardToolName),
    trustState: asOptionalString(metadata.guardTrustState),
    requiredTrustStates: asOptionalStringArray(metadata.guardRequiredTrustStates),
    sourceRef: asOptionalString(metadata.guardSourceRef),
  });
}

export function buildRuntimeGovernanceAggregate(
  traces: RuntimeGovernanceTraceLike[],
  options?: {
    deniedImportedSkills?: DeniedImportedSkillAggregate;
  },
): RuntimeGovernanceAggregate {
  const blocked: RuntimeGovernanceAggregateEntry[] = [];
  for (const trace of traces) {
    const guard = extractRuntimeTraceGuardSummary(trace.metadata);
    if (guard?.blockedByRuntimeGovernance !== true) {
      continue;
    }
    blocked.push({
      traceId: trace.traceId,
      workflowId: trace.workflowId,
      startedAt: trace.startedAt,
      ...guard,
    });
  }
  blocked.sort((left, right) => compareStartedAtDescending(left.startedAt, right.startedAt));

  return RuntimeGovernanceAggregateSchema.parse({
    blockedCount: blocked.length,
    latest: blocked[0],
    deniedImportedSkills: options?.deniedImportedSkills ?? {
      deniedCount: 0,
    },
  });
}

export async function buildDeniedImportedSkillAggregate(basePath: string): Promise<DeniedImportedSkillAggregate> {
  const discovered = await discoverSkillDefinitions(basePath);
  const denied: DeniedImportedSkillAggregateEntry[] = [];

  for (const entry of discovered) {
    if (!entry.success || !isImportedSkill(entry)) {
      continue;
    }

    const trust = await evaluateSkillExecutionTrust(basePath, entry.definition);
    if (trust.allowed) {
      continue;
    }

    denied.push({
      skillId: entry.definition.skillId,
      relativePath: entry.relativePath,
      importedAt: entry.definition.provenance?.importedAt,
      summary: [
        `Imported skill "${entry.definition.skillId}" is currently denied (${trust.state}).`,
        trust.reason,
      ].join(' '),
      trustState: trust.state,
      approvalMode: trust.approvalMode,
      sourceRef: trust.sourceRef ?? entry.definition.provenance?.ref,
    });
  }

  denied.sort((left, right) => compareStartedAtDescending(left.importedAt, right.importedAt));

  return DeniedImportedSkillAggregateSchema.parse({
    deniedCount: denied.length,
    latest: denied[0],
  });
}

function isImportedSkill(entry: SkillLoadSuccess): boolean {
  return entry.definition.provenance?.importer === 'ax.skill.import';
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  const values = asStringArray(value);
  return values.length > 0 ? values : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareStartedAtDescending(left: string | undefined, right: string | undefined): number {
  const leftValue = left === undefined ? 0 : Date.parse(left);
  const rightValue = right === undefined ? 0 : Date.parse(right);
  const safeLeft = Number.isFinite(leftValue) ? leftValue : 0;
  const safeRight = Number.isFinite(rightValue) ? rightValue : 0;
  return safeRight - safeLeft;
}
