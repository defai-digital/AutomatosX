/**
 * CircularDependencyDetector Component
 * Displays circular dependency chains with highlighting and severity indicators
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Warning, Error as ErrorIcon, Download } from '@mui/icons-material';

export interface CircularDependencyDetectorProps {
  circularDependencies: string[][];
  onHighlightCycle: (cycle: string[]) => void;
  onExportReport?: () => void;
}

export function CircularDependencyDetector({
  circularDependencies,
  onHighlightCycle,
  onExportReport,
}: CircularDependencyDetectorProps): React.ReactElement {
  const getSeverityColor = (cycleLength: number): 'warning' | 'error' => {
    return cycleLength >= 5 ? 'error' : 'warning';
  };

  const getSeverityIcon = (cycleLength: number) => {
    return cycleLength >= 5 ? <ErrorIcon /> : <Warning />;
  };

  const formatCyclePath = (cycle: string[]): string => {
    const displayCycle = cycle.map((id) => id.split('/').pop() || id);
    return displayCycle.join(' → ') + ' → ' + displayCycle[0];
  };

  if (circularDependencies.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Circular Dependencies
        </Typography>
        <Alert severity="success">
          No circular dependencies detected! Your codebase has a healthy dependency structure.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Circular Dependencies
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`${circularDependencies.length} cycles found`}
            color="error"
            size="small"
          />
          {onExportReport && (
            <Tooltip title="Export Report">
              <IconButton onClick={onExportReport} size="small">
                <Download />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Alert severity="warning" sx={{ mb: 2 }}>
        Circular dependencies can lead to build issues, runtime errors, and make code harder to maintain.
      </Alert>

      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
        {circularDependencies.map((cycle, index) => (
          <ListItem
            key={index}
            disablePadding
            secondaryAction={
              <Chip
                icon={getSeverityIcon(cycle.length)}
                label={`${cycle.length} files`}
                color={getSeverityColor(cycle.length)}
                size="small"
              />
            }
          >
            <ListItemButton onClick={() => onHighlightCycle(cycle)}>
              <ListItemText
                primary={`Cycle ${index + 1}`}
                secondary={formatCyclePath(cycle)}
                secondaryTypographyProps={{
                  sx: {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Click on a cycle to highlight it in the graph. Cycles with 5+ files are marked as high severity.
        </Typography>
      </Box>
    </Paper>
  );
}

export default CircularDependencyDetector;
