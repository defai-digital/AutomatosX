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

export interface DelegateAgentLike {
  agentId: string;
  name: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface DelegateRunResultLike {
  success: boolean;
  content: string;
  provider?: string;
  model?: string;
  latencyMs: number;
  error?: { code?: string; message?: string };
}

export interface DelegateExecutorLike {
  /** Look up a registered agent by ID. Returns undefined if not found. */
  getAgent(agentId: string): Promise<DelegateAgentLike | undefined>;
  /** Execute the named agent with the given task/input. */
  runAgent(request: {
    agentId: string;
    task?: string;
    input?: Record<string, unknown>;
    provider?: string;
    model?: string;
    parentTraceId?: string;
  }): Promise<DelegateRunResultLike>;
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
  delegateExecutor?: DelegateExecutorLike;
  defaultProvider?: string;
  defaultModel?: string;
  /** Maximum agent delegation depth. Defaults to 3. */
  maxDelegationDepth?: number;
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
  const {
    promptExecutor,
    toolExecutor,
    discussionExecutor,
    delegateExecutor,
    defaultProvider,
    defaultModel,
    maxDelegationDepth = 3,
  } = config;

  // Per-executor delegation depth tracker: agentId → current depth
  const delegationDepths = new Map<string, number>();
  // Delegation chain for circular detection: tracks active agent IDs in current chain
  const activeDelegationChain: string[] = [];

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
          return executeDelegateStep(
            step,
            context,
            delegateExecutor,
            defaultProvider,
            defaultModel,
            maxDelegationDepth,
            delegationDepths,
            activeDelegationChain,
            startTime,
          );
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
  const toolName = config.toolName ?? step.tool;
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
  const config = step.config as { steps?: unknown[]; tasks?: unknown[] } | undefined;
  const parallelSteps = Array.isArray(config?.steps)
    ? config.steps
    : Array.isArray(config?.tasks)
      ? config.tasks
      : [];

