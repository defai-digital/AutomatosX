/**
 * Agent Domain Types
 */

import {
  type AgentProfile,
  type AgentResult,
  type AgentRunOptions,
  type AgentError,
  type AgentEvent,
  type AgentWorkflowStep,
  type ToolExecutionResult,
  type DelegationContext,
  type DelegationCheckResult,
  type DelegationResult,
  type DelegationRequest as ContractDelegationRequest,
  TIMEOUT_AGENT_STEP_DEFAULT,
  LIMIT_EVENT_BUFFER,
  PROVIDER_DEFAULT,
  LIMIT_DELEGATION_DEPTH,
} from '@defai.digital/contracts';

/**
 * Agent registry interface
 */
export interface AgentRegistry {
  /**
   * Register a new agent profile
   */
  register(profile: AgentProfile): Promise<void>;

  /**
   * Get an agent by ID
   */
  get(agentId: string): Promise<AgentProfile | undefined>;

  /**
   * List all registered agents
   */
  list(filter?: AgentFilter): Promise<AgentProfile[]>;

  /**
   * Update an agent profile
   */
  update(agentId: string, updates: Partial<AgentProfile>): Promise<void>;

  /**
   * Remove an agent
   */
  remove(agentId: string): Promise<void>;

  /**
   * Check if an agent exists
   */
  exists(agentId: string): Promise<boolean>;
}

/**
 * Filter options for listing agents
 */
export interface AgentFilter {
  team?: string;
  tags?: string[];
  enabled?: boolean;
  capability?: string;
}

/**
 * Agent executor interface
 */
export interface AgentExecutor {
  /**
   * Execute an agent with the given input
   */
  execute(
    agentId: string,
    input: unknown,
    options?: AgentRunOptions
  ): Promise<AgentResult>;

  /**
   * Cancel a running agent execution
   */
  cancel(executionId: string): Promise<void>;

  /**
   * Get execution status
   */
  getStatus(executionId: string): Promise<ExecutionStatus | undefined>;
}

/**
 * Execution status
 */
export interface ExecutionStatus {
  executionId: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: string | undefined;
  startedAt: string;
  completedAt: string | undefined;
  progress: ExecutionProgress | undefined;
}

/**
 * Execution progress
 */
export interface ExecutionProgress {
  totalSteps: number;
  completedSteps: number;
  currentStepName: string | undefined;
  percentComplete: number;
}

/**
 * Delegation request
 */
export interface DelegationRequest {
  fromAgent: string;
  toAgent: string;
  task: string;
  input: unknown;
  timeout?: number;
  context?: Record<string, unknown>;
}

/**
 * Delegation tracker interface - port for tracking delegation chains
 *
 * Implementations provided via DelegationTrackerFactory in AgentDomainConfig.
 * This allows the agent-domain to remain independent of execution implementations.
 *
 * Invariants:
 * - INV-DT-001: Depth never exceeds maxDepth
 * - INV-DT-002: No circular delegations allowed
 */
export interface DelegationTrackerPort {
  /** Get current delegation context */
  getContext(): DelegationContext;

  /** Check if delegation to target agent is allowed */
  canDelegate(toAgentId: string): DelegationCheckResult;

  /** Create delegation request */
  createDelegationRequest(
    toAgentId: string,
    task: string,
    input?: unknown,
    timeout?: number
  ): ContractDelegationRequest | null;

  /** Create child context for delegated agent */
  createChildContext(toAgentId: string): DelegationContext;

  /** Record delegation result */
  recordResult(result: DelegationResult): void;

  /** Get delegation history */
  getHistory(): DelegationResult[];

  /** Check if we're at the root of delegation chain */
  isRoot(): boolean;

  /** Get remaining delegation depth */
  getRemainingDepth(): number;
}

/**
 * Factory function type for creating delegation trackers
 * Injected via AgentDomainConfig for dependency inversion
 */
export type DelegationTrackerFactory = (
  agentId: string,
  parentContext: DelegationContext | undefined,
  maxDepth: number
) => DelegationTrackerPort;

// ============================================================================
// Checkpoint Types (Port Interfaces)
// ============================================================================

/**
 * Checkpoint storage port interface
 *
 * Implementations provided via CheckpointStorageFactory in config.
 * INV-CP-001: Checkpoints contain all data needed to resume
 */
export interface CheckpointStoragePort {
  /** Save a checkpoint */
  save(checkpoint: Checkpoint): Promise<void>;

  /** Load a checkpoint by ID */
  load(checkpointId: string): Promise<Checkpoint | null>;

  /** Load latest checkpoint for an agent */
  loadLatest(agentId: string, sessionId?: string): Promise<Checkpoint | null>;

  /** List checkpoints for an agent */
  list(agentId: string, sessionId?: string): Promise<Checkpoint[]>;

