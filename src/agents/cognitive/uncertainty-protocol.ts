/**
 * Uncertainty Protocol - Guidance on when to ask vs. proceed
 *
 * v13.0.0: Defines clear protocols for handling uncertainty, ambiguity,
 * and missing information. Prevents agents from "bluffing" when they
 * should ask, and from stalling when they should proceed.
 */

import type {
  UncertaintyProtocol,
  UncertaintyMode,
  ConfidenceLevel,
} from '../../types/cognitive.js';

/**
 * Ask-First Protocol - Always ask when uncertain
 *
 * Use for: Security-sensitive work, new team members, unclear requirements
 */
const ASK_FIRST_PROTOCOL: UncertaintyProtocol = {
  id: 'ask_first',
  name: 'Ask First',
  askWhen: [
    'Requirements are ambiguous or could be interpreted multiple ways',
    'Security or data implications require explicit authorization',
    'Change scope significantly exceeds the original request',
    'Irreversible actions are required (delete, migrate, deploy to production)',
    'You need access to resources, credentials, or information not available',
    'Multiple valid approaches exist and user preference is unknown',
    'The task involves user-facing changes where UX matters',
    'You are making assumptions about business logic',
  ],
  proceedWhen: [
    'The request is completely unambiguous',
    'You are applying a well-documented standard or best practice',
    'The change is trivial and easily reversible',
  ],
  assumptionFormat: `**Clarification Needed**

Before proceeding, I need to clarify:

1. [Question 1 - be specific about what you need to know]
2. [Question 2 - if applicable]

This will help ensure I deliver exactly what you need.`,
  template: `## UNCERTAINTY HANDLING (ASK FIRST)

**Default behavior**: Ask for clarification when uncertain.

**Ask when** (any of these apply):
- Requirements could be interpreted multiple ways
- Security or data implications exist
- Change scope exceeds original request
- Irreversible actions required
- Multiple valid approaches exist
- Business logic assumptions needed

**Only proceed without asking when**:
- Request is completely unambiguous
- Applying documented standard/best practice
- Change is trivial and reversible

**When asking, use this format:**

**Clarification Needed**

Before proceeding, I need to clarify:

1. [Specific question]
2. [Specific question if needed]

This ensures I deliver exactly what you need.

---

**Confidence Tagging**: Tag recommendations with confidence level.
- **[HIGH]**: Well-established pattern, verified approach
- **[MEDIUM]**: Reasonable approach, some assumptions
- **[LOW]**: Exploratory, needs validation
`,
};

/**
 * Proceed With Assumptions Protocol - Move forward but document assumptions
 *
 * Use for: Experienced teams, well-defined patterns, time-sensitive work
 */
const PROCEED_PROTOCOL: UncertaintyProtocol = {
  id: 'proceed_with_assumptions',
  name: 'Proceed With Assumptions',
  askWhen: [
    'Security-critical decisions require explicit authorization',
    'Irreversible actions that cannot be undone (data deletion, production deploy)',
    'Change would break existing functionality or APIs',
    'You are completely blocked and cannot make progress',
  ],
  proceedWhen: [
    'Best practice clearly applies to the situation',
    'Change is safely reversible (can be undone easily)',
    'Scope is well-defined and bounded',
    'Similar patterns exist in the codebase',
    'You can make reasonable assumptions based on context',
    'The risk of proceeding is low',
  ],
  assumptionFormat: `**Assumptions Made**

I proceeded with these assumptions:
- [Assumption 1]: [rationale for this assumption]
- [Assumption 2]: [rationale]

If any are incorrect, let me know and I'll adjust.`,
  template: `## UNCERTAINTY HANDLING (PROCEED WITH ASSUMPTIONS)

**Default behavior**: Proceed and document assumptions.

**Only stop and ask when**:
- Security-critical decisions need authorization
- Irreversible actions that cannot be undone
- Change would break existing functionality
- Completely blocked with no path forward

**Proceed (with documented assumptions) when**:
- Best practice clearly applies
- Change is safely reversible
- Similar patterns exist in codebase
- Reasonable assumptions can be made
- Risk of proceeding is low

**When proceeding with assumptions:**

**Assumptions Made**

I proceeded with these assumptions:
- [Assumption 1]: [rationale]
- [Assumption 2]: [rationale]

If any are incorrect, let me know and I'll adjust.

---

**Confidence Tagging**: Tag recommendations with confidence level.
- **[HIGH]**: Well-established pattern, verified approach
- **[MEDIUM]**: Reasonable approach, some assumptions
- **[LOW]**: Exploratory, needs validation
`,
};

