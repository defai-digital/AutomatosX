# Agent Practices & Guidelines System PRD

## Overview

This PRD defines a **Practices Domain** that provides organizational rules, conventions, and guidelines to agents. It leverages AutomatosX's core concepts (contracts, domains, workflows, invariants, guards) to create a **self-enforcing organizational system**.

**Problem Statement:**
- Agents lack standardized guidance on organizational practices
- No enforcement of file placement conventions (PRD/, REPORT/, tmp/)
- Missing connection between organizational rules and guard enforcement
- Flat folder structures become unmaintainable as projects scale

**Solution:**
Create a Practices Domain with:
1. **Practices Contract** - Schema-driven practice definitions
2. **Practices Guard Gates** - Runtime enforcement of organizational rules
3. **Practices Ability** - Automatic injection into agent context
4. **Folder Convention System** - Standardized output organization

---

## 1. Contract: Practices Schema

**Location:** `packages/contracts/src/practices/v1/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================
// Practice Definition Schema
// ============================================================

export const PracticeIdSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, 'Must be lowercase with dashes');

export const PracticeCategorySchema = z.enum([
  'folder-convention',    // File placement rules
  'naming-convention',    // Naming standards
  'code-convention',      // Coding practices
  'documentation',        // Doc requirements
  'workflow-convention',  // Process standards
  'agent-convention',     // Agent behavior rules
]);

export const EnforcementLevelSchema = z.enum([
  'required',   // FAIL if violated (guard blocks)
  'recommended', // WARN if violated (guard warns)
  'optional',   // INFO only (guidance, no enforcement)
]);

export const PracticeSchema = z.object({
  practiceId: PracticeIdSchema,
  category: PracticeCategorySchema,
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),

  // The actual rule/guideline content
  content: z.string().min(1).max(10000),

  // Enforcement configuration
  enforcement: EnforcementLevelSchema.default('recommended'),
  guardGateId: z.string().optional(), // Link to guard gate

  // Scope control
  applicableTo: z.object({
    agents: z.array(z.string()).default(['*']), // Agent patterns
    workflows: z.array(z.string()).default(['*']), // Workflow patterns
    fileTypes: z.array(z.string()).optional(), // e.g., ['*.md', '*.ts']
  }).default({}),

  // Examples for clarity
  examples: z.array(z.object({
    description: z.string(),
    correct: z.string(),
    incorrect: z.string().optional(),
  })).default([]),

  // Metadata
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

export type Practice = z.infer<typeof PracticeSchema>;

// ============================================================
// Folder Convention Schema (Specialized Practice)
// ============================================================

export const FolderConventionSchema = z.object({
  folderId: z.string(),
  path: z.string(), // Relative path from workspace root
  purpose: z.string(),
  description: z.string(),

  // File patterns that belong in this folder
  filePatterns: z.array(z.string()), // e.g., ['*.md', 'PRD-*.md']

  // Content type classification
  contentTypes: z.array(z.enum([
    'prd',           // Product requirement documents
    'report',        // Analysis reports
    'temp',          // Temporary/scratch files
    'checkpoint',    // Execution checkpoints
    'config',        // Configuration files
    'context',       // Agent context files
    'ability',       // Ability definitions
    'agent',         // Agent profiles
    'workflow',      // Workflow definitions
  ])),

  // Organization rules
  organization: z.object({
    subfolders: z.array(z.object({
      name: z.string(),
      purpose: z.string(),
      condition: z.string().optional(), // When to use this subfolder
    })).optional(),
    namingPattern: z.string().optional(), // Regex for filenames
    versioningScheme: z.enum(['date', 'semver', 'sequential', 'none']).optional(),
    archivePolicy: z.enum(['manual', 'auto-30d', 'auto-90d', 'never']).optional(),
  }).default({}),

  // Lifecycle management
  lifecycle: z.object({
    maxAgeMs: z.number().optional(), // Auto-cleanup after this age
    maxFiles: z.number().optional(), // Max files before cleanup warning
    maxSizeBytes: z.number().optional(), // Max folder size
  }).optional(),
});

export type FolderConvention = z.infer<typeof FolderConventionSchema>;

// ============================================================
// Practices Configuration Schema
// ============================================================

export const PracticesConfigSchema = z.object({
  // Global enablement
  enabled: z.boolean().default(true),

  // Folder conventions
  folders: z.array(FolderConventionSchema).default([]),

  // Practice definitions
  practices: z.array(PracticeSchema).default([]),

  // Injection settings
  injection: z.object({
    // Auto-inject practices into agent context
    autoInject: z.boolean().default(true),
    // Max tokens for practice injection
    maxTokens: z.number().default(5000),
    // Practice categories to inject
    categories: z.array(PracticeCategorySchema).optional(),
  }).default({}),

  // Enforcement settings
  enforcement: z.object({
    // Enable guard integration
    guardsEnabled: z.boolean().default(true),
    // Default enforcement level for new practices
    defaultLevel: EnforcementLevelSchema.default('recommended'),
    // Block on required practice violations
    blockOnViolation: z.boolean().default(true),
  }).default({}),
});

export type PracticesConfig = z.infer<typeof PracticesConfigSchema>;

// ============================================================
// Practice Violation Schema (Guard Output)
// ============================================================

export const PracticeViolationSchema = z.object({
  practiceId: PracticeIdSchema,
  practiceName: z.string(),
  category: PracticeCategorySchema,
  enforcement: EnforcementLevelSchema,

  // What was violated
  violation: z.object({
    type: z.enum(['wrong-folder', 'wrong-name', 'missing-content', 'invalid-format']),
    description: z.string(),
    file: z.string().optional(),
    expected: z.string().optional(),
    actual: z.string().optional(),
  }),

  // How to fix
  suggestion: z.string(),
  autoFixable: z.boolean().default(false),
});

export type PracticeViolation = z.infer<typeof PracticeViolationSchema>;
```

