# revamp_v1 Phase 4: Workflow Engine - Detailed Action Plan

**Project:** AutomatosX Revamp v1
**Phase:** Phase 4 - Workflow Engine
**Duration:** 4 weeks (20 working days)
**Start Date:** February 2, 2026 (Monday)
**End Date:** February 28, 2026 (Saturday, working day)
**Team:** 2 backend developers + 1 QA engineer

---

## Overview

This document provides day-by-day execution plan for Phase 4, implementing a comprehensive workflow orchestration engine with multi-agent collaboration, parallel execution, and checkpoint/resume capabilities. Following the ReScript + TypeScript + Zod architecture pattern established in Phases 1-3.

**Key Deliverables:**
- ReScript state machine for workflow execution (~700 lines)
- Workflow parser (YAML/JSON) (~140 lines)
- Workflow engine with orchestration (~150 lines)
- Checkpoint system (~120 lines)
- Zod validation schemas (~150 lines)
- Database migration 011 (~200 lines)
- 75+ comprehensive tests
- Performance benchmarks and documentation

---

## Week 1: Foundation & State Machine

**Goals:**
- Complete ReScript workflow state machine
- Define Zod schemas
- Create database migration
- Setup workflow infrastructure

**Deliverables:**
- WorkflowStateMachine.res (functional ~700 lines)
- workflow.schema.ts (complete ~150 lines)
- Migration 011 (applied ~200 lines)
- 30+ tests passing

---

### Day 1 (Monday, Feb 2): ReScript State & Event Modules

**Time Allocation:** 8 hours

**Tasks:**

1. **Create ReScript Workflow Module Structure** (1 hour)
   ```bash
   mkdir -p packages/rescript-core/src/workflows
   touch packages/rescript-core/src/workflows/WorkflowStateMachine.res
   ```

2. **Implement State Module** (~1.5 hours)

   File: `packages/rescript-core/src/workflows/WorkflowStateMachine.res`

   ```rescript
   module State = {
     type t =
       | Idle
       | Parsing
       | ValidatingWorkflow
       | BuildingDependencyGraph
       | SchedulingSteps
       | ExecutingSteps
       | AwaitingCompletion
       | CreatingCheckpoint
       | RestoringFromCheckpoint
       | AggregatingResults
       | Completed
       | Failed
       | Paused
       | Cancelled

     let toString = (state: t): string => {
       switch state {
       | Idle => "idle"
       | Parsing => "parsing"
       | ValidatingWorkflow => "validating_workflow"
       | BuildingDependencyGraph => "building_dependency_graph"
       | SchedulingSteps => "scheduling_steps"
       | ExecutingSteps => "executing_steps"
       | AwaitingCompletion => "awaiting_completion"
       | CreatingCheckpoint => "creating_checkpoint"
       | RestoringFromCheckpoint => "restoring_from_checkpoint"
       | AggregatingResults => "aggregating_results"
       | Completed => "completed"
       | Failed => "failed"
       | Paused => "paused"
       | Cancelled => "cancelled"
       }
     }

     let fromString = (str: string): option<t> => {
       switch str {
       | "idle" => Some(Idle)
       | "parsing" => Some(Parsing)
       | "validating_workflow" => Some(ValidatingWorkflow)
       | "building_dependency_graph" => Some(BuildingDependencyGraph)
       | "scheduling_steps" => Some(SchedulingSteps)
       | "executing_steps" => Some(ExecutingSteps)
       | "awaiting_completion" => Some(AwaitingCompletion)
       | "creating_checkpoint" => Some(CreatingCheckpoint)
       | "restoring_from_checkpoint" => Some(RestoringFromCheckpoint)
       | "aggregating_results" => Some(AggregatingResults)
       | "completed" => Some(Completed)
       | "failed" => Some(Failed)
       | "paused" => Some(Paused)
       | "cancelled" => Some(Cancelled)
       | _ => None
       }
     }

     let isTerminal = (state: t): bool => {
       switch state {
       | Completed | Failed | Cancelled => true
       | _ => false
       }
     }

     let canPause = (state: t): bool => {
       switch state {
       | ExecutingSteps | AwaitingCompletion => true
       | _ => false
       }
     }

     let canCheckpoint = (state: t): bool => {
       switch state {
       | ExecutingSteps | AwaitingCompletion | Paused => true
       | _ => false
       }
     }
   }
   ```

   **Lines:** ~80