/**
 * Balanced Protocol - Risk-based decision on ask vs. proceed
 *
 * Use for: Most situations, balanced teams, standard development work
 */
const BALANCED_PROTOCOL: UncertaintyProtocol = {
  id: 'balanced',
  name: 'Balanced',
  askWhen: [
    'Security implications exist (auth, data access, secrets)',
    'Data integrity could be affected (migrations, deletions, updates)',
    'Irreversible actions are involved',
    'User explicitly requested confirmation before changes',
    'Multiple fundamentally different approaches exist',
    'You are unsure which of several options the user would prefer',
    'The scope is larger than expected (> 2x original estimate)',
  ],
  proceedWhen: [
    'Clear best practice applies',
    'Change is low-risk and reversible',
    'You have high confidence in the approach',
    'Similar pattern exists in codebase',
    'Scope is well-defined and matches expectations',
    'Edge cases are handled or documented',
  ],
  assumptionFormat: `**Assumptions**
- [Assumption]: [brief rationale]

Proceeding with the above assumptions. Correct me if any are wrong.`,
  template: `## UNCERTAINTY HANDLING (BALANCED)

**Default behavior**: Use risk-based judgment.

**Stop and ask when** (HIGH RISK):
- Security implications (auth, data, secrets)
- Data integrity at risk (migrations, deletions)
- Irreversible actions involved
- User requested confirmation
- Scope significantly larger than expected
- Multiple fundamentally different approaches

**Proceed with documented assumptions when** (LOW RISK):
- Clear best practice applies
- Change is low-risk and reversible
- High confidence in approach
- Similar pattern in codebase
- Scope matches expectations

**When proceeding with assumptions:**

**Assumptions**
- [Assumption]: [brief rationale]

Proceeding with the above. Correct me if any are wrong.

---

**Risk Assessment Quick Check**:
Before deciding to ask vs proceed, consider:
1. What's the worst case if I'm wrong? (severity)
2. How likely is it that I'm wrong? (probability)
3. Can it be easily undone? (reversibility)

If severity HIGH or probability HIGH and reversibility LOW → ASK
Otherwise → PROCEED with documented assumptions

---

**Confidence Tagging**: Tag recommendations with confidence level.
- **[HIGH]**: Well-established pattern, verified approach
- **[MEDIUM]**: Reasonable approach, some assumptions
- **[LOW]**: Exploratory, needs validation
`,
};

/**
 * All available protocols
 */
const PROTOCOLS: Record<UncertaintyMode, UncertaintyProtocol> = {
  ask_first: ASK_FIRST_PROTOCOL,
  proceed_with_assumptions: PROCEED_PROTOCOL,
  balanced: BALANCED_PROTOCOL,
};

/**
 * Get a protocol by mode
 */
export function getUncertaintyProtocol(mode: UncertaintyMode): UncertaintyProtocol {
  const protocol = PROTOCOLS[mode];
  if (!protocol) {
    throw new Error(`Unknown uncertainty mode: ${mode}`);
  }
  return protocol;
}

/**
 * Get the formatted template for a protocol
 */
export function getProtocolTemplate(mode: UncertaintyMode): string {
  return getUncertaintyProtocol(mode).template;
}

/**
 * Get all available modes
 */
export function getAvailableModes(): UncertaintyMode[] {
  return Object.keys(PROTOCOLS) as UncertaintyMode[];
}

/**
 * Format confidence level for display
 */
export function formatConfidence(level: ConfidenceLevel): string {
  const formats: Record<ConfidenceLevel, string> = {
    high: '[Confidence: HIGH] - Well-established pattern, verified approach',
    medium: '[Confidence: MEDIUM] - Reasonable approach, some assumptions made',
    low: '[Confidence: LOW] - Exploratory approach, needs validation',
  };
  return formats[level];
}

