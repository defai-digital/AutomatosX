import {
  type StepResult,
  type StepGuardContext,
  type StepGuardPolicy,
  type StepGuardResult,
} from '@defai.digital/workflow-engine';
import {
  type TraceRecord,
  type TraceStore,
  type TraceSurface,
} from '@defai.digital/trace-store';
import {
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
import type { RuntimeTraceGuardSummary } from './runtime-governance-summary.js';
import type {
  ReviewFocus,
  RuntimeReviewResponse,
} from './review.js';
import type { BridgeExecutionResult } from './bridge-runtime-service.js';

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
