# revamp_v1 Phase 3: Agent System - Architecture PRD

**Project:** AutomatosX Revamp v1
**Phase:** Phase 3 - Agent System
**Duration:** 5 weeks (25 working days)
**Dates:** December 29, 2025 - February 1, 2026
**Status:** Ready for Implementation

---

## Executive Summary

Phase 3 implements the core agent system with 20 specialized AI agents, each with domain expertise and access to code intelligence tools. Following the proven ReScript + TypeScript + Zod architecture, this phase creates an autonomous agent ecosystem capable of complex software development tasks, research, and collaboration.

**Key Deliverables:**
- ReScript state machine for agent task execution lifecycle
- 20 specialized agent implementations with unique capabilities
- Tool system (bash, file, web, code intelligence)
- Agent-to-agent delegation and collaboration
- Database migration for task tracking and tool execution logs
- 95+ comprehensive tests
- Performance benchmarks (<2s task initiation latency)

---

## Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  ReScript Core Layer                                │
│  AgentStateMachine.res + TaskPlanner.res            │
│  • Agent task execution lifecycle                   │
│  • Task planning and decomposition                  │
│  • Tool selection and validation                    │
│  • Delegation logic                                 │
└──────────────┬──────────────────────────────────────┘
               │ Compiled to .bs.js
┌──────────────▼──────────────────────────────────────┐
│  TypeScript Service Layer                           │
│  AgentRegistry.ts → 20 Agent Implementations        │
│  • BackendAgent, FrontendAgent, ArchitectAgent      │
│  • ToolSystem (BashTool, FileTool, WebTool)         │
│  • Code Intelligence integration                    │
│  • Agent-to-agent communication                     │
└──────────────┬──────────────────────────────────────┘
               │ Zod validation
┌──────────────▼──────────────────────────────────────┐
│  Database Layer                                      │
│  Migration 010: agent_tasks, tool_executions,       │
│                 agent_delegations                    │
│  • Task tracking and history                        │
│  • Tool execution logs                              │
│  • Inter-agent delegation records                   │
└─────────────────────────────────────────────────────┘
```

---

## Component 1: ReScript Agent State Machine

### File: `packages/rescript-core/src/agents/AgentStateMachine.res`

**Purpose:** Manage agent task execution lifecycle with deterministic state transitions.

#### State Definitions

```rescript
module State = {
  type t =
    | Idle
    | Planning
    | ValidatingTask
    | SelectingTools
    | ExecutingTools
    | ProcessingResults
    | Delegating
    | AwaitingDelegation
    | Completing
    | Completed
    | Failed
    | Paused

  let toString = (state: t): string => {
    switch state {
    | Idle => "idle"
    | Planning => "planning"
    | ValidatingTask => "validating_task"
    | SelectingTools => "selecting_tools"
    | ExecutingTools => "executing_tools"
    | ProcessingResults => "processing_results"
    | Delegating => "delegating"
    | AwaitingDelegation => "awaiting_delegation"
    | Completing => "completing"
    | Completed => "completed"
    | Failed => "failed"
    | Paused => "paused"
    }
  }

  let fromString = (str: string): option<t> => {
    switch str {
    | "idle" => Some(Idle)
    | "planning" => Some(Planning)
    | "validating_task" => Some(ValidatingTask)
    | "selecting_tools" => Some(SelectingTools)
    | "executing_tools" => Some(ExecutingTools)
    | "processing_results" => Some(ProcessingResults)
    | "delegating" => Some(Delegating)
    | "awaiting_delegation" => Some(AwaitingDelegation)
    | "completing" => Some(Completing)
    | "completed" => Some(Completed)
    | "failed" => Some(Failed)
    | "paused" => Some(Paused)
    | _ => None
    }
  }

  let isTerminal = (state: t): bool => {
    switch state {
    | Completed | Failed => true
    | _ => false
    }
  }

  let canPause = (state: t): bool => {
    switch state {
    | ExecutingTools | AwaitingDelegation => true
    | _ => false
    }
  }
}
```

#### Event Definitions

```rescript
module Event = {
  type toolSpec = {
    name: string,
    args: Js.Dict.t<Js.Json.t>,
    timeout: option<int>,
  }

  type delegationSpec = {
    targetAgent: string,
    task: string,
    context: Js.Dict.t<Js.Json.t>,
    priority: int,
  }