/**
 * Determine confidence level based on indicators
 */
export function assessConfidence(indicators: {
  hasExistingPattern: boolean;
  isWellDocumented: boolean;
  hasBeenValidated: boolean;
  assumptionCount: number;
  isNovel: boolean;
}): ConfidenceLevel {
  const { hasExistingPattern, isWellDocumented, hasBeenValidated, assumptionCount, isNovel } = indicators;

  // High confidence: existing pattern, documented, validated, few assumptions
  if (hasExistingPattern && isWellDocumented && hasBeenValidated && assumptionCount <= 1) {
    return 'high';
  }

  // Low confidence: novel, many assumptions, not validated
  if (isNovel || assumptionCount >= 3 || (!hasBeenValidated && !hasExistingPattern)) {
    return 'low';
  }

  // Medium: everything else
  return 'medium';
}

/**
 * Determine if should ask based on risk factors
 */
export function shouldAsk(factors: {
  mode: UncertaintyMode;
  hasSecurity: boolean;
  hasDataRisk: boolean;
  isIrreversible: boolean;
  scopeExceedsExpected: boolean;
  multipleApproaches: boolean;
  userRequestedConfirmation: boolean;
}): { shouldAsk: boolean; reason?: string } {
  const protocol = getUncertaintyProtocol(factors.mode);

  // Always ask for these regardless of mode
  if (factors.userRequestedConfirmation) {
    return { shouldAsk: true, reason: 'User requested confirmation' };
  }

  if (factors.isIrreversible && (factors.hasSecurity || factors.hasDataRisk)) {
    return { shouldAsk: true, reason: 'Irreversible action with security/data implications' };
  }

  // Mode-specific logic
  if (factors.mode === 'ask_first') {
    if (factors.multipleApproaches) {
      return { shouldAsk: true, reason: 'Multiple valid approaches exist' };
    }
    if (factors.hasSecurity || factors.hasDataRisk) {
      return { shouldAsk: true, reason: 'Security or data implications' };
    }
    if (factors.scopeExceedsExpected) {
      return { shouldAsk: true, reason: 'Scope exceeds expectations' };
    }
  }

  if (factors.mode === 'balanced') {
    if (factors.hasSecurity) {
      return { shouldAsk: true, reason: 'Security implications require confirmation' };
    }
    if (factors.hasDataRisk && factors.isIrreversible) {
      return { shouldAsk: true, reason: 'Irreversible data changes' };
    }
    if (factors.scopeExceedsExpected && factors.multipleApproaches) {
      return { shouldAsk: true, reason: 'Large scope with multiple approaches' };
    }
  }

  if (factors.mode === 'proceed_with_assumptions') {
    if (factors.hasSecurity && factors.isIrreversible) {
      return { shouldAsk: true, reason: 'Security-critical irreversible action' };
    }
  }

  return { shouldAsk: false };
}

/**
 * Format assumptions for output
 */
export function formatAssumptions(assumptions: string[], mode: UncertaintyMode): string {
  if (assumptions.length === 0) {
    return '';
  }

  const protocol = getUncertaintyProtocol(mode);
  const formatted = assumptions.map(a => `- ${a}`).join('\n');

  if (mode === 'ask_first') {
    return `**Assumptions Made (please verify)**\n${formatted}\n\nPlease confirm these assumptions are correct before I proceed.`;
  }

  return `**Assumptions**\n${formatted}\n\nProceeding with the above. Let me know if any are incorrect.`;
}

export const UncertaintyProtocols = {
  get: getUncertaintyProtocol,
  getTemplate: getProtocolTemplate,
  getAvailable: getAvailableModes,
  formatConfidence,
  assessConfidence,
  shouldAsk,
  formatAssumptions,
  ASK_FIRST: ASK_FIRST_PROTOCOL,
  PROCEED: PROCEED_PROTOCOL,
  BALANCED: BALANCED_PROTOCOL,
};

export default UncertaintyProtocols;
