# AutomatosX Runtime - State Machine Contract

**Document Version**: 1.0
**Last Updated**: Sprint 1, Day 3
**Status**: **SIGNED-OFF** ✅
**Reviewers**: ARCH (Architecture), RE1 (Runtime Lead), RE2 (Runtime Engineer)

---

## Executive Summary

This document formally specifies the **State Machine Contract** for AutomatosX Runtime. It defines the complete state space, permissible transitions, guard conditions, effects, and error handling for runtime task orchestration.

**Purpose**: Serve as the authoritative contract for:
- Runtime state transitions (BOOTSTRAPPING → IDLE → PREPARING → EXECUTING → COMPLETED/FAILED/CANCELED)
- Guard verdict integration (Pass/Fail/Defer)
- Effect emission and side-effect isolation
- Error handling and illegal transition validation

---

## 1. State Space Definition

### Lifecycle States

| State                | Enum Representation    | Description                                                                 |
|----------------------|------------------------|-----------------------------------------------------------------------------|
| **BOOTSTRAPPING**    | `State.Bootstrapping`  | Initial state. Runtime initializing dependencies.                           |
| **IDLE**             | `State.Idle`           | Ready to accept task submissions. No active tasks.                          |
| **PREPARING**        | `State.Preparing`      | Task plan hydrated. Evaluating guards and dependencies.                     |
| **WAITING_ON_DEP**   | `State.WaitingOnDependency` | Blocked waiting for dependency resolution. Retryable.                      |
| **EXECUTING**        | `State.Executing`      | Task execution in progress. Monitors for timeouts/violations.              |
| **COMPLETED**        | `State.Completed`      | Task successfully completed. Awaiting telemetry flush before returning to IDLE. |
| **FAILED**           | `State.Failed`         | Task failed due to rule violation, timeout, or error. Retryable.            |
| **CANCELED**         | `State.Canceled`       | Task explicitly canceled by user/system. Retryable to IDLE.                |

### Terminal vs. Non-Terminal States

- **Non-Terminal**: BOOTSTRAPPING, IDLE, PREPARING, WAITING_ON_DEP, EXECUTING
- **Terminal** (require explicit transition to exit): COMPLETED, FAILED, CANCELED

---

## 2. Event Catalog

### Event Types

| Event                  | Payload Type         | Trigger Context                                                         |
|------------------------|----------------------|-------------------------------------------------------------------------|
| **TaskSubmitted**      | `{taskId, manifestVersion}` | User submits new task for execution                                     |
| **DependenciesReady**  | None                 | Dependency graph resolved and ready                                     |
| **RuleViolation**      | `string` (rule name) | Policy engine detected violation during execution                       |
| **Timeout**            | `int` (milliseconds) | Execution exceeded time limit                                           |
| **CancelRequest**      | `{requestedBy}`      | Explicit cancellation request from user or system                       |
| **RetryTrigger**       | None                 | Manual or automated retry after failure                                 |
| **TelemetryFlushed**   | None                 | Telemetry buffer successfully flushed                                   |

---

## 3. Transition Matrix

### Valid Transitions

| From State             | Event                | Guard Conditions                                  | To State             | Effects                                                                 |
|------------------------|----------------------|--------------------------------------------------|----------------------|-------------------------------------------------------------------------|
| BOOTSTRAPPING          | DependenciesReady    | None                                             | IDLE                 | EmitTelemetry("runtime.bootstrapped")                                   |
| IDLE                   | TaskSubmitted        | None                                             | PREPARING            | HydratePlan(taskId), EmitTelemetry("task.accepted")                     |
| PREPARING              | DependenciesReady    | dependenciesReady=true, guardVerdict=Allowed     | EXECUTING            | EvaluateGuards, StartExecution("plan")                                  |
| PREPARING              | DependenciesReady    | dependenciesReady=false                          | PREPARING (deferred) | EmitTelemetry("transition.deferred")                                    |
| PREPARING              | CancelRequest        | cancellationRequested=true                       | CANCELED             | RecordCancellation(requestedBy)                                         |
| PREPARING              | Timeout              | None                                             | FAILED               | PerformRollback("timeout:{ms}")                                         |
| WAITING_ON_DEP         | DependenciesReady    | dependenciesReady=true                           | PREPARING            | EmitTelemetry("dependencies.ready")                                     |
| WAITING_ON_DEP         | RetryTrigger         | None                                             | PREPARING            | ScheduleRetry                                                           |
| WAITING_ON_DEP         | CancelRequest        | None                                             | CANCELED             | RecordCancellation(requestedBy)                                         |
| WAITING_ON_DEP         | Timeout              | None                                             | FAILED               | PerformRollback("wait-timeout:{ms}")                                    |
| EXECUTING              | TelemetryFlushed     | telemetryPending=false                           | COMPLETED            | FlushTelemetryBuffer                                                    |
| EXECUTING              | TelemetryFlushed     | telemetryPending=true                            | EXECUTING (same)     | FlushTelemetryBuffer                                                    |
| EXECUTING              | RuleViolation        | None                                             | FAILED               | PerformRollback(rule)                                                   |
| EXECUTING              | Timeout              | None                                             | FAILED               | PerformRollback("execution-timeout:{ms}")                               |
| EXECUTING              | CancelRequest        | None                                             | CANCELED             | RecordCancellation(requestedBy), PerformRollback("canceled")            |
| COMPLETED              | TelemetryFlushed     | None                                             | IDLE                 | EmitTelemetry("task.completed")                                         |
| FAILED                 | RetryTrigger         | None                                             | PREPARING            | ScheduleRetry                                                           |
| CANCELED               | RetryTrigger         | None                                             | IDLE                 | EmitTelemetry("task.canceled.retry")                                    |

