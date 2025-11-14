/**
 * DependencyGraphVisualization Component
 * D3.js force-directed graph visualization for dependency analysis
 */

import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import * as d3 from 'd3';
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

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class';
  dependencies: string[];
  dependents: string[];
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

export function DependencyGraphVisualization({
  graph,
  selectedNode,
  onNodeClick,
  layoutAlgorithm = 'force',
  showLabels = true,
  nodeSize = 8,
  width = 800,
  height = 600,
}: DependencyGraphVisualizationProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!graph || !svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append('g');

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Prepare data
    const nodes: D3Node[] = graph.nodes.map((node) => ({
      ...node,
      x: width / 2,
      y: height / 2,
    }));

    const links: D3Link[] = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));

    // Create simulation based on layout algorithm
    let simulation: d3.Simulation<D3Node, D3Link>;

    if (layoutAlgorithm === 'force') {
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(nodeSize * 2));
    } else if (layoutAlgorithm === 'hierarchical') {
      // Simple hierarchical layout
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(150))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('y', d3.forceY<D3Node>((d) => {
          // Position nodes based on dependency depth
          return d.dependents.length === 0 ? height * 0.2 : height * 0.8;
        }).strength(0.5))
        .force('collision', d3.forceCollide().radius(nodeSize * 2));
    } else {
      // Circular layout
      const angleStep = (2 * Math.PI) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      nodes.forEach((node, i) => {
        node.x = width / 2 + radius * Math.cos(i * angleStep);
        node.y = height / 2 + radius * Math.sin(i * angleStep);
        node.fx = node.x;
        node.fy = node.y;
      });
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(100));
    }

    // Create arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .enter().append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    // Draw nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', nodeSize)
      .attr('fill', (d) => getNodeColor(d.type))
      .attr('stroke', (d) => d.id === selectedNode?.id ? '#FFD700' : '#fff')
      .attr('stroke-width', (d) => d.id === selectedNode?.id ? 3 : 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        onNodeClick(d as DependencyNode);
      })
      .on('mouseenter', (_event, d) => {
        setHoveredNode(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      })
      .call(
        d3.drag<SVGCircleElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (layoutAlgorithm !== 'circular') {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Draw labels
    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .text((d) => d.label.split('/').pop() || d.label)
      .attr('font-size', 10)
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', nodeSize + 12)
      .style('pointer-events', 'none')
      .style('display', showLabels ? 'block' : 'none');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0);

      node
        .attr('cx', (d) => d.x || 0)
        .attr('cy', (d) => d.y || 0);

      label
        .attr('x', (d) => d.x || 0)
        .attr('y', (d) => d.y || 0);
    });

    // Highlight connected nodes on hover
    node.attr('opacity', (d) => {
      if (!hoveredNode) return 1;
      if (d.id === hoveredNode) return 1;
      const hovered = nodes.find((n) => n.id === hoveredNode);
      if (!hovered) return 0.3;
      if (hovered.dependencies.includes(d.id) || hovered.dependents.includes(d.id)) {
        return 1;
      }
      return 0.3;
    });

    link.attr('opacity', (d) => {
      if (!hoveredNode) return 0.6;
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
      const targetId = typeof d.target === 'string' ? d.target : d.target.id;
      if (sourceId === hoveredNode || targetId === hoveredNode) {
        return 1;
      }
      return 0.1;
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graph, selectedNode, onNodeClick, layoutAlgorithm, showLabels, nodeSize, width, height, hoveredNode]);

  if (!graph) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', height: height }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading dependency graph...
        </Typography>
      </Paper>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', height: height }}>
        <Typography variant="body1" color="text.secondary">
          No dependencies found. Try indexing your project first.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', borderRadius: '4px', background: '#fafafa' }}
      />
    </Box>
  );
}

function getNodeColor(type: 'file' | 'function' | 'class'): string {
  switch (type) {
    case 'file':
      return '#4CAF50'; // Green
    case 'function':
      return '#2196F3'; // Blue
    case 'class':
      return '#FF9800'; // Orange
    default:
      return '#9E9E9E'; // Gray
  }
}

export default DependencyGraphVisualization;