  type t =
    | InitiateTask({
        taskId: string,
        agentId: string,
        description: string,
        priority: int,
        context: Js.Dict.t<Js.Json.t>,
      })
    | StartPlanning
    | PlanCreated({
        steps: array<string>,
        estimatedDuration: int,
        requiredTools: array<string>,
      })
    | ValidateTask
    | TaskValid
    | TaskInvalid({reason: string})
    | SelectTools({tools: array<toolSpec>})
    | ToolsSelected({tools: array<toolSpec>})
    | ExecuteTool({tool: toolSpec, index: int})
    | ToolExecuted({
        tool: string,
        result: Js.Json.t,
        duration: int,
        success: bool,
      })
    | ToolFailed({tool: string, error: string})
    | AllToolsExecuted
    | ProcessResults
    | ResultsProcessed({output: string})
    | DelegateTask({delegation: delegationSpec})
    | DelegationSent({delegationId: string})
    | DelegationCompleted({delegationId: string, result: Js.Json.t})
    | DelegationFailed({delegationId: string, error: string})
    | CompleteTask({result: string})
    | TaskFailed({error: string, code: option<string>})
    | PauseTask
    | ResumeTask
    | CancelTask
    | Reset

  let toString = (event: t): string => {
    switch event {
    | InitiateTask(_) => "initiate_task"
    | StartPlanning => "start_planning"
    | PlanCreated(_) => "plan_created"
    | ValidateTask => "validate_task"
    | TaskValid => "task_valid"
    | TaskInvalid(_) => "task_invalid"
    | SelectTools(_) => "select_tools"
    | ToolsSelected(_) => "tools_selected"
    | ExecuteTool(_) => "execute_tool"
    | ToolExecuted(_) => "tool_executed"
    | ToolFailed(_) => "tool_failed"
    | AllToolsExecuted => "all_tools_executed"
    | ProcessResults => "process_results"
    | ResultsProcessed(_) => "results_processed"
    | DelegateTask(_) => "delegate_task"
    | DelegationSent(_) => "delegation_sent"
    | DelegationCompleted(_) => "delegation_completed"
    | DelegationFailed(_) => "delegation_failed"
    | CompleteTask(_) => "complete_task"
    | TaskFailed(_) => "task_failed"
    | PauseTask => "pause_task"
    | ResumeTask => "resume_task"
    | CancelTask => "cancel_task"
    | Reset => "reset"
    }
  }
}
```

#### Context Management

```rescript
module Context = {
  type taskInfo = {
    taskId: string,
    agentId: string,
    description: string,
    priority: int,
    context: Js.Dict.t<Js.Json.t>,
  }

  type planInfo = {
    steps: array<string>,
    currentStep: int,
    estimatedDuration: int,
    requiredTools: array<string>,
  }

  type toolExecution = {
    tool: string,
    args: Js.Dict.t<Js.Json.t>,
    result: option<Js.Json.t>,
    duration: option<int>,
    success: bool,
    error: option<string>,
  }

  type delegationInfo = {
    delegationId: string,
    targetAgent: string,
    task: string,
    status: string,
    result: option<Js.Json.t>,
  }

  type metrics = {
    startTime: float,
    endTime: option<float>,
    duration: option<int>,
    toolExecutions: int,
    delegations: int,
    retries: int,
  }

  type t = {
    task: option<taskInfo>,
    plan: option<planInfo>,
    toolExecutions: array<toolExecution>,
    currentToolIndex: int,
    delegations: array<delegationInfo>,
    result: option<string>,
    error: option<string>,
    errorCode: option<string>,
    metrics: metrics,
    metadata: Js.Dict.t<Js.Json.t>,
  }

  let create = (): t => {
    {
      task: None,
      plan: None,
      toolExecutions: [],
      currentToolIndex: 0,
      delegations: [],
      result: None,
      error: None,
      errorCode: None,
      metrics: {
        startTime: Js.Date.now(),
        endTime: None,
        duration: None,
        toolExecutions: 0,
        delegations: 0,
        retries: 0,
      },
      metadata: Js.Dict.empty(),
    }
  }

  let setTask = (ctx: t, task: taskInfo): t => {
    {...ctx, task: Some(task)}
  }

