# revamp_v1 Phase 3: Agent System - Detailed Action Plan

**Project:** AutomatosX Revamp v1
**Phase:** Phase 3 - Agent System
**Duration:** 5 weeks (25 working days)
**Start Date:** December 29, 2025 (Monday)
**End Date:** February 1, 2026 (Sunday, working day)
**Team:** 2 backend developers + 1 frontend developer + 1 QA engineer

---

## Overview

This document provides day-by-day execution plan for Phase 3, implementing 20 specialized AI agents with code intelligence integration. Following the ReScript + TypeScript + Zod architecture pattern established in Phases 1 and 2.

**Key Deliverables:**
- ReScript state machine for agent task lifecycle (~600 lines)
- 20 specialized agent implementations (~2,400 lines)
- Tool system with 6 tools (~500 lines)
- Zod validation schemas (~180 lines)
- Database migration 010 (~180 lines)
- 95+ comprehensive tests
- Agent collaboration and delegation system

---

## Week 1: Foundation & State Machine

**Goals:**
- Complete ReScript agent state machine
- Define Zod schemas
- Create database migration
- Setup agent infrastructure

**Deliverables:**
- AgentStateMachine.res (functional ~600 lines)
- agent.schema.ts (complete ~180 lines)
- Migration 010 (applied ~180 lines)
- Agent base class (~100 lines)
- 30+ tests passing

---

### Day 1 (Monday, Dec 29): ReScript State & Event Modules

**Time Allocation:** 8 hours

**Tasks:**

1. **Create ReScript Agent Module Structure** (1 hour)
   ```bash
   mkdir -p packages/rescript-core/src/agents
   touch packages/rescript-core/src/agents/AgentStateMachine.res
   ```

2. **Implement State Module** (~1.5 hours)

   File: `packages/rescript-core/src/agents/AgentStateMachine.res`

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

   **Lines:** ~65

3. **Implement Event Module** (~2.5 hours)

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

   **Lines:** ~95

4. **Update rescript.json** (30 min)

   File: `packages/rescript-core/rescript.json`

   ```json
   {
     "sources": [
       {
         "dir": "src/agents",
         "subdirs": true
       }
     ]
   }
   ```

5. **Build and Verify** (1 hour)
   ```bash
   cd packages/rescript-core
   npm run build
   ls lib/js/src/agents/
   ```

6. **Write Initial Tests** (1.5 hours)

   File: `packages/rescript-core/src/agents/__tests__/AgentStateMachine_test.res`

   ```rescript
   open Vitest

   describe("Agent State Module", () => {
     test("toString converts states correctly", () => {
       expect(State.toString(State.Idle))->toBe("idle")
       expect(State.toString(State.Planning))->toBe("planning")
       expect(State.toString(State.ExecutingTools))->toBe("executing_tools")
       expect(State.toString(State.Completed))->toBe("completed")
     })

     test("fromString parses states correctly", () => {
       expect(State.fromString("idle"))->toEqual(Some(State.Idle))
       expect(State.fromString("planning"))->toEqual(Some(State.Planning))
       expect(State.fromString("invalid"))->toEqual(None)
     })

     test("isTerminal identifies terminal states", () => {
       expect(State.isTerminal(State.Completed))->toBe(true)
       expect(State.isTerminal(State.Failed))->toBe(true)
       expect(State.isTerminal(State.ExecutingTools))->toBe(false)
     })

     test("canPause identifies pausable states", () => {
       expect(State.canPause(State.ExecutingTools))->toBe(true)
       expect(State.canPause(State.AwaitingDelegation))->toBe(true)
       expect(State.canPause(State.Completed))->toBe(false)
     })
   })

   describe("Agent Event Module", () => {
     test("toString converts events correctly", () => {
       expect(Event.toString(Event.StartPlanning))->toBe("start_planning")
       expect(Event.toString(Event.ValidateTask))->toBe("validate_task")
       expect(Event.toString(Event.ProcessResults))->toBe("process_results")
     })
   })
   ```

   **Tests Written:** 8 tests

**End of Day Status:**
- ✅ State module complete (~65 lines)
- ✅ Event module complete (~95 lines)
- ✅ 8 tests passing
- ✅ ReScript building successfully

---

### Day 2 (Tuesday, Dec 30): Context Module

**Time Allocation:** 8 hours

**Tasks:**

