import type { StateStore } from '@defai.digital/state-store';
import type { TraceStore, TraceSurface } from '@defai.digital/trace-store';
import {
  createRuntimeBridgeService,
  type BridgeExecutionResult,
  type RuntimeBridgeService,
} from './bridge-runtime-service.js';
import {
  assertSkillExecutionAllowed,
  isRuntimeGovernanceError,
  type RuntimeTrustDecision,
} from './bridge-governance.js';
import { buildSessionTask, ensureSessionRecord } from './runtime-session-support.js';
import type {
  RuntimeAgentRunRequest,
  RuntimeAgentRunResponse,
  RuntimeSkillRunRequest,
  RuntimeSkillRunResponse,
  SharedRuntimeService,
} from './runtime-service-types.js';

export interface RuntimeSkillServiceConfig {
  basePath: string;
  traceStore: TraceStore;
  stateStore: StateStore;
  createTraceId(): string;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
}

type RuntimeSkillService = Pick<SharedRuntimeService, 'runSkill'>;

export function createRuntimeSkillService(config: RuntimeSkillServiceConfig): RuntimeSkillService {
  const {
    basePath,
    traceStore,
    stateStore,
    createTraceId,
    runAgent,
  } = config;

  return {
    async runSkill(request) {
      const resolvedBasePath = request.basePath ?? basePath;
      const bridgeService = createRuntimeBridgeService({ basePath: resolvedBasePath });
      const traceId = request.traceId ?? createTraceId();
      const rootTraceId = request.rootTraceId ?? traceId;
      const startedAt = new Date().toISOString();
      await ensureSessionRecord(stateStore, {
        sessionId: request.sessionId,
        task: buildSessionTask('Run skill', request.reference),
        initiator: request.surface ?? 'cli',
        workspace: resolvedBasePath,
        surface: request.surface,
        metadata: {
          command: 'skill.run',
          reference: request.reference,
        },
      });

      await traceStore.upsertTrace({
        traceId,
        workflowId: 'skill.run',
        surface: request.surface ?? 'cli',
        status: 'running',
        startedAt,
        input: buildTraceInput(request),
        stepResults: [],
        metadata: {
          basePath: resolvedBasePath,
          sessionId: request.sessionId,
          parentTraceId: request.parentTraceId,
          rootTraceId,
          command: 'skill.run',
        },
      });

      try {
        const skill = await bridgeService.resolveSkillReference(request.reference);
        const skillTrust = await assertSkillExecutionAllowed(resolvedBasePath, skill.definition);
        const dispatched = await dispatchSkill({
          request,
          traceId,
          rootTraceId,
          surface: request.surface ?? 'cli',
          bridgeService,
          createTraceId,
          runAgent,
          skillId: skill.definition.skillId,
          dispatch: skill.definition.dispatch,
          linkedBridgeId: skill.definition.linkedBridgeId,
          linkedAgentId: resolveLinkedAgentId(skill.definition),
          guidance: resolveSkillGuidance(skill.definition),
        });
        const response: RuntimeSkillRunResponse = {
          ...dispatched,
          skillTrust,
          skillProvenance: skill.definition.provenance,
        };

        const completedAt = new Date().toISOString();
        await traceStore.upsertTrace({
          traceId,
          workflowId: 'skill.run',
          surface: request.surface ?? 'cli',
          status: response.success ? 'completed' : 'failed',
          startedAt,
          completedAt,
          input: buildTraceInput(request),
          stepResults: [
            {
              stepId: 'skill-dispatch',
              success: response.success,
              durationMs: resolveSkillDuration(response),
              retryCount: 0,
              error: response.error?.message,
            },
          ],
          output: buildTraceOutput(response, skillTrust, skill.definition.provenance),
          error: response.success ? undefined : response.error,
          metadata: {
            basePath: resolvedBasePath,
            sessionId: request.sessionId,
            parentTraceId: request.parentTraceId,
            rootTraceId,
            command: 'skill.run',
            skillId: response.skillId,
            dispatch: response.dispatch,
            bridgeId: response.bridgeId,
            agentId: response.agentId,
            delegateTraceId: response.agentResult?.traceId,
            skillTrustState: skillTrust.state,
            skillSourceRef: skill.definition.provenance?.ref,
          },
        });

        return response;
      } catch (error) {
        const completedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : 'Failed to run skill.';
        const failure: RuntimeSkillRunResponse = {
          traceId,
          skillId: request.reference,
          dispatch: 'prompt',
          success: false,
          warnings: [],
          error: {
            code: isRuntimeGovernanceError(error) ? error.code : 'SKILL_RUN_FAILED',
            message,
          },
        };

        await traceStore.upsertTrace({
          traceId,
          workflowId: 'skill.run',
          surface: request.surface ?? 'cli',
          status: 'failed',
          startedAt,
          completedAt,
          input: buildTraceInput(request),
          stepResults: [
            {
              stepId: 'skill-dispatch',
              success: false,
              durationMs: 0,
              retryCount: 0,
              error: message,
            },
          ],
          error: failure.error,
          metadata: {
            basePath: resolvedBasePath,
            sessionId: request.sessionId,
            parentTraceId: request.parentTraceId,
            rootTraceId,
            command: 'skill.run',
          },
        });

        return failure;
      }
    },
  };
}

