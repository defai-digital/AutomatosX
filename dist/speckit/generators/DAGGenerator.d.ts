/**
 * DAG Generator
 *
 * Week 3-4 Implementation - Day 3
 * Generates dependency graph visualizations in multiple formats (ASCII, DOT, Mermaid)
 */
import type { WorkflowDefinition, DAGFormat, DAGOptions } from '../types/speckit.types.js';
/**
 * DAG output result
 */
export interface DAGResult {
    format: DAGFormat;
    content: string;
    metadata: {
        nodeCount: number;
        edgeCount: number;
        criticalPathLength: number;
        maxDepth: number;
    };
}
/**
 * DAGGenerator
 *
 * Generates dependency graph visualizations from workflow definitions
 *
 * Supports multiple output formats:
 * - ASCII: Terminal-friendly text visualization
 * - DOT: Graphviz format for rendering high-quality diagrams
 * - Mermaid: Markdown-compatible diagrams
 *
 * Features:
 * - Critical path highlighting
 * - Step details (duration, dependencies)
 * - Flexible node labeling
 * - Configurable orientation
 */
export declare class DAGGenerator {
    /**
     * Generate DAG visualization
     */
    generate(workflow: WorkflowDefinition, options?: DAGOptions): Promise<DAGResult>;
    /**
     * Generate ASCII art visualization
     */
    private generateASCII;
    /**
     * Generate DOT (Graphviz) format
     */
    private generateDOT;
    /**
     * Generate Mermaid diagram
     */
    private generateMermaid;
    /**
     * Get node label based on labeling strategy
     */
    private getNodeLabel;
    /**
     * Write DAG to file
     */
    writeDAG(result: DAGResult, workflow: WorkflowDefinition, outputPath?: string): Promise<string>;
    /**
     * Get file extension for format
     */
    private getFileExtension;
}
//# sourceMappingURL=DAGGenerator.d.ts.map