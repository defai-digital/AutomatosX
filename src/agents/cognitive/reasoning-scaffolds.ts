/**
 * Reasoning Scaffolds - Cognitive frameworks that teach LLMs HOW to think
 *
 * v13.0.0: Implements structured reasoning loops that guide agent cognition
 * through systematic problem-solving steps.
 *
 * Key insight: LLMs know WHAT to do in general, but need guidance on
 * HOW to approach problems systematically.
 */

import type {
  ReasoningScaffold,
  ReasoningScaffoldType,
  ReasoningStep,
} from '../../types/cognitive.js';

/**
 * PROVER Scaffold - Full reasoning loop
 *
 * Plan → Risk-scan → Options → Validate → Execute → Report
 *
 * Use for: Complex tasks, multi-step implementations, architectural decisions
 */
const PROVER_STEPS: ReasoningStep[] = [
  {
    id: '1_intake',
    name: 'INTAKE',
    description: 'Understand before acting',
    requiredActions: [
      'Restate the goal, constraints, and success criteria in your own words',
      'Read relevant files and cite them (path:line) - do NOT hypothesize without evidence',
      'List your assumptions and unknowns explicitly',
      'If blockers exist that prevent progress, ask 1-3 focused clarifying questions',
    ],
    skipWhen: ['Task is trivial and self-explanatory'],
  },
  {
    id: '2_risk_scan',
    name: 'RISK SCAN',
    description: 'Anticipate failure modes before they occur',
    requiredActions: [
      'Run through your domain-specific checklist (see DOMAIN CHECKLIST section)',
      'Flag any high-risk items explicitly with [RISK] tag',
      'Propose mitigations for critical risks before proceeding',
      'If risks are unacceptable, STOP and discuss with user',
    ],
  },
  {
    id: '3_options',
    name: 'OPTIONS',
    description: 'Consider alternatives before committing',
    requiredActions: [
      'Generate 2-3 viable approaches (skip only if truly trivial)',
      'Compare each against: complexity, performance, risk, maintainability',
      'Choose one approach with explicit rationale',
      'Document what was rejected and why (prevents revisiting)',
    ],
    skipWhen: ['Single obvious solution exists', 'Task is a simple bug fix'],
  },
  {
    id: '4_plan',
    name: 'PLAN',
    description: 'Decompose before executing',
    requiredActions: [
      'Break work into ordered steps (even if small)',
      'Identify dependencies between steps',
      'Note which steps are reversible vs. irreversible',
      'For trivial tasks: "Plan: Single-step execution"',
    ],
  },
  {
    id: '5_execute',
    name: 'EXECUTE',
    description: 'Implement with discipline',
    requiredActions: [
      'Follow the plan step-by-step',
      'Cite existing patterns in codebase when applicable',
      'Keep changes minimal and focused - resist scope creep',
      'Document non-obvious decisions with brief inline comments',
      'If blocked during execution, update plan rather than improvising',
    ],
  },
  {
    id: '6_validate',
    name: 'VALIDATE',
    description: 'Verify before delivering - never ship unvalidated work',
    requiredActions: [
      'Run verification commands (typecheck, tests, lint)',
      'State explicitly what WAS validated',
      'State explicitly what was NOT validated (gaps)',
      'Note residual risks that remain after validation',
      'If validation fails, diagnose and fix before reporting',
    ],
  },
  {
    id: '7_report',
    name: 'REPORT',
    description: 'Structured delivery with full transparency',
    requiredActions: [
      'Use the OUTPUT FORMAT structure (see OUTPUT FORMAT section)',
      'Be concise but complete - no hand-waving',
      'Include file references with paths for all changes',
      'Specify concrete follow-up actions if any',
    ],
  },
];

const PROVER_TEMPLATE = `## MANDATORY REASONING LOOP (PROVER)

For EVERY task, follow this sequence. Skipping steps leads to mistakes.

### 1. INTAKE (before touching code)
**Purpose**: Understand before acting

- **Restate**: Goal, constraints, success criteria in your own words
- **Recon**: Read relevant files (cite \`path:line\`) - do NOT hypothesize without evidence
- **Unknowns**: List assumptions explicitly
- **Blockers**: If blockers exist, ask 1-3 focused clarifying questions

### 2. RISK SCAN
**Purpose**: Anticipate failure modes

- Run through your DOMAIN CHECKLIST (see below)
- Flag high-risk items with [RISK] tag
- Propose mitigations for critical risks
- If risks are unacceptable, STOP and discuss

### 3. OPTIONS (skip if truly trivial)
**Purpose**: Consider alternatives before committing

- Generate 2-3 viable approaches
- Compare: complexity, performance, risk, maintainability
- Choose one with explicit rationale
- Note what was rejected and why

### 4. PLAN
**Purpose**: Decompose before executing

- Break work into ordered steps
- Identify dependencies between steps
- Note reversible vs. irreversible steps
- For trivial tasks: "Plan: Single-step execution"

### 5. EXECUTE
**Purpose**: Implement with discipline

- Follow plan step-by-step
- Cite existing patterns in codebase
- Keep changes minimal - resist scope creep
- If blocked, update plan rather than improvising

### 6. VALIDATE
**Purpose**: Never ship unvalidated work

- Run: typecheck, tests, lint (as applicable)
- State what WAS validated
- State what was NOT validated (gaps)
- If validation fails, fix before reporting

### 7. REPORT
**Purpose**: Structured delivery

- Use the OUTPUT FORMAT structure
- Include file paths for all changes
- Specify follow-up actions

---

**CRITICAL**: If uncertain at any step, ASK rather than assume.
If proceeding with assumptions, LIST THEM EXPLICITLY.
`;

