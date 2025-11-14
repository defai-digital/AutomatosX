# Sprint 7 Week 1: ReScript Core Implementation - PRD

**Document Type**: Product Requirements Document (PRD) - Week 1 Focus
**Sprint**: 7, Week 1 (Days 61-65)
**Version**: 1.0
**Created**: 2025-11-09
**Status**: Ready for Execution
**Priority**: P0 (Critical - Architecture Foundation)

---

## Executive Summary

Week 1 of Sprint 7 focuses exclusively on **completing the ReScript core architecture** - the deterministic, type-safe foundation that will power AutomatosX v2's workflow orchestration, state management, and event-driven capabilities.

This week transforms AutomatosX from a pure TypeScript codebase to a **true hybrid ReScript + TypeScript architecture**, fulfilling the original vision outlined in the AutomatosX v2 PRD.

**Why This Week Matters**:
- ReScript provides **mathematical correctness** through algebraic data types
- State machines enable **deterministic workflow execution**
- Type safety eliminates entire classes of runtime errors
- Foundation for all future orchestration features

**Deliverables**: 5 core ReScript modules, 200 passing tests, seamless TypeScript integration

---

## Vision & Strategic Goals

### Week 1 Vision

> "Build an unbreakable foundation for workflow orchestration through type-safe, deterministic state machines and event-driven architecture in ReScript."

### Strategic Importance

**Architectural Completion**:
- Original PRD promised hybrid ReScript + TypeScript
- P0 implementation had minimal ReScript (5%)
- Week 1 achieves 40-50% ReScript coverage
- Sprint 7 completion reaches 70% target

**Business Value**:
- **Reliability**: State machines prevent invalid states
- **Maintainability**: Type system catches errors at compile time
- **Performance**: ReScript compiles to optimized JavaScript
- **Scalability**: Deterministic execution enables distributed workflows

**Competitive Advantage**:
- Few code intelligence tools use formal state machines
- Type-safe workflow orchestration is rare
- ReScript + TypeScript hybrid is unique in this space

---

## Current State Analysis

### Post-Sprint 6 Status

**Strengths**:
- ✅ 497 tests passing (100%)
- ✅ 17 production-ready TypeScript components
- ✅ Comprehensive code intelligence features
- ✅ Plugin ecosystem operational
- ✅ Solid database foundation (SQLite + FTS5)

**Gaps (Week 1 Addresses)**:
- ⚠️ No state machine system
- ⚠️ No workflow orchestration
- ⚠️ Limited task planning
- ⚠️ No event bus
- ⚠️ ReScript core is placeholder (5% coverage)

**Dependencies (Already Met)**:
- ✅ TypeScript build pipeline working
- ✅ Testing infrastructure (Vitest)
- ✅ Service layer for integration
- ✅ CLI framework for commands

---

## Week 1 Architecture Overview

### ReScript Core Components

```
packages/rescript-core/
├── src/
│   ├── state/
│   │   └── StateMachine.res          # Day 61 (40 tests)
│   ├── workflow/
│   │   ├── TaskPlanner.res           # Day 62 (45 tests)
│   │   └── WorkflowOrchestrator.res  # Day 63 (50 tests)
│   ├── events/
│   │   └── EventBus.res              # Day 64 (35 tests)
│   └── bridge/
│       └── Bridge.res                # Day 65 (30 tests)
├── __tests__/
│   ├── StateMachine.test.res
│   ├── TaskPlanner.test.res
│   ├── WorkflowOrchestrator.test.res
│   ├── EventBus.test.res
│   └── Bridge.test.res
└── bsconfig.json
```

### Integration with TypeScript

```
TypeScript Services
       ↓
    Bridge.res (FFI)
       ↓
ReScript Core Modules
       ↓
    Compiled .bs.js
       ↓
TypeScript Consumes
```

---

## Day-by-Day Requirements

### Day 61: State Machine Foundation

#### Overview

**Purpose**: Implement generic, type-safe state machines for deterministic workflow execution

**Business Value**: Prevent invalid state transitions, ensure workflow correctness

