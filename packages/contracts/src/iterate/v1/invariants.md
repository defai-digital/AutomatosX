# Iterate Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for iterative refinement workflows.

## Budget Invariants

### INV-ITR-001: Budget Enforcement

**Statement:** Iteration MUST stop when budget limits reached.

**Rationale:** Prevents runaway execution and cost overruns.

**Budget Types:**
- `maxIterations`: Maximum loop count
- `maxTimeMs`: Maximum wall-clock time
- `maxTokens`: Maximum tokens consumed

**Enforcement:**
- Limits checked before each iteration
- Exceeded limit stops iteration
- Final state reported on budget exhaustion

### INV-ITR-002: Progress Tracking

**Statement:** Each iteration MUST track progress toward goal.

**Rationale:** Stalled iterations should be detected and stopped.

**Enforcement:**
- Progress metric defined per task
- Stall detection (no progress for N iterations)
- Stall triggers review or abort

## Safety Invariants

### INV-ITR-SAFE-001: Dangerous Pattern Detection

**Statement:** Iteration MUST pause on dangerous patterns.

**Rationale:** Prevents destructive operations without confirmation.

**Dangerous Patterns:**
- Deleting multiple files
- Modifying authentication code
- Changing database schemas
- Removing error handling

**Enforcement:**
- Pattern matching on proposed changes
- Pause requires user confirmation
- Logged for audit

### INV-ITR-SAFE-002: Rollback Capability

**Statement:** Iteration changes MUST be rollbackable.

**Rationale:** Bad iterations should be recoverable.

**Enforcement:**
- Checkpoints before risky changes
- Git branch or stash for rollback
- Rollback command available

## Intent Invariants

### INV-ITR-003: Intent Classification

**Statement:** User intent MUST be classified to drive actions.

**Rationale:** Different intents require different iteration strategies.

**Intent Types:**
- `fix`: Correct specific issue
- `improve`: Enhance existing code
- `add`: Create new functionality
- `remove`: Delete functionality
- `refactor`: Restructure without behavior change

**Enforcement:**
- Intent inferred from user input
- Intent guides iteration strategy
- Misclassification logged for learning

## Testing Requirements

1. `INV-ITR-001`: Test budget enforcement
2. `INV-ITR-002`: Test progress tracking
3. `INV-ITR-SAFE-001`: Test dangerous pattern detection
4. `INV-ITR-SAFE-002`: Test rollback capability
5. `INV-ITR-003`: Test intent classification

## Version History

- V1 (2024-12-16): Initial contract definition
