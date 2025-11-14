import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * DependenciesPage Component
 * Main page for dependency graph visualization and analysis
 */
import { useEffect, useRef, useState } from 'react';
import { Container, Box, Typography, Grid, Button, Alert, CircularProgress, } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../redux/hooks.js';
import { fetchDependencyGraph, selectDependencyGraph, selectSelectedNode, selectDependencyFilters, selectLayoutAlgorithm, selectShowLabels, selectNodeSize, selectDependencyLoading, selectDependencyError, selectCircularDependencies, selectGraphStatistics, selectFilteredNodes, selectNode, clearSelection, setFilters, clearFilters, setLayoutAlgorithm, toggleLabels, setNodeSize, clearError, } from '../redux/slices/dependencySlice.js';
import { DependencyGraphVisualization } from '../components/dependencies/DependencyGraphVisualization.js';
import { GraphControls } from '../components/dependencies/GraphControls.js';
import { CircularDependencyDetector } from '../components/dependencies/CircularDependencyDetector.js';
import { NodeDetailsPanel } from '../components/dependencies/NodeDetailsPanel.js';
import { DependencyFilters } from '../components/dependencies/DependencyFilters.js';
import { GraphStatistics } from '../components/dependencies/GraphStatistics.js';
import * as d3 from 'd3';
export function DependenciesPage() {
    const dispatch = useAppDispatch();
    const svgRef = useRef(null);
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
    // Redux state
    const graph = useAppSelector(selectDependencyGraph);
    const selectedNode = useAppSelector(selectSelectedNode);
    const filters = useAppSelector(selectDependencyFilters);
    const layoutAlgorithm = useAppSelector(selectLayoutAlgorithm);
    const showLabels = useAppSelector(selectShowLabels);
    const nodeSize = useAppSelector(selectNodeSize);
    const loading = useAppSelector(selectDependencyLoading);
    const error = useAppSelector(selectDependencyError);
    const circularDeps = useAppSelector(selectCircularDependencies);
    const statistics = useAppSelector(selectGraphStatistics);
    const filteredNodes = useAppSelector(selectFilteredNodes);
    // Load dependency graph on mount
    useEffect(() => {
        dispatch(fetchDependencyGraph(process.cwd()));
    }, [dispatch]);
    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            const container = document.getElementById('graph-container');
            if (container) {
                setContainerDimensions({
                    width: container.clientWidth,
                    height: 600,
                });
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    // Handlers
    const handleNodeClick = (node) => {
        dispatch(selectNode(node));
    };
    const handleCloseDetails = () => {
        dispatch(clearSelection());
    };
    const handleRefresh = () => {
        dispatch(fetchDependencyGraph(process.cwd()));
    };
    const handleHighlightCycle = (cycle) => {
        // Find first node in cycle
        const firstNode = graph?.nodes.find((n) => n.id === cycle[0]);
        if (firstNode) {
            dispatch(selectNode(firstNode));
        }
    };
    const handleZoomIn = () => {
        const svg = d3.select(svgRef.current);
        svg.transition().call(d3.zoom().scaleBy, 1.3);
    };
    const handleZoomOut = () => {
        const svg = d3.select(svgRef.current);
        svg.transition().call(d3.zoom().scaleBy, 0.7);
    };
    const handleResetZoom = () => {
        const svg = d3.select(svgRef.current);
        svg.transition().call(d3.zoom().transform, d3.zoomIdentity);
    };
    const handleCenterGraph = () => {
        handleResetZoom();
    };
    return (_jsx(Container, { maxWidth: "xl", children: _jsxs(Box, { sx: { my: 4 }, children: [_jsxs(Box, { sx: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "h4", component: "h1", gutterBottom: true, children: "Dependency Graph Visualization" }), _jsx(Typography, { variant: "body1", color: "text.secondary", children: "Explore code dependencies, detect circular dependencies, and analyze module relationships" })] }), _jsx(Button, { startIcon: _jsx(Refresh, {}), variant: "outlined", onClick: handleRefresh, disabled: loading, children: "Refresh" })] }), error && (_jsx(Alert, { severity: "error", onClose: () => dispatch(clearError()), sx: { mb: 2 }, children: error })), loading && (_jsx(Box, { sx: { display: 'flex', justifyContent: 'center', p: 4 }, children: _jsx(CircularProgress, {}) })), !loading && (_jsxs(Grid, { container: true, spacing: 3, children: [_jsx(Grid, { item: true, xs: 12, md: 3, children: _jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx(DependencyFilters, { filters: filters, onFiltersChange: (newFilters) => dispatch(setFilters(newFilters)), onClearFilters: () => dispatch(clearFilters()) }), _jsx(GraphStatistics, { totalNodes: statistics.totalNodes, totalEdges: statistics.totalEdges, circularDependenciesCount: statistics.circularDependenciesCount, averageFanOut: statistics.averageFanOut, mostConnectedNodes: statistics.mostConnectedNodes, isolatedNodesCount: statistics.isolatedNodesCount })] }) }), _jsx(Grid, { item: true, xs: 12, md: 6, children: _jsx(Box, { id: "graph-container", children: _jsx(DependencyGraphVisualization, { graph: graph, selectedNode: selectedNode, onNodeClick: handleNodeClick, layoutAlgorithm: layoutAlgorithm, showLabels: showLabels, nodeSize: nodeSize, width: containerDimensions.width, height: containerDimensions.height }) }) }), _jsx(Grid, { item: true, xs: 12, md: 3, children: _jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx(GraphControls, { layoutAlgorithm: layoutAlgorithm, showLabels: showLabels, nodeSize: nodeSize, onZoomIn: handleZoomIn, onZoomOut: handleZoomOut, onResetZoom: handleResetZoom, onCenterGraph: handleCenterGraph, onLayoutChange: (layout) => dispatch(setLayoutAlgorithm(layout)), onNodeSizeChange: (size) => dispatch(setNodeSize(size)), onToggleLabels: () => dispatch(toggleLabels()) }), _jsx(CircularDependencyDetector, { circularDependencies: circularDeps, onHighlightCycle: handleHighlightCycle }), _jsx(NodeDetailsPanel, { node: selectedNode, onClose: handleCloseDetails })] }) })] }))] }) }));
}
export default DependenciesPage;
//# sourceMappingURL=DependenciesPage.js.map