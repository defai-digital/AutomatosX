/**
 * Step Executor Factory
 *
 * Creates real step executors for workflow execution using injected dependencies.
 * Eliminates placeholder implementations by bridging to actual LLM providers and tools.
 *
 * Invariants:
 * - INV-WF-001: Steps execute in defined order
 * - INV-TOOL-001: Tool execution validates inputs
 * - INV-TOOL-002: Tool results are immutable
 */

import type { WorkflowStep } from '@automatosx/contracts';
import type { StepExecutor, StepResult, StepContext } from './types.js';

/**
 * Prompt executor interface (minimal for workflow-engine)
 * Matches the interface from agent-domain but doesn't require importing it
 */
export interface PromptExecutorLike {
  execute(request: {
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    errorCode?: string;
    provider?: string;
    model?: string;
    latencyMs: number;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }>;
  getDefaultProvider(): string;
}

/**
 * Tool executor interface (minimal for workflow-engine)
 * Matches the interface from agent-domain but doesn't require importing it
 */
export interface ToolExecutorLike {
  execute(toolName: string, args: Record<string, unknown>): Promise<{
    success: boolean;
    output?: unknown;
    error?: string;
    errorCode?: string;
    retryable?: boolean;
    durationMs?: number;
  }>;
  isToolAvailable(toolName: string): boolean;
  getAvailableTools(): string[];
}

/**
 * Configuration for creating a real step executor
 */
export interface RealStepExecutorConfig {
  /**
   * Prompt executor for LLM calls
   */
  promptExecutor: PromptExecutorLike;

  /**
   * Tool executor for tool calls (optional)
   */
  toolExecutor?: ToolExecutorLike;

  /**
   * Default provider for prompts
   */
  defaultProvider?: string;