  /** Delete a checkpoint */
  delete(checkpointId: string): Promise<boolean>;

  /** Delete expired checkpoints */
  deleteExpired(): Promise<number>;
}

/**
 * Checkpoint data structure
 */
export interface Checkpoint {
  checkpointId: string;
  agentId: string;
  sessionId?: string | undefined;
  stepIndex: number;
  stepId: string;
  previousOutputs: Record<string, unknown>;
  metadata?: Record<string, unknown> | undefined;
  createdAt: string;
  expiresAt?: string | undefined;
}

/**
 * Checkpoint manager port interface
 *
 * Manages checkpoints for a specific agent execution.
 * INV-CP-002: Resume starts from step after checkpoint
 */
export interface CheckpointManagerPort {
  /** Get configuration */
  getConfig(): import('@defai.digital/contracts').CheckpointConfig;

  /** Check if should create checkpoint at step index */
  shouldCheckpoint(stepIndex: number): boolean;

  /** Create a checkpoint */
  createCheckpoint(
    stepIndex: number,
    stepId: string,
    previousOutputs: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<Checkpoint>;

  /** Get latest checkpoint */
  getLatestCheckpoint(): Promise<Checkpoint | null>;

  /** Get resume context from checkpoint */
  getResumeContext(checkpointId: string): Promise<{
    startFromStep: number;
    previousOutputs: Record<string, unknown>;
  } | null>;

  /** Clean up expired checkpoints */
  cleanup(): Promise<number>;
}

/**
 * Factory for creating checkpoint storage
 */
export type CheckpointStorageFactory = () => CheckpointStoragePort;

/**
 * Factory for creating checkpoint managers
 */
export type CheckpointManagerFactory = (
  agentId: string,
  sessionId: string | undefined,
  storage: CheckpointStoragePort,
  config: import('@defai.digital/contracts').CheckpointConfig
) => CheckpointManagerPort;

// ============================================================================
// Parallel Execution Types (Port Interfaces)
// ============================================================================

/**
 * Step executor function for parallel execution
 */
export type ParallelStepExecutor = (
  step: AgentWorkflowStep,
  previousOutputs: Record<string, unknown>
) => Promise<unknown>;

/**
 * Result from parallel step execution
 */
export interface ParallelStepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  cancelled?: boolean;
}

/**
 * Result from parallel group execution
 */
export interface ParallelGroupResult {
  stepResults: ParallelStepResult[];
  totalDurationMs: number;
  allSucceeded: boolean;
  failedCount: number;
  cancelledCount: number;
}

/**
 * Parallel executor port interface
 *
 * Executes workflow steps in parallel while respecting dependencies.
 * INV-PE-001: Independent steps execute concurrently
 * INV-PE-002: Dependencies honored (DAG ordering)
 * INV-PE-003: Concurrency limit respected
 */
export interface ParallelExecutorPort {
  /** Get configuration */
  getConfig(): import('@defai.digital/contracts').ParallelExecutionConfig;

  /** Execute a group of steps in parallel */
  executeGroup(
    steps: AgentWorkflowStep[],
    executor: ParallelStepExecutor,
    previousOutputs?: Record<string, unknown>
  ): Promise<ParallelGroupResult>;

  /** Build execution layers from steps (DAG analysis) */
  buildExecutionLayers(steps: AgentWorkflowStep[]): AgentWorkflowStep[][];

  /** Cancel ongoing execution */
  cancel(): void;
}

/**
 * Factory for creating parallel executors
 */
export type ParallelExecutorFactory = (
  config: Partial<import('@defai.digital/contracts').ParallelExecutionConfig>
) => ParallelExecutorPort;

/**
 * Delegation manager interface
 */
export interface DelegationManager {
  /**
   * Delegate a task to another agent
   */
  delegate(request: DelegationRequest): Promise<DelegationResult>;

  /**
   * Check if delegation is allowed
   */
  canDelegate(fromAgent: string, toAgent: string, depth: number): boolean;

  /**
   * Get current delegation depth
   */
  getDepth(executionId: string): number;
}

/**
 * Event handler for agent events
 */
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;

/**
 * Agent event emitter interface
 */
export interface AgentEventEmitter {
  /**
   * Subscribe to agent events
   */
  on(type: AgentEvent['type'] | '*', handler: AgentEventHandler): void;

  /**
   * Unsubscribe from agent events
   */
  off(type: AgentEvent['type'] | '*', handler: AgentEventHandler): void;

  /**
   * Emit an agent event
   */
  emit(event: AgentEvent): void;
}

/**
 * Step executor function type
 */
export type StepExecutorFn = (
  step: AgentWorkflowStep,
  context: StepExecutionContext
) => Promise<StepExecutionResult>;

/**
 * Minimal agent profile for step execution (avoids re-fetching from registry)
 * Uses AbilitySelection type from contracts for compatibility
 */