3. **Implement Event Module** (~3 hours)

   ```rescript
   module Event = {
     type stepDef = {
       id: string,
       name: string,
       agentId: string,
       task: string,
       dependencies: array<string>,
       parallel: bool,
       timeout: option<int>,
       retries: int,
     }

     type checkpointData = {
       checkpointId: string,
       completedSteps: array<string>,
       pendingSteps: array<string>,
       stepResults: Js.Dict.t<Js.Json.t>,
     }

     type t =
       | InitiateWorkflow({
           workflowId: string,
           definition: string,
           format: string,
           context: Js.Dict.t<Js.Json.t>,
         })
       | ParseWorkflow
       | WorkflowParsed({steps: array<stepDef>})
       | ParseFailed({error: string})
       | ValidateWorkflow
       | WorkflowValid
       | WorkflowInvalid({reason: string})
       | BuildGraph
       | GraphBuilt({
           nodes: array<string>,
           edges: array<(string, string)>,
           executionOrder: array<array<string>>,
         })
       | GraphInvalid({reason: string})
       | ScheduleSteps({schedule: array<array<string>>})
       | StepsScheduled
       | ExecuteStepBatch({stepIds: array<string>})
       | StepCompleted({stepId: string, result: Js.Json.t})
       | StepFailed({stepId: string, error: string})
       | BatchCompleted
       | AllStepsCompleted
       | CreateCheckpoint
       | CheckpointCreated({checkpointId: string})
       | RestoreCheckpoint({checkpointData: checkpointData})
       | CheckpointRestored
       | AggregateResults
       | ResultsAggregated({results: Js.Dict.t<Js.Json.t>})
       | CompleteWorkflow({results: Js.Dict.t<Js.Json.t>})
       | WorkflowFailed({error: string, code: option<string>})
       | PauseWorkflow
       | ResumeWorkflow
       | CancelWorkflow
       | Reset

     let toString = (event: t): string => {
       // ... event toString implementation
     }
   }
   ```

   **Lines:** ~120

4. **Update rescript.json** (30 min)

5. **Write Initial Tests** (2 hours)

   ```rescript
   open Vitest

   describe("Workflow State Module", () => {
     test("toString converts states correctly", () => {
       expect(State.toString(State.Idle))->toBe("idle")
       expect(State.toString(State.Parsing))->toBe("parsing")
       expect(State.toString(State.ExecutingSteps))->toBe("executing_steps")
       expect(State.toString(State.Completed))->toBe("completed")
     })

     test("fromString parses states", () => {
       expect(State.fromString("idle"))->toEqual(Some(State.Idle))
       expect(State.fromString("parsing"))->toEqual(Some(State.Parsing))
       expect(State.fromString("invalid"))->toEqual(None)
     })

     test("isTerminal identifies terminal states", () => {
       expect(State.isTerminal(State.Completed))->toBe(true)
       expect(State.isTerminal(State.Failed))->toBe(true)
       expect(State.isTerminal(State.Cancelled))->toBe(true)
       expect(State.isTerminal(State.ExecutingSteps))->toBe(false)
     })

     test("canPause identifies pausable states", () => {
       expect(State.canPause(State.ExecutingSteps))->toBe(true)
       expect(State.canPause(State.AwaitingCompletion))->toBe(true)
       expect(State.canPause(State.Completed))->toBe(false)
     })

     test("canCheckpoint identifies checkpointable states", () => {
       expect(State.canCheckpoint(State.ExecutingSteps))->toBe(true)
       expect(State.canCheckpoint(State.AwaitingCompletion))->toBe(true)
       expect(State.canCheckpoint(State.Paused))->toBe(true)
       expect(State.canCheckpoint(State.Idle))->toBe(false)
     })
   })

   describe("Event Module", () => {
     test("toString converts events correctly", () => {
       expect(Event.toString(Event.ParseWorkflow))->toBe("parse_workflow")
       expect(Event.toString(Event.ValidateWorkflow))->toBe("validate_workflow")
       expect(Event.toString(Event.CreateCheckpoint))->toBe("create_checkpoint")
     })
   })
   ```

   **Tests Written:** 9 tests

