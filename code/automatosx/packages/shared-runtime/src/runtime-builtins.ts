import type { StepGuardPolicy } from '@defai.digital/workflow-engine';
import type { RuntimeAbility } from './runtime-service-types.js';

export const DEFAULT_DISCUSSION_CONCURRENCY = 2;
export const DEFAULT_DISCUSSION_PROVIDER_BUDGET = 3;
export const DEFAULT_DISCUSSION_ROUNDS = 3;

export const BUILTIN_GUARD_POLICIES: StepGuardPolicy[] = [
  {
    policyId: 'step-validation',
    name: 'Step Validation',
    description: 'Blocks invalid workflow step configuration before execution.',
    workflowPatterns: ['*'],
    stepTypes: ['prompt', 'tool', 'conditional', 'loop', 'parallel', 'discuss', 'delegate'],
    agentPatterns: ['*'],
    guards: [
      {
        guardId: 'validate-step-config',
        stepId: '*',
        position: 'before',
        gates: ['validation'],
        onFail: 'block',
        enabled: true,
      },
    ],
    enabled: true,
    priority: 100,
  },
  {
    policyId: 'safe-filesystem',
    name: 'Safe Filesystem',
    description: 'Blocks unsafe file changes, sensitive-path edits, oversized change sets, and secret leakage.',
    workflowPatterns: ['*'],
    stepTypes: ['tool'],
    agentPatterns: ['*'],
    guards: [
      {
        guardId: 'enforce-allowed-paths',
        stepId: '*',
        position: 'before',
        gates: ['path_violation'],
        onFail: 'block',
        enabled: true,
      },
      {
        guardId: 'enforce-change-radius',
        stepId: '*',
        position: 'before',
        gates: ['change_radius'],
        onFail: 'block',
        enabled: true,
      },
      {
        guardId: 'prevent-sensitive-changes',
        stepId: '*',
        position: 'before',
        gates: ['sensitive_change'],
        onFail: 'block',
        enabled: true,
      },
      {
        guardId: 'prevent-secret-leaks',
        stepId: '*',
        position: 'before',
        gates: ['secrets_detection'],
        onFail: 'block',
        enabled: true,
      },
    ],
    enabled: true,
    priority: 90,
  },
  {
    policyId: 'runtime-governance',
    name: 'Runtime Governance',
    description: 'Verifies that canonical bridge and skill tool steps expose trust and provenance metadata after execution.',
    workflowPatterns: ['*'],
    stepTypes: ['tool'],
    agentPatterns: ['*'],
    guards: [
      {
        guardId: 'enforce-runtime-trust',
        stepId: '*',
        position: 'after',
        gates: ['runtime_trust'],
        onFail: 'block',
        enabled: true,
      },
    ],
    enabled: true,
    priority: 85,
  },
];

export const BUILTIN_ABILITIES: RuntimeAbility[] = [
  {
    abilityId: 'workflow-first',
    name: 'Workflow First Planning',
    category: 'workflow',
    tags: ['workflow', 'planning', 'orchestration'],
    content: 'Prefer first-class workflows when the task maps cleanly to ship, architect, audit, qa, or release. Keep inputs explicit and preserve trace/session correlation.',
  },
  {
    abilityId: 'code-review',
    name: 'Deterministic Code Review',
    category: 'review',
    tags: ['review', 'correctness', 'security', 'maintainability'],
    content: 'Prioritize concrete findings with file references, severity ordering, and missing-test risks. Prefer actionable defects over narrative summaries.',
  },
  {
    abilityId: 'git-hygiene',
    name: 'Git Hygiene',
    category: 'git',
    tags: ['git', 'commit', 'pr', 'review'],
    content: 'Keep commits scoped, summarize changed files before preparing commit messages, and use diff-based evidence when reviewing branches or pull requests.',
  },
  {
    abilityId: 'agent-routing',
    name: 'Agent Routing',
    category: 'agent',
    tags: ['agent', 'capabilities', 'routing', 'delegation'],
    content: 'Route work to agents based on explicit capability overlap and keep delegated tasks bounded, observable, and trace-linked.',
  },
  {
    abilityId: 'feedback-loop',
    name: 'Feedback Loop',
    category: 'operations',
    tags: ['feedback', 'quality', 'operations'],
    content: 'Capture outcome, rating, and operator notes after meaningful runs so routing and quality adjustments can be derived from evidence instead of anecdotes.',
  },
];
