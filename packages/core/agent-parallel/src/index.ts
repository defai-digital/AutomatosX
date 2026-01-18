/**
 * @defai.digital/agent-parallel
 *
 * Parallel Agent Execution Domain
 *
 * Provides orchestration for executing multiple agents in parallel
 * with DAG-based dependency management, shared immutable context,
 * and configurable result aggregation.
 *
 * @module @defai.digital/agent-parallel
 */

// Main Orchestrator
export {
  createAgentParallelOrchestrator,
  ParallelExecutionError,
} from './orchestrator.js';

// DAG Analyzer
export {
  createDAGAnalyzer,
  DAGAnalysisError,
  findCyclePath,
} from './dag-analyzer.js';

// Context Manager
export {
  createContextManager,
  createImmutableContextProxy,
  validateContextData,
  ContextMutationError,
} from './context-manager.js';

// Result Aggregator
export {
  createResultAggregator,
  AggregationStrategies,
  createKeyedAggregator,
  createTransformAggregator,
  getAggregationStrategy,
} from './result-aggregator.js';

// Types and Interfaces
export type {
  // Orchestrator types
  AgentParallelOrchestrator,
  AgentParallelOrchestratorOptions,
  // Agent executor port
  AgentExecutorPort,
  AgentExecuteRequest,
  AgentExecuteResult,
  // DAG types
  DAGAnalyzer,
  DAGAnalysisResult,
  TaskLayer,
  // Context types
  ContextManager,
  // Result aggregator types
  ResultAggregator,
  ResultAggregatorOptions,
  AggregationStrategy,
  CustomAggregator,
  // Progress types
  ParallelProgressEvent,
  ParallelProgressEventType,
  ParallelProgressCallback,
} from './types.js';

// Stub implementation for testing
export { StubAgentExecutor } from './types.js';
