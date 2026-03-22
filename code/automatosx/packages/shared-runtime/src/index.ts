import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  createRealStepExecutor,
  createWorkflowLoader,
  createWorkflowRunner,
  createStepGuardEngine,
  findWorkflowDir,
  type StepResult,
  type StepGuardContext,
  type StepGuardPolicy,
  type StepGuardResult,
} from '@defai.digital/workflow-engine';
import { StepGuardPolicySchema } from '@defai.digital/contracts';
import {
  createTraceStore,
  type TraceRecord,
  type TraceStore,
  type TraceSurface,
} from '@defai.digital/trace-store';
import {
  createStateStore,
  type AgentEntry,
  type MemoryEntry,
  type PolicyEntry,
  type SemanticEntry,
  type SemanticNamespaceStats,
  type SemanticSearchResult,
  type SessionEntry,
  type SessionParticipantRole,
  type StateStore,
} from '@defai.digital/state-store';
import {
  listReviewTraces,
  runReviewAnalysis,
  type ReviewFinding,
  type ReviewFocus,
  type ReviewSeverity,
  type RuntimeReviewResponse,
} from './review.js';
import { createProviderBridge } from './provider-bridge.js';

const execFileAsync = promisify(execFile);

export interface RuntimeWorkflowRequest {
  workflowId: string;
  traceId?: string;
  sessionId?: string;
  workflowDir?: string;
  basePath?: string;
  provider?: string;
  model?: string;
  input?: Record<string, unknown>;
  surface?: TraceSurface;
}

export interface RuntimeDiscussionRequest {
  topic: string;
  traceId?: string;
  sessionId?: string;
  basePath?: string;
  provider?: string;
  surface?: TraceSurface;
  pattern?: string;
  rounds?: number;
  providers?: string[];
  consensusMethod?: string;
  context?: string;
  minProviders?: number;
  verbose?: boolean;
  parentTraceId?: string;
  rootTraceId?: string;
  command?: string;
}

export interface RuntimeWorkflowResponse {
  traceId: string;
  workflowId: string;
  success: boolean;
  stepResults: StepResult[];
  output?: unknown;
  error?: {
    code?: string;
    message?: string;
    failedStepId?: string;
  };
  totalDurationMs?: number;
  workflowDir: string;
}

