/**
 * Enhanced Agent Executor Implementation
 *
 * Full-featured executor with:
 * - Checkpoint support (INV-CP-001, INV-CP-002)
 * - Parallel execution (INV-PE-001, INV-PE-002, INV-PE-003)
 * - Delegation tracking (INV-DT-001, INV-DT-002)
 * - Resumable workflows
 * - Event emission
 *
 * All external dependencies are injected via config (dependency inversion).
 */

import {
  type AgentResult,
  type AgentRunOptions,
  type AgentError,
  type AgentWorkflowStep,
  type AgentProfile,
  AgentErrorCode,
  AgentRunOptionsSchema,
  createDefaultCheckpointConfig,
  createDefaultParallelExecutionConfig,
  type CheckpointConfig,
  type ParallelExecutionConfig,
  LIMIT_ABILITY_TOKENS_AGENT,
} from '@automatosx/contracts';
import type {
  AgentExecutor,
  AgentRegistry,
  ExecutionStatus,
  StepExecutionContext,
  StepExecutionResult,
  StepExecutorFn,
  AgentDomainConfig,
  PromptExecutor,
  PromptStepConfig,
  AbilityManagerLike,
  ToolExecutor,
  DelegationTrackerFactory,
  CheckpointStoragePort,
  CheckpointManagerPort,
  CheckpointStorageFactory,
  CheckpointManagerFactory,
  ParallelExecutorPort,
  ParallelExecutorFactory,
} from './types.js';
import { createStubPromptExecutor } from './prompt-executor.js';
import { stubDelegationTrackerFactory } from './stub-delegation-tracker.js';
import { stubCheckpointStorageFactory, stubCheckpointManagerFactory } from './stub-checkpoint.js';
import { stubParallelExecutorFactory } from './stub-parallel-executor.js';

/**
 * Enhanced configuration with checkpoint and parallel settings
 *
 * All external dependencies are injected via factory functions.
 * If not provided, stub implementations are used (with warnings).
 */
export interface EnhancedAgentDomainConfig extends AgentDomainConfig {
  checkpointConfig?: Partial<CheckpointConfig>;
  parallelConfig?: Partial<ParallelExecutionConfig>;
  /** Factory for creating checkpoint storage (default: in-memory stub) */
  checkpointStorageFactory?: CheckpointStorageFactory;
  /** Factory for creating checkpoint managers */
  checkpointManagerFactory?: CheckpointManagerFactory;
  /** Factory for creating parallel executors (default: sequential stub) */
  parallelExecutorFactory?: ParallelExecutorFactory;
}

/**
 * Execution state with checkpoint support
 */
interface ExecutionState {
  executionId: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  currentStep?: string;
  stepResults: StepResult[];
  previousOutputs: Record<string, unknown>;
  checkpointId?: string;
}

/**
 * Step result
 */
interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  durationMs: number;
  retryCount: number;
  skipped: boolean;
  error: AgentError | undefined;
}

/**
 * Enhanced agent executor with full feature support
 *
 * Now includes ability injection (INV-AGT-ABL-001, INV-AGT-ABL-002, INV-AGT-ABL-003)
 * All external dependencies are injected via config factories.
 */
export class EnhancedAgentExecutor implements AgentExecutor {
  private readonly executions = new Map<string, ExecutionState>();
  private readonly stepExecutors = new Map<string, StepExecutorFn>();
  private readonly promptExecutor: PromptExecutor;
  private readonly toolExecutor: ToolExecutor | undefined;
  private readonly checkpointStorage: CheckpointStoragePort;
  private readonly parallelExecutor: ParallelExecutorPort;
  private readonly checkpointConfig: CheckpointConfig;
  private readonly parallelConfig: ParallelExecutionConfig;
  private readonly abilityManager: AbilityManagerLike | undefined;
  private readonly enableAbilityInjection: boolean;
  private readonly maxAbilityTokens: number;
  private readonly delegationTrackerFactory: DelegationTrackerFactory;
  private readonly checkpointManagerFactory: CheckpointManagerFactory;