1. **Implement Context Module** (~4 hours)

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
   }
   ```

   **Lines:** ~160

2. **Implement Guards Module** (~1.5 hours)

   ```rescript
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

     let hasValidPriority = (ctx: Context.t): bool => {
       switch ctx.task {
       | Some(task) => task.priority >= 1 && task.priority <= 10
       | None => false
       }
     }
   }
   ```

   **Lines:** ~45

3. **Write Context Tests** (~2.5 hours)

   ```rescript
   describe("Context Module", () => {
     test("create initializes context correctly", () => {
       let ctx = Context.create()
       expect(ctx.task)->toEqual(None)
       expect(ctx.plan)->toEqual(None)
       expect(Belt.Array.length(ctx.toolExecutions))->toBe(0)
       expect(ctx.metrics.retries)->toBe(0)
     })

     test("setTask updates task info", () => {
       let ctx = Context.create()
       let task: Context.taskInfo = {
         taskId: "task-123",
         agentId: "backend",
         description: "Implement API",
         priority: 8,
         context: Js.Dict.empty(),
       }
       let updated = Context.setTask(ctx, task)
       expect(updated.task)->toEqual(Some(task))
     })

     test("setPlan updates plan info", () => {
       let ctx = Context.create()
       let steps = ["Step 1", "Step 2", "Step 3"]
       let updated = Context.setPlan(ctx, steps, 3600, ["bash", "file_write"])

       switch updated.plan {
       | Some(plan) => {
           expect(plan.steps)->toEqual(steps)
           expect(plan.currentStep)->toBe(0)
           expect(plan.estimatedDuration)->toBe(3600)
         }
       | None => ()
       }
     })

     test("addToolExecution appends to executions", () => {
       let ctx = Context.create()
       let exec: Context.toolExecution = {
         tool: "bash",
         args: Js.Dict.empty(),
         result: None,
         duration: None,
         success: false,
         error: None,
       }
       let updated = Context.addToolExecution(ctx, exec)
       expect(Belt.Array.length(updated.toolExecutions))->toBe(1)
       expect(updated.metrics.toolExecutions)->toBe(1)
     })

     test("setResult updates result and metrics", () => {
       let ctx = Context.create()
       let updated = Context.setResult(ctx, "Task completed successfully")

       expect(updated.result)->toEqual(Some("Task completed successfully"))
       switch updated.metrics.endTime {
       | Some(_) => expect(true)->toBe(true)
       | None => expect(false)->toBe(true)
       }
     })
   })

   describe("Guards Module", () => {
     test("hasTask checks for task presence", () => {
       let ctx = Context.create()
       expect(Guards.hasTask(ctx))->toBe(false)

       let task: Context.taskInfo = {
         taskId: "task-123",
         agentId: "backend",
         description: "Test",
         priority: 5,
         context: Js.Dict.empty(),
       }
       let withTask = Context.setTask(ctx, task)
       expect(Guards.hasTask(withTask))->toBe(true)
     })

     test("hasPlan checks for plan presence", () => {
       let ctx = Context.create()
       expect(Guards.hasPlan(ctx))->toBe(false)

       let withPlan = Context.setPlan(ctx, ["Step 1"], 1000, ["bash"])
       expect(Guards.hasPlan(withPlan))->toBe(true)
     })

     test("canRetry respects max retries", () => {
       let ctx = Context.create()
       expect(Guards.canRetry(ctx))->toBe(true)

       let maxedOut = {...ctx, metrics: {...ctx.metrics, retries: 3}}
       expect(Guards.canRetry(maxedOut))->toBe(false)
     })
   })
   ```

   **Tests Written:** 10 tests

**End of Day Status:**
- ✅ Context module complete (~160 lines)
- ✅ Guards module complete (~45 lines)
- ✅ 18 tests passing (8 + 10)

---

### Day 3 (Wednesday, Dec 31): State Machine Transitions (Part 1)

**Time Allocation:** 8 hours

**Tasks:**

1. **Implement Machine Module Structure** (~2 hours)

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

       // More transitions to be added on Day 4
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
   }
   ```

   **Lines:** ~80 (partial)

