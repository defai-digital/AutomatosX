import { getErrorMessage, TIMEOUT_AGENT_STEP_DEFAULT, type WorkflowStep } from '@defai.digital/contracts';
import type { StepContext, StepExecutor, StepResult } from './types.js';

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

export interface DiscussionExecutorLike {
  execute(
    config: DiscussStepConfigLike,
    options?: {
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEventLike) => void;
    },
  ): Promise<DiscussionResultLike>;
}

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

export interface DiscussionProgressEventLike {
  type: string;
  round?: number | undefined;
  provider?: string | undefined;
  message?: string | undefined;
  timestamp: string;
}

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

export interface RealStepExecutorConfig {
  promptExecutor: PromptExecutorLike;
  toolExecutor?: ToolExecutorLike;
  discussionExecutor?: DiscussionExecutorLike;
  defaultProvider?: string;
  defaultModel?: string;
}

interface PromptStepConfig {
  prompt?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

interface ToolStepConfig {
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

interface ConditionalStepConfig {
  condition?: string;
  thenSteps?: string[];
  elseSteps?: string[];
}

interface LoopStepConfig {
  items?: unknown[];
  itemsPath?: string;
  maxIterations?: number;
  bodySteps?: string[];
}

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
          return executeParallelStep(step, startTime);
        case 'discuss':
          return executeDiscussStep(step, context, discussionExecutor, startTime);
        case 'delegate':
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
        default: {
          const _exhaustive: never = step.type;
          return {
            stepId: (step as { stepId: string }).stepId,
            success: false,
            error: {
              code: 'UNKNOWN_STEP_TYPE',
              message: `Unknown step type: ${String(_exhaustive)}`,
              retryable: false,
            },
            durationMs: Date.now() - startTime,
            retryCount: 0,
          };
        }
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

async function executePromptStep(
  step: WorkflowStep,
  context: StepContext,
  promptExecutor: PromptExecutorLike,
  defaultProvider: string | undefined,
  defaultModel: string | undefined,
  startTime: number,
): Promise<StepResult> {
  const config = (isRecord(step.config) ? step.config : {}) as PromptStepConfig;
  const prompt = resolvePrompt(config.prompt, context.input);

  if (prompt.trim() === '') {
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

  const executeRequest: Parameters<typeof promptExecutor.execute>[0] = { prompt };
  if (config.systemPrompt !== undefined) {
    executeRequest.systemPrompt = config.systemPrompt;
  }
  if ((config.provider ?? defaultProvider) !== undefined) {
    executeRequest.provider = config.provider ?? defaultProvider;
  }
  if ((config.model ?? defaultModel) !== undefined) {
    executeRequest.model = config.model ?? defaultModel;
  }
  if (config.maxTokens !== undefined) {
    executeRequest.maxTokens = config.maxTokens;
  }
  if (config.temperature !== undefined) {
    executeRequest.temperature = config.temperature;
  }
  if ((config.timeout ?? step.timeout) !== undefined) {
    executeRequest.timeout = config.timeout ?? step.timeout;
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
  }

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

async function executeToolStep(
  step: WorkflowStep,
  context: StepContext,
  toolExecutor: ToolExecutorLike | undefined,
  startTime: number,
): Promise<StepResult> {
  const config = (isRecord(step.config) ? step.config : {}) as ToolStepConfig;
  const toolName = config.toolName;
  const toolInput = resolveToolInput(config.toolInput, context.input);

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

function executeConditionalStep(
  step: WorkflowStep,
  context: StepContext,
  startTime: number,
): Promise<StepResult> {
  const config = (isRecord(step.config) ? step.config : {}) as ConditionalStepConfig;
  const conditionMet = config.condition ? evaluateCondition(config.condition, context) : true;

  return Promise.resolve({
    stepId: step.stepId,
    success: true,
    output: {
      type: 'conditional',
      conditionMet,
      branch: conditionMet ? 'then' : 'else',
      nextSteps: conditionMet ? config.thenSteps : config.elseSteps,
    },
    durationMs: Date.now() - startTime,
    retryCount: 0,
  });
}

function executeLoopStep(
  step: WorkflowStep,
  context: StepContext,
  startTime: number,
): Promise<StepResult> {
  const config = (isRecord(step.config) ? step.config : {}) as LoopStepConfig;
  let items: unknown[] = config.items ?? [];

  if (config.itemsPath) {
    const resolved = getNestedValue(context, config.itemsPath);
    items = Array.isArray(resolved) ? resolved : [];
  }

  const originalLength = items.length;
  if (config.maxIterations !== undefined && items.length > config.maxIterations) {
    items = items.slice(0, config.maxIterations);
  }

  return Promise.resolve({
    stepId: step.stepId,
    success: true,
    output: {
      type: 'loop',
      itemCount: items.length,
      truncated: items.length < originalLength,
      items,
      bodySteps: config.bodySteps,
    },
    durationMs: Date.now() - startTime,
    retryCount: 0,
  });
}

function executeParallelStep(
  step: WorkflowStep,
  startTime: number,
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

async function executeDiscussStep(
  step: WorkflowStep,
  context: StepContext,
  discussionExecutor: DiscussionExecutorLike | undefined,
  startTime: number,
): Promise<StepResult> {
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

  if (!rawConfig.providers || !Array.isArray(rawConfig.providers) || rawConfig.providers.length === 0) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DISCUSS_PROVIDERS_INVALID',
        message: `Discuss step "${step.stepId}" requires at least 1 provider`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  const rawMinProviders = rawConfig.minProviders;
  const rawRounds = rawConfig.rounds;
  const rawProviderTimeout = rawConfig.providerTimeout;
  const rawTemperature = rawConfig.temperature;

  const discussConfig: DiscussStepConfigLike = {
    pattern: (rawConfig.pattern as string) ?? 'synthesis',
    rounds: Number.isFinite(rawRounds) ? (rawRounds as number) : 2,
    providers: rawConfig.providers as string[],
    prompt: rawConfig.prompt,
    providerPrompts: rawConfig.providerPrompts as Record<string, string> | undefined,
    roles: rawConfig.roles as Record<string, string> | undefined,
    consensus: (rawConfig.consensus as DiscussStepConfigLike['consensus']) ?? {
      method: 'synthesis',
      synthesizer: 'claude',
    },
    providerTimeout: Number.isFinite(rawProviderTimeout) ? (rawProviderTimeout as number) : TIMEOUT_AGENT_STEP_DEFAULT,
    continueOnProviderFailure: (rawConfig.continueOnProviderFailure as boolean) ?? true,
    minProviders: Number.isFinite(rawMinProviders) ? (rawMinProviders as number) : 1,
    temperature: Number.isFinite(rawTemperature) ? (rawTemperature as number) : 0.7,
    context: rawConfig.context as string | undefined,
    verbose: (rawConfig.verbose as boolean) ?? false,
  };

  if (context.input && typeof context.input === 'object') {
    const inputObj = context.input as Record<string, unknown>;
    if (typeof inputObj.content === 'string') {
      discussConfig.context = discussConfig.context
        ? `${discussConfig.context}\n\nPrevious step output:\n${inputObj.content}`
        : `Previous step output:\n${inputObj.content}`;
    }
  }

  try {
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
    }

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

function resolvePrompt(configPrompt: string | undefined, input: unknown): string {
  if (configPrompt) {
    return configPrompt;
  }
  if (typeof input === 'string') {
    return input;
  }
  if (input && typeof input === 'object') {
    const inputObj = input as Record<string, unknown>;
    if (typeof inputObj.prompt === 'string') {
      return inputObj.prompt;
    }
    if (typeof inputObj.content === 'string') {
      return inputObj.content;
    }
    if (typeof inputObj.message === 'string') {
      return inputObj.message;
    }
    return JSON.stringify(input);
  }
  return '';
}

function resolveToolInput(
  configToolInput: Record<string, unknown> | undefined,
  input: unknown,
): Record<string, unknown> {
  if (configToolInput) {
    return configToolInput;
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function evaluateCondition(condition: string, context: StepContext): boolean {
  if (condition === 'true') {
    return true;
  }
  if (condition === 'false') {
    return false;
  }

  const variableReference = /^\$\{(.+)\}$/.exec(condition);
  if (variableReference?.[1]) {
    return Boolean(getNestedValue(context, variableReference[1]));
  }

  return Boolean(condition);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getNestedValue(context: StepContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
