import { describe, expect, it } from 'vitest';
import {
  BUILTIN_ABILITIES,
  BUILTIN_GUARD_POLICIES,
  DEFAULT_DISCUSSION_CONCURRENCY,
  DEFAULT_DISCUSSION_PROVIDER_BUDGET,
  DEFAULT_DISCUSSION_ROUNDS,
} from '../src/runtime-builtins.js';

describe('runtime builtins', () => {
  it('exposes stable discussion defaults', () => {
    expect({
      concurrency: DEFAULT_DISCUSSION_CONCURRENCY,
      providerBudget: DEFAULT_DISCUSSION_PROVIDER_BUDGET,
      rounds: DEFAULT_DISCUSSION_ROUNDS,
    }).toEqual({
      concurrency: 2,
      providerBudget: 3,
      rounds: 3,
    });
  });

  it('registers canonical builtin policies and abilities', () => {
    expect(BUILTIN_GUARD_POLICIES.map((policy) => policy.policyId)).toEqual([
      'step-validation',
      'safe-filesystem',
      'runtime-governance',
    ]);
    expect(BUILTIN_ABILITIES.map((ability) => ability.abilityId)).toEqual([
      'workflow-first',
      'code-review',
      'git-hygiene',
      'agent-routing',
      'feedback-loop',
    ]);
  });
});
