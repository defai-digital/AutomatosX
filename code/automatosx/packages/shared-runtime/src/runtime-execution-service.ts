import {
  createRealStepExecutor,
  createStepGuardEngine,
  createWorkflowRunner,
  type DiscussionResultLike,
  type DiscussStepConfigLike,
  type StepGuardPolicy,
  type Workflow,
  type WorkflowResult,
} from '@defai.digital/workflow-engine';
import type { StateStore } from '@defai.digital/state-store';
import type { TraceStore } from '@defai.digital/trace-store';
import { createRuntimeBridgeService } from './bridge-runtime-service.js';
import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';
import { createRuntimeSkillService } from './runtime-skill-service.js';
import type {
  RuntimeAgentRunRequest,
  RuntimeAgentRunResponse,
  RuntimeCallRequest,
  RuntimeCallResponse,
  RuntimeDiscussionRequest,
  RuntimeWorkflowGuardSummary,
  RuntimeWorkflowRequest,
  RuntimeWorkflowResponse,
  SharedRuntimeService,
} from './index.js';
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

export interface RuntimeExecutionServiceConfig {
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

type RuntimeExecutionService = Pick<
  SharedRuntimeService,
  'callProvider' | 'runWorkflow'
>;

export function createRuntimeExecutionService(
  config: RuntimeExecutionServiceConfig,
): RuntimeExecutionService {
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
          promptExecutor: createPromptExecutor(runtimeProviderBridge, tokenize, request.provider, request.model),
          toolExecutor: createToolExecutor({
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
          discussionExecutor: createDiscussionExecutor(
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

function createPromptExecutor(
  providerBridge: ProviderBridgeLike,
  tokenize: (value: string) => number,
  provider?: string,
  model?: string,
) {
  return {
    getDefaultProvider: () => provider ?? 'claude',
    execute: async (request: {
      prompt: string;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      timeout?: number;
    }) => {
      const resolvedProvider = request.provider ?? provider ?? 'claude';
      const bridgeResult = await providerBridge.executePrompt({
        provider: resolvedProvider,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model ?? model ?? 'v14-shared-runtime',
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        timeoutMs: request.timeout,
      });

      if (bridgeResult.type === 'response' || bridgeResult.type === 'failure') {
        return bridgeResult.response;
      }

      const content = [
        request.systemPrompt ? `System: ${request.systemPrompt}` : undefined,
        `Prompt: ${request.prompt}`,
      ].filter((value): value is string => value !== undefined).join('\n');
      const promptInputTokens = tokenize(request.prompt) + (request.systemPrompt ? tokenize(request.systemPrompt) : 0);
      const promptOutputTokens = tokenize(content);
      return {
        success: true,
        content,
        provider: resolvedProvider,
        model: request.model ?? model ?? 'v14-shared-runtime',
        latencyMs: 0,
        usage: {
          inputTokens: promptInputTokens,
          outputTokens: promptOutputTokens,
          totalTokens: promptInputTokens + promptOutputTokens,
        },
      };
    },
  };
}

function createToolExecutor(config: {
  basePath: string;
  traceId: string;
  sessionId?: string;
  surface: NonNullable<RuntimeWorkflowRequest['surface']>;
  provider?: string;
  model?: string;
  createTraceId(): string;
  traceStore: TraceStore;
  stateStore: StateStore;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
}) {
  const bridgeService = createRuntimeBridgeService({ basePath: config.basePath });
  const skillService = createRuntimeSkillService({
    basePath: config.basePath,
    traceStore: config.traceStore,
    stateStore: config.stateStore,
    createTraceId: config.createTraceId,
    runAgent: config.runAgent,
  });
  const builtinTools = new Set(['skill.run', 'bridge.run', 'bridge.install']);

  return {
    isToolAvailable: (toolName: string) => toolName.trim().length > 0,
    getAvailableTools: () => [...builtinTools],
    execute: async (toolName: string, args: Record<string, unknown>) => {
      switch (toolName) {
        case 'skill.run': {
          const reference = asRequiredString(args.reference, 'reference');
          const result = await skillService.runSkill({
            reference,
            args: asStringArray(args.args),
            task: asOptionalString(args.task),
            input: asOptionalRecord(args.input) ?? stripReservedToolKeys(args, ['reference', 'args', 'task', 'input']),
            traceId: config.createTraceId(),
            sessionId: config.sessionId,
            basePath: config.basePath,
            provider: asOptionalString(args.provider) ?? config.provider,
            model: asOptionalString(args.model) ?? config.model,
            timeoutMs: asOptionalNumber(args.timeoutMs),
            surface: config.surface,
            parentTraceId: config.traceId,
            rootTraceId: config.traceId,
          });

          return {
            success: result.success,
            output: result,
            durationMs: 0,
            error: result.error?.message,
            errorCode: result.error?.code,
            retryable: false,
          };
        }
        case 'bridge.run': {
          const reference = asRequiredString(args.reference, 'reference');
          const bridge = await bridgeService.resolveBridgeReference(reference);
          const execution = await bridgeService.executeBridge(bridge, asStringArray(args.args) ?? []);
          return {
            success: execution.exitCode === 0,
            output: {
              bridge,
              execution,
            },
            durationMs: 0,
            error: execution.exitCode === 0 ? undefined : `Bridge "${bridge.definition.bridgeId}" exited with code ${String(execution.exitCode)}.`,
            errorCode: execution.exitCode === 0 ? undefined : 'BRIDGE_EXECUTION_FAILED',
            retryable: false,
          };
        }
        case 'bridge.install': {
          const sourcePath = asRequiredString(args.sourcePath, 'sourcePath');
          const installed = await bridgeService.installBridgeDefinition(sourcePath, {
            requireTrusted: asOptionalBoolean(args.requireTrusted),
          });
          return {
            success: true,
            output: installed,
            durationMs: 0,
          };
        }
        default:
          return {
            success: true,
            output: {
              toolName,
              args,
              mode: 'shared-runtime-passthrough',
            },
            durationMs: 0,
          };
      }
    },
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRequiredString(value: unknown, field: string): string {
  const normalized = asOptionalString(value);
  if (normalized === undefined) {
    throw new Error(`${field} is required and must be a non-empty string`);
  }
  return normalized;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.map((entry) => String(entry))
    : undefined;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stripReservedToolKeys(
  value: Record<string, unknown>,
  reservedKeys: string[],
): Record<string, unknown> | undefined {
  const reserved = new Set(reservedKeys);
  const entries = Object.entries(value).filter(([key]) => !reserved.has(key));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function buildWorkflowGuardSummary(
  workflow: Workflow,
  result: WorkflowResult,
): RuntimeWorkflowGuardSummary | undefined {
  if (result.error?.code !== 'WORKFLOW_GUARD_BLOCKED') {
    return undefined;
  }

  const errorDetails = asOptionalRecord(result.error.details);
  const failedStepId = result.error.failedStepId;
  const guardId = asOptionalString(errorDetails?.guardId);
  const failedGates = asStringArray(errorDetails?.failedGates) ?? [];
  const failedGateMessages = asStringArray(errorDetails?.failedGateMessages) ?? [];
  const blockedByRuntimeGovernance = guardId === 'enforce-runtime-trust' || failedGates.includes('runtime_trust');
  const failedStep = failedStepId === undefined
    ? undefined
    : workflow.steps.find((step) => step.stepId === failedStepId);
  const failedStepResult = failedStepId === undefined
    ? undefined
    : result.stepResults.find((step) => step.stepId === failedStepId);
  const toolName = extractWorkflowToolName(failedStepResult?.output) ?? extractWorkflowConfigToolName(failedStep);
  const trust = extractWorkflowTrustSnapshot(failedStepResult?.output);
  const requiredTrustStates = failedStep === undefined
    ? []
    : asStringArray(asOptionalRecord(failedStep.config)?.requiredTrustStates)
      ?? asStringArray(asOptionalRecord(failedStep.config)?.allowedTrustStates)
      ?? [];

  return {
    summary: formatWorkflowGuardSummary({
      failedStepId,
      guardId,
      failedGates,
      failedGateMessages,
      blockedByRuntimeGovernance,
      toolName,
      trust,
      requiredTrustStates,
    }),
    guardId,
    failedStepId,
    failedGates,
    failedGateMessages,
    blockedByRuntimeGovernance,
    toolName,
    trustState: trust?.state,
    requiredTrustStates: requiredTrustStates.length > 0 ? requiredTrustStates : undefined,
    approvalMode: trust?.approvalMode,
    approvalPolicyId: trust?.approvalPolicyId,
    sourceRef: trust?.sourceRef,
  };
}

function formatWorkflowGuardSummary(config: {
  failedStepId?: string;
  guardId?: string;
  failedGates: string[];
  failedGateMessages: string[];
  blockedByRuntimeGovernance: boolean;
  toolName?: string;
  trust?: WorkflowTrustSnapshot;
  requiredTrustStates: string[];
}): string {
  const stepLabel = config.failedStepId ?? 'unknown-step';
  if (config.blockedByRuntimeGovernance) {
    const parts = [
      `Runtime governance blocked step "${stepLabel}"${config.toolName ? ` (${config.toolName})` : ''}.`,
      config.trust?.state ? `Trust state: ${config.trust.state}.` : undefined,
      config.requiredTrustStates.length > 0 ? `Required trust states: ${config.requiredTrustStates.join(', ')}.` : undefined,
      config.failedGateMessages.length > 0 ? config.failedGateMessages.join(' ') : undefined,
    ].filter((value): value is string => value !== undefined);
    return parts.join(' ');
  }

  const parts = [
    `Workflow step "${stepLabel}" was blocked by guard "${config.guardId ?? 'unknown-guard'}".`,
    config.failedGates.length > 0 ? `Failed gates: ${config.failedGates.join(', ')}.` : undefined,
    config.failedGateMessages.length > 0 ? config.failedGateMessages.join(' ') : undefined,
  ].filter((value): value is string => value !== undefined);
  return parts.join(' ');
}

function extractWorkflowConfigToolName(step: Workflow['steps'][number] | undefined): string | undefined {
  const config = step?.config;
  const parsed = asOptionalRecord(config);
  return asOptionalString(parsed?.toolName) ?? asOptionalString(step?.tool);
}

function extractWorkflowToolName(output: unknown): string | undefined {
  const envelope = asOptionalRecord(output);
  return envelope?.type === 'tool'
    ? asOptionalString(envelope.toolName)
    : undefined;
}

interface WorkflowTrustSnapshot {
  state: string;
  approvalMode?: string;
  approvalPolicyId?: string;
  sourceRef?: string;
}

function extractWorkflowTrustSnapshot(output: unknown): WorkflowTrustSnapshot | undefined {
  const toolEnvelope = asOptionalRecord(output);
  const toolOutput = toolEnvelope?.type === 'tool'
    ? asOptionalRecord(toolEnvelope.toolOutput)
    : undefined;
  if (toolOutput === undefined) {
    return undefined;
  }

  const trust = asOptionalRecord(toolOutput.skillTrust)
    ?? asOptionalRecord(toolOutput.trust)
    ?? asOptionalRecord(asOptionalRecord(toolOutput.execution)?.trust);
  if (trust === undefined) {
    return undefined;
  }

  const state = asOptionalString(trust.state);
  if (state === undefined) {
    return undefined;
  }

  return {
    state,
    approvalMode: asOptionalString(trust.approvalMode),
    approvalPolicyId: asOptionalString(trust.approvalPolicyId),
    sourceRef: asOptionalString(trust.sourceRef),
  };
}

function createDiscussionExecutor(
  traceId: string,
  provider: string | undefined,
  coordinator: DiscussionCoordinatorLike,
) {
  return {
    execute: async (config: DiscussStepConfigLike) => coordinator.run({
      traceId,
      provider,
      config,
    }),
  };
}
