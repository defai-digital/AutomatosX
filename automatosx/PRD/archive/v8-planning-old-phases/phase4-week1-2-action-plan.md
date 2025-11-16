# Phase 4 Week 1-2: Workflow Engine Implementation - Action Plan

**AutomatosX - Phase 4 Implementation Plan**

**Version**: 1.0.0
**Date**: 2025-11-10
**Phase**: 4 (Workflow Engine with ReScript State Machines)
**Duration**: 2 Weeks (10 Days)

---

## Executive Summary

This action plan details the implementation of Phase 4 Week 1 and Week 2, delivering a comprehensive workflow orchestration engine with ReScript state machines, declarative workflow definitions (YAML/JSON), parallel execution, checkpoint/resume capabilities, and multi-agent collaboration support.

**Timeline**: 10 days
**Estimated LOC**: ~2,000 lines production code + ~800 lines tests
**Architecture**: ReScript Core → TypeScript Service → Database (SQLite)

---

## Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: ReScript Core                   │
│  WorkflowStateMachine.res - Pure functional state machine   │
│  - 14 states (Idle → Completed/Failed/Cancelled)           │
│  - Type-safe transitions with pattern matching             │
│  - Event-driven state updates                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Layer 2: TypeScript Services                │
│  WorkflowParser.ts - Parse YAML/JSON to WorkflowDefinition │
│  WorkflowEngine.ts - Orchestrate execution with state      │
│  CheckpointService.ts - Save/restore workflow state        │
│  - Zod validation for all cross-boundary data              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 3: Database (SQLite)                │
│  workflows - Workflow definitions and metadata             │
│  workflow_executions - Execution instances with state      │
│  workflow_steps - Individual step definitions              │
│  workflow_step_executions - Step execution tracking       │
│  workflow_checkpoints - State snapshots for resume        │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **Workflow Definition**: Declarative YAML/JSON describing steps, dependencies, agents
2. **State Machine**: ReScript state machine managing execution lifecycle
3. **Checkpoint/Resume**: Save workflow state at any point, resume from checkpoint
4. **Parallel Execution**: Execute independent steps in parallel using dependency graph
5. **Multi-Agent**: Orchestrate multiple AI agents with different capabilities

---

## Week 1: Foundation & State Machine (Days 1-5)

### Day 1: Database Schema & Migration ✅

**Deliverable**: `src/migrations/013_create_workflow_tables.sql` (~200 lines)

**Tables**:
1. **workflows** - Workflow definitions
   - id, name, description, definition (JSON), version, created_at, updated_at
2. **workflow_executions** - Execution instances
   - id, workflow_id, state, context (JSON), started_at, completed_at, error
3. **workflow_steps** - Step definitions (extracted from workflow)
   - id, workflow_id, step_key, agent, prompt_template, dependencies (JSON), parallel
4. **workflow_step_executions** - Step execution tracking
   - id, execution_id, step_id, state, result (JSON), started_at, completed_at, error, retry_count
5. **workflow_checkpoints** - State snapshots
   - id, execution_id, state, context (JSON), completed_steps (JSON), created_at

**Indexes**:
- workflows(name), workflow_executions(workflow_id, state), workflow_steps(workflow_id), workflow_step_executions(execution_id, state), workflow_checkpoints(execution_id, created_at DESC)

**Status**: To implement

---

### Day 2-3: ReScript Workflow State Machine 🔧

**Deliverable**: `packages/rescript-core/src/workflows/WorkflowStateMachine.res` (~700 lines)

**State Type** (14 states):
```rescript
type state =
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
  | Failed(string)  // error message
  | Paused
  | Cancelled
```

**Event Type**:
```rescript
type event =
  | StartWorkflow(string)  // workflow definition (JSON string)
  | WorkflowParsed(workflowDefinition)
  | ValidationComplete
  | DependencyGraphBuilt(dependencyGraph)
  | StepsScheduled(stepSchedule)
  | StepCompleted(stepResult)
  | AllStepsCompleted
  | CheckpointCreated(checkpoint)
  | CheckpointRestored(restoredState)
  | ResultsAggregated(aggregatedResults)
  | Error(string)
  | Pause
  | Resume
  | Cancel
```

