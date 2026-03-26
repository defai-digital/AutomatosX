import { TIMEOUT_AGENT_STEP_DEFAULT } from '@defai.digital/contracts';
import type {
  AgentEntry,
  StateStore,
} from '@defai.digital/state-store';
import type { TraceStore } from '@defai.digital/trace-store';
import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';
import type {
  RuntimeAgentRecommendRequest,
  RuntimeAgentRecommendation,
  RuntimeAgentRunRequest,
  RuntimeAgentRunResponse,
  RuntimeDiscussionRequest,
  RuntimeDiscussionResponse,
  RuntimeParallelPlan,
  RuntimeParallelRunRequest,
  RuntimeParallelRunResponse,
  RuntimeParallelTask,
  RuntimeParallelTaskResult,
  RuntimeRecursiveDiscussionRequest,
  RuntimeRecursiveDiscussionResponse,
  SharedRuntimeService,
} from './index.js';
import { buildSessionTask, ensureSessionRecord } from './runtime-session-support.js';

interface ProviderBridgeLike {
  executePrompt(request: ProviderExecutionRequest): Promise<ProviderExecutionOutcome>;
}

interface DiscussionCoordinatorResult {
  success: boolean;
  pattern: string;
  topic: string;
  participatingProviders: string[];
  failedProviders: string[];
  rounds: RuntimeDiscussionResponse['rounds'];
  synthesis: string;
  consensus: RuntimeDiscussionResponse['consensus'];
  totalDurationMs: number;
  metadata: {
    executionMode?: 'simulated' | 'subprocess' | 'mixed';
  } & Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
}

interface DiscussionCoordinatorLike {
  run(request: {
    traceId: string;
    provider?: string;
    config: {
      pattern: string;
      rounds: number;
      providers: string[];
      prompt: string;
      providerPrompts?: Record<string, string>;
      roles?: Record<string, string>;
      consensus: {
        method: string;
        threshold?: number;
        synthesizer?: string;
        includeDissent?: boolean;
      };
      providerTimeout: number;
      continueOnProviderFailure: boolean;
      minProviders: number;
      temperature: number;
      context?: string;
      verbose: boolean;
    };
  }): Promise<DiscussionCoordinatorResult>;
}

export interface RuntimeOrchestrationServiceConfig {
  basePath: string;
  traceStore: TraceStore;
  stateStore: StateStore;
  resolveProviderBridge(requestBasePath?: string): ProviderBridgeLike;
  resolveDiscussionCoordinator(requestBasePath?: string): DiscussionCoordinatorLike;
  createTraceId(): string;
  tokenize(value: string): number;
}

type RuntimeOrchestrationService = Pick<
  SharedRuntimeService,
  | 'runDiscussion'
  | 'runDiscussionQuick'
  | 'runDiscussionRecursive'
  | 'runAgent'
  | 'recommendAgents'
  | 'planParallel'
  | 'runParallel'
>;

