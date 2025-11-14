/**
 * DependencyGraphVisualization Component
 * D3.js force-directed graph visualization for dependency analysis
 */
import React from 'react';
import type { DependencyNode, DependencyGraph } from '../../types/redux.js';
export interface DependencyGraphVisualizationProps {
    graph: DependencyGraph | null;
    selectedNode: DependencyNode | null;
    onNodeClick: (node: DependencyNode) => void;
    layoutAlgorithm?: 'force' | 'hierarchical' | 'circular';
    showLabels?: boolean;
    nodeSize?: number;
    width?: number;
    height?: number;
}
export declare function DependencyGraphVisualization({ graph, selectedNode, onNodeClick, layoutAlgorithm, showLabels, nodeSize, width, height, }: DependencyGraphVisualizationProps): React.ReactElement;
export default DependencyGraphVisualization;
//# sourceMappingURL=DependencyGraphVisualization.d.ts.map