/**
 * GraphControls Component
 * Controls for graph visualization (zoom, layout, visibility)
 */
import React from 'react';
export interface GraphControlsProps {
    layoutAlgorithm: 'force' | 'hierarchical' | 'circular';
    showLabels: boolean;
    nodeSize: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onCenterGraph: () => void;
    onLayoutChange: (layout: 'force' | 'hierarchical' | 'circular') => void;
    onNodeSizeChange: (size: number) => void;
    onToggleLabels: () => void;
    onExportPNG?: () => void;
    onExportSVG?: () => void;
}
export declare function GraphControls({ layoutAlgorithm, showLabels, nodeSize, onZoomIn, onZoomOut, onResetZoom, onCenterGraph, onLayoutChange, onNodeSizeChange, onToggleLabels, onExportPNG, onExportSVG, }: GraphControlsProps): React.ReactElement;
export default GraphControls;
//# sourceMappingURL=GraphControls.d.ts.map