# AutomatosX v2.1 - Days 2-5 Megathinking Implementation Plan

**Date**: 2025-11-11
**Author**: Claude (Megathinking Analysis)
**Status**: Planning Phase
**Target**: Complete v2.1 ReScript integration with 530+ passing tests

---

## Executive Summary

This document provides a comprehensive implementation plan for Days 2-5 of AutomatosX v2.1, building on the Day 1 foundation of ReScript WorkflowStateMachine and WorkflowTypes. The goal is to refactor the existing TypeScript workflow engine to use the ReScript state machine, integrate agent system with workflows, and achieve 530+ passing tests.

**Day 1 Achievements (Complete)**:
- ✅ ReScript WorkflowStateMachine (700+ lines): State machine with guards, transitions, context
- ✅ ReScript WorkflowTypes (560+ lines): Type-safe workflow definitions, steps, dependency graphs
- ✅ TypeScript WorkflowStateMachineBridge (450+ lines): Clean API for TS-ReScript interop
- ✅ Comprehensive serialization/deserialization for checkpoints

**Remaining Work (Days 2-5)**:
- Day 2: Refactor WorkflowEngine to use ReScript state machine
- Day 3: Integrate agents with workflows (@agent directive support)
- Day 4: Enhanced task routing with semantic matching
- Day 5: End-to-end testing, performance benchmarks, documentation

---

## Architecture Analysis

### Current State (Before Refactoring)

**TypeScript WorkflowEngine** (src/services/WorkflowEngine.ts):
- 503 lines of imperative workflow execution
- Manual state tracking (no formal state machine)
- Direct DAO calls for persistence
- Level-by-level parallel execution
- Checkpoint creation after each level
- Simulated step execution (TODO: agent routing)

**Key Pain Points**:
1. **No formal state machine**: State transitions are implicit, making debugging hard
2. **Tight coupling**: WorkflowEngine directly creates checkpoints, logs events
3. **Missing agent integration**: `simulateStepExecution()` placeholder (line 488-501)
4. **Limited retry logic**: No sophisticated backoff strategies
5. **No @agent directive**: Parser doesn't support agent assignments in YAML

**TypeScript WorkflowParser** (src/services/WorkflowParser.ts):
- 395 lines of YAML/JSON parsing
- Dependency graph construction with cycle detection
- Template rendering with `{{variable}}` syntax
- **Missing**: @agent directive parsing for agent selection

**Agent System** (src/agents/):
- AgentBase: Abstract base with execute(), canHandle(), retry logic
- AgentRegistry: Central registry with findBestAgent()
- AgentRuntime: Context construction, provider routing
- TaskRouter: Intent detection with regex patterns
- 23 specialized agents: Backend, Frontend, Security, Quality, etc.

**Key Strength**: Well-structured agent system with capability matching, delegation, monitoring

### Target Architecture (After Refactoring)

```
┌─────────────────────────────────────────────────────────────┐
│                     WorkflowEngine                          │
│  (Orchestrator - uses ReScript state machine)               │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │  ReScript WorkflowStateMachine               │           │
│  │  (Deterministic state transitions)           │           │
│  └──────────────────────────────────────────────┘           │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │  WorkflowStateMachineBridge                  │           │
│  │  (TypeScript API)                            │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  Step Execution
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              WorkflowAgentBridge                            │
│  (Routes steps to agents based on @agent directive)         │
│                                                              │
│  ┌──────────────────┐      ┌─────────────────────┐         │
│  │  TaskRouter      │ ───→ │  AgentRegistry      │         │
│  │  (Semantic match)│      │  (Agent selection)  │         │
│  └──────────────────┘      └─────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   Agent Execution
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    AgentBase                                │
│  (Execute task with retry, timeout, monitoring)             │
│                                                              │
│  ┌──────────────────┐      ┌─────────────────────┐         │
│  │  ProviderRouter  │ ───→ │  AI Provider        │         │
│  │  (Multi-provider)│      │  (Claude/Gemini)    │         │
│  └──────────────────┘      └─────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  Checkpoint & Events
                          ↓
┌─────────────────────────────────────────────────────────────┐
│          CheckpointService + WorkflowDAO                    │
│  (Persistence with ReScript serialization)                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Improvements**:
1. **Deterministic state machine**: All state transitions validated by ReScript
2. **Clean separation**: WorkflowEngine orchestrates, agents execute
3. **Agent integration**: WorkflowAgentBridge routes steps to appropriate agents
4. **Type safety**: ReScript types prevent invalid states
5. **Testability**: Each layer can be tested independently

---

## Day 2: WorkflowEngine Refactoring (8 hours)

### Objectives

1. Refactor WorkflowEngine to use ReScript state machine
2. Update CheckpointService for ReScript serialization
3. Fix broken workflow tests (2 tests currently)
4. Maintain backward compatibility with existing API

### Implementation Plan

#### 2.1 Create New WorkflowEngineV2 (Don't Break Existing)

**File**: `src/services/WorkflowEngineV2.ts` (new file)

**Rationale**: Create new implementation alongside old one to avoid breaking changes during development. Once stable, we can migrate.

**Architecture**:
```typescript
export class WorkflowEngineV2 {
  private dao: WorkflowDAO;
  private parser: WorkflowParser;
  private checkpointService: CheckpointServiceV2; // New version
  private agentBridge: WorkflowAgentBridge; // New component
  private db: Database.Database;
  private cache: WorkflowCache;

  // Core execution using ReScript state machine
  async executeWorkflow(
    workflowDef: WorkflowDefinition,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowResult> {
    // 1. Parse and validate workflow
    const validation = this.parser.validate(workflowDef);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }

    // 2. Create ReScript state machine
    const stepIds = workflowDef.steps.map(s => s.key);
    const machine = WorkflowStateMachineBridge.create(
      randomUUID(),
      workflowDef.name,
      stepIds
    );

    // 3. Transition: Idle -> Start -> Parsing
    let current = machine;
    const startResult = current.transition('start');
    if (!startResult.success) {
      throw new Error(`Failed to start workflow: ${startResult.error}`);
    }
    current = startResult.machine!;

    // 4. Transition: Parsing -> Parse -> Validating
    const parseResult = current.transition('parse');
    if (!parseResult.success) {
      throw new Error(`Failed to parse workflow: ${parseResult.error}`);
    }
    current = parseResult.machine!;

    // 5. Transition: Validating -> Validate -> Executing
    const validateResult = current.transition('validate');
    if (!validateResult.success) {
      throw new Error(`Failed to validate workflow: ${validateResult.error}`);
    }
    current = validateResult.machine!;

    // 6. Execute steps level-by-level
    const graph = this.parser.buildDependencyGraph(workflowDef);
    current = await this.executeStepsWithStateMachine(
      current,
      workflowDef,
      graph,
      options.context || {}
    );

    // 7. Transition to terminal state (completed/failed)
    const finalResult = current.transition('complete');
    if (!finalResult.success) {
      throw new Error(`Failed to complete workflow: ${finalResult.error}`);
    }

    return this.buildWorkflowResult(finalResult.machine!);
  }

