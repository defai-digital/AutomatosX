/**
 * SpecGraphBuilder - DAG construction and analysis
 *
 * Builds directed acyclic graph from tasks
 * Performs topological sorting and cycle detection
 * Computes ready tasks and dependency metadata
 *
 * @module core/spec/SpecGraphBuilder
 */

import type { SpecTask, SpecGraph, SpecErrorCode } from '../../types/spec.js';
import { SpecError } from '../../types/spec.js';
import { logger } from '../../utils/logger.js';

/**
 * SpecGraphBuilder class
 * Handles DAG construction and analysis
 */
export class SpecGraphBuilder {
  /**
   * Build graph from tasks
   */
  static build(tasks: SpecTask[]): SpecGraph {
    logger.info('Building spec graph', { taskCount: tasks.length });

    // Create task index
    const taskMap = new Map<string, SpecTask>();
    tasks.forEach(task => taskMap.set(task.id, task));

    // Validate dependencies exist
    this.validateDependencies(tasks, taskMap);

    // Build adjacency lists
    const adjacencyList = new Map<string, string[]>();
    const reverseAdjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    tasks.forEach(task => {
      adjacencyList.set(task.id, []);
      reverseAdjacencyList.set(task.id, []);
      inDegree.set(task.id, 0);
    });

    // Build graph
    tasks.forEach(task => {
      reverseAdjacencyList.set(task.id, [...task.deps]);
      inDegree.set(task.id, task.deps.length);

      // Add reverse edges
      task.deps.forEach(depId => {
        const adj = adjacencyList.get(depId);
        if (adj) {
          adj.push(task.id);
        }
      });
    });

    // Detect cycles
    const cycles = this.detectCycles(tasks, adjacencyList, reverseAdjacencyList);
    if (cycles.length > 0) {
      logger.error('Cyclic dependencies detected', {
        cycleCount: cycles.length,
        cycles: cycles.map(c => c.join(' -> '))
      });
      throw new SpecError(
        'CYCLIC_DEPENDENCY' as SpecErrorCode,
        `Cyclic dependencies detected: ${cycles[0]?.join(' -> ')}`,
        { cycles }
      );
    }

    // Topological sort
    const sortedTaskIds = this.topologicalSort(tasks, reverseAdjacencyList, inDegree);

    // Calculate maximum depth
    const maxDepth = this.calculateMaxDepth(tasks, reverseAdjacencyList);

    const graph: SpecGraph = {
      tasks: taskMap,
      adjacencyList,
      reverseAdjacencyList,
      inDegree,
      sortedTaskIds,
      metadata: {
        taskCount: tasks.length,
        maxDepth,
        hasCycles: false,
        cycles: []
      }
    };

    logger.info('Graph built successfully', {
      taskCount: tasks.length,
      maxDepth,
      hasCycles: false
    });

    return graph;
  }

  /**
   * Validate that all dependencies exist
   */
  private static validateDependencies(
    tasks: SpecTask[],
    taskMap: Map<string, SpecTask>
  ): void {
    const errors: string[] = [];

    tasks.forEach(task => {
      task.deps.forEach(depId => {
        if (!taskMap.has(depId)) {
          errors.push(`Task "${task.id}" depends on non-existent task "${depId}"`);
        }
      });
    });

    if (errors.length > 0) {
      throw new SpecError(
        'MISSING_DEPENDENCY' as SpecErrorCode,
        'Missing task dependencies',
        { errors }
      );
    }
  }