**Technical Complexity**: Medium-High (algebraic data types, pattern matching)

---

#### Functional Requirements

**FR-61.1: State Definition**
- Support generic state types with data
- Predefined states: Idle, Running, Paused, Completed, Failed
- Custom state data per state type
- State equality and comparison

**Acceptance Criteria**:
- [ ] State type compiles without errors
- [ ] States can hold arbitrary data
- [ ] Pattern matching works on all state types
- [ ] State serialization to JSON

---

**FR-61.2: Transition Definition**
- Define transitions between states
- Event-triggered transitions
- Guard functions for conditional transitions
- Action functions for side effects
- Transition validation

**Acceptance Criteria**:
- [ ] Transitions defined declaratively
- [ ] Guards prevent invalid transitions
- [ ] Actions execute on valid transitions
- [ ] Multiple transitions per state

---

**FR-61.3: State Machine Execution**
- Create state machine from initial state + transitions
- Process events to trigger transitions
- Validate transitions before execution
- Execute actions on successful transitions
- Track state history

**Acceptance Criteria**:
- [ ] State machine creation succeeds
- [ ] Valid events trigger correct transitions
- [ ] Invalid events rejected with error
- [ ] History tracks all state changes
- [ ] Actions execute asynchronously

---

**FR-61.4: State Machine Queries**
- Get current state
- Check if transition is valid
- Retrieve state history
- Reset to initial state

**Acceptance Criteria**:
- [ ] Current state retrieval works
- [ ] Transition validation accurate
- [ ] History returned in order
- [ ] Reset clears history

---

#### API Specification

**Type Definitions**:
```rescript
// State representation with generic data
type state<'s> =
  | Idle
  | Running('s)
  | Paused('s)
  | Completed('s)
  | Failed(string)

// Event type (generic)
type event<'e> = 'e

// Guard function (state → bool)
type guard<'s> = 's => bool

// Action function (state → promise<unit>)
type action<'s> = 's => promise<unit>

// Transition definition
type transition<'s, 'e> = {
  from: state<'s>,
  event: event<'e>,
  to: state<'s>,
  guard: option<guard<'s>>,
  action: option<action<'s>>
}

// State machine type
type stateMachine<'s, 'e> = {
  initialState: state<'s>,
  transitions: array<transition<'s, 'e>>,
  mutable currentState: state<'s>,
  mutable history: list<state<'s>>
}
```

**Core Functions**:
```rescript
// Create state machine
let create: (state<'s>, array<transition<'s, 'e>>) => stateMachine<'s, 'e>

// Trigger transition
let transition: (stateMachine<'s, 'e>, event<'e>) => promise<result<state<'s>, string>>

// Query functions
let getCurrentState: stateMachine<'s, 'e> => state<'s>
let canTransition: (stateMachine<'s, 'e>, event<'e>) => bool
let getHistory: stateMachine<'s, 'e> => list<state<'s>>
let reset: stateMachine<'s, 'e> => unit

// Utility functions
let stateToString: state<'s> => string
let transitionToString: transition<'s, 'e> => string
```

---

#### Testing Requirements

**40 Tests Minimum**:

**Category 1: State Creation (5 tests)**
- Create Idle state
- Create Running state with data
- Create Paused state with data
- Create Completed state with data
- Create Failed state with error message

**Category 2: State Machine Creation (5 tests)**
- Create with empty transitions
- Create with single transition
- Create with multiple transitions
- Create with complex state data
- Validate initial state set correctly

**Category 3: Valid Transitions (10 tests)**
- Transition from Idle to Running
- Transition from Running to Paused
- Transition from Paused to Running
- Transition from Running to Completed
- Transition from Running to Failed
- Chain multiple transitions
- Transition with state data update
- Transition with guard passing
- Transition with action executing
- Concurrent transition handling

**Category 4: Invalid Transitions (5 tests)**
- Reject undefined transition
- Reject transition from wrong state
- Reject transition when guard fails
- Handle action errors gracefully
- Prevent invalid state updates

