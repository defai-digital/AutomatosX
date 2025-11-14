# revamp_v1 Phase 4: Workflow Engine - Architecture PRD

**Project:** AutomatosX Revamp v1
**Phase:** Phase 4 - Workflow Engine
**Duration:** 4 weeks (20 working days)
**Dates:** February 2-28, 2026
**Status:** Ready for Implementation

---

## Executive Summary

Phase 4 implements a comprehensive workflow orchestration engine that enables complex multi-agent collaboration through declarative workflow definitions. Following the proven ReScript + TypeScript + Zod architecture, this phase creates a robust workflow system with parallel execution, checkpointing, and resume capabilities.

**Key Deliverables:**
- ReScript state machine for workflow execution lifecycle
- Workflow parser (YAML/JSON to workflow AST)
- Multi-agent orchestration with parallel execution
- Checkpoint/resume system for long-running workflows
- Database migration for workflow storage and state management
- 75+ comprehensive tests
- Performance benchmarks (<500ms workflow initiation)

---

## Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  ReScript Core Layer                                │
│  WorkflowStateMachine.res + WorkflowPlanner.res     │
│  • Workflow execution lifecycle                     │
│  • Task dependency resolution                       │
│  • Parallel execution coordination                  │
│  • Checkpoint state management                      │
└──────────────┬──────────────────────────────────────┘
               │ Compiled to .bs.js
┌──────────────▼──────────────────────────────────────┐
│  TypeScript Service Layer                           │
│  WorkflowEngine.ts → WorkflowParser.ts              │
│  • Workflow definition parsing (YAML/JSON)          │
│  • Dependency graph construction                    │
│  • Multi-agent orchestration                        │
│  • Checkpoint creation and restoration              │
│  • Result aggregation                               │
└──────────────┬──────────────────────────────────────┘
               │ Zod validation
┌──────────────▼──────────────────────────────────────┐
│  Database Layer                                      │
│  Migration 011: workflows, workflow_steps,          │
│                 checkpoints, step_results           │
│  • Workflow definitions and state                   │
│  • Step execution tracking                          │
│  • Checkpoint snapshots                             │
│  • Result storage and retrieval                     │
└─────────────────────────────────────────────────────┘
```

---

## Component 1: ReScript Workflow State Machine

### File: `packages/rescript-core/src/workflows/WorkflowStateMachine.res`

**Purpose:** Manage workflow execution lifecycle with deterministic state transitions and parallel execution support.

#### State Definitions

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

#### Event Definitions

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
        definition: string, // YAML or JSON
        format: string, // "yaml" | "json"
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
        executionOrder: array<array<string>>, // Topological sort with parallelism
      })
    | GraphInvalid({reason: string}) // Circular dependencies
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
    switch event {
    | InitiateWorkflow(_) => "initiate_workflow"
    | ParseWorkflow => "parse_workflow"
    | WorkflowParsed(_) => "workflow_parsed"
    | ParseFailed(_) => "parse_failed"
    | ValidateWorkflow => "validate_workflow"
    | WorkflowValid => "workflow_valid"
    | WorkflowInvalid(_) => "workflow_invalid"
    | BuildGraph => "build_graph"
    | GraphBuilt(_) => "graph_built"
    | GraphInvalid(_) => "graph_invalid"
    | ScheduleSteps(_) => "schedule_steps"
    | StepsScheduled => "steps_scheduled"
    | ExecuteStepBatch(_) => "execute_step_batch"
    | StepCompleted(_) => "step_completed"
    | StepFailed(_) => "step_failed"
    | BatchCompleted => "batch_completed"
    | AllStepsCompleted => "all_steps_completed"
    | CreateCheckpoint => "create_checkpoint"
    | CheckpointCreated(_) => "checkpoint_created"
    | RestoreCheckpoint(_) => "restore_checkpoint"
    | CheckpointRestored => "checkpoint_restored"
    | AggregateResults => "aggregate_results"
    | ResultsAggregated(_) => "results_aggregated"
    | CompleteWorkflow(_) => "complete_workflow"
    | WorkflowFailed(_) => "workflow_failed"
    | PauseWorkflow => "pause_workflow"
    | ResumeWorkflow => "resume_workflow"
    | CancelWorkflow => "cancel_workflow"
    | Reset => "reset"
    }
  }
}
```

