# PRD: Concurrency Issues Fix

**Version**: 1.0
**Date**: 2026-01-20
**Status**: Approved for Implementation
**Author**: ax agent (architect) + Multi-Model Discussion (Claude, Gemini)

---

## 1. Problem Statement

### Background

A comprehensive audit of AutomatosX identified several concurrency-related issues documented in `docs/HIGH_RISK_BUGS.md`. Multi-model discussion (Claude + Gemini) established consensus on best practices for resolution.

### Current State Analysis

| Bug ID | Description | Actual Status | Severity |
|--------|-------------|---------------|----------|
| Bug 1 | TOCTOU Race in Agent Registration | **Overblown** - registry has protection | Low-Medium |
| Bug 2 | Task Dependency Cycle Detection | **FALSE POSITIVE** - already implemented | N/A |
| Bug 3 | Unbounded Concurrent Provider Calls | **Real** - needs rate limiting | Medium |
| NEW | File I/O Race in PersistentRegistry | **Real** - needs SQLite migration | Medium |

### Impact Assessment

- **Data Integrity**: File I/O race could cause lost agent registrations under concurrent writes
- **API Stability**: Unbounded provider calls could trigger rate limits and cascade failures
- **Code Quality**: Redundant TOCTOU check adds complexity without benefit

---

## 2. Goals & Non-Goals

### Goals

1. **G1**: Eliminate file I/O race condition by migrating to SQLite storage
2. **G2**: Add rate limiting to provider calls using established patterns (p-limit)
3. **G3**: Simplify agent registration by removing redundant pre-check
4. **G4**: Update documentation to reflect accurate bug status
5. **G5**: Add database-level constraints for defense-in-depth

### Non-Goals

- **NG1**: Distributed rate limiting (Redis) - out of scope for CLI tool
- **NG2**: Full token bucket implementation - defer until data shows need
- **NG3**: Migrating all file-based storage - only agent registry in scope
- **NG4**: Breaking API changes to MCP tools

---

## 3. Technical Requirements

### REQ-1: Remove Redundant TOCTOU Pre-Check

**File**: `packages/mcp-server/src/tools/agent.ts`

**Current Code** (lines 866-881):
```typescript
const existing = await registry.get(agentId);
if (existing !== undefined) {
  return { error: 'AGENT_ALREADY_EXISTS' };
}
await registry.register(profile);
```

**Required Change**: Remove pre-check, catch registry exception:
```typescript
try {
  await registry.register(profile);
} catch (error) {
  if (error instanceof AgentRegistryError &&
      error.message.includes('already exists')) {
    return { error: 'AGENT_ALREADY_EXISTS', agentId, message: error.message };
  }
  throw error;
}
```

**Invariant**: `INV-AGT-REG-001`: Registration relies on storage-level uniqueness enforcement

### REQ-2: Add SQLite Unique Constraint

**File**: `packages/adapters/sqlite/src/trace-store.ts` (agents table)

**Required Change**: Add UNIQUE constraint on agent_id:
```sql
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  description TEXT NOT NULL,
  system_prompt TEXT,
  capabilities TEXT,
  tags TEXT,
  team TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
```

**Invariant**: `INV-AGT-DB-001`: Database enforces agent_id uniqueness at storage level

### REQ-3: Add Provider Call Rate Limiting

**File**: `packages/core/discussion-domain/src/executor.ts`

**Required Change**: Add p-limit for concurrent provider calls:
```typescript
import pLimit from 'p-limit';

// Constants
const DEFAULT_PROVIDER_CONCURRENCY = 5;

// In DiscussionExecutor class
private readonly providerConcurrencyLimit: ReturnType<typeof pLimit>;

constructor(options: DiscussionExecutorOptions) {
  // ... existing code
  this.providerConcurrencyLimit = pLimit(
    options.maxConcurrentProviderCalls ?? DEFAULT_PROVIDER_CONCURRENCY
  );
}

// Wrap provider calls
private async callProviderWithLimit(
  providerId: string,
  prompt: string,
  options: ProviderCallOptions
): Promise<ProviderResponse> {
  return this.providerConcurrencyLimit(() =>
    this.providerExecutor.call(providerId, prompt, options)
  );
}
```

**Invariant**: `INV-DISC-RATE-001`: Provider calls limited to configurable concurrency