export function createRuntimeOrchestrationService(
  config: RuntimeOrchestrationServiceConfig,
): RuntimeOrchestrationService {
  const {
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
    createTraceId,
    tokenize,
  } = config;

  const runDiscussionImpl = async (
    request: RuntimeDiscussionRequest,
  ): Promise<RuntimeDiscussionResponse> => {
    const runtimeDiscussionCoordinator = resolveDiscussionCoordinator(request.basePath);
    const traceId = request.traceId ?? createTraceId();
    const startedAt = new Date().toISOString();
    const providers = normalizeProviders(request.providers, request.provider);
    const pattern = request.pattern ?? 'synthesis';
    const consensusMethod = request.consensusMethod ?? 'synthesis';
    const workflowId = request.command ?? 'discuss';
    await ensureSessionRecord(stateStore, {
      sessionId: request.sessionId,
      task: buildSessionTask('Discuss', request.topic),
      initiator: request.surface ?? 'cli',
      workspace: request.basePath ?? basePath,
      surface: request.surface,
      metadata: {
        command: workflowId,
        provider: request.provider,
        providers,
      },
    });

    await traceStore.upsertTrace({
      traceId,
      workflowId,
      surface: request.surface ?? 'cli',
      status: 'running',
      startedAt,
      input: {
        topic: request.topic,
        pattern,
        rounds: request.rounds ?? 2,
        providers,
        minProviders: request.minProviders ?? Math.max(1, Math.min(2, providers.length)),
        context: request.context,
      },
      stepResults: [],
      metadata: {
        provider: request.provider,
        basePath: request.basePath ?? basePath,
        command: workflowId,
        sessionId: request.sessionId,
        parentTraceId: request.parentTraceId,
        rootTraceId: request.rootTraceId,
      },
    });

    const result = await runtimeDiscussionCoordinator.run({
      traceId,
      provider: request.provider,
      config: {
        pattern,
        rounds: request.rounds ?? 2,
        providers,
        prompt: request.topic,
        consensus: {
          method: consensusMethod,
        },
        providerTimeout: request.timeout ?? TIMEOUT_AGENT_STEP_DEFAULT,
        continueOnProviderFailure: true,
        minProviders: request.minProviders ?? Math.max(1, Math.min(2, providers.length)),
        temperature: request.temperature ?? 0.7,
        context: request.context,
        verbose: request.verbose ?? false,
      },
    });

    const completedAt = new Date().toISOString();
    await traceStore.upsertTrace({
      traceId,
      workflowId,
      surface: request.surface ?? 'cli',
      status: result.success ? 'completed' : 'failed',
      startedAt,
      completedAt,
      input: {
        topic: request.topic,
        pattern,
        rounds: request.rounds ?? 2,
        providers,
        minProviders: request.minProviders ?? Math.max(1, Math.min(2, providers.length)),
        context: request.context,
      },
      stepResults: [
        {
          stepId: 'discussion',
          success: result.success,
          durationMs: result.totalDurationMs,
          retryCount: 0,
          error: result.error?.message,
        },
      ],
      output: {
        type: 'discuss',
        topic: request.topic,
        pattern: result.pattern,
        synthesis: result.synthesis,
        consensus: result.consensus,
        rounds: result.rounds,
        metadata: result.metadata,
      },
      error: result.error,
      metadata: {
        provider: request.provider,
        providers,
        basePath: request.basePath ?? basePath,
        command: workflowId,
        sessionId: request.sessionId,
        parentTraceId: request.parentTraceId,
        rootTraceId: request.rootTraceId,
      },
    });

    return {
      warnings: buildDiscussionWarnings(result),
      traceId,
      topic: request.topic,
      success: result.success,
      pattern: result.pattern,
      providers: result.participatingProviders,
      failedProviders: result.failedProviders,
      executionMode: result.metadata.executionMode,
      rounds: result.rounds,
      synthesis: result.synthesis,
      consensus: result.consensus,
      totalDurationMs: result.totalDurationMs,
      error: result.error,
    };
  };

  const runDiscussionQuickImpl = async (
    request: RuntimeDiscussionRequest,
  ): Promise<RuntimeDiscussionResponse> => runDiscussionImpl({
    ...request,
    rounds: 1,
    minProviders: request.minProviders ?? 1,
    pattern: request.pattern ?? 'quick',
    consensusMethod: request.consensusMethod ?? 'quick',
    command: request.command ?? 'discuss.quick',
  });

  const runDiscussionRecursiveImpl = async (
    request: RuntimeRecursiveDiscussionRequest,
  ): Promise<RuntimeRecursiveDiscussionResponse> => {
    const traceId = request.traceId ?? createTraceId();
    const startedAt = new Date().toISOString();
    const subtopics = request.subtopics
      .map((entry: string) => entry.trim())
      .filter((entry: string) => entry.length > 0);
    await ensureSessionRecord(stateStore, {
      sessionId: request.sessionId,
      task: buildSessionTask('Discuss recursively', request.topic),
      initiator: request.surface ?? 'cli',
      workspace: request.basePath ?? basePath,
      surface: request.surface,
      metadata: {
        command: 'discuss.recursive',
        provider: request.provider,
        subtopicCount: subtopics.length,
      },
    });

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'discuss.recursive',
      surface: request.surface ?? 'cli',
      status: 'running',
      startedAt,
      input: {
        topic: request.topic,
        subtopics,
        pattern: request.pattern ?? 'recursive',
        rounds: request.rounds ?? 2,
        providers: request.providers,
        minProviders: request.minProviders,
        context: request.context,
      },
      stepResults: [],
      metadata: {
        provider: request.provider,
        basePath: request.basePath ?? basePath,
        command: 'discuss.recursive',
        sessionId: request.sessionId,
      },
    });

    const rootTraceId = `${traceId}:root`;
    const root = await runDiscussionImpl({
      ...request,
      traceId: rootTraceId,
      parentTraceId: traceId,
      rootTraceId: traceId,
      command: 'discuss.recursive.root',
      pattern: request.pattern ?? 'recursive',
    });

    const children = await Promise.all(subtopics.map((subtopic: string, index: number) => runDiscussionQuickImpl({
      ...request,
      topic: subtopic,
      traceId: `${traceId}:child:${index + 1}`,
      parentTraceId: traceId,
      rootTraceId: traceId,
      command: 'discuss.recursive.child',
      pattern: 'recursive-child',
    })));

    const success = root.success && children.every((entry: RuntimeDiscussionResponse) => entry.success);
    const warnings = Array.from(new Set([
      ...root.warnings,
      ...children.flatMap((entry: RuntimeDiscussionResponse) => entry.warnings),
    ]));
    const totalDurationMs = root.totalDurationMs + children.reduce(
      (sum: number, entry: RuntimeDiscussionResponse) => sum + entry.totalDurationMs,
      0,
    );
    const completedAt = new Date().toISOString();

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'discuss.recursive',
      surface: request.surface ?? 'cli',
      status: success ? 'completed' : 'failed',
      startedAt,
      completedAt,
      input: {
        topic: request.topic,
        subtopics,
        pattern: request.pattern ?? 'recursive',
        rounds: request.rounds ?? 2,
        providers: request.providers,
        minProviders: request.minProviders,
        context: request.context,
      },
      stepResults: [
        {
          stepId: 'root-discussion',
          success: root.success,
          durationMs: root.totalDurationMs,
          retryCount: 0,
          error: root.error?.message,
        },
        ...children.map((entry: RuntimeDiscussionResponse, index: number) => ({
            stepId: `subtopic-${index + 1}`,
            success: entry.success,
            durationMs: entry.totalDurationMs,
            retryCount: 0,
            error: entry.error?.message,
        })),
      ],
      output: {
        type: 'discuss.recursive',
        topic: request.topic,
        subtopics,
        root,
        children,
        warnings,
      },
      error: success ? undefined : {
        code: 'DISCUSSION_RECURSIVE_FAILED',
        message: 'One or more recursive discussion steps failed.',
      },
      metadata: {
        provider: request.provider,
        providers: request.providers,
        basePath: request.basePath ?? basePath,
        command: 'discuss.recursive',
        sessionId: request.sessionId,
      },
    });

    return {
      traceId,
      topic: request.topic,
      success,
      subtopics,
      root,
      children,
      warnings,
      totalDurationMs,
      error: success ? undefined : {
        code: 'DISCUSSION_RECURSIVE_FAILED',
        message: 'One or more recursive discussion steps failed.',
      },
    };
  };

  const runAgentImpl = async (
    request: RuntimeAgentRunRequest,
  ): Promise<RuntimeAgentRunResponse> => {
    const runtimeProviderBridge = resolveProviderBridge(request.basePath);
    const traceId = request.traceId ?? createTraceId();
    const agent = await stateStore.getAgent(request.agentId);
    const startedAt = new Date().toISOString();
    await ensureSessionRecord(stateStore, {
      sessionId: request.sessionId,
      task: buildSessionTask('Run agent', request.agentId),
      initiator: request.agentId,
      workspace: request.basePath ?? basePath,
      surface: request.surface,
      metadata: {
        command: 'agent.run',
        agentId: request.agentId,
        provider: request.provider,
        model: request.model,
      },
    });

    if (agent === undefined) {
      const error = {
        code: 'AGENT_NOT_FOUND',
        message: `Agent "${request.agentId}" is not registered.`,
      };
      await traceStore.upsertTrace({
        traceId,
        workflowId: 'agent.run',
        surface: request.surface ?? 'cli',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: {
          agentId: request.agentId,
          task: request.task,
          input: request.input,
        },
        stepResults: [],
        error,
        metadata: {
          sessionId: request.sessionId,
          parentTraceId: request.parentTraceId,
          rootTraceId: request.rootTraceId,
          command: 'agent.run',
        },
      });

      return {
        traceId,
        agentId: request.agentId,
        success: false,
        provider: request.provider ?? 'claude',
        model: request.model,
        content: '',
        latencyMs: 0,
        executionMode: 'simulated',
        warnings: [],
        error,
      };
    }

    const metadata = isRecord(agent.metadata) ? agent.metadata : {};
    const resolvedProvider = request.provider ?? asOptionalString(metadata.provider) ?? 'claude';
    const resolvedModel = request.model ?? asOptionalString(metadata.model) ?? 'v14-agent-run';
    const task = resolveAgentTask(request.task, request.input, agent);
    const prompt = buildAgentPrompt(agent, task, request.input, metadata);
    const systemPrompt = resolveAgentSystemPrompt(agent, metadata);

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'agent.run',
      surface: request.surface ?? 'cli',
      status: 'running',
      startedAt,
      input: {
        agentId: agent.agentId,
        task,
        input: request.input,
      },
      stepResults: [],
      metadata: {
        sessionId: request.sessionId,
        parentTraceId: request.parentTraceId,
        rootTraceId: request.rootTraceId,
        agentId: agent.agentId,
        provider: resolvedProvider,
        model: resolvedModel,
        capabilities: agent.capabilities,
        command: 'agent.run',
      },
    });

    const bridgeResult = await runtimeProviderBridge.executePrompt({
      provider: resolvedProvider,
      prompt,
      systemPrompt,
      model: resolvedModel,
      timeoutMs: request.timeoutMs,
    });
    const completedAt = new Date().toISOString();

    if (bridgeResult.type === 'response' || bridgeResult.type === 'failure') {
      const warnings = bridgeResult.type === 'failure'
        ? [bridgeResult.response.error ?? 'Agent execution failed.']
        : [];
      const response = bridgeResult.response;

      await traceStore.upsertTrace({
        traceId,
        workflowId: 'agent.run',
        surface: request.surface ?? 'cli',
        status: response.success ? 'completed' : 'failed',
        startedAt,
        completedAt,
        input: {
          agentId: agent.agentId,
          task,
          input: request.input,
        },
        stepResults: [
          {
            stepId: 'agent-execution',
            success: response.success,
            durationMs: response.latencyMs,
            retryCount: 0,
            error: response.error,
          },
        ],
        output: {
          agentId: agent.agentId,
          content: response.content ?? '',
          usage: response.usage,
          executionMode: 'subprocess',
          warnings,
        },
        error: response.success ? undefined : {
          code: response.errorCode,
          message: response.error,
        },
        metadata: {
          sessionId: request.sessionId,
          parentTraceId: request.parentTraceId,
          rootTraceId: request.rootTraceId,
          agentId: agent.agentId,
          provider: response.provider,
          model: response.model,
          capabilities: agent.capabilities,
          command: 'agent.run',
        },
      });

      return {
        traceId,
        agentId: agent.agentId,
        success: response.success,
        provider: response.provider,
        model: response.model,
        content: response.content ?? '',
        latencyMs: response.latencyMs,
        executionMode: 'subprocess',
        warnings,
        usage: response.usage,
        error: response.success ? undefined : {
          code: response.errorCode,
          message: response.error,
        },
      };
    }

    const content = buildSimulatedAgentOutput(agent, task, request.input);
    const warnings = [`No provider executor configured for "${resolvedProvider}". Returned simulated agent output.`];
    const usage = {
      inputTokens: tokenize(prompt),
      outputTokens: tokenize(content),
      totalTokens: tokenize(prompt) + tokenize(content),
    };

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'agent.run',
      surface: request.surface ?? 'cli',
      status: 'completed',
      startedAt,
      completedAt,
      input: {
        agentId: agent.agentId,
        task,
        input: request.input,
      },
      stepResults: [
        {
          stepId: 'agent-execution',
          success: true,
          durationMs: 0,
          retryCount: 0,
        },
      ],
      output: {
        agentId: agent.agentId,
        content,
        usage,
        executionMode: 'simulated',
        warnings,
      },
      metadata: {
        sessionId: request.sessionId,
        parentTraceId: request.parentTraceId,
        rootTraceId: request.rootTraceId,
        agentId: agent.agentId,
        provider: resolvedProvider,
        model: resolvedModel,
        capabilities: agent.capabilities,
        command: 'agent.run',
      },
    });

    return {
      traceId,
      agentId: agent.agentId,
      success: true,
      provider: resolvedProvider,
      model: resolvedModel,
      content,
      latencyMs: 0,
      executionMode: 'simulated',
      warnings,
      usage,
    };
  };

  const recommendAgentsImpl = async (
    request: RuntimeAgentRecommendRequest,
  ): Promise<RuntimeAgentRecommendation[]> => {
    const agents = await stateStore.listAgents();
    const ranked = rankAgents(agents, request);
    return request.limit === undefined
      ? ranked
      : ranked.slice(0, Math.max(0, request.limit));
  };

  const planParallelImpl = async (
    request: { tasks: RuntimeParallelTask[] },
  ): Promise<RuntimeParallelPlan> => buildParallelPlan(request.tasks);

  const runParallelImpl = async (
    request: RuntimeParallelRunRequest,
  ): Promise<RuntimeParallelRunResponse> => {
    const traceId = request.traceId ?? createTraceId();
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const plan = buildParallelPlan(request.tasks);
    await ensureSessionRecord(stateStore, {
      sessionId: request.sessionId,
      task: buildSessionTask('Run parallel agent batch', `${request.tasks.length} tasks`),
      initiator: request.surface ?? 'mcp',
      workspace: basePath,
      surface: request.surface,
      metadata: {
        command: 'parallel.run',
        taskCount: request.tasks.length,
      },
    });

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'parallel.run',
      surface: request.surface ?? 'mcp',
      status: 'running',
      startedAt,
      input: {
        tasks: request.tasks,
        maxConcurrent: request.maxConcurrent,
        failureStrategy: request.failureStrategy,
        resultAggregation: request.resultAggregation,
      },
      stepResults: [],
      metadata: {
        sessionId: request.sessionId,
        command: 'parallel.run',
      },
    });

    if (!plan.valid) {
      const error = {
        code: 'PARALLEL_PLAN_INVALID',
        message: plan.errors.join('; '),
      };
      const completedAt = new Date().toISOString();
      await traceStore.upsertTrace({
        traceId,
        workflowId: 'parallel.run',
        surface: request.surface ?? 'mcp',
        status: 'failed',
        startedAt,
        completedAt,
        input: {
          tasks: request.tasks,
        },
        stepResults: [],
        error,
        metadata: {
          sessionId: request.sessionId,
          command: 'parallel.run',
        },
      });

      return {
        traceId,
        success: false,
        failureStrategy: request.failureStrategy ?? 'failSafe',
        resultAggregation: request.resultAggregation ?? 'list',
        layers: plan.layers,
        results: [],
        aggregatedResult: [],
        totalDurationMs: Date.now() - startedAtMs,
        error,
      };
    }

    const failureStrategy = request.failureStrategy ?? 'failSafe';
    const resultAggregation = request.resultAggregation ?? 'list';
    const maxConcurrent = Math.max(1, request.maxConcurrent ?? 3);
    const taskMap = new Map(request.tasks.map((task) => [task.taskId, task] as const));
    const results = new Map<string, RuntimeParallelTaskResult>();
    let stopExecution = false;

    for (const layer of plan.layers) {
      if (stopExecution) {
        for (const taskId of layer) {
          const task = taskMap.get(taskId)!;
          results.set(taskId, {
            taskId,
            agentId: task.agentId,
            status: 'skipped',
            dependencies: task.dependencies ?? [],
            error: {
              code: 'PARALLEL_SKIPPED_AFTER_FAILURE',
              message: 'Skipped because failFast stopped the orchestration after a prior failure.',
            },
          });
        }
        continue;
      }

      for (const batch of chunkArray(layer, maxConcurrent)) {
        const batchResults = await Promise.all(batch.map(async (taskId) => {
          const task = taskMap.get(taskId)!;
          const blockedDependency = (task.dependencies ?? []).find((dependency) => {
            const dependencyResult = results.get(dependency);
            return dependencyResult !== undefined && dependencyResult.status !== 'completed';
          });

          if (blockedDependency !== undefined) {
            return {
              taskId,
              agentId: task.agentId,
              status: 'skipped',
              dependencies: task.dependencies ?? [],
              error: {
                code: 'PARALLEL_DEPENDENCY_FAILED',
                message: `Skipped because dependency "${blockedDependency}" did not complete successfully.`,
              },
            } satisfies RuntimeParallelTaskResult;
          }

          const runResult = await runAgentImpl({
            agentId: task.agentId,
            task: task.task,
            input: task.input,
            provider: task.provider,
            model: task.model,
            timeoutMs: task.timeoutMs,
            sessionId: request.sessionId,
            surface: request.surface ?? 'mcp',
            parentTraceId: traceId,
            rootTraceId: traceId,
          });

          return {
            taskId,
            agentId: task.agentId,
            status: runResult.success ? 'completed' : 'failed',
            traceId: runResult.traceId,
            dependencies: task.dependencies ?? [],
            result: runResult,
            error: runResult.success ? undefined : runResult.error,
          } satisfies RuntimeParallelTaskResult;
        }));

        for (const taskResult of batchResults) {
          results.set(taskResult.taskId, taskResult);
        }

        if (failureStrategy === 'failFast' && batchResults.some((entry) => entry.status === 'failed')) {
          stopExecution = true;
        }
      }
    }

    const orderedResults = plan.orderedTaskIds
      .map((taskId) => results.get(taskId))
      .filter((entry): entry is RuntimeParallelTaskResult => entry !== undefined);
    const success = orderedResults.every((entry) => entry.status === 'completed');
    const completedAt = new Date().toISOString();
    const aggregatedResult = aggregateParallelResults(orderedResults, resultAggregation);

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'parallel.run',
      surface: request.surface ?? 'mcp',
      status: success ? 'completed' : 'failed',
      startedAt,
      completedAt,
      input: {
        tasks: request.tasks,
        maxConcurrent,
        failureStrategy,
        resultAggregation,
      },
      stepResults: orderedResults.map((entry) => ({
        stepId: entry.taskId,
        success: entry.status === 'completed',
        durationMs: entry.result?.latencyMs ?? 0,
        retryCount: 0,
        error: entry.error?.message,
      })),
      output: {
        layers: plan.layers,
        results: orderedResults,
        aggregatedResult,
      },
      error: success ? undefined : {
        code: 'PARALLEL_TASK_FAILURE',
        message: 'One or more parallel tasks did not complete successfully.',
      },
      metadata: {
        sessionId: request.sessionId,
        command: 'parallel.run',
      },
    });

    return {
      traceId,
      success,
      failureStrategy,
      resultAggregation,
      layers: plan.layers,
      results: orderedResults,
      aggregatedResult,
      totalDurationMs: Date.now() - startedAtMs,
      error: success ? undefined : {
        code: 'PARALLEL_TASK_FAILURE',
        message: 'One or more parallel tasks did not complete successfully.',
      },
    };
  };

  return {
    runDiscussion: runDiscussionImpl,
    runDiscussionQuick: runDiscussionQuickImpl,
    runDiscussionRecursive: runDiscussionRecursiveImpl,
    runAgent: runAgentImpl,
    recommendAgents: recommendAgentsImpl,
    planParallel: planParallelImpl,
    runParallel: runParallelImpl,
  };
}

