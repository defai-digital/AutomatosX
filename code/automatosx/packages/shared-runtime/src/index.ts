import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
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
  type FeedbackEntry,
  type MemoryEntry,
  type PolicyEntry,
  type SemanticEntry,
  type SemanticNamespaceStats,
  type SemanticSearchResult,
  type SessionEntry,
  type SessionParticipantRole,
  type StateStore,
} from '@defai.digital/state-store';
import type { SkillSpec } from './bridge-contracts.js';
import type { RuntimeTrustDecision } from './bridge-governance.js';
import {
  extractRuntimeTraceGuardSummary,
  type RuntimeTraceGuardSummary,
} from './runtime-governance-summary.js';
import {
  listReviewTraces,
  runReviewAnalysis,
  type ReviewFinding,
  type ReviewFocus,
  type ReviewSeverity,
  type RuntimeReviewResponse,
} from './review.js';
import { createProviderBridge } from './provider-bridge.js';
import { createRuntimeExecutionService } from './runtime-execution-service.js';
import { createRuntimeGitService } from './runtime-git-service.js';
import { createRuntimeOrchestrationService } from './runtime-orchestration-service.js';
import { createRuntimeQueryService } from './runtime-query-service.js';
import { createRuntimeSkillService } from './runtime-skill-service.js';
import { createRuntimeStateService } from './runtime-state-service.js';
import type { BridgeExecutionResult } from './bridge-runtime-service.js';
import {
  readCachedWorkspaceConfig,
  writeCachedWorkspaceConfig,
} from './workspace-config-cache.js';
import { resolveEffectiveWorkflowDir } from './stable-workflow-paths.js';

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
  timeout?: number;
  temperature?: number;
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
    details?: Record<string, unknown>;
  };
  guard?: RuntimeWorkflowGuardSummary;
  totalDurationMs?: number;
  workflowDir: string;
}

