/**
 * NodeDetailsPanel Component
 * Displays detailed information about a selected dependency node
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Code,
  Folder,
  TrendingUp,
  TrendingDown,
  Close,
} from '@mui/icons-material';
import type { DependencyNode } from '../../types/redux.js';

export interface NodeDetailsPanelProps {
  node: DependencyNode | null;
  onClose: () => void;
  onGoToDefinition?: (node: DependencyNode) => void;
  onShowInFileTree?: (node: DependencyNode) => void;
}

export function NodeDetailsPanel({
  node,
  onClose,
  onGoToDefinition,
  onShowInFileTree,
}: NodeDetailsPanelProps): React.ReactElement {
  if (!node) {
    return (
      <Paper sx={{ p: 2, height: '100%' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          Select a node to view details
        </Typography>
      </Paper>
    );
  }

  const fanOut = node.dependencies.length;
  const fanIn = node.dependents.length;
  const centrality = fanIn + fanOut;

  const getTypeColor = (type: string): 'success' | 'primary' | 'warning' => {
    switch (type) {
      case 'file':
        return 'success';
      case 'function':
        return 'primary';
      case 'class':
        return 'warning';
      default:
        return 'primary';
    }
  };

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Node Details</Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      {/* Node Info */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Type
        </Typography>
        <Chip
          label={node.type}
          color={getTypeColor(node.type)}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Path
        </Typography>
        <Typography
          variant="body2"
          sx={{
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            bgcolor: 'action.hover',
            p: 1,
            borderRadius: 1,
          }}
        >
          {node.label}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Metrics */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Metrics
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Tooltip title="Number of dependencies (outgoing edges)">
            <Chip
              icon={<TrendingUp />}
              label={`Fan-out: ${fanOut}`}
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="Number of dependents (incoming edges)">
            <Chip
              icon={<TrendingDown />}
              label={`Fan-in: ${fanIn}`}
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="Total connections (fan-in + fan-out)">
            <Chip
              label={`Centrality: ${centrality}`}
              size="small"
              variant="outlined"
            />
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Dependencies */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Dependencies ({fanOut})
        </Typography>
        {fanOut === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No dependencies
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 150, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
            {node.dependencies.map((dep) => (
              <ListItem key={dep}>
                <ListItemText
                  primary={dep.split('/').pop() || dep}
                  secondary={dep}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Dependents */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Dependents ({fanIn})
        </Typography>
        {fanIn === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No dependents
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 150, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
            {node.dependents.map((dep) => (
              <ListItem key={dep}>
                <ListItemText
                  primary={dep.split('/').pop() || dep}
                  secondary={dep}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {onGoToDefinition && (
          <Button
            startIcon={<Code />}
            variant="outlined"
            size="small"
            onClick={() => onGoToDefinition(node)}
            fullWidth
          >
            Go to Definition
          </Button>
        )}
        {onShowInFileTree && (
          <Button
            startIcon={<Folder />}
            variant="outlined"
            size="small"
            onClick={() => onShowInFileTree(node)}
            fullWidth
          >
            Show in File Tree
          </Button>
        )}
      </Box>
    </Paper>
  );
}

export default NodeDetailsPanel;
