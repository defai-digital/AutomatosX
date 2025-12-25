# Architecture Schema Compliance PRD

## Overview

This PRD addresses architecture rule violations identified during codebase compliance analysis. The primary issue is that MCP-specific schemas are defined in `packages/mcp-server/src/schema-registry.ts` instead of the contracts package, violating the contract-first design principle.

## Problem Statement

### Violation #1: MCP Schemas Outside Contracts (HIGH)

**Current State**: 14 MCP tool schemas are defined in `packages/mcp-server/src/schema-registry.ts`:
- `BugfixListInputSchema`
- `RefactorListInputSchema`
- `DesignListInputSchema`
- `TaskStatusInputSchema`
- `QueueListInputSchema`
- `MetricsListInputSchema`
- `TimerStopInputSchema`
- `AbilityListInputSchema`
- `AbilityListOutputSchema`
- `AbilityGetInputSchema`
- `AbilityInjectInputSchema`
- `AbilityRegisterInputSchema`
- `AbilityRemoveInputSchema`
- `AbilityRemoveOutputSchema`

**Rule Violated**: `INV-MCP-VAL-002: All schemas defined in contracts package`

**Impact**:
- Violates contract-first architecture
- Makes schemas harder to discover
- Prevents other packages from reusing these schemas
- Inconsistent with how other schemas are organized

### Violation #2: Empty Guard Policies Directory (LOW)

**Current State**: `packages/guard/policies/` directory exists but is empty.

**Impact**: Minor - policies are correctly defined in code, directory is vestigial.

## Solution Design

### Phase 1: Move MCP Tool Schemas to Contracts

Create new schema file in contracts package that exports all MCP-specific tool schemas.

**New File**: `packages/contracts/src/mcp/v1/tools/schemas.ts`

This file will contain:
1. Tool-specific list/filter schemas (bugfix_list, refactor_list, etc.)
2. Ability tool schemas (list, get, inject, register, remove)
3. Re-export from contracts index

### Phase 2: Update MCP Server Imports

Modify `packages/mcp-server/src/schema-registry.ts` to:
1. Import all schemas from `@defai.digital/contracts`
2. Remove local schema definitions
3. Keep only the registry mappings

### Phase 3: Clean Up Guard Directory

Remove empty `packages/guard/policies/` directory.

## Implementation Plan

### Step 1: Create MCP Tool Schemas in Contracts

**File**: `packages/contracts/src/mcp/v1/tools/schemas.ts`

```typescript
import { z } from 'zod';
import {
  BugSeveritySchema,
  BugCategorySchema,
} from '../../bugfix/v1/schema.js';
import {
  RefactorImpactSchema,
} from '../../refactor/v1/schema.js';
import {
  DesignTypeSchema,
  DesignStatusSchema,
} from '../../design/v1/schema.js';
import {
  MetricCategorySchema,
} from '../../telemetry/v1/schema.js';
import {
  AbilitySchema,
  AbilityInjectionRequestSchema,
  AbilityInjectionResultSchema,
} from '../../ability/v1/schema.js';

// Tool-specific list/filter schemas
export const BugfixListInputSchema = z.object({...});
export const RefactorListInputSchema = z.object({...});
// ... etc
```

### Step 2: Export from Contracts Index

**File**: `packages/contracts/src/mcp/v1/index.ts`

Add exports for all new schemas.

### Step 3: Update Schema Registry

**File**: `packages/mcp-server/src/schema-registry.ts`

Replace local definitions with imports from contracts.

### Step 4: Remove Empty Directory

```bash
rmdir packages/guard/policies
```

## Invariants

### INV-MCP-VAL-002: All schemas defined in contracts package
- **Enforcement**: All Zod schemas used for MCP tool validation MUST be defined in `@defai.digital/contracts`
- **Exception**: None. Local schema extensions should use `.extend()` on contract schemas.

## Testing Requirements

1. `pnpm build` - All packages compile successfully
2. `pnpm typecheck` - No type errors
3. `pnpm test` - All tests pass
4. `pnpm deps:check` - No dependency violations

## Success Criteria

1. Zero Zod schema definitions in `packages/mcp-server/src/schema-registry.ts`
2. All MCP tool schemas importable from `@defai.digital/contracts`
3. No empty directories in `packages/guard/`
4. All existing functionality preserved

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Import path changes break builds | Low | Medium | Run full build after changes |
| Schema behavior changes | Low | High | No functional changes to schemas |
| Circular dependencies | Low | High | Contracts has no internal deps |

## Timeline

Single implementation session - all changes are mechanical refactoring.
