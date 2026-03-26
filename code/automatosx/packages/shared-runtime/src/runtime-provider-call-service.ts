import type { StateStore } from '@defai.digital/state-store';
import type { TraceStore } from '@defai.digital/trace-store';
import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';
import type {
  RuntimeCallRequest,
  RuntimeCallResponse,
  SharedRuntimeService,
} from './runtime-service-types.js';
import { buildSessionTask, ensureSessionRecord } from './runtime-session-support.js';

interface ProviderBridgeLike {
  executePrompt(request: ProviderExecutionRequest): Promise<ProviderExecutionOutcome>;
}

export interface RuntimeProviderCallServiceConfig {
  basePath: string;
  traceStore: TraceStore;
  stateStore: StateStore;
  resolveProviderBridge(requestBasePath?: string): ProviderBridgeLike;
  tokenize(value: string): number;
  createTraceId(): string;
}

type RuntimeProviderCallService = Pick<
  SharedRuntimeService,
  'callProvider'
>;

export function createRuntimeProviderCallService(
  config: RuntimeProviderCallServiceConfig,
): RuntimeProviderCallService {
  const {
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    tokenize,
    createTraceId,
  } = config;

  return {
    async callProvider(request) {
      const runtimeProviderBridge = resolveProviderBridge(request.basePath);
      const traceId = request.traceId ?? createTraceId();
      const startedAt = new Date().toISOString();
      const resolvedProvider = request.provider ?? 'claude';
      await ensureSessionRecord(stateStore, {
        sessionId: request.sessionId,
        task: buildSessionTask('Call provider', resolvedProvider),
        initiator: request.surface ?? 'cli',
        workspace: request.basePath ?? basePath,
        surface: request.surface,
        metadata: {
          command: 'call',
          provider: resolvedProvider,
          model: request.model,
        },
      });

      await traceStore.upsertTrace({
        traceId,
        workflowId: 'call',
        surface: request.surface ?? 'cli',
        status: 'running',
        startedAt,
        input: buildCallInput(request, resolvedProvider),
        stepResults: [],
        metadata: {
          sessionId: request.sessionId,
          provider: resolvedProvider,
          model: request.model,
          command: 'call',
        },
      });

      const bridgeResult = await runtimeProviderBridge.executePrompt({
        provider: resolvedProvider,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model ?? 'v14-direct-call',
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });
      const completedAt = new Date().toISOString();

      if (bridgeResult.type === 'response' || bridgeResult.type === 'failure') {
        const warnings = bridgeResult.type === 'failure'
          ? [bridgeResult.response.error ?? 'Provider execution failed.']
          : [];
        const response = bridgeResult.response;

        await traceStore.upsertTrace({
          traceId,
          workflowId: 'call',
          surface: request.surface ?? 'cli',
          status: response.success ? 'completed' : 'failed',
          startedAt,
          completedAt,
          input: buildCallInput(request, resolvedProvider),
          stepResults: [
            {
              stepId: 'provider-call',
              success: response.success,
              durationMs: response.latencyMs,
              retryCount: 0,
              error: response.error,
            },
          ],
          output: {
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
            provider: response.provider,
            model: response.model,
            command: 'call',
          },
        });

        return {
          traceId,
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
        } satisfies RuntimeCallResponse;
      }

      const content = [
        request.systemPrompt ? `System: ${request.systemPrompt}` : undefined,
        `Prompt: ${request.prompt}`,
      ].filter((value): value is string => value !== undefined).join('\n');
      const inputTokens = tokenize(request.prompt) + (request.systemPrompt ? tokenize(request.systemPrompt) : 0);
      const outputTokens = tokenize(content);
      const usage = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      };
      const warnings = [`No provider executor configured for "${resolvedProvider}". Returned simulated output.`];

      await traceStore.upsertTrace({
        traceId,
        workflowId: 'call',
        surface: request.surface ?? 'cli',
        status: 'completed',
        startedAt,
        completedAt,
        input: buildCallInput(request, resolvedProvider),
        stepResults: [
          {
            stepId: 'provider-call',
            success: true,
            durationMs: 0,
            retryCount: 0,
          },
        ],
        output: {
          content,
          usage,
          executionMode: 'simulated',
          warnings,
        },
        metadata: {
          sessionId: request.sessionId,
          provider: resolvedProvider,
          model: request.model ?? 'v14-direct-call',
          command: 'call',
        },
      });

      return {
        traceId,
        success: true,
        provider: resolvedProvider,
        model: request.model ?? 'v14-direct-call',
        content,
        latencyMs: 0,
        executionMode: 'simulated',
        warnings,
        usage,
      };
    },
  };
}

function buildCallInput(
  request: RuntimeCallRequest,
  resolvedProvider: string,
): Record<string, unknown> {
  return {
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    provider: resolvedProvider,
    model: request.model,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  };
}