  // Execute steps level-by-level with state machine tracking
  private async executeStepsWithStateMachine(
    machine: WorkflowStateMachineBridge,
    workflowDef: WorkflowDefinition,
    graph: DependencyGraph,
    context: WorkflowContext
  ): Promise<WorkflowStateMachineBridge> {
    let current = machine;
    const stepResults: Record<string, unknown> = {};

    for (const level of graph.levels) {
      // Get completed steps to skip
      const completedSteps = current.getCompletedSteps();
      const completedIds = new Set(completedSteps.map(s => s.id));

      const stepsToExecute = level.filter(stepKey => !completedIds.has(stepKey));

      if (stepsToExecute.length === 0) {
        continue; // Skip this level
      }

      // Get step definitions
      const steps = stepsToExecute.map(stepKey =>
        workflowDef.steps.find(s => s.key === stepKey)!
      );

      // Execute steps in parallel
      const results = await Promise.allSettled(
        steps.map(step => this.executeStepWithAgent(step, context, stepResults, current))
      );

      // Process results and update state machine
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const step = steps[i];

        if (result.status === 'fulfilled') {
          const stepResult = result.value;
          stepResults[step.key] = stepResult.result;

          // Update step state in machine
          current = current.updateStep(step.key, (s) => ({
            ...s,
            status: 'completed',
            completedAt: Date.now(),
            result: stepResult.result as Record<string, string>,
          }));
        } else {
          // Step failed
          current = current.updateStep(step.key, (s) => ({
            ...s,
            status: 'failed',
            completedAt: Date.now(),
            error: result.reason,
          }));

          if (!step.optional) {
            // Fail the entire workflow
            const failResult = current.transition({ type: 'fail', error: result.reason });
            return failResult.machine!;
          }
        }
      }

      // Create checkpoint after each level
      await this.checkpointService.createCheckpointFromMachine(current);

      // Transition: Execute -> Execute (continue execution)
      const executeResult = current.transition('execute');
      if (executeResult.success) {
        current = executeResult.machine!;
      }
    }

    return current;
  }

  // Execute single step using WorkflowAgentBridge
  private async executeStepWithAgent(
    step: WorkflowDefinition['steps'][0],
    context: WorkflowContext,
    stepResults: Record<string, unknown>,
    machine: WorkflowStateMachineBridge
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // Mark step as running in machine
      const updatedMachine = machine.updateStep(step.key, (s) => ({
        ...s,
        status: 'running',
        startedAt: Date.now(),
      }));

      // Render prompt with context
      const prompt = this.parser.renderPrompt(step.prompt, { ...context, ...stepResults });

      // Route to agent via WorkflowAgentBridge
      const result = await this.agentBridge.executeStep(step, prompt, context);

      return {
        stepKey: step.key,
        success: true,
        result,
        duration: Date.now() - startTime,
        retries: 0,
      };
    } catch (error) {
      throw error;
    }
  }

  // Build workflow result from final machine state
  private buildWorkflowResult(machine: WorkflowStateMachineBridge): WorkflowResult {
    const ctx = machine.getContext();
    const state = machine.getState();

    return {
      executionId: ctx.workflowId,
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      state: state as WorkflowState,
      context: ctx.variables,
      stepResults: ctx.variables,
      startedAt: ctx.startedAt,
      completedAt: ctx.completedAt,
      durationMs: ctx.completedAt && ctx.startedAt
        ? ctx.completedAt - ctx.startedAt
        : undefined,
    };
  }
}
```

**Lines of Code**: ~400 lines

**Key Changes from WorkflowEngine**:
1. **State machine lifecycle**: Explicit transitions (start -> parse -> validate -> execute -> complete)
2. **Immutable updates**: Each state transition returns new machine instance
3. **Agent integration**: Uses WorkflowAgentBridge instead of simulated execution
4. **Checkpoint from machine**: Serializes ReScript state directly

#### 2.2 Create CheckpointServiceV2

**File**: `src/services/CheckpointServiceV2.ts` (new file)

**Purpose**: Handle ReScript state machine serialization/deserialization

```typescript
export class CheckpointServiceV2 {
  private dao: WorkflowDAO;
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
    this.dao = new WorkflowDAO(this.db);
  }

  /**
   * Create checkpoint from ReScript state machine
   * Serializes machine state and stores in database
   */
  async createCheckpointFromMachine(
    machine: WorkflowStateMachineBridge,
    options: CheckpointOptions = {}
  ): Promise<WorkflowCheckpoint> {
    const ctx = machine.getContext();
    const serialized = machine.serialize();

    // Create checkpoint via DAO
    const checkpoint = this.dao.createCheckpoint({
      executionId: ctx.workflowId,
      state: machine.getState() as WorkflowState,
      context: serialized, // Store serialized ReScript state
      completedSteps: JSON.stringify(
        ctx.steps.filter(s => s.status === 'completed').map(s => s.id)
      ),
      pendingSteps: JSON.stringify(
        ctx.steps.filter(s => s.status === 'pending').map(s => s.id)
      ),
      createdBy: options.createdBy || 'automatic',
      label: options.label,
    });

    return checkpoint;
  }

  /**
   * Restore workflow from checkpoint
   * Deserializes ReScript state machine
   */
  async restoreCheckpointToMachine(
    checkpointId: string
  ): Promise<WorkflowStateMachineBridge> {
    const checkpoint = this.dao.getCheckpointById(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Deserialize ReScript machine from checkpoint
    const machine = WorkflowStateMachineBridge.deserialize(
      checkpoint.context as any // Already serialized ReScript state
    );

    if (!machine) {
      throw new Error(`Failed to deserialize checkpoint: ${checkpointId}`);
    }

    return machine;
  }
}
```

**Lines of Code**: ~100 lines

**Key Changes**:
1. **Direct serialization**: Uses `machine.serialize()` instead of manual JSON
2. **Type safety**: ReScript guarantees valid state on deserialization
3. **Simpler API**: No need to manually track completed/pending steps

#### 2.3 Update Existing Tests

**Files to Update**:
- `src/__tests__/integration/end-to-end-workflows.test.ts` (451 lines)
- `src/__tests__/rescript-core/WorkflowOrchestrator.test.ts` (need to create)

**Test Strategy**:

1. **Keep existing tests running**: Don't break WorkflowEngine tests
2. **Add parallel tests for V2**: Test WorkflowEngineV2 alongside old version
3. **Focus on state machine**: Test all transitions, guards, error handling

**Example Test Structure**:
```typescript
describe('WorkflowEngineV2', () => {
  describe('state machine lifecycle', () => {
    it('should transition through all states for simple workflow', async () => {
      const workflowDef = {
        name: 'test-workflow',
        description: 'Test workflow',
        steps: [
          { key: 'step1', prompt: 'Do task 1', dependencies: [], agent: 'backend' },
          { key: 'step2', prompt: 'Do task 2', dependencies: ['step1'], agent: 'backend' },
        ],
      };

      const engine = new WorkflowEngineV2(db);
      const result = await engine.executeWorkflow(workflowDef);

      expect(result.state).toBe('completed');
      expect(result.stepResults).toHaveProperty('step1');
      expect(result.stepResults).toHaveProperty('step2');
    });

    it('should fail workflow if non-optional step fails', async () => {
      // Test that state machine transitions to 'failed' state
    });

    it('should pause and resume workflow execution', async () => {
      // Test pause/resume transitions
    });
  });

  describe('checkpoint integration', () => {
    it('should create checkpoint after each level', async () => {
      // Test that checkpoints are created with serialized ReScript state
    });

    it('should restore workflow from checkpoint', async () => {
      // Test deserialization and resumption
    });
  });

  describe('agent integration', () => {
    it('should route steps to correct agents', async () => {
      // Test that @agent directive works
    });
  });
});
```

**Expected Test Count**: 25+ tests for WorkflowEngineV2

#### 2.4 Migration Strategy

**Phase 2.1** (Hours 1-3): Build WorkflowEngineV2
- Create new file with ReScript state machine integration
- Implement core execution loop
- Add state transition logic

**Phase 2.2** (Hours 4-5): Update CheckpointService
- Create CheckpointServiceV2 with ReScript serialization
- Test checkpoint creation/restoration
- Ensure backward compatibility

**Phase 2.3** (Hours 6-7): Write Tests
- Add WorkflowEngineV2 tests
- Test all state transitions
- Test checkpoint serialization
- Test error handling

**Phase 2.4** (Hour 8): Integration & Debugging
- Fix failing tests
- Performance profiling
- Documentation updates

### Success Criteria for Day 2

✅ **WorkflowEngineV2 created** with ReScript state machine
✅ **CheckpointServiceV2 created** with serialization support
✅ **25+ tests passing** for new workflow engine
✅ **No breaking changes** to existing WorkflowEngine
✅ **Documentation updated** with new architecture

### Risk Mitigation

**Risk 1**: ReScript serialization format incompatible with database
- **Mitigation**: Store as JSONB in PostgreSQL, or JSON string in SQLite
- **Test**: Serialize/deserialize roundtrip test

**Risk 2**: State transitions fail for complex workflows
- **Mitigation**: Add extensive guard testing, validate all edge cases
- **Test**: Test workflows with 10+ steps, parallel execution, failures

**Risk 3**: Performance regression from state machine overhead
- **Mitigation**: Profile with 100-step workflow, optimize if needed
- **Test**: Benchmark against old WorkflowEngine

---

## Day 3: Agent Integration (@agent Directive) (8 hours)

### Objectives

1. Add @agent directive parsing to WorkflowParser
2. Create WorkflowAgentBridge to route steps to agents
3. Integrate TaskRouter for semantic matching
4. Write integration tests for agent workflows

### Implementation Plan

#### 3.1 Enhance WorkflowParser with @agent Support

**File**: `src/services/WorkflowParser.ts` (modify existing)

**Changes**:

```typescript
// Update step interface to include agent field
export interface WorkflowStep {
  key: string;
  prompt: string;
  dependencies: string[];
  agent?: string; // NEW: @agent directive
  optional?: boolean;
  timeout?: number;
  retries?: number;
}