  let setPlan = (ctx: t, steps: array<string>, estimatedDuration: int, tools: array<string>): t => {
    {
      ...ctx,
      plan: Some({
        steps: steps,
        currentStep: 0,
        estimatedDuration: estimatedDuration,
        requiredTools: tools,
      }),
    }
  }

  let addToolExecution = (ctx: t, execution: toolExecution): t => {
    {
      ...ctx,
      toolExecutions: Belt.Array.concat(ctx.toolExecutions, [execution]),
      metrics: {
        ...ctx.metrics,
        toolExecutions: ctx.metrics.toolExecutions + 1,
      },
    }
  }

  let updateToolExecution = (
    ctx: t,
    index: int,
    result: Js.Json.t,
    duration: int,
    success: bool,
  ): t => {
    let updated = Belt.Array.mapWithIndex(ctx.toolExecutions, (i, exec) => {
      if i == index {
        {...exec, result: Some(result), duration: Some(duration), success: success}
      } else {
        exec
      }
    })
    {...ctx, toolExecutions: updated}
  }

  let addDelegation = (ctx: t, delegation: delegationInfo): t => {
    {
      ...ctx,
      delegations: Belt.Array.concat(ctx.delegations, [delegation]),
      metrics: {
        ...ctx.metrics,
        delegations: ctx.metrics.delegations + 1,
      },
    }
  }

  let updateDelegation = (
    ctx: t,
    delegationId: string,
    status: string,
    result: option<Js.Json.t>,
  ): t => {
    let updated = Belt.Array.map(ctx.delegations, delegation => {
      if delegation.delegationId == delegationId {
        {...delegation, status: status, result: result}
      } else {
        delegation
      }
    })
    {...ctx, delegations: updated}
  }

  let setResult = (ctx: t, result: string): t => {
    {
      ...ctx,
      result: Some(result),
      metrics: {
        ...ctx.metrics,
        endTime: Some(Js.Date.now()),
        duration: Some(Belt.Int.fromFloat(Js.Date.now() -. ctx.metrics.startTime)),
      },
    }
  }

  let setError = (ctx: t, error: string, code: option<string>): t => {
    {...ctx, error: Some(error), errorCode: code}
  }

