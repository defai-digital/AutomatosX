# AutomatosX Action Plan

**Based on PRD v1.0.0 Review**
**Created**: 2025-12-14

---

## Executive Summary

This action plan identifies gaps between the PRD specification and current implementation, prioritized by criticality. The primary gap is **cost-related code that must be removed** per the PRD design decision.

---

## 1. Critical: Remove Cost Handling from Codebase

**PRD States**: "AutomatosX intentionally does NOT perform cost calculations or cost-based routing."

**Current Code**: Still contains cost handling in multiple packages.

### 1.1 Contracts Package

**File**: `packages/contracts/src/routing/v1/schema.ts`

| Change | Current | Target |
|--------|---------|--------|
| Remove `BudgetSchema.maxCostUsd` | `maxCostUsd: z.number().min(0).optional()` | Remove field |
| Remove `budget` from `RoutingInputSchema` | `budget: BudgetSchema.optional()` | Remove field |
| Remove `estimatedCostUsd` from `RoutingDecisionSchema` | `estimatedCostUsd: z.number().min(0).optional()` | Remove field |
| Keep `maxLatencyMs` in requirements | Move to `ModelRequirementsSchema` | Add `maxLatencyMs` |

**Action Items**:
```
[ ] Remove maxCostUsd from BudgetSchema (or remove BudgetSchema entirely)
[ ] Remove budget field from RoutingInputSchema
[ ] Add maxLatencyMs to ModelRequirementsSchema
[ ] Remove estimatedCostUsd from RoutingDecisionSchema
[ ] Update contract tests
```

### 1.2 Routing Engine

**File**: `packages/core/routing-engine/src/scorer.ts`

| Change | Lines | Action |
|--------|-------|--------|
| Remove budget cost check | 45-63 | Delete cost checking logic |
| Remove `budgetMaxCost` from context | types.ts | Remove from RoutingContext |
| Remove cost efficiency scoring | 59-62 | Delete |

**File**: `packages/core/routing-engine/src/models.ts`

| Change | Action |
|--------|--------|
| Remove `costPerMillionTokens` from all models | Delete field from ModelDefinition and all model entries |

**File**: `packages/core/routing-engine/src/types.ts`

| Change | Action |
|--------|--------|
| Remove `costPerMillionTokens` from `ModelDefinition` | Delete field |
| Remove `budgetMaxCost` from `RoutingContext` | Delete field |

**Action Items**:
```
[ ] Remove costPerMillionTokens from ModelDefinition type
[ ] Remove budgetMaxCost from RoutingContext type
[ ] Remove cost-related scoring logic from scorer.ts
[ ] Update models.ts to remove costPerMillionTokens from all model definitions
[ ] Update router.ts to not pass budget cost
[ ] Update routing engine tests
```

### 1.3 Provider Adapters (if applicable)

**Check**: Ensure no cost estimation in provider adapters.

```
[ ] Verify no cost fields in provider types
[ ] Verify no cost calculations in CLI adapter
```

---

## 2. High: Align Routing Contract with PRD

### 2.1 Update RoutingDecision Schema

**PRD Specifies**:
```typescript
interface RoutingDecision {
  selectedModel: string;
  provider: Provider;
  reasoning: string;
  fallbackModels: string[];
  constraints: {
    capabilitiesMet: boolean;
    riskCompliant: boolean;
  };
}
```

**Current Code** has:
- `isExperimental: boolean` (keep or move to constraints?)
- `estimatedCostUsd` (remove)
- No `constraints` object

**Action Items**:
```
[ ] Add constraints object to RoutingDecisionSchema
[ ] Move isExperimental into constraints or keep separate
[ ] Ensure fallbackModels is required (not optional)
[ ] Update all routing decision creation code
```

### 2.2 Update ModelRequirements Schema

**PRD Specifies**:
```typescript
interface ModelRequirements {
  minContextLength?: number;
  maxLatencyMs?: number;
  capabilities?: ModelCapability[];
  preferredProviders?: string[];
  excludedModels?: string[];
}
```

**Current Code** missing: `maxLatencyMs`

**Action Items**:
```
[ ] Add maxLatencyMs to ModelRequirementsSchema
[ ] Implement latency-based disqualification in scorer
```

