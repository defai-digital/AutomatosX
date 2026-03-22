import { getErrorMessage, TIMEOUT_AGENT_STEP_DEFAULT } from '@defai.digital/contracts';
export function createRealStepExecutor(config) {
    const { promptExecutor, toolExecutor, discussionExecutor, defaultProvider, defaultModel } = config;
    return async (step, context) => {
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
                    const _exhaustive = step.type;
                    return {
                        stepId: step.stepId,
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
        }
        catch (error) {
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
async function executePromptStep(step, context, promptExecutor, defaultProvider, defaultModel, startTime) {
    const config = (isRecord(step.config) ? step.config : {});
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
    const executeRequest = { prompt };
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
async function executeToolStep(step, context, toolExecutor, startTime) {
    const config = (isRecord(step.config) ? step.config : {});
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
function executeConditionalStep(step, context, startTime) {
    const config = (isRecord(step.config) ? step.config : {});
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
function executeLoopStep(step, context, startTime) {
    const config = (isRecord(step.config) ? step.config : {});
    let items = config.items ?? [];
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
function executeParallelStep(step, startTime) {
    const config = step.config;
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
async function executeDiscussStep(step, context, discussionExecutor, startTime) {
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
    const discussConfig = {
        pattern: rawConfig.pattern ?? 'synthesis',
        rounds: Number.isFinite(rawRounds) ? rawRounds : 2,
        providers: rawConfig.providers,
        prompt: rawConfig.prompt,
        providerPrompts: rawConfig.providerPrompts,
        roles: rawConfig.roles,
        consensus: rawConfig.consensus ?? {
            method: 'synthesis',
            synthesizer: 'claude',
        },
        providerTimeout: Number.isFinite(rawProviderTimeout) ? rawProviderTimeout : TIMEOUT_AGENT_STEP_DEFAULT,
        continueOnProviderFailure: rawConfig.continueOnProviderFailure ?? true,
        minProviders: Number.isFinite(rawMinProviders) ? rawMinProviders : 1,
        temperature: Number.isFinite(rawTemperature) ? rawTemperature : 0.7,
        context: rawConfig.context,
        verbose: rawConfig.verbose ?? false,
    };
    if (context.input && typeof context.input === 'object') {
        const inputObj = context.input;
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
    }
    catch (error) {
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
function resolvePrompt(configPrompt, input) {
    if (configPrompt) {
        return configPrompt;
    }
    if (typeof input === 'string') {
        return input;
    }
    if (input && typeof input === 'object') {
        const inputObj = input;
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
function resolveToolInput(configToolInput, input) {
    if (configToolInput) {
        return configToolInput;
    }
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        return input;
    }
    return {};
}
function evaluateCondition(condition, context) {
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
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function getNestedValue(context, path) {
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