  constructor(
    private readonly registry: AgentRegistry,
    private readonly config: EnhancedAgentDomainConfig
  ) {
    // Initialize prompt executor
    this.promptExecutor = config.promptExecutor ?? createStubPromptExecutor(
      config.defaultProvider ?? 'claude'
    );

    // Initialize tool executor (INV-TOOL-001, INV-TOOL-002, INV-TOOL-003)
    this.toolExecutor = config.toolExecutor;

    // Initialize ability manager (INV-AGT-ABL-001)
    this.abilityManager = config.abilityManager;
    this.enableAbilityInjection = config.enableAbilityInjection ?? (config.abilityManager !== undefined);
    this.maxAbilityTokens = config.maxAbilityTokens ?? LIMIT_ABILITY_TOKENS_AGENT;

    // Initialize delegation tracker factory (use stub if not provided)
    this.delegationTrackerFactory = config.delegationTrackerFactory ?? stubDelegationTrackerFactory;

    // Initialize checkpoint storage using injected factory (or stub)
    this.checkpointConfig = {
      ...createDefaultCheckpointConfig(),
      ...config.checkpointConfig,
    };
    const checkpointStorageFactory = config.checkpointStorageFactory ?? stubCheckpointStorageFactory;
    this.checkpointStorage = checkpointStorageFactory();

    // Initialize checkpoint manager factory
    this.checkpointManagerFactory = config.checkpointManagerFactory ?? stubCheckpointManagerFactory;

    // Initialize parallel executor using injected factory (or stub)
    this.parallelConfig = {
      ...createDefaultParallelExecutionConfig(),
      ...config.parallelConfig,
    };
    const parallelExecutorFactory = config.parallelExecutorFactory ?? stubParallelExecutorFactory;
    this.parallelExecutor = parallelExecutorFactory(this.parallelConfig);

    // Register step executors
    this.registerDefaultExecutors();
  }

  /**
   * Create a checkpoint manager for a specific execution
   */
  private createCheckpointManagerForExecution(
    agentId: string,
    sessionId: string | undefined
  ): CheckpointManagerPort {
    return this.checkpointManagerFactory(
      agentId,
      sessionId,
      this.checkpointStorage,
      this.checkpointConfig
    );
  }