---

## 2. Invariants

**Location:** `packages/contracts/src/practices/v1/invariants.md`

```markdown
# Practices Domain Invariants

## INV-PRAC-001: Folder Conventions Are Deterministic
**Statement:** Given the same file path and content type, folder convention resolution
MUST return the same target folder.

**Rationale:** Predictable file organization enables automation and reduces confusion.

**Enforcement:** Unit tests + guard gate validation.

---

## INV-PRAC-002: Required Practices Block on Violation
**Statement:** Practices with `enforcement: 'required'` MUST cause guard gates to
return FAIL status, blocking the operation.

**Rationale:** Required practices are non-negotiable organizational rules.

**Enforcement:** Guard gate integration + step guard policies.

---

## INV-PRAC-003: Practice Injection is Idempotent
**Statement:** Injecting the same practices multiple times produces identical output.

**Rationale:** Prevents context pollution from repeated injections.

**Enforcement:** Hash-based deduplication in injection logic.

---

## INV-PRAC-004: Folder Lifecycles Are Respected
**Statement:** Files exceeding folder lifecycle limits (age, count, size) MUST
trigger warnings or auto-cleanup based on policy.

**Rationale:** Prevents unbounded growth of temporary/archive folders.

**Enforcement:** Cleanup workflow + monitoring hooks.

---

## INV-PRAC-005: Practices Are Versioned
**Statement:** All practice modifications MUST increment version and maintain
backward compatibility for one major version.

**Rationale:** Enables gradual adoption of practice changes.

**Enforcement:** Schema validation + migration tooling.
```

---

## 3. Default Folder Conventions

**Location:** `packages/core/practices-domain/src/defaults.ts`