**Key Functions**:
- `transition: (state, event) => result<state, transitionError>` - Pure state transition
- `validateTransition: (state, event) => bool` - Check if transition is allowed
- `isTerminalState: state => bool` - Check if state is terminal
- `canResume: state => bool` - Check if workflow can resume

**Status**: To implement

---

### Day 4: Zod Schemas & TypeScript Types 📝

**Deliverable**: `src/types/schemas/workflow.schema.ts` (~150 lines)

**Schemas**:
1. **WorkflowDefinitionSchema** - Workflow structure
   ```typescript
   {
     name: string
     description: string
     version: string
     steps: WorkflowStep[]
     config?: WorkflowConfig
   }
   ```

2. **WorkflowStepSchema** - Individual step
   ```typescript
   {
     key: string
     agent: string
     prompt: string
     dependencies: string[]  // step keys
     parallel: boolean
     retryPolicy?: RetryPolicy
   }
   ```

3. **WorkflowExecutionSchema** - Execution instance
   ```typescript
   {
     id: string
     workflowId: string
     state: WorkflowState
     context: Record<string, unknown>
     startedAt: number
     completedAt?: number
     error?: string
   }
   ```

4. **WorkflowCheckpointSchema** - State snapshot
   ```typescript
   {
     id: string
     executionId: string
     state: WorkflowState
     context: Record<string, unknown>
     completedSteps: string[]
     createdAt: number
   }
   ```

**Status**: To implement

---

### Day 5: Week 1 Testing & Integration 🧪

**Tests**:
1. `packages/rescript-core/src/workflows/__tests__/WorkflowStateMachine.test.res` (~200 lines)
   - Test all state transitions
   - Test invalid transitions
   - Test terminal states
   - Test resume logic

2. `src/__tests__/workflows/WorkflowSchemas.test.ts` (~100 lines)
   - Validate all Zod schemas
   - Test schema composition
   - Test validation error messages

3. `src/database/dao/__tests__/WorkflowDAO.test.ts` (~100 lines)
   - CRUD operations for workflows
   - Execution tracking
   - Checkpoint save/restore

**Status**: To implement

---

## Week 2: Workflow Parser & Orchestration (Days 6-10)

### Day 6: Workflow Parser 📄

**Deliverable**: `src/services/WorkflowParser.ts` (~140 lines)

**Key Methods**:
```typescript
export class WorkflowParser {
  async parseYAML(yamlString: string): Promise<WorkflowDefinition> {
    // Parse YAML to JSON
    // Validate with Zod schema
    // Return typed WorkflowDefinition
  }

  async parseJSON(jsonString: string): Promise<WorkflowDefinition> {
    // Parse JSON
    // Validate with Zod schema
    // Return typed WorkflowDefinition
  }

  async parseFile(filePath: string): Promise<WorkflowDefinition> {
    // Detect format (YAML/JSON)
    // Parse and validate
  }

  buildDependencyGraph(workflow: WorkflowDefinition): DependencyGraph {
    // Build directed acyclic graph (DAG)
    // Detect cycles
    // Return topological sort order
  }
}
```

**Status**: To implement

---

### Day 7-8: Workflow Engine 🎯

**Deliverable**: `src/services/WorkflowEngine.ts` (~150 lines)

**Key Methods**:
```typescript
export class WorkflowEngine {
  private stateMachine: WorkflowStateMachine  // ReScript state machine

  async executeWorkflow(workflowDef: WorkflowDefinition, context: WorkflowContext): Promise<WorkflowResult> {
    // Start state machine
    // Parse workflow
    // Build dependency graph
    // Schedule steps
    // Execute steps (parallel where possible)
    // Aggregate results
  }

  async executeStep(step: WorkflowStep, context: StepContext): Promise<StepResult> {
    // Route to appropriate agent
    // Execute with retry policy
    // Return result
  }

  async pauseExecution(executionId: string): Promise<void> {
    // Transition state machine to Paused
    // Create checkpoint
  }

  async resumeExecution(executionId: string): Promise<WorkflowResult> {
    // Restore from checkpoint
    // Resume state machine
    // Continue execution
  }

  async cancelExecution(executionId: string): Promise<void> {
    // Transition state machine to Cancelled
  }
}
```