---

## 3. Medium: Update Routing Invariants

### 3.1 Invariant Renumbering

**PRD Specifies**:
| ID | Invariant |
|----|-----------|
| INV-RT-001 | Determinism |
| INV-RT-002 | Risk Gating |
| INV-RT-003 | Reasoning Required |
| INV-RT-004 | Fallback Consistency |
| INV-RT-005 | Capability Match |

**Current Code** has different numbering (INV-RT-002 was Budget Respect).

**Action Items**:
```
[ ] Update invariant comments in scorer.ts
[ ] Update invariant comments in router.ts
[ ] Update any documentation referencing invariant IDs
```

---

## 4. Medium: Verify Model Registry

### 4.1 Model Definition Updates

Remove `costPerMillionTokens`, ensure all models have:
- `id`
- `provider`
- `displayName`
- `isExperimental`
- `contextLength`
- `capabilities[]`
- `optimizedFor[]`
- `priority`

**Action Items**:
```
[ ] Update ModelDefinition type
[ ] Update DEFAULT_MODELS array
[ ] Add any missing models mentioned in PRD
```

---

## 5. Low: Documentation Alignment

### 5.1 Code Comments

```
[ ] Update JSDoc comments to match PRD terminology
[ ] Ensure all invariants documented in code match PRD
[ ] Add "no cost handling" note to routing engine
```

### 5.2 README Updates

```
[ ] Update package READMEs if they mention cost
[ ] Ensure example code doesn't use cost fields
```

---

## 6. Verification: Test Updates

### 6.1 Contract Tests

```
[ ] Update routing contract tests to not use cost fields
[ ] Add tests for new constraints object
[ ] Add tests for maxLatencyMs requirement
```

### 6.2 Routing Engine Tests

```
[ ] Remove cost-based routing tests
[ ] Add capability-based routing tests
[ ] Add risk-level routing tests
[ ] Verify determinism tests still pass
```

### 6.3 Integration Tests

```
[ ] Update CLI tests if they use cost
[ ] Verify provider adapter tests don't assume cost
```

---

## 7. Implementation Order

### Phase 1: Contract Changes (Foundation)
1. Update `packages/contracts/src/routing/v1/schema.ts`
2. Run contract tests, fix failures
3. Build to verify types

### Phase 2: Routing Engine Updates
1. Update `packages/core/routing-engine/src/types.ts`
2. Update `packages/core/routing-engine/src/models.ts`
3. Update `packages/core/routing-engine/src/scorer.ts`
4. Update `packages/core/routing-engine/src/router.ts`
5. Run routing engine tests, fix failures

### Phase 3: Dependent Package Updates
1. Check provider-adapters for cost references
2. Check CLI for cost references
3. Check MCP server for cost references

### Phase 4: Test Suite Updates
1. Update all test files
2. Run full test suite
3. Fix any remaining failures

### Phase 5: Documentation
1. Verify PRD accuracy
2. Update code comments
3. Update any READMEs

---

## 8. Rollback Plan

If issues arise:
1. All changes should be in a single branch
2. Can revert entire branch if needed
3. Cost removal is backward-incompatible - communicate to any consumers

---

## 9. Success Criteria

- [ ] `pnpm build` passes with no errors
- [ ] `pnpm test` passes with all 240+ tests
- [ ] No references to `cost`, `budget`, `price` in routing logic
- [ ] PRD and code are fully aligned
- [ ] `ax doctor` works correctly
- [ ] `ax call <provider>` works for all providers

---

## 10. Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Contracts | ~1 hour |
| Phase 2: Routing Engine | ~2 hours |
| Phase 3: Dependent Packages | ~30 min |
| Phase 4: Tests | ~1 hour |
| Phase 5: Documentation | ~30 min |
| **Total** | **~5 hours** |

---

## Appendix: Files to Modify

```
packages/contracts/src/routing/v1/schema.ts
packages/core/routing-engine/src/types.ts
packages/core/routing-engine/src/models.ts
packages/core/routing-engine/src/scorer.ts
packages/core/routing-engine/src/router.ts
tests/contract/routing.test.ts
tests/core/routing-engine.test.ts
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-14 | AutomatosX Team | Initial action plan |
