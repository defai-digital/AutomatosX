import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { readCachedWorkspaceConfig } from './workspace-config-cache.js';
import type {
  ApprovalSpec,
  BridgeSpec,
  ProvenanceSpec,
  SkillSpec,
} from './bridge-contracts.js';

const stringListSchema = z.array(z.string().trim().min(1)).default([]);

const bridgeTrustConfigSchema = z.object({
  trustedBridgeIds: stringListSchema,
  trustedSkillIds: stringListSchema,
  trustedSourcePrefixes: stringListSchema,
  approvedPolicyIds: stringListSchema,
  allowRemoteSources: z.boolean().default(false),
}).default({
  trustedBridgeIds: [],
  trustedSkillIds: [],
  trustedSourcePrefixes: [],
  approvedPolicyIds: [],
  allowRemoteSources: false,
});

const bridgeInstallConfigSchema = z.object({
  rejectDenied: z.boolean().default(false),
  warnOnDenied: z.boolean().default(true),
}).default({
  rejectDenied: false,
  warnOnDenied: true,
});

const skillImportConfigSchema = z.object({
  rejectDenied: z.boolean().default(false),
  warnOnDenied: z.boolean().default(true),
}).default({
  rejectDenied: false,
  warnOnDenied: true,
});

const axBridgeConfigSchema = z.object({
  trust: bridgeTrustConfigSchema,
  install: bridgeInstallConfigSchema,
  skillImport: skillImportConfigSchema,
}).default({
  trust: bridgeTrustConfigSchema.parse({}),
  install: bridgeInstallConfigSchema.parse({}),
  skillImport: skillImportConfigSchema.parse({}),
});

export interface AxBridgeTrustConfig {
  trustedBridgeIds: string[];
  trustedSkillIds: string[];
  trustedSourcePrefixes: string[];
  approvedPolicyIds: string[];
  allowRemoteSources: boolean;
}

export interface AxBridgeInstallConfig {
  rejectDenied: boolean;
  warnOnDenied: boolean;
}

export interface AxBridgeSkillImportConfig {
  rejectDenied: boolean;
  warnOnDenied: boolean;
}

export interface RuntimeTrustDecision {
  allowed: boolean;
  state: 'implicit-local' | 'trusted-id' | 'trusted-source' | 'approved-policy' | 'denied';
  reason: string;
  approvalMode?: ApprovalSpec['mode'];
  approvalPolicyId?: string;
  sourceRef?: string;
  remoteSource: boolean;
}

export class RuntimeGovernanceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RuntimeGovernanceError';
    this.code = code;
  }
}

export function isRuntimeGovernanceError(error: unknown): error is RuntimeGovernanceError {
  return error instanceof RuntimeGovernanceError;
}

export async function readAxBridgeTrustConfig(basePath: string): Promise<AxBridgeTrustConfig> {
  const config = await readCachedWorkspaceConfig(basePath);
  const parsed = axBridgeConfigSchema.safeParse(config.axBridge);
  return parsed.success ? parsed.data.trust : bridgeTrustConfigSchema.parse({});
}

export async function readAxBridgeInstallConfig(basePath: string): Promise<AxBridgeInstallConfig> {
  const config = await readCachedWorkspaceConfig(basePath);
  const parsed = axBridgeConfigSchema.safeParse(config.axBridge);
  return parsed.success ? parsed.data.install : bridgeInstallConfigSchema.parse({});
}

export async function readAxBridgeSkillImportConfig(basePath: string): Promise<AxBridgeSkillImportConfig> {
  const config = await readCachedWorkspaceConfig(basePath);
  const parsed = axBridgeConfigSchema.safeParse(config.axBridge);
  return parsed.success ? parsed.data.skillImport : skillImportConfigSchema.parse({});
}

export async function evaluateBridgeExecutionTrust(
  basePath: string,
  bridge: BridgeSpec,
): Promise<RuntimeTrustDecision> {
  const trust = await readAxBridgeTrustConfig(basePath);
  return evaluateTrustDecision({
    id: bridge.bridgeId,
    approval: bridge.approval,
    provenance: bridge.provenance,
    sourceType: bridge.source?.type,
    sourceRef: bridge.source?.ref,
    trustedIds: trust.trustedBridgeIds,
    trustedSourcePrefixes: trust.trustedSourcePrefixes,
    approvedPolicyIds: trust.approvedPolicyIds,
    allowRemoteSources: trust.allowRemoteSources,
    notTrustedCode: 'BRIDGE_TRUST_REQUIRED',
    policyMissingCode: 'BRIDGE_POLICY_APPROVAL_REQUIRED',
  });
}

export async function evaluateSkillExecutionTrust(
  basePath: string,
  skill: SkillSpec,
): Promise<RuntimeTrustDecision> {
  const trust = await readAxBridgeTrustConfig(basePath);
  return evaluateTrustDecision({
    id: skill.skillId,
    approval: skill.approval,
    provenance: skill.provenance,
    sourceType: skill.provenance?.type,
    sourceRef: skill.provenance?.ref,
    trustedIds: trust.trustedSkillIds,
    trustedSourcePrefixes: trust.trustedSourcePrefixes,
    approvedPolicyIds: trust.approvedPolicyIds,
    allowRemoteSources: trust.allowRemoteSources,
    notTrustedCode: 'SKILL_TRUST_REQUIRED',
    policyMissingCode: 'SKILL_POLICY_APPROVAL_REQUIRED',
  });
}

export async function assertBridgeExecutionAllowed(basePath: string, bridge: BridgeSpec): Promise<RuntimeTrustDecision> {
  const decision = await evaluateBridgeExecutionTrust(basePath, bridge);
  if (!decision.allowed) {
    throw new RuntimeGovernanceError(resolveErrorCode(decision, 'BRIDGE_TRUST_REQUIRED'), decision.reason);
  }
  return decision;
}