2. **Write Transition Tests** (~4 hours)

   ```rescript
   describe("Machine Transitions - Basic Flow", () => {
     test("Idle → Planning on InitiateTask", () => {
       let machine = Machine.create()
       let event = Event.InitiateTask({
         taskId: "task-123",
         agentId: "backend",
         description: "Implement user API",
         priority: 8,
         context: Js.Dict.empty(),
       })

       let result = Machine.transition(machine, event)
       expect(result->Belt.Result.isOk)->toBe(true)

       switch result {
       | Ok(newMachine) => {
           expect(Machine.getState(newMachine))->toBe(State.Planning)
           switch newMachine.context.task {
           | Some(task) => {
               expect(task.taskId)->toBe("task-123")
               expect(task.agentId)->toBe("backend")
             }
           | None => expect(false)->toBe(true)
           }
         }
       | Error(_) => expect(false)->toBe(true)
       }
     })

     test("Planning → ValidatingTask on PlanCreated", () => {
       let machine = Machine.create()
       let machine = {...machine, currentState: State.Planning}

       let event = Event.PlanCreated({
         steps: ["Analyze requirements", "Design API", "Implement"],
         estimatedDuration: 3600,
         requiredTools: ["code_search", "file_write", "bash"],
       })

       let result = Machine.transition(machine, event)
       switch result {
       | Ok(newMachine) => {
           expect(Machine.getState(newMachine))->toBe(State.ValidatingTask)
           switch newMachine.context.plan {
           | Some(plan) => {
               expect(Belt.Array.length(plan.steps))->toBe(3)
               expect(plan.estimatedDuration)->toBe(3600)
             }
           | None => expect(false)->toBe(true)
           }
         }
       | Error(_) => expect(false)->toBe(true)
       }
     })
   })
   ```

   **Tests Written:** 5 tests

3. **Build and Test** (2 hours)
   ```bash
   cd packages/rescript-core
   npm run build
   npm test
   ```

**End of Day Status:**
- ✅ Machine module started (~80 lines partial)
- ✅ 23 tests passing (18 + 5)
- ✅ Basic transitions working

---

### Days 4-5: Complete State Machine & Database

**(Continuing with same granularity - Days 4-5 would complete all transitions, add JavaScript interop, create Zod schemas, and database migration)**

**Day 4:** Complete all state machine transitions (~200 more lines), 10 more tests
**Day 5:** JavaScript interop (~80 lines), Zod schemas (~180 lines), Database migration (~180 lines), integration tests (7 tests)

**Week 1 End Status:**
- ✅ AgentStateMachine.res complete (~600 lines)
- ✅ agent.schema.ts complete (~180 lines)
- ✅ Migration 010 complete (~180 lines)
- ✅ 45 tests passing
- ✅ All infrastructure ready for agent implementations

---

## Week 2: Tool System + First Agents

**Goals:**
- Implement complete tool system (6 tools)
- Create Agent base class
- Implement first 4 agents (Backend, Frontend, Architecture, FullStack)
- Tool integration testing

**Deliverables:**
- ToolSystem.ts (~80 lines)
- 6 tool implementations (~500 lines total)
- Agent.ts base class (~100 lines)
- 4 agent implementations (~480 lines)
- 20+ tests (cumulative 65)

---

### Day 6 (Monday, Jan 5): Tool System Infrastructure

**Time Allocation:** 8 hours

**Tasks:**