```typescript
import type { FolderConvention, Practice } from '@defai.digital/contracts/practices/v1';

export const DEFAULT_FOLDER_CONVENTIONS: FolderConvention[] = [
  // PRD Folder
  {
    folderId: 'prd',
    path: 'PRD',
    purpose: 'Product Requirement Documents',
    description: 'All planning documents, design specs, and requirement documents',
    filePatterns: ['*.md', 'PRD-*.md', '*-PRD.md'],
    contentTypes: ['prd'],
    organization: {
      subfolders: [
        { name: 'active', purpose: 'Currently being implemented', condition: 'status=active' },
        { name: 'completed', purpose: 'Successfully implemented', condition: 'status=completed' },
        { name: 'archived', purpose: 'Superseded or deprecated', condition: 'status=archived' },
        { name: 'draft', purpose: 'Work in progress', condition: 'status=draft' },
      ],
      namingPattern: '^[A-Z][A-Z0-9-]+-PRD\\.md$|^[A-Z][A-Z0-9-]+\\.md$',
      versioningScheme: 'semver',
      archivePolicy: 'manual',
    },
    lifecycle: {
      maxFiles: 100,
    },
  },

  // REPORT Folder
  {
    folderId: 'report',
    path: 'REPORT',
    purpose: 'Analysis and Status Reports',
    description: 'Generated reports, analysis outputs, and status documents',
    filePatterns: ['*.md', '*.json', '*.html'],
    contentTypes: ['report'],
    organization: {
      subfolders: [
        { name: 'analysis', purpose: 'Code/architecture analysis reports' },
        { name: 'status', purpose: 'Project status reports' },
        { name: 'commercial', purpose: 'Business/marketing reports' },
        { name: 'audit', purpose: 'Security and compliance audits' },
      ],
      namingPattern: '^\\d{2}-[a-z-]+\\.md$|^[A-Z][A-Za-z0-9-]+\\.md$',
      versioningScheme: 'date',
      archivePolicy: 'auto-90d',
    },
    lifecycle: {
      maxAgeMs: 90 * 24 * 60 * 60 * 1000, // 90 days
      maxFiles: 200,
    },
  },

  // TMP Folder
  {
    folderId: 'tmp',
    path: 'tmp',
    purpose: 'Temporary Files',
    description: 'Scratch files, intermediate outputs, and temporary data',
    filePatterns: ['*'],
    contentTypes: ['temp', 'checkpoint'],
    organization: {
      subfolders: [
        { name: 'checkpoints', purpose: 'Workflow execution checkpoints' },
        { name: 'scratch', purpose: 'Temporary scratch files' },
        { name: 'cache', purpose: 'Cached computation results' },
      ],
      versioningScheme: 'none',
      archivePolicy: 'auto-30d',
    },
    lifecycle: {
      maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxSizeBytes: 500 * 1024 * 1024, // 500MB
    },
  },

  // .automatosx Folder (Runtime Data)
  {
    folderId: 'runtime',
    path: '.automatosx',
    purpose: 'Runtime Configuration and Data',
    description: 'Project-local configuration, agent profiles, and runtime data',
    filePatterns: ['*.json', '*.db', '*.md'],
    contentTypes: ['config', 'context', 'ability', 'agent'],
    organization: {
      subfolders: [
        { name: 'context', purpose: 'AI context files (conventions, practices)' },
        { name: 'memory', purpose: 'Persistent memory storage' },
        { name: 'traces', purpose: 'Execution traces' },
        { name: 'sessions', purpose: 'Collaboration sessions' },
      ],
    },
  },

  // Examples Folder
  {
    folderId: 'examples',
    path: 'examples',
    purpose: 'Templates and Examples',
    description: 'Reference implementations, templates, and example configurations',
    filePatterns: ['*.json', '*.yaml', '*.md'],
    contentTypes: ['ability', 'agent', 'workflow'],
    organization: {
      subfolders: [
        { name: 'abilities', purpose: 'Ability templates' },
        { name: 'agents', purpose: 'Agent profile templates' },
        { name: 'workflows', purpose: 'Workflow templates' },
        { name: 'context', purpose: 'Context file templates' },
      ],
    },
  },
];

export const DEFAULT_PRACTICES: Practice[] = [
  // PRD Placement Practice
  {
    practiceId: 'prd-placement',
    category: 'folder-convention',
    name: 'PRD File Placement',
    description: 'All Product Requirement Documents must be placed in the PRD/ folder',
    content: `
## PRD File Placement