**Status**: To implement

---

### Day 9: Checkpoint System 💾

**Deliverable**: `src/services/CheckpointService.ts` (~120 lines)

**Key Methods**:
```typescript
export class CheckpointService {
  async createCheckpoint(execution: WorkflowExecution): Promise<Checkpoint> {
    // Serialize current state
    // Save to database
    // Return checkpoint ID
  }

  async restoreCheckpoint(checkpointId: string): Promise<WorkflowExecution> {
    // Load checkpoint from database
    // Deserialize state
    // Return execution ready to resume
  }

  async listCheckpoints(executionId: string): Promise<Checkpoint[]> {
    // Query all checkpoints for execution
    // Order by created_at DESC
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    // Remove checkpoint from database
  }

  async pruneOldCheckpoints(retentionDays: number = 7): Promise<number> {
    // Delete checkpoints older than retention period
    // Return count deleted
  }
}
```

**Status**: To implement

---

### Day 10: Week 2 Testing & Integration 🧪

**Tests**:
1. `src/services/__tests__/WorkflowParser.test.ts` (~120 lines)
   - Parse valid YAML workflows
   - Parse valid JSON workflows
   - Reject invalid workflows
   - Build dependency graphs
   - Detect cycles

2. `src/services/__tests__/WorkflowEngine.test.ts` (~150 lines)
   - Execute simple workflow (2 steps, no deps)
   - Execute complex workflow (5 steps, parallel execution)
   - Test pause/resume
   - Test cancellation
   - Test error handling

3. `src/services/__tests__/CheckpointService.test.ts` (~80 lines)
   - Create checkpoint
   - Restore checkpoint
   - List checkpoints
   - Prune old checkpoints

4. `src/__tests__/workflows/Phase4Week2E2E.test.ts` (~150 lines)
   - End-to-end workflow execution
   - Multi-agent collaboration
   - Checkpoint and resume full workflow
   - Performance benchmarks

**Status**: To implement

---

## File Breakdown

| File | Lines | Purpose | Week | Day |
|------|-------|---------|------|-----|
| `src/migrations/013_create_workflow_tables.sql` | 200 | Database schema | 1 | 1 |
| `packages/rescript-core/src/workflows/WorkflowStateMachine.res` | 700 | State machine | 1 | 2-3 |
| `src/types/schemas/workflow.schema.ts` | 150 | Zod schemas | 1 | 4 |
| `packages/rescript-core/src/workflows/__tests__/WorkflowStateMachine.test.res` | 200 | State machine tests | 1 | 5 |
| `src/__tests__/workflows/WorkflowSchemas.test.ts` | 100 | Schema tests | 1 | 5 |
| `src/database/dao/__tests__/WorkflowDAO.test.ts` | 100 | DAO tests | 1 | 5 |
| `src/services/WorkflowParser.ts` | 140 | Workflow parser | 2 | 6 |
| `src/services/WorkflowEngine.ts` | 150 | Orchestration | 2 | 7-8 |
| `src/services/CheckpointService.ts` | 120 | Checkpoint system | 2 | 9 |
| `src/services/__tests__/WorkflowParser.test.ts` | 120 | Parser tests | 2 | 10 |
| `src/services/__tests__/WorkflowEngine.test.ts` | 150 | Engine tests | 2 | 10 |
| `src/services/__tests__/CheckpointService.test.ts` | 80 | Checkpoint tests | 2 | 10 |
| `src/__tests__/workflows/Phase4Week2E2E.test.ts` | 150 | E2E tests | 2 | 10 |
| `src/database/dao/WorkflowDAO.ts` | 180 | Database access | 1 | 1 |
| `src/cli/commands/workflow.ts` | 120 | CLI commands | 2 | 8 |

**Total Production Code**: ~1,960 lines
**Total Test Code**: ~900 lines
**Grand Total**: ~2,860 lines

---

## Success Criteria