**Category 5: Guards (10 tests)**
- Guard allows transition
- Guard blocks transition
- Multiple guards on same event
- Guard with state data validation
- Guard with external condition
- Async guard resolution
- Guard error handling
- Guard performance (< 1ms)
- Guard chaining
- Guard logging

**Category 6: Actions (5 tests)**
- Action executes on transition
- Action receives state data
- Action updates external state
- Action handles errors
- Multiple actions in sequence

**Test Coverage Target**: 95%+ statement coverage

---

#### Performance Requirements

| Operation | Target | P95 | P99 |
|-----------|--------|-----|-----|
| State creation | <0.1ms | <0.5ms | <1ms |
| Transition (no guard/action) | <0.5ms | <1ms | <2ms |
| Transition (with guard) | <1ms | <2ms | <5ms |
| Transition (with action) | <10ms | <20ms | <50ms |
| History retrieval | <0.5ms | <1ms | <2ms |
| State validation | <0.1ms | <0.5ms | <1ms |

**Memory**: <1KB per state machine instance

---

### Day 62: Task Planning Engine

#### Overview

**Purpose**: Decompose complex workflows into executable task graphs with dependency resolution

**Business Value**: Optimize task execution, detect bottlenecks, enable parallel processing

**Technical Complexity**: High (graph algorithms, topological sort, critical path)

---

#### Functional Requirements

**FR-62.1: Task Definition**
- Define tasks with unique IDs
- Specify task dependencies
- Set resource requirements
- Assign priorities (1-10)
- Estimate duration

**FR-62.2: Dependency Resolution**
- Topological sort for execution order
- Detect circular dependencies
- Validate dependency graph
- Handle missing dependencies

**FR-62.3: Parallel Execution Planning**
- Identify tasks that can run in parallel
- Group by execution level
- Consider resource constraints
- Optimize for throughput

**FR-62.4: Critical Path Analysis**
- Calculate longest path through graph
- Identify bottleneck tasks
- Estimate total completion time
- Suggest optimization opportunities

---

#### API Specification

```rescript
type taskId = string
type resourceId = string

type task = {
  id: taskId,
  name: string,
  estimatedDuration: int, // minutes
  dependencies: array<taskId>,
  requiredResources: array<resourceId>,
  priority: int // 1-10
}

type taskPlan = {
  tasks: array<task>,
  executionOrder: array<taskId>,
  parallelGroups: array<array<taskId>>,
  criticalPath: array<taskId>,
  estimatedTotalTime: int
}

// Core functions
let createTask: (taskId, string, int, array<taskId>, array<resourceId>, int) => task
let plan: array<task> => result<taskPlan, string>
let resolveDependencies: array<task> => result<array<taskId>, string>
let findParallelGroups: (array<task>, array<taskId>) => array<array<taskId>>
let findCriticalPath: (array<task>, array<taskId>) => array<taskId>
let validatePlan: taskPlan => result<unit, array<string>>
let optimizePlan: taskPlan => taskPlan
```

---

#### Testing Requirements

**45 Tests Minimum**:

**Dependency Resolution (15 tests)**
- Simple linear dependency chain
- Diamond dependency pattern
- Multiple independent chains
- Detect single circular dependency
- Detect complex circular dependencies
- Handle missing dependencies
- Topological sort correctness
- Large graph performance (1000+ tasks)

**Parallel Planning (10 tests)**
- Identify completely independent tasks
- Handle resource conflicts
- Group by execution levels
- Optimize for max parallelism
- Consider priority in grouping

**Critical Path (10 tests)**
- Simple linear path
- Multiple paths, longest identified
- Equal-length paths handled
- Dynamic recalculation
- Bottleneck identification

**Validation (5 tests)**
- Valid plan passes
- Invalid dependencies detected
- Resource conflicts identified
- Priority conflicts flagged
- Empty plan handled

**Optimization (5 tests)**
- Reduce total time
- Balance resource usage
- Respect priorities
- Minimize dependencies
- Suggest task splitting

---

### Day 63: Workflow Orchestrator

#### Overview

**Purpose**: Execute multi-step workflows with retry, fallback, and compensation

**Business Value**: Reliable workflow execution, automatic error recovery, transactional consistency

