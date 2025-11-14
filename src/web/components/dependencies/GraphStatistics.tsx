/**
 * GraphStatistics Component
 * Displays statistical information about the dependency graph
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import {
  AccountTree,
  TrendingUp,
  Error,
  Star,
  Block,
} from '@mui/icons-material';

export interface GraphStatisticsProps {
  totalNodes: number;
  totalEdges: number;
  circularDependenciesCount: number;
  averageFanOut: number;
  mostConnectedNodes: Array<{ id: string; label: string; connections: number }>;
  isolatedNodesCount: number;
}

export function GraphStatistics({
  totalNodes,
  totalEdges,
  circularDependenciesCount,
  averageFanOut,
  mostConnectedNodes,
  isolatedNodesCount,
}: GraphStatisticsProps): React.ReactElement {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Graph Statistics
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Total Nodes */}
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree color="primary" />
            <Box>
              <Typography variant="h4">{totalNodes}</Typography>
              <Typography variant="caption" color="text.secondary">
                Total Nodes
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Total Edges */}
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            <Box>
              <Typography variant="h4">{totalEdges}</Typography>
              <Typography variant="caption" color="text.secondary">
                Total Edges
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Circular Dependencies */}
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Error color={circularDependenciesCount > 0 ? 'error' : 'success'} />
            <Box>
              <Typography variant="h4">{circularDependenciesCount}</Typography>
              <Typography variant="caption" color="text.secondary">
                Circular Deps
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Average Fan-out */}
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="info" />
            <Box>
              <Typography variant="h4">{averageFanOut.toFixed(2)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Avg Fan-out
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* Most Connected Nodes */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Star color="warning" />
          <Typography variant="subtitle2">
            Most Connected Nodes
          </Typography>
        </Box>
        {mostConnectedNodes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No nodes found
          </Typography>
        ) : (
          <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
            {mostConnectedNodes.map((node, index) => (
              <ListItem
                key={node.id}
                secondaryAction={
                  <Chip
                    label={node.connections}
                    size="small"
                    color="primary"
                  />
                }
              >
                <ListItemText
                  primary={`${index + 1}. ${node.label.split('/').pop() || node.label}`}
                  secondary={node.label}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem',
                    sx: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Isolated Nodes */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Block color="action" />
        <Box>
          <Typography variant="h5">{isolatedNodesCount}</Typography>
          <Typography variant="caption" color="text.secondary">
            Isolated Nodes (no dependencies)
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default GraphStatistics;