#### Context Management

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
    status: string, // "pending" | "running" | "completed" | "failed"
    result: option<Js.Json.t>,
    error: option<string>,
  }

  type graphInfo = {
    nodes: array<string>,
    edges: array<(string, string)>,
    executionOrder: array<array<string>>, // Batches for parallel execution
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

  let setGraph = (ctx: t, nodes: array<string>, edges: array<(string, string)>, executionOrder: array<array<string>>): t => {
    {
      ...ctx,
      graph: Some({
        nodes: nodes,
        edges: edges,
        executionOrder: executionOrder,
      }),
    }
  }

  let updateStepStatus = (ctx: t, stepId: string, status: string): t => {
    let updatedSteps = Belt.Array.map(ctx.steps, step => {
      if step.id == stepId {
        {...step, status: status}
      } else {
        step
      }
    })
    {...ctx, steps: updatedSteps}
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
    let completedSteps = Belt.Array.keep(ctx.steps, step => step.status == "completed")
      ->Belt.Array.map(step => step.id)

    let pendingSteps = Belt.Array.keep(ctx.steps, step => step.status == "pending" || step.status == "running")
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
    // Restore step statuses
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

#### State Machine Implementation

```rescript
module Machine = {
  type t = {
    currentState: State.t,
    context: Context.t,
    history: array<State.t>,
  }

  let create = (): t => {
    {
      currentState: State.Idle,
      context: Context.create(),
      history: [],
    }
  }

  // Transition guards
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

    let batchCompleted = (ctx: Context.t, batchStepIds: array<string>): bool => {
      Belt.Array.every(batchStepIds, stepId => {
        Belt.Array.some(ctx.steps, step =>
          step.id == stepId && (step.status == "completed" || step.status == "failed")
        )
      })
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

  // State transition logic
  let transition = (machine: t, event: Event.t): result<t, string> => {
    let {currentState, context, history} = machine

    let result = switch (currentState, event) {
    // Idle → Parsing
    | (State.Idle, Event.InitiateWorkflow(workflowData)) => {
        let workflowInfo: Context.workflowInfo = {
          workflowId: workflowData.workflowId,
          definition: workflowData.definition,
          format: workflowData.format,
          context: workflowData.context,
        }
        let newContext = Context.setWorkflow(context, workflowInfo)
        Ok((State.Parsing, newContext))
      }

    // Parsing → ValidatingWorkflow (success)
    | (State.Parsing, Event.WorkflowParsed({steps})) => {
        let newContext = Context.setSteps(context, steps)
        Ok((State.ValidatingWorkflow, newContext))
      }

    // Parsing → Failed (parse error)
    | (State.Parsing, Event.ParseFailed({error})) => {
        let newContext = Context.setError(context, error, Some("PARSE_ERROR"))
        Ok((State.Failed, newContext))
      }

    // ValidatingWorkflow → BuildingDependencyGraph (valid)
    | (State.ValidatingWorkflow, Event.WorkflowValid) =>
        if Guards.hasSteps(context) {
          Ok((State.BuildingDependencyGraph, context))
        } else {
          Error("No steps to validate")
        }

    // ValidatingWorkflow → Failed (invalid)
    | (State.ValidatingWorkflow, Event.WorkflowInvalid({reason})) => {
        let newContext = Context.setError(context, reason, Some("VALIDATION_ERROR"))
        Ok((State.Failed, newContext))
      }

    // BuildingDependencyGraph → SchedulingSteps (success)
    | (State.BuildingDependencyGraph, Event.GraphBuilt({nodes, edges, executionOrder})) => {
        let newContext = Context.setGraph(context, nodes, edges, executionOrder)
        Ok((State.SchedulingSteps, newContext))
      }

    // BuildingDependencyGraph → Failed (circular dependencies)
    | (State.BuildingDependencyGraph, Event.GraphInvalid({reason})) => {
        let newContext = Context.setError(context, reason, Some("GRAPH_ERROR"))
        Ok((State.Failed, newContext))
      }

    // SchedulingSteps → ExecutingSteps
    | (State.SchedulingSteps, Event.StepsScheduled) =>
        if Guards.hasGraph(context) {
          Ok((State.ExecutingSteps, context))
        } else {
          Error("No execution graph")
        }

    // ExecutingSteps → AwaitingCompletion (batch started)
    | (State.ExecutingSteps, Event.ExecuteStepBatch({stepIds})) => {
        let newContext = Belt.Array.reduce(stepIds, context, (ctx, stepId) =>
          Context.updateStepStatus(ctx, stepId, "running")
        )
        Ok((State.AwaitingCompletion, newContext))
      }

    // AwaitingCompletion → AwaitingCompletion (step completed)
    | (State.AwaitingCompletion, Event.StepCompleted({stepId, result})) => {
        let newContext = Context.completeStep(context, stepId, result)
        Ok((State.AwaitingCompletion, newContext))
      }

    // AwaitingCompletion → AwaitingCompletion (step failed)
    | (State.AwaitingCompletion, Event.StepFailed({stepId, error})) => {
        let newContext = Context.failStep(context, stepId, error)
        Ok((State.AwaitingCompletion, newContext))
      }

    // AwaitingCompletion → ExecutingSteps (batch done, more batches)
    | (State.AwaitingCompletion, Event.BatchCompleted) =>
        if Guards.hasMoreBatches(context) {
          let newContext = Context.nextBatch(context)
          Ok((State.ExecutingSteps, newContext))
        } else {
          Ok((State.AggregatingResults, context))
        }

    // AwaitingCompletion → AggregatingResults (all done)
    | (State.AwaitingCompletion, Event.AllStepsCompleted) =>
        if Guards.allStepsCompleted(context) {
          Ok((State.AggregatingResults, context))
        } else if Guards.hasFailedSteps(context) {
          let newContext = Context.setError(context, "Some steps failed", Some("STEP_FAILURE"))
          Ok((State.Failed, newContext))
        } else {
          Error("Not all steps completed")
        }

    // Any checkpointable state → CreatingCheckpoint
    | (state, Event.CreateCheckpoint) =>
        if State.canCheckpoint(state) {
          Ok((State.CreatingCheckpoint, context))
        } else {
          Error("Cannot checkpoint in current state")
        }

    // CreatingCheckpoint → previous state
    | (State.CreatingCheckpoint, Event.CheckpointCreated({checkpointId})) => {
        let newContext = Context.addCheckpoint(context, checkpointId)
        let previousState = Belt.Array.get(history, Belt.Array.length(history) - 1)
        switch previousState {
        | Some(prevState) => Ok((prevState, newContext))
        | None => Error("No previous state")
        }
      }

    // Idle → RestoringFromCheckpoint
    | (State.Idle, Event.RestoreCheckpoint({checkpointData})) => {
        let newContext = Context.restoreFromCheckpoint(context, checkpointData)
        Ok((State.RestoringFromCheckpoint, newContext))
      }

    // RestoringFromCheckpoint → ExecutingSteps
    | (State.RestoringFromCheckpoint, Event.CheckpointRestored) =>
        Ok((State.ExecutingSteps, context))

    // AggregatingResults → Completed
    | (State.AggregatingResults, Event.ResultsAggregated({results})) => {
        let newContext = Context.setResults(context, results)
        Ok((State.Completed, newContext))
      }

    // Any → Failed
    | (_, Event.WorkflowFailed({error, code})) => {
        let newContext = Context.setError(context, error, code)
        Ok((State.Failed, newContext))
      }

    // Any pausable → Paused
    | (state, Event.PauseWorkflow) =>
        if State.canPause(state) {
          Ok((State.Paused, context))
        } else {
          Error("Cannot pause in current state")
        }

    // Paused → previous state
    | (State.Paused, Event.ResumeWorkflow) => {
        let previousState = Belt.Array.get(history, Belt.Array.length(history) - 1)
        switch previousState {
        | Some(prevState) => Ok((prevState, context))
        | None => Error("No previous state")
        }
      }

    // Any → Cancelled
    | (_, Event.CancelWorkflow) => Ok((State.Cancelled, context))

    // Completed → Idle (reset)
    | (State.Completed, Event.Reset) => Ok((State.Idle, Context.create()))

    // Invalid transitions
    | (state, event) =>
        Error(
          "Invalid transition: " ++
          State.toString(state) ++
          " -> " ++
          Event.toString(event)
        )
    }

    switch result {
    | Ok((newState, newContext)) =>
        Ok({
          currentState: newState,
          context: newContext,
          history: Belt.Array.concat(history, [currentState]),
        })
    | Error(msg) => Error(msg)
    }
  }

  let getState = (machine: t): State.t => machine.currentState
  let getContext = (machine: t): Context.t => machine.context
  let isTerminal = (machine: t): bool => State.isTerminal(machine.currentState)
  let getHistory = (machine: t): array<State.t> => machine.history
}

// JavaScript interop
@genType
let createMachine = (): Machine.t => Machine.create()

@genType
let transitionMachine = (machine: Machine.t, event: Event.t): result<Machine.t, string> => {
  Machine.transition(machine, event)
}

@genType
let getMachineState = (machine: Machine.t): string => {
  State.toString(Machine.getState(machine))
}

@genType
let getMachineContext = (machine: Machine.t): Context.t => {
  Machine.getContext(machine)
}

@genType
let isMachineTerminal = (machine: Machine.t): bool => {
  Machine.isTerminal(machine)
}

// Event constructors
@genType
let makeInitiateWorkflowEvent = (
  workflowId: string,
  definition: string,
  format: string,
  context: Js.Dict.t<Js.Json.t>,
): Event.t => {
  Event.InitiateWorkflow({
    workflowId: workflowId,
    definition: definition,
    format: format,
    context: context,
  })
}

@genType
let makeStepCompletedEvent = (stepId: string, result: Js.Json.t): Event.t => {
  Event.StepCompleted({stepId: stepId, result: result})
}

@genType
let makeCheckpointCreatedEvent = (checkpointId: string): Event.t => {
  Event.CheckpointCreated({checkpointId: checkpointId})
}
```

**Estimated Lines:** ~700 lines

---

## Component 2: Zod Validation Schemas

### File: `src/types/schemas/workflow.schema.ts`

```typescript
import { z } from 'zod';

// Workflow step definition schema
export const WorkflowStepSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  agentId: z.string().min(1).max(50),
  task: z.string().min(1).max(10000),
  dependencies: z.array(z.string()).default([]),
  parallel: z.boolean().default(false),
  timeout: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().default(0),
  continueOnError: z.boolean().default(false),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// Workflow definition schema
export const WorkflowDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  version: z.string().default('1.0.0'),
  steps: z.array(WorkflowStepSchema).min(1),
  context: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// Workflow execution status schema
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  status: z.enum([
    'idle',
    'parsing',
    'validating_workflow',
    'building_dependency_graph',
    'scheduling_steps',
    'executing_steps',
    'awaiting_completion',
    'creating_checkpoint',
    'restoring_from_checkpoint',
    'aggregating_results',
    'completed',
    'failed',
    'paused',
    'cancelled',
  ]),
  currentStep: z.string().optional(),
  completedSteps: z.number().int().nonnegative().default(0),
  totalSteps: z.number().int().positive(),
  results: z.record(z.string(), z.unknown()).default({}),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  startedAt: z.number().int().positive(),
  completedAt: z.number().int().positive().optional(),
  duration: z.number().int().nonnegative().optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

// Dependency graph schema
export const DependencyGraphSchema = z.object({
  nodes: z.array(z.string()).min(1),
  edges: z.array(z.tuple([z.string(), z.string()])),
  executionOrder: z.array(z.array(z.string())).min(1), // Batches for parallel execution
});

export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

// Step execution result schema
export const StepExecutionResultSchema = z.object({
  id: z.string().uuid(),
  workflowExecutionId: z.string().uuid(),
  stepId: z.string(),
  agentId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  result: z.unknown().optional(),
  error: z.string().optional(),
  duration: z.number().int().nonnegative().optional(),
  startedAt: z.number().int().positive().optional(),
  completedAt: z.number().int().positive().optional(),
});

export type StepExecutionResult = z.infer<typeof StepExecutionResultSchema>;

// Checkpoint schema
export const CheckpointSchema = z.object({
  id: z.string().uuid(),
  workflowExecutionId: z.string().uuid(),
  completedSteps: z.array(z.string()),
  pendingSteps: z.array(z.string()),
  stepResults: z.record(z.string(), z.unknown()),
  state: z.record(z.string(), z.unknown()),
  createdAt: z.number().int().positive(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

// Workflow metrics schema
export const WorkflowMetricsSchema = z.object({
  workflowId: z.string().uuid(),
  totalExecutions: z.number().int().nonnegative().default(0),
  successfulExecutions: z.number().int().nonnegative().default(0),
  failedExecutions: z.number().int().nonnegative().default(0),
  avgDuration: z.number().nonnegative().optional(),
  avgStepsCompleted: z.number().nonnegative().optional(),
  checkpointsCreated: z.number().int().nonnegative().default(0),
  lastExecutedAt: z.number().int().positive().optional(),
});

export type WorkflowMetrics = z.infer<typeof WorkflowMetricsSchema>;
```

**Estimated Lines:** ~150 lines

---

## Component 3: Database Migration

### File: `src/migrations/011_create_workflow_tables.sql`

```sql
-- Migration 011: Workflow orchestration tables
-- Created: 2026-02-02
-- Purpose: Store workflow definitions, executions, checkpoints, and step results

-- Workflows table (definitions)
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  definition TEXT NOT NULL, -- JSON workflow definition
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT -- JSON
);

CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  current_step TEXT,
  completed_steps INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  results TEXT, -- JSON
  error TEXT,
  error_code TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration INTEGER,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  CHECK (status IN (
    'idle', 'parsing', 'validating_workflow', 'building_dependency_graph',
    'scheduling_steps', 'executing_steps', 'awaiting_completion',
    'creating_checkpoint', 'restoring_from_checkpoint', 'aggregating_results',
    'completed', 'failed', 'paused', 'cancelled'
  ))
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- Workflow steps (from execution)
CREATE TABLE IF NOT EXISTS workflow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  task TEXT NOT NULL,
  dependencies TEXT, -- JSON array
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT, -- JSON
  error TEXT,
  duration INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  UNIQUE(execution_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_execution_id ON workflow_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_agent_id ON workflow_steps(agent_id);

-- Checkpoints table
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  completed_steps TEXT NOT NULL, -- JSON array
  pending_steps TEXT NOT NULL, -- JSON array
  step_results TEXT NOT NULL, -- JSON
  state TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_execution_id ON workflow_checkpoints(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_created_at ON workflow_checkpoints(created_at DESC);

-- Dependency graph cache
CREATE TABLE IF NOT EXISTS workflow_graphs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  nodes TEXT NOT NULL, -- JSON array
  edges TEXT NOT NULL, -- JSON array of tuples
  execution_order TEXT NOT NULL, -- JSON array of arrays
  created_at INTEGER NOT NULL,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
  UNIQUE(execution_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_graphs_execution_id ON workflow_graphs(execution_id);

-- Workflow metrics (aggregated)
CREATE TABLE IF NOT EXISTS workflow_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_duration INTEGER,
  avg_steps_completed REAL,
  checkpoints_created INTEGER DEFAULT 0,
  last_executed_at INTEGER,
  date TEXT NOT NULL, -- YYYY-MM-DD
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workflow_id, date)
);

CREATE INDEX IF NOT EXISTS idx_workflow_metrics_workflow_id ON workflow_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_metrics_date ON workflow_metrics(date);

-- Trigger to update metrics on execution completion
CREATE TRIGGER IF NOT EXISTS update_workflow_metrics_on_completion
AFTER UPDATE OF status ON workflow_executions
WHEN NEW.status IN ('completed', 'failed', 'cancelled')
BEGIN
  INSERT INTO workflow_metrics (
    workflow_id, total_executions, successful_executions, failed_executions,
    avg_duration, avg_steps_completed, last_executed_at, date, created_at, updated_at
  )
  VALUES (
    NEW.workflow_id,
    1,
    CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    NEW.duration,
    CAST(NEW.completed_steps AS REAL),
    NEW.completed_at,
    DATE(NEW.started_at / 1000, 'unixepoch'),
    NEW.completed_at,
    NEW.completed_at
  )
  ON CONFLICT(workflow_id, date) DO UPDATE SET
    total_executions = total_executions + 1,
    successful_executions = successful_executions + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    failed_executions = failed_executions + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    avg_duration = (avg_duration * (total_executions - 1) + COALESCE(NEW.duration, 0)) / total_executions,
    avg_steps_completed = (avg_steps_completed * (total_executions - 1) + CAST(NEW.completed_steps AS REAL)) / total_executions,
    last_executed_at = NEW.completed_at,
    updated_at = NEW.completed_at;
END;

-- Trigger to update metrics on checkpoint creation
CREATE TRIGGER IF NOT EXISTS update_metrics_on_checkpoint
AFTER INSERT ON workflow_checkpoints
BEGIN
  UPDATE workflow_metrics
  SET checkpoints_created = checkpoints_created + 1,
      updated_at = NEW.created_at
  WHERE workflow_id = (SELECT workflow_id FROM workflow_executions WHERE id = NEW.execution_id)
    AND date = DATE(NEW.created_at / 1000, 'unixepoch');
END;
```

**Estimated Lines:** ~200 lines

---

## Component 4: TypeScript Service Layer

### 4.1 Workflow Parser

**File:** `src/workflows/WorkflowParser.ts`

```typescript
import yaml from 'js-yaml';
import type { WorkflowDefinition, WorkflowStep } from '../types/schemas/workflow.schema.js';
import { WorkflowDefinitionSchema } from '../types/schemas/workflow.schema.js';

export class WorkflowParser {
  parse(definition: string, format: 'yaml' | 'json'): WorkflowDefinition {
    let parsed: any;

    try {
      if (format === 'yaml') {
        parsed = yaml.load(definition);
      } else {
        parsed = JSON.parse(definition);
      }
    } catch (error) {
      throw new Error(`Failed to parse ${format}: ${error.message}`);
    }

    // Validate with Zod
    const validated = WorkflowDefinitionSchema.parse(parsed);

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    for (const step of validated.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Validate dependencies exist
    for (const step of validated.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          throw new Error(`Step ${step.id} has unknown dependency: ${depId}`);
        }
      }
    }

    return validated;
  }

  buildDependencyGraph(steps: WorkflowStep[]): {
    nodes: string[];
    edges: [string, string][];
    executionOrder: string[][];
  } {
    const nodes = steps.map(s => s.id);
    const edges: [string, string][] = [];

    // Build edges from dependencies
    for (const step of steps) {
      for (const depId of step.dependencies) {
        edges.push([depId, step.id]);
      }
    }

    // Topological sort with parallel batching
    const executionOrder = this.topologicalSort(nodes, edges, steps);

    // Detect cycles
    if (executionOrder.length === 0) {
      throw new Error('Circular dependencies detected in workflow');
    }

    return { nodes, edges, executionOrder };
  }

  private topologicalSort(
    nodes: string[],
    edges: [string, string][],
    steps: WorkflowStep[]
  ): string[][] {
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node, 0);
      adjacencyList.set(node, []);
    }

    // Build graph
    for (const [from, to] of edges) {
      adjacencyList.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }

    const batches: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < nodes.length) {
      // Find all nodes with no dependencies
      const batch: string[] = [];
      for (const node of nodes) {
        if (!processed.has(node) && inDegree.get(node) === 0) {
          batch.push(node);
        }
      }

      if (batch.length === 0) {
        // Cycle detected
        return [];
      }

      batches.push(batch);

      // Mark as processed and update in-degrees
      for (const node of batch) {
        processed.add(node);
        for (const neighbor of adjacencyList.get(node) || []) {
          inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        }
      }
    }

    return batches;
  }
}
```

**Estimated Lines:** ~140 lines

### 4.2 Workflow Engine

**File:** `src/workflows/WorkflowEngine.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { WorkflowStateMachine } from '../../packages/rescript-core/lib/js/src/workflows/WorkflowStateMachine.bs.js';
import { WorkflowParser } from './WorkflowParser.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { CheckpointManager } from './CheckpointManager.js';
import { WorkflowDAO } from '../database/dao/WorkflowDAO.js';
import type { WorkflowDefinition, WorkflowExecution } from '../types/schemas/workflow.schema.js';
import { Logger } from '../utils/Logger.js';

export class WorkflowEngine {
  private parser: WorkflowParser;
  private agentRegistry: AgentRegistry;
  private checkpointManager: CheckpointManager;
  private dao: WorkflowDAO;

  constructor() {
    this.parser = new WorkflowParser();
    this.agentRegistry = new AgentRegistry();
    this.checkpointManager = new CheckpointManager();
    this.dao = new WorkflowDAO();
  }

  async execute(
    definition: string,
    format: 'yaml' | 'json',
    context: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const executionId = uuidv4();
    const machine = WorkflowStateMachine.createMachine();

    try {
      // Parse workflow
      const workflow = this.parser.parse(definition, format);
      await this.dao.saveWorkflow(workflow);

      // Build dependency graph
      const graph = this.parser.buildDependencyGraph(workflow.steps);

      // Execute in batches
      const results: Record<string, any> = {};

      for (const batch of graph.executionOrder) {
        Logger.info(`Executing batch: ${batch.join(', ')}`);

        // Execute steps in parallel within batch
        const batchResults = await Promise.all(
          batch.map(stepId => this.executeStep(workflow, stepId, results))
        );

        // Collect results
        for (let i = 0; i < batch.length; i++) {
          results[batch[i]] = batchResults[i];
        }

        // Create checkpoint after each batch
        await this.checkpointManager.createCheckpoint(executionId, {
          completedSteps: Object.keys(results),
          pendingSteps: workflow.steps
            .filter(s => !results[s.id])
            .map(s => s.id),
          stepResults: results,
        });
      }

      return results;
    } catch (error) {
      Logger.error('Workflow execution failed', error);
      throw error;
    }
  }

  async resume(checkpointId: string): Promise<Record<string, any>> {
    const checkpoint = await this.checkpointManager.loadCheckpoint(checkpointId);

    // Restore workflow state and continue execution
    // ... implementation
    return checkpoint.stepResults;
  }

  private async executeStep(
    workflow: WorkflowDefinition,
    stepId: string,
    previousResults: Record<string, any>
  ): Promise<any> {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const agent = this.agentRegistry.getAgent(step.agentId);

    // Build task context with previous results
    const taskContext = {
      ...workflow.context,
      previousResults,
    };

    const task = {
      taskId: uuidv4(),
      agentId: step.agentId,
      description: step.task,
      priority: 5,
      status: 'idle' as const,
      context: taskContext,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await agent.processTask(task);
    return result;
  }
}
```

**Estimated Lines:** ~150 lines

---

## Testing Strategy

### Unit Tests

**ReScript State Machine:**
- State transitions (25 tests)
- Guards (10 tests)
- Context management (15 tests)

**Workflow Parser:**
- YAML parsing (10 tests)
- JSON parsing (5 tests)
- Dependency graph (10 tests)
- Cycle detection (5 tests)

**Workflow Engine:**
- Execution orchestration (10 tests)
- Checkpoint/resume (10 tests)
- Error handling (5 tests)

**Total Tests:** 75+ tests

---

## Success Criteria

### Functional Requirements

- ✅ YAML and JSON workflow parsing
- ✅ Dependency graph with cycle detection
- ✅ Parallel step execution
- ✅ Checkpoint creation and restoration
- ✅ Multi-agent orchestration

### Performance Requirements

- ✅ Workflow initiation: <500ms
- ✅ Step execution overhead: <100ms
- ✅ Checkpoint creation: <200ms
- ✅ Parallel execution: N steps in ~1x time (not N× time)

### Quality Requirements

- ✅ 75+ tests passing (100%)
- ✅ Test coverage >85%
- ✅ Zero P0/P1 bugs

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR IMPLEMENTATION
**Next Review:** 2026-02-28 (Phase 4 Gate Review)
