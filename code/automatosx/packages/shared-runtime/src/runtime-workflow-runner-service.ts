import {
  createRealStepExecutor,
  createStepGuardEngine,
  createWorkflowRunner,
  type DiscussionResultLike,
  type DiscussStepConfigLike,
  type StepGuardPolicy,
} from '@defai.digital/workflow-engine';
import type { StateStore } from '@defai.digital/state-store';
import type { TraceStore } from '@defai.digital/trace-store';
import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';
import { createWorkflowDiscussionExecutor } from './runtime-workflow-discussion-executor.js';
import { createWorkflowPromptExecutor } from './runtime-workflow-prompt-executor.js';
import { buildWorkflowGuardSummary } from './runtime-workflow-guard-summary.js';
import { createWorkflowToolExecutor } from './runtime-workflow-tool-executor.js';
import type {
  RuntimeAgentRunRequest,
  RuntimeAgentRunResponse,
  RuntimeWorkflowRequest,
  RuntimeWorkflowResponse,
  SharedRuntimeService,
} from './runtime-service-types.js';
import { buildSessionTask, ensureSessionRecord } from './runtime-session-support.js';
import { loadWorkflowWithBundledFallback } from './workflow-definition-resolution.js';

interface ProviderBridgeLike {
  executePrompt(request: ProviderExecutionRequest): Promise<ProviderExecutionOutcome>;
}

interface DiscussionCoordinatorLike {
  run(request: {
    traceId: string;
    provider?: string;
    config: DiscussStepConfigLike;
  }): Promise<DiscussionResultLike>;
}

export interface RuntimeWorkflowRunnerServiceConfig {
  basePath: string;
  traceStore: TraceStore;
  stateStore: StateStore;
  resolveProviderBridge(requestBasePath?: string): ProviderBridgeLike;
  resolveDiscussionCoordinator(requestBasePath?: string): DiscussionCoordinatorLike;
  resolveWorkflowDir(
    explicitWorkflowDir: string | undefined,
    requestBasePath: string | undefined,
    defaultBasePath: string,
  ): string;
  resolveGuardPolicies(): Promise<StepGuardPolicy[]>;
  tokenize(value: string): number;
  createTraceId(): string;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
}

type RuntimeWorkflowRunnerService = Pick<
  SharedRuntimeService,
  'runWorkflow'
>;

export function createRuntimeWorkflowRunnerService(
  config: RuntimeWorkflowRunnerServiceConfig,
): RuntimeWorkflowRunnerService {
  const {
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
    resolveWorkflowDir,
    resolveGuardPolicies,
    tokenize,
    createTraceId,
    runAgent,
  } = config;

  return {
    async runWorkflow(request) {
      const runtimeProviderBridge = resolveProviderBridge(request.basePath);
      const runtimeDiscussionCoordinator = resolveDiscussionCoordinator(request.basePath);
      const resolvedBasePath = request.basePath ?? basePath;
      const requestedWorkflowDir = resolveWorkflowDir(request.workflowDir, request.basePath, basePath);
      await ensureSessionRecord(stateStore, {
        sessionId: request.sessionId,
        task: buildSessionTask('Run workflow', request.workflowId),
        initiator: request.surface ?? 'cli',
        workspace: resolvedBasePath,
        surface: request.surface,
        metadata: {
          command: 'workflow.run',
          workflowId: request.workflowId,
          workflowDir: requestedWorkflowDir,
        },
      });
      const { workflow, workflowDir } = await loadWorkflowWithBundledFallback(
        request.workflowId,
        requestedWorkflowDir,
      );

      if (workflow === undefined) {
        const traceId = request.traceId ?? createTraceId();
        const failed = {
          traceId,
          workflowId: request.workflowId,
          surface: request.surface ?? 'cli',
          status: 'failed' as const,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          input: request.input,
          stepResults: [],
          error: {
            code: 'WORKFLOW_NOT_FOUND',
            message: `Workflow "${request.workflowId}" not found`,
          },
        };
        await traceStore.upsertTrace(failed);
        return {
          traceId,
          workflowId: request.workflowId,
          success: false,
          stepResults: [],
          error: failed.error,
          totalDurationMs: 0,
          workflowDir: requestedWorkflowDir,
        } satisfies RuntimeWorkflowResponse;
      }

      const traceId = request.traceId ?? createTraceId();
      const startedAt = new Date().toISOString();
      await traceStore.upsertTrace({
        traceId,
        workflowId: request.workflowId,
        surface: request.surface ?? 'cli',
        status: 'running',
        startedAt,
        input: request.input,
        stepResults: [],
        metadata: {
          workflowDir,
          provider: request.provider,
          model: request.model,
          sessionId: request.sessionId,
        },
      });

      const stepGuardEngine = createStepGuardEngine();
      const guardPolicies = await resolveGuardPolicies();
      for (const policy of guardPolicies) {
        stepGuardEngine.registerPolicy(policy);
      }

      const runner = createWorkflowRunner({
        executionId: traceId,
        agentId: request.surface ?? 'cli',
        stepGuardEngine,
        stepExecutor: createRealStepExecutor({
          promptExecutor: createWorkflowPromptExecutor(runtimeProviderBridge, tokenize, request.provider, request.model),
          toolExecutor: createWorkflowToolExecutor({
            basePath: resolvedBasePath,
            traceId,
            sessionId: request.sessionId,
            surface: request.surface ?? 'cli',
            provider: request.provider,
            model: request.model,
            createTraceId,
            traceStore,
            stateStore,
            runAgent,
          }),
          discussionExecutor: createWorkflowDiscussionExecutor(
            traceId,
            request.provider,
            runtimeDiscussionCoordinator,
          ),
          defaultProvider: request.provider ?? 'claude',
          defaultModel: request.model ?? 'v14-shared-runtime',
        }),
      });

      const result = await runner.run(workflow, request.input ?? {});
      const guard = buildWorkflowGuardSummary(workflow, result);
      const completedAt = new Date().toISOString();
      await traceStore.upsertTrace({
        traceId,
        workflowId: request.workflowId,
        surface: request.surface ?? 'cli',
        status: result.success ? 'completed' : 'failed',
        startedAt,
        completedAt,
        input: request.input,
        stepResults: result.stepResults.map((stepResult) => ({
          stepId: stepResult.stepId,
          success: stepResult.success,
          durationMs: stepResult.durationMs,
          retryCount: stepResult.retryCount,
          error: stepResult.error?.message,
          startedAt: stepResult.startedAt,
          completedAt: stepResult.completedAt,
        })),
        output: result.output,
        error: result.error,
        metadata: {
          workflowDir,
          provider: request.provider,
          model: request.model,
          totalDurationMs: result.totalDurationMs,
          sessionId: request.sessionId,
          guardId: guard?.guardId,
          guardFailedGates: guard?.failedGates,
          guardFailedGateMessages: guard?.failedGateMessages,
          guardSummary: guard?.summary,
          guardBlockedByRuntimeGovernance: guard?.blockedByRuntimeGovernance,
          guardToolName: guard?.toolName,
          guardTrustState: guard?.trustState,
          guardRequiredTrustStates: guard?.requiredTrustStates,
          guardSourceRef: guard?.sourceRef,
        },
      });

      return {
        traceId,
        workflowId: request.workflowId,
        success: result.success,
        stepResults: result.stepResults,
        output: result.output,
        error: result.error,
        guard,
        totalDurationMs: result.totalDurationMs,
        workflowDir,
      };
    },
  };
}
