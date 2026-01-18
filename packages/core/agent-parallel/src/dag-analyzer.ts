/**
 * DAG Analyzer
 *
 * Analyzes task dependencies and builds execution layers using topological sort.
 * Detects circular dependencies and validates DAG structure.
 *
 * Invariants:
 * - INV-APE-002: Dependencies honored (DAG ordering)
 * - INV-APE-200: Circular dependencies detected before execution
 */

import type { AgentParallelTask } from '@defai.digital/contracts';
import { ParallelExecutionErrorCodes } from '@defai.digital/contracts';
import type { DAGAnalyzer, DAGAnalysisResult, TaskLayer } from './types.js';

/**
 * Error thrown when DAG analysis fails
 */
export class DAGAnalysisError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cycleNodes?: string[]
  ) {
    super(message);
    this.name = 'DAGAnalysisError';
  }

  static circularDependency(nodeIds: string[]): DAGAnalysisError {
    return new DAGAnalysisError(
      ParallelExecutionErrorCodes.CIRCULAR_DEPENDENCY,
      `Circular dependency detected: ${nodeIds.join(' -> ')}`,
      nodeIds
    );
  }

  static invalidDependency(taskId: string, depId: string): DAGAnalysisError {
    return new DAGAnalysisError(
      ParallelExecutionErrorCodes.INVALID_PLAN,
      `Task "${taskId}" depends on non-existent task "${depId}"`
    );
  }
}

/**
 * Creates a DAG analyzer for parallel task execution
 * Uses Kahn's algorithm for topological sorting
 */
export function createDAGAnalyzer(): DAGAnalyzer {
  /**
   * Build execution layers using Kahn's algorithm
   * INV-APE-002: Ensures dependencies honored
   * INV-APE-200: Detects cycles via incomplete processing
   */
  function buildLayers(tasks: AgentParallelTask[]): DAGAnalysisResult {
    // Handle empty input
    if (tasks.length === 0) {
      return {
        layers: [],
        totalLayers: 0,
        maxParallelism: 0,
        hasCycles: false,
      };
    }

    // Build task lookup map
    const taskMap = new Map<string, AgentParallelTask>();
    for (const task of tasks) {
      taskMap.set(task.taskId, task);
    }

    // Validate all dependencies exist
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskMap.has(depId)) {
          throw DAGAnalysisError.invalidDependency(task.taskId, depId);
        }
      }
    }

    // Calculate in-degree for each task
    const inDegree = new Map<string, number>();
    for (const task of tasks) {
      inDegree.set(task.taskId, task.dependencies.length);
    }

    // Build reverse dependency map (who depends on me)
    const dependents = new Map<string, string[]>();
    for (const task of tasks) {
      dependents.set(task.taskId, []);
    }
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depList = dependents.get(depId) ?? [];
        depList.push(task.taskId);
        dependents.set(depId, depList);
      }
    }

    // Build layers using BFS
    const layers: TaskLayer[] = [];
    let processedCount = 0;

    // Start with tasks that have no dependencies
    let currentLayerTaskIds = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .map(([id]) => id);

    let layerIndex = 0;

    while (currentLayerTaskIds.length > 0) {
      // Get tasks for current layer, sorted by priority (descending)
      const layerTasks = currentLayerTaskIds
        .map((id) => taskMap.get(id)!)
        .sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

      layers.push({
        index: layerIndex,
        tasks: layerTasks,
      });

      processedCount += layerTasks.length;

      // Find next layer
      const nextLayerTaskIds: string[] = [];
      for (const taskId of currentLayerTaskIds) {
        const deps = dependents.get(taskId) ?? [];
        for (const depId of deps) {
          const degree = (inDegree.get(depId) ?? 0) - 1;
          inDegree.set(depId, degree);

          if (degree === 0) {
            nextLayerTaskIds.push(depId);
          }
        }
      }

      currentLayerTaskIds = nextLayerTaskIds;
      layerIndex++;
    }

    // Check for cycles - if we didn't process all tasks, there's a cycle
    const hasCycles = processedCount !== tasks.length;
    let cycleNodes: string[] | undefined;

    if (hasCycles) {
      // Find nodes involved in cycle (those not processed)
      cycleNodes = tasks
        .filter((t) => (inDegree.get(t.taskId) ?? 0) > 0)
        .map((t) => t.taskId);
    }

    // Calculate max parallelism (largest layer)
    const maxParallelism = Math.max(0, ...layers.map((l) => l.tasks.length));

    const result: DAGAnalysisResult = {
      layers,
      totalLayers: layers.length,
      maxParallelism,
      hasCycles,
    };

    // Only include cycleNodes if there are cycles
    if (cycleNodes) {
      result.cycleNodes = cycleNodes;
    }

    return result;
  }

  /**
   * Validate DAG structure
   */
  function validate(tasks: AgentParallelTask[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate task IDs
    const taskIds = new Set<string>();
    for (const task of tasks) {
      if (taskIds.has(task.taskId)) {
        errors.push(`Duplicate task ID: ${task.taskId}`);
      }
      taskIds.add(task.taskId);
    }

    // Check for self-dependencies
    for (const task of tasks) {
      if (task.dependencies.includes(task.taskId)) {
        errors.push(`Task "${task.taskId}" depends on itself`);
      }
    }

    // Check for missing dependencies
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          errors.push(`Task "${task.taskId}" depends on non-existent task "${depId}"`);
        }
      }
    }

    // Check for cycles
    if (errors.length === 0) {
      const result = buildLayers(tasks);
      if (result.hasCycles) {
        errors.push(`Circular dependency detected involving: ${result.cycleNodes?.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  return {
    analyze(tasks: AgentParallelTask[]): DAGAnalysisResult {
      const result = buildLayers(tasks);

      // Throw if cycles detected
      if (result.hasCycles && result.cycleNodes) {
        throw DAGAnalysisError.circularDependency(result.cycleNodes);
      }

      return result;
    },

    validate,
  };
}

/**
 * Utility: Find tasks in a cycle using DFS
 */
export function findCyclePath(tasks: AgentParallelTask[]): string[] | null {
  const taskMap = new Map<string, AgentParallelTask>();
  for (const task of tasks) {
    taskMap.set(task.taskId, task);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(taskId: string): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          // Found cycle
          path.push(depId);
          return true;
        }
      }
    }

    recursionStack.delete(taskId);
    path.pop();
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.taskId)) {
      if (dfs(task.taskId)) {
        // Trim path to only include cycle
        const lastNode = path[path.length - 1];
        if (lastNode) {
          const cycleStart = path.indexOf(lastNode);
          return path.slice(cycleStart);
        }
        return path;
      }
    }
  }

  return null;
}
