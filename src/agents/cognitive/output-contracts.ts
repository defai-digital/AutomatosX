/**
 * Output Contracts - Structured response formats for consistent, parseable outputs
 *
 * v13.0.0: Defines output structures that ensure agent responses are:
 * - Consistent (same sections every time)
 * - Parseable (can be programmatically extracted)
 * - Complete (all required information present)
 * - Transparent (verification and risks visible)
 */

import type {
  OutputContract,
  OutputContractType,
  OutputSection,
} from '../../types/cognitive.js';

/**
 * Standard output sections - the core structure for all responses
 */
const STANDARD_SECTIONS: OutputSection[] = [
  {
    name: 'Context',
    required: true,
    description: 'What was understood about the task',
    format: `**Context**
- Goal: [restated objective in your own words]
- Constraints: [key limitations or requirements]
- Assumptions: [what was assumed - be explicit]`,
  },
  {
    name: 'Plan',
    required: true,
    description: 'What will be/was done',
    format: `**Plan**
1. [Step 1]
2. [Step 2]
3. [Step 3]
...
(For trivial tasks: "Plan: Single-step execution")`,
  },
  {
    name: 'Actions',
    required: true,
    description: 'What was actually done',
    format: `**Actions**
- [Action 1]: \`path/to/file.ts:line\` - [brief description]
- [Action 2]: \`path/to/file.ts:line\` - [brief description]
- [Command run]: \`pnpm test\` - [result summary]
...`,
  },
  {
    name: 'Verification',
    required: true,
    description: 'How the work was validated',
    format: `**Verification**
- Validated:
  - [x] [What was tested/checked]
  - [x] [Another validation]
- Commands run:
  - \`pnpm typecheck\` - [result]
  - \`pnpm test path/to/test\` - [result]
- Gaps (not validated):
  - [ ] [What was NOT tested and why]`,
  },
  {
    name: 'Risks',
    required: true,
    description: 'What could go wrong or needs attention',
    format: `**Risks**
- [Risk 1]: [SEVERITY: LOW/MEDIUM/HIGH/CRITICAL] - [mitigation or note]
- [Risk 2]: [SEVERITY] - [mitigation or note]
(If none: "Risks: None identified for this change")`,
  },
  {
    name: 'Next Steps',
    required: true,
    description: 'What should happen after this',
    format: `**Next Steps**
- [ ] [Recommended action 1]
- [ ] [Recommended action 2]
(If complete: "Next Steps: Ready for review/merge")`,
  },
];

/**
 * Failure sections - additional sections when something goes wrong
 */
const FAILURE_SECTIONS: OutputSection[] = [
  {
    name: 'Failure',
    required: true,
    description: 'What failed and why',
    format: `**Failure**
- What failed: [description of the failure]
- Root cause: [analysis of why it failed]
- Attempted recovery: [what was tried to fix it]
- Blocked: [yes/no] - [what's needed to proceed]`,
  },
];

/**
 * Standard Output Contract - Full structured output
 */
const STANDARD_CONTRACT: OutputContract = {
  id: 'standard',
  name: 'Standard Output',
  description: 'Full structured output with all sections for complete transparency',
  sections: STANDARD_SECTIONS,
  failureSections: FAILURE_SECTIONS,
  template: `## OUTPUT FORMAT

Structure your response with these sections:

**Context**
- Goal: [restated objective]
- Constraints: [key limitations]
- Assumptions: [what was assumed]

**Plan**
1. [Step 1]
2. [Step 2]
(For trivial tasks: "Plan: Single-step execution")

**Actions**
- [Action]: \`path/to/file.ts:line\` - [description]
- [Command]: \`command\` - [result]

**Verification**
- Validated:
  - [x] [What was tested]
- Commands: \`pnpm typecheck\`, \`pnpm test\`
- Gaps: [What was NOT tested]

**Risks**
- [Risk]: [SEVERITY] - [mitigation]
(If none: "Risks: None identified")

**Next Steps**
- [ ] [Action item]
(If complete: "Ready for review")

---

**If something fails, add:**

**Failure**
- What failed: [description]
- Root cause: [analysis]
- Attempted recovery: [what was tried]
- Blocked: [yes/no, what's needed]
`,
};

/**
 * Minimal Output Contract - Condensed for simple tasks
 */
const MINIMAL_SECTIONS: OutputSection[] = [
  {
    name: 'Done',
    required: true,
    description: 'What was done',
    format: `**Done**
- [Action]: \`file:line\``,
  },
  {
    name: 'Verified',
    required: true,
    description: 'How it was verified',
    format: `**Verified**: [command or check]`,
  },
  {
    name: 'Note',
    required: false,
    description: 'Any important notes',
    format: `**Note**: [anything important]`,
  },
];

const MINIMAL_CONTRACT: OutputContract = {
  id: 'minimal',
  name: 'Minimal Output',
  description: 'Condensed output for simple tasks',
  sections: MINIMAL_SECTIONS,
  template: `## OUTPUT FORMAT (MINIMAL)

For simple tasks, use this condensed format:

**Done**
- [Action]: \`file:line\`

**Verified**: [command or "visual check"]

**Note**: [anything important, or omit if none]
`,
};

/**
 * Detailed Output Contract - Extended for complex tasks
 */