/**
 * LITE Scaffold - Lightweight reasoning for simple tasks
 *
 * Understand → Do → Verify → Report
 *
 * Use for: Simple tasks, quick fixes, single-file changes
 */
const LITE_STEPS: ReasoningStep[] = [
  {
    id: '1_understand',
    name: 'UNDERSTAND',
    description: 'Quick comprehension',
    requiredActions: [
      'Confirm what needs to be done',
      'Check relevant file if needed',
    ],
  },
  {
    id: '2_do',
    name: 'DO',
    description: 'Execute the task',
    requiredActions: [
      'Make the change',
      'Follow existing patterns',
    ],
  },
  {
    id: '3_verify',
    name: 'VERIFY',
    description: 'Quick validation',
    requiredActions: [
      'Run typecheck/tests if applicable',
      'Note if verification was skipped and why',
    ],
  },
  {
    id: '4_report',
    name: 'REPORT',
    description: 'Brief summary',
    requiredActions: [
      'State what was done',
      'Note any caveats or follow-ups',
    ],
  },
];

const LITE_TEMPLATE = `## REASONING LOOP (LITE)

For simple tasks, follow this streamlined process:

### 1. UNDERSTAND
- Confirm what needs to be done
- Check relevant file if needed

### 2. DO
- Make the change
- Follow existing patterns

### 3. VERIFY
- Run typecheck/tests if applicable
- Note if skipped and why

### 4. REPORT
- State what was done
- Note any caveats

---

**Escalate to PROVER scaffold if task is more complex than expected.**
`;

/**
 * All available reasoning scaffolds
 */
const SCAFFOLDS: Record<ReasoningScaffoldType, ReasoningScaffold> = {
  prover: {
    id: 'prover',
    name: 'PROVER',
    description: 'Full reasoning loop: Plan-Risk-Options-Validate-Execute-Report',
    steps: PROVER_STEPS,
    template: PROVER_TEMPLATE,
  },
  lite: {
    id: 'lite',
    name: 'LITE',
    description: 'Lightweight reasoning: Understand-Do-Verify-Report',
    steps: LITE_STEPS,
    template: LITE_TEMPLATE,
  },
};

/**
 * Get a reasoning scaffold by type
 */
export function getReasoningScaffold(type: ReasoningScaffoldType): ReasoningScaffold {
  const scaffold = SCAFFOLDS[type];
  if (!scaffold) {
    throw new Error(`Unknown reasoning scaffold: ${type}`);
  }
  return scaffold;
}

/**
 * Get the formatted template for a scaffold
 */
export function getScaffoldTemplate(type: ReasoningScaffoldType): string {
  return getReasoningScaffold(type).template;
}

/**
 * Get all available scaffold types
 */
export function getAvailableScaffolds(): ReasoningScaffoldType[] {
  return Object.keys(SCAFFOLDS) as ReasoningScaffoldType[];
}

/**
 * Recommend a scaffold based on task complexity indicators
 */
export function recommendScaffold(taskDescription: string): ReasoningScaffoldType {
  const complexityIndicators = [
    'implement',
    'design',
    'architect',
    'refactor',
    'migrate',
    'integrate',
    'security',
    'performance',
    'multi',
    'system',
    'api',
    'database',
    'auth',
  ];

  const simpleIndicators = [
    'fix typo',
    'update comment',
    'rename',
    'add log',
    'simple',
    'quick',
    'minor',
  ];

  const lowerTask = taskDescription.toLowerCase();

  // Check for simple indicators first
  for (const indicator of simpleIndicators) {
    if (lowerTask.includes(indicator)) {
      return 'lite';
    }
  }

  // Check for complexity indicators
  let complexityScore = 0;
  for (const indicator of complexityIndicators) {
    if (lowerTask.includes(indicator)) {
      complexityScore++;
    }
  }

  // Word count as a rough complexity proxy
  const wordCount = taskDescription.split(/\s+/).length;
  if (wordCount > 30) {
    complexityScore++;
  }

  return complexityScore >= 2 ? 'prover' : 'lite';
}

export const ReasoningScaffolds = {
  get: getReasoningScaffold,
  getTemplate: getScaffoldTemplate,
  getAvailable: getAvailableScaffolds,
  recommend: recommendScaffold,
  PROVER: SCAFFOLDS.prover,
  LITE: SCAFFOLDS.lite,
};

export default ReasoningScaffolds;
