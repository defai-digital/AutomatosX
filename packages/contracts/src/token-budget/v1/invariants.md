# Token Budget Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for token budget management and allocation.

## Allocation Invariants

### INV-TOK-001: Allocation Limits

**Statement:** Token allocations MUST NOT exceed configured limits.

**Rationale:** Overallocation causes provider errors and cost overruns.

**Enforcement:**
- Limit checked before allocation
- Allocation rejected if would exceed
- Clear error message on rejection

### INV-TOK-002: Usage Tracking

**Statement:** Token usage MUST be tracked accurately.

**Rationale:** Inaccurate tracking causes budget violations.

**Enforcement:**
- Usage incremented after each call
- Prompt and completion tracked separately
- Running total maintained

### INV-TOK-003: Budget Exhaustion

**Statement:** Operations MUST fail gracefully on budget exhaustion.

**Rationale:** Silent failure causes confusion.

**Enforcement:**
- Clear error when budget exhausted
- Partial results returned if available
- Suggestion to increase budget

## Estimation Invariants

### INV-TOK-EST-001: Conservative Estimation

**Statement:** Token estimates SHOULD be conservative (over-estimate).

**Rationale:** Under-estimation causes unexpected budget exhaustion.

**Enforcement:**
- Estimation uses safety margin
- Actual usage logged vs estimate
- Estimation tuned based on actuals

### INV-TOK-EST-002: Model-Specific Counting

**Statement:** Token counting MUST use model-specific tokenizer.

**Rationale:** Different models have different tokenization.

**Enforcement:**
- Tokenizer selected by model
- Fallback to conservative estimate
- Warning on tokenizer mismatch

## Testing Requirements

1. `INV-TOK-001`: Test allocation limits
2. `INV-TOK-002`: Test usage tracking
3. `INV-TOK-003`: Test budget exhaustion handling
4. `INV-TOK-EST-001`: Test conservative estimation
5. `INV-TOK-EST-002`: Test model-specific counting

## Version History

- V1 (2024-12-16): Initial contract definition