### REQ-4: Update HIGH_RISK_BUGS.md

**File**: `docs/HIGH_RISK_BUGS.md`

**Required Changes**:
1. Mark Bug 2 as "RESOLVED - Already Implemented"
2. Update Bug 1 severity to "Low-Medium" and note simpler fix
3. Add note about existing mitigations for Bug 3
4. Add resolution status section

---

## 4. Implementation Plan

### Phase 1: Documentation & Preparation (Day 1)
| Task | Owner | Effort |
|------|-------|--------|
| Update HIGH_RISK_BUGS.md with accurate status | Developer | 15 min |
| Add p-limit dependency if not present | Developer | 5 min |

### Phase 2: Agent Registration Fix (Day 1-2)
| Task | Owner | Effort |
|------|-------|--------|
| Remove redundant pre-check in agent.ts | Developer | 30 min |
| Add error handling for registry exceptions | Developer | 30 min |
| Add SQLite unique constraint on agent_id | Developer | 30 min |
| Write/update tests for registration edge cases | Developer | 1 hr |

### Phase 3: Rate Limiting (Day 2-3)
| Task | Owner | Effort |
|------|-------|--------|
| Add p-limit to discussion executor | Developer | 1 hr |
| Add maxConcurrentProviderCalls config option | Developer | 30 min |
| Update contracts if needed | Developer | 30 min |
| Write tests for rate limiting behavior | Developer | 1 hr |

### Phase 4: Verification (Day 3)
| Task | Owner | Effort |
|------|-------|--------|
| Run full test suite | Developer | 15 min |
| Manual testing of agent registration | Developer | 15 min |
| Manual testing of discussion commands | Developer | 15 min |
| Code review | Reviewer | 30 min |

---

## 5. Success Metrics

### Functional Metrics
- [ ] All 3022+ existing tests pass
- [ ] Agent registration rejects duplicates with proper error message
- [ ] SQLite constraint prevents duplicate agent_id at database level
- [ ] Discussion executor respects concurrency limits

### Quality Metrics
- [ ] No new lint errors introduced
- [ ] Type checking passes
- [ ] Invariants documented in code comments

### Performance Metrics
- [ ] No regression in agent registration latency
- [ ] Discussion execution time not significantly impacted by rate limiting

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SQLite migration breaks existing data | Low | High | Add IF NOT EXISTS, don't modify existing rows |
| p-limit changes discussion timing | Medium | Low | Make concurrency configurable, default to current behavior |
| Registry exception format changes | Low | Medium | Check actual error type/message in registry code first |
| Test flakiness from concurrency changes | Low | Low | Use deterministic test patterns |

### Rollback Plan

1. **Phase 2 rollback**: Revert agent.ts changes, keep SQLite constraint (harmless)
2. **Phase 3 rollback**: Remove p-limit wrapper, revert to direct calls
3. **Full rollback**: Git revert to pre-implementation commit

---

## 7. Dependencies

### NPM Packages
- `p-limit` - Already used in `packages/core/review-domain/src/index.ts` (no new dependency)

### Internal Dependencies
- `@defai.digital/contracts` - May need DiscussionExecutorOptions update
- `@defai.digital/agent-domain` - AgentRegistryError type

---

## 8. Appendix

### A. Files Modified

| File | Change Type |
|------|-------------|
| `docs/HIGH_RISK_BUGS.md` | Update |
| `packages/mcp-server/src/tools/agent.ts` | Modify |
| `packages/adapters/sqlite/src/trace-store.ts` | Modify |
| `packages/core/discussion-domain/src/executor.ts` | Modify |
| `packages/contracts/src/discussion/v1/schema.ts` | Modify (optional) |

### B. Related Invariants

- `INV-AGT-REG-001`: Registration relies on storage-level uniqueness
- `INV-AGT-DB-001`: Database enforces agent_id uniqueness
- `INV-DISC-RATE-001`: Provider calls limited to configurable concurrency
- `INV-DISC-103`: Use Promise.allSettled for concurrent operations (existing)

### C. Audit Trail

| Date | Action | By |
|------|--------|-----|
| 2026-01-20 | Initial audit findings | ax agent (auditor) |
| 2026-01-20 | Multi-model discussion | Claude, Gemini |
| 2026-01-20 | PRD created | ax agent (architect) |
| 2026-01-20 | PRD approved | User |
