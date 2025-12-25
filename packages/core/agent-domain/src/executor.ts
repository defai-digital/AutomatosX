/**
 * Agent Executor Implementation
 *
 * Executes agent workflows with step-by-step processing.
 * Integrates with DelegationTracker for INV-DT-001 (depth limits) and INV-DT-002 (no circular).
 */

import {
  type AgentResult,
  type AgentRunOptions,
  type AgentError,
  type AgentWorkflowStep,
  AgentErrorCode,
  AgentRunOptionsSchema,
  LIMIT_ABILITY_TOKENS_AGENT,
} from '@defai.digital/contracts';
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
} from './types.js';
import { createStubPromptExecutor } from './prompt-executor.js';
import { stubDelegationTrackerFactory } from './stub-delegation-tracker.js';

/**
 * Default agent executor implementation
 *
 * Supports optional ability injection via AbilityManager.
 * INV-AGT-ABL-001: When abilityManager is provided, abilities are injected before prompt execution
 * INV-AGT-ABL-002: Core abilities from agent profile are always included
 * INV-AGT-ABL-003: Token limits are respected during injection
 */
export class DefaultAgentExecutor implements AgentExecutor {
  private readonly executions = new Map<string, ExecutionState>();
  private readonly stepExecutors = new Map<string, StepExecutorFn>();
  private readonly promptExecutor: PromptExecutor;
  private readonly toolExecutor: ToolExecutor | undefined;
  private readonly abilityManager: AbilityManagerLike | undefined;
  private readonly enableAbilityInjection: boolean;
  private readonly maxAbilityTokens: number;
  private readonly delegationTrackerFactory: DelegationTrackerFactory;

  constructor(
    private readonly registry: AgentRegistry,
    private readonly config: AgentDomainConfig
  ) {
    // Use provided prompt executor or create a stub for testing
    this.promptExecutor = config.promptExecutor ?? createStubPromptExecutor(
      config.defaultProvider ?? 'claude'
    );

    // Tool executor for executing MCP tools (optional)
    this.toolExecutor = config.toolExecutor;

    // Ability injection configuration
    this.abilityManager = config.abilityManager;
    this.enableAbilityInjection = config.enableAbilityInjection ?? (config.abilityManager !== undefined);
    this.maxAbilityTokens = config.maxAbilityTokens ?? LIMIT_ABILITY_TOKENS_AGENT;

    // Delegation tracker factory (use stub if not provided)
    this.delegationTrackerFactory = config.delegationTrackerFactory ?? stubDelegationTrackerFactory;

    // Register default step executors
    this.registerDefaultExecutors();
  }