export async function assertSkillExecutionAllowed(basePath: string, skill: SkillSpec): Promise<RuntimeTrustDecision> {
  const decision = await evaluateSkillExecutionTrust(basePath, skill);
  if (!decision.allowed) {
    throw new RuntimeGovernanceError(resolveErrorCode(decision, 'SKILL_TRUST_REQUIRED'), decision.reason);
  }
  return decision;
}

export function createRuntimeGovernanceError(
  decision: RuntimeTrustDecision,
  fallbackCode: string,
  message?: string,
): RuntimeGovernanceError {
  return new RuntimeGovernanceError(resolveErrorCode(decision, fallbackCode), message ?? decision.reason);
}

export function buildImportedProvenance(
  basePath: string,
  sourcePath: string,
  existing?: ProvenanceSpec,
  options?: {
    importer?: string;
    type?: string;
  },
): ProvenanceSpec {
  const normalized = resolve(basePath, sourcePath);
  const relativeRef = isAbsolute(sourcePath) ? relative(basePath, normalized) : sourcePath;
  return {
    ...(existing ?? {}),
    type: existing?.type ?? options?.type ?? 'local-file',
    ref: existing?.ref ?? (relativeRef.length > 0 ? relativeRef : normalized),
    importedAt: new Date().toISOString(),
    importer: options?.importer ?? 'ax.skill.import',
  };
}

function evaluateTrustDecision(config: {
  id: string;
  approval?: ApprovalSpec;
  provenance?: ProvenanceSpec;
  sourceType?: string;
  sourceRef?: string;
  trustedIds: string[];
  trustedSourcePrefixes: string[];
  approvedPolicyIds: string[];
  allowRemoteSources: boolean;
  notTrustedCode: string;
  policyMissingCode: string;
}): RuntimeTrustDecision {
  const approvalMode = config.approval?.mode;
  const sourceRef = firstNonEmptyString(config.sourceRef, config.provenance?.ref);
  const remoteSource = isRemoteSource(config.sourceType, sourceRef);
  const trustedById = config.trustedIds.includes(config.id);
  const trustedSourcePrefix = sourceRef === undefined
    ? undefined
    : config.trustedSourcePrefixes.find((prefix) => sourceRef.startsWith(prefix));

  if (remoteSource && !config.allowRemoteSources && trustedSourcePrefix === undefined) {
    return {
      allowed: false,
      state: 'denied',
      approvalMode,
      approvalPolicyId: config.approval?.policyId,
      sourceRef,
      remoteSource,
      reason: `Execution blocked because remote source "${sourceRef ?? config.sourceType ?? 'unknown'}" is not trusted in .automatosx/config.json.`,
    };
  }

  if (approvalMode === 'policy') {
    const policyId = config.approval?.policyId;
    if (policyId === undefined || !config.approvedPolicyIds.includes(policyId)) {
      return {
        allowed: false,
        state: 'denied',
        approvalMode,
        approvalPolicyId: policyId,
        sourceRef,
        remoteSource,
        reason: `Execution blocked because policy approval is required. Add "${policyId ?? 'missing-policy-id'}" to axBridge.trust.approvedPolicyIds in .automatosx/config.json.`,
      };
    }

    return {
      allowed: true,
      state: 'approved-policy',
      approvalMode,
      approvalPolicyId: policyId,
      sourceRef,
      remoteSource,
      reason: `Approved by policy id "${policyId}".`,
    };
  }

  if (trustedById) {
    return {
      allowed: true,
      state: 'trusted-id',
      approvalMode,
      approvalPolicyId: config.approval?.policyId,
      sourceRef,
      remoteSource,
      reason: `Trusted by id "${config.id}".`,
    };
  }

  if (trustedSourcePrefix !== undefined) {
    return {
      allowed: true,
      state: 'trusted-source',
      approvalMode,
      approvalPolicyId: config.approval?.policyId,
      sourceRef,
      remoteSource,
      reason: `Trusted by source prefix "${trustedSourcePrefix}".`,
    };
  }

  if (approvalMode === 'prompt') {
    return {
      allowed: false,
      state: 'denied',
      approvalMode,
      approvalPolicyId: config.approval?.policyId,
      sourceRef,
      remoteSource,
      reason: `Execution blocked because "${config.id}" requires explicit trust. Add it to axBridge.trust.trusted${config.notTrustedCode.startsWith('BRIDGE') ? 'BridgeIds' : 'SkillIds'} or trust its source via axBridge.trust.trustedSourcePrefixes in .automatosx/config.json.`,
    };
  }

  return {
    allowed: true,
    state: 'implicit-local',
    approvalMode,
    approvalPolicyId: config.approval?.policyId,
    sourceRef,
    remoteSource,
    reason: remoteSource
      ? 'Allowed because remote sources are enabled in workspace config.'
      : 'Allowed because the definition is local and does not require explicit approval.',
  };
}

function isRemoteSource(sourceType: string | undefined, sourceRef: string | undefined): boolean {
  if (typeof sourceType === 'string' && ['git', 'github', 'registry', 'url', 'remote'].includes(sourceType.toLowerCase())) {
    return true;
  }
  if (sourceRef === undefined) {
    return false;
  }
  return /^[a-z]+:\/\//i.test(sourceRef) || sourceRef.startsWith('git@') || sourceRef.startsWith('ssh://');
}

function firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function resolveErrorCode(decision: RuntimeTrustDecision, fallback: string): string {
  if (decision.approvalMode === 'policy') {
    return fallback.replace('TRUST_REQUIRED', 'POLICY_APPROVAL_REQUIRED');
  }
  return fallback;
}