### Illegal Transitions

All transitions **not** listed in the table above are considered **illegal** and will result in a **Rejected** outcome with a descriptive error message.

**Examples of Illegal Transitions**:
- BOOTSTRAPPING + TaskSubmitted → Rejected("Runtime must finish bootstrapping before processing events.")
- IDLE + DependenciesReady → Rejected("Idle state only accepts task submissions.")
- PREPARING + RetryTrigger → Rejected("Preparing state only responds to deps/cancel/timeouts.")
- COMPLETED + CancelRequest → Rejected("Completed tasks await telemetry flush only.")

---

## 4. Guard Verdict Integration

### GuardVerdict Type

```rescript
type guardVerdict =
  | Allowed
  | Blocked(string)  // reason
```

### Guard Evaluation Points

1. **PREPARING → EXECUTING**: Guard evaluation occurs when `DependenciesReady` event is received
   - **Allowed**: Transition proceeds to EXECUTING
   - **Blocked(reason)**: Transition is **rejected** with reason: `Guard blocked transition: {reason}`

### Guard Context Requirements

Guards receive context with:
- `currentState`: Current state machine state
- `event`: Event triggering the transition
- `metadata`: Optional metadata (e.g., taskId, manifestVersion)

---

## 5. Context Requirements

### Context Type

```rescript
type context = {
  dependenciesReady: bool,
  guardVerdict: GuardVerdict.t,
  telemetryPending: bool,
  cancellationRequested: bool,
}
```

### Context Validation Rules

| Context Field            | Validation Rule                                                      | Default Value |
|--------------------------|----------------------------------------------------------------------|---------------|
| `dependenciesReady`      | Must be `true` to proceed from PREPARING → EXECUTING                | `false`       |
| `guardVerdict`           | Must be `Allowed` to proceed from PREPARING → EXECUTING              | `Allowed`     |
| `telemetryPending`       | When `false`, EXECUTING → COMPLETED proceeds on TelemetryFlushed     | `false`       |
| `cancellationRequested`  | Must be `true` to accept CancelRequest in PREPARING state            | `false`       |

**Contract Violation**: If context requirements are not met, the transition is **deferred** (PREPARING state) or **rejected** (all other states).

---

## 6. Effect Emission Contract

### Effect Types

| Effect                       | Trigger Transition                                      | Side Effect Description                                 |
|------------------------------|--------------------------------------------------------|---------------------------------------------------------|
| **HydratePlan(taskId)**      | IDLE → PREPARING                                       | Load task plan from manifest store                      |
| **EvaluateGuards**           | PREPARING → EXECUTING                                  | Run guard validation pipeline                           |
| **StartExecution(taskId)**   | PREPARING → EXECUTING                                  | Invoke execution engine with task plan                  |
| **EnterWaitState**           | (Reserved for future use)                              | Put task into dependency wait queue                     |
| **EmitTelemetry(label)**     | Various transitions                                    | Emit structured telemetry event with label              |
| **ScheduleRetry**            | FAILED → PREPARING, WAITING_ON_DEP → PREPARING         | Schedule retry with exponential backoff                 |
| **PerformRollback(reason)**  | → FAILED, → CANCELED                                   | Rollback state changes, log reason                      |
| **RecordCancellation(actor)**| → CANCELED                                             | Record who/what triggered cancellation                  |
| **FlushTelemetryBuffer**     | EXECUTING → COMPLETED                                  | Flush pending telemetry events before completion        |

**Effect Execution Guarantee**: All effects in the `effects` array **must** be applied by the event dispatcher **after** the transition completes successfully. Effects are **best-effort** and do **not** block transitions.

---

## 7. Outcome Types

### Status Enum

```rescript
type status =
  | Transitioned  // Transition succeeded
  | Rejected      // Transition not allowed (illegal event or context mismatch)
  | Deferred      // Transition temporarily blocked (context not ready)
```

### Outcome Structure

```rescript
type outcome = {
  status: status,
  fromState: State.t,
  toState: State.t,
  event: Event.t,
  effects: array<Effect.t>,
  reason: option<string>,  // Present for Rejected/Deferred outcomes
}
```

### Outcome Contract

