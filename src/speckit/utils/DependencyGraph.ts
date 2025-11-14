/**
 * DependencyGraph Utility
 *
 * Week 3-4 Implementation - Day 2
 * Provides topological sorting, cycle detection, and critical path analysis
 * for workflow dependency graphs
 */

import type {
  WorkflowDefinition,
  WorkflowStep,
  GraphNode,
  GraphEdge,
  DAGMetadata,
} from '../types/speckit.types.js';

/**
 * DependencyGraph analyzes workflow step dependencies and provides
 * graph algorithms for execution planning
 */
export class DependencyGraph {
  private nodes: Map<string, GraphNode>;
  private edges: GraphEdge[];
  private adjacencyList: Map<string, Set<string>>;
  private reverseAdjacencyList: Map<string, Set<string>>;

  constructor(workflow: WorkflowDefinition) {
    this.nodes = new Map();
    this.edges = [];
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();

    this.buildGraph(workflow);
  }

  /**
   * Build graph from workflow definition
   */
  private buildGraph(workflow: WorkflowDefinition): void {
    // Create nodes
    for (const step of workflow.steps) {
      const node: GraphNode = {
        id: step.id,
        name: step.name,
        agent: step.agent,
        dependencies: step.dependsOn || [],
        level: 0, // Will be calculated
        critical: false, // Will be calculated
        duration: step.timeout || 30000, // Default 30s
      };
      this.nodes.set(step.id, node);
      this.adjacencyList.set(step.id, new Set());
      this.reverseAdjacencyList.set(step.id, new Set());
    }

    // Create edges
    for (const step of workflow.steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const depId of step.dependsOn) {
          const edge: GraphEdge = {
            from: depId,
            to: step.id,
            type: 'depends',
          };
          this.edges.push(edge);

          // Update adjacency lists
          this.adjacencyList.get(depId)?.add(step.id);
          this.reverseAdjacencyList.get(step.id)?.add(depId);
        }
      }
    }

    // Calculate levels and critical path
    this.calculateLevels();
    this.markCriticalPath();
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns sorted node IDs or throws if cycle detected
   */
  topologicalSort(): string[] {
    const sorted: string[] = [];
    const inDegree = new Map<string, number>();

    // Initialize in-degrees
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, this.reverseAdjacencyList.get(nodeId)?.size || 0);
    }

    // Find all nodes with in-degree 0
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sorted.push(nodeId);

      // Decrease in-degree for all neighbors
      const neighbors = this.adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          const newDegree = (inDegree.get(neighborId) || 0) - 1;
          inDegree.set(neighborId, newDegree);
          if (newDegree === 0) {
            queue.push(neighborId);
          }
        }
      }
    }

    // Check if all nodes were processed (no cycles)
    if (sorted.length !== this.nodes.size) {
      const cycles = this.detectCycles();
      throw new Error(
        `Dependency graph contains cycles: ${cycles.map(c => c.join(' → ')).join('; ')}`
      );
    }

    return sorted;
  }

  /**
   * Detect cycles in the dependency graph using DFS
   * Returns array of cycles (each cycle is an array of node IDs)
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            dfs(neighborId, [...path]);
          } else if (recStack.has(neighborId)) {
            // Cycle detected
            const cycleStart = path.indexOf(neighborId);
            const cycle = [...path.slice(cycleStart), neighborId];
            cycles.push(cycle);
          }
        }
      }

      recStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Calculate execution level for each node
   * Level = longest path from any root node
   */
  private calculateLevels(): void {
    try {
      const sorted = this.topologicalSort();
      const levels = new Map<string, number>();

      // Initialize all levels to 0
      for (const nodeId of this.nodes.keys()) {
        levels.set(nodeId, 0);
      }

      // Process nodes in topological order
      for (const nodeId of sorted) {
        const node = this.nodes.get(nodeId)!;
        const deps = this.reverseAdjacencyList.get(nodeId);

        if (deps && deps.size > 0) {
          // Level = max(dependency levels) + 1
          const maxDepLevel = Math.max(
            ...Array.from(deps).map(depId => levels.get(depId) || 0)
          );
          levels.set(nodeId, maxDepLevel + 1);
        }

        // Update node
        node.level = levels.get(nodeId) || 0;
      }
    } catch (error) {
      // If there are cycles, set all levels to 0
      for (const node of this.nodes.values()) {
        node.level = 0;
      }
    }
  }

  /**
   * Mark nodes on the critical path
   * Critical path = longest path through the graph based on duration
   */
  private markCriticalPath(): void {
    try {
      const sorted = this.topologicalSort();

      // Calculate earliest start times (forward pass)
      const earliestStart = new Map<string, number>();
      for (const nodeId of sorted) {
        const node = this.nodes.get(nodeId)!;
        const deps = this.reverseAdjacencyList.get(nodeId);

        if (!deps || deps.size === 0) {
          earliestStart.set(nodeId, 0);
        } else {
          const maxFinish = Math.max(
            ...Array.from(deps).map(depId => {
              const depNode = this.nodes.get(depId)!;
              const depStart = earliestStart.get(depId) || 0;
              return depStart + depNode.duration;
            })
          );
          earliestStart.set(nodeId, maxFinish);
        }
      }

      // Calculate latest start times (backward pass)
      const latestStart = new Map<string, number>();
      const reverseSorted = [...sorted].reverse();

      // Find project completion time
      const projectEnd = Math.max(
        ...sorted.map(nodeId => {
          const node = this.nodes.get(nodeId)!;
          return (earliestStart.get(nodeId) || 0) + node.duration;
        })
      );

      for (const nodeId of reverseSorted) {
        const node = this.nodes.get(nodeId)!;
        const successors = this.adjacencyList.get(nodeId);

        if (!successors || successors.size === 0) {
          // Leaf node
          latestStart.set(nodeId, projectEnd - node.duration);
        } else {
          const minSuccessorStart = Math.min(
            ...Array.from(successors).map(succId => latestStart.get(succId) || projectEnd)
          );
          latestStart.set(nodeId, minSuccessorStart - node.duration);
        }
      }

      // Mark critical nodes (earliest == latest)
      for (const nodeId of this.nodes.keys()) {
        const node = this.nodes.get(nodeId)!;
        const earliest = earliestStart.get(nodeId) || 0;
        const latest = latestStart.get(nodeId) || 0;
        node.critical = Math.abs(earliest - latest) < 1; // Allow 1ms tolerance
      }
    } catch (error) {
      // If cycles exist, don't mark critical path
      for (const node of this.nodes.values()) {
        node.critical = false;
      }
    }
  }

  /**
   * Get critical path as array of node IDs
   */
  getCriticalPath(): string[] {
    const criticalNodes = Array.from(this.nodes.values())
      .filter(node => node.critical)
      .sort((a, b) => a.level - b.level);

    return criticalNodes.map(node => node.id);
  }

  /**
   * Get total duration along critical path
   */
  getCriticalPathDuration(): number {
    const criticalPath = this.getCriticalPath();
    return criticalPath.reduce((total, nodeId) => {
      const node = this.nodes.get(nodeId);
      return total + (node?.duration || 0);
    }, 0);
  }

  /**
   * Get execution levels (groups of nodes that can run in parallel)
   */
  getExecutionLevels(): string[][] {
    const levelGroups = new Map<number, string[]>();

    for (const [nodeId, node] of this.nodes) {
      const level = node.level;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    }

    const maxLevel = Math.max(...Array.from(levelGroups.keys()));
    const levels: string[][] = [];

    for (let i = 0; i <= maxLevel; i++) {
      levels.push(levelGroups.get(i) || []);
    }

    return levels;
  }

  /**
   * Get nodes that can execute in parallel
   */
  getParallelizableNodes(): Map<number, string[]> {
    const result = new Map<number, string[]>();
    const levels = this.getExecutionLevels();

    levels.forEach((nodeIds, level) => {
      if (nodeIds.length > 1) {
        result.set(level, nodeIds);
      }
    });

    return result;
  }

  /**
   * Get metadata about the dependency graph
   */
  getMetadata(): DAGMetadata {
    const cycles = this.detectCycles();

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      maxDepth: Math.max(...Array.from(this.nodes.values()).map(n => n.level)),
      criticalPathLength: this.getCriticalPathDuration(),
      hasCycles: cycles.length > 0,
      cycles: cycles.length > 0 ? cycles : undefined,
    };
  }

  /**
   * Get all nodes
   */
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   */
  getEdges(): GraphEdge[] {
    return this.edges;
  }

  /**
   * Get node by ID
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get dependencies of a node
   */
  getDependencies(nodeId: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(nodeId) || []);
  }

  /**
   * Get dependents of a node (nodes that depend on this one)
   */
  getDependents(nodeId: string): string[] {
    return Array.from(this.adjacencyList.get(nodeId) || []);
  }

  /**
   * Check if graph has cycles
   */
  hasCycles(): boolean {
    return this.detectCycles().length > 0;
  }

  /**
   * Get root nodes (nodes with no dependencies)
   */
  getRootNodes(): string[] {
    return Array.from(this.nodes.keys()).filter(nodeId => {
      const deps = this.reverseAdjacencyList.get(nodeId);
      return !deps || deps.size === 0;
    });
  }

  /**
   * Get leaf nodes (nodes with no dependents)
   */
  getLeafNodes(): string[] {
    return Array.from(this.nodes.keys()).filter(nodeId => {
      const deps = this.adjacencyList.get(nodeId);
      return !deps || deps.size === 0;
    });
  }
}
