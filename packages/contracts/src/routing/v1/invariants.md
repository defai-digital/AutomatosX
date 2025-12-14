# Routing Decision Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for the routing decision system. The routing engine MUST satisfy all invariants.

## Invariants

### INV-RT-001: Determinism

**Statement:** Identical inputs MUST always yield identical outputs.

**Rationale:** Reproducibility is essential for debugging, testing, and auditing routing decisions. Non-deterministic routing makes system behavior unpredictable.

**Enforcement:**
- Routing logic must not use random selection
- Time-based factors must be explicit in input (not implicitly read)
- Same requestId + input must produce same decision
- For replay testing: stored inputs must reproduce stored decisions

### INV-RT-002: Budget Respect

**Statement:** Lower budgets MUST NOT result in higher-cost models.

**Rationale:** Users set budgets for cost control. Violating budget constraints breaks user trust and can cause unexpected charges.

**Enforcement:**
- `estimatedCostUsd` must be ≤ `budget.maxCostUsd` when budget is specified
- If no model fits budget, return an error (not a more expensive model)
- Cost estimation must be conservative (over-estimate rather than under)

### INV-RT-003: Risk Gating

**Statement:** `riskLevel = high` MUST never select experimental models.

**Rationale:** High-risk contexts require proven, stable models. Experimental models may have unpredictable behavior.

**Enforcement:**
- When `riskLevel === 'high'`, `isExperimental` must be `false`
- Experimental model selection requires explicit opt-in
- Risk level must be preserved through fallback selection

### INV-RT-004: Reasoning Requirement

**Statement:** Every routing decision MUST include human-readable reasoning.

**Rationale:** Audit trails and debugging require understanding why decisions were made.

**Enforcement:**
- `reasoning` field is required and non-empty
- Reasoning must reference the input factors that influenced the decision
- Automated systems can parse reasoning for audit purposes

### INV-RT-005: Fallback Consistency

**Statement:** Fallback models MUST satisfy the same constraints as the primary selection.

**Rationale:** Fallbacks are used when primary fails. They must not violate the original requirements.

**Enforcement:**
- All fallback models must meet budget constraints
- All fallback models must meet capability requirements
- Fallback models must respect risk level constraints

## Testing Requirements

Each invariant must have corresponding tests:

1. `INV-RT-001`: Test that same inputs produce same outputs across multiple calls
2. `INV-RT-002`: Test that budget constraints are respected
3. `INV-RT-003`: Test that high-risk never selects experimental
4. `INV-RT-004`: Test that reasoning is always present and meaningful
5. `INV-RT-005`: Test that fallbacks meet all constraints (Phase 2+)

## Version History

- V1 (2024-12-14): Initial contract definition