All Product Requirement Documents (PRDs) MUST be placed in the \`PRD/\` folder.

### Rules:
1. All files ending with \`-PRD.md\` or \`PRD-*.md\` go in \`PRD/\`
2. Use subfolders for lifecycle:
   - \`PRD/draft/\` - Work in progress
   - \`PRD/active/\` - Currently being implemented
   - \`PRD/completed/\` - Successfully implemented
   - \`PRD/archived/\` - Superseded or deprecated

### Naming Convention:
- Use UPPERCASE-KEBAB-CASE: \`FEATURE-NAME-PRD.md\`
- Be descriptive but concise
- Include version suffix for major revisions: \`FEATURE-NAME-v2-PRD.md\`
`,
    enforcement: 'required',
    guardGateId: 'folder-placement',
    applicableTo: {
      agents: ['*'],
      fileTypes: ['*-PRD.md', 'PRD-*.md'],
    },
    examples: [
      {
        description: 'Creating a new feature PRD',
        correct: 'PRD/draft/USER-AUTH-PRD.md',
        incorrect: 'docs/user-auth-prd.md',
      },
      {
        description: 'Archiving completed PRD',
        correct: 'PRD/archived/LEGACY-API-PRD.md',
        incorrect: 'PRD/LEGACY-API-PRD.md (left in root)',
      },
    ],
    version: '1.0.0',
    tags: ['organization', 'documentation'],
    enabled: true,
  },

  // Report Placement Practice
  {
    practiceId: 'report-placement',
    category: 'folder-convention',
    name: 'Report File Placement',
    description: 'All reports and analysis outputs must be placed in the REPORT/ folder',
    content: `
## Report File Placement

All analysis reports, status documents, and generated reports MUST be in \`REPORT/\`.

### Subfolders:
- \`REPORT/analysis/\` - Code analysis, architecture reviews
- \`REPORT/status/\` - Project status, sprint summaries
- \`REPORT/commercial/\` - Business reports, marketing docs
- \`REPORT/audit/\` - Security audits, compliance reports

### Naming Convention:
- Sequential prefix for ordering: \`01-topic.md\`, \`02-topic.md\`
- Or descriptive names: \`CODE-QUALITY-REPORT.md\`

### Auto-Archive:
Reports older than 90 days are automatically moved to archive.
`,
    enforcement: 'required',
    guardGateId: 'folder-placement',
    applicableTo: {
      agents: ['*'],
      fileTypes: ['*-REPORT.md', 'REPORT-*.md', '*-report.md'],
    },
    examples: [
      {
        description: 'Creating analysis report',
        correct: 'REPORT/analysis/CODE-QUALITY-REPORT.md',
        incorrect: 'analysis-report.md (in root)',
      },
    ],
    version: '1.0.0',
    tags: ['organization', 'documentation'],
    enabled: true,
  },

  // Temporary File Practice
  {
    practiceId: 'temp-file-placement',
    category: 'folder-convention',
    name: 'Temporary File Placement',
    description: 'Temporary and scratch files must be placed in tmp/ folder',
    content: `
## Temporary File Placement

All temporary, scratch, and intermediate files MUST be in \`tmp/\`.

### Subfolders:
- \`tmp/checkpoints/\` - Workflow execution checkpoints
- \`tmp/scratch/\` - Temporary working files
- \`tmp/cache/\` - Cached computation results

### Lifecycle:
- Files older than 30 days are automatically cleaned
- Max folder size: 500MB (warning at 80%)

### What Belongs Here:
- Intermediate computation results
- Debug outputs
- Test artifacts (not committed)
- Temporary downloads
`,
    enforcement: 'recommended',
    guardGateId: 'folder-placement',
    applicableTo: {
      agents: ['*'],
    },
    examples: [
      {
        description: 'Storing checkpoint',
        correct: 'tmp/checkpoints/workflow-123.json',
        incorrect: 'checkpoints/workflow-123.json (in root)',
      },
    ],
    version: '1.0.0',
    tags: ['organization', 'cleanup'],
    enabled: true,
  },

  // Agent Naming Practice
  {
    practiceId: 'agent-naming',
    category: 'naming-convention',
    name: 'Agent ID Naming Convention',
    description: 'Agent IDs must follow lowercase-kebab-case naming',
    content: `
## Agent ID Naming Convention

Agent IDs MUST follow these rules:

### Format:
- Lowercase letters, numbers, and hyphens only
- Must start with a letter
- Max 64 characters
- Pattern: \`^[a-z][a-z0-9-]*$\`

### Good Examples:
- \`backend-engineer\`
- \`code-reviewer\`
- \`security-auditor-v2\`

### Bad Examples:
- \`BackendEngineer\` (uppercase)
- \`123-agent\` (starts with number)
- \`my_agent\` (underscore)
`,
    enforcement: 'required',
    applicableTo: {
      agents: ['*'],
    },
    version: '1.0.0',
    tags: ['naming', 'agents'],
    enabled: true,
  },

  // Workflow Documentation Practice
  {
    practiceId: 'workflow-documentation',
    category: 'documentation',
    name: 'Workflow Documentation',
    description: 'All workflows must include description and step documentation',
    content: `
## Workflow Documentation Requirements

Every workflow definition MUST include:

1. **Workflow Description**: Clear purpose statement
2. **Step Descriptions**: What each step does
3. **Input/Output Documentation**: Expected data shapes
4. **Error Handling**: How failures are handled

### Template:
\`\`\`yaml
workflowId: my-workflow
name: My Workflow
description: |
  Purpose: What this workflow accomplishes
  Trigger: When/how it runs
  Output: What it produces

steps:
  - stepId: step-1
    name: Descriptive Step Name
    description: What this step does and why
\`\`\`
`,
    enforcement: 'recommended',
    applicableTo: {
      workflows: ['*'],
    },
    version: '1.0.0',
    tags: ['documentation', 'workflows'],
    enabled: true,
  },

  // Code Commit Practice
  {
    practiceId: 'commit-message-format',
    category: 'code-convention',
    name: 'Commit Message Format',
    description: 'Commit messages must follow conventional commits format',
    content: `
## Commit Message Format

Follow Conventional Commits specification:

### Format:
\`\`\`
<type>(<scope>): <description>

[optional body]

[optional footer]
\`\`\`

### Types:
- \`feat\`: New feature
- \`fix\`: Bug fix
- \`docs\`: Documentation only
- \`style\`: Formatting, no code change
- \`refactor\`: Code restructure, no behavior change
- \`test\`: Adding tests
- \`chore\`: Maintenance tasks

### Examples:
- \`feat(routing): add cost-aware model selection\`
- \`fix(providers): handle timeout in claude adapter\`
- \`docs(readme): update installation instructions\`
`,
    enforcement: 'recommended',
    applicableTo: {
      agents: ['*'],
    },
    version: '1.0.0',
    tags: ['git', 'commits'],
    enabled: true,
  },
];
```

---

## 4. Guard Gate: Folder Placement

**Location:** `packages/guard/src/gates/folder-placement.ts`

```typescript
import type { GateResult, GovernanceContext } from '@defai.digital/contracts/guard/v1';
import type { FolderConvention, Practice } from '@defai.digital/contracts/practices/v1';
import { DEFAULT_FOLDER_CONVENTIONS, DEFAULT_PRACTICES } from '@defai.digital/core/practices-domain';
import { minimatch } from 'minimatch';

