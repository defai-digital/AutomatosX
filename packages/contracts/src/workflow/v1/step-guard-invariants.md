# Step Guard Invariants

This document specifies the behavioral guarantees for workflow step guards.

## Guard Execution Invariants

### INV-WF-GUARD-001: Before Guard Timing
**Before guards MUST run before step execution starts.**

- Guard check completes fully before step executor is invoked
- If guard blocks, step executor is never called
- Guard duration is NOT included in step duration

### INV-WF-GUARD-002: After Guard Timing
**After guards MUST run after step completes but before next step.**

- Guard runs only if step completes (success or failure)
- Guard runs before checkpoint is created
- Guard cannot undo step execution, only block continuation

### INV-WF-GUARD-003: Block Behavior
**Block failures MUST prevent step execution/continuation.**

- `onFail: 'block'` with FAIL status prevents:
  - Before guard: Step execution
  - After guard: Next step execution
- `onFail: 'warn'` with FAIL status logs but continues
- `onFail: 'continue'` ignores failures entirely

### INV-WF-GUARD-004: Audit Trail
**Guard results MUST be included in trace events.**

- Every guard check emits a trace event
- Event includes: guard ID, step ID, position, status, gate results
- Blocked executions include guard result in progress event

## Progress Event Invariants

### INV-PROG-001: Starting Event
**Every stage MUST emit 'starting' event before execution.**

- Event emitted before guard check (if any)
- Event includes stage index, total, name, type

### INV-PROG-002: Terminal Event
**Every stage MUST emit terminal event.**

Terminal events are: completed, failed, skipped, blocked

- Exactly one terminal event per stage per execution
- Event includes duration (except skipped)
- Failed/blocked includes error/guard result

### INV-PROG-003: Index Consistency
**Stage index is 0-based, total is constant.**

- First stage has stageIndex = 0
- stageTotal never changes during execution
- stageIndex + 1 = stageTotal for last stage

## Gate Execution Invariants

### INV-GATE-001: Gate Independence
**Gates within a guard execute independently.**

- One gate failure does not prevent other gates from running
- All gate results collected before guard decision

### INV-GATE-002: Gate Determinism
**Gate checks are deterministic given same context.**

- Same context produces same gate result
- No side effects during gate check

## Policy Resolution Invariants

### INV-POL-001: Priority Ordering
**Policies apply in priority order (highest first).**

- Higher priority policies' guards run first
- Same priority: lexicographic by policy ID

### INV-POL-002: Pattern Matching
**Pattern matching uses glob syntax.**

- `*` matches any string
- Patterns match against: workflow ID, agent ID, step type
- All patterns must match for policy to apply