export interface RuntimeWorkflowGuardSummary {
  summary: string;
  guardId?: string;
  failedStepId?: string;
  failedGates: string[];
  failedGateMessages: string[];
  blockedByRuntimeGovernance: boolean;
  toolName?: string;
  trustState?: string;
  requiredTrustStates?: string[];
  approvalMode?: string;
  approvalPolicyId?: string;
  sourceRef?: string;
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
    total: number;
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
  basePath?: string;
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

export interface RuntimeSkillRunRequest {
  reference: string;
  args?: string[];
  task?: string;
  input?: Record<string, unknown>;
  traceId?: string;
  sessionId?: string;
  basePath?: string;
  provider?: string;
  model?: string;
  timeoutMs?: number;
  surface?: TraceSurface;
  parentTraceId?: string;
  rootTraceId?: string;
}

export interface RuntimeSkillRunResponse {
  traceId: string;
  skillId: string;
  dispatch: 'prompt' | 'delegate' | 'bridge';
  success: boolean;
  skillTrust?: RuntimeTrustDecision;
  skillProvenance?: SkillSpec['provenance'];
  guidance?: string;
  bridgeId?: string;
  agentId?: string;
  execution?: BridgeExecutionResult;
  agentResult?: RuntimeAgentRunResponse;
  warnings: string[];
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
  workflowDir?: string;
  source?: 'workflow-definition' | 'stable-catalog';
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
  guard?: RuntimeTraceGuardSummary;
  error?: TraceRecord['error'];
  findings: RuntimeTraceAnalysisFinding[];
}

export interface RuntimeTraceTreeNode {
  traceId: string;
  workflowId: string;
  surface: TraceSurface;
  status: TraceRecord['status'];
  startedAt: string;
  completedAt?: string;
  parentTraceId?: string;
  rootTraceId?: string;
  children: RuntimeTraceTreeNode[];
}

export interface RuntimeFeedbackStats {
  agentId: string;
  totalFeedback: number;
  ratingsCount: number;
  averageRating?: number;
  ratingDistribution: Record<string, number>;
  averageDurationMs?: number;
  latestOutcome?: string;
}

export interface RuntimeFeedbackOverview {
  totalFeedback: number;
  ratedFeedback: number;
  agentsWithFeedback: number;
  averageRating?: number;
  topAgents: RuntimeFeedbackStats[];
}

export interface RuntimeFeedbackAdjustment {
  agentId: string;
  adjustment: number;
  confidence: number;
  sampleSize: number;
  averageRating?: number;
}

export interface RuntimeAbility {
  abilityId: string;
  name: string;
  category: string;
  tags: string[];
  content: string;
}

export interface RuntimeAbilityInjection {
  task: string;
  abilities: RuntimeAbility[];
  content: string;
}

export interface RuntimeGitStatusFile {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface RuntimeGitStatusResponse {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: RuntimeGitStatusFile[];
  unstaged: RuntimeGitStatusFile[];
  untracked: string[];
  clean: boolean;
}

export interface RuntimeCommitPrepareResponse {
  message: string;
  stagedPaths: string[];
  diffStat: string;
  type: string;
  scope?: string;
}

export interface RuntimePrReviewResponse {
  base: string;
  head: string;
  commits: string[];
  changedFiles: string[];
  diffStat: string;
  summary: string;
}

export interface RuntimePrCreateResponse {
  title: string;
  base: string;
  head: string;
  draft: boolean;
  url?: string;
  output: string;
  command: string[];
}

export interface SharedRuntimeService {
  callProvider(request: RuntimeCallRequest): Promise<RuntimeCallResponse>;
  runWorkflow(request: RuntimeWorkflowRequest): Promise<RuntimeWorkflowResponse>;
  runDiscussion(request: RuntimeDiscussionRequest): Promise<RuntimeDiscussionResponse>;
  runDiscussionQuick(request: RuntimeDiscussionRequest): Promise<RuntimeDiscussionResponse>;
  runDiscussionRecursive(request: RuntimeRecursiveDiscussionRequest): Promise<RuntimeRecursiveDiscussionResponse>;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
  runSkill(request: RuntimeSkillRunRequest): Promise<RuntimeSkillRunResponse>;
  recommendAgents(request: RuntimeAgentRecommendRequest): Promise<RuntimeAgentRecommendation[]>;
  planParallel(request: { tasks: RuntimeParallelTask[] }): Promise<RuntimeParallelPlan>;
  runParallel(request: RuntimeParallelRunRequest): Promise<RuntimeParallelRunResponse>;
  getStatus(request?: { limit?: number }): Promise<RuntimeStatusResponse>;
  gitStatus(request?: { basePath?: string }): Promise<RuntimeGitStatusResponse>;
  gitDiff(request?: { basePath?: string; paths?: string[]; staged?: boolean; commit?: string; stat?: boolean }): Promise<RuntimeGitDiffResponse>;
  commitPrepare(request?: { basePath?: string; paths?: string[]; stageAll?: boolean; type?: string; scope?: string }): Promise<RuntimeCommitPrepareResponse>;
  reviewPullRequest(request?: { basePath?: string; base?: string; head?: string }): Promise<RuntimePrReviewResponse>;
  createPullRequest(request: { title: string; body?: string; base?: string; head?: string; draft?: boolean; basePath?: string }): Promise<RuntimePrCreateResponse>;
  listWorkflows(options?: { workflowDir?: string; basePath?: string }): Promise<Array<{ workflowId: string; name?: string; version: string; steps: number }>>;
  describeWorkflow(request: { workflowId: string; workflowDir?: string; basePath?: string }): Promise<RuntimeWorkflowDescription | undefined>;
  analyzeReview(request: { paths: string[]; focus?: ReviewFocus; maxFiles?: number; traceId?: string; sessionId?: string; basePath?: string; surface?: TraceSurface }): Promise<RuntimeReviewResponse>;
  listReviewTraces(limit?: number): Promise<TraceRecord[]>;
  getConfig(path?: string): Promise<unknown>;
  showConfig(): Promise<Record<string, unknown>>;
  setConfig(path: string, value: unknown): Promise<Record<string, unknown>>;
  getTrace(traceId: string): Promise<TraceRecord | undefined>;
  analyzeTrace(traceId: string): Promise<RuntimeTraceAnalysis | undefined>;
  getTraceTree(traceId: string): Promise<RuntimeTraceTreeNode | undefined>;
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
  submitFeedback(entry: {
    selectedAgent: string;
    recommendedAgent?: string;
    rating?: number;
    feedbackType?: string;
    taskDescription: string;
    userComment?: string;
    outcome?: string;
    durationMs?: number;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<FeedbackEntry>;
  listFeedbackHistory(options?: { agentId?: string; limit?: number; since?: string }): Promise<FeedbackEntry[]>;
  getFeedbackStats(agentId: string): Promise<RuntimeFeedbackStats>;
  getFeedbackOverview(): Promise<RuntimeFeedbackOverview>;
  getFeedbackAdjustments(agentId: string): Promise<RuntimeFeedbackAdjustment>;
  listAbilities(options?: { category?: string; tags?: string[] }): Promise<RuntimeAbility[]>;
  injectAbilities(request: {
    task: string;
    requiredAbilities?: string[];
    category?: string;
    tags?: string[];
    maxAbilities?: number;
    includeMetadata?: boolean;
  }): Promise<RuntimeAbilityInjection>;
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
  {
    policyId: 'runtime-governance',
    name: 'Runtime Governance',
    description: 'Verifies that canonical bridge and skill tool steps expose trust and provenance metadata after execution.',
    workflowPatterns: ['*'],
    stepTypes: ['tool'],
    agentPatterns: ['*'],
    guards: [
      {
        guardId: 'enforce-runtime-trust',
        stepId: '*',
        position: 'after',
        gates: ['runtime_trust'],
        onFail: 'block',
        enabled: true,
      },
    ],
    enabled: true,
    priority: 85,
  },
];

const BUILTIN_ABILITIES: RuntimeAbility[] = [
  {
    abilityId: 'workflow-first',
    name: 'Workflow First Planning',
    category: 'workflow',
    tags: ['workflow', 'planning', 'orchestration'],
    content: 'Prefer first-class workflows when the task maps cleanly to ship, architect, audit, qa, or release. Keep inputs explicit and preserve trace/session correlation.',
  },
  {
    abilityId: 'code-review',
    name: 'Deterministic Code Review',
    category: 'review',
    tags: ['review', 'correctness', 'security', 'maintainability'],
    content: 'Prioritize concrete findings with file references, severity ordering, and missing-test risks. Prefer actionable defects over narrative summaries.',
  },
  {
    abilityId: 'git-hygiene',
    name: 'Git Hygiene',
    category: 'git',
    tags: ['git', 'commit', 'pr', 'review'],
    content: 'Keep commits scoped, summarize changed files before preparing commit messages, and use diff-based evidence when reviewing branches or pull requests.',
  },
  {
    abilityId: 'agent-routing',
    name: 'Agent Routing',
    category: 'agent',
    tags: ['agent', 'capabilities', 'routing', 'delegation'],
    content: 'Route work to agents based on explicit capability overlap and keep delegated tasks bounded, observable, and trace-linked.',
  },
  {
    abilityId: 'feedback-loop',
    name: 'Feedback Loop',
    category: 'operations',
    tags: ['feedback', 'quality', 'operations'],
    content: 'Capture outcome, rating, and operator notes after meaningful runs so routing and quality adjustments can be derived from evidence instead of anecdotes.',
  },
];

export function createSharedRuntimeService(config: SharedRuntimeConfig = {}): SharedRuntimeService {
  const basePath = config.basePath ?? homedir();
  const traceStore = config.traceStore ?? createTraceStore({ basePath });
  const stateStore = config.stateStore ?? createStateStore({ basePath });
  const providerBridge = createProviderBridge({ basePath });
  const discussionCoordinator = createDiscussionCoordinator({
    maxConcurrentDiscussions: config.maxConcurrentDiscussions ?? DEFAULT_DISCUSSION_CONCURRENCY,
    maxProvidersPerDiscussion: config.maxProvidersPerDiscussion ?? DEFAULT_DISCUSSION_PROVIDER_BUDGET,
    maxDiscussionRounds: config.maxDiscussionRounds ?? DEFAULT_DISCUSSION_ROUNDS,
    providerBridge,
  });
  const providerBridgeCache = new Map<string, ReturnType<typeof createProviderBridge>>();
  providerBridgeCache.set(basePath, providerBridge);
  const discussionCoordinatorCache = new Map<string, DiscussionCoordinator>();
  discussionCoordinatorCache.set(basePath, discussionCoordinator);

  const resolveProviderBridge = (requestBasePath?: string) => {
    const resolvedBasePath = requestBasePath ?? basePath;
    const cached = providerBridgeCache.get(resolvedBasePath);
    if (cached !== undefined) {
      return cached;
    }
    const created = createProviderBridge({ basePath: resolvedBasePath });
    providerBridgeCache.set(resolvedBasePath, created);
    return created;
  };

  const resolveDiscussionCoordinator = (requestBasePath?: string) => {
    const resolvedBasePath = requestBasePath ?? basePath;
    const cached = discussionCoordinatorCache.get(resolvedBasePath);
    if (cached !== undefined) {
      return cached;
    }
    const created = createDiscussionCoordinator({
      maxConcurrentDiscussions: config.maxConcurrentDiscussions ?? DEFAULT_DISCUSSION_CONCURRENCY,
      maxProvidersPerDiscussion: config.maxProvidersPerDiscussion ?? DEFAULT_DISCUSSION_PROVIDER_BUDGET,
      maxDiscussionRounds: config.maxDiscussionRounds ?? DEFAULT_DISCUSSION_ROUNDS,
      providerBridge: resolveProviderBridge(resolvedBasePath),
    });
    discussionCoordinatorCache.set(resolvedBasePath, created);
    return created;
  };

  const queryService = createRuntimeQueryService({
    basePath,
    traceStore,
    stateStore,
    providerBridge,
    readWorkspaceConfig,
    writeWorkspaceConfig,
    listConfiguredExecutors,
    resolveWorkflowDir,
    getValueAtPath,
    setValueAtPath,
    analyzeTraceRecord,
  });

  const stateService = createRuntimeStateService({
    stateStore,
    builtinAbilities: BUILTIN_ABILITIES,
    buildFeedbackStats,
    buildFeedbackOverview,
    buildFeedbackAdjustment,
    filterAbilities,
    injectAbilities,
    buildGuardPolicySummaries,
    resolveGuardPolicyDefinition,
    resolveGuardPoliciesForCheck,
  });
  const gitService = createRuntimeGitService({ basePath });
  const orchestrationService = createRuntimeOrchestrationService({
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
    createTraceId: randomUUID,
    tokenize,
  });
  const executionService = createRuntimeExecutionService({
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
    resolveWorkflowDir,
    resolveGuardPolicies: () => resolveGuardPoliciesForCheck(stateStore),
    tokenize,
    createTraceId: randomUUID,
    runAgent: orchestrationService.runAgent,
  });
  const skillService = createRuntimeSkillService({
    basePath,
    traceStore,
    stateStore,
    createTraceId: randomUUID,
    runAgent: orchestrationService.runAgent,
  });

  return {
    ...executionService,
    ...orchestrationService,
    ...skillService,

    ...queryService,

    ...gitService,

    ...stateService,

    getStores() {
      return { traceStore, stateStore };
    },
  };
}

function resolveWorkflowDir(
  explicitWorkflowDir: string | undefined,
  requestBasePath: string | undefined,
  defaultBasePath: string,
): string {
  const resolvedBasePath = requestBasePath ?? defaultBasePath;
  return resolveEffectiveWorkflowDir({
    workflowDir: explicitWorkflowDir,
    basePath: resolvedBasePath,
  }) ?? findWorkflowDir(resolvedBasePath) ?? join(resolvedBasePath, 'workflows');
}

function buildFeedbackStats(agentId: string, entries: FeedbackEntry[]): RuntimeFeedbackStats {
  const ratings = entries.flatMap((entry) => typeof entry.rating === 'number' ? [entry.rating] : []);
  const ratingDistribution = {
    '1': ratings.filter((rating) => rating === 1).length,
    '2': ratings.filter((rating) => rating === 2).length,
    '3': ratings.filter((rating) => rating === 3).length,
    '4': ratings.filter((rating) => rating === 4).length,
    '5': ratings.filter((rating) => rating === 5).length,
  };
  const durations = entries.flatMap((entry) => typeof entry.durationMs === 'number' ? [entry.durationMs] : []);
  return {
    agentId,
    totalFeedback: entries.length,
    ratingsCount: ratings.length,
    averageRating: ratings.length > 0 ? roundNumber(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : undefined,
    ratingDistribution,
    averageDurationMs: durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : undefined,
    latestOutcome: entries[0]?.outcome,
  };
}

function buildFeedbackOverview(entries: FeedbackEntry[]): RuntimeFeedbackOverview {
  const byAgent = new Map<string, FeedbackEntry[]>();
  for (const entry of entries) {
    const list = byAgent.get(entry.selectedAgent) ?? [];
    list.push(entry);
    byAgent.set(entry.selectedAgent, list);
  }

  const topAgents = [...byAgent.entries()]
    .map(([agentId, agentEntries]) => buildFeedbackStats(agentId, agentEntries))
    .sort((left, right) => (right.averageRating ?? 0) - (left.averageRating ?? 0) || right.totalFeedback - left.totalFeedback)
    .slice(0, 5);

  const ratings = entries.flatMap((entry) => typeof entry.rating === 'number' ? [entry.rating] : []);
  return {
    totalFeedback: entries.length,
    ratedFeedback: ratings.length,
    agentsWithFeedback: byAgent.size,
    averageRating: ratings.length > 0 ? roundNumber(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : undefined,
    topAgents,
  };
}

function buildFeedbackAdjustment(agentId: string, entries: FeedbackEntry[]): RuntimeFeedbackAdjustment {
  const stats = buildFeedbackStats(agentId, entries);
  const confidence = Math.min(1, stats.ratingsCount / 5);
  const averageRating = stats.averageRating;
  const normalized = averageRating === undefined ? 0 : (averageRating - 3) / 2;
  return {
    agentId,
    adjustment: roundNumber(normalized * 0.5 * confidence),
    confidence: roundNumber(confidence),
    sampleSize: stats.ratingsCount,
    averageRating,
  };
}

function filterAbilities(abilities: RuntimeAbility[], options?: { category?: string; tags?: string[] }): RuntimeAbility[] {
  const tags = normalizeStringArray(options?.tags);
  return abilities.filter((ability) => {
    if (options?.category !== undefined && ability.category !== options.category) {
      return false;
    }
    if (tags.length > 0 && !tags.every((tag) => ability.tags.includes(tag))) {
      return false;
    }
    return true;
  });
}

function injectAbilities(
  abilities: RuntimeAbility[],
  request: {
    task: string;
    requiredAbilities?: string[];
    category?: string;
    tags?: string[];
    maxAbilities?: number;
    includeMetadata?: boolean;
  },
): RuntimeAbilityInjection {
  const required = new Set(normalizeStringArray(request.requiredAbilities));
  const taskTokens = new Set(tokenizeText(request.task));
  const ranked = filterAbilities(abilities, { category: request.category, tags: request.tags })
    .map((ability) => {
      let score = required.has(ability.abilityId) ? 100 : 0;
      for (const token of taskTokens) {
        if (ability.tags.includes(token)) {
          score += 8;
        }
        if (ability.category === token) {
          score += 4;
        }
        if (ability.name.toLowerCase().includes(token)) {
          score += 2;
        }
        if (ability.content.toLowerCase().includes(token)) {
          score += 1;
        }
      }
      return { ability, score };
    })
    .filter((entry) => entry.score > 0 || required.has(entry.ability.abilityId))
    .sort((left, right) => right.score - left.score || left.ability.name.localeCompare(right.ability.name))
    .slice(0, Math.max(1, request.maxAbilities ?? 3))
    .map((entry) => entry.ability);

  const content = ranked.map((ability) => (
    request.includeMetadata === true
      ? `## ${ability.name}\nCategory: ${ability.category}\nTags: ${ability.tags.join(', ')}\n${ability.content}`
      : ability.content
  )).join('\n\n');

  return {
    task: request.task,
    abilities: ranked,
    content,
  };
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return Array.from(new Set(values.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0)));
}

function tokenizeForMatching(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_-]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2);
}

function tokenizeText(value: string): string[] {
  return tokenizeForMatching(value);
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

function analyzeTraceRecord(trace: TraceRecord): RuntimeTraceAnalysis {
  const totalSteps = trace.stepResults.length;
  const successfulSteps = trace.stepResults.filter((step) => step.success).length;
  const failedSteps = totalSteps - successfulSteps;
  const retryCount = trace.stepResults.reduce((sum, step) => sum + step.retryCount, 0);
  const slowestStep = [...trace.stepResults]
    .sort((left, right) => right.durationMs - left.durationMs)[0];
  const durationMs = resolveTraceDuration(trace);
  const guard = extractRuntimeTraceGuardSummary(trace.metadata);
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

  if (guard !== undefined) {
    findings.push({
      level: guard.blockedByRuntimeGovernance ? 'error' : 'warn',
      code: guard.blockedByRuntimeGovernance ? 'RUNTIME_GOVERNANCE_BLOCK' : 'TRACE_GUARD_SIGNAL',
      message: guard.summary,
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
    guard,
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

    return new Promise<number>((resolve) => {
      const depth = queue.length + 1;
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
  return readCachedWorkspaceConfig(basePath);
}

async function writeWorkspaceConfig(basePath: string, config: Record<string, unknown>): Promise<void> {
  await writeCachedWorkspaceConfig(basePath, config);
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

function asOptionalStringArray(value: unknown): string[] | undefined {
  const values = asStringArray(value);
  return values.length > 0 ? values : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
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
export {
  STABLE_CATALOG_AGENT_SOURCE,
  enrichAgentEntry,
  getDefaultAgentCatalogEntry,
  getStableAgentEntry,
  isStableCatalogAgentEntry,
  listDefaultAgentCatalog,
  listStableAgentCapabilities,
  listStableAgentEntries,
  recommendStableAgents,
  toDefaultAgentRegistrations,
} from './stable-agent-catalog.js';
export type {
  DefaultAgentCatalogEntry,
  StableAgentRecommendation,
} from './stable-agent-catalog.js';
export {
  formatWorkflowInputSummary,
  getWorkflowCatalogEntry,
  listWorkflowCatalog,
} from './stable-workflow-catalog.js';
export type {
  StableWorkflowCatalogEntry,
  StableWorkflowCommandId,
  StableWorkflowRequiredInputMode,
} from './stable-workflow-catalog.js';
export {
  AUTOMATOSX_DIRECTORY,
  BRIDGE_DIRECTORY,
  SKILL_DIRECTORY,
  CANONICAL_BRIDGE_FILE,
  CANONICAL_SKILL_FILE,
  SKILL_MARKDOWN_FILE,
  BridgeKindSchema,
  ApprovalSpecSchema,
  ProvenanceSpecSchema,
  SkillDispatchModeSchema,
  SkillSpecSchema,
  BridgeArtifactSchema,
  BridgeSpecSchema,
  formatSchemaErrors,
  resolveBridgeRoot,
  resolveSkillRoot,
} from './bridge-contracts.js';
export type {
  ApprovalSpec,
  BridgeSpec,
  ProvenanceSpec,
  SkillSpec,
} from './bridge-contracts.js';
export {
  readAxBridgeTrustConfig,
  evaluateBridgeExecutionTrust,
  evaluateSkillExecutionTrust,
  assertBridgeExecutionAllowed,
  assertSkillExecutionAllowed,
  buildImportedProvenance,
  RuntimeGovernanceError,
  isRuntimeGovernanceError,
} from './bridge-governance.js';
export type {
  AxBridgeTrustConfig,
  RuntimeTrustDecision,
} from './bridge-governance.js';
export {
  createRuntimeBridgeService,
  discoverBridgeDefinitions,
  resolveBridgeReference,
  loadRequiredBridgeDefinition,
  installBridgeDefinition,
  executeBridge,
  discoverSkillDefinitions,
  resolveSkillReference,
  loadRequiredSkillDefinition,
  importSkillDocument,
  exportSkillDocument,
  scoreSkillAgainstQuery,
} from './bridge-runtime-service.js';
export type {
  BridgeLoadSuccess,
  BridgeLoadFailure,
  BridgeLoadResult,
  InstallBridgeDefinitionOptions,
  ImportSkillDocumentOptions,
  InstalledBridgeResult,
  SkillLoadSuccess,
  SkillLoadFailure,
  SkillLoadResult,
  ImportedSkillResult,
  ExportedSkillResult,
  BridgeExecutionResult,
  RuntimeBridgeService,
} from './bridge-runtime-service.js';
export {
  RuntimeTraceGuardSummarySchema,
  RuntimeGovernanceAggregateEntrySchema,
  DeniedImportedSkillAggregateEntrySchema,
  DeniedImportedSkillAggregateSchema,
  RuntimeGovernanceAggregateSchema,
  extractRuntimeTraceGuardSummary,
  buildRuntimeGovernanceAggregate,
  buildDeniedImportedSkillAggregate,
} from './runtime-governance-summary.js';
export type {
  RuntimeTraceGuardSummary,
  RuntimeGovernanceAggregateEntry,
  RuntimeGovernanceAggregate,
  RuntimeGovernanceTraceLike,
  DeniedImportedSkillAggregateEntry,
  DeniedImportedSkillAggregate,
} from './runtime-governance-summary.js';
export { createRuntimeSkillService } from './runtime-skill-service.js';
export {
  isBundledWorkflowDir,
  resolveBundledWorkflowDir,
  resolveEffectiveWorkflowDir,
  resolveWorkspaceWorkflowDir,
} from './stable-workflow-paths.js';