export interface FolderPlacementGateConfig {
  conventions: FolderConvention[];
  practices: Practice[];
}

export async function folderPlacementGate(
  context: GovernanceContext,
  changedFiles: string[],
  config: FolderPlacementGateConfig = {
    conventions: DEFAULT_FOLDER_CONVENTIONS,
    practices: DEFAULT_PRACTICES,
  }
): Promise<GateResult> {
  const violations: Array<{
    file: string;
    expectedFolder: string;
    practice: Practice;
  }> = [];

  for (const file of changedFiles) {
    // Check each practice's folder convention
    for (const practice of config.practices.filter(p =>
      p.category === 'folder-convention' && p.enabled
    )) {
      const applicablePatterns = practice.applicableTo.fileTypes || [];

      // Check if this file matches the practice's patterns
      const matchesPattern = applicablePatterns.some(pattern =>
        minimatch(file, pattern, { matchBase: true })
      );

      if (!matchesPattern) continue;

      // Find the expected convention
      const convention = config.conventions.find(c =>
        c.contentTypes.some(ct => practice.practiceId.includes(ct))
      );

      if (!convention) continue;

      // Check if file is in the correct folder
      const isInCorrectFolder = file.startsWith(convention.path + '/');

      if (!isInCorrectFolder) {
        violations.push({
          file,
          expectedFolder: convention.path,
          practice,
        });
      }
    }
  }

  if (violations.length === 0) {
    return {
      status: 'PASS',
      message: 'All files are in correct folders',
      details: { checkedFiles: changedFiles.length },
    };
  }

  // Determine status based on enforcement levels
  const hasRequired = violations.some(v => v.practice.enforcement === 'required');
  const status = hasRequired ? 'FAIL' : 'WARN';

  return {
    status,
    message: `${violations.length} file(s) in incorrect folders`,
    details: {
      violations: violations.map(v => ({
        file: v.file,
        expectedFolder: v.expectedFolder,
        practiceId: v.practice.practiceId,
        enforcement: v.practice.enforcement,
      })),
    },
    suggestion: violations.map(v =>
      `Move ${v.file} to ${v.expectedFolder}/`
    ).join('\n'),
  };
}
```

---

## 5. Ability: Organizational Practices

**Location:** `examples/abilities/organizational-practices.md`

```markdown
---
abilityId: organizational-practices
displayName: Organizational Practices
category: core
description: Core organizational practices and conventions for AutomatosX projects
tags: [organization, practices, conventions, folders]
priority: 95
applicableTo: ["*"]
version: 1.0.0
---