**End of Day Status:**
- ✅ State module complete (~80 lines)
- ✅ Event module complete (~120 lines)
- ✅ 9 tests passing
- ✅ ReScript building successfully

---

### Day 2 (Tuesday, Feb 3): Context Module

**Time Allocation:** 8 hours

**Tasks:**

1. **Implement Context Module** (~5 hours)

   ```rescript
   module Context = {
     type workflowInfo = {
       workflowId: string,
       definition: string,
       format: string,
       context: Js.Dict.t<Js.Json.t>,
     }

     type stepInfo = {
       id: string,
       name: string,
       agentId: string,
       task: string,
       dependencies: array<string>,
       parallel: bool,
       timeout: option<int>,
       retries: int,
       status: string,
       result: option<Js.Json.t>,
       error: option<string>,
     }

     type graphInfo = {
       nodes: array<string>,
       edges: array<(string, string)>,
       executionOrder: array<array<string>>,
     }

     type checkpointInfo = {
       checkpointId: string,
       createdAt: float,
       completedSteps: array<string>,
       pendingSteps: array<string>,
       stepResults: Js.Dict.t<Js.Json.t>,
     }

     type metrics = {
       startTime: float,
       endTime: option<float>,
       duration: option<int>,
       totalSteps: int,
       completedSteps: int,
       failedSteps: int,
       checkpoints: int,
       currentBatch: int,
     }

     type t = {
       workflow: option<workflowInfo>,
       steps: array<stepInfo>,
       graph: option<graphInfo>,
       currentBatchIndex: int,
       checkpoints: array<checkpointInfo>,
       results: Js.Dict.t<Js.Json.t>,
       error: option<string>,
       errorCode: option<string>,
       metrics: metrics,
       metadata: Js.Dict.t<Js.Json.t>,
     }

     let create = (): t => {
       {
         workflow: None,
         steps: [],
         graph: None,
         currentBatchIndex: 0,
         checkpoints: [],
         results: Js.Dict.empty(),
         error: None,
         errorCode: None,
         metrics: {
           startTime: Js.Date.now(),
           endTime: None,
           duration: None,
           totalSteps: 0,
           completedSteps: 0,
           failedSteps: 0,
           checkpoints: 0,
           currentBatch: 0,
         },
         metadata: Js.Dict.empty(),
       }
     }

     let setWorkflow = (ctx: t, workflow: workflowInfo): t => {
       {...ctx, workflow: Some(workflow)}
     }

     let setSteps = (ctx: t, stepDefs: array<Event.stepDef>): t => {
       // Convert stepDefs to stepInfo array
       let steps = Belt.Array.map(stepDefs, stepDef => {
         {
           id: stepDef.id,
           name: stepDef.name,
           agentId: stepDef.agentId,
           task: stepDef.task,
           dependencies: stepDef.dependencies,
           parallel: stepDef.parallel,
           timeout: stepDef.timeout,
           retries: stepDef.retries,
           status: "pending",
           result: None,
           error: None,
         }: stepInfo
       })

       {
         ...ctx,
         steps: steps,
         metrics: {...ctx.metrics, totalSteps: Belt.Array.length(steps)},
       }
     }

     let setGraph = (
       ctx: t,
       nodes: array<string>,
       edges: array<(string, string)>,
       executionOrder: array<array<string>>,
     ): t => {
       {
         ...ctx,
         graph: Some({
           nodes: nodes,
           edges: edges,
           executionOrder: executionOrder,
         }),
       }
     }

     let completeStep = (ctx: t, stepId: string, result: Js.Json.t): t => {
       let updatedSteps = Belt.Array.map(ctx.steps, step => {
         if step.id == stepId {
           {...step, status: "completed", result: Some(result)}
         } else {
           step
         }
       })

       Js.Dict.set(ctx.results, stepId, result)

       {
         ...ctx,
         steps: updatedSteps,
         metrics: {...ctx.metrics, completedSteps: ctx.metrics.completedSteps + 1},
       }
     }

     let failStep = (ctx: t, stepId: string, error: string): t => {
       let updatedSteps = Belt.Array.map(ctx.steps, step => {
         if step.id == stepId {
           {...step, status: "failed", error: Some(error)}
         } else {
           step
         }
       })

       {
         ...ctx,
         steps: updatedSteps,
         metrics: {...ctx.metrics, failedSteps: ctx.metrics.failedSteps + 1},
       }
     }

     let addCheckpoint = (ctx: t, checkpointId: string): t => {
       let completedSteps =
         Belt.Array.keep(ctx.steps, step => step.status == "completed")
         ->Belt.Array.map(step => step.id)

       let pendingSteps =
         Belt.Array.keep(ctx.steps, step =>
           step.status == "pending" || step.status == "running"
         )
         ->Belt.Array.map(step => step.id)

       let checkpoint: checkpointInfo = {
         checkpointId: checkpointId,
         createdAt: Js.Date.now(),
         completedSteps: completedSteps,
         pendingSteps: pendingSteps,
         stepResults: ctx.results,
       }

       {
         ...ctx,
         checkpoints: Belt.Array.concat(ctx.checkpoints, [checkpoint]),
         metrics: {...ctx.metrics, checkpoints: ctx.metrics.checkpoints + 1},
       }
     }

     let restoreFromCheckpoint = (ctx: t, checkpoint: Event.checkpointData): t => {
       let restoredSteps = Belt.Array.map(ctx.steps, step => {
         if Belt.Array.some(checkpoint.completedSteps, id => id == step.id) {
           let result = Js.Dict.get(checkpoint.stepResults, step.id)
           {...step, status: "completed", result: result}
         } else {
           {...step, status: "pending"}
         }
       })

       {
         ...ctx,
         steps: restoredSteps,
         results: checkpoint.stepResults,
         metrics: {
           ...ctx.metrics,
           completedSteps: Belt.Array.length(checkpoint.completedSteps),
         },
       }
     }

     let setError = (ctx: t, error: string, code: option<string>): t => {
       {...ctx, error: Some(error), errorCode: code}
     }

     let setResults = (ctx: t, results: Js.Dict.t<Js.Json.t>): t => {
       {
         ...ctx,
         results: results,
         metrics: {
           ...ctx.metrics,
           endTime: Some(Js.Date.now()),
           duration: Some(Belt.Int.fromFloat(Js.Date.now() -. ctx.metrics.startTime)),
         },
       }
     }

     let nextBatch = (ctx: t): t => {
       {
         ...ctx,
         currentBatchIndex: ctx.currentBatchIndex + 1,
         metrics: {...ctx.metrics, currentBatch: ctx.currentBatchIndex + 1},
       }
     }
   }
   ```

   **Lines:** ~220

