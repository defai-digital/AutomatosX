# Autonomous Loop Invariants

This document defines the behavioral guarantees for the autonomous loop system.

## Overview

The autonomous loop enables governed write-test-fix cycles where agents can iterate through code development phases while respecting governance policies and user-defined breakpoints.

## Invariants

### INV-ALO-001: Guard Gates After Write

**Statement**: Guard gates MUST run after EVERY write phase.

**Rationale**: Ensures all code changes are validated against governance policies before proceeding.

**Enforcement**:
- Phase machine triggers guard check on write phase completion
- Guard check is non-skippable in the phase transition logic
- Failed guard checks block progression to test phase

**Verification**:
```typescript
// After write phase completes
expect(state.lastGuardResult).toBeDefined();
expect(state.lastGuardResult.policyId).toBe(config.guardPolicy);
```

---

### INV-ALO-002: Test Phase Before Verify

**Statement**: When `requireTestPass=true`, test phase MUST complete successfully before verify phase.

**Rationale**: Ensures code correctness is validated before final verification.

**Enforcement**:
- Phase machine checks `requireTestPass` config
- Blocks transition to verify if tests not passed
- Logs skip reason when `requireTestPass=false`

**Verification**:
```typescript
// With requireTestPass=true
if (config.requireTestPass) {
  expect(state.lastTestResult?.passed).toBe(true);
}
```

---

### INV-ALO-003: Fix Attempts Bounded

**Statement**: Fix attempts MUST NOT exceed `maxFixAttempts` per iteration.

**Rationale**: Prevents infinite loops when fixes fail repeatedly.

**Enforcement**:
- Counter incremented on each fix attempt
- Counter reset on new iteration
- Loop fails when limit exceeded

**Verification**:
```typescript
expect(state.currentFixAttempts).toBeLessThanOrEqual(config.maxFixAttempts);
```

---

### INV-ALO-004: Breakpoints Pause Execution

**Statement**: Loop MUST pause for user review at configured breakpoint phases.

**Rationale**: Allows human oversight at critical points in autonomous execution.

**Enforcement**:
- Phase machine checks breakpoints array
- Sets status to 'paused' at breakpoint phases
- Requires explicit continue to resume

**Verification**:
```typescript
if (config.breakpoints.includes(state.phase)) {
  expect(state.status).toBe('paused');
  expect(state.pauseReason).toContain('breakpoint');
}
```

---

### INV-ALO-005: Changed Files Tracked

**Statement**: All changed files MUST be tracked across iterations for guard radius checks.

**Rationale**: Enables change radius governance and rollback capability.

**Enforcement**:
- Write phase records changed files
- Files accumulated across iterations
- Passed to guard check for radius validation

**Verification**:
```typescript
// All changed files from iterations are tracked
const allChangedFiles = new Set(state.changedFiles);
for (const iteration of state.iterations) {
  for (const file of iteration.changedFiles) {
    expect(allChangedFiles.has(file)).toBe(true);
  }
}
```

---

### INV-ALO-006: Valid Phase Transitions Only

**Statement**: Phase transitions MUST follow the defined state machine.

**Rationale**: Ensures predictable execution flow and prevents invalid states.

**Enforcement**:
- Phase machine validates transitions
- Invalid transitions throw error
- State machine is deterministic

**Valid Transitions**:
```
plan    → write
write   → test, verify (if requireTestPass=false)
test    → fix, verify
fix     → test, write
verify  → complete, write
complete → (terminal)
```

**Verification**:
```typescript
expect(isValidPhaseTransition(fromPhase, toPhase)).toBe(true);
```

---

### INV-ALO-007: Iteration Limit Enforced

**Statement**: Loop MUST fail when `maxIterations` is exceeded.

**Rationale**: Prevents runaway execution and resource exhaustion.

**Enforcement**:
- Iteration counter checked before each iteration
- Loop fails with MAX_ITERATIONS_EXCEEDED error
- State preserved for debugging

**Verification**:
```typescript
expect(state.iteration).toBeLessThanOrEqual(config.maxIterations);
```

---

### INV-ALO-008: Immutable Iteration History

**Statement**: Completed iteration records MUST NOT be modified.

**Rationale**: Ensures audit trail integrity for debugging and compliance.

**Enforcement**:
- Iterations are append-only
- Records frozen after completion
- No modification methods exposed

**Verification**:
```typescript
const iterationCount = state.iterations.length;
// After any operation
expect(state.iterations.length).toBeGreaterThanOrEqual(iterationCount);
// Existing records unchanged
```

---

### INV-ALO-009: Guard Block Stops Execution

**Statement**: When guard check returns `blocked=true`, loop MUST stop with 'blocked' status.

**Rationale**: Enforces governance policies as hard constraints.

**Enforcement**:
- Guard result checked for blocked flag
- Status set to 'blocked' immediately
- Requires user intervention to proceed

**Verification**:
```typescript
if (state.lastGuardResult?.blocked) {
  expect(state.status).toBe('blocked');
}
```

---

### INV-ALO-010: Timeout Per Phase

**Statement**: Each phase MUST complete within `phaseTimeout` milliseconds.

**Rationale**: Prevents stuck phases from blocking execution indefinitely.

**Enforcement**:
- Timer started at phase entry
- Phase aborted on timeout
- State records timeout error

**Verification**:
```typescript
for (const iteration of state.iterations) {
  expect(iteration.durationMs).toBeLessThanOrEqual(config.phaseTimeout);
}
```

## Error Handling

| Error Code | Condition | Recovery |
|------------|-----------|----------|
| ALO_LOOP_NOT_FOUND | Loop ID doesn't exist | Create new loop |
| ALO_LOOP_ALREADY_RUNNING | Duplicate start attempt | Use existing loop |
| ALO_LOOP_NOT_PAUSED | Continue on non-paused | Wait for pause |
| ALO_MAX_ITERATIONS_EXCEEDED | Hit iteration limit | Abort or increase limit |
| ALO_MAX_FIX_ATTEMPTS_EXCEEDED | Hit fix limit | Manual intervention |
| ALO_GUARD_BLOCKED | Guard policy violation | Fix violations |
| ALO_TEST_FAILED | Tests failed after fixes | Debug tests |
| ALO_PHASE_TIMEOUT | Phase took too long | Increase timeout |
| ALO_INVALID_TRANSITION | Invalid phase change | Check state machine |
| ALO_CANCELLED | User cancelled | Restart if needed |
| ALO_AGENT_FAILED | Agent execution error | Check agent config |

## State Machine Diagram

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌──────┐       ┌─────────┐       ┌──────┐       ┌────────┴──┐       ┌──────────┐
│ plan │──────▶│  write  │──────▶│ test │──────▶│   verify  │──────▶│ complete │
└──────┘       └────┬────┘       └───┬──┘       └───────────┘       └──────────┘
                    │                │                 │
                    │                │                 │
                    │                ▼                 │
                    │           ┌─────────┐           │
                    │           │   fix   │           │
                    │           └────┬────┘           │
                    │                │                 │
                    └────────────────┴─────────────────┘
                    (back to write on regeneration needed)
```

## Integration Points

1. **Guard System**: Calls `guard.check()` after write phase
2. **Agent System**: Uses configured agent for code generation
3. **Session System**: Tracks loop in session context
4. **Trace System**: Emits trace events for observability
