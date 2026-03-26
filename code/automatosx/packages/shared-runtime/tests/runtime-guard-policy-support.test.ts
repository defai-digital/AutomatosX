import { describe, expect, it } from 'vitest';
import type { PolicyEntry, StateStore } from '@defai.digital/state-store';
import type { StepGuardPolicy } from '@defai.digital/workflow-engine';
import {
  buildGuardPolicySummaries,
  resolveGuardPoliciesForCheck,
  resolveGuardPolicyDefinition,
} from '../src/runtime-guard-policy-support.js';

describe('runtime guard policy support', () => {
  const builtinPolicies: StepGuardPolicy[] = [
    {
      policyId: 'builtin-runtime',
      name: 'Builtin Runtime',
      enabled: true,
      priority: 80,
      workflowPatterns: ['*'],
      stepTypes: ['tool'],
      agentPatterns: ['*'],
      guards: [],
    },
  ];

  it('prefers stored policies for guard resolution and summary building', async () => {
    const storedPolicy: PolicyEntry = {
      policyId: 'stored-runtime',
      name: 'Stored Runtime',
      enabled: false,
      metadata: {
        guardPolicy: {
          policyId: 'stored-runtime',
          name: 'Stored Runtime',
          enabled: true,
          priority: 95,
          workflowPatterns: ['ship'],
          stepTypes: ['tool'],
          agentPatterns: ['cli'],
          guards: [
            {
              guardId: 'stored-check',
              stepId: '*',
              position: 'before',
              gates: ['validation'],
              onFail: 'block',
              enabled: true,
            },
          ],
        },
      },
    } as PolicyEntry;
    const stateStore = {
      listPolicies: async () => [storedPolicy],
    } as Pick<StateStore, 'listPolicies'> as StateStore;

    await expect(resolveGuardPoliciesForCheck(stateStore, builtinPolicies, 'stored-runtime')).resolves.toEqual([
      expect.objectContaining({
        policyId: 'stored-runtime',
        enabled: false,
      }),
    ]);

    expect(buildGuardPolicySummaries(builtinPolicies, [storedPolicy])).toEqual([
      expect.objectContaining({
        policyId: 'stored-runtime',
        source: 'stored',
        enabled: false,
        priority: 95,
      }),
      expect.objectContaining({
        policyId: 'builtin-runtime',
        source: 'builtin',
      }),
    ]);
  });

  it('validates inline definitions and falls back to builtin policy ids', async () => {
    const stateStore = {
      listPolicies: async () => [],
    } as Pick<StateStore, 'listPolicies'> as StateStore;

    expect(resolveGuardPolicyDefinition(builtinPolicies, 'builtin-runtime', undefined)).toBe(builtinPolicies[0]);
    expect(() => resolveGuardPolicyDefinition(builtinPolicies, undefined, undefined)).toThrow(
      'guard apply requires a policyId or definition',
    );
    await expect(resolveGuardPoliciesForCheck(stateStore, builtinPolicies)).resolves.toBe(builtinPolicies);
  });
});