async function dispatchSkill(config: {
  request: RuntimeSkillRunRequest;
  traceId: string;
  rootTraceId: string;
  surface: TraceSurface;
  bridgeService: RuntimeBridgeService;
  createTraceId(): string;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
  skillId: string;
  dispatch: RuntimeSkillRunResponse['dispatch'];
  linkedBridgeId?: string;
  linkedAgentId?: string;
  guidance?: string;
}): Promise<RuntimeSkillRunResponse> {
  const {
    request,
    traceId,
    rootTraceId,
    surface,
    bridgeService,
    createTraceId,
    runAgent,
    skillId,
    dispatch,
    linkedBridgeId,
    linkedAgentId,
    guidance,
  } = config;

  if (dispatch === 'bridge') {
    if (linkedBridgeId === undefined) {
      return {
        traceId,
        skillId,
        dispatch,
        success: false,
        warnings: [],
        error: {
          code: 'SKILL_LINKED_BRIDGE_REQUIRED',
          message: `Skill "${skillId}" requires linkedBridgeId for bridge dispatch.`,
        },
      };
    }

    const bridge = await bridgeService.resolveBridgeReference(linkedBridgeId);
    let execution: BridgeExecutionResult;
    try {
      execution = await bridgeService.executeBridge(bridge, request.args ?? []);
    } catch (error) {
      if (isRuntimeGovernanceError(error)) {
        return {
          traceId,
          skillId,
          dispatch,
          success: false,
          warnings: [],
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }
      throw error;
    }
    return {
      traceId,
      skillId,
      dispatch,
      success: execution.exitCode === 0,
      bridgeId: bridge.definition.bridgeId,
      execution,
      warnings: [],
      error: execution.exitCode === 0
        ? undefined
        : {
          code: 'SKILL_BRIDGE_EXECUTION_FAILED',
          message: `Bridge "${bridge.definition.bridgeId}" exited with code ${String(execution.exitCode)}.`,
        },
    };
  }

  if (dispatch === 'delegate') {
    if (linkedAgentId === undefined) {
      return {
        traceId,
        skillId,
        dispatch,
        success: false,
        warnings: [],
        error: {
          code: 'SKILL_LINKED_AGENT_REQUIRED',
          message: `Skill "${skillId}" requires linkedAgentId for delegate dispatch.`,
        },
      };
    }

    const agentTraceId = createTraceId();
    const agentResult = await runAgent({
      agentId: linkedAgentId,
      task: resolveDelegateTask(request, skillId, guidance),
      input: buildDelegateInput(request, skillId, dispatch),
      provider: request.provider,
      model: request.model,
      timeoutMs: request.timeoutMs,
      traceId: agentTraceId,
      sessionId: request.sessionId,
      basePath: request.basePath,
      surface,
      parentTraceId: traceId,
      rootTraceId,
    });

    return {
      traceId,
      skillId,
      dispatch,
      success: agentResult.success,
      agentId: linkedAgentId,
      agentResult,
      warnings: [...agentResult.warnings],
      error: agentResult.success
        ? undefined
        : agentResult.error ?? {
          code: 'SKILL_DELEGATE_FAILED',
          message: `Delegated agent "${linkedAgentId}" failed while running skill "${skillId}".`,
        },
    };
  }

  return {
    traceId,
    skillId,
    dispatch,
    success: false,
    guidance,
    warnings: [],
    error: {
      code: 'SKILL_PROMPT_ONLY',
      message: `Skill "${skillId}" is prompt-only and cannot be run directly.`,
    },
  };
}

function buildTraceInput(request: RuntimeSkillRunRequest): Record<string, unknown> {
  return {
    reference: request.reference,
    args: request.args ?? [],
    task: request.task,
    input: request.input,
  };
}

function buildTraceOutput(
  response: RuntimeSkillRunResponse,
  skillTrust: RuntimeTrustDecision,
  skillProvenance: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    type: 'skill',
    skillId: response.skillId,
    dispatch: response.dispatch,
    skillTrust,
    skillProvenance,
    bridgeId: response.bridgeId,
    agentId: response.agentId,
    guidance: response.guidance,
    execution: response.execution === undefined ? undefined : summarizeBridgeExecution(response.execution),
    agentResult: response.agentResult === undefined ? undefined : {
      traceId: response.agentResult.traceId,
      success: response.agentResult.success,
      agentId: response.agentResult.agentId,
      provider: response.agentResult.provider,
      model: response.agentResult.model,
      executionMode: response.agentResult.executionMode,
      latencyMs: response.agentResult.latencyMs,
    },
    warnings: response.warnings,
  };
}