export interface RuntimeDiscussionResponse {
  traceId: string;
  topic: string;
  success: boolean;
  pattern: string;
  providers: string[];
  failedProviders: string[];
  executionMode?: 'simulated' | 'subprocess' | 'mixed';
  warnings: string[];
  rounds: Array<{
    roundNumber: number;
    responses: Array<{
      provider: string;
      content: string;
      round: number;
      timestamp: string;
      durationMs: number;
    }>;
    durationMs: number;
  }>;
  synthesis: string;
  consensus: {
    method: string;
    winner?: string;
    votes?: Record<string, number>;
    confidence?: number;
    dissent?: string[];
  };
  totalDurationMs: number;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeRecursiveDiscussionRequest extends RuntimeDiscussionRequest {
  subtopics: string[];
}

export interface RuntimeRecursiveDiscussionResponse {
  traceId: string;
  topic: string;
  success: boolean;
  subtopics: string[];
  root: RuntimeDiscussionResponse;
  children: RuntimeDiscussionResponse[];
  warnings: string[];
  totalDurationMs: number;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeCallRequest {
  prompt: string;
  traceId?: string;
  sessionId?: string;
  basePath?: string;
  provider?: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  surface?: TraceSurface;
}

export interface RuntimeCallResponse {
  traceId: string;
  success: boolean;
  provider: string;
  model?: string;
  content: string;
  latencyMs: number;
  executionMode: 'simulated' | 'subprocess';
  warnings: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeStatusResponse {
  sessions: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  traces: {
    totalSampled: number;
    running: number;
    completed: number;
    failed: number;
  };
  runtime: {
    defaultProvider?: string;
    providerExecutionMode: 'auto' | 'simulate' | 'require-real';
    configuredExecutors: string[];
  };
  activeSessions: SessionEntry[];
  runningTraces: TraceRecord[];
  recentFailedTraces: TraceRecord[];
}

export interface RuntimeGitDiffResponse {
  diff: string;
  command: string[];
  basePath: string;
}

export interface RuntimeGuardPolicySummary {
  policyId: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  guardCount: number;
  source: 'builtin' | 'stored';
}

export interface RuntimeGuardCheckResponse {
  policyIds: string[];
  position: 'before' | 'after';
  blocked: boolean;
  context: StepGuardContext;
  results: StepGuardResult[];
}

export interface RuntimeAgentRunRequest {
  agentId: string;
  traceId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  timeoutMs?: number;
  task?: string;
  input?: Record<string, unknown>;
  surface?: TraceSurface;
  parentTraceId?: string;
  rootTraceId?: string;
}

export interface RuntimeAgentRunResponse {
  traceId: string;
  agentId: string;
  success: boolean;
  provider: string;
  model?: string;
  content: string;
  latencyMs: number;
  executionMode: 'simulated' | 'subprocess';
  warnings: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeAgentRecommendation {
  agentId: string;
  name: string;
  capabilities: string[];
  score: number;
  confidence: number;
  reasons: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeAgentRecommendRequest {
  task: string;
  requiredCapabilities?: string[];
  limit?: number;
  team?: string;
}

export interface RuntimeParallelTask {
  taskId: string;
  agentId: string;
  task?: string;
  input?: Record<string, unknown>;
  dependencies?: string[];
  priority?: number;
  provider?: string;
  model?: string;
  timeoutMs?: number;
}

export interface RuntimeParallelPlan {
  valid: boolean;
  layers: string[][];
  orderedTaskIds: string[];
  errors: string[];
}

export interface RuntimeParallelRunRequest {
  tasks: RuntimeParallelTask[];
  traceId?: string;
  sessionId?: string;
  surface?: TraceSurface;
  maxConcurrent?: number;
  failureStrategy?: 'failFast' | 'failSafe';
  resultAggregation?: 'list' | 'merge';
}

export interface RuntimeParallelTaskResult {
  taskId: string;
  agentId: string;
  status: 'completed' | 'failed' | 'skipped';
  traceId?: string;
  dependencies: string[];
  result?: RuntimeAgentRunResponse;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeParallelRunResponse {
  traceId: string;
  success: boolean;
  failureStrategy: 'failFast' | 'failSafe';
  resultAggregation: 'list' | 'merge';
  layers: string[][];
  results: RuntimeParallelTaskResult[];
  aggregatedResult: unknown;
  totalDurationMs: number;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeWorkflowDescription {
  workflowId: string;
  name?: string;
  description?: string;
  version: string;
  workflowDir: string;
  steps: Array<{
    stepId: string;
    type: string;
  }>;
}

export interface RuntimeTraceAnalysisFinding {
  level: 'info' | 'warn' | 'error';
  code: string;
  message: string;
}

export interface RuntimeTraceAnalysis {
  traceId: string;
  workflowId: string;
  surface: TraceSurface;
  status: TraceRecord['status'];
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  retryCount: number;
  slowestStep?: {
    stepId: string;
    durationMs: number;
    success: boolean;
  };
  error?: TraceRecord['error'];
  findings: RuntimeTraceAnalysisFinding[];
}

export interface SharedRuntimeService {
  callProvider(request: RuntimeCallRequest): Promise<RuntimeCallResponse>;
  runWorkflow(request: RuntimeWorkflowRequest): Promise<RuntimeWorkflowResponse>;
  runDiscussion(request: RuntimeDiscussionRequest): Promise<RuntimeDiscussionResponse>;
  runDiscussionQuick(request: RuntimeDiscussionRequest): Promise<RuntimeDiscussionResponse>;
  runDiscussionRecursive(request: RuntimeRecursiveDiscussionRequest): Promise<RuntimeRecursiveDiscussionResponse>;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
  recommendAgents(request: RuntimeAgentRecommendRequest): Promise<RuntimeAgentRecommendation[]>;
  planParallel(request: { tasks: RuntimeParallelTask[] }): Promise<RuntimeParallelPlan>;
  runParallel(request: RuntimeParallelRunRequest): Promise<RuntimeParallelRunResponse>;
  getStatus(request?: { limit?: number }): Promise<RuntimeStatusResponse>;
  gitDiff(request?: { basePath?: string; paths?: string[]; staged?: boolean; commit?: string; stat?: boolean }): Promise<RuntimeGitDiffResponse>;
  listWorkflows(options?: { workflowDir?: string; basePath?: string }): Promise<Array<{ workflowId: string; name?: string; version: string; steps: number }>>;
  describeWorkflow(request: { workflowId: string; workflowDir?: string; basePath?: string }): Promise<RuntimeWorkflowDescription | undefined>;
  analyzeReview(request: { paths: string[]; focus?: ReviewFocus; maxFiles?: number; traceId?: string; sessionId?: string; basePath?: string; surface?: TraceSurface }): Promise<RuntimeReviewResponse>;
  listReviewTraces(limit?: number): Promise<TraceRecord[]>;
  getConfig(path?: string): Promise<unknown>;
  showConfig(): Promise<Record<string, unknown>>;
  setConfig(path: string, value: unknown): Promise<Record<string, unknown>>;
  getTrace(traceId: string): Promise<TraceRecord | undefined>;
  analyzeTrace(traceId: string): Promise<RuntimeTraceAnalysis | undefined>;
  listTracesBySession(sessionId: string, limit?: number): Promise<TraceRecord[]>;
  listTraces(limit?: number): Promise<TraceRecord[]>;
  closeStuckTraces(maxAgeMs?: number): Promise<TraceRecord[]>;
  storeMemory(entry: { key: string; namespace?: string; value: unknown }): Promise<MemoryEntry>;
  getMemory(key: string, namespace?: string): Promise<MemoryEntry | undefined>;
  searchMemory(query: string, namespace?: string): Promise<MemoryEntry[]>;
  deleteMemory(key: string, namespace?: string): Promise<boolean>;
  listMemory(namespace?: string): Promise<MemoryEntry[]>;
  storeSemantic(entry: { key: string; namespace?: string; content: string; tags?: string[]; metadata?: Record<string, unknown> }): Promise<SemanticEntry>;
  searchSemantic(query: string, options?: { namespace?: string; filterTags?: string[]; topK?: number; minSimilarity?: number }): Promise<SemanticSearchResult[]>;
  getSemantic(key: string, namespace?: string): Promise<SemanticEntry | undefined>;
  listSemantic(options?: { namespace?: string; keyPrefix?: string; filterTags?: string[]; limit?: number }): Promise<SemanticEntry[]>;
  deleteSemantic(key: string, namespace?: string): Promise<boolean>;
  clearSemantic(namespace: string): Promise<number>;
  semanticStats(namespace?: string): Promise<SemanticNamespaceStats[]>;
  registerPolicy(entry: { policyId: string; name: string; enabled?: boolean; metadata?: Record<string, unknown> }): Promise<PolicyEntry>;
  listPolicies(): Promise<PolicyEntry[]>;
  listGuardPolicies(): Promise<RuntimeGuardPolicySummary[]>;
  applyGuardPolicy(request: { policyId?: string; definition?: StepGuardPolicy; enabled?: boolean }): Promise<PolicyEntry>;
  checkGuards(request: {
    policyId?: string;
    position?: 'before' | 'after';
    agentId?: string;
    executionId?: string;
    sessionId?: string;
    workflowId?: string;
    stepId: string;
    stepType: string;
    stepIndex?: number;
    totalSteps?: number;
    previousOutputs?: Record<string, unknown>;
    stepConfig?: Record<string, unknown>;
  }): Promise<RuntimeGuardCheckResponse>;
  registerAgent(entry: { agentId: string; name: string; capabilities?: string[]; metadata?: Record<string, unknown> }): Promise<AgentEntry>;
  getAgent(agentId: string): Promise<AgentEntry | undefined>;
  listAgents(): Promise<AgentEntry[]>;
  removeAgent(agentId: string): Promise<boolean>;
  listAgentCapabilities(): Promise<string[]>;
  createSession(entry: { sessionId?: string; task: string; initiator: string; workspace?: string; metadata?: Record<string, unknown> }): Promise<SessionEntry>;
  getSession(sessionId: string): Promise<SessionEntry | undefined>;
  listSessions(): Promise<SessionEntry[]>;
  joinSession(entry: { sessionId: string; agentId: string; role?: SessionParticipantRole }): Promise<SessionEntry>;
  leaveSession(sessionId: string, agentId: string): Promise<SessionEntry>;
  completeSession(sessionId: string, summary?: string): Promise<SessionEntry>;
  failSession(sessionId: string, message: string): Promise<SessionEntry>;
  closeStuckSessions(maxAgeMs?: number): Promise<SessionEntry[]>;
  getStores(): { traceStore: TraceStore; stateStore: StateStore };
}

export interface SharedRuntimeConfig {
  basePath?: string;
  traceStore?: TraceStore;
  stateStore?: StateStore;
  maxConcurrentDiscussions?: number;
  maxProvidersPerDiscussion?: number;
  maxDiscussionRounds?: number;
}

const DEFAULT_DISCUSSION_CONCURRENCY = 2;
const DEFAULT_DISCUSSION_PROVIDER_BUDGET = 3;
const DEFAULT_DISCUSSION_ROUNDS = 3;
const BUILTIN_GUARD_POLICIES: StepGuardPolicy[] = [
  {
    policyId: 'step-validation',
    name: 'Step Validation',
    description: 'Blocks invalid workflow step configuration before execution.',
    workflowPatterns: ['*'],
    stepTypes: ['prompt', 'tool', 'conditional', 'loop', 'parallel', 'discuss', 'delegate'],
    agentPatterns: ['*'],
    guards: [
      {
        guardId: 'validate-step-config',
        stepId: '*',
        position: 'before',
        gates: ['validation'],
        onFail: 'block',
        enabled: true,
      },
    ],
    enabled: true,
    priority: 100,
  },
  {
    policyId: 'safe-filesystem',
    name: 'Safe Filesystem',
    description: 'Blocks unsafe file changes, sensitive-path edits, oversized change sets, and secret leakage.',
    workflowPatterns: ['*'],
    stepTypes: ['tool'],
    agentPatterns: ['*'],
    guards: [
      {
        guardId: 'enforce-allowed-paths',
        stepId: '*',
        position: 'before',
        gates: ['path_violation'],
        onFail: 'block',
        enabled: true,
      },
      {
        guardId: 'enforce-change-radius',
        stepId: '*',
        position: 'before',
        gates: ['change_radius'],
        onFail: 'block',
        enabled: true,
      },
      {
        guardId: 'prevent-sensitive-changes',
        stepId: '*',
        position: 'before',
        gates: ['sensitive_change'],
        onFail: 'block',
        enabled: true,
      },
      {
        guardId: 'prevent-secret-leaks',
        stepId: '*',
        position: 'before',
        gates: ['secrets_detection'],
        onFail: 'block',
        enabled: true,
      },
    ],
    enabled: true,
    priority: 90,
  },
];

export function createSharedRuntimeService(config: SharedRuntimeConfig = {}): SharedRuntimeService {
  const basePath = config.basePath ?? process.cwd();
  const traceStore = config.traceStore ?? createTraceStore({ basePath });
  const stateStore = config.stateStore ?? createStateStore({ basePath });
  const providerBridge = createProviderBridge({ basePath });
  const discussionCoordinator = createDiscussionCoordinator({
    maxConcurrentDiscussions: config.maxConcurrentDiscussions ?? DEFAULT_DISCUSSION_CONCURRENCY,
    maxProvidersPerDiscussion: config.maxProvidersPerDiscussion ?? DEFAULT_DISCUSSION_PROVIDER_BUDGET,
    maxDiscussionRounds: config.maxDiscussionRounds ?? DEFAULT_DISCUSSION_ROUNDS,
    providerBridge,
  });

  return {
    async callProvider(request) {
      const traceId = request.traceId ?? randomUUID();
      const startedAt = new Date().toISOString();
      const resolvedProvider = request.provider ?? 'claude';
      await traceStore.upsertTrace({
        traceId,
        workflowId: 'call',
        surface: request.surface ?? 'cli',
        status: 'running',
        startedAt,
        input: {
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          provider: resolvedProvider,
          model: request.model,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        },
        stepResults: [],
        metadata: {
          sessionId: request.sessionId,
          provider: resolvedProvider,
          model: request.model,
          command: 'call',
        },
      });

      const bridgeResult = await providerBridge.executePrompt({
        provider: resolvedProvider,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model ?? 'v14-direct-call',
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });
      const completedAt = new Date().toISOString();

      if (bridgeResult.type === 'response' || bridgeResult.type === 'failure') {
        const warnings = bridgeResult.type === 'failure' ? [bridgeResult.response.error ?? 'Provider execution failed.'] : [];
        await traceStore.upsertTrace({
          traceId,
          workflowId: 'call',
          surface: request.surface ?? 'cli',
          status: bridgeResult.response.success ? 'completed' : 'failed',
          startedAt,
          completedAt,
          input: {
            prompt: request.prompt,
            systemPrompt: request.systemPrompt,
            provider: resolvedProvider,
            model: request.model,
            maxTokens: request.maxTokens,
            temperature: request.temperature,
          },
          stepResults: [
            {
              stepId: 'provider-call',
              success: bridgeResult.response.success,
              durationMs: bridgeResult.response.latencyMs,
              retryCount: 0,
              error: bridgeResult.response.error,
            },
          ],
          output: {
            content: bridgeResult.response.content ?? '',
            usage: bridgeResult.response.usage,
            executionMode: 'subprocess',
            warnings,
          },
          error: bridgeResult.response.success ? undefined : {
            code: bridgeResult.response.errorCode,
            message: bridgeResult.response.error,
          },
          metadata: {
            sessionId: request.sessionId,
            provider: bridgeResult.response.provider,
            model: bridgeResult.response.model,
            command: 'call',
          },
        });

        return {
          traceId,
          success: bridgeResult.response.success,
          provider: bridgeResult.response.provider,
          model: bridgeResult.response.model,
          content: bridgeResult.response.content ?? '',
          latencyMs: bridgeResult.response.latencyMs,
          executionMode: 'subprocess',
          warnings,
          usage: bridgeResult.response.usage,
          error: bridgeResult.response.success ? undefined : {
            code: bridgeResult.response.errorCode,
            message: bridgeResult.response.error,
          },
        };
      }

      const content = [
        request.systemPrompt ? `System: ${request.systemPrompt}` : undefined,
        `Prompt: ${request.prompt}`,
      ].filter((value): value is string => value !== undefined).join('\n');
      const usage = {
        inputTokens: tokenize(request.prompt),
        outputTokens: tokenize(content),
        totalTokens: tokenize(request.prompt) + tokenize(content),
      };
      const warnings = [`No provider executor configured for "${resolvedProvider}". Returned simulated output.`];
      await traceStore.upsertTrace({
        traceId,
        workflowId: 'call',
        surface: request.surface ?? 'cli',
        status: 'completed',
        startedAt,
        completedAt,
        input: {
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          provider: resolvedProvider,
          model: request.model,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        },
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
      const workflowDir = request.workflowDir ?? findWorkflowDir(request.basePath ?? basePath) ?? join(process.cwd(), 'workflows');
      const loader = createWorkflowLoader({ workflowsDir: workflowDir });
      const workflow = await loader.load(request.workflowId);

      if (workflow === undefined) {
        const traceId = request.traceId ?? randomUUID();
        const failed: TraceRecord = {
          traceId,
          workflowId: request.workflowId,
          surface: request.surface ?? 'cli',
          status: 'failed',
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
          workflowDir,
        };
      }

      const traceId = request.traceId ?? randomUUID();
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

      const runner = createWorkflowRunner({
        executionId: traceId,
        agentId: request.surface ?? 'cli',
        stepExecutor: createRealStepExecutor({
          promptExecutor: createPromptExecutor(providerBridge, request.provider, request.model),
          toolExecutor: createToolExecutor(),
          discussionExecutor: createDiscussionExecutor(traceId, request.provider, discussionCoordinator),
          defaultProvider: request.provider ?? 'claude',
          defaultModel: request.model ?? 'v14-shared-runtime',
        }),
      });

      const result = await runner.run(workflow, request.input ?? {});
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
        })),
        output: result.output,
        error: result.error,
        metadata: {
          workflowDir,
          provider: request.provider,
          model: request.model,
          totalDurationMs: result.totalDurationMs,
          sessionId: request.sessionId,
        },
      });

      return {
        traceId,
        workflowId: request.workflowId,
        success: result.success,
        stepResults: result.stepResults,
        output: result.output,
        error: result.error,
        totalDurationMs: result.totalDurationMs,
        workflowDir,
      };
    },

    async runDiscussion(request) {
      const traceId = request.traceId ?? randomUUID();
      const startedAt = new Date().toISOString();
      const providers = normalizeProviders(request.providers, request.provider);
      const pattern = request.pattern ?? 'synthesis';
      const consensusMethod = request.consensusMethod ?? 'synthesis';
      const workflowId = request.command ?? 'discuss';

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

      const result = await discussionCoordinator.run({
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
          providerTimeout: 0,
          continueOnProviderFailure: true,
          minProviders: request.minProviders ?? Math.min(2, providers.length),
          temperature: 0,
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
    },

    async runDiscussionQuick(request) {
      return this.runDiscussion({
        ...request,
        rounds: 1,
        minProviders: request.minProviders ?? 1,
        pattern: request.pattern ?? 'quick',
        consensusMethod: request.consensusMethod ?? 'quick',
        command: request.command ?? 'discuss.quick',
      });
    },

    async runDiscussionRecursive(request) {
      const traceId = request.traceId ?? randomUUID();
      const startedAt = new Date().toISOString();
      const subtopics = request.subtopics.map((entry) => entry.trim()).filter((entry) => entry.length > 0);

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
      const root = await this.runDiscussion({
        ...request,
        traceId: rootTraceId,
        parentTraceId: traceId,
        rootTraceId: traceId,
        command: 'discuss.recursive.root',
        pattern: request.pattern ?? 'recursive',
      });

      const children = await Promise.all(subtopics.map((subtopic, index) => this.runDiscussionQuick({
        ...request,
        topic: subtopic,
        traceId: `${traceId}:child:${index + 1}`,
        parentTraceId: traceId,
        rootTraceId: traceId,
        command: 'discuss.recursive.child',
        pattern: 'recursive-child',
      })));

      const success = root.success && children.every((entry) => entry.success);
      const warnings = Array.from(new Set([
        ...root.warnings,
        ...children.flatMap((entry) => entry.warnings),
      ]));
      const totalDurationMs = root.totalDurationMs + children.reduce((sum, entry) => sum + entry.totalDurationMs, 0);
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
          ...children.map((entry, index) => ({
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
    },

    async runAgent(request) {
      const traceId = request.traceId ?? randomUUID();
      const agent = await stateStore.getAgent(request.agentId);
      const startedAt = new Date().toISOString();

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

      const bridgeResult = await providerBridge.executePrompt({
        provider: resolvedProvider,
        prompt,
        systemPrompt,
        model: resolvedModel,
        timeoutMs: request.timeoutMs,
      });
      const completedAt = new Date().toISOString();

      if (bridgeResult.type === 'response' || bridgeResult.type === 'failure') {
        const warnings = bridgeResult.type === 'failure' ? [bridgeResult.response.error ?? 'Agent execution failed.'] : [];
        await traceStore.upsertTrace({
          traceId,
          workflowId: 'agent.run',
          surface: request.surface ?? 'cli',
          status: bridgeResult.response.success ? 'completed' : 'failed',
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
              success: bridgeResult.response.success,
              durationMs: bridgeResult.response.latencyMs,
              retryCount: 0,
              error: bridgeResult.response.error,
            },
          ],
          output: {
            agentId: agent.agentId,
            content: bridgeResult.response.content ?? '',
            usage: bridgeResult.response.usage,
            executionMode: 'subprocess',
            warnings,
          },
          error: bridgeResult.response.success ? undefined : {
            code: bridgeResult.response.errorCode,
            message: bridgeResult.response.error,
          },
          metadata: {
            sessionId: request.sessionId,
            parentTraceId: request.parentTraceId,
            rootTraceId: request.rootTraceId,
            agentId: agent.agentId,
            provider: bridgeResult.response.provider,
            model: bridgeResult.response.model,
            capabilities: agent.capabilities,
            command: 'agent.run',
          },
        });

        return {
          traceId,
          agentId: agent.agentId,
          success: bridgeResult.response.success,
          provider: bridgeResult.response.provider,
          model: bridgeResult.response.model,
          content: bridgeResult.response.content ?? '',
          latencyMs: bridgeResult.response.latencyMs,
          executionMode: 'subprocess',
          warnings,
          usage: bridgeResult.response.usage,
          error: bridgeResult.response.success ? undefined : {
            code: bridgeResult.response.errorCode,
            message: bridgeResult.response.error,
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
    },

    async recommendAgents(request) {
      const agents = await stateStore.listAgents();
      const ranked = rankAgents(agents, request);
      return request.limit === undefined ? ranked : ranked.slice(0, Math.max(0, request.limit));
    },

    async planParallel(request) {
      return buildParallelPlan(request.tasks);
    },

    async runParallel(request) {
      const traceId = request.traceId ?? randomUUID();
      const startedAt = new Date().toISOString();
      const startedAtMs = Date.now();
      const plan = buildParallelPlan(request.tasks);

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

            const runResult = await this.runAgent({
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

      const orderedResults = plan.orderedTaskIds.map((taskId) => results.get(taskId)!).filter((entry): entry is RuntimeParallelTaskResult => entry !== undefined);
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
    },

    async getStatus(request) {
      const limit = request?.limit ?? 10;
      const [sessions, traces, config] = await Promise.all([
        stateStore.listSessions(),
        traceStore.listTraces(Math.max(limit * 3, limit)),
        readWorkspaceConfig(basePath),
      ]);
      const activeSessions = sessions.filter((session) => session.status === 'active').slice(0, limit);
      const runningTraces = traces.filter((trace) => trace.status === 'running').slice(0, limit);
      const recentFailedTraces = traces.filter((trace) => trace.status === 'failed').slice(0, limit);

      return {
        sessions: {
          total: sessions.length,
          active: sessions.filter((session) => session.status === 'active').length,
          completed: sessions.filter((session) => session.status === 'completed').length,
          failed: sessions.filter((session) => session.status === 'failed').length,
        },
        traces: {
          totalSampled: traces.length,
          running: traces.filter((trace) => trace.status === 'running').length,
          completed: traces.filter((trace) => trace.status === 'completed').length,
          failed: traces.filter((trace) => trace.status === 'failed').length,
        },
        runtime: {
          defaultProvider: typeof config.providers === 'object' && config.providers !== null && typeof (config.providers as Record<string, unknown>).default === 'string'
            ? (config.providers as Record<string, string>).default
            : typeof config.defaultProvider === 'string'
              ? config.defaultProvider
              : undefined,
          providerExecutionMode: providerBridge.getExecutionMode(),
          configuredExecutors: listConfiguredExecutors(config),
        },
        activeSessions,
        runningTraces,
        recentFailedTraces,
      };
    },

    async gitDiff(request) {
      const diffBasePath = request?.basePath ?? basePath;
      const command = ['diff'];
      if (request?.staged === true) {
        command.push('--cached');
      }
      if (request?.stat === true) {
        command.push('--stat');
      }
      if (typeof request?.commit === 'string' && request.commit.length > 0) {
        command.push(request.commit);
      }
      if (Array.isArray(request?.paths) && request.paths.length > 0) {
        command.push('--', ...request.paths);
      }

      try {
        const { stdout } = await execFileAsync('git', command, { cwd: diffBasePath, maxBuffer: 1024 * 1024 * 4 });
        return {
          diff: stdout,
          command: ['git', ...command],
          basePath: diffBasePath,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`git diff failed: ${message}`);
      }
    },

    async listWorkflows(options) {
      const workflowDir = options?.workflowDir ?? findWorkflowDir(options?.basePath ?? basePath) ?? join(process.cwd(), 'workflows');
      const loader = createWorkflowLoader({ workflowsDir: workflowDir });
      const workflows = await loader.loadAll();
      return workflows.map((workflow) => ({
        workflowId: workflow.workflowId,
        name: workflow.name,
        version: workflow.version,
        steps: workflow.steps.length,
      }));
    },

    async describeWorkflow(request) {
      const workflowDir = request.workflowDir ?? findWorkflowDir(request.basePath ?? basePath) ?? join(process.cwd(), 'workflows');
      const loader = createWorkflowLoader({ workflowsDir: workflowDir });
      const workflow = await loader.load(request.workflowId);
      if (workflow === undefined) {
        return undefined;
      }

      return {
        workflowId: workflow.workflowId,
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        workflowDir,
        steps: workflow.steps.map((step) => ({
          stepId: step.stepId,
          type: step.type,
        })),
      };
    },

    analyzeReview(request) {
      return runReviewAnalysis(traceStore, {
        paths: request.paths,
        focus: request.focus,
        maxFiles: request.maxFiles,
        traceId: request.traceId,
        sessionId: request.sessionId,
        basePath: request.basePath ?? basePath,
        surface: request.surface ?? 'cli',
      });
    },

    listReviewTraces(limit) {
      return listReviewTraces(traceStore, limit);
    },

    async getConfig(path) {
      const config = await readWorkspaceConfig(basePath);
      if (path === undefined || path.length === 0) {
        return config;
      }
      return getValueAtPath(config, path);
    },

    showConfig() {
      return readWorkspaceConfig(basePath);
    },

    async setConfig(path, value) {
      const config = await readWorkspaceConfig(basePath);
      setValueAtPath(config, path, value);
      await writeWorkspaceConfig(basePath, config);
      return config;
    },

    getTrace(traceId) {
      return traceStore.getTrace(traceId);
    },

    async analyzeTrace(traceId) {
      const trace = await traceStore.getTrace(traceId);
      if (trace === undefined) {
        return undefined;
      }

      return analyzeTraceRecord(trace);
    },

    listTraces(limit) {
      return traceStore.listTraces(limit);
    },

    closeStuckTraces(maxAgeMs) {
      return traceStore.closeStuckTraces(maxAgeMs);
    },

    async listTracesBySession(sessionId, limit) {
      const traces = await traceStore.listTraces(limit === undefined ? undefined : Math.max(limit * 3, limit));
      const filtered = traces.filter((trace) => trace.metadata?.sessionId === sessionId);
      return limit === undefined ? filtered : filtered.slice(0, limit);
    },

    storeMemory(entry) {
      return stateStore.storeMemory(entry);
    },

    getMemory(key, namespace) {
      return stateStore.getMemory(key, namespace);
    },

    searchMemory(query, namespace) {
      return stateStore.searchMemory(query, namespace);
    },

    deleteMemory(key, namespace) {
      return stateStore.deleteMemory(key, namespace);
    },

    listMemory(namespace) {
      return stateStore.listMemory(namespace);
    },

    storeSemantic(entry) {
      return stateStore.storeSemantic(entry);
    },

    searchSemantic(query, options) {
      return stateStore.searchSemantic(query, options);
    },

    getSemantic(key, namespace) {
      return stateStore.getSemantic(key, namespace);
    },

    listSemantic(options) {
      return stateStore.listSemantic(options);
    },

    deleteSemantic(key, namespace) {
      return stateStore.deleteSemantic(key, namespace);
    },

    clearSemantic(namespace) {
      return stateStore.clearSemantic(namespace);
    },

    semanticStats(namespace) {
      return stateStore.semanticStats(namespace);
    },

    registerPolicy(entry) {
      return stateStore.registerPolicy(entry);
    },

    listPolicies() {
      return stateStore.listPolicies();
    },

    async listGuardPolicies() {
      const storedPolicies = await stateStore.listPolicies();
      return buildGuardPolicySummaries(storedPolicies);
    },

    async applyGuardPolicy(request) {
      const definition = resolveGuardPolicyDefinition(request.policyId, request.definition);
      return stateStore.registerPolicy({
        policyId: definition.policyId,
        name: definition.name,
        enabled: request.enabled ?? definition.enabled,
        metadata: {
          guardPolicy: definition,
          source: request.definition === undefined ? 'builtin' : 'stored',
        },
      });
    },

    async checkGuards(request) {
      const policies = await resolveGuardPoliciesForCheck(stateStore, request.policyId);
      const engine = createStepGuardEngine();
      for (const policy of policies) {
        engine.registerPolicy(policy);
      }

      const context: StepGuardContext = {
        agentId: request.agentId ?? 'cli',
        executionId: request.executionId ?? randomUUID(),
        sessionId: request.sessionId,
        stepId: request.stepId,
        stepType: request.stepType,
        stepIndex: request.stepIndex ?? 0,
        totalSteps: request.totalSteps ?? 1,
        previousOutputs: request.previousOutputs ?? {},
        stepConfig: request.stepConfig,
        workflowId: request.workflowId,
      };
      const position = request.position ?? 'before';
      const results = position === 'after'
        ? await engine.runAfterGuards(context)
        : await engine.runBeforeGuards(context);

      return {
        policyIds: policies.map((policy) => policy.policyId),
        position,
        blocked: engine.shouldBlock(results),
        context,
        results,
      };
    },

    registerAgent(entry) {
      return stateStore.registerAgent(entry);
    },

    getAgent(agentId) {
      return stateStore.getAgent(agentId);
    },

    listAgents() {
      return stateStore.listAgents();
    },

    removeAgent(agentId) {
      return stateStore.removeAgent(agentId);
    },

    listAgentCapabilities() {
      return stateStore.listAgentCapabilities();
    },

    createSession(entry) {
      return stateStore.createSession(entry);
    },

    getSession(sessionId) {
      return stateStore.getSession(sessionId);
    },

    listSessions() {
      return stateStore.listSessions();
    },

    joinSession(entry) {
      return stateStore.joinSession(entry);
    },

    leaveSession(sessionId, agentId) {
      return stateStore.leaveSession(sessionId, agentId);
    },

    completeSession(sessionId, summary) {
      return stateStore.completeSession(sessionId, summary);
    },

    failSession(sessionId, message) {
      return stateStore.failSession(sessionId, message);
    },

    closeStuckSessions(maxAgeMs) {
      return stateStore.closeStuckSessions(maxAgeMs);
    },

    getStores() {
      return { traceStore, stateStore };
    },
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
  const requiredCapabilities = normalizeStringArray(request.requiredCapabilities);
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
        const metadataTeam = isRecord(agent.metadata) ? asOptionalString(agent.metadata.team)?.toLowerCase() : undefined;
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

function normalizeStringArray(values: string[] | undefined): string[] {
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

function analyzeTraceRecord(trace: TraceRecord): RuntimeTraceAnalysis {
  const totalSteps = trace.stepResults.length;
  const successfulSteps = trace.stepResults.filter((step) => step.success).length;
  const failedSteps = totalSteps - successfulSteps;
  const retryCount = trace.stepResults.reduce((sum, step) => sum + step.retryCount, 0);
  const slowestStep = [...trace.stepResults]
    .sort((left, right) => right.durationMs - left.durationMs)[0];
  const durationMs = resolveTraceDuration(trace);
  const findings: RuntimeTraceAnalysisFinding[] = [];

  if (trace.status === 'failed') {
    findings.push({
      level: 'error',
      code: 'TRACE_FAILED',
      message: trace.error?.message ?? 'Trace completed with a failure status.',
    });
  }

  if (trace.status === 'running') {
    findings.push({
      level: 'warn',
      code: 'TRACE_RUNNING',
      message: 'Trace is still running and may not have final output yet.',
    });
  }

  if (failedSteps > 0) {
    findings.push({
      level: 'error',
      code: 'STEP_FAILURES',
      message: `${failedSteps} step${failedSteps === 1 ? '' : 's'} failed during execution.`,
    });
  }

  if (retryCount > 0) {
    findings.push({
      level: 'warn',
      code: 'STEP_RETRIES',
      message: `${retryCount} retr${retryCount === 1 ? 'y was' : 'ies were'} required across all steps.`,
    });
  }

  if (totalSteps === 0) {
    findings.push({
      level: 'warn',
      code: 'NO_STEP_RESULTS',
      message: 'Trace completed without any recorded step results.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      level: 'info',
      code: 'TRACE_HEALTHY',
      message: 'Trace completed without recorded execution issues.',
    });
  }

  return {
    traceId: trace.traceId,
    workflowId: trace.workflowId,
    surface: trace.surface,
    status: trace.status,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    durationMs,
    totalSteps,
    successfulSteps,
    failedSteps,
    retryCount,
    slowestStep: slowestStep === undefined ? undefined : {
      stepId: slowestStep.stepId,
      durationMs: slowestStep.durationMs,
      success: slowestStep.success,
    },
    error: trace.error,
    findings,
  };
}

function resolveTraceDuration(trace: TraceRecord): number {
  const metadataDuration = trace.metadata?.totalDurationMs;
  if (typeof metadataDuration === 'number' && Number.isFinite(metadataDuration) && metadataDuration >= 0) {
    return metadataDuration;
  }

  if (trace.completedAt !== undefined) {
    const startedAtMs = Date.parse(trace.startedAt);
    const completedAtMs = Date.parse(trace.completedAt);
    if (Number.isFinite(startedAtMs) && Number.isFinite(completedAtMs) && completedAtMs >= startedAtMs) {
      return completedAtMs - startedAtMs;
    }
  }

  return trace.stepResults.reduce((sum, step) => sum + step.durationMs, 0);
}

function createPromptExecutor(
  providerBridge: ReturnType<typeof createProviderBridge>,
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
      return {
        success: true,
        content,
        provider: resolvedProvider,
        model: request.model ?? model ?? 'v14-shared-runtime',
        latencyMs: 0,
        usage: {
          inputTokens: tokenize(request.prompt),
          outputTokens: tokenize(content),
          totalTokens: tokenize(request.prompt) + tokenize(content),
        },
      };
    },
  };
}

function createToolExecutor() {
  return {
    isToolAvailable: (toolName: string) => toolName.trim().length > 0,
    getAvailableTools: () => ['*'],
    execute: async (toolName: string, args: Record<string, unknown>) => ({
      success: true,
      output: {
        toolName,
        args,
        mode: 'shared-runtime-simulated',
      },
      durationMs: 0,
    }),
  };
}

function createDiscussionExecutor(
  traceId: string,
  provider: string | undefined,
  coordinator: DiscussionCoordinator,
) {
  return {
    execute: async (config: {
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
    }) => coordinator.run({
      traceId,
      provider,
      config,
    }),
  };
}

interface DiscussionCoordinator {
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
  }): Promise<{
    success: boolean;
    pattern: string;
    topic: string;
    participatingProviders: string[];
    failedProviders: string[];
    rounds: Array<{
      roundNumber: number;
      responses: Array<{
        provider: string;
        content: string;
        round: number;
        timestamp: string;
        durationMs: number;
      }>;
      durationMs: number;
    }>;
    synthesis: string;
    consensus: {
      method: string;
      winner?: string;
      votes?: Record<string, number>;
      confidence?: number;
      dissent?: string[];
    };
    totalDurationMs: number;
    metadata: {
      startedAt: string;
      completedAt: string;
      traceId: string;
      queueDepth: number;
      providerBudget: number;
      roundsExecuted: number;
      executionMode?: 'simulated' | 'subprocess' | 'mixed';
    };
    error?: {
      code: string;
      message: string;
    };
  }>;
}

function createDiscussionCoordinator(config: {
  maxConcurrentDiscussions: number;
  maxProvidersPerDiscussion: number;
  maxDiscussionRounds: number;
  providerBridge: ReturnType<typeof createProviderBridge>;
}): DiscussionCoordinator {
  let active = 0;
  const queue: Array<() => void> = [];

  return {
    async run(request) {
      const queueDepth = await acquire();
      const startedAt = new Date().toISOString();
      const startedAtMs = Date.now();

      try {
        await yieldToEventLoop(); // hold the acquired slot briefly so concurrent callers can queue
        const uniqueProviders = Array.from(new Set(request.config.providers.filter((entry) => entry.trim().length > 0)));
        const providerBudget = Math.min(config.maxProvidersPerDiscussion, uniqueProviders.length);
        let participatingProviders = uniqueProviders.slice(0, providerBudget);
        const failedProviders = uniqueProviders.slice(providerBudget);
        const roundsExecuted = clampRounds(request.config.rounds, config.maxDiscussionRounds);

        if (participatingProviders.length < Math.max(1, request.config.minProviders)) {
          return {
            success: false,
            pattern: request.config.pattern,
            topic: request.config.prompt,
            participatingProviders,
            failedProviders,
            rounds: [],
            synthesis: '',
            consensus: {
              method: request.config.consensus.method,
            },
            totalDurationMs: Date.now() - startedAtMs,
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              traceId: request.traceId,
              queueDepth,
              providerBudget,
              roundsExecuted: 0,
            },
            error: {
              code: 'DISCUSSION_PROVIDER_BUDGET_EXCEEDED',
              message: `Discussion requires ${request.config.minProviders} providers but only ${participatingProviders.length} are available within the configured budget`,
            },
          };
        }

        const rounds = [];
        const roundSummaries: string[] = [];
        let usedRealProvider = false;

        for (let index = 0; index < roundsExecuted; index += 1) {
          const roundNumber = index + 1;
          const roundStartedAt = Date.now();
          const providerResponses = await Promise.all(participatingProviders.map(async (entry) => {
            const prompt = buildDiscussionProviderPrompt(
              request.config.prompt,
              request.config.context,
              request.config.pattern,
              roundNumber,
              roundSummaries,
              request.config.providerPrompts?.[entry],
            );
            const bridgeResult = await config.providerBridge.executePrompt({
              provider: entry,
              prompt,
              temperature: request.config.temperature,
              timeoutMs: request.config.providerTimeout > 0 ? request.config.providerTimeout : undefined,
            });

            if (bridgeResult.type === 'response' && bridgeResult.response.success) {
              usedRealProvider = true;
              return {
                provider: entry,
                content: bridgeResult.response.content ?? '',
                round: roundNumber,
                timestamp: new Date().toISOString(),
                durationMs: bridgeResult.response.latencyMs,
                tokenCount: bridgeResult.response.usage?.totalTokens,
              };
            }

            if (bridgeResult.type === 'failure') {
              return {
                provider: entry,
                content: '',
                round: roundNumber,
                timestamp: new Date().toISOString(),
                durationMs: bridgeResult.response.latencyMs,
                error: bridgeResult.response.error ?? 'Provider execution failed',
              };
            }

            return {
              provider: entry,
              content: `Simulated discussion response from ${entry} in round ${roundNumber}`,
              round: roundNumber,
              timestamp: new Date().toISOString(),
              durationMs: 0,
            };
          }));

          const successfulProviders = providerResponses
            .filter((response) => response.error === undefined)
            .map((response) => response.provider);
          if (successfulProviders.length < Math.max(1, request.config.minProviders)) {
            return {
              success: false,
              pattern: request.config.pattern,
              topic: request.config.prompt,
              participatingProviders: successfulProviders,
              failedProviders: Array.from(new Set([
                ...failedProviders,
                ...providerResponses
                  .filter((response) => response.error !== undefined)
                  .map((response) => response.provider),
              ])),
              rounds,
              synthesis: roundSummaries.join('\n\n'),
              consensus: {
                method: request.config.consensus.method,
              },
              totalDurationMs: Date.now() - startedAtMs,
              metadata: {
                startedAt,
                completedAt: new Date().toISOString(),
                traceId: request.traceId,
                queueDepth,
                providerBudget,
                roundsExecuted: rounds.length,
                executionMode: usedRealProvider ? 'mixed' : 'simulated',
              },
              error: {
                code: 'DISCUSSION_PROVIDER_EXECUTION_FAILED',
                message: `Discussion dropped below the minimum provider threshold during round ${roundNumber}.`,
              },
            };
          }

          participatingProviders = successfulProviders;
          roundSummaries.push(
            `Round ${roundNumber}\n${providerResponses.map((response) => `${response.provider}: ${response.content || response.error || 'no output'}`).join('\n')}`,
          );
          rounds.push({
            roundNumber,
            responses: providerResponses,
            durationMs: Date.now() - roundStartedAt,
          });
        }

        return {
          success: true,
          pattern: request.config.pattern,
          topic: request.config.prompt,
          participatingProviders,
          failedProviders,
          rounds,
          synthesis: [request.config.prompt, request.config.context].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n'),
          consensus: {
            method: request.config.consensus.method,
            winner: participatingProviders[0] ?? request.provider ?? 'claude',
            votes: Object.fromEntries(participatingProviders.map((entry) => [entry, 1])),
            confidence: 1,
          },
          totalDurationMs: Date.now() - startedAtMs,
          metadata: {
            startedAt,
            completedAt: new Date().toISOString(),
            traceId: request.traceId,
            queueDepth,
            providerBudget,
            roundsExecuted,
            executionMode: usedRealProvider ? 'subprocess' : 'simulated',
          },
        };
      } finally {
        release();
      }
    },
  };

  function acquire(): Promise<number> {
    if (active < config.maxConcurrentDiscussions) {
      active += 1;
      return Promise.resolve(0);
    }

    const depth = queue.length + 1;
    return new Promise<number>((resolve) => {
      queue.push(() => {
        active += 1;
        resolve(depth);
      });
    });
  }

  function release(): void {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next !== undefined) {
      next();
    }
  }
}

function buildDiscussionProviderPrompt(
  topic: string,
  context: string | undefined,
  pattern: string,
  round: number,
  roundSummaries: string[],
  providerPrompt: string | undefined,
): string {
  if (providerPrompt !== undefined && providerPrompt.trim().length > 0) {
    return providerPrompt;
  }

  return [
    `Discussion pattern: ${pattern}`,
    `Round: ${round}`,
    `Topic: ${topic}`,
    context ? `Context:\n${context}` : undefined,
    roundSummaries.length > 0 ? `Previous rounds:\n${roundSummaries.join('\n\n')}` : undefined,
  ].filter((value): value is string => value !== undefined).join('\n\n');
}

function buildDiscussionWarnings(result: {
  metadata: { executionMode?: 'simulated' | 'subprocess' | 'mixed' };
  failedProviders: string[];
}): string[] {
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

function resolveGuardPolicyDefinition(policyId: string | undefined, definition: StepGuardPolicy | undefined): StepGuardPolicy {
  if (definition !== undefined) {
    return StepGuardPolicySchema.parse(definition);
  }

  if (policyId === undefined) {
    throw new Error('guard apply requires a policyId or definition');
  }

  const builtin = BUILTIN_GUARD_POLICIES.find((entry) => entry.policyId === policyId);
  if (builtin === undefined) {
    throw new Error(`Unknown built-in guard policy: ${policyId}`);
  }
  return builtin;
}

async function resolveGuardPoliciesForCheck(stateStore: StateStore, policyId?: string): Promise<StepGuardPolicy[]> {
  if (policyId !== undefined) {
    const storedPolicies = await stateStore.listPolicies();
    const stored = storedPolicies
      .map(extractStoredGuardPolicy)
      .find((entry): entry is StepGuardPolicy => entry !== undefined && entry.policyId === policyId);
    if (stored !== undefined) {
      return [stored];
    }

    const builtin = BUILTIN_GUARD_POLICIES.find((entry) => entry.policyId === policyId);
    if (builtin !== undefined) {
      return [builtin];
    }

    throw new Error(`Guard policy not found: ${policyId}`);
  }

  const storedPolicies = await stateStore.listPolicies();
  const parsedStored = storedPolicies
    .map(extractStoredGuardPolicy)
    .filter((entry): entry is StepGuardPolicy => entry !== undefined);
  return parsedStored.length > 0 ? parsedStored : BUILTIN_GUARD_POLICIES;
}

function buildGuardPolicySummaries(policies: PolicyEntry[]): RuntimeGuardPolicySummary[] {
  const summaries = new Map<string, RuntimeGuardPolicySummary>();

  for (const policy of BUILTIN_GUARD_POLICIES) {
    summaries.set(policy.policyId, {
      policyId: policy.policyId,
      name: policy.name,
      description: policy.description,
      enabled: policy.enabled,
      priority: policy.priority,
      guardCount: policy.guards.length,
      source: 'builtin',
    });
  }

  for (const policy of policies) {
    const parsed = extractStoredGuardPolicy(policy);
    if (parsed !== undefined) {
      summaries.set(parsed.policyId, {
        policyId: parsed.policyId,
        name: parsed.name,
        description: parsed.description,
        enabled: policy.enabled,
        priority: parsed.priority,
        guardCount: parsed.guards.length,
        source: 'stored',
      });
      continue;
    }

    summaries.set(policy.policyId, {
      policyId: policy.policyId,
      name: policy.name,
      enabled: policy.enabled,
      priority: 0,
      guardCount: 0,
      source: 'stored',
    });
  }

  return [...summaries.values()].sort((left, right) => right.priority - left.priority || left.policyId.localeCompare(right.policyId));
}

function extractStoredGuardPolicy(policy: PolicyEntry): StepGuardPolicy | undefined {
  const candidate = policy.metadata?.guardPolicy;
  const parsed = StepGuardPolicySchema.safeParse(candidate);
  if (!parsed.success) {
    return undefined;
  }
  return {
    ...parsed.data,
    enabled: policy.enabled,
  };
}

function listConfiguredExecutors(config: Record<string, unknown>): string[] {
  const providers = config.providers;
  if (providers === null || typeof providers !== 'object' || Array.isArray(providers)) {
    return [];
  }
  const executors = (providers as Record<string, unknown>).executors;
  if (executors === null || typeof executors !== 'object' || Array.isArray(executors)) {
    return [];
  }
  return Object.entries(executors)
    .filter(([, value]) => value !== null && typeof value === 'object' && !Array.isArray(value))
    .map(([providerId]) => providerId)
    .sort();
}

function clampRounds(rounds: number, maxDiscussionRounds: number): number {
  if (!Number.isFinite(rounds) || rounds < 1) {
    return 1;
  }
  return Math.min(Math.floor(rounds), maxDiscussionRounds);
}

function tokenize(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

async function readWorkspaceConfig(basePath: string): Promise<Record<string, unknown>> {
  const configPath = join(basePath, '.automatosx', 'config.json');
  try {
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeWorkspaceConfig(basePath: string, config: Record<string, unknown>): Promise<void> {
  const configPath = join(basePath, '.automatosx', 'config.json');
  await mkdir(join(basePath, '.automatosx'), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function getValueAtPath(config: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter((part) => part.length > 0);
  let current: unknown = config;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function setValueAtPath(config: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error('config path is required');
  }
  let current: Record<string, unknown> = config;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const next = current[part];
    if (!isRecord(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export type {
  ReviewFinding,
  ReviewFocus,
  ReviewSeverity,
  RuntimeReviewResponse,
} from './review.js';