  /**
   * Execute an agent with full feature support
   */
  async execute(
    agentId: string,
    input: unknown,
    options?: AgentRunOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const executionId = crypto.randomUUID();

    // Validate options
    let validatedOptions: AgentRunOptions | undefined;
    if (options !== undefined) {
      try {
        validatedOptions = AgentRunOptionsSchema.parse(options);
      } catch (error) {
        return this.createErrorResult(
          agentId,
          startTime,
          AgentErrorCode.AGENT_VALIDATION_ERROR,
          `Invalid run options: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Get agent profile
    const agent = await this.registry.get(agentId);
    if (agent === undefined) {
      return this.createErrorResult(
        agentId,
        startTime,
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent "${agentId}" not found`
      );
    }

    // Check if agent is enabled
    if (!agent.enabled) {
      return this.createErrorResult(
        agentId,
        startTime,
        AgentErrorCode.AGENT_PERMISSION_DENIED,
        `Agent "${agentId}" is disabled`
      );
    }

    // Create checkpoint manager for this execution
    const checkpointManager = this.createCheckpointManagerForExecution(
      agentId,
      validatedOptions?.sessionId
    );

    // Check for resume from checkpoint
    let startFromStep = 0;
    let previousOutputs: Record<string, unknown> = {};

    if (validatedOptions?.resumable && validatedOptions.checkpoint) {
      const latestCheckpoint = await checkpointManager.getLatestCheckpoint();
      if (latestCheckpoint !== null) {
        const resumeContext = await checkpointManager.getResumeContext(latestCheckpoint.checkpointId);
        if (resumeContext !== null) {
          // INV-CP-002: Resume from step after checkpoint
          startFromStep = resumeContext.startFromStep;
          previousOutputs = resumeContext.previousOutputs;
        }
      }
    }

    // Initialize execution state
    const state: ExecutionState = {
      executionId,
      agentId,
      status: 'running',
      startedAt: new Date().toISOString(),
      stepResults: [],
      previousOutputs,
    };
    this.executions.set(executionId, state);

    try {
      const workflow = agent.workflow ?? [];
      const stepResults: StepResult[] = [];

      // Handle agents with no workflow
      if (workflow.length === 0) {
        return this.handleNoWorkflow(agent, input, validatedOptions, startTime);
      }

      // Check if parallel execution is enabled
      const useParallel = validatedOptions?.parallel ?? this.parallelConfig.enabled;

      if (useParallel) {
        // Execute with parallel executor
        return await this.executeParallel(
          agent,
          workflow,
          input,
          state,
          validatedOptions,
          startTime,
          startFromStep
        );
      }

      // Sequential execution with checkpoint support
      for (let i = startFromStep; i < workflow.length; i++) {
        const step = workflow[i];
        if (step === undefined) continue;

        if (state.status === 'cancelled') break;

        state.currentStep = step.stepId;

        // Check dependencies
        if (!this.checkDependencies(step, stepResults)) {
          stepResults.push(this.createSkippedResult(step.stepId, 'Dependencies not met'));
          continue;
        }

        // Check condition
        if (step.condition !== undefined && !this.evaluateCondition(step.condition, state.previousOutputs)) {
          stepResults.push(this.createSkippedResult(step.stepId));
          continue;
        }

        // Execute step
        const result = await this.executeStep(
          step,
          this.createStepContext(agentId, executionId, input, state.previousOutputs, validatedOptions),
          step.retryPolicy?.maxAttempts ?? 1
        );

        stepResults.push({
          stepId: step.stepId,
          success: result.success,
          output: result.output,
          durationMs: result.durationMs,
          retryCount: result.retryCount,
          skipped: false,
          error: result.error,
        });

        // Store output
        if (result.success && result.output !== undefined) {
          state.previousOutputs[step.stepId] = result.output;
        }

        // Create checkpoint if enabled
        // INV-CP-001: Checkpoint contains all data needed to resume
        if (this.checkpointConfig.enabled && checkpointManager.shouldCheckpoint(i)) {
          await checkpointManager.createCheckpoint(
            i,
            step.stepId,
            state.previousOutputs,
            { input }
          );
        }

        // Stop on failure (unless marked as parallel)
        if (!result.success && !step.parallel) {
          break;
        }
      }

      return this.buildResult(agentId, stepResults, state, validatedOptions, startTime);
    } catch (error) {
      state.status = 'failed';
      state.completedAt = new Date().toISOString();
      return this.createErrorResult(
        agentId,
        startTime,
        AgentErrorCode.AGENT_STAGE_FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Execute workflow with parallel executor
   * INV-PE-001: Independent steps execute concurrently
   * INV-PE-002: Dependencies honored (DAG ordering)
   * INV-PE-003: Concurrency limit respected
   */
  private async executeParallel(
    agent: AgentProfile,
    workflow: AgentWorkflowStep[],
    input: unknown,
    state: ExecutionState,
    options: AgentRunOptions | undefined,
    startTime: number,
    _startFromStep: number
  ): Promise<AgentResult> {
    const context = this.createStepContext(
      agent.agentId,
      state.executionId,
      input,
      state.previousOutputs,
      options
    );

    // Build executor function for parallel executor
    const stepExecutor = async (
      step: AgentWorkflowStep,
      outputs: Record<string, unknown>
    ): Promise<unknown> => {
      const stepContext = {
        ...context,
        previousOutputs: outputs,
      };

      const result = await this.executeStep(
        step,
        stepContext,
        step.retryPolicy?.maxAttempts ?? 1
      );

      if (!result.success) {
        throw new Error(result.error?.message ?? 'Step failed');
      }

      return result.output;
    };

    // Execute with parallel executor
    const groupResult = await this.parallelExecutor.executeGroup(
      workflow,
      stepExecutor,
      state.previousOutputs
    );

    // Convert parallel results to step results
    const stepResults: StepResult[] = groupResult.stepResults.map((r) => ({
      stepId: r.stepId,
      success: r.success,
      output: r.output,
      durationMs: r.durationMs,
      retryCount: 0,
      skipped: r.cancelled ?? false,
      error: r.error ? { code: AgentErrorCode.AGENT_STAGE_FAILED, message: r.error } : undefined,
    }));

    // Update state
    state.stepResults = stepResults;
    state.status = groupResult.allSucceeded ? 'completed' : 'failed';
    state.completedAt = new Date().toISOString();

    return {
      success: groupResult.allSucceeded,
      agentId: agent.agentId,
      sessionId: options?.sessionId,
      output: this.collectOutputs(stepResults, state.previousOutputs),
      stepResults,
      totalDurationMs: Date.now() - startTime,
      error: groupResult.allSucceeded
        ? undefined
        : stepResults.find((r) => r.error !== undefined)?.error,
    };
  }

  /**
   * Handle agents with no workflow defined
   */
  private handleNoWorkflow(
    agent: AgentProfile,
    input: unknown,
    options: AgentRunOptions | undefined,
    startTime: number
  ): AgentResult {
    // If agent has systemPrompt, create a single prompt step on the fly
    if (agent.systemPrompt) {
      return {
        success: true,
        agentId: agent.agentId,
        sessionId: options?.sessionId,
        output: {
          message: 'Agent has no workflow but has a system prompt. Use agent_run to execute prompts directly.',
          agent: {
            agentId: agent.agentId,
            description: agent.description,
            hasSystemPrompt: true,
          },
          suggestion: 'Register the agent with workflow steps for structured execution.',
        },
        stepResults: [],
        totalDurationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      agentId: agent.agentId,
      sessionId: options?.sessionId,
      output: {
        message: `Agent "${agent.agentId}" has no workflow steps. Register with workflow to enable execution.`,
        input,
      },
      stepResults: [],
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<void> {
    const state = this.executions.get(executionId);
    if (state?.status === 'running') {
      state.status = 'cancelled';
      state.completedAt = new Date().toISOString();
      this.parallelExecutor.cancel();
    }
  }

  /**
   * Get execution status
   */
  async getStatus(executionId: string): Promise<ExecutionStatus | undefined> {
    const state = this.executions.get(executionId);
    if (state === undefined) return undefined;

    const completedSteps = state.stepResults.filter((r) => r.success || r.skipped).length;
    const totalSteps = state.stepResults.length;

    return {
      executionId: state.executionId,
      agentId: state.agentId,
      status: state.status,
      currentStep: state.currentStep,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      progress: {
        totalSteps,
        completedSteps,
        currentStepName: state.currentStep,
        percentComplete: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      },
    };
  }

  /**
   * Register custom step executor
   */
  registerStepExecutor(type: string, executor: StepExecutorFn): void {
    this.stepExecutors.set(type, executor);
  }

  /**
   * Create step execution context
   */
  private createStepContext(
    agentId: string,
    executionId: string,
    input: unknown,
    previousOutputs: Record<string, unknown>,
    options?: AgentRunOptions
  ): StepExecutionContext {
    return {
      agentId,
      executionId,
      sessionId: options?.sessionId,
      input,
      previousOutputs,
      memory: undefined,
      provider: options?.provider,
      model: options?.model,
      delegationContext: options?.delegationContext,
    };
  }

  /**
   * Execute a single step with retry
   */
  private async executeStep(
    step: AgentWorkflowStep,
    context: StepExecutionContext,
    maxAttempts: number
  ): Promise<StepExecutionResult> {
    const executor = this.stepExecutors.get(step.type);
    if (executor === undefined) {
      return {
        success: false,
        error: {
          code: AgentErrorCode.AGENT_STAGE_FAILED,
          message: `No executor for step type: ${step.type}`,
          stepId: step.stepId,
        },
        durationMs: 0,
        retryCount: 0,
      };
    }

    let lastError: AgentError | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const timeout = step.timeoutMs ?? this.config.defaultTimeout;
      const { promise: timeoutPromise, cancel: cancelTimeout } = this.createTimeout(timeout, step.stepId);

      try {
        const result = await Promise.race([
          executor(step, context),
          timeoutPromise,
        ]);
        cancelTimeout(); // Clean up the timer

        if (result.success) {
          return { ...result, retryCount };
        }

        lastError = result.error;
        retryCount++;

        // Backoff
        if (attempt < maxAttempts - 1 && step.retryPolicy !== undefined) {
          const backoff = step.retryPolicy.backoffMs *
            Math.pow(step.retryPolicy.backoffMultiplier, attempt);
          await this.sleep(backoff);
        }
      } catch (error) {
        cancelTimeout(); // Clean up the timer on error too
        lastError = {
          code: AgentErrorCode.AGENT_STAGE_FAILED,
          message: error instanceof Error ? error.message : 'Unknown error',
          stepId: step.stepId,
        };
        retryCount++;
      }
    }

    return { success: false, error: lastError, durationMs: 0, retryCount };
  }

  /**
   * Check step dependencies
   */
  private checkDependencies(step: AgentWorkflowStep, results: StepResult[]): boolean {
    if (step.dependencies === undefined || step.dependencies.length === 0) {
      return true;
    }
    return step.dependencies.every((depId) => {
      const depResult = results.find((r) => r.stepId === depId);
      return depResult !== undefined && depResult.success;
    });
  }

  /**
   * Evaluate a condition expression safely without using eval/Function
   *
   * Supports patterns:
   * - ${variable} === value
   * - ${variable} !== value
   * - ${variable} > value
   * - ${variable} < value
   * - ${variable} >= value
   * - ${variable} <= value
   * - ${variable} (truthy check)
   * - !${variable} (falsy check)
   * - condition && condition
   * - condition || condition
   */
  private evaluateCondition(condition: string, outputs: Record<string, unknown>): boolean {
    try {
      // Handle logical operators by recursively evaluating sub-conditions
      // Check for || first (lower precedence)
      const orParts = this.splitByOperator(condition, '||');
      if (orParts.length > 1) {
        return orParts.some((part) => this.evaluateCondition(part.trim(), outputs));
      }

      // Check for && (higher precedence than ||)
      const andParts = this.splitByOperator(condition, '&&');
      if (andParts.length > 1) {
        return andParts.every((part) => this.evaluateCondition(part.trim(), outputs));
      }

      // Handle negation
      const trimmed = condition.trim();
      if (trimmed.startsWith('!')) {
        return !this.evaluateCondition(trimmed.slice(1).trim(), outputs);
      }

      // Handle parentheses
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        return this.evaluateCondition(trimmed.slice(1, -1), outputs);
      }

      // Parse comparison expression: ${variable} op value
      const comparisonMatch = /^\$\{(\w+(?:\.\w+)*)\}\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(trimmed);
      if (comparisonMatch) {
        const [, keyPath, op, rawValue] = comparisonMatch;
        const actualValue = this.getConditionValue(outputs, keyPath!);
        const expectedValue = this.parseConditionValue(rawValue!.trim());
        return this.compareConditionValues(actualValue, expectedValue, op!);
      }

      // Handle simple variable reference (truthy check): ${variable}
      const varMatch = /^\$\{(\w+(?:\.\w+)*)\}$/.exec(trimmed);
      if (varMatch) {
        const value = this.getConditionValue(outputs, varMatch[1]!);
        return Boolean(value);
      }

      // Handle literal boolean
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;

      // Unknown pattern - fail safely
      console.warn(`[evaluateCondition] Unknown condition pattern: ${condition}`);
      return false;
    } catch (error) {
      console.warn(`[evaluateCondition] Error evaluating condition: ${condition}`, error);
      return false;
    }
  }

  /**
   * Split condition by operator, respecting parentheses
   */
  private splitByOperator(condition: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let i = 0;

    while (i < condition.length) {
      const char = condition[i];

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (depth === 0 && condition.slice(i, i + operator.length) === operator) {
        parts.push(current);
        current = '';
        i += operator.length;
        continue;
      } else {
        current += char;
      }
      i++;
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Get nested value from object using dot notation (for condition evaluation)
   */
  private getConditionValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Parse a value string into its actual type for condition evaluation
   */
  private parseConditionValue(value: string): unknown {
    // String literal
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Null/undefined
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    const num = Number(value);
    if (!isNaN(num)) return num;

    // Default to string
    return value;
  }

  /**
   * Compare two values using the specified operator
   */
  private compareConditionValues(actual: unknown, expected: unknown, op: string): boolean {
    switch (op) {
      case '===':
        return actual === expected;
      case '!==':
        return actual !== expected;
      case '==':
        return actual == expected;
      case '!=':
        return actual != expected;
      case '>':
        return (actual as number) > (expected as number);
      case '<':
        return (actual as number) < (expected as number);
      case '>=':
        return (actual as number) >= (expected as number);
      case '<=':
        return (actual as number) <= (expected as number);
      default:
        return false;
    }
  }

  /**
   * Collect outputs from results
   */
  private collectOutputs(
    results: StepResult[],
    _previousOutputs: Record<string, unknown>
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const result of results) {
      if (result.success && result.output !== undefined) {
        output[result.stepId] = result.output;
      }
    }
    return output;
  }

  /**
   * Build final result
   */
  private buildResult(
    agentId: string,
    stepResults: StepResult[],
    state: ExecutionState,
    options: AgentRunOptions | undefined,
    startTime: number
  ): AgentResult {
    const allSuccess = stepResults.every((r) => r.success || r.skipped);
    state.status = allSuccess ? 'completed' : 'failed';
    state.completedAt = new Date().toISOString();
    state.stepResults = stepResults;

    return {
      success: allSuccess,
      agentId,
      sessionId: options?.sessionId,
      output: this.collectOutputs(stepResults, state.previousOutputs),
      stepResults,
      totalDurationMs: Date.now() - startTime,
      error: allSuccess ? undefined : stepResults.find((r) => r.error !== undefined)?.error,
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    agentId: string,
    startTime: number,
    code: string,
    message: string
  ): AgentResult {
    return {
      success: false,
      agentId,
      error: { code, message },
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Create skipped result
   */
  private createSkippedResult(stepId: string, reason?: string): StepResult {
    return {
      stepId,
      success: reason === undefined,
      durationMs: 0,
      retryCount: 0,
      skipped: true,
      error: reason ? { code: AgentErrorCode.AGENT_DEPENDENCY_FAILED, message: reason } : undefined,
    };
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number, stepId: string): {
    promise: Promise<StepExecutionResult>;
    cancel: () => void;
  } {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const promise = new Promise<StepExecutionResult>((_, reject) => {
      timeoutId = setTimeout(() => { reject({
        success: false,
        error: {
          code: AgentErrorCode.AGENT_STAGE_FAILED,
          message: `Step "${stepId}" timed out after ${ms}ms`,
          stepId,
          retryable: true,
        },
        durationMs: ms,
        retryCount: 0,
      }); }, ms);
    });

    const cancel = (): void => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };

    return { promise, cancel };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Substitute variables in template
   */
  private substituteVariables(
    template: string,
    context: StepExecutionContext,
    agentProfile: { description?: string; systemPrompt?: string; agentId: string }
  ): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const parts = path.split('.');
      let value: unknown;

      switch (parts[0]) {
        case 'input':
          if (parts.length === 1) {
            value = typeof context.input === 'string'
              ? context.input
              : JSON.stringify(context.input, null, 2);
          } else {
            value = this.getNestedValue(context.input, parts.slice(1));
          }
          break;
        case 'previousOutputs':
          if (parts.length > 1) {
            value = this.getNestedValue(context.previousOutputs, parts.slice(1));
          }
          break;
        case 'agent':
          if (parts.length > 1) {
            value = this.getNestedValue(agentProfile, parts.slice(1));
          }
          break;
        default:
          value = this.getNestedValue(context.input, parts);
      }

      if (value === undefined) return match;
      return typeof value === 'string' ? value : JSON.stringify(value);
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  /**
   * Register all default step executors
   */
  private registerDefaultExecutors(): void {
    // Prompt step executor with ability injection
    // INV-AGT-ABL-001: Abilities injected before prompt execution
    // INV-AGT-ABL-002: Core abilities from agent profile included
    // INV-AGT-ABL-003: Token limits respected
    this.stepExecutors.set('prompt', async (step, context) => {
      const startTime = Date.now();
      const config = (step.config ?? {}) as PromptStepConfig;

      const agent = await this.registry.get(context.agentId);
      const agentProfile: { description?: string; systemPrompt?: string; agentId: string } = {
        agentId: context.agentId,
      };
      if (agent?.description !== undefined) agentProfile.description = agent.description;
      if (agent?.systemPrompt !== undefined) agentProfile.systemPrompt = agent.systemPrompt;

      // INV-AGT-ABL-001: Inject abilities if ability manager is available
      let abilityContent = '';
      if (this.enableAbilityInjection && this.abilityManager !== undefined) {
        try {
          // INV-AGT-ABL-002: Core abilities from agent profile
          const coreAbilities = agent?.abilities?.core ?? [];

          // Determine task from input for relevance matching
          const task = typeof context.input === 'string'
            ? context.input
            : typeof context.input === 'object' && context.input !== null && 'task' in context.input
              ? String((context.input as { task: unknown }).task)
              : typeof context.input === 'object' && context.input !== null && 'prompt' in context.input
                ? String((context.input as { prompt: unknown }).prompt)
                : agent?.description ?? '';

          // INV-AGT-ABL-003: Token limits respected
          const injectionResult = await this.abilityManager.injectAbilities(
            context.agentId,
            task,
            coreAbilities,
            {
              maxTokens: this.maxAbilityTokens,
              includeMetadata: true,
            }
          );

          if (injectionResult.combinedContent.length > 0) {
            abilityContent = `\n\n## Relevant Knowledge & Abilities\n\n${injectionResult.combinedContent}\n\n---\n\n`;
          }
        } catch {
          // Ability injection failure should not block execution
        }
      }

      // Build prompt with keyQuestions support
      let promptText: string;
      if (config.prompt) {
        promptText = this.substituteVariables(config.prompt, context, agentProfile);
      } else if (typeof context.input === 'string') {
        promptText = context.input;
      } else if (context.input && typeof context.input === 'object' && 'prompt' in context.input) {
        promptText = (context.input as { prompt: string }).prompt;
      } else {
        promptText = JSON.stringify(context.input, null, 2);
      }

      // Append keyQuestions if defined
      if (step.keyQuestions && step.keyQuestions.length > 0) {
        promptText += '\n\nKey Questions to Address:\n' +
          step.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      }

      // Build system prompt with injected abilities
      const baseSystemPrompt = config.systemPrompt ?? agent?.systemPrompt ?? '';
      const systemPrompt = abilityContent
        ? `${baseSystemPrompt}${abilityContent}`
        : baseSystemPrompt || undefined;

      const response = await this.promptExecutor.execute({
        prompt: promptText,
        systemPrompt: systemPrompt || undefined,
        provider: config.provider ?? context.provider,
        model: config.model ?? context.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout ?? step.timeoutMs,
      });

      if (response.success) {
        return {
          success: true,
          output: {
            content: response.content,
            provider: response.provider,
            model: response.model,
            usage: response.usage,
          },
          error: undefined,
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      return {
        success: false,
        error: {
          code: response.errorCode ?? AgentErrorCode.AGENT_STAGE_FAILED,
          message: response.error ?? 'Prompt execution failed',
          stepId: step.stepId,
          retryable: true,
        },
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Tool step executor (INV-TOOL-001, INV-TOOL-002, INV-TOOL-003)
    this.stepExecutors.set('tool', async (step, context) => {
      const startTime = Date.now();
      const config = step.config as {
        toolName?: string;
        toolInput?: Record<string, unknown>;
      } | undefined;

      const toolName = config?.toolName;
      const toolInput = (config?.toolInput ?? context.input ?? {}) as Record<string, unknown>;

      // If no tool executor is configured, return placeholder result
      if (this.toolExecutor === undefined) {
        return {
          success: true,
          output: {
            step: step.stepId,
            type: 'tool',
            toolName: toolName ?? 'unknown',
            toolInput,
            status: 'no_executor',
            message: 'Tool execution requires a ToolExecutor. Configure AgentDomainConfig.toolExecutor.',
          },
          error: undefined,
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // Check if tool name is provided
      if (toolName === undefined || toolName.trim() === '') {
        return {
          success: false,
          output: undefined,
          error: {
            code: 'TOOL_CONFIG_ERROR',
            message: `Tool step "${step.stepId}" requires toolName in config`,
            stepId: step.stepId,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // INV-TOOL-001: Check if tool is available
      if (!this.toolExecutor.isToolAvailable(toolName)) {
        return {
          success: false,
          output: undefined,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `Tool "${toolName}" is not available`,
            stepId: step.stepId,
            details: {
              availableTools: this.toolExecutor.getAvailableTools().slice(0, 10),
            },
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // Execute the tool
      try {
        const result = await this.toolExecutor.execute(toolName, toolInput);

        // INV-TOOL-002: Result is already frozen by executor
        return {
          success: result.success,
          output: {
            step: step.stepId,
            type: 'tool',
            toolName,
            toolOutput: result.output,
            durationMs: result.durationMs,
          },
          error: result.success ? undefined : {
            code: result.errorCode ?? 'TOOL_EXECUTION_ERROR',
            message: result.error ?? 'Tool execution failed',
            stepId: step.stepId,
            retryable: result.retryable ?? false,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      } catch (error) {
        // INV-TOOL-003: Handle unexpected errors gracefully
        return {
          success: false,
          output: undefined,
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown tool execution error',
            stepId: step.stepId,
            retryable: true,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }
    });

    // Conditional step executor
    this.stepExecutors.set('conditional', async (step, context) => {
      const startTime = Date.now();
      const config = step.config as {
        condition?: string;
        thenSteps?: string[];
        elseSteps?: string[];
      } | undefined;

      const conditionResult = config?.condition
        ? this.evaluateCondition(config.condition, context.previousOutputs)
        : true;

      return {
        success: true,
        output: {
          step: step.stepId,
          type: 'conditional',
          conditionMet: conditionResult,
          branch: conditionResult ? 'then' : 'else',
          nextSteps: conditionResult ? config?.thenSteps : config?.elseSteps,
        },
        error: undefined,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Loop step executor
    this.stepExecutors.set('loop', async (step, context) => {
      const startTime = Date.now();
      const config = step.config as {
        items?: unknown[];
        itemsPath?: string;
        maxIterations?: number;
        bodySteps?: string[];
      } | undefined;

      // Get items to iterate over
      let items: unknown[] = config?.items ?? [];
      if (config?.itemsPath) {
        const pathParts = config.itemsPath.split('.');
        let value: unknown = context.previousOutputs;
        for (const part of pathParts) {
          if (value === null || value === undefined) break;
          value = (value as Record<string, unknown>)[part];
        }
        if (Array.isArray(value)) items = value;
      }

      // Apply max iterations limit
      const maxIterations = config?.maxIterations ?? 100;
      const limitedItems = items.slice(0, maxIterations);

      return {
        success: true,
        output: {
          step: step.stepId,
          type: 'loop',
          itemCount: limitedItems.length,
          items: limitedItems,
          bodySteps: config?.bodySteps,
          message: 'Loop step - items available for iteration',
        },
        error: undefined,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Parallel step executor (marker for parallel group)
    this.stepExecutors.set('parallel', async (step, _context) => {
      const startTime = Date.now();
      return {
        success: true,
        output: {
          step: step.stepId,
          type: 'parallel',
          message: 'Parallel step marker - child steps executed concurrently',
        },
        error: undefined,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Delegate step executor with full delegation tracking
    this.stepExecutors.set('delegate', async (step, context) => {
      const startTime = Date.now();
      const config = step.config as {
        targetAgentId?: string;
        task?: string;
        input?: unknown;
      } | undefined;

      if (!config?.targetAgentId) {
        return {
          success: false,
          error: {
            code: AgentErrorCode.AGENT_STAGE_FAILED,
            message: 'Delegate step requires targetAgentId in config',
            stepId: step.stepId,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // Create delegation tracker using injected factory
      const delegationTracker = this.delegationTrackerFactory(
        context.agentId,
        context.delegationContext,
        this.config.maxDelegationDepth
      );

      // Check delegation allowed (INV-DT-001, INV-DT-002)
      const checkResult = delegationTracker.canDelegate(config.targetAgentId);
      if (!checkResult.allowed) {
        return {
          success: false,
          error: {
            code: checkResult.reason === 'MAX_DEPTH_EXCEEDED'
              ? AgentErrorCode.AGENT_DELEGATION_DEPTH_EXCEEDED
              : AgentErrorCode.AGENT_STAGE_FAILED,
            message: checkResult.message ?? `Cannot delegate to ${config.targetAgentId}`,
            stepId: step.stepId,
            retryable: false,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // Check target exists
      const targetAgent = await this.registry.get(config.targetAgentId);
      if (targetAgent === undefined) {
        return {
          success: false,
          error: {
            code: AgentErrorCode.AGENT_NOT_FOUND,
            message: `Delegation target "${config.targetAgentId}" not found`,
            stepId: step.stepId,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // Create child context and execute
      const childContext = delegationTracker.createChildContext(config.targetAgentId);

      try {
        const delegateResult = await this.execute(
          config.targetAgentId,
          config.input ?? context.input,
          {
            sessionId: context.sessionId,
            provider: context.provider,
            model: context.model,
            delegationContext: childContext,
          }
        );

        delegationTracker.recordResult({
          success: delegateResult.success,
          handledBy: config.targetAgentId,
          result: delegateResult.output,
          durationMs: delegateResult.totalDurationMs,
          finalDepth: childContext.currentDepth,
          error: delegateResult.error ? {
            code: delegateResult.error.code,
            message: delegateResult.error.message,
            retryable: false,
          } : undefined,
        });

        return {
          success: delegateResult.success,
          output: {
            step: step.stepId,
            type: 'delegate',
            delegatedTo: config.targetAgentId,
            result: delegateResult.output,
            delegationDepth: childContext.currentDepth,
          },
          error: delegateResult.error,
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: AgentErrorCode.AGENT_STAGE_FAILED,
            message: error instanceof Error ? error.message : 'Delegation failed',
            stepId: step.stepId,
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }
    });
  }
}

/**
 * Creates an enhanced agent executor with full feature support
 */
export function createEnhancedAgentExecutor(
  registry: AgentRegistry,
  config: EnhancedAgentDomainConfig
): AgentExecutor {
  return new EnhancedAgentExecutor(registry, config);
}