1. **Create Tool System** (~3 hours)

   File: `src/agents/tools/ToolSystem.ts`

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

         return {
           success: true,
           result,
           duration: Date.now() - startTime,
         };
       } catch (error) {
         return {
           success: false,
           error: error instanceof Error ? error.message : 'Unknown error',
           duration: Date.now() - startTime,
         };
       }
     }

     private timeout(ms: number): Promise<never> {
       return new Promise((_, reject) => {
         setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
       });
     }
   }
   ```

   **Lines:** ~80

2. **Implement Tools** (~4 hours)

   **BashTool.ts:**
   ```typescript
   import { exec } from 'child_process';
   import { promisify } from 'util';

   const execAsync = promisify(exec);

   export class BashTool {
     async execute(args: { command: string }): Promise<string> {
       const { stdout, stderr } = await execAsync(args.command);
       return stdout || stderr;
     }
   }
   ```

   **FileReadTool.ts, FileWriteTool.ts, WebFetchTool.ts, CodeSearchTool.ts, CodeDefTool.ts** - Similar implementations (~80 lines each)

   **Total Lines:** ~500 lines for all 6 tools

3. **Write Tool Tests** (~1 hour)

   File: `src/__tests__/agents/tools/ToolSystem.test.ts`

   ```typescript
   import { describe, test, expect } from 'vitest';
   import { ToolSystem } from '../../../agents/tools/ToolSystem.js';

   describe('ToolSystem', () => {
     test('executes allowed tool', async () => {
       const toolSystem = new ToolSystem(['bash', 'file_read']);

       const result = await toolSystem.execute({
         name: 'bash',
         args: { command: 'echo "Hello"' },
         timeout: 5000,
       });

       expect(result.success).toBe(true);
       expect(result.result).toContain('Hello');
     });

     test('rejects disallowed tool', async () => {
       const toolSystem = new ToolSystem(['bash']);

       await expect(
         toolSystem.execute({
           name: 'file_write',
           args: { path: '/tmp/test', content: 'test' },
           timeout: 5000,
         })
       ).rejects.toThrow('not allowed');
     });

     test('handles timeout', async () => {
       const toolSystem = new ToolSystem(['bash']);

       const result = await toolSystem.execute({
         name: 'bash',
         args: { command: 'sleep 10' },
         timeout: 1000,
       });

       expect(result.success).toBe(false);
       expect(result.error).toContain('Timeout');
     });
   });
   ```

   **Tests Written:** 5 tests

**End of Day Status:**
- ✅ ToolSystem complete (~80 lines)
- ✅ 6 tools implemented (~500 lines)
- ✅ 50 tests passing (45 + 5)

---

### Days 7-10: Agent Base Class + First 4 Agents

**(Detailed breakdown continues)**

**Day 7:** Agent base class (~100 lines), AgentRegistry (~80 lines), 5 tests
**Day 8:** BackendAgent complete (~120 lines), 5 tests
**Day 9:** FrontendAgent complete (~120 lines), 5 tests
**Day 10:** ArchitectAgent + FullStackAgent (~240 lines), 10 tests

**Week 2 End Status:**
- ✅ Tool system complete (6 tools)
- ✅ Agent infrastructure complete
- ✅ 4 agents implemented
- ✅ 75 tests passing

---

## Week 3: Agents 5-12

**Goals:**
- Implement next 8 agents
- Test each agent thoroughly
- Agent collaboration testing

**Agents This Week:**
5. MobileAgent (Maya)
6. DevOpsAgent (Oliver)
7. SecurityAgent (Steve)
8. DataAgent (Daisy)
9. QualityAgent (Queenie)
10. DesignAgent (Debbee)
11. WriterAgent (Wendy)
12. ProductAgent (Paris)

**Deliverables:**
- 8 agent implementations (~960 lines)
- 40+ tests (cumulative 115)

---

### Days 11-15: Agent Implementations (5 agents/week pattern)

**(Similar detailed breakdown - 2 agents per day with tests)**

**Week 3 End Status:**
- ✅ 12 agents total implemented
- ✅ 115 tests passing

---

## Week 4: Agents 13-20 + Delegation

**Goals:**
- Complete final 8 agents
- Implement agent-to-agent delegation
- Integration testing

**Agents This Week:**
13. CTOAgent (Tony)
14. CEOAgent (Eric)
15. ResearcherAgent (Rodman)
16. DataScientistAgent (Dana)
17. AerospaceScientistAgent (Astrid)
18. QuantumEngineerAgent (Quinn)
19. CreativeMarketerAgent (Candy)
20. StandardAgent (Stan)

**Deliverables:**
- 8 final agents (~960 lines)
- Delegation system (~150 lines)
- 30+ tests (cumulative 145)

---

### Days 16-20: Final Agents + Collaboration

**(Detailed daily breakdown continues)**

**Week 4 End Status:**
- ✅ All 20 agents implemented
- ✅ Delegation working
- ✅ 145 tests passing

---

## Week 5: Integration, Testing & Phase Gate

**Goals:**
- End-to-end integration testing
- Performance optimization
- Documentation
- Phase gate review

**Deliverables:**
- Integration test suite (20 tests)
- Performance benchmarks
- API documentation
- User guides
- Phase 3 completion report

---

### Days 21-25: Final Testing & Documentation

**Day 21:** E2E integration tests (10 tests)
**Day 22:** Performance testing and optimization
**Day 23:** API documentation and user guides
**Day 24:** Phase gate preparation
**Day 25:** Phase gate review and approval

---

## Summary

**Total Deliverables:**
- **ReScript Code:** ~600 lines (agent state machine)
- **TypeScript Code:** ~3,100 lines (agents + tools + infrastructure)
- **Zod Schemas:** ~180 lines
- **SQL:** ~180 lines (migration)
- **Tests:** 95+ tests (165 final count)
- **Documentation:** Architecture PRD, API reference, user guide

**Performance Targets:**
- ✅ Task initiation: <2s
- ✅ Tool execution: <5s (P95)
- ✅ Delegation: <500ms
- ✅ Database writes: <10ms

**Quality Metrics:**
- ✅ Test coverage: >85%
- ✅ All tests passing: 100%
- ✅ Zero P0/P1 bugs

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR EXECUTION
**Phase Gate:** 2026-02-01