**Technical Complexity**: Very High (async orchestration, retry logic, compensation patterns)

---

#### Functional Requirements

**FR-63.1: Workflow Definition**
- Define multi-step workflows
- Sequential and parallel execution
- Conditional branches
- Loop support
- Nested workflows

**FR-63.2: Retry Mechanism**
- Exponential backoff
- Max retry attempts
- Backoff multiplier
- Max backoff duration
- Retry condition predicates

**FR-63.3: Fallback Strategies**
- Alternative execution paths
- Degraded functionality
- Circuit breaker pattern
- Graceful degradation

**FR-63.4: Compensation (Saga Pattern)**
- Compensation actions per step
- Reverse-order compensation
- Partial compensation
- Compensation failure handling

**FR-63.5: Progress Tracking**
- Step-by-step progress
- Percentage completion
- ETA calculation
- Cancellation support

---

#### API Specification

```rescript
type workflowStep<'input, 'output> = {
  id: string,
  name: string,
  execute: 'input => promise<result<'output, string>>,
  retry: option<retryConfig>,
  fallback: option<'input => promise<result<'output, string>>>,
  compensate: option<'output => promise<unit>>,
  timeout: option<int> // milliseconds
}

type retryConfig = {
  maxAttempts: int,
  backoffMs: int,
  maxBackoffMs: int,
  backoffMultiplier: float,
  retryIf: option<string => bool>
}

type workflowProgress<'output> = {
  currentStep: int,
  totalSteps: int,
  percentage: float,
  completed: array<string>,
  failed: array<string>,
  partial: option<'output>
}

type workflow<'input, 'output> = {
  id: string,
  name: string,
  steps: array<workflowStep<'input, 'output>>,
  onSuccess: option<'output => unit>,
  onFailure: option<string => unit>,
  onProgress: option<workflowProgress<'output> => unit>
}

// Core functions
let createWorkflow: (string, string, array<workflowStep<'input, 'output>>) => workflow<'input, 'output>
let execute: workflow<'input, 'output> => 'input => promise<result<'output, string>>
let executeWithProgress: (workflow<'input, 'output>, 'input, workflowProgress<'output> => unit) => promise<result<'output, string>>
let cancel: workflow<'input, 'output> => unit
let pause: workflow<'input, 'output> => unit
let resume: workflow<'input, 'output> => promise<result<'output, string>>
```

---

#### Testing Requirements

**50 Tests Minimum**:

**Step Execution (10 tests)**
- Execute single step successfully
- Execute multiple steps in sequence
- Handle step failure
- Pass data between steps
- Type-safe data flow

**Retry Logic (15 tests)**
- Retry on transient failure
- Exponential backoff calculation
- Max attempts reached
- Backoff multiplier applied
- Max backoff enforced
- Retry condition evaluation
- Retry with different errors
- Performance under retry load

**Fallback Handling (10 tests)**
- Fallback on step failure
- Fallback after max retries
- Fallback returns alternative result
- Fallback failure handled
- Multiple fallback levels

**Compensation (10 tests)**
- Compensate on workflow failure
- Reverse-order compensation
- Partial compensation after 3rd step
- Compensation failure recovery
- Skip compensation if not needed

**Progress Tracking (5 tests)**
- Progress updates correctly
- Percentage calculated accurately
- ETA reasonable
- Cancellation works
- Pause/resume functional

---

### Day 64: Event Bus

#### Overview

**Purpose**: Type-safe publish-subscribe system for decoupled component communication

**Business Value**: Loose coupling, extensibility, event-driven architecture

**Technical Complexity**: Medium (pub/sub, filtering, async handlers)

---

#### API Specification

