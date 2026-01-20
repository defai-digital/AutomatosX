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

import { getErrorMessage, TIMEOUT_AGENT_STEP_DEFAULT } from '@defai.digital/contracts';
import type { WorkflowStep } from '@defai.digital/contracts';
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
 * Discussion executor interface (minimal for workflow-engine)
 * Matches the interface from discussion-domain but doesn't require importing it
 */
export interface DiscussionExecutorLike {
  execute(
    config: DiscussStepConfigLike,
    options?: {
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEventLike) => void;
    }
  ): Promise<DiscussionResultLike>;
}

/**
 * Minimal DiscussStepConfig for workflow-engine (avoids importing full schema)
 */
export interface DiscussStepConfigLike {
  pattern: string;
  rounds: number;
  providers: string[];
  prompt: string;
  providerPrompts?: Record<string, string> | undefined;
  roles?: Record<string, string> | undefined;
  consensus: {
    method: string;
    threshold?: number | undefined;
    synthesizer?: string | undefined;
    includeDissent?: boolean | undefined;
  };
  providerTimeout: number;
  continueOnProviderFailure: boolean;
  minProviders: number;
  temperature: number;
  context?: string | undefined;
  verbose: boolean;
}

/**
 * Discussion progress event
 */
export interface DiscussionProgressEventLike {
  type: string;
  round?: number | undefined;
  provider?: string | undefined;
  message?: string | undefined;
  timestamp: string;
}

/**
 * Discussion result
 */
export interface DiscussionResultLike {
  success: boolean;
  pattern: string;
  topic: string;
  participatingProviders: string[];
  failedProviders: string[];
  rounds: {
    roundNumber: number;
    responses: {
      provider: string;
      content: string;
      round: number;
      role?: string | undefined;
      confidence?: number | undefined;
      vote?: string | undefined;
      timestamp: string;
      durationMs: number;
      tokenCount?: number | undefined;
      truncated?: boolean | undefined;
      error?: string | undefined;
    }[];
    durationMs: number;
  }[];
  synthesis: string;
  consensus: {
    method: string;
    winner?: string | undefined;
    votes?: Record<string, number> | undefined;
    confidence?: number | undefined;
    dissent?: string[] | undefined;
  };
  totalDurationMs: number;
  metadata: {
    startedAt: string;
    completedAt: string;
    traceId?: string | undefined;
    sessionId?: string | undefined;
  };
  error?: {
    code: string;
    message: string;
  } | undefined;
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
   * Discussion executor for multi-model discussions (optional)
   */
  discussionExecutor?: DiscussionExecutorLike;

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
  const { promptExecutor, toolExecutor, discussionExecutor, defaultProvider, defaultModel } = config;

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

        case 'discuss':
          return executeDiscussStep(step, context, discussionExecutor, startTime);

        case 'delegate':
          // Delegate steps require agent-domain executor
          return {
            stepId: step.stepId,
            success: false,
            error: {
              code: 'DELEGATE_NOT_IMPLEMENTED',
              message: 'Delegate steps require an agent-domain executor (not yet implemented)',
              retryable: false,
            },
            durationMs: Date.now() - startTime,
            retryCount: 0,
          };

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
          message: getErrorMessage(error),
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
  // INV-WF-013: Handle non-string input (extract prompt field or stringify)
  let prompt: string;
  if (config.prompt) {
    prompt = config.prompt;
  } else if (typeof context.input === 'string') {
    prompt = context.input;
  } else if (context.input && typeof context.input === 'object') {
    const inputObj = context.input as Record<string, unknown>;
    // Try common prompt field names
    if (typeof inputObj.prompt === 'string') {
      prompt = inputObj.prompt;
    } else if (typeof inputObj.content === 'string') {
      prompt = inputObj.content;
    } else if (typeof inputObj.message === 'string') {
      prompt = inputObj.message;
    } else {
      // Fallback to JSON representation
      prompt = JSON.stringify(context.input);
    }
  } else {
    prompt = '';
  }

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
  // INV-WF-014: Safely coerce tool input to Record<string, unknown>
  let toolInput: Record<string, unknown>;
  if (config.toolInput) {
    toolInput = config.toolInput;
  } else if (context.input && typeof context.input === 'object' && !Array.isArray(context.input)) {
    toolInput = context.input as Record<string, unknown>;
  } else {
    toolInput = {};
  }