2. **Implement Guards Module** (~1 hour)

   ```rescript
   module Guards = {
     let hasWorkflow = (ctx: Context.t): bool => {
       switch ctx.workflow {
       | Some(_) => true
       | None => false
       }
     }

     let hasSteps = (ctx: Context.t): bool => {
       Belt.Array.length(ctx.steps) > 0
     }

     let hasGraph = (ctx: Context.t): bool => {
       switch ctx.graph {
       | Some(_) => true
       | None => false
       }
     }

     let allStepsCompleted = (ctx: Context.t): bool => {
       Belt.Array.every(ctx.steps, step => step.status == "completed")
     }

     let hasMoreBatches = (ctx: Context.t): bool => {
       switch ctx.graph {
       | Some(graph) => ctx.currentBatchIndex < Belt.Array.length(graph.executionOrder)
       | None => false
       }
     }

     let hasFailedSteps = (ctx: Context.t): bool => {
       ctx.metrics.failedSteps > 0
     }
   }
   ```

   **Lines:** ~40

3. **Write Context Tests** (~2 hours)

   ```rescript
   describe("Context Module", () => {
     test("create initializes context correctly", () => {
       let ctx = Context.create()
       expect(ctx.workflow)->toEqual(None)
       expect(Belt.Array.length(ctx.steps))->toBe(0)
       expect(ctx.currentBatchIndex)->toBe(0)
       expect(ctx.metrics.totalSteps)->toBe(0)
     })

     test("setWorkflow updates workflow info", () => {
       let ctx = Context.create()
       let workflow: Context.workflowInfo = {
         workflowId: "wf-123",
         definition: "...",
         format: "yaml",
         context: Js.Dict.empty(),
       }
       let updated = Context.setWorkflow(ctx, workflow)
       expect(updated.workflow)->toEqual(Some(workflow))
     })

     test("setSteps converts stepDefs to stepInfo", () => {
       let ctx = Context.create()
       let stepDefs = [
         {
           Event.id: "step1",
           name: "First step",
           agentId: "backend",
           task: "Do something",
           dependencies: [],
           parallel: false,
           timeout: None,
           retries: 0,
         },
       ]
       let updated = Context.setSteps(ctx, stepDefs)
       expect(Belt.Array.length(updated.steps))->toBe(1)
       expect(updated.metrics.totalSteps)->toBe(1)
     })

     test("completeStep updates status and results", () => {
       let ctx = Context.create()
       let stepDefs = [{Event.id: "step1", ...}]
       let ctx = Context.setSteps(ctx, stepDefs)

       let result = Js.Json.string("Success")
       let updated = Context.completeStep(ctx, "step1", result)

       let step = Belt.Array.get(updated.steps, 0)
       switch step {
       | Some(s) => {
           expect(s.status)->toBe("completed")
           expect(s.result)->toEqual(Some(result))
         }
       | None => expect(false)->toBe(true)
       }
       expect(updated.metrics.completedSteps)->toBe(1)
     })

     test("addCheckpoint creates checkpoint info", () => {
       let ctx = Context.create()
       let updated = Context.addCheckpoint(ctx, "ckpt-123")

       expect(Belt.Array.length(updated.checkpoints))->toBe(1)
       expect(updated.metrics.checkpoints)->toBe(1)
     })
   })

   describe("Guards Module", () => {
     test("hasWorkflow checks workflow presence", () => {
       let ctx = Context.create()
       expect(Guards.hasWorkflow(ctx))->toBe(false)

       let workflow: Context.workflowInfo = {...}
       let withWorkflow = Context.setWorkflow(ctx, workflow)
       expect(Guards.hasWorkflow(withWorkflow))->toBe(true)
     })

     test("hasSteps checks steps array", () => {
       let ctx = Context.create()
       expect(Guards.hasSteps(ctx))->toBe(false)

       let withSteps = Context.setSteps(ctx, [stepDef])
       expect(Guards.hasSteps(withSteps))->toBe(true)
     })
   })
   ```

   **Tests Written:** 8 tests

