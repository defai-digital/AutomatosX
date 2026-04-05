import {
  createRealStepExecutor,
  createStepGuardEngine,
  createWorkflowRunner,
  computeWorkflowHash,
  buildCheckpointRecord,
  validateCheckpoint,
  isCheckpointOrdered,
  type DiscussionResultLike,
  type DiscussStepConfigLike,
  type StepGuardPolicy,
  type StepResult,
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
      const workflowHash = computeWorkflowHash(workflow);

      // Drift detection: if resuming with a checkpoint hash, verify workflow hasn't changed
      if (request.checkpointWorkflowHash !== undefined && request.checkpointWorkflowHash !== workflowHash) {
        const driftError = {
          traceId,
          workflowId: request.workflowId,
          surface: request.surface ?? 'cli',
          status: 'failed' as const,
          startedAt,
          completedAt: new Date().toISOString(),
          input: request.input,
          stepResults: [],
          error: {
            code: 'CHECKPOINT_WORKFLOW_HASH_MISMATCH',
            message: `Workflow definition has changed since checkpoint was taken. Checkpoint hash: ${request.checkpointWorkflowHash}, current hash: ${workflowHash}`,
          },
        };
        await traceStore.upsertTrace(driftError);
        return {
          traceId,
          workflowId: request.workflowId,
          success: false,
          stepResults: [],
          error: driftError.error,
          totalDurationMs: 0,
          workflowDir,
        } satisfies RuntimeWorkflowResponse;
      }

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
          workflowHash,
        },
      });

      const stepGuardEngine = createStepGuardEngine();
      const guardPolicies = await resolveGuardPolicies();
      for (const policy of guardPolicies) {
        stepGuardEngine.registerPolicy(policy);
      }

      // Build stepId → workflow index map for checkpoint tracking
      const stepIdToIndex = new Map<string, number>();
      for (let si = 0; si < workflow.steps.length; si += 1) {
        const s = workflow.steps[si];
        if (s !== undefined) {
          stepIdToIndex.set(s.stepId, si);
        }
      }

      // Incremental checkpoint state
      let lastCheckpointIndex = -1;
      const accumulatedStepResults: Array<{
        stepId: string;
        success: boolean;
        output?: unknown;
        durationMs: number;
        retryCount: number;
        error?: string;
        startedAt?: string;
        completedAt?: string;
      }> = [];

      const runner = createWorkflowRunner({
        executionId: traceId,
        agentId: request.surface ?? 'cli',
        stepGuardEngine,
        resumeFromStepIndex: request.resumeFromStepIndex,
        priorStepOutputs: request.priorStepOutputs,
        onStepComplete(_step, stepResult: StepResult) {
          const currentWorkflowIndex = stepIdToIndex.get(stepResult.stepId) ?? -1;
          const mappedResult = {
            stepId: stepResult.stepId,
            success: stepResult.success,
            output: stepResult.output,
            durationMs: stepResult.durationMs,
            retryCount: stepResult.retryCount,
            error: stepResult.error?.message,
            startedAt: stepResult.startedAt,
            completedAt: stepResult.completedAt,
          };
          accumulatedStepResults.push(mappedResult);

          // Only checkpoint successful steps (INV-CP-002: monotonic ordering)
          if (stepResult.success) {
            if (isCheckpointOrdered(lastCheckpointIndex, currentWorkflowIndex)) {
              const allResults = accumulatedStepResults.map((r) => ({
                stepId: r.stepId,
                success: r.success,
                output: r.output,
                durationMs: r.durationMs,
                retryCount: r.retryCount,
                startedAt: r.startedAt,
                completedAt: r.completedAt,
              })) as StepResult[];
              const checkpoint = buildCheckpointRecord(
                allResults,
                workflowHash,
                currentWorkflowIndex,
                stepResult.stepId,
              );
              const validationError = validateCheckpoint(checkpoint, allResults);
              if (validationError === null) {
                lastCheckpointIndex = currentWorkflowIndex;
                // Fire-and-forget incremental checkpoint persist
                traceStore.upsertTrace({
                  traceId,
                  workflowId: request.workflowId,
                  surface: request.surface ?? 'cli',
                  status: 'running',
                  startedAt,
                  input: request.input,
                  stepResults: accumulatedStepResults.map((r) => ({
                    stepId: r.stepId,
                    success: r.success,
                    durationMs: r.durationMs,
                    retryCount: r.retryCount,
                    error: r.error,
                    startedAt: r.startedAt,
                    completedAt: r.completedAt,
                  })),
                  checkpoint,
                  metadata: {
                    workflowDir,
                    provider: request.provider,
                    model: request.model,
                    sessionId: request.sessionId,
                    workflowHash,
                  },
                }).catch(() => {
                  // Checkpoint persistence failure must not crash the running workflow
                });
              }
            }
          }
        },
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

      // Build final checkpoint: find the last successful step's true workflow index
      let finalCheckpoint: ReturnType<typeof buildCheckpointRecord> | undefined;
      for (let i = result.stepResults.length - 1; i >= 0; i -= 1) {
        const sr = result.stepResults[i];
        if (sr !== undefined && sr.success) {
          const wfIndex = stepIdToIndex.get(sr.stepId) ?? i;
          finalCheckpoint = buildCheckpointRecord(
            result.stepResults,
            workflowHash,
            wfIndex,
            sr.stepId,
          );
          break;
        }
      }

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
        checkpoint: finalCheckpoint,
        metadata: {
          workflowDir,
          provider: request.provider,
          model: request.model,
          totalDurationMs: result.totalDurationMs,
          sessionId: request.sessionId,
          workflowHash,
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