  // INV-TOOL-003: Tool steps without executor return failure
  if (toolExecutor === undefined) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'TOOL_EXECUTOR_NOT_CONFIGURED',
        message: `Tool step "${step.stepId}" requires a ToolExecutor. Configure it in RealStepExecutorConfig.`,
        retryable: false,
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
  // INV-WF-LOOP-001: Handle null from getNestedValue (nullish coalescing won't catch null)
  let items: unknown[] = config.items ?? [];
  if (config.itemsPath) {
    const resolved = getNestedValue(context, config.itemsPath);
    // Check for both null and non-array values
    items = Array.isArray(resolved) ? resolved : [];
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
  const varMatch = /^\$\{(.+)\}$/.exec(condition);
  if (varMatch) {
    const path = varMatch[1];
    // INV-WF-012: Explicit null check for regex capture group
    if (path) {
      const value = getNestedValue(context, path);
      return Boolean(value);
    }
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

/**
 * Execute a discuss step using the discussion executor
 *
 * Supports multi-model discussions with various patterns (synthesis, debate, critique, voting)
 * and consensus mechanisms.
 */
async function executeDiscussStep(
  step: WorkflowStep,
  context: StepContext,
  discussionExecutor: DiscussionExecutorLike | undefined,
  startTime: number
): Promise<StepResult> {
  // Check if discussion executor is available
  if (discussionExecutor === undefined) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DISCUSSION_EXECUTOR_NOT_CONFIGURED',
        message: 'Discussion steps require a DiscussionExecutor. Configure it in RealStepExecutorConfig.',
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Extract and validate config
  const rawConfig = step.config;

  if (!rawConfig) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DISCUSS_CONFIG_MISSING',
        message: `Discuss step "${step.stepId}" requires configuration`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Check required fields
  if (!rawConfig.prompt || typeof rawConfig.prompt !== 'string') {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DISCUSS_PROMPT_MISSING',
        message: `Discuss step "${step.stepId}" requires a prompt`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  if (!rawConfig.providers || !Array.isArray(rawConfig.providers) || rawConfig.providers.length < 2) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DISCUSS_PROVIDERS_INVALID',
        message: `Discuss step "${step.stepId}" requires at least 2 providers`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Build the discussion config with defaults
  const discussConfig: DiscussStepConfigLike = {
    pattern: (rawConfig.pattern as string) ?? 'synthesis',
    rounds: (rawConfig.rounds as number) ?? 2,
    providers: rawConfig.providers as string[],
    prompt: rawConfig.prompt,
    providerPrompts: rawConfig.providerPrompts as Record<string, string> | undefined,
    roles: rawConfig.roles as Record<string, string> | undefined,
    consensus: (rawConfig.consensus as DiscussStepConfigLike['consensus']) ?? {
      method: 'synthesis',
      synthesizer: 'claude',
    },
    providerTimeout: (rawConfig.providerTimeout as number) ?? TIMEOUT_AGENT_STEP_DEFAULT,
    continueOnProviderFailure: (rawConfig.continueOnProviderFailure as boolean) ?? true,
    minProviders: (rawConfig.minProviders as number) ?? 2,
    temperature: (rawConfig.temperature as number) ?? 0.7,
    context: rawConfig.context as string | undefined,
    verbose: (rawConfig.verbose as boolean) ?? false,
  };

  // Interpolate context from previous step output if needed
  if (context.input && typeof context.input === 'object') {
    const inputObj = context.input as Record<string, unknown>;
    if (inputObj.content && typeof inputObj.content === 'string') {
      // Append previous step content as context
      discussConfig.context = discussConfig.context
        ? `${discussConfig.context}\n\nPrevious step output:\n${inputObj.content}`
        : `Previous step output:\n${inputObj.content}`;
    }
  }

  try {
    // Execute the discussion
    const result = await discussionExecutor.execute(discussConfig);

    if (result.success) {
      return {
        stepId: step.stepId,
        success: true,
        output: {
          type: 'discuss',
          pattern: result.pattern,
          synthesis: result.synthesis,
          participatingProviders: result.participatingProviders,
          failedProviders: result.failedProviders,
          rounds: result.rounds,
          consensus: result.consensus,
          totalDurationMs: result.totalDurationMs,
          metadata: result.metadata,
        },
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    } else {
      return {
        stepId: step.stepId,
        success: false,
        output: {
          type: 'discuss',
          pattern: result.pattern,
          participatingProviders: result.participatingProviders,
          failedProviders: result.failedProviders,
          rounds: result.rounds,
        },
        error: {
          code: result.error?.code ?? 'DISCUSSION_FAILED',
          message: result.error?.message ?? 'Discussion execution failed',
          retryable: true,
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
        code: 'DISCUSSION_EXECUTION_ERROR',
        message: getErrorMessage(error, 'Unknown discussion error'),
        retryable: true,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }
}