**End of Day Status:**
- ✅ Context module complete (~220 lines)
- ✅ Guards module complete (~40 lines)
- ✅ 17 tests passing (9 + 8)

---

### Days 3-5: State Machine Transitions + Zod + Migration

**Day 3:** Complete Machine transitions (~240 lines), 10 tests
**Day 4:** JavaScript interop (~80 lines), Zod schemas (~150 lines), 8 tests
**Day 5:** Database migration 011 (~200 lines), WorkflowDAO (~150 lines), 5 tests

**Week 1 End Status:**
- ✅ WorkflowStateMachine.res complete (~700 lines)
- ✅ workflow.schema.ts complete (~150 lines)
- ✅ Migration 011 complete (~200 lines)
- ✅ WorkflowDAO complete (~150 lines)
- ✅ 40 tests passing

---

## Week 2: Workflow Parser + Dependency Graph

**Goals:**
- Implement workflow parser (YAML/JSON)
- Build dependency graph with cycle detection
- Topological sort with parallel batching
- Integration with state machine

**Deliverables:**
- WorkflowParser.ts (~140 lines)
- Dependency graph algorithm (~80 lines)
- Parser tests (15 tests, cumulative 55)

---

### Days 6-10: Parser Implementation

**Day 6:** YAML parser (~70 lines), validation, 5 tests
**Day 7:** JSON parser integration, schema validation, 5 tests
**Day 8:** Dependency graph builder (~80 lines), 5 tests
**Day 9:** Topological sort with parallel batching, 5 tests
**Day 10:** Cycle detection, error handling, integration tests, 5 tests

