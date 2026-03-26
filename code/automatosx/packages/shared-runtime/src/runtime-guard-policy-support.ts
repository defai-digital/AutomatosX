import { StepGuardPolicySchema } from '@defai.digital/contracts';
import type { PolicyEntry, StateStore } from '@defai.digital/state-store';
import type { StepGuardPolicy } from '@defai.digital/workflow-engine';
import type { RuntimeGuardPolicySummary } from './runtime-service-types.js';

export function resolveGuardPolicyDefinition(
  builtinPolicies: StepGuardPolicy[],
  policyId: string | undefined,
  definition: StepGuardPolicy | undefined,
): StepGuardPolicy {
  if (definition !== undefined) {
    return StepGuardPolicySchema.parse(definition);
  }

  if (policyId === undefined) {
    throw new Error('guard apply requires a policyId or definition');
  }

  const builtin = builtinPolicies.find((entry) => entry.policyId === policyId);
  if (builtin === undefined) {
    throw new Error(`Unknown built-in guard policy: ${policyId}`);
  }
  return builtin;
}

export async function resolveGuardPoliciesForCheck(
  stateStore: StateStore,
  builtinPolicies: StepGuardPolicy[],
  policyId?: string,
): Promise<StepGuardPolicy[]> {
  if (policyId !== undefined) {
    const storedPolicies = await stateStore.listPolicies();
    const stored = storedPolicies
      .map(extractStoredGuardPolicy)
      .find((entry): entry is StepGuardPolicy => entry !== undefined && entry.policyId === policyId);
    if (stored !== undefined) {
      return [stored];
    }

    const builtin = builtinPolicies.find((entry) => entry.policyId === policyId);
    if (builtin !== undefined) {
      return [builtin];
    }

    throw new Error(`Guard policy not found: ${policyId}`);
  }

  const storedPolicies = await stateStore.listPolicies();
  const parsedStored = storedPolicies
    .map(extractStoredGuardPolicy)
    .filter((entry): entry is StepGuardPolicy => entry !== undefined);
  return parsedStored.length > 0 ? parsedStored : builtinPolicies;
}

export function buildGuardPolicySummaries(
  builtinPolicies: StepGuardPolicy[],
  policies: PolicyEntry[],
): RuntimeGuardPolicySummary[] {
  const summaries = new Map<string, RuntimeGuardPolicySummary>();

  for (const policy of builtinPolicies) {
    summaries.set(policy.policyId, {
      policyId: policy.policyId,
      name: policy.name,
      description: policy.description,
      enabled: policy.enabled,
      priority: policy.priority,
      guardCount: policy.guards.length,
      source: 'builtin',
    });
  }

  for (const policy of policies) {
    const parsed = extractStoredGuardPolicy(policy);
    if (parsed !== undefined) {
      summaries.set(parsed.policyId, {
        policyId: parsed.policyId,
        name: parsed.name,
        description: parsed.description,
        enabled: policy.enabled,
        priority: parsed.priority,
        guardCount: parsed.guards.length,
        source: 'stored',
      });
      continue;
    }

    summaries.set(policy.policyId, {
      policyId: policy.policyId,
      name: policy.name,
      enabled: policy.enabled,
      priority: 0,
      guardCount: 0,
      source: 'stored',
    });
  }

  return [...summaries.values()].sort((left, right) => right.priority - left.priority || left.policyId.localeCompare(right.policyId));
}

export function extractStoredGuardPolicy(policy: PolicyEntry): StepGuardPolicy | undefined {
  const candidate = policy.metadata?.guardPolicy;
  const parsed = StepGuardPolicySchema.safeParse(candidate);
  if (!parsed.success) {
    return undefined;
  }
  return {
    ...parsed.data,
    enabled: policy.enabled,
  };
}