export interface StepAgentProfile {
  agentId: string;
  description?: string | undefined;
  systemPrompt?: string | undefined;
  abilities?: import('@defai.digital/contracts').AbilitySelection | undefined;
}

/**
 * Step execution context
 */
export interface StepExecutionContext {
  agentId: string;
  executionId: string;
  sessionId: string | undefined;
  input: unknown;
  previousOutputs: Record<string, unknown>;
  memory: unknown[] | undefined;
  provider: string | undefined;
  model: string | undefined;
  /**
   * Delegation context for tracking delegation depth and chain
   * INV-DT-001: Used to enforce max delegation depth
   * INV-DT-002: Used to prevent circular delegations
   */
  delegationContext: import('@defai.digital/contracts').DelegationContext | undefined;
  /**
   * Agent profile cached at execution start to avoid repeated registry lookups
   * Performance optimization: avoids N database queries for N workflow steps
   */
  agentProfile?: StepAgentProfile | undefined;
  /**
   * Trace hierarchy for hierarchical tracing across delegations
   * INV-TR-020: All traces in hierarchy share rootTraceId
   * INV-TR-021: Child traces reference parentTraceId
   * INV-TR-022: Depth increases by 1 for each level
   * INV-TR-023: Session correlation
   */
  traceHierarchy?: import('@defai.digital/contracts').TraceHierarchy | undefined;
  /**
   * Current trace ID for this execution
   * Used by child agents to set parentTraceId
   */
  traceId?: string | undefined;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  success: boolean;
  output?: unknown;
  error: AgentError | undefined;
  durationMs: number;
  retryCount: number;
}

/**
 * Prompt execution request
 */
export interface PromptExecutionRequest {
  /**
   * The prompt text to send to the LLM
   */
  prompt: string;

  /**
   * System prompt (agent instructions)
   */
  systemPrompt?: string | undefined;

  /**
   * Provider to use (e.g., 'claude', 'gemini')
   */
  provider?: string | undefined;

  /**
   * Model to use (if not specified, provider default is used)
   */
  model?: string | undefined;

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number | undefined;

  /**
   * Temperature for sampling (0-2)
   */
  temperature?: number | undefined;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number | undefined;
}

/**
 * Prompt execution response
 */
export interface PromptExecutionResponse {
  /**
   * Whether execution succeeded
   */
  success: boolean;

  /**
   * Generated content (on success)
   */
  content?: string | undefined;

  /**
   * Error message (on failure)
   */
  error?: string | undefined;

  /**
   * Error code (on failure)
   */
  errorCode?: string | undefined;

  /**
   * Provider used
   */
  provider?: string | undefined;

  /**
   * Model used
   */
  model?: string | undefined;

  /**
   * Execution latency in milliseconds
   */
  latencyMs: number;

  /**
   * Token usage (if available)
   */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | undefined;
}

/**
 * Interface for executing prompts via LLM providers
 * This abstraction allows the agent domain to remain independent of provider implementations
 */
export interface PromptExecutor {
  /**
   * Execute a prompt and return the response
   */
  execute(request: PromptExecutionRequest): Promise<PromptExecutionResponse>;

  /**
   * Check if a provider is available
   */
  isProviderAvailable(providerId: string): Promise<boolean>;

  /**
   * Get list of available providers
   */
  getAvailableProviders(): Promise<string[]>;

  /**
   * Get the default provider ID
   */
  getDefaultProvider(): string;
}

/**
 * Prompt step configuration
 */
export interface PromptStepConfig {
  /**
   * The prompt template (supports ${variable} substitution)
   */
  prompt?: string | undefined;

  /**
   * System prompt override (defaults to agent.systemPrompt)
   */
  systemPrompt?: string | undefined;

  /**
   * Provider to use
   */
  provider?: string | undefined;

  /**
   * Model to use
   */
  model?: string | undefined;

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number | undefined;

  /**
   * Temperature for sampling
   */
  temperature?: number | undefined;

  /**
   * Timeout for this step
   */
  timeout?: number | undefined;
}

/**
 * Tool executor interface
 *
 * Bridges agent/workflow execution to MCP tools.
 * Allows tool steps to execute real tools without direct dependency on mcp-server.
 *
 * Invariants:
 * - INV-TOOL-001: Tool execution must validate inputs before execution
 * - INV-TOOL-002: Tool results must be immutable (frozen) after creation
 * - INV-TOOL-003: Unknown tools must return error, not throw
 */
