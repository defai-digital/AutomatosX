# Invariant Test Coverage Improvement PRD

**Version**: 1.0.0
**Date**: 2025-12-17
**Status**: Draft

---

## Executive Summary

This PRD addresses the primary gap identified in the Architecture Compliance Report: **invariant test coverage is at 43% (70/160 documented invariants)**. While the codebase is architecturally compliant with zero violations, the lack of comprehensive invariant testing creates risk for regression and reduces confidence in behavioral guarantees.

### Current State

| Metric | Value |
|--------|-------|
| Total Documented Invariants | ~160 |
| Currently Tested | ~70 |
| Coverage Percentage | 43% |
| Target Coverage | 90%+ |

### Scope

| Category | Invariants | Current Coverage | Priority |
|----------|-----------|------------------|----------|
| Provider (INV-PROV-*) | 11 | 0% | P0 |
| Config (INV-CFG-*) | 9 | 0% | P0 |
| Storage (INV-ST-*) | 8 | 0% | P0 |
| Ability (INV-ABL-*) | 12 | 0% | P1 |
| Agent (INV-AGT-*) | 6 | Partial | P1 |
| Session (INV-SESS-*) | 6 | 0% | P1 |
| Orchestration (INV-ORC-*) | 6 | 0% | P2 |
| Bugfix (INV-BUG-*) | 6 | 0% | P2 |
| Refactor (INV-REF-*) | 5 | 0% | P2 |
| Analysis (INV-ANL-*) | 5 | 0% | P2 |
| CLI (INV-CLI-*) | 5 | 0% | P2 |
| Token Budget (INV-TOK-*) | 5 | 0% | P2 |
| Design (INV-DES-*) | 4 | 0% | P3 |
| Telemetry (INV-TEL-*) | 4 | 0% | P3 |

### Already Well-Tested (Skip)

These domains have comprehensive test coverage and require no additional work:

- INV-RT-* (Routing): 5/5 invariants tested
- INV-MEM-* (Memory): 5/5 invariants tested
- INV-WF-* (Workflow): Comprehensive coverage
- INV-TR-* (Trace): Comprehensive coverage
- INV-GUARD-* (Guard): Comprehensive coverage
- INV-MCP-* (MCP): Comprehensive coverage
- INV-CB-* (Circuit Breaker): Comprehensive coverage

---

## Phase 1: Core Infrastructure Invariants (P0)

### 1.1 Provider Invariants (INV-PROV-*)

