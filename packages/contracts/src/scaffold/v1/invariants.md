# Scaffold Domain Invariants

## Overview

This document defines the behavioral invariants for the Scaffold domain, which provides contract-first scaffolding capabilities for creating projects, domains, contracts, and guard policies.

## Schema Invariants

### INV-SCF-001: Valid Domain Name Format
Domain names MUST be lowercase alphanumeric with hyphens.
- **Enforcement**: schema
- **Test**: `DomainNameSchema` rejects invalid formats
- **Pattern**: `^[a-z][a-z0-9-]*$`

### INV-SCF-002: No Path Traversal
Output paths MUST NOT contain path traversal sequences.
- **Enforcement**: schema
- **Test**: `OutputPathSchema` rejects paths with `..`

### INV-SCF-003: Valid Package Scope
Package scope MUST start with @ followed by lowercase alphanumeric.
- **Enforcement**: schema
- **Test**: `PackageScopeSchema` validates format
- **Pattern**: `^@[a-z][a-z0-9-]*$`

## Contract Scaffolding Invariants

### INV-SCF-101: Contract Files Generated Together
When scaffolding a contract, schema.ts, invariants.md, and index.ts MUST be created together.
- **Enforcement**: runtime
- **Files**: `schema.ts`, `invariants.md`, `index.ts`

### INV-SCF-102: Invariant Codes Follow Format
Generated invariant codes MUST follow the INV-XXX-NNN pattern.
- **Enforcement**: template
- **Pattern**: `INV-{3-letter domain code}-{3-digit number}`
- **Example**: `INV-ORD-001`, `INV-PAY-101`

## Domain Scaffolding Invariants

### INV-SCF-201: Domain Package Structure
Domain packages MUST contain package.json, src/index.ts, and type exports.
- **Enforcement**: runtime
- **Required Files**: `package.json`, `src/index.ts`, `src/types.ts`, `src/service.ts`

### INV-SCF-202: Contract Dependency
Domain packages MUST declare dependency on @automatosx/contracts (or equivalent).
- **Enforcement**: template
- **Verification**: package.json contains contracts dependency

## Guard Policy Invariants

### INV-SCF-301: Policy ID Uniqueness
Policy IDs MUST be unique within the guard policies directory.
- **Enforcement**: runtime
- **Test**: Check for existing policy before creation

### INV-SCF-302: Positive Change Radius
Change radius MUST be a positive integer between 1 and 100.
- **Enforcement**: schema
- **Validation**: `z.number().int().min(1).max(100)`

### INV-SCF-303: Valid Gates
Gates MUST be one of the defined gate types.
- **Enforcement**: schema
- **Valid Values**: `path_violation`, `dependency`, `change_radius`, `contract_tests`, `secrets`

## Project Scaffolding Invariants

### INV-SCF-401: Template Existence
Template MUST exist before project creation.
- **Enforcement**: runtime
- **Valid Templates**: `monorepo`, `standalone`
- **Error**: `SCF_TEMPLATE_NOT_FOUND` if template missing

### INV-SCF-402: Required Domain
Project scaffolding REQUIRES a domain name.
- **Enforcement**: schema
- **Field**: `domainName` is required

### INV-SCF-403: Post-Create Commands
Generated projects MUST include valid post-create commands.
- **Enforcement**: template
- **Typical Commands**: `pnpm install`, `pnpm build`, `pnpm test`

## Dry Run Invariants

### INV-SCF-501: Dry Run Idempotent
Dry run operations MUST NOT modify the filesystem.
- **Enforcement**: runtime
- **Test**: No files created when dryRun=true

### INV-SCF-502: Dry Run Preview Accurate
Dry run output MUST accurately reflect what would be created.
- **Enforcement**: runtime
- **Test**: File list matches actual creation when dryRun=false

## Template Processing Invariants

### INV-SCF-601: Variable Substitution
All template variables MUST be substituted.
- **Enforcement**: runtime
- **Variables**: `{{projectName}}`, `{{domainName}}`, `{{scope}}`, etc.

### INV-SCF-602: Helper Functions
Template helpers MUST produce consistent output.
- **Enforcement**: runtime
- **Helpers**: `pascalCase`, `upperCase`, `substring`
- **Example**: `{{pascalCase order}}` → `Order`

## Error Handling Invariants

### INV-SCF-701: Structured Errors
Scaffold errors MUST include error code and message.
- **Enforcement**: runtime
- **Required Fields**: `code`, `message`
- **Codes**: See `ScaffoldErrorCode` enum

### INV-SCF-702: Rollback on Failure
If file creation fails mid-operation, previously created files SHOULD be cleaned up.
- **Enforcement**: runtime (best effort)
- **Note**: Dry run prevents this scenario