- **Transitioned**: `toState` differs from `fromState`, `effects` array contains 1+ effects, `reason` is `None`
- **Rejected**: `toState` equals `fromState`, `effects` is empty, `reason` contains error message
- **Deferred**: `toState` equals `fromState`, `effects` contains `EmitTelemetry("transition.deferred")`, `reason` explains deferral

---

## 8. Error Handling & Validation

### Illegal Transition Validation

**Contract**: The state machine **must** reject all transitions not explicitly listed in the transition matrix (Section 3).

**Error Message Format**:
```
"<StateName> state <restriction description>"

Examples:
- "Runtime must finish bootstrapping before processing events."
- "Idle state only accepts task submissions."
- "Preparing state only responds to deps/cancel/timeouts."
- "Executing state ignores unrelated events."
- "Completed tasks await telemetry flush only."
- "Failed state only responds to retry triggers."
- "Canceled state only allows retries into idle."
```

### Guard Blocked Transition

**Contract**: If `guardVerdict` is `Blocked(reason)` during PREPARING → EXECUTING transition, the transition **must** be rejected with:

```
"Guard blocked transition: <reason>"
```

### Context Deferral

**Contract**: If context requirements are not met (e.g., `dependenciesReady=false`), the transition **must** be deferred with a descriptive reason:

```
"Dependencies not confirmed by controller."
"Dependency graph not ready; remaining in wait state."
```

---

## 9. Cancellation Preconditions

### CancelRequest Event Processing

| From State        | Precondition                              | Action                                  |
|-------------------|-------------------------------------------|-----------------------------------------|
| **PREPARING**     | `cancellationRequested=true`              | Transition to CANCELED                  |
| **PREPARING**     | `cancellationRequested=false`             | **Reject** with "Cancellation request not acknowledged." |
| **WAITING_ON_DEP**| None (always allowed)                     | Transition to CANCELED                  |
| **EXECUTING**     | None (always allowed)                     | Transition to CANCELED + rollback       |
| **All other states** | N/A                                    | **Reject** as illegal transition        |

**Contract**: Cancellation requests **must** be explicitly acknowledged via `context.cancellationRequested=true` in the PREPARING state. All other states accept cancellations without preconditions (or reject as illegal).

---

## 10. Testing Requirements (Day 3 Target: 820 Tests)

### Test Coverage Breakdown

| Test Category                           | Test Count | Description                                                         |
|-----------------------------------------|------------|---------------------------------------------------------------------|
| **Contract Boundary Tests**             | 25         | Test all valid transitions from transition matrix                   |
| **Illegal Transition Tests**            | 10         | Test rejected transitions (e.g., BOOTSTRAPPING + TaskSubmitted)     |
| **Cancellation Precondition Tests**     | 5          | Test cancellation with/without `cancellationRequested` flag         |
| **Guard Verdict Integration Tests**     | 5          | Test Allowed vs. Blocked verdicts in PREPARING → EXECUTING          |
| **Context Deferral Tests**              | 5          | Test deferred transitions due to missing context requirements       |
| **Error Message Validation Tests**      | 5          | Verify error message format for rejected/deferred transitions       |

**Total New Tests**: 40 (brings total from 780 to 820)

---

## 11. Compliance Checklist

- [x] **State space fully enumerated** (8 states defined)
- [x] **Event catalog complete** (7 events with payloads)
- [x] **Transition matrix documented** (all valid transitions listed)
- [x] **Guard integration specified** (Allowed/Blocked verdicts)
- [x] **Context requirements defined** (dependenciesReady, guardVerdict, telemetryPending, cancellationRequested)
- [x] **Effect emission contract established** (9 effect types with trigger conditions)
- [x] **Outcome types specified** (Transitioned/Rejected/Deferred with structure)
- [x] **Error handling contract defined** (illegal transition validation, guard blocks, context deferral)
- [x] **Cancellation preconditions documented** (state-specific rules)
- [x] **Test requirements specified** (820 tests target, 40 new tests breakdown)

---

## 12. Threat Model Integration (Day 3 Deliverable)

See companion document: `automatosx/tmp/p0-week1/day3-threat-model-v1.md`

**Attack Surface Summary** (from Day 1 security checklist):
- BOOTSTRAPPING → IDLE: Spoofed dependency validation
- IDLE → PREPARING: Malicious manifest smuggling
- PREPARING → EXECUTING: Guard bypass exploitation
- EXECUTING → COMPLETED/FAILED/CANCELED: Event spoofing and replay attacks

**Mitigation Strategy**: All events must carry authenticated trace/span IDs, guards run in isolated workers, schema validation on all event payloads.

---

## 13. Sign-Off

**Architecture Lead (ARCH)**: ✅ **APPROVED** - Contract is complete, exhaustive, and production-ready.
**Runtime Lead (RE1)**: ✅ **APPROVED** - Implementation matches contract specification.
**Runtime Engineer (RE2)**: ✅ **APPROVED** - All transitions covered, error handling comprehensive.

**Contract Version**: 1.0
**Effective Date**: Sprint 1, Day 3
**Next Review**: Day 5 (Week 1 gate review)

---

**End of Contract Document**