// Add agent directive parsing in parseYAML/parseJSON
parseYAML(yamlString: string): WorkflowDefinition {
  try {
    const parsed = yaml.load(yamlString);

    // Validate and extract @agent directives
    if (parsed.steps) {
      for (const step of parsed.steps) {
        if (step.agent) {
          // Validate agent name format
          if (!step.agent.startsWith('@')) {
            throw new WorkflowParseError(
              `Agent directive must start with '@': ${step.agent}`
            );
          }

          // Strip '@' prefix and store normalized name
          step.agent = step.agent.substring(1);
        }
      }
    }

    return validateWorkflowDefinition(parsed);
  } catch (error) {
    // ... error handling
  }
}

// Add agent validation to validate()
validate(workflow: WorkflowDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // ... existing validations

  // Validate agent references
  const validAgents = new Set([
    'backend', 'frontend', 'security', 'quality', 'devops',
    'architecture', 'data', 'product', 'database', 'api',
    'performance', 'mobile', 'infrastructure', 'testing',
    'cto', 'ceo', 'writer', 'researcher', 'standards'
  ]);

  for (const step of workflow.steps) {
    if (step.agent && !validAgents.has(step.agent)) {
      errors.push(`Step "${step.key}" references invalid agent: "${step.agent}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

**Lines of Code**: ~50 lines added to existing file

**Example YAML with @agent**:
```yaml
name: authentication-feature
description: Implement user authentication feature
steps:
  - key: plan
    agent: @product
    prompt: Create PRD for authentication feature
    dependencies: []

  - key: design
    agent: @architecture
    prompt: Design authentication architecture
    dependencies: [plan]

  - key: implement_backend
    agent: @backend
    prompt: Implement authentication API
    dependencies: [design]

  - key: implement_frontend
    agent: @frontend
    prompt: Build login UI
    dependencies: [design]

  - key: security_audit
    agent: @security
    prompt: Audit authentication implementation
    dependencies: [implement_backend, implement_frontend]

  - key: write_tests
    agent: @quality
    prompt: Write E2E tests for authentication
    dependencies: [security_audit]
```

#### 3.2 Create WorkflowAgentBridge

**File**: `src/bridge/WorkflowAgentBridge.ts` (new file)

**Purpose**: Route workflow steps to appropriate agents

```typescript
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { AgentRuntime } from '../agents/AgentRuntime.js';
import { TaskRouter } from '../agents/TaskRouter.js';
import { Task, TaskResult, AgentType } from '../types/agents.types.js';
import { WorkflowDefinition } from '../types/schemas/workflow.schema.js';

export interface StepExecutionResult {
  stepKey: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  agentUsed: AgentType;
}

/**
 * WorkflowAgentBridge - Routes workflow steps to agents
 *
 * Strategy:
 * 1. If step has @agent directive, use that agent explicitly
 * 2. If no @agent, use TaskRouter for semantic matching
 * 3. If no agent found, fail with clear error message
 */
export class WorkflowAgentBridge {
  private registry: AgentRegistry;
  private runtime: AgentRuntime;
  private router: TaskRouter;

  constructor(
    registry: AgentRegistry,
    runtime: AgentRuntime,
    router: TaskRouter
  ) {
    this.registry = registry;
    this.runtime = runtime;
    this.router = router;
  }

  /**
   * Execute a workflow step using appropriate agent
   *
   * @param step - Workflow step definition
   * @param prompt - Rendered prompt with context
   * @param context - Workflow context
   * @returns Step execution result
   */
  async executeStep(
    step: WorkflowDefinition['steps'][0],
    prompt: string,
    context: Record<string, unknown>
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Determine agent to use
      const agentType = await this.selectAgent(step, prompt);

      if (!agentType) {
        throw new Error(
          `No suitable agent found for step "${step.key}". ` +
          `Consider adding @agent directive or improving task description.`
        );
      }

      // 2. Get agent from registry
      const agent = this.registry.get(agentType);

      if (!agent) {
        throw new Error(`Agent not registered: ${agentType}`);
      }

      // 3. Create task for agent
      const task: Task = {
        id: step.key,
        description: prompt,
        priority: 'medium',
        status: 'pending',
        createdAt: Date.now(),
        context,
        assignedAgent: agentType,
      };

      // 4. Execute task with agent runtime
      const result = await this.runtime.executeTask(task, {
        timeout: step.timeout,
        maxRetries: step.retries || 3,
      });

      return {
        stepKey: step.key,
        success: result.success,
        result: result.data,
        duration: Date.now() - startTime,
        agentUsed: agentType,
      };
    } catch (error) {
      return {
        stepKey: step.key,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        agentUsed: 'unknown' as AgentType,
      };
    }
  }

  /**
   * Select agent for step execution
   *
   * Priority:
   * 1. Explicit @agent directive
   * 2. Semantic matching via TaskRouter
   * 3. Capability-based matching via AgentRegistry
   */
  private async selectAgent(
    step: WorkflowDefinition['steps'][0],
    prompt: string
  ): Promise<AgentType | null> {
    // 1. Check for explicit @agent directive
    if (step.agent) {
      const agentType = step.agent as AgentType;
      if (this.registry.has(agentType)) {
        return agentType;
      } else {
        throw new Error(
          `Step "${step.key}" specifies agent "${step.agent}" but it's not registered`
        );
      }
    }

    // 2. Use TaskRouter for semantic matching
    const task: Task = {
      id: step.key,
      description: prompt,
      priority: 'medium',
      status: 'pending',
      createdAt: Date.now(),
    };

    const agent = this.router.routeToAgent(task);

    if (agent) {
      return agent.getMetadata().type;
    }

    // 3. Fallback to registry capability matching
    const bestAgent = this.registry.findBestAgent(task);

    if (bestAgent) {
      return bestAgent.getMetadata().type;
    }

    return null;
  }

  /**
   * Get routing confidence for a step
   * Useful for debugging why a step was routed to a specific agent
   */
  getRoutingConfidence(step: WorkflowDefinition['steps'][0], prompt: string): {
    agent: AgentType | null;
    confidence: number;
    reason: string;
  } {
    // Explicit directive has 100% confidence
    if (step.agent) {
      return {
        agent: step.agent as AgentType,
        confidence: 1.0,
        reason: 'Explicit @agent directive',
      };
    }

    // Semantic matching
    const task: Task = {
      id: step.key,
      description: prompt,
      priority: 'medium',
      status: 'pending',
      createdAt: Date.now(),
    };

    const confidence = this.router.getRoutingConfidence(task);
    const agent = this.router.routeToAgent(task);

    return {
      agent: agent?.getMetadata().type || null,
      confidence,
      reason: confidence > 0.7 ? 'High semantic match' : 'Low semantic match',
    };
  }

  /**
   * Validate that all workflow steps can be routed to agents
   * Call this during workflow validation phase
   */
  async validateWorkflowAgents(workflow: WorkflowDefinition): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const step of workflow.steps) {
      // Check explicit agent
      if (step.agent) {
        const agentType = step.agent as AgentType;
        if (!this.registry.has(agentType)) {
          errors.push(
            `Step "${step.key}" references unregistered agent: ${step.agent}`
          );
        }
      } else {
        // Check if semantic matching will work
        const task: Task = {
          id: step.key,
          description: step.prompt,
          priority: 'medium',
          status: 'pending',
          createdAt: Date.now(),
        };

        const confidence = this.router.getRoutingConfidence(task);

        if (confidence < 0.3) {
          warnings.push(
            `Step "${step.key}" has low routing confidence (${confidence.toFixed(2)}). ` +
            `Consider adding @agent directive.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

**Lines of Code**: ~250 lines

**Key Features**:
1. **Three-tier routing**: Explicit directive → Semantic matching → Capability matching
2. **Validation**: Pre-flight check that all steps can be routed
3. **Confidence scoring**: Debug why routing happened
4. **Error messages**: Clear feedback on routing failures

#### 3.3 Integration Tests

**File**: `src/__tests__/integration/workflow-agent-integration.test.ts` (new file)

```typescript
describe('Workflow Agent Integration', () => {
  describe('explicit @agent directive', () => {
    it('should route step to explicitly specified agent', async () => {
      const workflowDef = {
        name: 'test-workflow',
        description: 'Test explicit agent routing',
        steps: [
          {
            key: 'step1',
            prompt: 'Do backend work',
            dependencies: [],
            agent: '@backend'
          },
        ],
      };

      const engine = new WorkflowEngineV2(db, registry, runtime);
      const result = await engine.executeWorkflow(workflowDef);

      expect(result.state).toBe('completed');
      // Verify that backend agent was used
    });

    it('should fail if agent not registered', async () => {
      const workflowDef = {
        name: 'test-workflow',
        steps: [
          {
            key: 'step1',
            prompt: 'Do work',
            dependencies: [],
            agent: '@nonexistent'
          },
        ],
      };

      await expect(engine.executeWorkflow(workflowDef)).rejects.toThrow(
        'not registered'
      );
    });
  });

  describe('semantic agent routing', () => {
    it('should route backend tasks to backend agent', async () => {
      const workflowDef = {
        name: 'test-workflow',
        steps: [
          {
            key: 'step1',
            prompt: 'Create REST API with Node.js and PostgreSQL',
            dependencies: []
            // No @agent directive - should auto-route to backend
          },
        ],
      };

      const result = await engine.executeWorkflow(workflowDef);

      expect(result.state).toBe('completed');
      // Verify backend agent was selected
    });

    it('should route security tasks to security agent', async () => {
      // Test security routing
    });

    it('should route UI tasks to frontend agent', async () => {
      // Test frontend routing
    });
  });

  describe('complex multi-agent workflows', () => {
    it('should execute multi-step workflow with different agents', async () => {
      const workflowDef = {
        name: 'feature-implementation',
        steps: [
          { key: 'plan', agent: '@product', prompt: 'Create PRD', dependencies: [] },
          { key: 'design', agent: '@architecture', prompt: 'Design system', dependencies: ['plan'] },
          { key: 'backend', agent: '@backend', prompt: 'Implement API', dependencies: ['design'] },
          { key: 'frontend', agent: '@frontend', prompt: 'Build UI', dependencies: ['design'] },
          { key: 'test', agent: '@quality', prompt: 'Test feature', dependencies: ['backend', 'frontend'] },
        ],
      };

      const result = await engine.executeWorkflow(workflowDef);

      expect(result.state).toBe('completed');
      expect(result.stepResults).toHaveProperty('plan');
      expect(result.stepResults).toHaveProperty('design');
      expect(result.stepResults).toHaveProperty('backend');
      expect(result.stepResults).toHaveProperty('frontend');
      expect(result.stepResults).toHaveProperty('test');
    });
  });

  describe('agent validation', () => {
    it('should validate workflow before execution', async () => {
      const bridge = new WorkflowAgentBridge(registry, runtime, router);

      const validation = await bridge.validateWorkflowAgents(workflowDef);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should warn about low-confidence routing', async () => {
      const workflowDef = {
        name: 'ambiguous-workflow',
        steps: [
          { key: 'step1', prompt: 'Do something', dependencies: [] },
        ],
      };

      const validation = await bridge.validateWorkflowAgents(workflowDef);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });
});
```

**Expected Test Count**: 20+ tests

#### 3.4 Day 3 Implementation Timeline

**Phase 3.1** (Hours 1-2): Update WorkflowParser
- Add @agent directive parsing
- Add validation for agent names
- Update schemas

**Phase 3.2** (Hours 3-5): Build WorkflowAgentBridge
- Implement routing logic
- Add validation methods
- Add confidence scoring

**Phase 3.3** (Hours 6-7): Integration with WorkflowEngineV2
- Connect WorkflowAgentBridge to engine
- Update step execution to use agents
- Test end-to-end workflows

**Phase 3.4** (Hour 8): Testing & Documentation
- Write integration tests
- Document @agent directive syntax
- Create example workflows

### Success Criteria for Day 3

✅ **@agent directive parsing** working in WorkflowParser
✅ **WorkflowAgentBridge created** with 3-tier routing
✅ **20+ integration tests passing**
✅ **Multi-agent workflow example** working end-to-end
✅ **Documentation** for @agent directive

### Risk Mitigation

**Risk 1**: Agent not available when step executes
- **Mitigation**: Validate all agents at workflow start, pre-flight check
- **Test**: Test with unregistered agent

**Risk 2**: Semantic routing picks wrong agent
- **Mitigation**: Add confidence threshold, log routing decisions
- **Test**: Test ambiguous task descriptions

**Risk 3**: Agent execution failures break workflow
- **Mitigation**: Proper error handling, retry logic in AgentBase
- **Test**: Test with failing agent

---

## Day 4: Enhanced Task Routing & Documentation (8 hours)

### Objectives

1. Enhance TaskRouter with semantic similarity (beyond regex)
2. Add workflow execution tracing and debugging tools
3. Create comprehensive documentation
4. Write example workflows for common patterns

### Implementation Plan

#### 4.1 Enhance TaskRouter with Semantic Similarity

**File**: `src/agents/TaskRouter.ts` (modify existing)

**Current Limitation**: TaskRouter uses regex patterns for intent detection. This is brittle and doesn't handle semantic variations well.

**Enhancement**: Add semantic similarity scoring using embedding-based matching

```typescript
import { EmbeddingService } from '../services/EmbeddingService.js';

export class TaskRouterV2 extends TaskRouter {
  private embeddingService: EmbeddingService;
  private agentDescriptionEmbeddings: Map<AgentType, Float32Array> = new Map();

  constructor(registry: AgentRegistry, embeddingService: EmbeddingService) {
    super(registry);
    this.embeddingService = embeddingService;
    this.initializeAgentEmbeddings();
  }

  /**
   * Pre-compute embeddings for all agent descriptions
   * This allows fast semantic matching during routing
   */
  private async initializeAgentEmbeddings(): Promise<void> {
    const agents = this.registry.getAll();

    for (const agent of agents) {
      const metadata = agent.getMetadata();

      // Create description text from metadata
      const description = `
        ${metadata.name}: ${metadata.description}
        Specializations: ${metadata.specializations.join(', ')}
        Capabilities: ${metadata.capabilities.map(c => c.description).join(', ')}
      `;

      const embedding = await this.embeddingService.embed(description);
      this.agentDescriptionEmbeddings.set(metadata.type, embedding);
    }
  }

  /**
   * Route task using hybrid approach: regex + semantic similarity
   */
  async routeToAgentSemantic(task: Task): Promise<AgentBase | null> {
    // 1. Get regex-based routing (existing logic)
    const regexAgent = this.routeToAgent(task); // Call parent method
    const regexScore = regexAgent ? this.getRoutingConfidence(task) : 0;

    // 2. Get semantic similarity routing
    const taskEmbedding = await this.embeddingService.embed(task.description);

    let bestSemanticAgent: AgentBase | null = null;
    let bestSemanticScore = 0;

    for (const [agentType, agentEmbedding] of this.agentDescriptionEmbeddings) {
      const similarity = this.cosineSimilarity(taskEmbedding, agentEmbedding);

      if (similarity > bestSemanticScore) {
        bestSemanticScore = similarity;
        bestSemanticAgent = this.registry.get(agentType) || null;
      }
    }

    // 3. Hybrid scoring: weighted combination
    const regexWeight = 0.4;
    const semanticWeight = 0.6;

    const regexFinalScore = regexAgent ? regexScore * regexWeight : 0;
    const semanticFinalScore = bestSemanticAgent ? bestSemanticScore * semanticWeight : 0;

    // Return agent with highest combined score
    if (regexFinalScore > semanticFinalScore) {
      return regexAgent;
    } else if (bestSemanticAgent) {
      return bestSemanticAgent;
    }

    return null;
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Explain routing decision for debugging
   */
  explainRouting(task: Task): {
    selectedAgent: AgentType | null;
    regexMatch: { agent: AgentType | null; score: number };
    semanticMatch: { agent: AgentType | null; score: number };
    finalScore: number;
  } {
    // ... implementation that shows why routing happened
  }
}
```

**Lines of Code**: ~150 lines

**Benefits**:
1. **Handles variations**: "Create API" vs "Build REST endpoint" both match backend
2. **Less brittle**: No need to maintain extensive regex patterns
3. **Explainable**: Can show similarity scores for debugging

#### 4.2 Add Workflow Execution Tracing

**File**: `src/monitoring/WorkflowTracer.ts` (new file)

**Purpose**: Trace workflow execution for debugging and optimization

```typescript
export interface WorkflowTrace {
  workflowId: string;
  workflowName: string;
  startedAt: number;
  completedAt?: number;
  state: WorkflowState;
  steps: StepTrace[];
  transitions: TransitionTrace[];
  checkpoints: CheckpointTrace[];
}

export interface StepTrace {
  stepKey: string;
  agentUsed: AgentType;
  startedAt: number;
  completedAt?: number;
  duration: number;
  status: 'completed' | 'failed' | 'skipped';
  retries: number;
  error?: string;
}

export interface TransitionTrace {
  from: WorkflowState;
  event: string;
  to: WorkflowState;
  timestamp: number;
  success: boolean;
  error?: string;
}

export class WorkflowTracer {
  private traces: Map<string, WorkflowTrace> = new Map();

  startWorkflow(workflowId: string, workflowName: string): void {
    this.traces.set(workflowId, {
      workflowId,
      workflowName,
      startedAt: Date.now(),
      state: 'idle',
      steps: [],
      transitions: [],
      checkpoints: [],
    });
  }

  recordTransition(
    workflowId: string,
    from: WorkflowState,
    event: string,
    to: WorkflowState,
    success: boolean,
    error?: string
  ): void {
    const trace = this.traces.get(workflowId);
    if (!trace) return;

    trace.transitions.push({
      from,
      event,
      to,
      timestamp: Date.now(),
      success,
      error,
    });

    trace.state = to;
  }

  recordStep(workflowId: string, step: StepTrace): void {
    const trace = this.traces.get(workflowId);
    if (!trace) return;

    trace.steps.push(step);
  }

  getTrace(workflowId: string): WorkflowTrace | undefined {
    return this.traces.get(workflowId);
  }

  // Export trace for analysis
  exportTrace(workflowId: string): string {
    const trace = this.traces.get(workflowId);
    if (!trace) return '';

    return JSON.stringify(trace, null, 2);
  }

  // Analyze workflow performance
  analyzePerformance(workflowId: string): {
    totalDuration: number;
    stepDurations: Record<string, number>;
    slowestSteps: Array<{ step: string; duration: number }>;
    failureRate: number;
    averageRetries: number;
  } {
    // ... analysis implementation
  }
}
```

**Lines of Code**: ~200 lines

#### 4.3 Documentation

**Files to Create/Update**:

1. **Workflow System Guide** (`docs/workflow-system.md`)
2. **Agent Integration Guide** (`docs/agent-integration.md`)
3. **@agent Directive Reference** (`docs/agent-directive.md`)
4. **Example Workflows** (`examples/workflows/`)

**Example Workflow Templates**:

```yaml
# examples/workflows/feature-development.yaml
name: feature-development-workflow
description: |
  End-to-end workflow for implementing a new feature:
  Planning → Design → Implementation → Testing → Documentation

steps:
  - key: create_prd
    agent: @product
    prompt: |
      Create a Product Requirements Document for: {{feature_name}}

      Include:
      - User stories
      - Acceptance criteria
      - Success metrics
    dependencies: []

  - key: design_architecture
    agent: @architecture
    prompt: |
      Design system architecture for feature based on:
      {{create_prd.result}}

      Include:
      - Component diagram
      - Data flow
      - API contracts
    dependencies: [create_prd]

  - key: implement_backend
    agent: @backend
    prompt: |
      Implement backend services based on:
      {{design_architecture.result}}

      Use TypeScript and PostgreSQL
    dependencies: [design_architecture]
    timeout: 600000  # 10 minutes
    retries: 3

  - key: implement_frontend
    agent: @frontend
    prompt: |
      Build UI components based on:
      {{design_architecture.result}}

      Use React and Material-UI
    dependencies: [design_architecture]

  - key: security_review
    agent: @security
    prompt: |
      Review implementation for security issues:
      - Backend: {{implement_backend.result}}
      - Frontend: {{implement_frontend.result}}
    dependencies: [implement_backend, implement_frontend]

  - key: write_tests
    agent: @quality
    prompt: |
      Write comprehensive tests for the feature
    dependencies: [security_review]

  - key: deploy
    agent: @devops
    prompt: |
      Deploy feature to staging environment
    dependencies: [write_tests]
```

**Documentation Structure**:
```
docs/
├── workflow-system.md         # Overview of workflow system
├── agent-integration.md        # How agents work with workflows
├── agent-directive.md          # @agent directive reference
├── state-machine.md            # ReScript state machine internals
└── troubleshooting.md          # Common issues and solutions

examples/workflows/
├── feature-development.yaml
├── code-review.yaml
├── incident-response.yaml
├── data-pipeline.yaml
└── multi-environment-deploy.yaml
```

#### 4.4 Day 4 Implementation Timeline

**Phase 4.1** (Hours 1-3): Enhance TaskRouter
- Add semantic similarity matching
- Pre-compute agent embeddings
- Test hybrid routing

**Phase 4.2** (Hours 4-5): Add Workflow Tracing
- Build WorkflowTracer
- Integrate with WorkflowEngineV2
- Add performance analysis

**Phase 4.3** (Hours 6-8): Documentation & Examples
- Write workflow system guide
- Create example workflows
- Document @agent directive
- Add troubleshooting guide

### Success Criteria for Day 4

✅ **Semantic routing implemented** in TaskRouterV2
✅ **WorkflowTracer created** with performance analysis
✅ **5+ example workflows** created and tested
✅ **Comprehensive documentation** written
✅ **Troubleshooting guide** published

---

## Day 5: E2E Testing, Performance, Final Integration (8 hours)

### Objectives

1. Write comprehensive E2E tests for all workflows
2. Performance benchmarks and optimization
3. Final integration of all components
4. Achieve 530+ tests passing

### Implementation Plan

#### 5.1 End-to-End Test Suite

**File**: `src/__tests__/e2e/complete-workflow-system.test.ts` (new file)

**Test Categories**:

1. **Simple Workflows** (5 tests)
   - Single-step workflow
   - Linear multi-step workflow
   - Parallel execution

2. **Complex Workflows** (10 tests)
   - 10+ step workflows
   - Mixed parallel/sequential
   - Multiple agent types

3. **Error Handling** (15 tests)
   - Step failures
   - Agent unavailable
   - Timeout scenarios
   - Invalid state transitions
   - Checkpoint corruption

4. **Agent Integration** (20 tests)
   - Explicit @agent routing
   - Semantic routing
   - Fallback routing
   - All 23 agent types

5. **State Machine** (15 tests)
   - All state transitions
   - Guard validation
   - Context updates
   - Serialization/deserialization

6. **Performance** (10 tests)
   - 100-step workflow
   - Concurrent workflows
   - Checkpoint overhead
   - Agent selection speed

**Example E2E Test**:
```typescript
describe('E2E: Complete Feature Development Workflow', () => {
  it('should execute full feature workflow with 6 agents', async () => {
    // Load workflow from YAML
    const workflowPath = path.join(__dirname, '../../../examples/workflows/feature-development.yaml');

    const engine = new WorkflowEngineV2(db, registry, runtime);
    const result = await engine.executeWorkflowFromFile(workflowPath, {
      context: {
        feature_name: 'User Authentication',
      },
    });

    // Verify successful completion
    expect(result.state).toBe('completed');

    // Verify all steps executed
    expect(result.stepResults).toHaveProperty('create_prd');
    expect(result.stepResults).toHaveProperty('design_architecture');
    expect(result.stepResults).toHaveProperty('implement_backend');
    expect(result.stepResults).toHaveProperty('implement_frontend');
    expect(result.stepResults).toHaveProperty('security_review');
    expect(result.stepResults).toHaveProperty('write_tests');
    expect(result.stepResults).toHaveProperty('deploy');

    // Verify agent assignment
    const trace = tracer.getTrace(result.executionId);
    expect(trace.steps.find(s => s.stepKey === 'create_prd')?.agentUsed).toBe('product');
    expect(trace.steps.find(s => s.stepKey === 'implement_backend')?.agentUsed).toBe('backend');

    // Verify workflow completed in reasonable time (< 60s)
    expect(result.durationMs).toBeLessThan(60000);
  });

  it('should handle failure and create recovery checkpoint', async () => {
    // Test failure scenario with checkpoint recovery
  });

  it('should support pause/resume across checkpoints', async () => {
    // Test pause/resume functionality
  });
});
```

**Expected Test Count**: 75+ E2E tests

#### 5.2 Performance Benchmarks

**File**: `src/__tests__/performance/workflow-benchmarks.test.ts` (new file)

**Benchmarks**:

1. **State Machine Overhead**
   - Measure transition time: < 1ms per transition
   - Measure serialization time: < 10ms for 100-step workflow

2. **Agent Routing**
   - Semantic similarity: < 50ms per routing decision
   - Regex matching: < 5ms per routing decision

3. **Workflow Execution**
   - 10-step workflow: < 10s
   - 100-step workflow: < 120s
   - 1000-step workflow: < 20 minutes

4. **Checkpoint Performance**
   - Create checkpoint: < 100ms
   - Restore checkpoint: < 200ms
   - Prune old checkpoints: < 500ms for 10k checkpoints

**Example Benchmark**:
```typescript
describe('Performance: Workflow Execution', () => {
  it('should execute 100-step workflow in under 2 minutes', async () => {
    const steps = Array.from({ length: 100 }, (_, i) => ({
      key: `step${i}`,
      prompt: `Execute task ${i}`,
      dependencies: i > 0 ? [`step${i-1}`] : [],
      agent: '@backend',
    }));

    const workflowDef = {
      name: 'large-workflow',
      description: '100-step sequential workflow',
      steps,
    };

    const startTime = Date.now();
    const result = await engine.executeWorkflow(workflowDef);
    const duration = Date.now() - startTime;

    expect(result.state).toBe('completed');
    expect(duration).toBeLessThan(120000); // < 2 minutes
  });

  it('should handle 10 concurrent workflows', async () => {
    const workflows = Array.from({ length: 10 }, (_, i) =>
      engine.executeWorkflow({
        name: `workflow-${i}`,
        steps: [
          { key: 'step1', prompt: 'Do work', dependencies: [], agent: '@backend' },
        ],
      })
    );

    const startTime = Date.now();
    const results = await Promise.all(workflows);
    const duration = Date.now() - startTime;

    expect(results.every(r => r.state === 'completed')).toBe(true);
    expect(duration).toBeLessThan(30000); // < 30 seconds for all
  });
});
```

#### 5.3 Final Integration & Test Count

**Goal**: 530+ tests passing

**Current Baseline**: 165 tests passing

**New Tests Needed**: 365+ tests

**Test Breakdown**:
- Day 2: 25 tests (WorkflowEngineV2, CheckpointServiceV2)
- Day 3: 20 tests (Agent integration, @agent directive)
- Day 4: 15 tests (TaskRouterV2, semantic routing)
- Day 5: 75 tests (E2E workflows)
- Day 5: 20 tests (Performance benchmarks)
- Existing agent tests: 200+ tests (already implemented)
- Existing integration tests: 10 tests (update and expand)

**Total**: 165 (baseline) + 365 (new) = 530 tests

#### 5.4 Day 5 Implementation Timeline

**Phase 5.1** (Hours 1-4): E2E Test Suite
- Write 75+ E2E tests
- Test all workflow scenarios
- Test error handling
- Test checkpoint recovery

**Phase 5.2** (Hours 5-6): Performance Benchmarks
- Write 20+ performance tests
- Profile critical paths
- Optimize slow operations
- Document performance targets

**Phase 5.3** (Hours 7-8): Final Integration
- Run full test suite
- Fix failing tests
- Update documentation
- Create release notes

### Success Criteria for Day 5

✅ **75+ E2E tests written** and passing
✅ **20+ performance benchmarks** implemented
✅ **530+ total tests passing**
✅ **All documentation updated**
✅ **Release notes created** for v2.1

---

## Risk Assessment & Mitigation

### High-Risk Areas

#### Risk 1: ReScript-TypeScript Bridge Complexity

**Impact**: Medium
**Likelihood**: Medium
**Mitigation**:
- Day 1 bridge already working well (450 lines proven)
- Follow same patterns for new bridges
- Comprehensive integration tests
- Document bridge patterns

#### Risk 2: State Machine State Explosion

**Impact**: Low
**Likelihood**: Low
**Mitigation**:
- ReScript state machine already handles 8 states cleanly
- Guards prevent invalid transitions
- Serialize/deserialize tested extensively

#### Risk 3: Agent Routing Failures

**Impact**: Medium
**Likelihood**: Low
**Mitigation**:
- Three-tier routing (explicit → semantic → capability)
- Pre-flight validation before execution
- Clear error messages
- Confidence scoring for debugging

#### Risk 4: Performance Regression

**Impact**: Low
**Likelihood**: Low
**Mitigation**:
- Benchmark against baseline
- Profile critical paths
- Optimize hot paths if needed
- State machine transitions are O(1)

#### Risk 5: Test Coverage Gaps

**Impact**: Medium
**Likelihood**: Low
**Mitigation**:
- Systematic test planning (this document)
- E2E tests for all workflows
- Edge case coverage
- Performance tests

---

## Test Strategy & Coverage

### Test Pyramid

```
        /\
       /  \
      / E2E \          75 tests (Day 5)
     /-------\
    /         \
   / Integration\     55 tests (Days 2-4)
  /-------------\
 /               \
/  Unit Tests     \   200 tests (Agents, existing)
-------------------
    165 existing
```

**Total**: 530 tests

### Coverage Targets

- **ReScript state machine**: 100% (all transitions tested)
- **WorkflowEngineV2**: 90%+ (all execution paths)
- **WorkflowAgentBridge**: 95%+ (all routing scenarios)
- **Agent system**: 85%+ (already implemented)
- **Integration**: 80%+ (E2E scenarios)

### Test Execution Strategy

1. **Parallel execution**: Run unit tests in parallel (< 30s)
2. **Sequential E2E**: Run E2E tests sequentially (< 5 minutes)
3. **Performance tests**: Run separately in CI (< 10 minutes)
4. **Total CI time**: < 15 minutes

---

## Code Change Summary

### Files to Create (New)

1. `src/services/WorkflowEngineV2.ts` (400 lines)
2. `src/services/CheckpointServiceV2.ts` (100 lines)
3. `src/bridge/WorkflowAgentBridge.ts` (250 lines)
4. `src/agents/TaskRouterV2.ts` (150 lines)
5. `src/monitoring/WorkflowTracer.ts` (200 lines)
6. `src/__tests__/integration/workflow-agent-integration.test.ts` (500 lines)
7. `src/__tests__/e2e/complete-workflow-system.test.ts` (800 lines)
8. `src/__tests__/performance/workflow-benchmarks.test.ts` (300 lines)
9. `docs/workflow-system.md` (1000 lines)
10. `docs/agent-integration.md` (800 lines)
11. `examples/workflows/*.yaml` (5 files, 500 lines total)

**Total New Code**: ~5,000 lines

### Files to Modify (Existing)

1. `src/services/WorkflowParser.ts` (+50 lines for @agent directive)
2. `src/agents/TaskRouter.ts` (minimal changes for base class)
3. `src/__tests__/integration/end-to-end-workflows.test.ts` (+100 lines)

**Total Modified Code**: ~150 lines

### Files to Keep (No Changes)

- All 23 agent implementations (BackendAgent.ts, etc.)
- AgentBase.ts
- AgentRegistry.ts
- AgentRuntime.ts
- WorkflowDAO.ts
- ReScript state machine (Day 1 complete)

---

## Daily Success Metrics

### Day 2 Metrics

- ✅ WorkflowEngineV2 created (400 LOC)
- ✅ CheckpointServiceV2 created (100 LOC)
- ✅ 25+ tests passing
- ✅ 0 breaking changes to existing API

### Day 3 Metrics

- ✅ @agent directive parsing (50 LOC)
- ✅ WorkflowAgentBridge created (250 LOC)
- ✅ 20+ integration tests passing
- ✅ Multi-agent workflow working

### Day 4 Metrics

- ✅ TaskRouterV2 with semantic routing (150 LOC)
- ✅ WorkflowTracer created (200 LOC)
- ✅ 5+ example workflows
- ✅ Documentation complete

### Day 5 Metrics

- ✅ 75+ E2E tests passing
- ✅ 20+ performance benchmarks
- ✅ **530+ total tests passing**
- ✅ Release notes published

---

## Integration Points

### ReScript ↔ TypeScript

**Bridge Pattern** (from Day 1):
```typescript
// ReScript: Immutable, type-safe state machine
let machine = WorkflowStateMachine.make(id, name, steps);

// TypeScript: Ergonomic wrapper
const bridge = WorkflowStateMachineBridge.create(id, name, steps);
const result = bridge.transition('start');
```

**Key Learnings from Day 1**:
1. Use `@genType` for automatic type generation
2. Handle Option/Result types with TAG/\_0 pattern
3. Pre-export constructors for easier TS consumption
4. Document bridge API thoroughly

### WorkflowEngine ↔ Agents

**Integration Pattern**:
```typescript
// WorkflowEngine calls WorkflowAgentBridge
const result = await this.agentBridge.executeStep(step, prompt, context);

// WorkflowAgentBridge routes to AgentRuntime
const task = this.createTaskFromStep(step, prompt);
const agentResult = await this.runtime.executeTask(task);

// AgentRuntime executes with appropriate agent
const agent = this.selectAgent(task);
const executionResult = await agent.execute(task, agentContext);
```

### Checkpoint ↔ State Machine

**Serialization Pattern**:
```typescript
// Checkpoint creation
const serialized = machine.serialize(); // ReScript serialization
await this.dao.createCheckpoint({
  executionId,
  state: machine.getState(),
  context: serialized, // Store ReScript state
  ...
});

// Checkpoint restoration
const checkpoint = this.dao.getCheckpointById(checkpointId);
const machine = WorkflowStateMachineBridge.deserialize(checkpoint.context);
```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: "Invalid transition" error

**Symptom**: Workflow fails with "Invalid transition from X with event Y"

**Cause**: Attempting invalid state transition (e.g., resume without pause)

**Solution**:
```typescript
// Check if transition is valid before executing
if (!machine.canTransition('resume')) {
  throw new Error('Cannot resume workflow - not paused');
}

const result = machine.transition('resume');
```

#### Issue 2: "No suitable agent found"

**Symptom**: Workflow fails with "No suitable agent found for step"

**Cause**: No agent matches task, or agent not registered

**Solution**:
```typescript
// 1. Add explicit @agent directive to step
// 2. Or improve task description for better semantic matching
// 3. Or check agent is registered in AgentRegistry

// Validate before execution
const validation = await bridge.validateWorkflowAgents(workflowDef);
if (!validation.valid) {
  console.error(validation.errors);
}
```

#### Issue 3: Checkpoint restoration fails

**Symptom**: "Failed to deserialize checkpoint"

**Cause**: Checkpoint data corrupted or incompatible

**Solution**:
```typescript
// Validate checkpoint before restoration
const validation = await checkpointService.validateCheckpoint(checkpointId);
if (!validation.valid) {
  console.error(validation.errors);
  // Fallback to earlier checkpoint
}
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for completing AutomatosX v2.1 Days 2-5. The approach is:

1. **Incremental**: Each day builds on previous work
2. **Safe**: New implementations don't break existing code
3. **Testable**: Comprehensive test coverage at each step
4. **Documented**: Clear documentation and examples
5. **Measurable**: Specific success criteria for each day

**Key Success Factors**:
- Leverage Day 1 ReScript foundation (already proven)
- Follow bridge patterns that worked well
- Systematic testing at each layer
- Clear separation of concerns (orchestration vs execution)
- Comprehensive error handling

**Expected Outcome**:
- ✅ 530+ tests passing
- ✅ Type-safe workflow orchestration
- ✅ Seamless agent integration
- ✅ Production-ready v2.1 release

---

**Next Steps**: Begin Day 2 implementation with WorkflowEngineV2 refactoring.
