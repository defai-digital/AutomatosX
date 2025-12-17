---
abilityId: organizational-practices
displayName: Organizational Practices
category: core
description: Core organizational practices and conventions for AutomatosX projects
tags: [organization, practices, conventions, folders, naming]
priority: 95
applicableTo: ["*"]
version: 1.0.0
---

# Organizational Practices

You MUST follow these organizational practices when working in this codebase.

## Folder Structure

### PRD/ - Product Requirement Documents
- **Purpose:** All planning, design, and requirement documents
- **Subfolders:**
  - `PRD/draft/` - Work in progress PRDs
  - `PRD/active/` - Currently being implemented
  - `PRD/completed/` - Successfully implemented
  - `PRD/archived/` - Superseded or deprecated
- **Naming:** `FEATURE-NAME-PRD.md` or `FEATURE-NAME.md` (UPPERCASE-KEBAB-CASE)
- **When to use:** Creating design docs, feature specs, implementation plans, architecture decisions

### REPORT/ - Reports and Analysis
- **Purpose:** Generated reports, analysis outputs, and status documents
- **Subfolders:**
  - `REPORT/analysis/` - Code analysis, architecture reviews, gap analysis
  - `REPORT/status/` - Project status reports, sprint summaries
  - `REPORT/commercial/` - Business/marketing documents, pitch decks
  - `REPORT/audit/` - Security audits, compliance reports
- **Naming:** `NN-topic-name.md` (numbered for ordering) or `DESCRIPTIVE-NAME.md`
- **When to use:** Generating analysis results, status updates, review findings

### tmp/ - Temporary Files
- **Purpose:** Scratch files, intermediate outputs, checkpoints, caches
- **Subfolders:**
  - `tmp/checkpoints/` - Workflow execution state and recovery data
  - `tmp/scratch/` - Temporary working files
  - `tmp/cache/` - Cached computation results
- **Lifecycle:** Auto-cleanup after 30 days, max 500MB
- **When to use:** Debug outputs, intermediate computations, temporary downloads

### .automatosx/ - Runtime Configuration
- **Purpose:** Project-local AutomatosX configuration and data
- **Contents:**
  - `config.json` - Project configuration (overrides user config)
  - `agents.json` - Agent registry
  - `context/` - AI context files (conventions.md, etc.)
  - `memory/` - Persistent key-value storage

### examples/ - Templates and Examples
- **Purpose:** Reference implementations and templates
- **Subfolders:**
  - `examples/abilities/` - Ability templates
  - `examples/agents/` - Agent profile templates
  - `examples/workflows/` - Workflow templates
  - `examples/context/` - Context file templates

## File Placement Decision Tree

When creating a new file, follow this decision tree:

```
Is it a planning/design document?
  YES → PRD/
    Is it work-in-progress? → PRD/draft/
    Is it being implemented? → PRD/active/
    Is it done? → PRD/completed/
    Is it obsolete? → PRD/archived/

Is it an analysis or report?
  YES → REPORT/
    Is it code/architecture analysis? → REPORT/analysis/
    Is it a status update? → REPORT/status/
    Is it business/marketing? → REPORT/commercial/
    Is it security/compliance? → REPORT/audit/

Is it temporary/intermediate?
  YES → tmp/
    Is it execution state? → tmp/checkpoints/
    Is it scratch work? → tmp/scratch/
    Is it cached data? → tmp/cache/

Is it configuration?
  YES → .automatosx/
    Is it agent context? → .automatosx/context/

Is it a template/example?
  YES → examples/
```

## Naming Conventions

### Agent IDs
- **Format:** `lowercase-kebab-case`
- **Pattern:** `^[a-z][a-z0-9-]*$`
- **Max Length:** 64 characters
- **Examples:** `backend-engineer`, `code-reviewer`, `security-auditor-v2`
- **Bad Examples:** `BackendEngineer`, `123-agent`, `my_agent`

### Workflow IDs
- **Format:** `lowercase-kebab-case`
- **Examples:** `deploy-staging`, `code-review-flow`, `cleanup-lifecycle`

### Ability IDs
- **Format:** `lowercase-kebab-case`
- **Examples:** `api-design`, `code-review`, `testing-strategy`

### PRD Files
- **Format:** `UPPERCASE-KEBAB-CASE.md` or `UPPERCASE-KEBAB-CASE-PRD.md`
- **Examples:** `AUTH-SYSTEM-PRD.md`, `API-GATEWAY.md`, `AGENT-PRACTICES-PRD.md`

### Report Files
- **Format:** Sequential numbering or descriptive
- **Examples:** `01-product-positioning.md`, `CODE-QUALITY-REPORT.md`

## Commit Messages

Follow Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, no code change
- `refactor` - Code restructure, no behavior change
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### Examples:
```
feat(routing): add cost-aware model selection
fix(providers): handle timeout in claude adapter
docs(readme): update installation instructions
refactor(workflow): simplify step executor logic
test(guards): add folder placement gate tests
chore(deps): update zod to v3.22
```

## Code Organization

### Contract-First Development
1. Define schema in `packages/contracts/src/<domain>/v1/schema.ts`
2. Document invariants in `packages/contracts/src/<domain>/v1/invariants.md`
3. Implement domain logic in `packages/core/<domain>-domain/src/`
4. Add tests in `tests/contract/<domain>.test.ts` and `tests/core/<domain>.test.ts`

### Dependency Layers (Strictly Enforced)
```
CLI / MCP Server (application)
        ↓
Guard (governance)
        ↓
Core Domains (business logic)
        ↓
Adapters (external integrations)
        ↓
Contracts (schemas - ZERO dependencies)
```

## Guard Enforcement

These practices are enforced by guard gates:
- `folder-placement` - Validates file locations
- `naming-convention` - Validates naming patterns

**Required** practices block operations on violation.
**Recommended** practices generate warnings.

## Quick Reference

| Content | Folder | Example |
|---------|--------|---------|
| New feature design | `PRD/draft/` | `PRD/draft/USER-AUTH-PRD.md` |
| Active implementation | `PRD/active/` | `PRD/active/API-GATEWAY.md` |
| Code analysis | `REPORT/analysis/` | `REPORT/analysis/CODE-QUALITY.md` |
| Sprint status | `REPORT/status/` | `REPORT/status/SPRINT-42.md` |
| Debug output | `tmp/scratch/` | `tmp/scratch/debug.log` |
| Workflow state | `tmp/checkpoints/` | `tmp/checkpoints/wf-123.json` |
| Agent context | `.automatosx/context/` | `.automatosx/context/conventions.md` |
