/**
 * DependencyGraph Utility
 *
 * Week 3-4 Implementation - Day 2
 * Provides topological sorting, cycle detection, and critical path analysis
 * for workflow dependency graphs
 */
import type { WorkflowDefinition, GraphNode, GraphEdge, DAGMetadata } from '../types/speckit.types.js';
/**
 * DependencyGraph analyzes workflow step dependencies and provides
 * graph algorithms for execution planning
 */
export declare class DependencyGraph {
    private nodes;
    private edges;
    private adjacencyList;
    private reverseAdjacencyList;
    constructor(workflow: WorkflowDefinition);
    /**
     * Build graph from workflow definition
     */
    private buildGraph;
    /**
     * Perform topological sort using Kahn's algorithm
     * Returns sorted node IDs or throws if cycle detected
     */
    topologicalSort(): string[];
    /**
     * Detect cycles in the dependency graph using DFS
     * Returns array of cycles (each cycle is an array of node IDs)
     */
    detectCycles(): string[][];
    /**
     * Calculate execution level for each node
     * Level = longest path from any root node
     */
    private calculateLevels;
    /**
     * Mark nodes on the critical path
     * Critical path = longest path through the graph based on duration
     */
    private markCriticalPath;
    /**
     * Get critical path as array of node IDs
     */
    getCriticalPath(): string[];
    /**
     * Get total duration along critical path
     */
    getCriticalPathDuration(): number;
    /**
     * Get execution levels (groups of nodes that can run in parallel)
     */
    getExecutionLevels(): string[][];
    /**
     * Get nodes that can execute in parallel
     */
    getParallelizableNodes(): Map<number, string[]>;
    /**
     * Get metadata about the dependency graph
     */
    getMetadata(): DAGMetadata;
    /**
     * Get all nodes
     */
    getNodes(): GraphNode[];
    /**
     * Get all edges
     */
    getEdges(): GraphEdge[];
    /**
     * Get node by ID
     */
    getNode(id: string): GraphNode | undefined;
    /**
     * Get dependencies of a node
     */
    getDependencies(nodeId: string): string[];
    /**
     * Get dependents of a node (nodes that depend on this one)
     */
    getDependents(nodeId: string): string[];
    /**
     * Check if graph has cycles
     */
    hasCycles(): boolean;
    /**
     * Get root nodes (nodes with no dependencies)
     */
    getRootNodes(): string[];
    /**
     * Get leaf nodes (nodes with no dependents)
     */
    getLeafNodes(): string[];
}
//# sourceMappingURL=DependencyGraph.d.ts.map