const DETAILED_SECTIONS: OutputSection[] = [
  ...STANDARD_SECTIONS,
  {
    name: 'Options Considered',
    required: false,
    description: 'Alternatives that were evaluated',
    format: `**Options Considered**
| Option | Pros | Cons | Why Chosen/Rejected |
|--------|------|------|---------------------|
| [Option 1] | [pros] | [cons] | [rationale] |
| [Option 2] | [pros] | [cons] | [rationale] |`,
  },
  {
    name: 'Dependencies',
    required: false,
    description: 'Dependencies and related changes',
    format: `**Dependencies**
- Upstream: [what this depends on]
- Downstream: [what depends on this]
- Related: [related tickets/PRs]`,
  },
  {
    name: 'Rollback Plan',
    required: false,
    description: 'How to undo if needed',
    format: `**Rollback Plan**
1. [Step to revert]
2. [Step to verify revert]`,
  },
];

const DETAILED_CONTRACT: OutputContract = {
  id: 'detailed',
  name: 'Detailed Output',
  description: 'Extended output for complex tasks requiring more documentation',
  sections: DETAILED_SECTIONS,
  failureSections: FAILURE_SECTIONS,
  template: `## OUTPUT FORMAT (DETAILED)

For complex tasks, use this extended format:

**Context**
- Goal: [restated objective]
- Constraints: [key limitations]
- Assumptions: [what was assumed]

**Options Considered** (if applicable)
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| [Option 1] | [pros] | [cons] | [Chosen/Rejected: why] |

**Plan**
1. [Step 1]
2. [Step 2]

**Actions**
- [Action]: \`path/to/file.ts:line\` - [description]
- [Command]: \`command\` - [result]

**Verification**
- Validated:
  - [x] [What was tested]
- Commands: \`pnpm typecheck\`, \`pnpm test\`
- Gaps: [What was NOT tested]

**Dependencies** (if applicable)
- Upstream: [what this depends on]
- Downstream: [what depends on this]

**Risks**
- [Risk]: [SEVERITY] - [mitigation]

**Rollback Plan** (if applicable)
1. [How to undo]

**Next Steps**
- [ ] [Action item]
`,
};

/**
 * All available output contracts
 */
const CONTRACTS: Record<OutputContractType, OutputContract> = {
  standard: STANDARD_CONTRACT,
  minimal: MINIMAL_CONTRACT,
  detailed: DETAILED_CONTRACT,
};

/**
 * Get an output contract by type
 */
export function getOutputContract(type: OutputContractType): OutputContract {
  const contract = CONTRACTS[type];
  if (!contract) {
    throw new Error(`Unknown output contract: ${type}`);
  }
  return contract;
}

/**
 * Get the formatted template for a contract
 */
export function getContractTemplate(type: OutputContractType): string {
  return getOutputContract(type).template;
}

/**
 * Get all available contract types
 */
export function getAvailableContracts(): OutputContractType[] {
  return Object.keys(CONTRACTS) as OutputContractType[];
}

/**
 * Recommend a contract based on task complexity
 */
export function recommendContract(taskDescription: string): OutputContractType {
  const detailedIndicators = [
    'architect',
    'design',
    'migration',
    'breaking change',
    'major',
    'complex',
    'multi-team',
    'cross-functional',
  ];

  const minimalIndicators = [
    'typo',
    'comment',
    'rename',
    'simple',
    'quick',
    'minor fix',
    'update version',
  ];

  const lowerTask = taskDescription.toLowerCase();

  for (const indicator of minimalIndicators) {
    if (lowerTask.includes(indicator)) {
      return 'minimal';
    }
  }

  for (const indicator of detailedIndicators) {
    if (lowerTask.includes(indicator)) {
      return 'detailed';
    }
  }

  return 'standard';
}

/**
 * Validate a response against a contract
 */
export function validateResponse(
  response: string,
  contractType: OutputContractType
): { valid: boolean; missing: string[]; warnings: string[] } {
  const contract = getOutputContract(contractType);
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const section of contract.sections) {
    const sectionPattern = new RegExp(`\\*\\*${section.name}\\*\\*`, 'i');
    const hasSection = sectionPattern.test(response);

    if (section.required && !hasSection) {
      missing.push(section.name);
    } else if (!section.required && !hasSection) {
      // Optional section not present - that's fine
    }
  }

  // Check for common issues
  if (!response.includes('`') && response.includes('file')) {
    warnings.push('File paths should be wrapped in backticks for clarity');
  }

  if (response.includes('[TODO]') || response.includes('[TBD]')) {
    warnings.push('Response contains placeholders that should be filled in');
  }

  // Check for verification section quality
  if (response.includes('**Verification**')) {
    if (!response.includes('Validated:') && !response.includes('Gaps:')) {
      warnings.push('Verification section should explicitly state what was and was not validated');
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Extract sections from a response
 */
export function extractSections(response: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const sectionPattern = /\*\*([A-Za-z\s]+)\*\*\n([\s\S]*?)(?=\*\*[A-Za-z\s]+\*\*|\n---|\n##|$)/g;

  let match;
  while ((match = sectionPattern.exec(response)) !== null) {
    const sectionName = match[1]?.trim();
    const sectionContent = match[2]?.trim();
    if (sectionName && sectionContent !== undefined) {
      sections[sectionName] = sectionContent;
    }
  }

  return sections;
}

export const OutputContracts = {
  get: getOutputContract,
  getTemplate: getContractTemplate,
  getAvailable: getAvailableContracts,
  recommend: recommendContract,
  validate: validateResponse,
  extractSections,
  STANDARD: STANDARD_CONTRACT,
  MINIMAL: MINIMAL_CONTRACT,
  DETAILED: DETAILED_CONTRACT,
};

export default OutputContracts;
