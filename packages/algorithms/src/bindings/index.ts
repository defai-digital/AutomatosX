/**
 * AutomatosX Algorithms
 *
 * Performance-critical algorithms for the AutomatosX platform.
 * Includes TypeScript bindings for ReScript implementations.
 *
 * Algorithms:
 * - Routing: Multi-factor provider selection
 * - DAG: Directed Acyclic Graph scheduling
 * - Ranking: Memory entry relevance ranking
 *
 * @packageDocumentation
 * @module @ax/algorithms
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// Routing algorithm with task-aware provider selection
export {
  type Provider,
  type RoutingContext,
  type RoutingResult,
  type TaskClass,
  defaultRoutingContext,
  calculateScore,
  selectProvider,
  getFallbackOrder,
  // Task classification
  classifyTask,
  // Task and agent affinity exports
  TASK_PROVIDER_AFFINITY,
  AGENT_PROVIDER_AFFINITY,
  getBestProviderForTask,
  getBestProviderForAgent,
  getSupportedTaskTypes,
  getAgentsWithAffinities,
  getProviderTaskAffinity,
  getProviderAgentAffinity,
} from './routing.js';

// DAG scheduling algorithm
export {
  type DagNode,
  type ScheduleGroup,
  type ScheduleResult,
  hasCycle,
  findCriticalPath,
  scheduleParallel,
  getExecutionOrder,
  validateDag,
} from './dag.js';

// Memory ranking algorithm
export {
  type MemoryEntry as RankableMemoryEntry,
  type RankingContext,
  type ScoreBreakdown,
  type RankedEntry,
  defaultRankingContext,
  calculateRecencyScore,
  calculateFrequencyScore,
  calculateTypeBonus,
  calculateTagBonus,
  normalizeFtsScore,
  rankEntry,
  rankEntries,
  getTopRanked,
  createRankingContext,
  validateWeights,
} from './ranking.js';