```rescript
type event<'data> = {
  id: string,
  timestamp: float,
  data: 'data,
  source: string,
  metadata: Js.Dict.t<string>
}

type subscription<'data> = {
  id: string,
  filter: option<event<'data> => bool>,
  handler: event<'data> => promise<unit>,
  priority: int // Higher priority handlers execute first
}

type eventBus<'data> = {
  mutable subscribers: list<subscription<'data>>,
  mutable history: list<event<'data>>,
  maxHistorySize: int,
  errorHandler: option<exn => unit>
}

let create: int => eventBus<'data>
let subscribe: (eventBus<'data>, option<event<'data> => bool>, event<'data> => promise<unit>, int) => subscription<'data>
let unsubscribe: (eventBus<'data>, subscription<'data>) => unit
let publish: (eventBus<'data>, 'data, string) => promise<unit>
let publishSync: (eventBus<'data>, 'data, string) => unit
let getHistory: (eventBus<'data>, option<int>) => array<event<'data>>
let clearHistory: eventBus<'data> => unit
let getSubscriberCount: eventBus<'data> => int
```

---

#### Testing Requirements

**35 Tests Minimum**:

**Subscribe/Unsubscribe (10 tests)**
- Subscribe handler
- Multiple subscribers
- Unsubscribe removes handler
- Unsubscribe all
- Priority ordering

**Publishing (10 tests)**
- Publish notifies subscribers
- Publish with metadata
- Async publish completion
- Sync publish (fire-and-forget)
- Error in handler doesn't crash bus

**Filtering (10 tests)**
- Filter by event data
- Filter by source
- Filter by metadata
- Complex filter expressions
- Filter performance

**History (5 tests)**
- History stores events
- History max size enforced
- History retrieval
- Clear history
- History filtering

---

### Day 65: ReScript-TypeScript Bridge

#### Overview

**Purpose**: Seamless interop between ReScript and TypeScript for hybrid architecture

**Business Value**: Enable TypeScript code to use ReScript modules easily

**Technical Complexity**: Medium (FFI, type conversion, promise handling)

---

#### API Specification

```rescript
// Type conversions
let resultToPromise: result<'a, string> => promise<'a>
let promiseToResult: promise<'a> => promise<result<'a, string>>
let optionToNullable: option<'a> => Js.Nullable.t<'a>
let nullableToOption: Js.Nullable.t<'a> => option<'a>

// JSON serialization
let toJson: 'a => Js.Json.t
let fromJson: Js.Json.t => result<'a, string>

// Module exports
@module external stateMachine: 'a = "StateMachine"
@module external taskPlanner: 'a = "TaskPlanner"
@module external workflowOrchestrator: 'a = "WorkflowOrchestrator"
@module external eventBus: 'a = "EventBus"

// Type definitions for TypeScript
type stateMachineExport<'s, 'e> = {
  create: (. 's, array<'e>) => stateMachine<'s, 'e>,
  transition: (. stateMachine<'s, 'e>, 'e) => promise<result<'s, string>>,
  getCurrentState: (. stateMachine<'s, 'e>) => 's
}
```

---

#### Testing Requirements

**30 Tests Minimum**:

**Type Conversion (15 tests)**
- Result to Promise success
- Result to Promise error
- Promise to Result success
- Promise to Result error
- Option to Nullable
- Nullable to Option
- JSON serialization
- JSON deserialization

**Promise Handling (10 tests)**
- Async function calls
- Promise chaining
- Error propagation
- Concurrent promises
- Promise.all integration

**Integration Testing (5 tests)**
- TypeScript calls StateMachine
- TypeScript calls TaskPlanner
- TypeScript calls WorkflowOrchestrator
- TypeScript calls EventBus
- End-to-end workflow from TypeScript

---

## Week 1 Success Metrics

### Quantitative Targets

| Metric | Target | Stretch |
|--------|--------|---------|
| **Tests** | 200 | 220 |
| **Test Pass Rate** | 100% | 100% |
| **Code Coverage** | 90% | 95% |
| **Performance** | <10ms P95 | <5ms P95 |
| **ReScript LOC** | 2000+ | 2500+ |
| **Documentation** | 100% | 100% + examples |

### Qualitative Goals

- [ ] Team confident in ReScript syntax
- [ ] TypeScript integration seamless
- [ ] Code reviews positive
- [ ] No major blockers
- [ ] Ready for Week 2

---

## Risk Assessment

### High-Priority Risks