function normalizeProviders(explicitProviders: string[] | undefined, providerOverride: string | undefined): string[] {
  if (explicitProviders !== undefined && explicitProviders.length > 0) {
    return Array.from(new Set(explicitProviders.map((entry) => entry.trim()).filter((entry) => entry.length > 0)));
  }

  if (providerOverride !== undefined && providerOverride.trim().length > 0) {
    return [providerOverride.trim()];
  }

  return ['claude', 'openai', 'gemini'];
}

function buildDiscussionWarnings(result: DiscussionCoordinatorResult): string[] {
  const warnings: string[] = [];
  if (result.metadata.executionMode === 'simulated') {
    warnings.push('Discussion used simulated provider output because no real provider executor was available.');
  } else if (result.metadata.executionMode === 'mixed') {
    warnings.push('Discussion used a mix of real and simulated provider output because some executors were unavailable.');
  }
  if (result.failedProviders.length > 0) {
    warnings.push(`Unavailable or dropped providers: ${result.failedProviders.join(', ')}.`);
  }
  return warnings;
}

function buildParallelPlan(tasks: RuntimeParallelTask[]): RuntimeParallelPlan {
  const errors: string[] = [];
  const taskMap = new Map<string, RuntimeParallelTask>();
  for (const task of tasks) {
    if (task.taskId.trim().length === 0) {
      errors.push('parallel tasks require a non-empty taskId');
      continue;
    }
    if (task.agentId.trim().length === 0) {
      errors.push(`parallel task "${task.taskId}" requires a non-empty agentId`);
      continue;
    }
    if (taskMap.has(task.taskId)) {
      errors.push(`duplicate parallel task id: ${task.taskId}`);
      continue;
    }
    taskMap.set(task.taskId, task);
  }

  for (const task of taskMap.values()) {
    for (const dependency of task.dependencies ?? []) {
      if (!taskMap.has(dependency)) {
        errors.push(`parallel task "${task.taskId}" depends on missing task "${dependency}"`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      layers: [],
      orderedTaskIds: [],
      errors,
    };
  }

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const task of taskMap.values()) {
    indegree.set(task.taskId, task.dependencies?.length ?? 0);
    outgoing.set(task.taskId, []);
  }
  for (const task of taskMap.values()) {
    for (const dependency of task.dependencies ?? []) {
      outgoing.get(dependency)!.push(task.taskId);
    }
  }

  const layers: string[][] = [];
  const orderedTaskIds: string[] = [];
  let ready = [...taskMap.values()]
    .filter((task) => (indegree.get(task.taskId) ?? 0) === 0)
    .sort(compareParallelTasks);

  while (ready.length > 0) {
    const currentLayer = ready.map((task) => task.taskId);
    layers.push(currentLayer);
    orderedTaskIds.push(...currentLayer);

    const nextReady: RuntimeParallelTask[] = [];
    for (const task of ready) {
      for (const downstream of outgoing.get(task.taskId) ?? []) {
        const nextDegree = (indegree.get(downstream) ?? 0) - 1;
        indegree.set(downstream, nextDegree);
        if (nextDegree === 0) {
          nextReady.push(taskMap.get(downstream)!);
        }
      }
    }
    ready = nextReady.sort(compareParallelTasks);
  }

  if (orderedTaskIds.length !== taskMap.size) {
    return {
      valid: false,
      layers,
      orderedTaskIds,
      errors: ['parallel task graph contains a cycle'],
    };
  }

  return {
    valid: true,
    layers,
    orderedTaskIds,
    errors: [],
  };
}

function resolveAgentTask(
  task: string | undefined,
  input: Record<string, unknown> | undefined,
  agent: AgentEntry,
): string {
  if (typeof task === 'string' && task.trim().length > 0) {
    return task.trim();
  }

  const candidate = asOptionalString(input?.task) ?? asOptionalString(input?.goal) ?? asOptionalString(input?.prompt);
  if (candidate !== undefined && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return `Run the ${agent.name} agent.`;
}

function resolveAgentSystemPrompt(agent: AgentEntry, metadata: Record<string, unknown>): string {
  const explicit = asOptionalString(metadata.systemPrompt) ?? asOptionalString(metadata.instructions);
  if (explicit !== undefined && explicit.trim().length > 0) {
    return explicit;
  }

  const capabilityLine = agent.capabilities.length > 0
    ? `Capabilities: ${agent.capabilities.join(', ')}.`
    : 'Capabilities: general assistance.';
  return `You are ${agent.name} (${agent.agentId}). ${capabilityLine} Respond concisely and focus on the task.`;
}

function buildAgentPrompt(
  agent: AgentEntry,
  task: string,
  input: Record<string, unknown> | undefined,
  metadata: Record<string, unknown>,
): string {
  const team = asOptionalString(metadata.team);
  const sections = [
    `Agent: ${agent.agentId}`,
    `Task: ${task}`,
    agent.capabilities.length > 0 ? `Capabilities: ${agent.capabilities.join(', ')}` : undefined,
    team !== undefined ? `Team: ${team}` : undefined,
    input !== undefined ? `Input:\n${JSON.stringify(input, null, 2)}` : undefined,
  ];

  return sections.filter((value): value is string => value !== undefined && value.length > 0).join('\n\n');
}

function buildSimulatedAgentOutput(
  agent: AgentEntry,
  task: string,
  input: Record<string, unknown> | undefined,
): string {
  const payload = input === undefined ? '' : `\nInput: ${JSON.stringify(input)}`;
  return `Simulated agent output from ${agent.agentId}.\nTask: ${task}${payload}`;
}

function rankAgents(
  agents: AgentEntry[],
  request: RuntimeAgentRecommendRequest,
): RuntimeAgentRecommendation[] {
  const requiredCapabilities = normalizeRequiredCapabilities(request.requiredCapabilities);
  const taskTokens = tokenizeForMatching(request.task);
  const team = request.team?.trim().toLowerCase();

  return agents
    .filter((agent) => {
      if (requiredCapabilities.length > 0) {
        const capabilitySet = new Set(agent.capabilities.map((entry) => entry.toLowerCase()));
        if (!requiredCapabilities.every((capability) => capabilitySet.has(capability))) {
          return false;
        }
      }

      if (team !== undefined) {
        const metadataTeam = isRecord(agent.metadata)
          ? asOptionalString(agent.metadata.team)?.toLowerCase()
          : undefined;
        if (metadataTeam !== team) {
          return false;
        }
      }

      return true;
    })
    .map((agent) => scoreAgentRecommendation(agent, taskTokens, requiredCapabilities))
    .sort((left, right) => (
      right.score - left.score
      || right.confidence - left.confidence
      || left.agentId.localeCompare(right.agentId)
    ));
}

function scoreAgentRecommendation(
  agent: AgentEntry,
  taskTokens: string[],
  requiredCapabilities: string[],
): RuntimeAgentRecommendation {
  const capabilityMatches = agent.capabilities.filter((capability) => taskTokens.includes(capability.toLowerCase()));
  const nameTokens = tokenizeForMatching(`${agent.agentId} ${agent.name}`);
  const nameMatches = taskTokens.filter((token) => nameTokens.includes(token));
  const metadataTokens = tokenizeForMatching(flattenMetadataText(agent.metadata));
  const metadataMatches = taskTokens.filter((token) => metadataTokens.includes(token) && !nameMatches.includes(token));

  let score = 0;
  const reasons: string[] = [];

  if (requiredCapabilities.length > 0) {
    score += requiredCapabilities.length * 6;
    reasons.push(`Required capabilities matched: ${requiredCapabilities.join(', ')}`);
  }

  if (capabilityMatches.length > 0) {
    score += capabilityMatches.length * 4;
    reasons.push(`Capability overlap: ${capabilityMatches.join(', ')}`);
  }

  if (nameMatches.length > 0) {
    score += nameMatches.length * 2;
    reasons.push(`Task terms matched agent identity: ${nameMatches.join(', ')}`);
  }

  if (metadataMatches.length > 0) {
    score += metadataMatches.length;
    reasons.push(`Metadata alignment: ${metadataMatches.join(', ')}`);
  }

  if (score === 0 && agent.capabilities.length > 0) {
    score = 1;
    reasons.push('Fallback match based on available capabilities.');
  }

  const confidence = Number(Math.min(0.99, Math.max(0.1, score / 12)).toFixed(2));
  return {
    agentId: agent.agentId,
    name: agent.name,
    capabilities: agent.capabilities,
    score,
    confidence,
    reasons,
    metadata: agent.metadata,
  };
}

function tokenizeForMatching(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_-]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2);
}

function flattenMetadataText(metadata: Record<string, unknown> | undefined): string {
  if (metadata === undefined) {
    return '';
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return '';
  }
}

function normalizeRequiredCapabilities(values: string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return Array.from(new Set(values.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0)));
}

function compareParallelTasks(left: RuntimeParallelTask, right: RuntimeParallelTask): number {
  const leftPriority = left.priority ?? 0;
  const rightPriority = right.priority ?? 0;
  return rightPriority - leftPriority || left.taskId.localeCompare(right.taskId);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function aggregateParallelResults(
  results: RuntimeParallelTaskResult[],
  mode: 'list' | 'merge',
): unknown {
  if (mode === 'list') {
    return results;
  }

  return Object.fromEntries(results.map((entry) => [
    entry.taskId,
    entry.status === 'completed' ? entry.result?.content ?? null : {
      status: entry.status,
      error: entry.error?.message,
    },
  ]));
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