  /**
   * Execute an agent with the given input
   * Validates AgentRunOptions at entry point per contract
   */
  async execute(
    agentId: string,
    input: unknown,
    options?: AgentRunOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const executionId = crypto.randomUUID();

    // Validate options at entry point
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

    // Initialize execution state
    const state: ExecutionState = {
      executionId,
      agentId,
      status: 'running',
      startedAt: new Date().toISOString(),
      stepResults: [],
      previousOutputs: {},
    };
    this.executions.set(executionId, state);

    try {
      // Execute workflow steps
      const workflow = agent.workflow ?? [];
      const stepResults: StepResult[] = [];

      // Handle agents with no workflow defined
      if (workflow.length === 0) {
        state.status = 'completed';
        state.completedAt = new Date().toISOString();

        return {
          success: true,
          agentId,
          sessionId: validatedOptions?.sessionId,
          output: {
            message: `Agent "${agentId}" has no workflow steps defined. Register the agent with a workflow to enable execution.`,
            agent: {
              agentId: agent.agentId,
              description: agent.description,
              capabilities: agent.capabilities,
              systemPrompt: agent.systemPrompt ? '(defined)' : undefined,
            },
            input,
          },
          stepResults: [],
          totalDurationMs: Date.now() - startTime,
        };
      }

      for (const step of workflow) {
        // Check for cancellation
        if (state.status === 'cancelled') {
          break;
        }

        state.currentStep = step.stepId;

        // Check dependencies
        const dependenciesMet = this.checkDependencies(
          step,
          stepResults
        );
        if (!dependenciesMet) {
          stepResults.push({
            stepId: step.stepId,
            success: false,
            durationMs: 0,
            retryCount: 0,
            skipped: true,
            error: {
              code: AgentErrorCode.AGENT_DEPENDENCY_FAILED,
              message: 'Dependencies not met',
            },
          });
          continue;
        }

        // Check condition
        if (step.condition !== undefined) {
          const conditionMet = this.evaluateCondition(
            step.condition,
            state.previousOutputs
          );
          if (!conditionMet) {
            stepResults.push({
              stepId: step.stepId,
              success: true,
              durationMs: 0,
              retryCount: 0,
              skipped: true,
              error: undefined,
            });
            continue;
          }
        }

        // Execute step with retries
        const result = await this.executeStep(
          step,
          {
            agentId,
            executionId,
            sessionId: validatedOptions?.sessionId,
            input,
            previousOutputs: state.previousOutputs,
            memory: undefined,
            provider: validatedOptions?.provider,
            model: validatedOptions?.model,
            delegationContext: validatedOptions?.delegationContext,
          },
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

        // Store output for dependencies
        if (result.success && result.output !== undefined) {
          state.previousOutputs[step.stepId] = result.output;
        }

        // Stop on failure (unless parallel execution)
        if (!result.success && !step.parallel) {
          break;
        }
      }

      // Determine final status
      const allSuccess = stepResults.every((r) => r.success || r.skipped);
      const finalOutput = this.collectOutputs(stepResults, state.previousOutputs);

      state.status = allSuccess ? 'completed' : 'failed';
      state.completedAt = new Date().toISOString();
      state.stepResults = stepResults;

      return {
        success: allSuccess,
        agentId,
        sessionId: validatedOptions?.sessionId,
        output: finalOutput,
        stepResults,
        totalDurationMs: Date.now() - startTime,
        error: allSuccess
          ? undefined
          : stepResults.find((r) => r.error !== undefined)?.error,
      };
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
   * Cancel a running agent execution
   */
  async cancel(executionId: string): Promise<void> {
    const state = this.executions.get(executionId);
    if (state?.status === 'running') {
      state.status = 'cancelled';
      state.completedAt = new Date().toISOString();
    }
  }

  /**
   * Get execution status
   */
  async getStatus(executionId: string): Promise<ExecutionStatus | undefined> {
    const state = this.executions.get(executionId);
    if (state === undefined) {
      return undefined;
    }

    const completedSteps = state.stepResults.filter(
      (r) => r.success || r.skipped
    ).length;
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
        percentComplete:
          totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      },
    };
  }

  /**
   * Register a step executor for a specific step type
   */
  registerStepExecutor(type: string, executor: StepExecutorFn): void {
    this.stepExecutors.set(type, executor);
  }

  /**
   * Execute a single step with retry logic
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
      // Apply timeout with proper cleanup
      const timeout = step.timeoutMs ?? this.config.defaultTimeout;
      const { promise: timeoutPromise, cancel: cancelTimeout } = this.createTimeout(timeout, step.stepId);

      try {
        const result = await Promise.race([
          executor(step, context),
          timeoutPromise,
        ]);
        cancelTimeout(); // Clean up the timer

        if (result.success) {
          return {
            ...result,
            retryCount,
          };
        }

        lastError = result.error;
        retryCount++;

        // Apply backoff
        if (attempt < maxAttempts - 1 && step.retryPolicy !== undefined) {
          const backoff =
            step.retryPolicy.backoffMs *
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

    return {
      success: false,
      error: lastError,
      durationMs: 0,
      retryCount,
    };
  }

  /**
   * Check if step dependencies are met
   */
  private checkDependencies(
    step: AgentWorkflowStep,
    results: StepResult[]
  ): boolean {
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
  private evaluateCondition(
    condition: string,
    outputs: Record<string, unknown>
  ): boolean {
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
        const expectedValue = this.parseValue(rawValue!.trim());
        return this.compareValues(actualValue, expectedValue, op!);
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
   * Parse a value string into its actual type
   */
  private parseValue(value: string): unknown {
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
  private compareValues(actual: unknown, expected: unknown, op: string): boolean {
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
   * Collect final outputs from step results
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
   * Create timeout promise with cancellation support
   */
  private createTimeout(ms: number, stepId: string): {
    promise: Promise<StepExecutionResult>;
    cancel: () => void;
  } {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const promise = new Promise<StepExecutionResult>((resolve) => {
      timeoutId = setTimeout(
        () =>
          { resolve({
            success: false,
            error: {
              code: AgentErrorCode.AGENT_STAGE_FAILED,
              message: `Step "${stepId}" timed out after ${ms}ms`,
              stepId,
              retryable: true,
            },
            durationMs: ms,
            retryCount: 0,
          }); },
        ms
      );
    });

    const cancel = (): void => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };

    return { promise, cancel };
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Substitute template variables in a string
   * Supports: ${input}, ${input.field}, ${previousOutputs.stepId}, ${agent.field}
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
          // Try to get from input directly
          value = this.getNestedValue(context.input, parts);
      }

      if (value === undefined) {
        return match; // Keep original if not found
      }

      return typeof value === 'string' ? value : JSON.stringify(value);
    });
  }

  /**
   * Get nested value from object using path array
   */
  private getNestedValue(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  /**
   * Register default step executors
   */
  private registerDefaultExecutors(): void {
    // Prompt step executor - executes real LLM calls via promptExecutor
    // INV-AGT-ABL-001: Abilities injected before prompt execution
    this.stepExecutors.set('prompt', async (step, context) => {
      const startTime = Date.now();
      const config = (step.config ?? {}) as PromptStepConfig;

      // Get agent profile for system prompt and variable substitution
      const agent = await this.registry.get(context.agentId);
      const agentProfile: { description?: string; systemPrompt?: string; agentId: string } = {
        agentId: context.agentId,
      };
      if (agent?.description !== undefined) {
        agentProfile.description = agent.description;
      }
      if (agent?.systemPrompt !== undefined) {
        agentProfile.systemPrompt = agent.systemPrompt;
      }

      // INV-AGT-ABL-001: Inject abilities if ability manager is available
      // INV-AGT-ABL-002: Core abilities from agent profile are always included
      // INV-AGT-ABL-003: Token limits are respected
      let abilityContent = '';
      if (this.enableAbilityInjection && this.abilityManager !== undefined) {
        try {
          // Get core abilities from agent profile
          const coreAbilities = agent?.abilities?.core ?? [];

          // Determine task from input for relevance matching
          const task = typeof context.input === 'string'
            ? context.input
            : typeof context.input === 'object' && context.input !== null && 'task' in context.input
              ? String((context.input as { task: unknown }).task)
              : typeof context.input === 'object' && context.input !== null && 'prompt' in context.input
                ? String((context.input as { prompt: unknown }).prompt)
                : agent?.description ?? '';

          // Inject abilities
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
          // Just log and continue without abilities
        }
      }

      // Build the prompt from config or input
      let promptText: string;
      if (config.prompt) {
        // Use template from config with variable substitution
        promptText = this.substituteVariables(config.prompt, context, agentProfile);
      } else if (typeof context.input === 'string') {
        // Use input directly as prompt
        promptText = context.input;
      } else if (
        context.input !== null &&
        typeof context.input === 'object' &&
        'prompt' in context.input &&
        typeof (context.input as { prompt: unknown }).prompt === 'string'
      ) {
        // Use input.prompt
        promptText = (context.input as { prompt: string }).prompt;
      } else {
        // Default: stringify input as the prompt
        promptText = JSON.stringify(context.input, null, 2);
      }

      // Determine system prompt with injected abilities
      const baseSystemPrompt = config.systemPrompt ?? agent?.systemPrompt ?? '';
      const systemPrompt = abilityContent
        ? `${baseSystemPrompt}${abilityContent}`
        : baseSystemPrompt || undefined;

      // Execute the prompt
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
      } else {
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
      }
    });

    // Tool step executor (INV-TOOL-001, INV-TOOL-002, INV-TOOL-003)
    this.stepExecutors.set('tool', async (step, context) => {
      const startTime = Date.now();
      const config = step.config as {
        toolName?: string;
        tool?: string; // Alias for toolName (backwards compatibility)
        toolInput?: Record<string, unknown>;
      } | undefined;

      // Support both 'toolName' and 'tool' for backwards compatibility
      const toolName = config?.toolName ?? config?.tool;
      const toolInput = (config?.toolInput ?? context.input ?? {}) as Record<string, unknown>;

      // If no tool executor is configured, return placeholder result
      if (this.toolExecutor === undefined) {
        return {
          success: true,
          output: {
            step: step.stepId,
            type: 'tool',
            toolName: toolName ?? 'unknown',
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
          },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        };
      }

      // Execute the tool
      try {
        const result = await this.toolExecutor.execute(toolName, toolInput);
        return {
          success: result.success,
          output: {
            step: step.stepId,
            type: 'tool',
            toolName,
            toolOutput: result.output,
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
    this.stepExecutors.set('conditional', async (step, _context) => {
      const startTime = Date.now();
      return {
        success: true,
        output: { step: step.stepId, type: 'conditional' },
        error: undefined,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Loop step executor
    this.stepExecutors.set('loop', async (step, _context) => {
      const startTime = Date.now();
      return {
        success: true,
        output: { step: step.stepId, type: 'loop' },
        error: undefined,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Parallel step executor
    this.stepExecutors.set('parallel', async (step, _context) => {
      const startTime = Date.now();
      return {
        success: true,
        output: { step: step.stepId, type: 'parallel' },
        error: undefined,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    });

    // Delegate step executor - integrates with DelegationTracker
    // INV-DT-001: Depth never exceeds maxDepth
    // INV-DT-002: No circular delegations
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

      // Check if delegation is allowed (INV-DT-001, INV-DT-002)
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

      // Get target agent profile
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

      // Create child context for the delegated agent
      const childContext = delegationTracker.createChildContext(config.targetAgentId);

      // Execute the delegated agent recursively
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

        // Record the delegation result
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
 * Execution state (internal)
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
 * Creates a new agent executor
 */
export function createAgentExecutor(
  registry: AgentRegistry,
  config: AgentDomainConfig
): AgentExecutor {
  return new DefaultAgentExecutor(registry, config);
}
