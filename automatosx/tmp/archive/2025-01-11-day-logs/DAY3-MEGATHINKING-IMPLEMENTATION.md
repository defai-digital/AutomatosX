# Day 3 Megathinking: WorkflowAgentBridge & Integration Tests

**AutomatosX v2.1 - Day 3 of 5**

**Date**: 2025-11-11
**Author**: Claude Code
**Status**: Implementation Planning

---

## Executive Summary

Day 3 focuses on completing the workflow-to-agent bridge layer with full 3-tier routing, @agent directive parsing, and comprehensive integration testing. This is the critical integration point between our ReScript workflow state machine (Day 1-2) and the agent system (Phase 7).

**Objectives**:
1. ✅ Full WorkflowAgentBridge implementation with 3-tier routing
2. ✅ @agent directive parsing in WorkflowParser
3. ✅ 25+ integration tests covering all routing tiers
4. ✅ Error handling, retry logic, and fallback strategies

**Expected Output**:
- ~650 lines production code (WorkflowAgentBridge: 400, WorkflowParser: 150, types: 100)
- ~850 lines test code (integration tests: 700, fixtures: 150)
- Target: 190+ tests passing (165 current + 25 new)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [3-Tier Routing Strategy Deep Dive](#2-3-tier-routing-strategy-deep-dive)
3. [Phase 1: WorkflowAgentBridge Implementation](#3-phase-1-workflowagentbridge-implementation)
4. [Phase 2: @agent Directive Parsing](#4-phase-2-agent-directive-parsing)
5. [Phase 3: Integration Tests](#5-phase-3-integration-tests)
6. [Risk Analysis & Mitigation](#6-risk-analysis--mitigation)
7. [Implementation Timeline](#7-implementation-timeline)
8. [Success Metrics](#8-success-metrics)
9. [Example Workflows](#9-example-workflows)

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

**WorkflowAgentBridge (Stub)**:
- Location: `/Users/akiralam/code/automatosx2/src/bridge/WorkflowAgentBridge.ts`
- Current: ~115 lines, stub implementation
- Methods: `executeStep()`, `canExecuteStep()`, `getRecommendedAgent()`
- Status: Returns simulated results, no actual routing

**AgentRegistry**:
- Location: `/Users/akiralam/code/automatosx2/src/agents/AgentRegistry.ts`
- Current: ~303 lines, fully functional
- Methods: `findBestAgent()`, `searchAgents()`, `getAgentsByCapability()`
- Status: ✅ Complete, tested, ready for integration

**TaskRouter**:
- Location: `/Users/akiralam/code/automatosx2/src/agents/TaskRouter.ts`
- Current: ~315 lines, semantic intent detection
- Methods: `parseTask()`, `routeToAgent()`, `getSuggestedAgents()`
- Status: ✅ Complete, has method name issues to fix

**AgentRuntime**:
- Location: `/Users/akiralam/code/automatosx2/src/agents/AgentRuntime.ts`
- Current: ~365 lines, execution engine
- Methods: `executeTask()`, `buildContext()`, `delegateTask()`
- Status: ✅ Complete, needs minor fixes

**WorkflowParser**:
- Location: `/Users/akiralam/code/automatosx2/src/services/WorkflowParser.ts`
- Current: ~395 lines
- Methods: `parseYAML()`, `buildDependencyGraph()`, `validate()`
- Status: Missing @agent directive parsing

**Workflow Schema**:
- Location: `/Users/akiralam/code/automatosx2/src/types/schemas/workflow.schema.ts`
- Current: WorkflowStep has `agent` field (string)
- Status: Schema supports agent name, but no @agent directive concept yet

### 1.2 Key Findings from Code Analysis

**AgentRegistry Issues**:
```typescript
// ISSUE: Method doesn't exist!
const agent = this.registry.getAgent(parsed.mentionedAgent);
// Should be:
const agent = this.registry.get(parsed.mentionedAgent);
```

**TaskRouter Issues**:
```typescript
// ISSUE: Method doesn't exist!
const allAgents = this.registry.listAgents();
// Should be:
const allAgents = this.registry.getAll();
```

**WorkflowStep Schema**:
```typescript
export const WorkflowStepSchema = z.object({
  key: z.string().min(1),
  agent: z.string().min(1), // ✅ Already supports agent name!
  prompt: z.string().min(1),
  dependencies: z.array(z.string()).default([]),
  // ... other fields
});
```

**Critical Insight**: The schema already has an `agent` field! We don't need a separate @agent directive in the YAML. The agent routing strategy becomes:

1. **Tier 1**: Explicit `agent` field in step definition (highest priority)
2. **Tier 2**: Step type inference from step structure (medium priority)
3. **Tier 3**: Semantic matching via TaskRouter on prompt text (fallback)

This is actually **better** than @agent directive because:
- More structured and type-safe
- Validates agent names against registry
- No regex parsing needed
- Clean YAML syntax

---

## 2. 3-Tier Routing Strategy Deep Dive

### 2.1 Tier 1: Explicit Agent Field (90% confidence)

**Strategy**: Step has `agent` field specified in workflow definition.

**Implementation**:
```typescript
// Check if step has explicit agent assignment
if (step.agent) {
  const agent = this.registry.get(step.agent as AgentType);

  if (!agent) {
    // Agent not found - this is a validation error
    throw new Error(`Agent not found in registry: ${step.agent}`);
  }

  return {
    agent,
    tier: 'explicit',
    confidence: 0.95,
    reason: `Explicit agent assignment: ${step.agent}`
  };
}
```

**Validation Strategy**:
- Validate in `WorkflowParser.validate()`
- Check all step agents exist in registry
- Fail fast during parse phase, not execution

**Example YAML**:
```yaml
name: "Backend API Development"
steps:
  - key: design-api
    agent: backend  # ✅ Explicit assignment
    prompt: "Design REST API for user management"

  - key: review-security
    agent: security  # ✅ Explicit assignment
    prompt: "Review API for security vulnerabilities"
```

**Edge Cases**:
- Agent name typo → Validation error
- Agent not in registry → Validation error
- Invalid agent type → Zod validation error

### 2.2 Tier 2: Step Type Matching (70% confidence)

**Strategy**: Infer agent from step structure and keywords in step metadata.

**Step Type Detection**:
```typescript
interface StepTypeHints {
  hasApiKeywords: boolean;
  hasDatabaseKeywords: boolean;
  hasSecurityKeywords: boolean;
  hasUIKeywords: boolean;
  hasTestKeywords: boolean;
  hasDeploymentKeywords: boolean;
}

function detectStepType(step: WorkflowStep): StepTypeHints {
  const promptLower = step.prompt.toLowerCase();

  return {
    hasApiKeywords: /\b(api|rest|graphql|endpoint|route)\b/i.test(promptLower),
    hasDatabaseKeywords: /\b(database|sql|schema|query|table)\b/i.test(promptLower),
    hasSecurityKeywords: /\b(security|auth|vulnerability|encrypt)\b/i.test(promptLower),
    hasUIKeywords: /\b(ui|interface|component|frontend|react)\b/i.test(promptLower),
    hasTestKeywords: /\b(test|testing|coverage|qa|quality)\b/i.test(promptLower),
    hasDeploymentKeywords: /\b(deploy|ci\/cd|docker|kubernetes)\b/i.test(promptLower),
  };
}
```

**Agent Mapping**:
```typescript
function inferAgentFromStepType(hints: StepTypeHints): AgentType | null {
  // Priority-based matching
  if (hints.hasSecurityKeywords) return 'security';  // Security always high priority
  if (hints.hasApiKeywords && hints.hasDatabaseKeywords) return 'backend';
  if (hints.hasApiKeywords) return 'api';
  if (hints.hasDatabaseKeywords) return 'database';
  if (hints.hasUIKeywords) return 'frontend';
  if (hints.hasTestKeywords) return 'quality';
  if (hints.hasDeploymentKeywords) return 'devops';

  return null; // Fall through to Tier 3
}
```

**Confidence Scoring**:
```typescript
function calculateTier2Confidence(hints: StepTypeHints): number {
  const matchCount = Object.values(hints).filter(Boolean).length;

  if (matchCount === 0) return 0.0;
  if (matchCount === 1) return 0.6;
  if (matchCount === 2) return 0.75;
  return 0.8;  // Multiple matches = high confidence
}
```

**Example**:
```yaml
steps:
  - key: api-design
    # No agent field - uses Tier 2
    prompt: "Design REST API endpoints for user management"
    # → Detects: hasApiKeywords = true
    # → Routes to: 'api' or 'backend' agent
    # → Confidence: 0.6
```

### 2.3 Tier 3: Semantic Matching via TaskRouter (50% confidence)

**Strategy**: Use TaskRouter to parse natural language and route to agent.

**Implementation**:
```typescript
// Convert WorkflowStep to Task for TaskRouter
function stepToTask(step: WorkflowStep, context: WorkflowContext): Task {
  return {
    id: step.key,
    description: step.prompt,
    priority: 'medium',
    status: 'pending',
    context: context,
    createdAt: Date.now(),
  };
}

// Use TaskRouter for semantic routing
const task = stepToTask(step, context);
const agent = this.taskRouter.routeToAgent(task);

if (!agent) {
  throw new Error(`No suitable agent found for step: ${step.key}`);
}

return {
  agent,
  tier: 'semantic',
  confidence: this.taskRouter.getRoutingConfidence(task),
  reason: 'Semantic matching via TaskRouter'
};
```

**TaskRouter Integration**:
- Uses intent detection patterns
- Keyword extraction
- Confidence scoring based on keyword density

**Example**:
```yaml
steps:
  - key: implement-feature
    # No agent field - uses Tier 3
    prompt: "Implement user authentication with JWT tokens and refresh logic"
    # → TaskRouter detects: intent = 'backend-dev'
    # → Routes to: 'backend' agent
    # → Confidence: 0.65 (based on keyword matches)
```

### 2.4 Routing Decision Flow

```
Step arrives for execution
        ↓
┌─────────────────────┐
│ Has agent field?    │
└─────────────────────┘
        ↓ Yes (90% of cases)
┌─────────────────────┐
│ TIER 1: Explicit    │  Confidence: 0.95
│ Get agent from      │  Validation: Pre-execution
│ registry by name    │  Fallback: None (fail fast)
└─────────────────────┘
        ↓ Found → Execute
        ↓ Not Found → Error

        ↓ No (10% of cases)
┌─────────────────────┐
│ TIER 2: Step Type   │  Confidence: 0.6-0.8
│ Detect keywords in  │  Validation: Pattern matching
│ prompt, infer agent │  Fallback: Tier 3
└─────────────────────┘
        ↓ Match → Execute
        ↓ No Match → Tier 3

        ↓ No Match (2% of cases)
┌─────────────────────┐
│ TIER 3: Semantic    │  Confidence: 0.5-0.7
│ TaskRouter intent   │  Validation: ML-based
│ detection & routing │  Fallback: Error
└─────────────────────┘
        ↓ Match → Execute
        ↓ No Match → Error
```

---

## 3. Phase 1: WorkflowAgentBridge Implementation

### 3.1 Enhanced Interface Design

```typescript
/**
 * Agent selection result with metadata
 */
export interface AgentSelectionResult {
  agent: AgentBase;
  tier: 'explicit' | 'step-type' | 'semantic';
  confidence: number;
  reason: string;
  fallbackAttempts?: number;
}

/**
 * Step execution result (enhanced)
 */
export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  duration: number;
  agentUsed: string;
  tier: 'explicit' | 'step-type' | 'semantic';
  confidence: number;
  retries: number;
  fallbackUsed: boolean;
}

/**
 * Bridge configuration
 */
export interface WorkflowAgentBridgeConfig {
  registry: AgentRegistry;
  runtime: AgentRuntime;
  taskRouter: TaskRouter;
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  enableFallback: boolean;
  minimumConfidence: number;  // Reject routing if confidence < threshold
}
```

### 3.2 Core Implementation

```typescript
/**
 * WorkflowAgentBridge - Route workflow steps to agents
 *
 * 3-Tier Routing Strategy:
 * 1. Explicit agent assignment (step.agent field)
 * 2. Step type matching (keyword detection)
 * 3. Semantic matching (TaskRouter)
 */
export class WorkflowAgentBridge {
  private db: Database.Database;
  private registry: AgentRegistry;
  private runtime: AgentRuntime;
  private taskRouter: TaskRouter;
  private config: WorkflowAgentBridgeConfig;

  constructor(
    db?: Database.Database,
    registry?: AgentRegistry,
    runtime?: AgentRuntime,
    config?: Partial<WorkflowAgentBridgeConfig>
  ) {
    this.db = db || getDatabase();

    // Initialize agent infrastructure if not provided
    if (!registry || !runtime) {
      const {
        registry: initRegistry,
        runtime: initRuntime,
        taskRouter: initTaskRouter
      } = this.initializeAgentInfrastructure();

      this.registry = registry || initRegistry;
      this.runtime = runtime || initRuntime;
      this.taskRouter = initTaskRouter;
    } else {
      this.registry = registry;
      this.runtime = runtime;
      this.taskRouter = new TaskRouter(registry);
    }

    this.config = {
      registry: this.registry,
      runtime: this.runtime,
      taskRouter: this.taskRouter,
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      retryBackoffMultiplier: config?.retryBackoffMultiplier ?? 2.0,
      enableFallback: config?.enableFallback ?? true,
      minimumConfidence: config?.minimumConfidence ?? 0.3,
    };
  }

  /**
   * Initialize agent infrastructure (lazy loading)
   */
  private initializeAgentInfrastructure(): {
    registry: AgentRegistry;
    runtime: AgentRuntime;
    taskRouter: TaskRouter;
  } {
    const registry = new AgentRegistry();

    // Register all available agents
    // Import and instantiate agents
    import('../agents/BackendAgent.js').then(m => {
      registry.register(new m.BackendAgent());
    });
    import('../agents/FrontendAgent.js').then(m => {
      registry.register(new m.FrontendAgent());
    });
    // ... register other agents

    registry.markInitialized();

    // Create task router
    const taskRouter = new TaskRouter(registry);

    // Create runtime with mock dependencies for now
    // (In production, these would be injected from WorkflowEngineV2)
    const runtime = new AgentRuntime(
      registry,
      {} as any, // MemoryService - TODO: inject from WorkflowEngineV2
      {} as any, // FileService - TODO: inject from WorkflowEngineV2
      {
        claude: {} as any,
        gemini: {} as any,
        openai: {} as any,
      },
      {
        metrics: {} as any,
        logger: {} as any,
        tracer: {} as any,
      }
    );

    return { registry, runtime, taskRouter };
  }

  /**
   * Execute a workflow step with 3-tier routing
   */
  async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Select agent using 3-tier routing
      const selection = await this.selectAgent(step, context);

      // 2. Validate confidence threshold
      if (selection.confidence < this.config.minimumConfidence) {
        throw new Error(
          `Agent selection confidence ${selection.confidence.toFixed(2)} ` +
          `below minimum threshold ${this.config.minimumConfidence}`
        );
      }

      // 3. Build task from step
      const task = this.stepToTask(step, context);

      // 4. Execute with retry logic
      const result = await this.executeWithRetry(
        task,
        selection.agent,
        step,
        context
      );

      // 5. Return execution result
      return {
        stepId: step.key,
        success: result.success,
        output: result.data as Record<string, unknown>,
        duration: Date.now() - startTime,
        agentUsed: selection.agent.getMetadata().type,
        tier: selection.tier,
        confidence: selection.confidence,
        retries: result.metadata?.retries || 0,
        fallbackUsed: result.metadata?.fallbackUsed || false,
      };
    } catch (error) {
      return {
        stepId: step.key,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        agentUsed: 'none',
        tier: 'explicit',
        confidence: 0,
        retries: 0,
        fallbackUsed: false,
      };
    }
  }

  /**
   * Select agent using 3-tier routing strategy
   */
  private async selectAgent(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<AgentSelectionResult> {
    // TIER 1: Explicit agent assignment
    if (step.agent) {
      const agent = this.registry.get(step.agent as AgentType);

      if (!agent) {
        // Validation should catch this, but handle gracefully
        throw new Error(`Agent not found in registry: ${step.agent}`);
      }

      return {
        agent,
        tier: 'explicit',
        confidence: 0.95,
        reason: `Explicit agent assignment: ${step.agent}`,
      };
    }

    // TIER 2: Step type matching
    const stepTypeResult = this.tryStepTypeMatching(step);
    if (stepTypeResult) {
      return stepTypeResult;
    }

    // TIER 3: Semantic matching via TaskRouter
    const semanticResult = this.trySemanticMatching(step, context);
    if (semanticResult) {
      return semanticResult;
    }

    // No agent found - fail
    throw new Error(
      `Failed to select agent for step "${step.key}". ` +
      `Consider adding explicit agent assignment.`
    );
  }

  /**
   * Try step type matching (Tier 2)
   */
  private tryStepTypeMatching(step: WorkflowStep): AgentSelectionResult | null {
    const hints = this.detectStepType(step);
    const agentType = this.inferAgentFromStepType(hints);

    if (!agentType) {
      return null;
    }

    const agent = this.registry.get(agentType);
    if (!agent) {
      return null;
    }

    const confidence = this.calculateTier2Confidence(hints);

    return {
      agent,
      tier: 'step-type',
      confidence,
      reason: `Step type matching: detected ${agentType} keywords`,
    };
  }

  /**
   * Try semantic matching (Tier 3)
   */
  private trySemanticMatching(
    step: WorkflowStep,
    context: WorkflowContext
  ): AgentSelectionResult | null {
    const task = this.stepToTask(step, context);
    const agent = this.taskRouter.routeToAgent(task);

    if (!agent) {
      return null;
    }

    const confidence = this.taskRouter.getRoutingConfidence(task);

    return {
      agent,
      tier: 'semantic',
      confidence,
      reason: 'Semantic matching via TaskRouter intent detection',
    };
  }

  /**
   * Detect step type from keywords
   */
  private detectStepType(step: WorkflowStep): StepTypeHints {
    const promptLower = step.prompt.toLowerCase();

    return {
      hasApiKeywords: /\b(api|rest|graphql|endpoint|route)\b/i.test(promptLower),
      hasDatabaseKeywords: /\b(database|sql|schema|query|table)\b/i.test(promptLower),
      hasSecurityKeywords: /\b(security|auth|vulnerability|encrypt)\b/i.test(promptLower),
      hasUIKeywords: /\b(ui|interface|component|frontend|react)\b/i.test(promptLower),
      hasTestKeywords: /\b(test|testing|coverage|qa|quality)\b/i.test(promptLower),
      hasDeploymentKeywords: /\b(deploy|ci\/cd|docker|kubernetes)\b/i.test(promptLower),
    };
  }

  /**
   * Infer agent type from step hints
   */
  private inferAgentFromStepType(hints: StepTypeHints): AgentType | null {
    // Priority-based matching
    if (hints.hasSecurityKeywords) return 'security';
    if (hints.hasApiKeywords && hints.hasDatabaseKeywords) return 'backend';
    if (hints.hasApiKeywords) return 'api';
    if (hints.hasDatabaseKeywords) return 'database';
    if (hints.hasUIKeywords) return 'frontend';
    if (hints.hasTestKeywords) return 'quality';
    if (hints.hasDeploymentKeywords) return 'devops';

    return null;
  }

  /**
   * Calculate confidence for Tier 2 matching
   */
  private calculateTier2Confidence(hints: StepTypeHints): number {
    const matchCount = Object.values(hints).filter(Boolean).length;

    if (matchCount === 0) return 0.0;
    if (matchCount === 1) return 0.6;
    if (matchCount === 2) return 0.75;
    return 0.8;
  }

  /**
   * Convert workflow step to agent task
   */
  private stepToTask(step: WorkflowStep, context: WorkflowContext): Task {
    return {
      id: step.key,
      description: step.prompt,
      priority: 'medium',
      status: 'pending',
      context: context,
      createdAt: Date.now(),
    };
  }

  /**
   * Execute task with retry logic
   */
  private async executeWithRetry(
    task: Task,
    agent: AgentBase,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<TaskResult> {
    const maxRetries = step.retryPolicy?.maxRetries ?? this.config.maxRetries;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
      try {
        // Execute task with runtime
        const result = await this.runtime.executeTask(task, {
          timeout: step.timeoutMs,
          maxRetries: 1, // Don't double-retry in runtime
        });

        if (result.success) {
          return {
            ...result,
            metadata: {
              ...result.metadata,
              retries: attempt,
              fallbackUsed: false,
            },
          };
        }

        // Task failed but didn't throw - treat as error
        throw new Error(result.message || 'Task failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, step.retryPolicy);
        if (!isRetryable || attempt >= maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(
          this.config.retryBackoffMultiplier,
          attempt - 1
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed - try fallback if enabled
    if (this.config.enableFallback) {
      const fallbackResult = await this.tryFallbackAgent(task, agent, step, context);
      if (fallbackResult) {
        return {
          ...fallbackResult,
          metadata: {
            ...fallbackResult.metadata,
            retries: attempt,
            fallbackUsed: true,
          },
        };
      }
    }

    // No fallback or fallback failed
    return {
      success: false,
      message: `Task failed after ${attempt} attempts: ${lastError?.message}`,
      metadata: {
        retries: attempt,
        fallbackUsed: false,
      },
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown, retryPolicy?: RetryPolicy): boolean {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check retry policy whitelist
    if (retryPolicy?.retryableErrors && retryPolicy.retryableErrors.length > 0) {
      return retryPolicy.retryableErrors.some(pattern =>
        errorMsg.toLowerCase().includes(pattern.toLowerCase())
      );
    }

    // Default retryable errors
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'rate limit',
      'throttle',
      'temporary',
      'unavailable',
    ];

    return retryablePatterns.some(pattern =>
      errorMsg.toLowerCase().includes(pattern)
    );
  }

  /**
   * Try fallback to alternative agent
   */
  private async tryFallbackAgent(
    task: Task,
    primaryAgent: AgentBase,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<TaskResult | null> {
    // Get suggested agents from TaskRouter
    const suggestions = this.taskRouter.getSuggestedAgents(task, 3);

    // Filter out primary agent
    const fallbackAgents = suggestions.filter(
      s => s.agent !== primaryAgent
    );

    if (fallbackAgents.length === 0) {
      return null;
    }

    // Try first fallback agent
    try {
      const result = await this.runtime.executeTask(task, {
        timeout: step.timeoutMs,
        maxRetries: 1,
      });

      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if step can be executed
   */
  canExecuteStep(step: WorkflowStep): boolean {
    try {
      // Try to select an agent
      const selection = this.selectAgent(step, {});
      return selection.confidence >= this.config.minimumConfidence;
    } catch {
      return false;
    }
  }

  /**
   * Get recommended agent for step (for preview/validation)
   */
  getRecommendedAgent(step: WorkflowStep): {
    agentType: string;
    confidence: number;
    tier: string;
  } {
    try {
      const selection = this.selectAgent(step, {});
      return {
        agentType: selection.agent.getMetadata().type,
        confidence: selection.confidence,
        tier: selection.tier,
      };
    } catch {
      return {
        agentType: 'none',
        confidence: 0,
        tier: 'none',
      };
    }
  }
}

// Type definitions
interface StepTypeHints {
  hasApiKeywords: boolean;
  hasDatabaseKeywords: boolean;
  hasSecurityKeywords: boolean;
  hasUIKeywords: boolean;
  hasTestKeywords: boolean;
  hasDeploymentKeywords: boolean;
}
```

**File Size Estimate**: ~400 lines

---

## 4. Phase 2: @agent Directive Parsing

**Decision**: We DON'T need @agent directive! The schema already supports `agent` field.

### 4.1 Enhanced Validation in WorkflowParser

```typescript
/**
 * Enhanced validation with agent registry check
 */
validate(workflow: WorkflowDefinition, registry?: AgentRegistry): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Existing validation ...

  // NEW: Validate agent assignments if registry provided
  if (registry) {
    for (const step of workflow.steps) {
      if (step.agent) {
        const agentExists = registry.has(step.agent as AgentType);

        if (!agentExists) {
          errors.push(
            `Step "${step.key}" assigns non-existent agent: "${step.agent}". ` +
            `Available agents: ${registry.getTypes().join(', ')}`
          );
        }
      } else {
        // No explicit agent - will use Tier 2/3 routing
        warnings.push(
          `Step "${step.key}" has no explicit agent assignment. ` +
          `Will use automatic routing (may be less reliable).`
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
```

### 4.2 Agent Suggestion Helper

```typescript
/**
 * Suggest agents for a step based on prompt analysis
 */
suggestAgents(step: WorkflowStep, registry: AgentRegistry): Array<{
  agentType: AgentType;
  confidence: number;
  reason: string;
}> {
  const suggestions: Array<{
    agentType: AgentType;
    confidence: number;
    reason: string;
  }> = [];

  // Use step type detection
  const hints = this.detectStepType(step);
  const primaryAgent = this.inferAgentFromStepType(hints);

  if (primaryAgent) {
    suggestions.push({
      agentType: primaryAgent,
      confidence: this.calculateTier2Confidence(hints),
      reason: 'Primary match based on keywords',
    });
  }

  // Use TaskRouter for alternatives
  const task = {
    id: step.key,
    description: step.prompt,
    priority: 'medium' as const,
    status: 'pending' as const,
    createdAt: Date.now(),
  };

  const taskRouter = new TaskRouter(registry);
  const alternatives = taskRouter.getSuggestedAgents(task, 3);

  for (const alt of alternatives) {
    if (suggestions.find(s => s.agentType === alt.agent.getMetadata().type)) {
      continue; // Skip duplicates
    }

    suggestions.push({
      agentType: alt.agent.getMetadata().type,
      confidence: alt.confidence,
      reason: 'Alternative suggestion from semantic analysis',
    });
  }

  return suggestions.slice(0, 3); // Top 3 suggestions
}

/**
 * Helper methods (copied from WorkflowAgentBridge for code sharing)
 */
private detectStepType(step: WorkflowStep): StepTypeHints {
  // ... same as WorkflowAgentBridge
}

private inferAgentFromStepType(hints: StepTypeHints): AgentType | null {
  // ... same as WorkflowAgentBridge
}

private calculateTier2Confidence(hints: StepTypeHints): number {
  // ... same as WorkflowAgentBridge
}
```

**File Size Estimate**: +150 lines to WorkflowParser

---

## 5. Phase 3: Integration Tests

### 5.1 Test Structure

```
src/__tests__/bridge/
├── WorkflowAgentBridge.test.ts          (main test suite)
├── WorkflowAgentBridge.routing.test.ts  (routing-specific tests)
├── WorkflowAgentBridge.retry.test.ts    (retry logic tests)
└── fixtures/
    ├── workflows/
    │   ├── explicit-routing.yaml
    │   ├── step-type-routing.yaml
    │   ├── semantic-routing.yaml
    │   ├── multi-agent.yaml
    │   └── error-handling.yaml
    └── expected-results/
        └── ...
```

### 5.2 Core Test Cases (25+ tests)

**Test Suite 1: Tier 1 Routing (Explicit Agent) - 8 tests**

```typescript
describe('WorkflowAgentBridge - Tier 1: Explicit Routing', () => {
  let bridge: WorkflowAgentBridge;
  let registry: AgentRegistry;
  let runtime: AgentRuntime;

  beforeEach(() => {
    registry = createMockRegistry();
    runtime = createMockRuntime(registry);
    bridge = new WorkflowAgentBridge(undefined, registry, runtime);
  });

  it('should route to explicitly assigned agent', async () => {
    const step: WorkflowStep = {
      key: 'design-api',
      agent: 'backend',
      prompt: 'Design REST API',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.success).toBe(true);
    expect(result.agentUsed).toBe('backend');
    expect(result.tier).toBe('explicit');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should throw error if explicit agent not found', async () => {
    const step: WorkflowStep = {
      key: 'design-api',
      agent: 'nonexistent' as any,
      prompt: 'Design REST API',
      dependencies: [],
    };

    await expect(bridge.executeStep(step, {})).rejects.toThrow(
      'Agent not found in registry: nonexistent'
    );
  });

  it('should handle multiple steps with different agents', async () => {
    const steps: WorkflowStep[] = [
      { key: 'step1', agent: 'backend', prompt: 'Backend task', dependencies: [] },
      { key: 'step2', agent: 'frontend', prompt: 'Frontend task', dependencies: [] },
      { key: 'step3', agent: 'security', prompt: 'Security task', dependencies: [] },
    ];

    const results = await Promise.all(
      steps.map(step => bridge.executeStep(step, {}))
    );

    expect(results[0].agentUsed).toBe('backend');
    expect(results[1].agentUsed).toBe('frontend');
    expect(results[2].agentUsed).toBe('security');
    expect(results.every(r => r.tier === 'explicit')).toBe(true);
  });

  it('should preserve context across step executions', async () => {
    const context = { userId: 123, sessionId: 'abc' };
    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Process user data',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, context);

    expect(result.success).toBe(true);
    // Verify context was passed to agent
    // (check via mock spy or result metadata)
  });

  it('should return high confidence for explicit routing', async () => {
    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Any task',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('should execute step even if agent capability score is low', async () => {
    // Explicit assignment overrides capability matching
    const step: WorkflowStep = {
      key: 'ui-task',
      agent: 'backend',  // Wrong agent, but explicit
      prompt: 'Design beautiful UI with animations',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.success).toBe(true);
    expect(result.agentUsed).toBe('backend');
  });

  it('should track execution duration', async () => {
    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Quick task',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan(5000); // Should be fast
  });

  it('should handle agent metadata in result', async () => {
    const step: WorkflowStep = {
      key: 'step1',
      agent: 'security',
      prompt: 'Security audit',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toBe('security');
    expect(result.tier).toBe('explicit');
    expect(result.output).toBeDefined();
  });
});
```

**Test Suite 2: Tier 2 Routing (Step Type) - 7 tests**

```typescript
describe('WorkflowAgentBridge - Tier 2: Step Type Routing', () => {
  let bridge: WorkflowAgentBridge;

  beforeEach(() => {
    const registry = createMockRegistry();
    const runtime = createMockRuntime(registry);
    bridge = new WorkflowAgentBridge(undefined, registry, runtime);
  });

  it('should route API keywords to API agent', async () => {
    const step: WorkflowStep = {
      key: 'api-design',
      prompt: 'Design REST API endpoints for user management',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toMatch(/api|backend/);
    expect(result.tier).toBe('step-type');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should route database keywords to database agent', async () => {
    const step: WorkflowStep = {
      key: 'db-schema',
      prompt: 'Create database schema for user table with indexes',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toMatch(/database|backend/);
    expect(result.tier).toBe('step-type');
  });

  it('should route security keywords to security agent', async () => {
    const step: WorkflowStep = {
      key: 'security-review',
      prompt: 'Review authentication flow for vulnerabilities',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toBe('security');
    expect(result.tier).toBe('step-type');
  });

  it('should route UI keywords to frontend agent', async () => {
    const step: WorkflowStep = {
      key: 'ui-component',
      prompt: 'Build React component for user profile interface',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toBe('frontend');
    expect(result.tier).toBe('step-type');
  });

  it('should route test keywords to quality agent', async () => {
    const step: WorkflowStep = {
      key: 'write-tests',
      prompt: 'Write unit tests with 80% coverage for API endpoints',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toMatch(/quality|testing/);
    expect(result.tier).toBe('step-type');
  });

  it('should route deployment keywords to devops agent', async () => {
    const step: WorkflowStep = {
      key: 'setup-cicd',
      prompt: 'Configure CI/CD pipeline with Docker and Kubernetes',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toBe('devops');
    expect(result.tier).toBe('step-type');
  });

  it('should increase confidence with multiple matching keywords', async () => {
    const step: WorkflowStep = {
      key: 'backend-task',
      prompt: 'Design REST API with PostgreSQL database schema and authentication',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.tier).toBe('step-type');
    expect(result.confidence).toBeGreaterThan(0.7); // Multiple keywords
  });
});
```

**Test Suite 3: Tier 3 Routing (Semantic) - 5 tests**

```typescript
describe('WorkflowAgentBridge - Tier 3: Semantic Routing', () => {
  let bridge: WorkflowAgentBridge;

  beforeEach(() => {
    const registry = createMockRegistry();
    const runtime = createMockRuntime(registry);
    bridge = new WorkflowAgentBridge(undefined, registry, runtime);
  });

  it('should fall back to semantic routing when no keywords match', async () => {
    const step: WorkflowStep = {
      key: 'vague-task',
      prompt: 'Implement user authentication with JWT tokens',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.success).toBe(true);
    expect(result.tier).toBe('semantic');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('should use TaskRouter for intent detection', async () => {
    const step: WorkflowStep = {
      key: 'ml-task',
      prompt: 'Train machine learning model for user recommendations',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toMatch(/datascience|data/);
    expect(result.tier).toBe('semantic');
  });

  it('should handle natural language task descriptions', async () => {
    const step: WorkflowStep = {
      key: 'natural-task',
      prompt: 'Make the login page look professional and modern',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.agentUsed).toBe('frontend');
    expect(result.tier).toBe('semantic');
  });

  it('should return lower confidence for semantic routing', async () => {
    const step: WorkflowStep = {
      key: 'ambiguous-task',
      prompt: 'Improve system performance',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.tier).toBe('semantic');
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('should throw error if no agent matches', async () => {
    const step: WorkflowStep = {
      key: 'impossible-task',
      prompt: 'Solve quantum gravity equations',
      dependencies: [],
    };

    await expect(bridge.executeStep(step, {})).rejects.toThrow(
      'Failed to select agent'
    );
  });
});
```

**Test Suite 4: Retry Logic - 5 tests**

```typescript
describe('WorkflowAgentBridge - Retry Logic', () => {
  let bridge: WorkflowAgentBridge;
  let mockRuntime: jest.Mocked<AgentRuntime>;

  beforeEach(() => {
    const registry = createMockRegistry();
    mockRuntime = createMockRuntime(registry);
    bridge = new WorkflowAgentBridge(
      undefined,
      registry,
      mockRuntime,
      { maxRetries: 3, retryDelayMs: 10 }
    );
  });

  it('should retry on timeout error', async () => {
    mockRuntime.executeTask
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ success: true, message: 'Success' });

    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Task',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.success).toBe(true);
    expect(result.retries).toBe(2);
    expect(mockRuntime.executeTask).toHaveBeenCalledTimes(3);
  });

  it('should respect maxRetries configuration', async () => {
    mockRuntime.executeTask.mockRejectedValue(new Error('Always fail'));

    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Task',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.success).toBe(false);
    expect(mockRuntime.executeTask).toHaveBeenCalledTimes(3); // maxRetries = 3
  });

  it('should use exponential backoff', async () => {
    const delays: number[] = [];
    mockRuntime.executeTask.mockImplementation(async () => {
      const start = Date.now();
      delays.push(start);
      throw new Error('timeout');
    });

    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Task',
      dependencies: [],
      retryPolicy: { maxRetries: 3, retryDelayMs: 100, retryBackoffMultiplier: 2 },
    };

    await bridge.executeStep(step, {});

    // Check delays increase exponentially
    expect(delays[1] - delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[2] - delays[1]).toBeGreaterThanOrEqual(200);
  });

  it('should only retry retryable errors', async () => {
    mockRuntime.executeTask.mockRejectedValue(new Error('validation error'));

    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Task',
      dependencies: [],
      retryPolicy: {
        maxRetries: 3,
        retryableErrors: ['timeout', 'network'],
      },
    };

    const result = await bridge.executeStep(step, {});

    expect(result.success).toBe(false);
    expect(mockRuntime.executeTask).toHaveBeenCalledTimes(1); // No retry
  });

  it('should include retry count in result', async () => {
    mockRuntime.executeTask
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ success: true, message: 'Success' });

    const step: WorkflowStep = {
      key: 'step1',
      agent: 'backend',
      prompt: 'Task',
      dependencies: [],
    };

    const result = await bridge.executeStep(step, {});

    expect(result.retries).toBe(1);
    expect(result.success).toBe(true);
  });
});
```

### 5.3 Test Fixtures

**explicit-routing.yaml**:
```yaml
name: "Explicit Agent Routing Test"
version: "1.0.0"
description: "Test workflow with explicit agent assignments"
steps:
  - key: backend-task
    agent: backend
    prompt: "Implement user registration API endpoint"
    dependencies: []

  - key: frontend-task
    agent: frontend
    prompt: "Build registration form component"
    dependencies: [backend-task]

  - key: security-review
    agent: security
    prompt: "Review registration flow for security issues"
    dependencies: [backend-task, frontend-task]

  - key: qa-tests
    agent: quality
    prompt: "Write integration tests for registration"
    dependencies: [security-review]
```

**step-type-routing.yaml**:
```yaml
name: "Step Type Routing Test"
version: "1.0.0"
description: "Test workflow with implicit routing via keywords"
steps:
  - key: api-design
    # No agent field - should route to API/backend agent
    prompt: "Design REST API endpoints for product catalog"
    dependencies: []

  - key: database-schema
    # Should route to database agent
    prompt: "Create PostgreSQL schema for products table with indexes"
    dependencies: []

  - key: ui-components
    # Should route to frontend agent
    prompt: "Build React components for product listing interface"
    dependencies: [api-design]
```

**File Size Estimate**: ~700 lines tests + ~150 lines fixtures = 850 lines total

---

## 6. Risk Analysis & Mitigation

### 6.1 Critical Risks

**Risk 1: Agent Registry Method Name Mismatch**
- **Issue**: TaskRouter calls `registry.getAgent()` and `registry.listAgents()` which don't exist
- **Impact**: Runtime errors in Tier 3 routing
- **Mitigation**: Fix TaskRouter to use `registry.get()` and `registry.getAll()`
- **Priority**: HIGH (blocks testing)

**Risk 2: Circular Dependencies**
- **Issue**: WorkflowAgentBridge needs AgentRuntime which needs services which might need WorkflowEngine
- **Impact**: Module loading failures
- **Mitigation**: Use dependency injection, lazy loading, optional parameters
- **Priority**: MEDIUM (can work around)

**Risk 3: Missing Mock Infrastructure**
- **Issue**: Tests need mock MemoryService, FileService, providers for AgentRuntime
- **Impact**: Cannot run integration tests
- **Mitigation**: Create comprehensive mock factory functions
- **Priority**: HIGH (blocks testing)

**Risk 4: Tier 2/3 Routing Accuracy**
- **Issue**: Keyword matching may route to wrong agent
- **Impact**: Tasks executed by suboptimal agents, poor results
- **Mitigation**:
  - Extensive testing with real-world prompts
  - Lower confidence thresholds allow fallback
  - Document routing behavior, recommend explicit agents
- **Priority**: MEDIUM (UX issue, not blocker)

**Risk 5: Retry Logic Complexity**
- **Issue**: Complex retry state machine with exponential backoff
- **Impact**: Bugs in retry logic, infinite loops, resource exhaustion
- **Mitigation**:
  - Cap max retries at reasonable limit (3-5)
  - Cap max delay at 10 seconds
  - Comprehensive retry tests
- **Priority**: MEDIUM (correctness issue)

### 6.2 Mitigation Plan

**Immediate Actions** (before coding):
1. Fix TaskRouter method names
2. Create mock factory functions for tests
3. Design dependency injection pattern for WorkflowAgentBridge

**During Implementation**:
1. Write tests first (TDD approach)
2. Test each tier independently before integration
3. Add extensive logging for debugging
4. Include confidence thresholds in config

**Post-Implementation**:
1. Run full test suite (target: 190+ tests)
2. Manual testing with real workflow YAML files
3. Performance profiling (ensure <100ms routing overhead)
4. Documentation with routing examples

---

## 7. Implementation Timeline

### Hour 1-2: WorkflowAgentBridge Core (Phase 1.1)
- ✅ Fix TaskRouter method names
- ✅ Implement agent selection (Tier 1-3)
- ✅ Implement executeStep() method
- ✅ Add error handling
- **Output**: ~200 lines core logic

### Hour 3: WorkflowAgentBridge Retry Logic (Phase 1.2)
- ✅ Implement executeWithRetry()
- ✅ Add exponential backoff
- ✅ Add retryable error detection
- ✅ Add fallback agent logic
- **Output**: ~150 lines retry logic

### Hour 4: WorkflowAgentBridge Integration (Phase 1.3)
- ✅ Add helper methods (stepToTask, detectStepType, etc.)
- ✅ Create configuration interface
- ✅ Add initialization logic
- ✅ Add public methods (canExecuteStep, getRecommendedAgent)
- **Output**: ~150 lines helpers + config

### Hour 5: WorkflowParser Enhancement (Phase 2)
- ✅ Add agent validation in validate()
- ✅ Add suggestAgents() method
- ✅ Add step type detection helpers
- **Output**: ~150 lines parser enhancements

### Hour 6-7: Integration Tests - Core (Phase 3.1)
- ✅ Create test infrastructure (mocks, fixtures)
- ✅ Write Tier 1 routing tests (8 tests)
- ✅ Write Tier 2 routing tests (7 tests)
- **Output**: ~400 lines tests

### Hour 7-8: Integration Tests - Advanced (Phase 3.2)
- ✅ Write Tier 3 routing tests (5 tests)
- ✅ Write retry logic tests (5 tests)
- ✅ Write error handling tests
- ✅ Create YAML fixtures
- **Output**: ~450 lines tests + fixtures

**Total Time**: 8 hours
**Total Code**: ~650 lines production + ~850 lines tests = 1,500 lines

---

## 8. Success Metrics

### 8.1 Code Quality Metrics

**Production Code**:
- ✅ 650+ lines production code
- ✅ 100% TypeScript type coverage
- ✅ Zero `any` types (except in unavoidable cases)
- ✅ ESLint compliant
- ✅ Zod validation for all external inputs

**Test Coverage**:
- ✅ 25+ integration tests
- ✅ 85%+ code coverage (lines)
- ✅ 90%+ branch coverage
- ✅ All routing tiers tested independently
- ✅ Error paths tested

**Test Pass Rate**:
- ✅ 190+ tests passing (165 current + 25 new)
- ✅ 100% pass rate
- ✅ No flaky tests
- ✅ Tests run in <10 seconds

### 8.2 Functional Metrics

**Routing Accuracy**:
- ✅ Tier 1 (Explicit): 100% accuracy (by definition)
- ✅ Tier 2 (Step Type): 85%+ accuracy on test prompts
- ✅ Tier 3 (Semantic): 70%+ accuracy on test prompts
- ✅ Overall: 90%+ correct agent selection

**Performance**:
- ✅ Agent selection: <10ms per step
- ✅ Step execution: <500ms average (mock agents)
- ✅ Retry overhead: <50ms per retry
- ✅ Memory usage: <50MB for bridge instance

**Reliability**:
- ✅ Retry success rate: 80%+ for transient errors
- ✅ Fallback success rate: 60%+ when primary fails
- ✅ Error handling: All errors caught and logged
- ✅ No unhandled promise rejections

### 8.3 Integration Metrics

**WorkflowEngineV2 Integration**:
- ✅ WorkflowEngineV2 can execute steps via bridge
- ✅ Context properly passed to agents
- ✅ Step results properly returned to engine
- ✅ Errors properly propagated to engine

**Agent System Integration**:
- ✅ AgentRegistry properly queried
- ✅ AgentRuntime properly invoked
- ✅ TaskRouter properly utilized
- ✅ Agent context properly constructed

---

## 9. Example Workflows

### 9.1 Multi-Agent Software Development Workflow

```yaml
name: "Full-Stack Feature Implementation"
version: "1.0.0"
description: "Complete workflow for implementing a new feature"
author: "AutomatosX"

config:
  timeout: 1800000  # 30 minutes
  parallelism: 3
  continueOnError: false

steps:
  # Phase 1: Design (Sequential)
  - key: requirements-analysis
    agent: product
    prompt: |
      Analyze requirements for user profile management feature:
      - Users can view/edit their profile
      - Profile includes: name, email, avatar, bio
      - Privacy settings: public/private profile
      Create detailed user stories and acceptance criteria.
    dependencies: []

  - key: architecture-design
    agent: architecture
    prompt: |
      Design system architecture for user profile feature:
      - API endpoints needed
      - Database schema changes
      - Frontend components
      - Integration points
      Reference: {{requirements-analysis.result}}
    dependencies: [requirements-analysis]

  # Phase 2: Implementation (Parallel)
  - key: database-schema
    agent: database
    prompt: |
      Implement database schema for user profiles:
      {{architecture-design.database_schema}}
      Include migrations and indexes.
    dependencies: [architecture-design]
    parallel: true

  - key: backend-api
    agent: backend
    prompt: |
      Implement REST API endpoints:
      {{architecture-design.api_spec}}
      Include:
      - GET /api/profile/:userId
      - PUT /api/profile/:userId
      - POST /api/profile/:userId/avatar
    dependencies: [architecture-design]
    parallel: true

  - key: frontend-components
    agent: frontend
    prompt: |
      Implement React components:
      - ProfileView component
      - ProfileEdit component
      - AvatarUpload component
      Use design system from {{architecture-design.design_system}}
    dependencies: [architecture-design]
    parallel: true

  # Phase 3: Quality & Security (Parallel)
  - key: security-review
    agent: security
    prompt: |
      Conduct security review:
      - API authentication/authorization
      - Input validation
      - File upload security (avatar)
      - Privacy controls
      Review code: {{backend-api.code}} and {{frontend-components.code}}
    dependencies: [backend-api, frontend-components]
    parallel: true

  - key: unit-tests
    agent: quality
    prompt: |
      Write comprehensive unit tests:
      - Backend API tests (80% coverage minimum)
      - Frontend component tests
      - Database migration tests
      Reference implementations: {{backend-api.code}}, {{frontend-components.code}}
    dependencies: [backend-api, frontend-components]
    parallel: true

  - key: integration-tests
    agent: quality
    prompt: |
      Write integration tests:
      - End-to-end user profile flow
      - API + Database integration
      - Frontend + API integration
      Test scenarios from {{requirements-analysis.acceptance_criteria}}
    dependencies: [unit-tests]

  # Phase 4: Deployment
  - key: deployment-config
    agent: devops
    prompt: |
      Configure deployment:
      - Update CI/CD pipeline
      - Database migration strategy
      - Feature flags for gradual rollout
      - Monitoring and alerts
    dependencies: [security-review, integration-tests]

  # Phase 5: Documentation
  - key: api-documentation
    agent: writer
    prompt: |
      Write API documentation:
      - Endpoint specifications
      - Request/response examples
      - Error codes
      - Authentication requirements
      Based on: {{backend-api.api_spec}}
    dependencies: [backend-api]
    parallel: true

  - key: user-documentation
    agent: writer
    prompt: |
      Write user-facing documentation:
      - How to update profile
      - Privacy settings guide
      - Avatar upload instructions
      - Screenshots and examples
    dependencies: [frontend-components]
    parallel: true
```

**Expected Execution**:
1. **Phase 1** (Sequential): Product → Architecture (2 steps, ~5 min)
2. **Phase 2** (Parallel): Database + Backend + Frontend (3 steps, ~8 min)
3. **Phase 3** (Parallel): Security + Unit Tests → Integration (3 steps, ~6 min)
4. **Phase 4** (Sequential): DevOps (1 step, ~3 min)
5. **Phase 5** (Parallel): API Docs + User Docs (2 steps, ~4 min)

**Total**: 11 steps, ~26 minutes, 7 agents used

### 9.2 Security Audit Workflow (Implicit Routing)

```yaml
name: "Security Audit Pipeline"
version: "1.0.0"
description: "Automated security audit using implicit agent routing"

steps:
  - key: code-scan
    # No agent - should route to 'security' (Tier 2: hasSecurityKeywords)
    prompt: "Scan codebase for security vulnerabilities using static analysis"
    dependencies: []

  - key: dependency-audit
    # Should route to 'security' (Tier 2)
    prompt: "Audit npm dependencies for known vulnerabilities and outdated packages"
    dependencies: []
    parallel: true

  - key: api-security-test
    # Should route to 'security' (Tier 2: API + security)
    prompt: "Test API endpoints for common security issues: SQL injection, XSS, CSRF"
    dependencies: []
    parallel: true

  - key: auth-review
    # Should route to 'security' (Tier 2)
    prompt: "Review authentication and authorization implementation for weaknesses"
    dependencies: []
    parallel: true

  - key: generate-report
    # Should route to 'writer' or 'security' (Tier 3: semantic)
    prompt: |
      Generate comprehensive security audit report including:
      - Summary of findings from: {{code-scan}}, {{dependency-audit}}, {{api-security-test}}, {{auth-review}}
      - Severity ratings (Critical, High, Medium, Low)
      - Remediation recommendations
      - Timeline for fixes
    dependencies: [code-scan, dependency-audit, api-security-test, auth-review]
```

**Expected Routing**:
- code-scan → security (Tier 2, confidence: 0.7)
- dependency-audit → security (Tier 2, confidence: 0.7)
- api-security-test → security (Tier 2, confidence: 0.8)
- auth-review → security (Tier 2, confidence: 0.8)
- generate-report → writer or security (Tier 3, confidence: 0.6)

### 9.3 Mixed Routing Workflow

```yaml
name: "Microservice Development"
version: "1.0.0"
description: "Mix of explicit and implicit routing"

steps:
  # Explicit routing for critical steps
  - key: architecture
    agent: architecture
    prompt: "Design microservices architecture for order processing system"
    dependencies: []

  # Implicit routing for implementation
  - key: implement-services
    # Should route to 'backend' (Tier 2: microservice keywords)
    prompt: "Implement microservices for order processing, payment, and inventory"
    dependencies: [architecture]

  - key: setup-messaging
    # Should route to 'infrastructure' or 'devops' (Tier 2/3)
    prompt: "Setup RabbitMQ for inter-service communication with dead-letter queues"
    dependencies: [implement-services]

  # Explicit routing for quality
  - key: load-testing
    agent: performance
    prompt: "Conduct load testing: 1000 concurrent orders, 95th percentile <200ms"
    dependencies: [implement-services, setup-messaging]

  # Explicit routing for deployment
  - key: kubernetes-deploy
    agent: devops
    prompt: "Deploy microservices to Kubernetes with auto-scaling and health checks"
    dependencies: [load-testing]
```

---

## Conclusion

Day 3 implementation focuses on completing the critical bridge between workflow orchestration and agent execution. The 3-tier routing strategy provides a flexible, robust approach:

1. **Tier 1 (Explicit)**: 95% confidence, developer control, fast validation
2. **Tier 2 (Step Type)**: 60-80% confidence, keyword-based, good accuracy
3. **Tier 3 (Semantic)**: 50-70% confidence, ML-based, handles edge cases

**Key Success Factors**:
- Comprehensive testing (25+ tests)
- Robust error handling and retry logic
- Clear routing confidence metrics
- Fallback strategies for reliability

**Deliverables**:
- ✅ 650+ lines production code
- ✅ 850+ lines test code
- ✅ 190+ tests passing
- ✅ 5 example workflows demonstrating routing

**Next Steps** (Day 4-5):
- Day 4: Checkpoint/Resume with ReScript state machine
- Day 5: End-to-end testing, performance optimization, documentation

This implementation sets the foundation for reliable, intelligent workflow execution in AutomatosX v2.1.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
**Word Count**: ~3,400 words
**Estimated Reading Time**: 17 minutes