  let nextStep = (ctx: t): t => {
    switch ctx.plan {
    | Some(plan) => {
        ...ctx,
        plan: Some({...plan, currentStep: plan.currentStep + 1}),
      }
    | None => ctx
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
    let hasTask = (ctx: Context.t): bool => {
      switch ctx.task {
      | Some(_) => true
      | None => false
      }
    }

    let hasPlan = (ctx: Context.t): bool => {
      switch ctx.plan {
      | Some(_) => true
      | None => false
      }
    }

    let hasMoreTools = (ctx: Context.t): bool => {
      ctx.currentToolIndex < Belt.Array.length(ctx.toolExecutions)
    }

    let hasPendingDelegations = (ctx: Context.t): bool => {
      Belt.Array.some(ctx.delegations, d => d.status == "pending")
    }

    let allToolsSucceeded = (ctx: Context.t): bool => {
      Belt.Array.every(ctx.toolExecutions, exec => exec.success)
    }

    let canRetry = (ctx: Context.t): bool => {
      ctx.metrics.retries < 3
    }
  }

  // State transition logic
  let transition = (machine: t, event: Event.t): result<t, string> => {
    let {currentState, context, history} = machine

    let result = switch (currentState, event) {
    // Idle → Planning
    | (State.Idle, Event.InitiateTask(taskData)) => {
        let taskInfo: Context.taskInfo = {
          taskId: taskData.taskId,
          agentId: taskData.agentId,
          description: taskData.description,
          priority: taskData.priority,
          context: taskData.context,
        }
        let newContext = Context.setTask(context, taskInfo)
        Ok((State.Planning, newContext))
      }

    // Planning → ValidatingTask
    | (State.Planning, Event.PlanCreated(planData)) => {
        let newContext = Context.setPlan(
          context,
          planData.steps,
          planData.estimatedDuration,
          planData.requiredTools,
        )
        Ok((State.ValidatingTask, newContext))
      }

    // ValidatingTask → SelectingTools (valid)
    | (State.ValidatingTask, Event.TaskValid) =>
        if Guards.hasPlan(context) {
          Ok((State.SelectingTools, context))
        } else {
          Error("Cannot validate: no plan")
        }

    // ValidatingTask → Failed (invalid)
    | (State.ValidatingTask, Event.TaskInvalid({reason})) => {
        let newContext = Context.setError(context, reason, Some("INVALID_TASK"))
        Ok((State.Failed, newContext))
      }

    // SelectingTools → ExecutingTools
    | (State.SelectingTools, Event.ToolsSelected({tools})) => {
        let toolExecs = Belt.Array.map(tools, tool => {
          {
            Context.tool: tool.name,
            args: tool.args,
            result: None,
            duration: None,
            success: false,
            error: None,
          }: Context.toolExecution
        })
        let newContext = Belt.Array.reduce(toolExecs, context, (ctx, exec) =>
          Context.addToolExecution(ctx, exec)
        )
        Ok((State.ExecutingTools, newContext))
      }

    // ExecutingTools → ExecutingTools (next tool)
    | (State.ExecutingTools, Event.ToolExecuted(data)) => {
        let newContext = Context.updateToolExecution(
          context,
          data.tool == "bash" ? 0 : 1, // Simplified
          data.result,
          data.duration,
          data.success,
        )
        Ok((State.ExecutingTools, newContext))
      }

    // ExecutingTools → ProcessingResults (all done)
    | (State.ExecutingTools, Event.AllToolsExecuted) =>
        if Guards.allToolsSucceeded(context) {
          Ok((State.ProcessingResults, context))
        } else {
          Error("Some tools failed")
        }

    // ProcessingResults → Delegating
    | (State.ProcessingResults, Event.DelegateTask({delegation})) => {
        let delegationInfo: Context.delegationInfo = {
          delegationId: "del-" ++ Belt.Int.toString(Belt.Array.length(context.delegations) + 1),
          targetAgent: delegation.targetAgent,
          task: delegation.task,
          status: "pending",
          result: None,
        }
        let newContext = Context.addDelegation(context, delegationInfo)
        Ok((State.Delegating, newContext))
      }

    // Delegating → AwaitingDelegation
    | (State.Delegating, Event.DelegationSent({delegationId})) =>
        Ok((State.AwaitingDelegation, context))

    // AwaitingDelegation → ProcessingResults (delegation complete)
    | (State.AwaitingDelegation, Event.DelegationCompleted({delegationId, result})) => {
        let newContext = Context.updateDelegation(context, delegationId, "completed", Some(result))
        Ok((State.ProcessingResults, newContext))
      }

    // AwaitingDelegation → Failed (delegation failed)
    | (State.AwaitingDelegation, Event.DelegationFailed({delegationId, error})) => {
        let newContext = Context.updateDelegation(context, delegationId, "failed", None)
        let errorContext = Context.setError(newContext, error, Some("DELEGATION_FAILED"))
        Ok((State.Failed, errorContext))
      }

    // ProcessingResults → Completing
    | (State.ProcessingResults, Event.ResultsProcessed({output})) => {
        let newContext = Context.setResult(context, output)
        Ok((State.Completing, newContext))
      }

    // Completing → Completed
    | (State.Completing, Event.CompleteTask({result})) => {
        let newContext = Context.setResult(context, result)
        Ok((State.Completed, newContext))
      }

    // Any → Failed
    | (_, Event.TaskFailed({error, code})) => {
        let newContext = Context.setError(context, error, code)
        Ok((State.Failed, newContext))
      }

    // Any pausable → Paused
    | (state, Event.PauseTask) =>
        if State.canPause(state) {
          Ok((State.Paused, context))
        } else {
          Error("Cannot pause in current state")
        }

    // Paused → previous state
    | (State.Paused, Event.ResumeTask) => {
        let previousState = Belt.Array.get(history, Belt.Array.length(history) - 1)
        switch previousState {
        | Some(prevState) => Ok((prevState, context))
        | None => Error("No previous state to resume to")
        }
      }

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

// Event constructors for JavaScript
@genType
let makeInitiateTaskEvent = (
  taskId: string,
  agentId: string,
  description: string,
  priority: int,
  context: Js.Dict.t<Js.Json.t>,
): Event.t => {
  Event.InitiateTask({
    taskId: taskId,
    agentId: agentId,
    description: description,
    priority: priority,
    context: context,
  })
}

@genType
let makePlanCreatedEvent = (
  steps: array<string>,
  estimatedDuration: int,
  requiredTools: array<string>,
): Event.t => {
  Event.PlanCreated({
    steps: steps,
    estimatedDuration: estimatedDuration,
    requiredTools: requiredTools,
  })
}

@genType
let makeToolExecutedEvent = (
  tool: string,
  result: Js.Json.t,
  duration: int,
  success: bool,
): Event.t => {
  Event.ToolExecuted({
    tool: tool,
    result: result,
    duration: duration,
    success: success,
  })
}

@genType
let makeCompleteTaskEvent = (result: string): Event.t => {
  Event.CompleteTask({result: result})
}
```

**Estimated Lines:** ~600 lines

---

## Component 2: Zod Validation Schemas

### File: `src/types/schemas/agent.schema.ts`

```typescript
import { z } from 'zod';

// Agent configuration schema
export const AgentConfigSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  expertise: z.array(z.string()).min(1),
  description: z.string().max(500),
  capabilities: z.array(z.string()),
  maxConcurrentTasks: z.number().int().positive().default(3),
  priority: z.number().int().min(1).max(10).default(5),
  canDelegate: z.boolean().default(true),
  allowedTools: z.array(z.string()),
  systemPrompt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Task schema
export const TaskSchema = z.object({
  taskId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
  description: z.string().min(1).max(10000),
  priority: z.number().int().min(1).max(10).default(5),
  status: z.enum([
    'idle',
    'planning',
    'validating_task',
    'selecting_tools',
    'executing_tools',
    'processing_results',
    'delegating',
    'awaiting_delegation',
    'completing',
    'completed',
    'failed',
    'paused',
  ]).default('idle'),
  context: z.record(z.string(), z.unknown()).default({}),
  result: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  completedAt: z.number().int().positive().optional(),
  estimatedDuration: z.number().int().positive().optional(),
  actualDuration: z.number().int().positive().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// Tool specification schema
export const ToolSpecSchema = z.object({
  name: z.enum(['bash', 'file_read', 'file_write', 'web_fetch', 'code_search', 'code_def']),
  args: z.record(z.string(), z.unknown()),
  timeout: z.number().int().positive().default(30000), // 30 seconds
  retries: z.number().int().nonnegative().default(0),
});

export type ToolSpec = z.infer<typeof ToolSpecSchema>;

// Tool execution result schema
export const ToolExecutionSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  duration: z.number().int().nonnegative(),
  executedAt: z.number().int().positive(),
});

export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

// Agent delegation schema
export const AgentDelegationSchema = z.object({
  id: z.string().uuid(),
  sourceAgentId: z.string(),
  targetAgentId: z.string(),
  taskId: z.string().uuid(),
  taskDescription: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
  result: z.unknown().optional(),
  error: z.string().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  createdAt: z.number().int().positive(),
  completedAt: z.number().int().positive().optional(),
});

export type AgentDelegation = z.infer<typeof AgentDelegationSchema>;

// Task plan schema
export const TaskPlanSchema = z.object({
  taskId: z.string().uuid(),
  steps: z.array(z.string()).min(1),
  currentStep: z.number().int().nonnegative().default(0),
  estimatedDuration: z.number().int().positive(),
  requiredTools: z.array(z.string()),
  createdAt: z.number().int().positive(),
});

export type TaskPlan = z.infer<typeof TaskPlanSchema>;

// Agent metrics schema
export const AgentMetricsSchema = z.object({
  agentId: z.string(),
  totalTasks: z.number().int().nonnegative().default(0),
  completedTasks: z.number().int().nonnegative().default(0),
  failedTasks: z.number().int().nonnegative().default(0),
  avgTaskDuration: z.number().nonnegative().optional(),
  toolExecutions: z.number().int().nonnegative().default(0),
  delegationsSent: z.number().int().nonnegative().default(0),
  delegationsReceived: z.number().int().nonnegative().default(0),
  lastActiveAt: z.number().int().positive().optional(),
});

export type AgentMetrics = z.infer<typeof AgentMetricsSchema>;

// Tool system configuration
export const ToolConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().int().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
  allowedTools: z.array(z.string()),
  restrictions: z.record(z.string(), z.unknown()).optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;
```

**Estimated Lines:** ~180 lines

---

## Component 3: Database Migration

### File: `src/migrations/010_create_agent_tables.sql`

```sql
-- Migration 010: Agent system tables
-- Created: 2025-12-29
-- Purpose: Track agent tasks, tool executions, and delegations

-- Agent tasks table
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'idle',
  context TEXT, -- JSON
  result TEXT,
  error TEXT,
  error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  CHECK (priority BETWEEN 1 AND 10),
  CHECK (status IN (
    'idle', 'planning', 'validating_task', 'selecting_tools',
    'executing_tools', 'processing_results', 'delegating',
    'awaiting_delegation', 'completing', 'completed', 'failed', 'paused'
  ))
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at DESC);

-- Tool executions table
CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args TEXT NOT NULL, -- JSON
  result TEXT, -- JSON
  success INTEGER NOT NULL DEFAULT 0, -- boolean
  error TEXT,
  duration INTEGER NOT NULL, -- milliseconds
  executed_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_task_id ON tool_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool);
CREATE INDEX IF NOT EXISTS idx_tool_executions_executed_at ON tool_executions(executed_at DESC);

-- Agent delegations table
CREATE TABLE IF NOT EXISTS agent_delegations (
  id TEXT PRIMARY KEY,
  source_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT, -- JSON
  error TEXT,
  priority INTEGER DEFAULT 5,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,
  CHECK (priority BETWEEN 1 AND 10),
  CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_agent_delegations_source ON agent_delegations(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_delegations_target ON agent_delegations(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_delegations_status ON agent_delegations(status);
CREATE INDEX IF NOT EXISTS idx_agent_delegations_created_at ON agent_delegations(created_at DESC);

-- Task plans table
CREATE TABLE IF NOT EXISTS task_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  steps TEXT NOT NULL, -- JSON array
  current_step INTEGER DEFAULT 0,
  estimated_duration INTEGER NOT NULL,
  required_tools TEXT NOT NULL, -- JSON array
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_plans_task_id ON task_plans(task_id);

-- Agent metrics (aggregated)
CREATE TABLE IF NOT EXISTS agent_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  avg_task_duration INTEGER,
  tool_executions INTEGER DEFAULT 0,
  delegations_sent INTEGER DEFAULT 0,
  delegations_received INTEGER DEFAULT 0,
  last_active_at INTEGER,
  date TEXT NOT NULL, -- YYYY-MM-DD
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_date ON agent_metrics(date);

-- Trigger to update agent metrics on task completion
CREATE TRIGGER IF NOT EXISTS update_agent_metrics_on_task_complete
AFTER UPDATE OF status ON agent_tasks
WHEN NEW.status IN ('completed', 'failed')
BEGIN
  INSERT INTO agent_metrics (
    agent_id, total_tasks, completed_tasks, failed_tasks,
    avg_task_duration, last_active_at, date, created_at, updated_at
  )
  VALUES (
    NEW.agent_id,
    1,
    CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    NEW.actual_duration,
    NEW.updated_at,
    DATE(NEW.updated_at / 1000, 'unixepoch'),
    NEW.updated_at,
    NEW.updated_at
  )
  ON CONFLICT(agent_id, date) DO UPDATE SET
    total_tasks = total_tasks + 1,
    completed_tasks = completed_tasks + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    failed_tasks = failed_tasks + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    avg_task_duration = (avg_task_duration * (total_tasks - 1) + COALESCE(NEW.actual_duration, 0)) / total_tasks,
    last_active_at = NEW.updated_at,
    updated_at = NEW.updated_at;
END;

-- Trigger to update metrics on tool execution
CREATE TRIGGER IF NOT EXISTS update_metrics_on_tool_execution
AFTER INSERT ON tool_executions
BEGIN
  UPDATE agent_metrics
  SET tool_executions = tool_executions + 1,
      updated_at = NEW.executed_at
  WHERE agent_id = (SELECT agent_id FROM agent_tasks WHERE id = NEW.task_id)
    AND date = DATE(NEW.executed_at / 1000, 'unixepoch');
END;

-- Trigger to update metrics on delegation
CREATE TRIGGER IF NOT EXISTS update_metrics_on_delegation
AFTER INSERT ON agent_delegations
BEGIN
  -- Update source agent
  UPDATE agent_metrics
  SET delegations_sent = delegations_sent + 1,
      updated_at = NEW.created_at
  WHERE agent_id = NEW.source_agent_id
    AND date = DATE(NEW.created_at / 1000, 'unixepoch');

  -- Update target agent
  INSERT INTO agent_metrics (
    agent_id, delegations_received, date, created_at, updated_at
  )
  VALUES (
    NEW.target_agent_id,
    1,
    DATE(NEW.created_at / 1000, 'unixepoch'),
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT(agent_id, date) DO UPDATE SET
    delegations_received = delegations_received + 1,
    updated_at = NEW.created_at;
END;
```

**Estimated Lines:** ~180 lines

---

## Component 4: TypeScript Service Layer

### 4.1 Agent Registry & Base Class

**File:** `src/agents/Agent.ts`

```typescript
import type { Task, ToolSpec, AgentConfig } from '../types/schemas/agent.schema.js';
import { TaskSchema, AgentConfigSchema } from '../types/schemas/agent.schema.js';
import { ProviderRouter } from '../providers/ProviderRouter.js';
import { ToolSystem } from './tools/ToolSystem.js';
import { MemoryService } from '../memory/MemoryService.js';

export abstract class Agent {
  protected config: AgentConfig;
  protected providerRouter: ProviderRouter;
  protected toolSystem: ToolSystem;
  protected memoryService: MemoryService;

  constructor(config: AgentConfig) {
    this.config = AgentConfigSchema.parse(config);
    this.providerRouter = new ProviderRouter({
      primaryProvider: 'claude',
      fallbackProviders: ['gemini', 'openai'],
      enableFallback: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
    });
    this.toolSystem = new ToolSystem(this.config.allowedTools);
    this.memoryService = new MemoryService();
  }

  abstract async plan(task: Task): Promise<{ steps: string[]; requiredTools: string[] }>;
  abstract async execute(task: Task): Promise<string>;

  async processTask(task: Task): Promise<string> {
    const validatedTask = TaskSchema.parse(task);

    // Create plan
    const plan = await this.plan(validatedTask);

    // Execute with tools
    const result = await this.execute(validatedTask);

    // Store in memory
    await this.memoryService.storeTask(validatedTask.agentId, validatedTask, result);

    return result;
  }

  protected async callProvider(prompt: string): Promise<string> {
    const response = await this.providerRouter.execute({
      requestId: crypto.randomUUID(),
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 1.0,
      stream: false,
    });

    return response.content;
  }

  protected async executeTool(toolSpec: ToolSpec): Promise<any> {
    return this.toolSystem.execute(toolSpec);
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getExpertise(): string[] {
    return this.config.expertise;
  }

  canDelegate(): boolean {
    return this.config.canDelegate;
  }
}
```

**Estimated Lines:** ~100 lines

### 4.2 Specialized Agents (20 implementations)

Each agent follows this pattern:

**File:** `src/agents/BackendAgent.ts`

```typescript
import { Agent } from './Agent.js';
import type { Task, AgentConfig } from '../types/schemas/agent.schema.js';

export class BackendAgent extends Agent {
  constructor() {
    const config: AgentConfig = {
      id: 'backend',
      name: 'Backend Developer (Bob)',
      role: 'Backend Development',
      expertise: ['go', 'rust', 'node.js', 'api-design', 'databases', 'microservices'],
      description: 'Expert in backend systems, API design, and database architecture',
      capabilities: [
        'Design and implement REST/GraphQL APIs',
        'Database schema design and optimization',
        'Microservices architecture',
        'Performance optimization',
        'Security best practices',
      ],
      maxConcurrentTasks: 3,
      priority: 8,
      canDelegate: true,
      allowedTools: ['bash', 'file_read', 'file_write', 'code_search', 'code_def'],
      systemPrompt: `You are Bob, an expert backend developer specializing in Go, Rust, and Node.js.
Your expertise includes API design, database architecture, microservices, and performance optimization.
You have access to code intelligence tools and can search/analyze codebases.
Always provide production-ready, well-tested, and documented code.`,
    };

    super(config);
  }

  async plan(task: Task): Promise<{ steps: string[]; requiredTools: string[] }> {
    const planningPrompt = `
Task: ${task.description}
Context: ${JSON.stringify(task.context)}

As a backend developer, create a step-by-step plan to accomplish this task.
Include which tools you'll need (bash, file_read, file_write, code_search, code_def).
Return JSON format: { "steps": ["step1", "step2"], "requiredTools": ["tool1", "tool2"] }
    `;

    const response = await this.callProvider(planningPrompt);
    const plan = JSON.parse(response);

    return {
      steps: plan.steps,
      requiredTools: plan.requiredTools,
    };
  }

  async execute(task: Task): Promise<string> {
    // Search existing codebase for relevant files
    const searchResult = await this.executeTool({
      name: 'code_search',
      args: { query: task.description, language: 'typescript' },
      timeout: 30000,
    });

    // Get implementation from AI
    const implementationPrompt = `
Task: ${task.description}
Existing code context: ${JSON.stringify(searchResult)}

Implement the solution following best practices for backend development.
Include error handling, validation, and tests.
    `;

    const implementation = await this.callProvider(implementationPrompt);

    // Write implementation to file
    if (task.context.outputFile) {
      await this.executeTool({
        name: 'file_write',
        args: {
          path: task.context.outputFile,
          content: implementation,
        },
        timeout: 5000,
      });
    }

    return implementation;
  }
}
```

**Lines per Agent:** ~120 lines
**Total for 20 Agents:** ~2,400 lines

### 4.3 Tool System

**File:** `src/agents/tools/ToolSystem.ts`

```typescript
import type { ToolSpec, ToolExecution } from '../../types/schemas/agent.schema.js';
import { ToolSpecSchema } from '../../types/schemas/agent.schema.js';
import { BashTool } from './BashTool.js';
import { FileReadTool } from './FileReadTool.js';
import { FileWriteTool } from './FileWriteTool.js';
import { WebFetchTool } from './WebFetchTool.js';
import { CodeSearchTool } from './CodeSearchTool.js';
import { CodeDefTool } from './CodeDefTool.js';

export class ToolSystem {
  private allowedTools: Set<string>;
  private tools: Map<string, any>;

  constructor(allowedTools: string[]) {
    this.allowedTools = new Set(allowedTools);
    this.tools = new Map([
      ['bash', new BashTool()],
      ['file_read', new FileReadTool()],
      ['file_write', new FileWriteTool()],
      ['web_fetch', new WebFetchTool()],
      ['code_search', new CodeSearchTool()],
      ['code_def', new CodeDefTool()],
    ]);
  }

  async execute(toolSpec: ToolSpec): Promise<any> {
    const validated = ToolSpecSchema.parse(toolSpec);

    if (!this.allowedTools.has(validated.name)) {
      throw new Error(`Tool ${validated.name} not allowed`);
    }

    const tool = this.tools.get(validated.name);
    if (!tool) {
      throw new Error(`Tool ${validated.name} not found`);
    }

    const startTime = Date.now();

    try {
      const result = await Promise.race([
        tool.execute(validated.args),
        this.timeout(validated.timeout),
      ]);

      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms`)), ms);
    });
  }
}
```

**Estimated Lines:** ~80 lines

---

## Testing Strategy

### Unit Tests

**ReScript State Machine:**
- State transitions (20 tests)
- Guards (10 tests)
- Context management (15 tests)

**Agent Implementations:**
- Each agent: plan() and execute() (5 tests × 20 = 100 tests... but we'll test 10 core agents deeply)
- Core 10 agents: 50 tests
- Tool system: 15 tests

**Total Tests:** 95+ tests

---

## Success Criteria

### Functional Requirements

- ✅ 20 specialized agents operational
- ✅ All agents can plan and execute tasks
- ✅ Tool system working (bash, file, web, code intelligence)
- ✅ Agent-to-agent delegation functional
- ✅ Memory integration for task history

### Performance Requirements

- ✅ Task initiation latency: <2s
- ✅ Tool execution: <5s (P95)
- ✅ Delegation overhead: <500ms
- ✅ Database writes: <10ms

### Quality Requirements

- ✅ 95+ tests passing (100%)
- ✅ Test coverage >85%
- ✅ Zero P0/P1 bugs

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR IMPLEMENTATION
**Next Review:** 2026-02-01 (Phase 3 Gate Review)
