/**
 * TypeScript bindings for ReScript DagScheduler module
 *
 * @module @ax/algorithms/dag
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// DAG Scheduler Constants
// =============================================================================

/** Default priority for tasks without explicit priority (midpoint of 1-10 scale) */
const DEFAULT_TASK_PRIORITY = 5;

/** Maximum parent directories to search for cycle detection safety */
const MAX_PARENT_SEARCH = 10;

// =============================================================================
// Types
// =============================================================================

// Types that mirror ReScript types
export interface DagNode {
  id: string;
  deps: string[];
  estimatedDuration: number; // milliseconds
  priority: number; // 1-10, lower = higher priority
}

export interface ScheduleGroup {
  nodes: string[];
  parallelizable: boolean;
  estimatedDuration: number;
}

export interface ScheduleResult {
  groups: ScheduleGroup[];
  totalEstimatedDuration: number;
  criticalPath: string[];
  error?: string;
}

/**
 * Detect cycles in the DAG using DFS
 */
export function hasCycle(nodes: DagNode[]): boolean {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) {
      return true; // Cycle found
    }
    if (visited.has(nodeId)) {
      return false; // Already processed
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const dep of node.deps) {
        if (dfs(dep)) {
          return true;
        }
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  return nodes.some((n) => dfs(n.id));
}

/**
 * Find the critical path (longest path through the DAG)
 */
export function findCriticalPath(nodes: DagNode[]): string[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const longestPath = new Map<string, number>();
  const pathPredecessor = new Map<string, string>();

  // Topological sort
  const inDegree = new Map<string, number>();
  nodes.forEach((n) => inDegree.set(n.id, n.deps.length));

  const queue = nodes.filter((n) => n.deps.length === 0).map((n) => n.id);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    // Use explicit undefined check to allow empty string IDs
    if (current === undefined) break;
    sorted.push(current);

    nodes.forEach((n) => {
      if (n.deps.includes(current)) {
        const newDegree = (inDegree.get(n.id) ?? 0) - 1;
        inDegree.set(n.id, newDegree);
        if (newDegree === 0) {
          queue.push(n.id);
        }
      }
    });
  }

  // Validate topological sort completed (all nodes processed)
  // If not all nodes processed, there's an undetected cycle or missing deps
  if (sorted.length !== nodes.length) {
    return []; // Return empty path for incomplete DAG
  }

  // Calculate longest paths
  sorted.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (node) {
      let maxPredDuration = 0;
      let hasPredecessor = false;
      node.deps.forEach((dep) => {
        const depDuration = longestPath.get(dep) ?? 0;
        // Use > (not >=) to keep first predecessor on ties (consistent, stable behavior)
        if (!hasPredecessor || depDuration > maxPredDuration) {
          maxPredDuration = depDuration;
          pathPredecessor.set(nodeId, dep);
          hasPredecessor = true;
        }
      });
      longestPath.set(nodeId, maxPredDuration + node.estimatedDuration);
    }
  });

  // Find end node with longest path
  let endNode = '';
  let maxDuration = 0;
  nodes.forEach((node) => {
    const duration = longestPath.get(node.id) ?? 0;
    if (duration > maxDuration) {
      maxDuration = duration;
      endNode = node.id;
    }
  });

  // Reconstruct path with safety guard against infinite loops (corrupted predecessor data)
  const path: string[] = [];
  let current: string | undefined = endNode;
  let maxIterations = nodes.length + 1;
  while (current && maxIterations-- > 0) {
    path.unshift(current);
    current = pathPredecessor.get(current);
  }

  // Warn if we hit the iteration limit (indicates corrupted data)
  if (maxIterations <= 0 && current) {
    console.warn('[ax/algorithms] Critical path reconstruction hit iteration limit, possible circular predecessor');
  }

  return path;
}

/**
 * Schedule DAG nodes for parallel execution
 */
export function scheduleParallel(nodes: DagNode[]): ScheduleResult {
  // Check for cycles
  if (hasCycle(nodes)) {
    return {
      groups: [],
      totalEstimatedDuration: 0,
      criticalPath: [],
      error: 'Cycle detected in DAG',
    };
  }

  if (nodes.length === 0) {
    return {
      groups: [],
      totalEstimatedDuration: 0,
      criticalPath: [],
    };
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const remaining = new Set(nodes.map((n) => n.id));
  const completed = new Set<string>();
  const groups: ScheduleGroup[] = [];
  let totalDuration = 0;

  while (remaining.size > 0) {
    // Find ready nodes (all deps completed)
    const ready = [...remaining].filter((nodeId) => {
      const node = nodeMap.get(nodeId);
      return node ? node.deps.every((dep) => completed.has(dep)) : false;
    });

    if (ready.length === 0) {
      break;
    }

    // Sort by priority
    ready.sort((a, b) => {
      const priorityA = nodeMap.get(a)?.priority ?? DEFAULT_TASK_PRIORITY;
      const priorityB = nodeMap.get(b)?.priority ?? DEFAULT_TASK_PRIORITY;
      return priorityA - priorityB;
    });

    // Calculate group duration (max of parallel tasks)
    const groupDuration = ready.reduce((max, nodeId) => {
      const node = nodeMap.get(nodeId);
      return node ? Math.max(max, node.estimatedDuration) : max;
    }, 0);

    groups.push({
      nodes: ready,
      parallelizable: ready.length > 1,
      estimatedDuration: groupDuration,
    });

    totalDuration += groupDuration;

    // Mark completed and remove from remaining
    ready.forEach((id) => {
      completed.add(id);
      remaining.delete(id);
    });
  }

  return {
    groups,
    totalEstimatedDuration: totalDuration,
    criticalPath: findCriticalPath(nodes),
  };
}

/**
 * Get flattened execution order
 */
export function getExecutionOrder(result: ScheduleResult): string[] {
  return result.groups.flatMap((g) => g.nodes);
}

/**
 * Validate DAG structure
 */
export function validateDag(nodes: DagNode[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Check for duplicate IDs
  if (nodeIds.size !== nodes.length) {
    errors.push('Duplicate node IDs found');
  }

  // Check for missing dependencies
  nodes.forEach((node) => {
    node.deps.forEach((dep) => {
      if (!nodeIds.has(dep)) {
        errors.push(`Node '${node.id}' has missing dependency '${dep}'`);
      }
    });
  });

  // Check for cycles
  if (hasCycle(nodes)) {
    errors.push('Cycle detected in DAG');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