# Organizational Practices

You MUST follow these organizational practices when working in this codebase.

## Folder Structure

### PRD/ - Product Requirement Documents
- **Purpose:** All planning and design documents
- **Subfolders:**
  - `PRD/draft/` - Work in progress PRDs
  - `PRD/active/` - Currently being implemented
  - `PRD/completed/` - Successfully implemented
  - `PRD/archived/` - Superseded or deprecated
- **Naming:** `FEATURE-NAME-PRD.md` (UPPERCASE-KEBAB-CASE)

### REPORT/ - Reports and Analysis
- **Purpose:** Generated reports and analysis outputs
- **Subfolders:**
  - `REPORT/analysis/` - Code analysis, architecture reviews
  - `REPORT/status/` - Project status reports
  - `REPORT/commercial/` - Business/marketing documents
  - `REPORT/audit/` - Security and compliance audits
- **Naming:** `NN-topic-name.md` (numbered) or `DESCRIPTIVE-NAME.md`

### tmp/ - Temporary Files
- **Purpose:** Scratch files, checkpoints, caches
- **Subfolders:**
  - `tmp/checkpoints/` - Workflow execution state
  - `tmp/scratch/` - Temporary working files
  - `tmp/cache/` - Cached results
- **Lifecycle:** Auto-cleanup after 30 days

### .automatosx/ - Runtime Configuration
- **Purpose:** Project-local configuration and data
- **Contents:**
  - `config.json` - Project configuration
  - `agents.json` - Agent registry
  - `context/` - AI context files
  - `memory/` - Persistent storage

## File Placement Rules

| Content Type | Target Folder | Example |
|-------------|---------------|---------|
| PRD/Design Doc | `PRD/active/` | `PRD/active/AUTH-SYSTEM-PRD.md` |
| Analysis Report | `REPORT/analysis/` | `REPORT/analysis/CODE-QUALITY.md` |
| Status Update | `REPORT/status/` | `REPORT/status/SPRINT-42.md` |
| Temp/Scratch | `tmp/scratch/` | `tmp/scratch/debug-output.txt` |
| Checkpoint | `tmp/checkpoints/` | `tmp/checkpoints/wf-123.json` |

## Naming Conventions