function summarizeBridgeExecution(execution: BridgeExecutionResult): Record<string, unknown> {
  return {
    bridgeId: execution.bridgeId,
    command: execution.command,
    args: execution.args,
    cwd: execution.cwd,
    exitCode: execution.exitCode,
    trust: execution.trust,
    provenance: execution.provenance,
  };
}

function resolveSkillDuration(response: RuntimeSkillRunResponse): number {
  if (response.execution !== undefined) {
    return 0;
  }
  if (response.agentResult !== undefined) {
    return response.agentResult.latencyMs;
  }
  return 0;
}

function resolveLinkedAgentId(skill: Record<string, unknown>): string | undefined {
  return firstNonEmptyString(
    skill.linkedAgentId,
    skill.linkedagentid,
    skill.agentId,
    skill.agent,
  );
}

function resolveSkillGuidance(skill: Record<string, unknown>): string | undefined {
  const body = typeof skill.body === 'string' ? skill.body.trim() : '';
  if (body.length > 0) {
    return body;
  }
  return typeof skill.description === 'string' && skill.description.trim().length > 0
    ? skill.description.trim()
    : undefined;
}

function resolveDelegateTask(
  request: RuntimeSkillRunRequest,
  skillId: string,
  guidance?: string,
): string {
  const explicitTask = normalizeString(request.task);
  if (explicitTask !== undefined) {
    return explicitTask;
  }

  const argTask = normalizeString((request.args ?? []).join(' '));
  if (argTask !== undefined) {
    return argTask;
  }

  const guidanceTask = normalizeString(guidance);
  if (guidanceTask !== undefined) {
    return guidanceTask;
  }

  return `Run skill ${skillId}`;
}

function buildDelegateInput(
  request: RuntimeSkillRunRequest,
  skillId: string,
  dispatch: RuntimeSkillRunResponse['dispatch'],
): Record<string, unknown> {
  return {
    ...(request.input ?? {}),
    skillId,
    dispatch,
    positionalArgs: request.args ?? [],
    rawArgs: request.args ?? [],
  };
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = normalizeString(value);
      if (normalized !== undefined) {
        return normalized;
      }
    }
  }
  return undefined;
}

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