**Risk 1: ReScript Learning Curve**
- **Probability**: Medium (60%)
- **Impact**: High (could delay 2-3 days)
- **Mitigation**:
  - Pair programming
  - ReScript training materials
  - Simple examples first
  - Daily code reviews

**Risk 2: TypeScript Interop Issues**
- **Probability**: Low (30%)
- **Impact**: Medium (1-2 day delay)
- **Mitigation**:
  - Test interop early (Day 61)
  - Use proven patterns
  - Reference documentation
  - Community support

**Risk 3: Performance Bottlenecks**
- **Probability**: Low (20%)
- **Impact**: Medium (1 day optimization)
- **Mitigation**:
  - Benchmark early
  - Profile regularly
  - Optimize hot paths
  - Use efficient data structures

---

## Quality Gates

### Daily Gates

**Every Evening**:
- [ ] All tests passing
- [ ] No compilation errors
- [ ] Code coverage >90%
- [ ] Performance benchmarks met
- [ ] Daily progress documented

### Week 1 Final Gate (End of Day 65)

**Criteria**:
- [ ] ✅ 200+ tests passing (100%)
- [ ] ✅ All 5 ReScript modules complete
- [ ] ✅ TypeScript integration working
- [ ] ✅ Documentation complete
- [ ] ✅ Performance targets met
- [ ] ✅ Code review approved
- [ ] ✅ Ready for Week 2 (Analytics)

---

## Dependencies

### External Dependencies

**ReScript**:
- `rescript@^11.0.0`
- `@rescript/core@^1.0.0`

**TypeScript** (already installed):
- `typescript@^5.0.0`
- `vitest@^1.0.0`

### Internal Dependencies

**Required** (from Sprints 1-6):
- ✅ Build pipeline
- ✅ Testing infrastructure
- ✅ TypeScript service layer
- ✅ CLI framework

---

## Documentation Requirements

### Code Documentation

- [ ] JSDoc comments on all public functions
- [ ] Type annotations complete
- [ ] Usage examples per module
- [ ] Error handling documented

### API Documentation

- [ ] API reference for each module
- [ ] Integration guide
- [ ] TypeScript usage examples
- [ ] Migration guide from pure TypeScript

### Internal Documentation

- [ ] Architecture decision records (ADRs)
- [ ] Design patterns used
- [ ] Performance optimization notes
- [ ] Debugging guide

---

## Appendix A: ReScript Quick Reference

### Basic Syntax

```rescript
// Variables
let x = 42
let y = "hello"

// Functions
let add = (a, b) => a + b

// Type annotations
let typed: int = 42
let func: (int, int) => int = add

// Pattern matching
switch someValue {
| Some(x) => x
| None => 0
}

// Variants (ADTs)
type result<'a, 'e> =
  | Ok('a)
  | Error('e)

// Records
type person = {
  name: string,
  age: int
}

// Mutable fields
type counter = {
  mutable count: int
}

// Promises
let asyncFunc = async () => {
  let result = await somePromise
  result
}
```

---

## Appendix B: Testing Patterns

### ReScript Test Example

```rescript
open Vitest

describe("StateMachine", () => {
  test("should create state machine", () => {
    let sm = StateMachine.create(Idle, [])
    expect(sm->StateMachine.getCurrentState)->toBe(Idle)
  })

  testAsync("should transition asynchronously", async () => {
    let sm = StateMachine.create(Idle, transitions)
    let result = await sm->StateMachine.transition("start")
    expect(result)->toEqual(Ok(Running(())))
  })
})
```

---

## Appendix C: Performance Benchmarks

### Benchmark Suite

```rescript
// Example benchmark
let benchmarkTransition = () => {
  let sm = createComplexStateMachine()
  let startTime = Js.Date.now()

  for i in 1 to 1000 {
    let _ = sm->StateMachine.transition("event")
  }

  let endTime = Js.Date.now()
  let avgTime = (endTime -. startTime) /. 1000.0

  Console.log(`Average transition time: ${avgTime}ms`)
}
```

---

**Document Status**: ✅ Ready for Week 1 Execution
**Next Step**: Review and begin Day 61
**Approval**: Pending team review