### Agent IDs
- Format: `lowercase-kebab-case`
- Pattern: `^[a-z][a-z0-9-]*$`
- Examples: `backend-engineer`, `code-reviewer-v2`

### Workflow IDs
- Format: `lowercase-kebab-case`
- Examples: `deploy-staging`, `code-review-flow`

### File Names
- PRDs: `UPPERCASE-KEBAB-CASE-PRD.md`
- Reports: `01-lowercase-name.md` or `UPPERCASE-NAME.md`
- Code: Follow language conventions

## Commit Messages

Follow Conventional Commits:
```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Guard Enforcement

These practices are enforced by guard gates:
- `folder-placement` - Validates file locations
- `naming-convention` - Validates naming patterns
- `documentation` - Validates required docs

Violations of **required** practices will block operations.
```

---

## 6. Workflow: Cleanup Lifecycle

**Location:** `examples/workflows/cleanup-lifecycle.yaml`

```yaml
workflowId: cleanup-lifecycle
name: Folder Lifecycle Cleanup
version: '1.0.0'
description: |
  Automated cleanup workflow for temporary and archived files.
  Runs on schedule or manual trigger to enforce folder lifecycle policies.

triggers:
  - type: schedule
    cron: '0 0 * * 0'  # Weekly on Sunday midnight
  - type: manual

input:
  dryRun:
    type: boolean
    default: true
    description: Preview cleanup without deleting

steps:
  - stepId: scan-tmp
    name: Scan Temporary Files
    type: tool
    config:
      tool: file-scan
      params:
        path: tmp/
        maxAgeMs: 2592000000  # 30 days
    description: Find files exceeding 30-day lifecycle in tmp/

  - stepId: scan-reports
    name: Scan Old Reports
    type: tool
    config:
      tool: file-scan
      params:
        path: REPORT/
        maxAgeMs: 7776000000  # 90 days
        exclude: ['REPORT/commercial/**']
    description: Find reports exceeding 90-day lifecycle

  - stepId: review-candidates
    name: Review Cleanup Candidates
    type: prompt
    config:
      prompt: |
        Review these files for cleanup:

        Temporary files (30+ days old):
        ${previousOutputs['scan-tmp'].files}

        Old reports (90+ days old):
        ${previousOutputs['scan-reports'].files}

        For each file, determine:
        1. Should it be deleted?
        2. Should it be archived?
        3. Should it be kept (exception)?

        Output a cleanup plan.

  - stepId: execute-cleanup
    name: Execute Cleanup
    type: conditional
    config:
      condition: '!input.dryRun'
      then:
        - stepId: delete-files
          type: tool
          config:
            tool: file-delete
            params:
              files: ${previousOutputs['review-candidates'].toDelete}
        - stepId: archive-files
          type: tool
          config:
            tool: file-move
            params:
              files: ${previousOutputs['review-candidates'].toArchive}
              destination: archive/
      else:
        - stepId: report-only
          type: prompt
          config:
            prompt: |
              Dry run complete. Would delete:
              ${previousOutputs['review-candidates'].toDelete}

              Would archive:
              ${previousOutputs['review-candidates'].toArchive}

output:
  deletedCount: ${previousOutputs['execute-cleanup'].deletedCount}
  archivedCount: ${previousOutputs['execute-cleanup'].archivedCount}
  report: ${previousOutputs['review-candidates']}
```

---

## 7. MCP Tool: practice_check

**Location:** `packages/mcp-server/src/tools/practices.ts`