export interface ToolExecutor {
  /**
   * Execute a tool by name with the given arguments
   */
  execute(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult>;

  /**
   * Check if a tool is available
   */
  isToolAvailable(toolName: string): boolean;

  /**
   * Get list of available tool names
   */
  getAvailableTools(): string[];
}

/**
 * Ability manager interface (from ability-domain)
 * Used to inject abilities into agent prompts
 */
export interface AbilityManagerLike {
  /**
   * Inject abilities into agent context
   */
  injectAbilities(
    agentId: string,
    task: string,
    coreAbilities?: string[],
    options?: { maxAbilities?: number; maxTokens?: number; includeMetadata?: boolean }
  ): Promise<{
    agentId: string;
    injectedAbilities: string[];
    combinedContent: string;
    tokenCount?: number | undefined;
    truncated: boolean;
  }>;
}

/**
 * Agent domain configuration
 */
export interface AgentDomainConfig {
  maxDelegationDepth: number;
  defaultTimeout: number;
  enableCheckpoints: boolean;
  eventBufferSize: number;
  /**
   * Default provider for prompt execution
   */
  defaultProvider?: string | undefined;
  /**
   * Prompt executor for real LLM calls (if not provided, uses stub executor)
   * NOTE: In production mode (NODE_ENV=production or AX_MODE=production),
   * a real executor must be provided or an error will be thrown.
   */
  promptExecutor?: PromptExecutor | undefined;
  /**
   * Tool executor for executing MCP tools from workflow/agent steps.
   * If not provided, tool steps will return placeholder results.
   * NOTE: In production mode, a real executor should be provided.
   *
   * Invariants:
   * - INV-TOOL-001: Tool execution validates inputs
   * - INV-TOOL-002: Tool results are immutable
   * - INV-TOOL-003: Unknown tools return errors gracefully
   */
  toolExecutor?: ToolExecutor | undefined;
  /**
   * Ability manager for injecting abilities into prompts (optional)
   * INV-AGT-ABL-001: When provided, abilities are injected before prompt execution
   */
  abilityManager?: AbilityManagerLike | undefined;
  /**
   * Enable ability injection for prompt steps (default: true if abilityManager is provided)
   */
  enableAbilityInjection?: boolean | undefined;
  /**
   * Maximum tokens for ability injection (default: 10000)
   */
  maxAbilityTokens?: number | undefined;
  /**
   * Factory for creating delegation trackers (dependency injection)
   * If not provided, uses a stub implementation that logs warnings.
   *
   * Invariants:
   * - INV-DT-001: Depth never exceeds maxDepth
   * - INV-DT-002: No circular delegations allowed
   */
  delegationTrackerFactory?: DelegationTrackerFactory | undefined;
}

/**
 * Default agent domain configuration
 */
export const DEFAULT_AGENT_DOMAIN_CONFIG: AgentDomainConfig = {
  maxDelegationDepth: LIMIT_DELEGATION_DEPTH,
  defaultTimeout: TIMEOUT_AGENT_STEP_DEFAULT,
  enableCheckpoints: true,
  eventBufferSize: LIMIT_EVENT_BUFFER,
  defaultProvider: PROVIDER_DEFAULT,
};

// ============================================================================
// Agent Loader Types
// ============================================================================

/**
 * Agent loader interface - loads agent profiles from various sources
 */
export interface AgentLoader {
  /**
   * Load an agent profile by ID
   */
  load(agentId: string): Promise<AgentProfile | undefined>;

  /**
   * Load all agent profiles from the source
   */
  loadAll(): Promise<AgentProfile[]>;

  /**
   * Check if an agent exists in the source
   */
  exists(agentId: string): Promise<boolean>;

  /**
   * Reload agent profiles from source
   */
  reload(): Promise<void>;
}

/**
 * Agent loader configuration
 */
export interface AgentLoaderConfig {
  /** Directory path to load agents from */
  agentsDir: string;
  /** File extensions to load (default: ['.yaml', '.yml', '.json']) */
  extensions?: string[];
  /** Watch for file changes */
  watch?: boolean;
}

// ============================================================================
// Agent Selector Types
// ============================================================================

/**
 * Agent selection result
 */
export interface AgentSelectionResult {
  /** Selected agent ID */
  agentId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for selection */
  reason: string;
  /** Alternative agents considered */
  alternatives: {
    agentId: string;
    confidence: number;
  }[];
}

/**
 * Agent selector interface - selects the best agent for a task
 */
export interface AgentSelector {
  /**
   * Select the best agent for a task
   */
  select(task: string, context?: AgentSelectionContext): Promise<AgentSelectionResult>;

  /**
   * Get all agents that match a task
   */
  match(task: string, context?: AgentSelectionContext): Promise<AgentSelectionResult[]>;
}

/**
 * Context for agent selection
 */
export interface AgentSelectionContext {
  /** Current team (if any) */
  team?: string;
  /** Required capabilities */
  requiredCapabilities?: string[];
  /** Excluded agents */
  excludeAgents?: string[];
  /** Preferred provider */
  preferredProvider?: string;
  /** Maximum delegation depth */
  maxDelegationDepth?: number;
}