### Week 1
- [ ] Database schema complete with 5 tables, indexes
- [ ] ReScript state machine with 14 states, type-safe transitions
- [ ] Zod schemas for all workflow types
- [ ] State machine tests passing (100% coverage)
- [ ] Schema validation tests passing

### Week 2
- [ ] Workflow parser supports YAML and JSON
- [ ] Workflow engine executes workflows with parallel steps
- [ ] Checkpoint system saves and restores state
- [ ] Pause/resume functionality working
- [ ] End-to-end test executing multi-agent workflow
- [ ] Performance: Execute 5-step workflow in < 30s
- [ ] All tests passing (85%+ coverage)

---

## Example Workflow Definition

```yaml
name: "Code Review Workflow"
description: "Multi-agent code review with quality checks"
version: "1.0.0"
steps:
  - key: "parse-changes"
    agent: "backend"
    prompt: "Parse git diff and extract changed files: {{git_diff}}"
    dependencies: []
    parallel: false

  - key: "security-audit"
    agent: "security"
    prompt: "Audit these changes for vulnerabilities: {{parse-changes.result}}"
    dependencies: ["parse-changes"]
    parallel: true

  - key: "quality-check"
    agent: "quality"
    prompt: "Run tests and check code quality: {{parse-changes.result}}"
    dependencies: ["parse-changes"]
    parallel: true

  - key: "aggregate-results"
    agent: "product"
    prompt: "Aggregate results: security={{security-audit.result}}, quality={{quality-check.result}}"
    dependencies: ["security-audit", "quality-check"]
    parallel: false
```

---

## CLI Commands

```bash
# Execute a workflow
ax workflow run ./workflows/code-review.yaml

# List all workflows
ax workflow list

# Show workflow status
ax workflow status <execution-id>

# Pause execution
ax workflow pause <execution-id>

# Resume execution
ax workflow resume <execution-id>

# Cancel execution
ax workflow cancel <execution-id>

# List checkpoints
ax workflow checkpoints <execution-id>

# Restore from checkpoint
ax workflow restore <checkpoint-id>
```

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| ReScript learning curve | Follow proven patterns from Phase 3 | ✅ |
| Dependency graph cycles | Detect cycles in parser, reject invalid workflows | To implement |
| State machine complexity | Comprehensive tests, clear state diagram | To implement |
| Checkpoint serialization | Use JSON, validate with Zod on restore | To implement |
| Parallel execution deadlocks | Topological sort, proper dependency resolution | To implement |
| Agent coordination | Clear agent interfaces, retry policies | To implement |

---

## Performance Targets

- **Workflow parsing**: < 10ms for 10-step workflow
- **State transition**: < 1ms per transition
- **Checkpoint creation**: < 50ms
- **Checkpoint restore**: < 100ms
- **Step execution**: < 5s per step (agent-dependent)
- **End-to-end (5 steps)**: < 30s

---

## Integration Points

### With Existing Systems
- Phase 2: Provider Layer - Route agent calls to AI providers
- Phase 3: Monitoring - Track workflow execution metrics
- Database: SQLite - Store workflow definitions and state
- CLI: Commander.js - Workflow management commands

### External Dependencies
- `js-yaml` - YAML parsing
- ReScript compiler - State machine compilation
- Zod - Schema validation
- SQLite - Persistence

---

## Documentation Deliverables

1. **Phase 4 Week 1 Summary** - Foundation and state machine results
2. **Phase 4 Week 2 Summary** - Parser and orchestration results
3. **Phase 4 Completion Summary** - Overall results and metrics
4. **Workflow Definition Guide** - How to write workflows (YAML/JSON)
5. **API Documentation** - WorkflowEngine, WorkflowParser, CheckpointService

---

## Next Phase Preview

**Phase 5**: Advanced Workflow Features
- Conditional execution (if/else in workflows)
- Loops and iterations
- Sub-workflows (nested workflows)
- Workflow templates
- Visual workflow designer (web UI)
- Workflow marketplace

---

**Document Version**: 1.0.0
**Author**: AutomatosX Development Team
**Last Updated**: 2025-11-10
**Status**: 📋 **READY FOR IMPLEMENTATION**