  /**
   * Default model for prompts
   */
  defaultModel?: string;
}

/**
 * Prompt step configuration
 */
interface PromptStepConfig {
  prompt?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * Tool step configuration
 */
interface ToolStepConfig {
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

/**
 * Conditional step configuration
 */
interface ConditionalStepConfig {
  condition?: string;
  thenSteps?: string[];
  elseSteps?: string[];
}

/**
 * Loop step configuration
 */
interface LoopStepConfig {
  items?: unknown[];
  itemsPath?: string;
  maxIterations?: number;
  bodySteps?: string[];
}

/**
 * Creates a real step executor with actual prompt and tool execution
 *
 * @param config - Configuration with prompt and tool executors
 * @returns A step executor function
 */
export function createRealStepExecutor(config: RealStepExecutorConfig): StepExecutor {
  const { promptExecutor, toolExecutor, defaultProvider, defaultModel } = config;

  return async (step: WorkflowStep, context: StepContext): Promise<StepResult> => {
    const startTime = Date.now();

    try {
      switch (step.type) {
        case 'prompt':
          return executePromptStep(step, context, promptExecutor, defaultProvider, defaultModel, startTime);

        case 'tool':
          return executeToolStep(step, context, toolExecutor, startTime);

        case 'conditional':
          return executeConditionalStep(step, context, startTime);

        case 'loop':
          return executeLoopStep(step, context, startTime);

        case 'parallel':
          return executeParallelStep(step, context, startTime);

        default:
          return {
            stepId: step.stepId,
            success: false,
            error: {
              code: 'UNKNOWN_STEP_TYPE',
              message: `Unknown step type: ${step.type}`,
              retryable: false,
            },
            durationMs: Date.now() - startTime,
            retryCount: 0,
          };
      }
    } catch (error) {
      return {
        stepId: step.stepId,
        success: false,
        error: {
          code: 'STEP_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    }
  };
}

/**
 * Execute a prompt step using the prompt executor
 */
async function executePromptStep(
  step: WorkflowStep,
  context: StepContext,
  promptExecutor: PromptExecutorLike,
  defaultProvider: string | undefined,
  defaultModel: string | undefined,
  startTime: number
): Promise<StepResult> {
  const config = (step.config ?? {}) as PromptStepConfig;

  // Build prompt from config or input
  const prompt = config.prompt ?? String(context.input ?? '');

  if (!prompt || prompt.trim() === '') {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'PROMPT_CONFIG_ERROR',
        message: `Prompt step "${step.stepId}" requires a prompt`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Build execute request, filtering out undefined values
  const executeRequest: Parameters<typeof promptExecutor.execute>[0] = {
    prompt,
  };
  if (config.systemPrompt !== undefined) {
    executeRequest.systemPrompt = config.systemPrompt;
  }
  const provider = config.provider ?? defaultProvider;
  if (provider !== undefined) {
    executeRequest.provider = provider;
  }
  const model = config.model ?? defaultModel;
  if (model !== undefined) {
    executeRequest.model = model;
  }
  if (config.maxTokens !== undefined) {
    executeRequest.maxTokens = config.maxTokens;
  }
  if (config.temperature !== undefined) {
    executeRequest.temperature = config.temperature;
  }
  const timeout = config.timeout ?? step.timeout;
  if (timeout !== undefined) {
    executeRequest.timeout = timeout;
  }

  const response = await promptExecutor.execute(executeRequest);

  if (response.success) {
    return {
      stepId: step.stepId,
      success: true,
      output: {
        content: response.content,
        provider: response.provider,
        model: response.model,
        usage: response.usage,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  } else {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: response.errorCode ?? 'PROMPT_EXECUTION_FAILED',
        message: response.error ?? 'Prompt execution failed',
        retryable: true,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }
}

/**
 * Execute a tool step using the tool executor
 */
async function executeToolStep(
  step: WorkflowStep,
  context: StepContext,
  toolExecutor: ToolExecutorLike | undefined,
  startTime: number
): Promise<StepResult> {
  const config = (step.config ?? {}) as ToolStepConfig;
  const toolName = config.toolName;
  const toolInput = (config.toolInput ?? context.input ?? {}) as Record<string, unknown>;

  // If no tool executor is configured
  if (toolExecutor === undefined) {
    return {
      stepId: step.stepId,
      success: true,
      output: {
        type: 'tool',
        toolName: toolName ?? 'unknown',
        status: 'no_executor',
        message: 'Tool execution requires a ToolExecutor.',
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Validate tool name
  if (toolName === undefined || toolName.trim() === '') {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'TOOL_CONFIG_ERROR',
        message: `Tool step "${step.stepId}" requires toolName in config`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Check tool availability
  if (!toolExecutor.isToolAvailable(toolName)) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Tool "${toolName}" is not available`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Execute the tool
  const result = await toolExecutor.execute(toolName, toolInput);

  return {
    stepId: step.stepId,
    success: result.success,
    output: {
      type: 'tool',
      toolName,
      toolOutput: result.output,
    },
    error: result.success ? undefined : {
      code: result.errorCode ?? 'TOOL_EXECUTION_ERROR',
      message: result.error ?? 'Tool execution failed',
      retryable: result.retryable ?? true,
    },
    durationMs: Date.now() - startTime,
    retryCount: 0,
  };
}

/**
 * Execute a conditional step
 */
function executeConditionalStep(
  step: WorkflowStep,
  context: StepContext,
  startTime: number
): Promise<StepResult> {
  const config = (step.config ?? {}) as ConditionalStepConfig;

  // Evaluate condition (simple truthy check for now)
  const conditionResult = config.condition
    ? evaluateCondition(config.condition, context)
    : true;

  return Promise.resolve({
    stepId: step.stepId,
    success: true,
    output: {
      type: 'conditional',
      conditionMet: conditionResult,
      branch: conditionResult ? 'then' : 'else',
      nextSteps: conditionResult ? config.thenSteps : config.elseSteps,
    },
    durationMs: Date.now() - startTime,
    retryCount: 0,
  });
}

/**
 * Execute a loop step
 */
function executeLoopStep(
  step: WorkflowStep,
  context: StepContext,
  startTime: number
): Promise<StepResult> {
  const config = (step.config ?? {}) as LoopStepConfig;

  // Get items to iterate
  let items: unknown[] = config.items ?? [];
  if (config.itemsPath) {
    items = getNestedValue(context, config.itemsPath) as unknown[] ?? [];
  }

  // Apply max iterations
  if (config.maxIterations !== undefined && items.length > config.maxIterations) {
    items = items.slice(0, config.maxIterations);
  }

  return Promise.resolve({
    stepId: step.stepId,
    success: true,
    output: {
      type: 'loop',
      itemCount: items.length,
      items,
      bodySteps: config.bodySteps,
    },
    durationMs: Date.now() - startTime,
    retryCount: 0,
  });
}

/**
 * Execute a parallel step
 */
function executeParallelStep(
  step: WorkflowStep,
  _context: StepContext,
  startTime: number
): Promise<StepResult> {
  const config = step.config as { steps?: string[] } | undefined;

  return Promise.resolve({
    stepId: step.stepId,
    success: true,
    output: {
      type: 'parallel',
      parallelSteps: config?.steps ?? [],
    },
    durationMs: Date.now() - startTime,
    retryCount: 0,
  });
}

/**
 * Simple condition evaluator
 * Supports: "true", "false", "${variable}" checks
 */
function evaluateCondition(condition: string, context: StepContext): boolean {
  if (condition === 'true') return true;
  if (condition === 'false') return false;

  // Check for variable reference ${...}
  const varMatch = condition.match(/^\$\{(.+)\}$/);
  if (varMatch) {
    const path = varMatch[1];
    const value = getNestedValue(context, path ?? '');
    return Boolean(value);
  }

  // Default to truthy
  return Boolean(condition);
}

/**
 * Get nested value from context
 */
function getNestedValue(context: StepContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