  return Promise.resolve({
    stepId: step.stepId,
    success: true,
    output: {
      type: 'parallel',
      parallelSteps,
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

interface DelegateStepConfig {
  targetAgentId?: string;
  task?: string;
  input?: Record<string, unknown>;
}

async function executeDelegateStep(
  step: WorkflowStep,
  context: StepContext,
  delegateExecutor: DelegateExecutorLike | undefined,
  defaultProvider: string | undefined,
  defaultModel: string | undefined,
  maxDelegationDepth: number,
  delegationDepths: Map<string, number>,
  activeDelegationChain: string[],
  startTime: number,
): Promise<StepResult> {
  if (delegateExecutor === undefined) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DELEGATE_EXECUTOR_NOT_CONFIGURED',
        message: 'Delegate steps require a DelegateExecutor. Configure it in RealStepExecutorConfig.',
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  const config = (isRecord(step.config) ? step.config : {}) as DelegateStepConfig;

  if (!config.targetAgentId || config.targetAgentId.trim() === '') {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DELEGATE_CONFIG_ERROR',
        message: `Delegate step "${step.stepId}" requires targetAgentId in config`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  const { targetAgentId } = config;

  // INV-DT-002: No circular delegations
  if (activeDelegationChain.includes(targetAgentId)) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DELEGATE_CIRCULAR_REFERENCE',
        message: `Circular delegation detected: "${targetAgentId}" is already in the delegation chain [${activeDelegationChain.join(' → ')}]`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // INV-DT-001: Depth never exceeds maxDelegationDepth
  const currentDepth = delegationDepths.get(targetAgentId) ?? 0;
  if (currentDepth >= maxDelegationDepth) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DELEGATE_MAX_DEPTH_EXCEEDED',
        message: `Max delegation depth (${String(maxDelegationDepth)}) exceeded for agent "${targetAgentId}"`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Look up target agent in registry
  const targetAgent = await delegateExecutor.getAgent(targetAgentId);
  if (targetAgent === undefined) {
    return {
      stepId: step.stepId,
      success: false,
      error: {
        code: 'DELEGATE_AGENT_NOT_FOUND',
        message: `Delegation target "${targetAgentId}" not found in agent registry`,
        retryable: false,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  // Push into delegation chain before executing
  activeDelegationChain.push(targetAgentId);
  delegationDepths.set(targetAgentId, currentDepth + 1);

  try {
    const delegateInput = config.input ?? (
      context.input && typeof context.input === 'object' && !Array.isArray(context.input)
        ? (context.input as Record<string, unknown>)
        : undefined
    );

    const result = await delegateExecutor.runAgent({
      agentId: targetAgentId,
      task: config.task,
      input: delegateInput,
      provider: defaultProvider,
      model: defaultModel,
    });

    return {
      stepId: step.stepId,
      success: result.success,
      output: {
        type: 'delegate',
        delegatedTo: targetAgentId,
        agentName: targetAgent.name,
        capabilities: targetAgent.capabilities,
        content: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        delegationDepth: currentDepth + 1,
      },
      error: result.success ? undefined : {
        code: result.error?.code ?? 'DELEGATE_EXECUTION_FAILED',
        message: result.error?.message ?? `Delegated agent "${targetAgentId}" failed`,
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
        code: 'DELEGATE_EXECUTION_ERROR',
        message: getErrorMessage(error, `Delegation to "${targetAgentId}" threw an error`),
        retryable: true,
      },
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  } finally {
    // Always restore delegation chain on exit
    const chainIndex = activeDelegationChain.lastIndexOf(targetAgentId);
    if (chainIndex !== -1) {
      activeDelegationChain.splice(chainIndex, 1);
    }
    delegationDepths.set(targetAgentId, currentDepth);
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
  try {
    // Handle logical OR (lower precedence)
    const orParts = splitFactoryByLogicalOp(condition, '||');
    if (orParts.length > 1) {
      return orParts.some((part) => evaluateCondition(part.trim(), context));
    }
    // Handle logical AND
    const andParts = splitFactoryByLogicalOp(condition, '&&');
    if (andParts.length > 1) {
      return andParts.every((part) => evaluateCondition(part.trim(), context));
    }

    const trimmed = condition.trim();

    // Handle negation
    if (trimmed.startsWith('!')) {
      return !evaluateCondition(trimmed.slice(1).trim(), context);
    }

    // Handle parentheses
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      let depth = 0;
      let firstOpenMatchesLast = true;
      for (let i = 0; i < trimmed.length - 1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')') depth--;
        if (depth === 0) { firstOpenMatchesLast = false; break; }
      }
      if (firstOpenMatchesLast) {
        return evaluateCondition(trimmed.slice(1, -1), context);
      }
    }

    // Parse comparison: ${variable} op value
    const comparisonMatch = /^\$\{([^}]+)\}\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(trimmed);
    if (comparisonMatch) {
      const [, varPath, op, rawValue] = comparisonMatch;
      if (varPath && op && rawValue) {
        const actual = getNestedValue(context, varPath);
        const rawConditionValue = rawValue.trim();
        const expected = rawConditionValue.length === 0 ? undefined : parseFactoryConditionValue(rawConditionValue);
        return compareFactoryConditionValues(actual, expected, op);
      }
    }

    // Simple variable reference (truthy check)
    const varMatch = /^\$\{([^}]+)\}$/.exec(trimmed);
    if (varMatch?.[1]) {
      return Boolean(getNestedValue(context, varMatch[1]));
    }

    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    return Boolean(condition);
  } catch {
    return false;
  }
}

function splitFactoryByLogicalOp(condition: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < condition.length; i++) {
    const char = condition[i];
    if (char === '(') { depth++; current += char; }
    else if (char === ')') { depth--; current += char; }
    else if (depth === 0 && condition.slice(i, i + operator.length) === operator) {
      parts.push(current); current = ''; i += operator.length - 1;
    } else { current += char; }
  }
  if (current) parts.push(current);
  return parts;
}

function parseFactoryConditionValue(value: string): unknown {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

function compareFactoryConditionValues(actual: unknown, expected: unknown, op: string): boolean {
  switch (op) {
    case '===': return actual === expected;
    case '!==': return actual !== expected;
    // eslint-disable-next-line eqeqeq
    case '==': return actual == expected;
    // eslint-disable-next-line eqeqeq
    case '!=': return actual != expected;
    case '>':  return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '<':  return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case '>=': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    default:   return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// INV-WF-SEC-001: Block prototype chain access to prevent prototype pollution
const DANGEROUS_PROPS_FACTORY = new Set(['__proto__', 'constructor', 'prototype']);

function getNestedValue(context: StepContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (DANGEROUS_PROPS_FACTORY.has(part)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