**Week 2 End Status:**
- ✅ WorkflowParser complete (~140 lines)
- ✅ Dependency graph with parallelism
- ✅ 65 tests passing

---

## Week 3: Workflow Engine + Checkpoint System

**Goals:**
- Implement workflow engine
- Multi-agent orchestration
- Checkpoint creation and restoration
- Parallel execution

**Deliverables:**
- WorkflowEngine.ts (~150 lines)
- CheckpointManager.ts (~120 lines)
- Orchestration tests (15 tests, cumulative 80)

---

### Days 11-15: Engine & Checkpoints

**Day 11:** WorkflowEngine core (~100 lines), basic execution, 3 tests
**Day 12:** Multi-agent orchestration (~50 lines), parallel execution, 4 tests
**Day 13:** CheckpointManager (~120 lines), checkpoint creation, 4 tests
**Day 14:** Checkpoint restoration, resume functionality, 4 tests
**Day 15:** Integration testing, error handling, performance testing

**Week 3 End Status:**
- ✅ WorkflowEngine complete
- ✅ CheckpointManager complete
- ✅ 80 tests passing
- ✅ Parallel execution working

---

## Week 4: Integration, Testing & Phase Gate

**Goals:**
- End-to-end workflow testing
- Performance optimization
- Documentation
- Phase gate review

**Deliverables:**
- Integration test suite (10 tests)
- Performance benchmarks
- API documentation
- User guides
- Phase 4 completion report

---

### Days 16-20: Final Testing & Documentation

**Day 16:** E2E workflow tests (complex workflows with checkpoints), 5 tests
**Day 17:** Performance testing (parallel execution benchmarks), 5 tests
**Day 18:** API documentation and workflow examples
**Day 19:** User guide (YAML workflow syntax, best practices)
**Day 20:** Phase gate review and approval

**Week 4 End Status:**
- ✅ 90 tests passing (exceeds 75+ target)
- ✅ Performance benchmarks met
- ✅ Complete documentation
- ✅ Phase 4 complete

---

## Summary

**Total Deliverables:**
- **ReScript Code:** ~700 lines (workflow state machine)
- **TypeScript Code:** ~560 lines (parser + engine + checkpoint + DAO)
- **Zod Schemas:** ~150 lines
- **SQL:** ~200 lines (migration)
- **Tests:** 75+ tests (90 final count)
- **Documentation:** Architecture PRD, API reference, user guide

**Performance Targets:**
- ✅ Workflow initiation: <500ms
- ✅ Step execution overhead: <100ms
- ✅ Checkpoint creation: <200ms
- ✅ Parallel execution: N steps in ~1x time (not Nx)
- ✅ Database writes: <10ms

**Quality Metrics:**
- ✅ Test coverage: >85%
- ✅ All tests passing: 100%
- ✅ Zero P0/P1 bugs
- ✅ Complete documentation

**Workflow Example (YAML):**
```yaml
id: user-auth-workflow
name: User Authentication System
version: 1.0.0
steps:
  - id: design
    name: Design API
    agentId: architecture
    task: Design user authentication API with JWT
    dependencies: []

  - id: backend
    name: Implement Backend
    agentId: backend
    task: Implement authentication endpoints
    dependencies: [design]

  - id: frontend
    name: Implement Frontend
    agentId: frontend
    task: Create login UI
    dependencies: [design]
    parallel: true

  - id: tests
    name: Write Tests
    agentId: quality
    task: Write integration tests
    dependencies: [backend, frontend]

  - id: security
    name: Security Audit
    agentId: security
    task: Audit authentication system
    dependencies: [tests]
```

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR EXECUTION
**Phase Gate:** 2026-02-28
