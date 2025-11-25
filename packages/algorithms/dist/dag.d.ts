/**
 * TypeScript bindings for ReScript DagScheduler module
 *
 * @module @ax/algorithms/dag
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
interface DagNode {
    id: string;
    deps: string[];
    estimatedDuration: number;
    priority: number;
}
interface ScheduleGroup {
    nodes: string[];
    parallelizable: boolean;
    estimatedDuration: number;
}
interface ScheduleResult {
    groups: ScheduleGroup[];
    totalEstimatedDuration: number;
    criticalPath: string[];
    error?: string;
}
/**
 * Detect cycles in the DAG using DFS
 */
declare function hasCycle(nodes: DagNode[]): boolean;
/**
 * Find the critical path (longest path through the DAG)
 */
declare function findCriticalPath(nodes: DagNode[]): string[];
/**
 * Schedule DAG nodes for parallel execution
 */
declare function scheduleParallel(nodes: DagNode[]): ScheduleResult;
/**
 * Get flattened execution order
 */
declare function getExecutionOrder(result: ScheduleResult): string[];
/**
 * Validate DAG structure
 */
declare function validateDag(nodes: DagNode[]): {
    valid: boolean;
    errors: string[];
};

export { type DagNode, type ScheduleGroup, type ScheduleResult, findCriticalPath, getExecutionOrder, hasCycle, scheduleParallel, validateDag };
