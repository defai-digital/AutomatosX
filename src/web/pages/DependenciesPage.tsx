/**
 * DependenciesPage Component
 * Main page for dependency graph visualization and analysis
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../redux/hooks.js';
import {
  fetchDependencyGraph,
  selectDependencyGraph,
  selectSelectedNode,
  selectDependencyFilters,
  selectLayoutAlgorithm,
  selectShowLabels,
  selectNodeSize,
  selectDependencyLoading,
  selectDependencyError,
  selectCircularDependencies,
  selectGraphStatistics,
  selectFilteredNodes,
  selectNode,
  clearSelection,
  setFilters,
  clearFilters,
  setLayoutAlgorithm,
  toggleLabels,
  setNodeSize,
  clearError,
} from '../redux/slices/dependencySlice.js';
import { DependencyGraphVisualization } from '../components/dependencies/DependencyGraphVisualization.js';
import { GraphControls } from '../components/dependencies/GraphControls.js';
import { CircularDependencyDetector } from '../components/dependencies/CircularDependencyDetector.js';
import { NodeDetailsPanel } from '../components/dependencies/NodeDetailsPanel.js';
import { DependencyFilters } from '../components/dependencies/DependencyFilters.js';
import { GraphStatistics } from '../components/dependencies/GraphStatistics.js';
import type { DependencyNode } from '../types/redux.js';
import * as d3 from 'd3';

export function DependenciesPage(): React.ReactElement {
  const dispatch = useAppDispatch();
  const svgRef = useRef<SVGSVGElement>(null);
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
  const handleNodeClick = (node: DependencyNode) => {
    dispatch(selectNode(node));
  };

  const handleCloseDetails = () => {
    dispatch(clearSelection());
  };

  const handleRefresh = () => {
    dispatch(fetchDependencyGraph(process.cwd()));
  };

  const handleHighlightCycle = (cycle: string[]) => {
    // Find first node in cycle
    const firstNode = graph?.nodes.find((n) => n.id === cycle[0]);
    if (firstNode) {
      dispatch(selectNode(firstNode));
    }
  };

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      1.3
    );
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      0.7
    );
  };

  const handleResetZoom = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
  };

  const handleCenterGraph = () => {
    handleResetZoom();
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Dependency Graph Visualization
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Explore code dependencies, detect circular dependencies, and analyze module relationships
            </Typography>
          </Box>
          <Button
            startIcon={<Refresh />}
            variant="outlined"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Main Content */}
        {!loading && (
          <Grid container spacing={3}>
            {/* Left Column - Filters & Statistics */}
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DependencyFilters
                  filters={filters}
                  onFiltersChange={(newFilters) => dispatch(setFilters(newFilters))}
                  onClearFilters={() => dispatch(clearFilters())}
                />
                <GraphStatistics
                  totalNodes={statistics.totalNodes}
                  totalEdges={statistics.totalEdges}
                  circularDependenciesCount={statistics.circularDependenciesCount}
                  averageFanOut={statistics.averageFanOut}
                  mostConnectedNodes={statistics.mostConnectedNodes}
                  isolatedNodesCount={statistics.isolatedNodesCount}
                />
              </Box>
            </Grid>

            {/* Center Column - Graph */}
            <Grid item xs={12} md={6}>
              <Box id="graph-container">
                <DependencyGraphVisualization
                  graph={graph}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeClick}
                  layoutAlgorithm={layoutAlgorithm}
                  showLabels={showLabels}
                  nodeSize={nodeSize}
                  width={containerDimensions.width}
                  height={containerDimensions.height}
                />
              </Box>
            </Grid>

            {/* Right Column - Controls & Details */}
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <GraphControls
                  layoutAlgorithm={layoutAlgorithm}
                  showLabels={showLabels}
                  nodeSize={nodeSize}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onResetZoom={handleResetZoom}
                  onCenterGraph={handleCenterGraph}
                  onLayoutChange={(layout) => dispatch(setLayoutAlgorithm(layout))}
                  onNodeSizeChange={(size) => dispatch(setNodeSize(size))}
                  onToggleLabels={() => dispatch(toggleLabels())}
                />
                <CircularDependencyDetector
                  circularDependencies={circularDeps}
                  onHighlightCycle={handleHighlightCycle}
                />
                <NodeDetailsPanel
                  node={selectedNode}
                  onClose={handleCloseDetails}
                />
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>
    </Container>
  );
}

export default DependenciesPage;