  /**
   * Detect cycles using DFS
   */
  private static detectCycles(
    tasks: SpecTask[],
    adjacencyList: Map<string, string[]>,
    reverseAdjacencyList: Map<string, string[]>
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): void => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const deps = reverseAdjacencyList.get(taskId) || [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.has(depId)) {
          // Cycle detected
          const cycleStart = path.indexOf(depId);
          const cycle = [...path.slice(cycleStart), depId];
          cycles.push(cycle);
        }
      }

      path.pop();
      recursionStack.delete(taskId);
    };

    // Try DFS from each node
    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        dfs(task.id);
      }
    });

    return cycles;
  }

  /**
   * Topological sort using Kahn's algorithm
   */
  private static topologicalSort(
    tasks: SpecTask[],
    reverseAdjacencyList: Map<string, string[]>,
    inDegree: Map<string, number>
  ): string[] {
    const sorted: string[] = [];
    const queue: string[] = [];

    // Copy in-degree map to avoid mutation
    const inDegreeCopy = new Map(inDegree);

    // Find all tasks with no dependencies
    tasks.forEach(task => {
      if (inDegreeCopy.get(task.id) === 0) {
        queue.push(task.id);
      }
    });

    // Process queue
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      sorted.push(taskId);

      // Get dependents (tasks that depend on this task)
      const dependents = this.getDependents(taskId, tasks);
      dependents.forEach(depTaskId => {
        const degree = inDegreeCopy.get(depTaskId)!;
        inDegreeCopy.set(depTaskId, degree - 1);

        if (inDegreeCopy.get(depTaskId) === 0) {
          queue.push(depTaskId);
        }
      });
    }

    return sorted;
  }

  /**
   * Get tasks that depend on the given task
   */
  private static getDependents(taskId: string, tasks: SpecTask[]): string[] {
    return tasks
      .filter(task => task.deps.includes(taskId))
      .map(task => task.id);
  }

  /**
   * Calculate maximum depth of dependency tree
   */
  private static calculateMaxDepth(
    tasks: SpecTask[],
    reverseAdjacencyList: Map<string, string[]>
  ): number {
    const depths = new Map<string, number>();

    const calculateDepth = (taskId: string): number => {
      if (depths.has(taskId)) {
        return depths.get(taskId)!;
      }

      const deps = reverseAdjacencyList.get(taskId) || [];
      if (deps.length === 0) {
        depths.set(taskId, 0);
        return 0;
      }

      const maxDepDep = Math.max(...deps.map(depId => calculateDepth(depId)));
      const depth = maxDepDep + 1;
      depths.set(taskId, depth);
      return depth;
    };

    tasks.forEach(task => calculateDepth(task.id));

    return Math.max(...Array.from(depths.values()));
  }

  /**
   * Get ready tasks (tasks with all dependencies completed)
   */
  static getReadyTasks(
    graph: SpecGraph,
    completedTaskIds: Set<string>
  ): SpecTask[] {
    const ready: SpecTask[] = [];

    graph.tasks.forEach((task, taskId) => {
      // Skip if already completed
      if (completedTaskIds.has(taskId)) {
        return;
      }

      // Check if all dependencies are completed
      const allDepsCompleted = task.deps.every(depId => completedTaskIds.has(depId));

      if (allDepsCompleted) {
        ready.push(task);
      }
    });

    return ready;
  }

  /**
   * Get task depth (distance from root nodes)
   */
  static getTaskDepth(graph: SpecGraph, taskId: string): number {
    const depths = new Map<string, number>();

    const calculate = (id: string): number => {
      if (depths.has(id)) {
        return depths.get(id)!;
      }

      const task = graph.tasks.get(id);
      if (!task) {
        return -1;
      }

      const deps = graph.reverseAdjacencyList.get(id) || [];
      if (deps.length === 0) {
        depths.set(id, 0);
        return 0;
      }

      const maxDepDepth = Math.max(...deps.map(depId => calculate(depId)));
      const depth = maxDepDepth + 1;
      depths.set(id, depth);
      return depth;
    };

    return calculate(taskId);
  }

  /**
   * Get all dependencies of a task (transitive closure)
   */
  static getAllDependencies(graph: SpecGraph, taskId: string): SpecTask[] {
    const deps = new Set<string>();
    const visited = new Set<string>();

    const collect = (id: string): void => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const taskDeps = graph.reverseAdjacencyList.get(id) || [];
      taskDeps.forEach(depId => {
        deps.add(depId);
        collect(depId);
      });
    };

    collect(taskId);

    return Array.from(deps)
      .map(id => graph.tasks.get(id))
      .filter((task): task is SpecTask => task !== undefined);
  }

  /**
   * Get all dependents of a task (tasks that depend on this task)
   */
  static getAllDependents(graph: SpecGraph, taskId: string): SpecTask[] {
    const dependents = new Set<string>();
    const visited = new Set<string>();

    const collect = (id: string): void => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const taskDeps = graph.adjacencyList.get(id) || [];
      taskDeps.forEach(depId => {
        dependents.add(depId);
        collect(depId);
      });
    };

    collect(taskId);

    return Array.from(dependents)
      .map(id => graph.tasks.get(id))
      .filter((task): task is SpecTask => task !== undefined);
  }

  /**
   * Check if a task can be executed (all dependencies completed)
   */
  static canExecute(
    graph: SpecGraph,
    taskId: string,
    completedTaskIds: Set<string>
  ): boolean {
    const task = graph.tasks.get(taskId);
    if (!task) {
      return false;
    }

    return task.deps.every(depId => completedTaskIds.has(depId));
  }

  /**
   * Get execution order for a subset of tasks
   */
  static getExecutionOrder(
    graph: SpecGraph,
    taskIds: string[]
  ): string[] {
    // Filter sorted tasks to only include requested tasks
    return graph.sortedTaskIds.filter(id => taskIds.includes(id));
  }

  /**
   * Visualize graph as DOT format (for Graphviz)
   */
  static toDot(graph: SpecGraph): string {
    const lines: string[] = ['digraph SpecGraph {'];
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box];');

    // Add nodes
    graph.tasks.forEach((task, id) => {
      const label = `${id}\\n${task.title.substring(0, 30)}`;
      const color = task.status === 'completed' ? 'green' : 'lightblue';
      lines.push(`  "${id}" [label="${label}", style=filled, fillcolor=${color}];`);
    });

    // Add edges
    graph.tasks.forEach((task, id) => {
      task.deps.forEach(depId => {
        lines.push(`  "${depId}" -> "${id}";`);
      });
    });

    lines.push('}');
    return lines.join('\n');
  }
}