**File**: `tests/contract/provider.test.ts` (create/enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-PROV-PORT-001 | Request validation before execution | Test invalid request returns error, not exception |
| INV-PROV-PORT-002 | Response schema compliance | Test all response shapes pass validation |
| INV-PROV-PORT-003 | No exception throwing | Test error responses instead of exceptions |
| INV-PROV-REG-001 | Unknown provider returns undefined | Test `getProvider('unknown')` returns undefined |
| INV-PROV-REG-002 | Deterministic listing | Test `listProviders()` order is stable |
| INV-PROV-HEALTH-001 | Timeout enforcement | Test health check times out after 5s |
| INV-PROV-HEALTH-002 | No side effects | Test health check doesn't modify state |
| INV-PROV-HEALTH-003 | Graceful degradation | Test unhealthy providers skipped in routing |

**Implementation**:

```typescript
// tests/contract/provider.test.ts

import { describe, it, expect, vi } from 'vitest';
import { ProviderRequestSchema, ProviderResponseSchema } from '@defai.digital/contracts';

describe('Provider Contract Invariants', () => {
  describe('INV-PROV-PORT-001: Request Validation', () => {
    it('should reject invalid requests with error response', async () => {
      const invalidRequest = { providerId: '', prompt: '' }; // Invalid
      const result = ProviderRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should not call provider API with invalid request', async () => {
      // Provider adapter should validate before calling API
    });
  });

  describe('INV-PROV-PORT-002: Response Schema Compliance', () => {
    it('should accept valid success response', () => {
      const response = {
        success: true,
        content: 'Test response',
        usage: { inputTokens: 10, outputTokens: 20 },
        latencyMs: 100,
      };
      expect(() => ProviderResponseSchema.parse(response)).not.toThrow();
    });

    it('should accept valid error response', () => {
      const response = {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'Test error' },
        latencyMs: 50,
      };
      expect(() => ProviderResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('INV-PROV-PORT-003: No Exception Throwing', () => {
    it('should return error response instead of throwing', async () => {
      // Mock provider that would throw
      // Verify wrapped response returned
    });
  });

  describe('INV-PROV-REG-001: Unknown Provider Handling', () => {
    it('should return undefined for unknown provider', () => {
      // registry.getProvider('unknown') === undefined
    });
  });

  describe('INV-PROV-REG-002: Deterministic Listing', () => {
    it('should return providers in same order across calls', () => {
      // Call listProviders() multiple times
      // Verify order is identical
    });
  });

  describe('INV-PROV-HEALTH-001: Timeout Enforcement', () => {
    it('should timeout health check after configured duration', async () => {
      // Mock slow provider
      // Verify timeout returns unhealthy
    });
  });

  describe('INV-PROV-HEALTH-002: No Side Effects', () => {
    it('should not modify state during health check', () => {
      // Check state before and after health check
    });
  });

  describe('INV-PROV-HEALTH-003: Graceful Degradation', () => {
    it('should skip unhealthy providers in routing', () => {
      // Mark provider unhealthy
      // Verify routing excludes it
    });
  });
});
```

---

### 1.2 Config Invariants (INV-CFG-*)

**File**: `tests/contract/config.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-CFG-001 | Schema validation | Test invalid config rejected |
| INV-CFG-002 | Atomic writes | Test partial writes don't corrupt |
| INV-CFG-003 | Version migration idempotent | Test migration can run multiple times |
| INV-CFG-RES-001 | Project overrides user | Test merge precedence |
| INV-CFG-RES-002 | User overrides defaults | Test merge precedence |
| INV-CFG-RES-003 | Undefined preservation | Test undefined doesn't override |
| INV-CFG-GOV-001 | Audit trail events | Test events emitted on changes |
| INV-CFG-GOV-002 | Sensitive protection | Test confirmation required for sensitive |
| INV-CFG-ADP-001 | Atomic file operations | Test temp file + rename pattern |
| INV-CFG-ADP-002 | Detection timeout | Test provider detection times out |
| INV-CFG-ADP-003 | No network in detection | Test detection uses only local checks |

**Implementation**:

```typescript
// tests/contract/config.test.ts

import { describe, it, expect } from 'vitest';
import { AutomatosXConfigSchema } from '@defai.digital/contracts';

describe('Config Contract Invariants', () => {
  describe('INV-CFG-001: Schema Validation', () => {
    it('should reject invalid configuration', () => {
      const invalidConfig = {
        version: 'not-a-number',
        providers: 'should-be-array',
      };
      const result = AutomatosXConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should accept valid configuration', () => {
      const validConfig = {
        version: 1,
        providers: [],
      };
      expect(() => AutomatosXConfigSchema.parse(validConfig)).not.toThrow();
    });
  });

  describe('INV-CFG-002: Atomic Writes', () => {
    it('should not leave partial state on write failure', async () => {
      // Simulate write failure mid-operation
      // Verify original config intact
    });
  });

  describe('INV-CFG-003: Version Migration Idempotent', () => {
    it('should produce same result when migration run multiple times', () => {
      // Run migration, capture result
      // Run migration again, verify identical
    });
  });

  describe('INV-CFG-RES-001: Project Overrides User', () => {
    it('should use project value when both defined', () => {
      const userConfig = { logLevel: 'info' };
      const projectConfig = { logLevel: 'debug' };
      // Merge and verify projectConfig wins
    });
  });

  describe('INV-CFG-RES-002: User Overrides Defaults', () => {
    it('should use user value over default', () => {
      // Define user config
      // Verify default overridden
    });
  });

  describe('INV-CFG-RES-003: Undefined Preservation', () => {
    it('should not override with undefined', () => {
      const existing = { logLevel: 'info' };
      const overlay = { logLevel: undefined };
      // Merge and verify 'info' preserved
    });
  });

  describe('INV-CFG-GOV-001: Audit Trail', () => {
    it('should emit ConfigSetEvent on change', () => {
      // Set config
      // Verify event emitted with old/new values
    });
  });

  describe('INV-CFG-GOV-002: Sensitive Protection', () => {
    it('should require confirmation for sensitive fields', () => {
      // Attempt to change sensitive field without confirm
      // Verify rejection
    });
  });

  describe('INV-CFG-ADP-001: Atomic File Operations', () => {
    it('should write to temp file then rename', async () => {
      // Spy on file system operations
      // Verify .tmp then rename pattern
    });
  });

  describe('INV-CFG-ADP-002: Detection Timeout', () => {
    it('should timeout detection after 5 seconds', async () => {
      // Mock slow detection
      // Verify timeout behavior
    });
  });

  describe('INV-CFG-ADP-003: No Network in Detection', () => {
    it('should only use local CLI checks', () => {
      // Verify detection uses which/where only
      // No HTTP calls made
    });
  });
});
```

---

### 1.3 Storage Invariants (INV-ST-*)

**File**: `tests/contract/storage.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-ST-001 | Storage mode configuration | Test invalid modes rejected |
| INV-ST-002 | Namespace isolation | Test same key in different namespaces |
| INV-ST-003 | Event immutability | Test no update method exists |
| INV-ST-004 | Event ordering | Test events returned in version order |
| INV-ST-005 | Trace event sequencing | Test sequence order preserved |
| INV-ST-006 | Trace deletion completeness | Test all events removed |
| INV-ST-007 | FTS search ranking | Test results ordered by score |
| INV-ST-008 | TTL best-effort expiration | Test expired keys not returned |

**Implementation**:

```typescript
// tests/contract/storage.test.ts

import { describe, it, expect } from 'vitest';
import { StorageModeSchema } from '@defai.digital/contracts';

describe('Storage Contract Invariants', () => {
  describe('INV-ST-001: Storage Mode Configuration', () => {
    it('should accept valid storage modes', () => {
      expect(() => StorageModeSchema.parse('sqlite')).not.toThrow();
      expect(() => StorageModeSchema.parse('memory')).not.toThrow();
    });

    it('should reject invalid storage modes', () => {
      expect(() => StorageModeSchema.parse('postgresql')).toThrow();
      expect(() => StorageModeSchema.parse('redis')).toThrow();
    });
  });

  describe('INV-ST-002: Namespace Isolation', () => {
    it('should isolate keys in different namespaces', async () => {
      // Store 'key1' in 'ns-a' with value 'A'
      // Store 'key1' in 'ns-b' with value 'B'
      // Retrieve 'key1' from 'ns-a' should be 'A'
      // Retrieve 'key1' from 'ns-b' should be 'B'
    });

    it('should delete only from specified namespace', async () => {
      // Store in both namespaces
      // Delete from one
      // Verify other still exists
    });
  });

  describe('INV-ST-003: Event Immutability', () => {
    it('should not expose update method on EventStoragePort', () => {
      // Verify interface has no update method
    });

    it('should prevent modification of stored events', async () => {
      // Store event
      // Attempt to modify retrieved event
      // Verify original unchanged
    });
  });

  describe('INV-ST-004: Event Ordering', () => {
    it('should return events in version order', async () => {
      // Append events out of order
      // Retrieve and verify sorted by version
    });
  });

  describe('INV-ST-005: Trace Event Sequencing', () => {
    it('should return trace events in sequence order', async () => {
      // Store events with sequence numbers
      // Verify retrieval order matches sequence
    });
  });

  describe('INV-ST-006: Trace Deletion Completeness', () => {
    it('should remove all events when trace deleted', async () => {
      // Store trace with multiple events
      // Delete trace
      // Verify no events remain for traceId
    });
  });

  describe('INV-ST-007: FTS Search Ranking', () => {
    it('should return results sorted by relevance score', async () => {
      // Index documents with known relevance
      // Search and verify descending score order
    });
  });

  describe('INV-ST-008: TTL Best-Effort Expiration', () => {
    it('should not return expired keys', async () => {
      // Store with short TTL
      // Wait for expiration
      // Retrieve and verify undefined
    });
  });
});
```

---

## Phase 2: Domain Invariants (P1)

### 2.1 Ability Invariants (INV-ABL-*)

**File**: `tests/contract/ability.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-ABL-001 | ID uniqueness | Test overwrite on duplicate ID |
| INV-ABL-002 | Priority-based sorting | Test descending sort |
| INV-ABL-003 | Token limit enforcement | Test truncation flag |
| INV-ABL-004 | Applicability filtering | Test agent filtering rules |
| INV-ABL-005 | Enabled status filtering | Test disabled exclusion |
| INV-ABL-SCR-001 | Core ability prioritization | Test +100 bonus |
| INV-ABL-SCR-002 | Deterministic scoring | Test same input = same output |
| INV-ABL-LDR-001 | Schema validation on load | Test invalid abilities skipped |
| INV-ABL-LDR-002 | ID generation from filename | Test fallback ID generation |
| INV-ABL-LDR-003 | YAML frontmatter parsing | Test metadata extraction |

**Implementation**:

```typescript
// tests/contract/ability.test.ts

import { describe, it, expect } from 'vitest';
import { AbilitySchema } from '@defai.digital/contracts';

describe('Ability Contract Invariants', () => {
  describe('INV-ABL-001: ID Uniqueness', () => {
    it('should overwrite existing ability with same ID', () => {
      // Register ability A with ID 'test'
      // Register ability B with ID 'test'
      // Verify only B exists
    });
  });

  describe('INV-ABL-002: Priority-Based Sorting', () => {
    it('should sort abilities by priority descending', () => {
      // Add abilities with priorities 10, 50, 30
      // List and verify order: 50, 30, 10
    });
  });

  describe('INV-ABL-003: Token Limit Enforcement', () => {
    it('should not exceed maxTokens limit', () => {
      // Inject with low maxTokens
      // Verify combined content within limit
    });

    it('should set truncated flag when abilities skipped', () => {
      // Inject with very low maxTokens
      // Verify truncated: true
    });
  });

  describe('INV-ABL-004: Applicability Filtering', () => {
    it('should exclude abilities in excludeFrom', () => {
      // Ability with excludeFrom: ['agent-a']
      // Filter for 'agent-a', verify excluded
    });

    it('should include abilities with wildcard applicableTo', () => {
      // Ability with applicableTo: ['*']
      // Verify applies to any agent
    });

    it('should exclude abilities not in applicableTo', () => {
      // Ability with applicableTo: ['agent-a']
      // Filter for 'agent-b', verify excluded
    });
  });

  describe('INV-ABL-005: Enabled Status Filtering', () => {
    it('should exclude disabled abilities from task injection', () => {
      // Add disabled ability
      // Get abilities for task, verify not included
    });

    it('should still return disabled abilities by direct ID', () => {
      // Add disabled ability
      // Get by ID, verify returned
    });
  });

  describe('INV-ABL-SCR-001: Core Ability Prioritization', () => {
    it('should add +100 score bonus for core abilities', () => {
      // Score core ability vs non-core
      // Verify core has +100 advantage
    });
  });

  describe('INV-ABL-SCR-002: Deterministic Scoring', () => {
    it('should produce same score for same inputs', () => {
      // Score same ability/task combo twice
      // Verify identical scores
    });
  });

  describe('INV-ABL-LDR-001: Schema Validation on Load', () => {
    it('should skip invalid abilities with warning', async () => {
      // Load file with invalid ability
      // Verify warning logged, ability skipped
    });
  });

  describe('INV-ABL-LDR-002: ID Generation from Filename', () => {
    it('should generate ID from filename when not in frontmatter', () => {
      // Load "My-Ability.md" without abilityId
      // Verify ID is "my-ability"
    });
  });

  describe('INV-ABL-LDR-003: YAML Frontmatter Parsing', () => {
    it('should parse YAML frontmatter correctly', () => {
      // Load file with frontmatter
      // Verify metadata extracted
    });
  });
});
```

---

### 2.2 Agent Invariants (INV-AGT-*)

**File**: `tests/contract/agent.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-AGT-001 | Agent ID validation | Test ID format requirements |
| INV-AGT-002 | Registration idempotence | Test re-register overwrites |
| INV-AGT-003 | Enabled filtering | Test disabled agents excluded |
| INV-AGT-004 | Team filtering | Test team-based queries |
| INV-AGT-005 | Capability matching | Test capability requirements |
| INV-AGT-006 | Workflow validation | Test workflow step validation |

---

### 2.3 Session Invariants (INV-SESS-*)

**File**: `tests/contract/session.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-SESS-001 | Session ID uniqueness | Test UUID generation |
| INV-SESS-002 | Status transitions | Test valid state machine transitions |
| INV-SESS-003 | Participant tracking | Test join/leave tracking |
| INV-SESS-004 | Completion finality | Test no changes after complete |
| INV-SESS-005 | Failure recording | Test error capture |
| INV-SESS-006 | Initiator immutability | Test initiator cannot change |

---

## Phase 3: Tool & Analysis Invariants (P2)

### 3.1 Orchestration Invariants (INV-ORC-*)

**File**: `tests/contract/orchestration.test.ts` (create)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-ORC-001 | Step execution ordering | Test dependency resolution |
| INV-ORC-002 | Context propagation | Test context passed between steps |
| INV-ORC-003 | Error isolation | Test step errors don't corrupt state |
| INV-ORC-004 | Rollback on failure | Test compensation triggers |
| INV-ORC-005 | Timeout enforcement | Test step timeout handling |
| INV-ORC-006 | Result aggregation | Test multi-step result collection |

---

### 3.2 Bugfix Invariants (INV-BUG-*)

**File**: `tests/contract/bugfix.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-BUG-001 | Scan path validation | Test invalid paths rejected |
| INV-BUG-002 | Bug ID uniqueness | Test unique IDs per scan |
| INV-BUG-003 | Severity ordering | Test critical > high > medium > low |
| INV-BUG-004 | Category filtering | Test category-based queries |
| INV-BUG-005 | Dry run safety | Test no changes in dry run |
| INV-BUG-006 | Backup creation | Test backup before fix |

---

### 3.3 Refactor Invariants (INV-REF-*)

**File**: `tests/contract/refactor.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-REF-001 | Opportunity ID uniqueness | Test unique IDs per scan |
| INV-REF-002 | Impact classification | Test impact levels |
| INV-REF-003 | Confidence threshold | Test minConfidence filtering |
| INV-REF-004 | Dry run safety | Test no changes in dry run |
| INV-REF-005 | Test integration | Test runTests flag |

---

### 3.4 Analysis Invariants (INV-ANL-*)

**File**: `tests/contract/analysis.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-ANL-001 | Pattern detection accuracy | Test known patterns found |
| INV-ANL-002 | False positive rate | Test known non-issues ignored |
| INV-ANL-003 | AST parsing fallback | Test graceful degradation |
| INV-ANL-004 | Language detection | Test file extension mapping |
| INV-ANL-005 | Result caching | Test cache hit/miss behavior |

---

### 3.5 CLI Invariants (INV-CLI-*)

**File**: `tests/cli/invariants.test.ts` (create)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-CLI-001 | Exit code semantics | Test 0=success, non-zero=failure |
| INV-CLI-002 | Help text availability | Test --help works for all commands |
| INV-CLI-003 | Version output | Test --version outputs version |
| INV-CLI-004 | Error formatting | Test errors go to stderr |
| INV-CLI-005 | JSON output mode | Test --json produces valid JSON |

---

### 3.6 Token Budget Invariants (INV-TOK-*)

**File**: `tests/contract/token-budget.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-TOK-001 | Budget allocation | Test allocation math |
| INV-TOK-002 | Usage tracking | Test cumulative tracking |
| INV-TOK-003 | Limit enforcement | Test over-budget rejection |
| INV-TOK-004 | Estimation accuracy | Test estimation vs actual |
| INV-TOK-005 | Provider-specific rates | Test per-provider rates |

---

## Phase 4: Secondary Invariants (P3)

### 4.1 Design Invariants (INV-DES-*)

**File**: `tests/contract/design.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-DES-001 | Template validation | Test template schema |
| INV-DES-002 | Variable interpolation | Test placeholder replacement |
| INV-DES-003 | Output format compliance | Test generated code validity |
| INV-DES-004 | Generation idempotence | Test same input = same output |

---

### 4.2 Telemetry Invariants (INV-TEL-*)

**File**: `tests/contract/telemetry.test.ts` (enhance)

| Invariant | Description | Test Strategy |
|-----------|-------------|---------------|
| INV-TEL-001 | Event schema compliance | Test event structure |
| INV-TEL-002 | Timestamp accuracy | Test timestamps are recent |
| INV-TEL-003 | Correlation ID propagation | Test IDs flow through stack |
| INV-TEL-004 | PII filtering | Test sensitive data removed |

---

## Implementation Plan

### Test File Organization

```
tests/
├── contract/
│   ├── provider.test.ts      # INV-PROV-* (8 invariants)
│   ├── config.test.ts        # INV-CFG-* (9 invariants)
│   ├── storage.test.ts       # INV-ST-* (8 invariants)
│   ├── ability.test.ts       # INV-ABL-* (12 invariants)
│   ├── agent.test.ts         # INV-AGT-* (6 invariants)
│   ├── session.test.ts       # INV-SESS-* (6 invariants)
│   ├── orchestration.test.ts # INV-ORC-* (6 invariants)
│   ├── bugfix.test.ts        # INV-BUG-* (6 invariants)
│   ├── refactor.test.ts      # INV-REF-* (5 invariants)
│   ├── analysis.test.ts      # INV-ANL-* (5 invariants)
│   ├── token-budget.test.ts  # INV-TOK-* (5 invariants)
│   ├── design.test.ts        # INV-DES-* (4 invariants)
│   └── telemetry.test.ts     # INV-TEL-* (4 invariants)
├── cli/
│   └── invariants.test.ts    # INV-CLI-* (5 invariants)
└── core/
    └── (existing tests remain unchanged)
```

### Execution Order

| Phase | Files | New Tests | Est. LOC |
|-------|-------|-----------|----------|
| Phase 1 (P0) | provider.test.ts, config.test.ts, storage.test.ts | 28 | ~700 |
| Phase 2 (P1) | ability.test.ts, agent.test.ts, session.test.ts | 28 | ~600 |
| Phase 3 (P2) | orchestration.test.ts, bugfix.test.ts, refactor.test.ts, analysis.test.ts, cli/invariants.test.ts, token-budget.test.ts | 32 | ~800 |
| Phase 4 (P3) | design.test.ts, telemetry.test.ts | 8 | ~200 |
| **Total** | **14 files** | **96 tests** | **~2300** |

---

## Test Conventions

### Naming Convention

All invariant tests MUST use the invariant ID in the describe block:

```typescript
describe('INV-PROV-PORT-001: Request Validation', () => {
  // Tests for this invariant
});
```

### Structure

Each invariant test file follows this pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('[Domain] Contract Invariants', () => {
  beforeEach(() => {
    // Setup test fixtures
  });

  afterEach(() => {
    // Cleanup
  });

  describe('INV-XXX-001: [Invariant Name]', () => {
    it('should [positive test case]', () => {});
    it('should [negative test case]', () => {});
  });

  describe('INV-XXX-002: [Invariant Name]', () => {
    // ...
  });
});
```

### Assertions

- Use exact invariant wording in test descriptions
- Test both positive and negative cases
- Include edge cases mentioned in invariants.md
- Reference INV-* ID in any failure messages

---

## Success Criteria

### Coverage Targets

| Phase | Target Coverage | Milestone |
|-------|-----------------|-----------|
| Phase 1 | 55% | P0 invariants tested |
| Phase 2 | 70% | P1 invariants tested |
| Phase 3 | 85% | P2 invariants tested |
| Phase 4 | 90%+ | All documented invariants tested |

### Verification

After implementation:

```bash
# Run all contract tests
pnpm vitest run tests/contract/

# Verify coverage
pnpm vitest run tests/contract/ --coverage

# Validate no invariants missing tests
pnpm validate
```

### Definition of Done

- [ ] All documented invariants have at least one test
- [ ] Test file names match invariant domain
- [ ] Test describe blocks include INV-* IDs
- [ ] All tests pass
- [ ] No regressions in existing tests
- [ ] Coverage report shows 90%+ invariant coverage

---

## Risk Mitigation

### Potential Issues

| Risk | Mitigation |
|------|------------|
| Implementation differs from contract | Update implementation or contract (contract-first) |
| Missing domain implementations | Create stub implementations for testing |
| Flaky tests due to timing | Use deterministic mocks, avoid real delays |
| Large test file sizes | Split by invariant category (e.g., INV-CFG-RES-*) |

### Dependencies

- Requires access to all contract invariants.md files
- Requires domain implementations to exist (even as stubs)
- No external dependencies required

---

## Appendix: Full Invariant Checklist

### Phase 1 (P0) - 28 Invariants

**Provider (11)**
- [ ] INV-PROV-PORT-001: Request Validation
- [ ] INV-PROV-PORT-002: Response Schema Compliance
- [ ] INV-PROV-PORT-003: No Exception Throwing
- [ ] INV-PROV-REG-001: Unknown Provider Handling
- [ ] INV-PROV-REG-002: Deterministic Listing
- [ ] INV-PROV-HEALTH-001: Timeout Enforcement
- [ ] INV-PROV-HEALTH-002: No Side Effects
- [ ] INV-PROV-HEALTH-003: Graceful Degradation

**Config (9)**
- [ ] INV-CFG-001: Schema Validation
- [ ] INV-CFG-002: Atomic Writes
- [ ] INV-CFG-003: Version Migration Idempotent
- [ ] INV-CFG-RES-001: Project Overrides User
- [ ] INV-CFG-RES-002: User Overrides Defaults
- [ ] INV-CFG-RES-003: Undefined Preservation
- [ ] INV-CFG-GOV-001: Audit Trail
- [ ] INV-CFG-GOV-002: Sensitive Protection
- [ ] INV-CFG-ADP-001: Atomic File Operations
- [ ] INV-CFG-ADP-002: Detection Timeout
- [ ] INV-CFG-ADP-003: No Network in Detection

**Storage (8)**
- [ ] INV-ST-001: Storage Mode Configuration
- [ ] INV-ST-002: Namespace Isolation
- [ ] INV-ST-003: Event Immutability
- [ ] INV-ST-004: Event Ordering
- [ ] INV-ST-005: Trace Event Sequencing
- [ ] INV-ST-006: Trace Deletion Completeness
- [ ] INV-ST-007: FTS Search Ranking
- [ ] INV-ST-008: TTL Best-Effort Expiration

### Phase 2 (P1) - 28 Invariants

**Ability (12)**
- [ ] INV-ABL-001: ID Uniqueness
- [ ] INV-ABL-002: Priority-Based Sorting
- [ ] INV-ABL-003: Token Limit Enforcement
- [ ] INV-ABL-004: Applicability Filtering
- [ ] INV-ABL-005: Enabled Status Filtering
- [ ] INV-ABL-SCR-001: Core Ability Prioritization
- [ ] INV-ABL-SCR-002: Deterministic Scoring
- [ ] INV-ABL-LDR-001: Schema Validation on Load
- [ ] INV-ABL-LDR-002: ID Generation from Filename
- [ ] INV-ABL-LDR-003: YAML Frontmatter Parsing

**Agent (6)**
- [ ] INV-AGT-001: Agent ID Validation
- [ ] INV-AGT-002: Registration Idempotence
- [ ] INV-AGT-003: Enabled Filtering
- [ ] INV-AGT-004: Team Filtering
- [ ] INV-AGT-005: Capability Matching
- [ ] INV-AGT-006: Workflow Validation

**Session (6)**
- [ ] INV-SESS-001: Session ID Uniqueness
- [ ] INV-SESS-002: Status Transitions
- [ ] INV-SESS-003: Participant Tracking
- [ ] INV-SESS-004: Completion Finality
- [ ] INV-SESS-005: Failure Recording
- [ ] INV-SESS-006: Initiator Immutability

### Phase 3 (P2) - 32 Invariants

**Orchestration (6)**
- [ ] INV-ORC-001: Step Execution Ordering
- [ ] INV-ORC-002: Context Propagation
- [ ] INV-ORC-003: Error Isolation
- [ ] INV-ORC-004: Rollback on Failure
- [ ] INV-ORC-005: Timeout Enforcement
- [ ] INV-ORC-006: Result Aggregation

**Bugfix (6)**
- [ ] INV-BUG-001: Scan Path Validation
- [ ] INV-BUG-002: Bug ID Uniqueness
- [ ] INV-BUG-003: Severity Ordering
- [ ] INV-BUG-004: Category Filtering
- [ ] INV-BUG-005: Dry Run Safety
- [ ] INV-BUG-006: Backup Creation

**Refactor (5)**
- [ ] INV-REF-001: Opportunity ID Uniqueness
- [ ] INV-REF-002: Impact Classification
- [ ] INV-REF-003: Confidence Threshold
- [ ] INV-REF-004: Dry Run Safety
- [ ] INV-REF-005: Test Integration

**Analysis (5)**
- [ ] INV-ANL-001: Pattern Detection Accuracy
- [ ] INV-ANL-002: False Positive Rate
- [ ] INV-ANL-003: AST Parsing Fallback
- [ ] INV-ANL-004: Language Detection
- [ ] INV-ANL-005: Result Caching

**CLI (5)**
- [ ] INV-CLI-001: Exit Code Semantics
- [ ] INV-CLI-002: Help Text Availability
- [ ] INV-CLI-003: Version Output
- [ ] INV-CLI-004: Error Formatting
- [ ] INV-CLI-005: JSON Output Mode

**Token Budget (5)**
- [ ] INV-TOK-001: Budget Allocation
- [ ] INV-TOK-002: Usage Tracking
- [ ] INV-TOK-003: Limit Enforcement
- [ ] INV-TOK-004: Estimation Accuracy
- [ ] INV-TOK-005: Provider-Specific Rates

### Phase 4 (P3) - 8 Invariants

**Design (4)**
- [ ] INV-DES-001: Template Validation
- [ ] INV-DES-002: Variable Interpolation
- [ ] INV-DES-003: Output Format Compliance
- [ ] INV-DES-004: Generation Idempotence

**Telemetry (4)**
- [ ] INV-TEL-001: Event Schema Compliance
- [ ] INV-TEL-002: Timestamp Accuracy
- [ ] INV-TEL-003: Correlation ID Propagation
- [ ] INV-TEL-004: PII Filtering

---

## Version History

- V1.0.0 (2025-12-17): Initial PRD addressing architecture compliance gap