```typescript
import { z } from 'zod';
import { PracticesConfigSchema, PracticeViolationSchema } from '@defai.digital/contracts/practices/v1';

export const practiceCheckInputSchema = z.object({
  files: z.array(z.string()).describe('Files to check'),
  categories: z.array(z.string()).optional().describe('Practice categories to check'),
  enforcement: z.enum(['all', 'required', 'recommended']).default('all'),
});

export const practiceCheckOutputSchema = z.object({
  status: z.enum(['PASS', 'WARN', 'FAIL']),
  violations: z.array(PracticeViolationSchema),
  suggestions: z.array(z.string()),
  checkedPractices: z.number(),
});

export const practiceListInputSchema = z.object({
  category: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const practiceInjectInputSchema = z.object({
  agentId: z.string(),
  categories: z.array(z.string()).optional(),
  maxTokens: z.number().default(5000),
});

// Tool definitions
export const practicesTools = {
  practice_check: {
    name: 'practice_check',
    description: 'Check files against organizational practices (folder conventions, naming, etc.)',
    inputSchema: practiceCheckInputSchema,
    outputSchema: practiceCheckOutputSchema,
  },
  practice_list: {
    name: 'practice_list',
    description: 'List available organizational practices',
    inputSchema: practiceListInputSchema,
  },
  practice_inject: {
    name: 'practice_inject',
    description: 'Get practice content for agent context injection',
    inputSchema: practiceInjectInputSchema,
  },
};
```

---

## 8. Integration: Agent System Prompt Enhancement

The practices system integrates with agents through automatic ability injection:

**Enhanced Agent Execution Flow:**

```
1. Agent receives task
2. Load agent profile (including abilities.core)
3. AUTO-INJECT: organizational-practices ability (if practices.injection.autoInject = true)
4. Inject task-based abilities
5. Execute workflow steps
6. POST-CHECK: Run practice guard gates on any created/modified files
7. Return results with practice compliance status
```

**Configuration in `.automatosx/config.json`:**

```json
{
  "practices": {
    "enabled": true,
    "injection": {
      "autoInject": true,
      "maxTokens": 5000,
      "categories": ["folder-convention", "naming-convention"]
    },
    "enforcement": {
      "guardsEnabled": true,
      "defaultLevel": "recommended",
      "blockOnViolation": true
    }
  }
}
```

---

## 9. Implementation Plan

### Phase 1: Contract & Domain (Week 1)
- [ ] Create `packages/contracts/src/practices/v1/schema.ts`
- [ ] Create `packages/contracts/src/practices/v1/invariants.md`
- [ ] Create `packages/core/practices-domain/` with defaults
- [ ] Add contract tests

### Phase 2: Guard Integration (Week 2)
- [ ] Implement `folder-placement` gate
- [ ] Implement `naming-convention` gate
- [ ] Add to guard policy engine
- [ ] Add guard tests

### Phase 3: MCP Tools (Week 3)
- [ ] Implement `practice_check` tool
- [ ] Implement `practice_list` tool
- [ ] Implement `practice_inject` tool
- [ ] Add tool tests

### Phase 4: Agent Integration (Week 4)
- [ ] Create `organizational-practices` ability
- [ ] Add auto-injection logic to agent executor
- [ ] Add post-check guards to workflow runner
- [ ] E2E tests

### Phase 5: Lifecycle Workflow (Week 5)
- [ ] Implement cleanup workflow
- [ ] Add scheduling support
- [ ] Documentation

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Practice coverage | 100% of created files checked |
| Folder convention compliance | >95% of files in correct folders |
| Guard enforcement | 0 required violations merged |
| Auto-cleanup | tmp/ under 500MB, REPORT/ under 200 files |
| Agent awareness | 100% agents receive practice injection |

---

## Appendix: Default Configuration File

**Location:** `.automatosx/config.json` (project-level)

```json
{
  "practices": {
    "enabled": true,
    "folders": [
      {
        "folderId": "prd",
        "path": "PRD",
        "contentTypes": ["prd"],
        "organization": {
          "subfolders": ["draft", "active", "completed", "archived"]
        }
      },
      {
        "folderId": "report",
        "path": "REPORT",
        "contentTypes": ["report"],
        "organization": {
          "subfolders": ["analysis", "status", "commercial", "audit"]
        }
      },
      {
        "folderId": "tmp",
        "path": "tmp",
        "contentTypes": ["temp", "checkpoint"],
        "lifecycle": {
          "maxAgeMs": 2592000000,
          "maxSizeBytes": 524288000
        }
      }
    ],
    "injection": {
      "autoInject": true,
      "maxTokens": 5000
    },
    "enforcement": {
      "guardsEnabled": true,
      "blockOnViolation": true
    }
  }
}
```
