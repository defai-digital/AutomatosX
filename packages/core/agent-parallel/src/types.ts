/**
 * Parallel Agent Execution Types
 *
 * Port interfaces and type definitions for parallel agent execution.
 */

import type {
  AgentParallelTask,
  AgentParallelTaskResult,
  AgentParallelGroupResult,
  AgentParallelExecutionConfig,
  ExecutionPlan,
  SharedContext,
} from '@defai.digital/contracts';

// ============================================================================
// Agent Executor Port
// ============================================================================

/**
 * Agent execution request
 */
export interface AgentExecuteRequest {
  agentId: string;
  input: unknown;
  provider?: string;
  model?: string;
  timeout?: number;
  sessionId?: string;
}

/**
 * Agent execution result
 */
export interface AgentExecuteResult {
  success: boolean;
  agentId: string;
  output?: unknown;
  error?: string;
  errorCode?: string;
  durationMs: number;
}

/**
 * Port interface for agent execution
 * Implementations inject actual agent executor at runtime
 */
export interface AgentExecutorPort {
  /**
   * Execute a single agent with input
   */
  execute(request: AgentExecuteRequest): Promise<AgentExecuteResult>;

  /**
   * Check if an agent exists
   */
  exists(agentId: string): Promise<boolean>;
}

// ============================================================================
// Parallel Orchestrator Interface
// ============================================================================

/**
 * Parallel agent orchestrator interface
 */
export interface AgentParallelOrchestrator {
  /**
   * Execute multiple agents in parallel with DAG-based dependency management
   * INV-APE-001: Respects maxConcurrentAgents
   * INV-APE-002: Honors dependencies
   * INV-APE-003: Shared context immutable
   */
  executeParallel(
    tasks: AgentParallelTask[],
    config?: Partial<AgentParallelExecutionConfig>,
    sharedContext?: Record<string, unknown>
  ): Promise<AgentParallelGroupResult>;

  /**
   * Build execution plan without executing
   * Returns DAG analysis showing execution layers
   */
  buildExecutionPlan(tasks: AgentParallelTask[]): ExecutionPlan;

  /**
   * Cancel ongoing execution
   */
  cancel(): void;

  /**
   * Get current configuration
   */
  getConfig(): AgentParallelExecutionConfig;
}

// ============================================================================
// DAG Analyzer Interface
// ============================================================================

/**
 * Execution layer - tasks at same level can run in parallel
 */
export interface TaskLayer {
  index: number;
  tasks: AgentParallelTask[];
}

/**
 * DAG analysis result
 */
export interface DAGAnalysisResult {
  layers: TaskLayer[];
  totalLayers: number;
  maxParallelism: number;
  hasCycles: boolean;
  cycleNodes?: string[];
}

/**
 * DAG analyzer interface
 */
export interface DAGAnalyzer {
  /**
   * Analyze tasks and build execution layers
   * INV-APE-002: Ensures dependencies honored
   * INV-APE-200: Detects circular dependencies
   */
  analyze(tasks: AgentParallelTask[]): DAGAnalysisResult;

  /**
   * Validate DAG structure
   */
  validate(tasks: AgentParallelTask[]): { valid: boolean; errors: string[] };
}

// ============================================================================
// Context Manager Interface
// ============================================================================

/**
 * Context manager for shared immutable context
 * INV-APE-003: Context immutable during execution
 */
export interface ContextManager {
  /**
   * Create frozen shared context
   */
  create(data: Record<string, unknown>): SharedContext;

  /**
   * Get read-only view of context
   */
  get(): SharedContext | null;

  /**
   * Check if context is frozen/immutable
   */
  isFrozen(): boolean;

  /**
   * Clear context (for cleanup)
   */
  clear(): void;
}

// ============================================================================
// Result Aggregator Interface
// ============================================================================

/**
 * Result aggregation strategy
 */
export type AggregationStrategy = 'merge' | 'list' | 'firstSuccess' | 'custom';

/**
 * Custom aggregation function
 */
export type CustomAggregator = (
  results: AgentParallelTaskResult[]
) => unknown;

/**
 * Result aggregator options
 */
export interface ResultAggregatorOptions {
  strategy: AggregationStrategy;
  customAggregator?: CustomAggregator;
}

/**
 * Result aggregator interface
 * INV-APE-004: Aggregation follows configured strategy
 */
export interface ResultAggregator {
  /**
   * Aggregate task results based on strategy
   */
  aggregate(
    results: AgentParallelTaskResult[],
    options: ResultAggregatorOptions
  ): unknown;
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Progress event types
 */
export type ParallelProgressEventType =
  | 'execution.started'
  | 'layer.started'
  | 'layer.completed'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.skipped'
  | 'execution.completed'
  | 'execution.cancelled';

/**
 * Progress event
 */
export interface ParallelProgressEvent {
  type: ParallelProgressEventType;
  timestamp: string;
  groupId: string;
  layerIndex?: number;
  taskId?: string;
  agentId?: string;
  totalTasks?: number;
  completedTasks?: number;
  failedTasks?: number;
  message?: string;
}

/**
 * Progress callback
 */
export type ParallelProgressCallback = (event: ParallelProgressEvent) => void;

// ============================================================================
// Orchestrator Options
// ============================================================================

/**
 * Options for creating parallel orchestrator
 */
export interface AgentParallelOrchestratorOptions {
  /**
   * Agent executor port (for dependency injection)
   */
  agentExecutor: AgentExecutorPort;

  /**
   * Default configuration
   */
  defaultConfig?: Partial<AgentParallelExecutionConfig>;

  /**
   * Progress callback for execution updates
   */
  onProgress?: ParallelProgressCallback;
}

// ============================================================================
// Stub Implementation (for testing)
// ============================================================================

/**
 * Stub agent executor for testing
 */
export class StubAgentExecutor implements AgentExecutorPort {
  private results: Map<string, AgentExecuteResult> = new Map();
  private existingAgents: Set<string> = new Set();

  /**
   * Set expected result for an agent
   */
  setResult(agentId: string, result: Partial<AgentExecuteResult>): void {
    this.results.set(agentId, {
      success: true,
      agentId,
      durationMs: 100,
      ...result,
    });
  }

  /**
   * Set agent as existing
   */
  setExists(agentId: string, exists: boolean): void {
    if (exists) {
      this.existingAgents.add(agentId);
    } else {
      this.existingAgents.delete(agentId);
    }
  }

  async execute(request: AgentExecuteRequest): Promise<AgentExecuteResult> {
    const result = this.results.get(request.agentId);
    if (result) {
      return result;
    }

    // Default: return success with echo output
    return {
      success: true,
      agentId: request.agentId,
      output: { input: request.input, echo: true },
      durationMs: 50,
    };
  }

  async exists(agentId: string): Promise<boolean> {
    return this.existingAgents.has(agentId) || this.results.has(agentId);
  }
}
