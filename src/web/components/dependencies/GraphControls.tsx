/**
 * GraphControls Component
 * Controls for graph visualization (zoom, layout, visibility)
 */

import React from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Switch,
  Divider,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  RestartAlt,
  Download,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

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

export function GraphControls({
  layoutAlgorithm,
  showLabels,
  nodeSize,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCenterGraph,
  onLayoutChange,
  onNodeSizeChange,
  onToggleLabels,
  onExportPNG,
  onExportSVG,
}: GraphControlsProps): React.ReactElement {
  const handleLayoutChange = (event: SelectChangeEvent) => {
    onLayoutChange(event.target.value as 'force' | 'hierarchical' | 'circular');
  };

  const handleNodeSizeChange = (_event: Event, value: number | number[]) => {
    onNodeSizeChange(value as number);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Graph Controls
      </Typography>

      {/* Zoom Controls */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Zoom
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Zoom In">
            <IconButton onClick={onZoomIn} size="small">
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={onZoomOut} size="small">
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Zoom">
            <IconButton onClick={onResetZoom} size="small">
              <RestartAlt />
            </IconButton>
          </Tooltip>
          <Tooltip title="Center Graph">
            <IconButton onClick={onCenterGraph} size="small">
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Layout Algorithm */}
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="layout-select-label">Layout Algorithm</InputLabel>
          <Select
            labelId="layout-select-label"
            id="layout-select"
            value={layoutAlgorithm}
            label="Layout Algorithm"
            onChange={handleLayoutChange}
          >
            <MenuItem value="force">Force-Directed</MenuItem>
            <MenuItem value="hierarchical">Hierarchical</MenuItem>
            <MenuItem value="circular">Circular</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Node Size */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Node Size: {nodeSize}
        </Typography>
        <Slider
          value={nodeSize}
          onChange={handleNodeSizeChange}
          min={4}
          max={20}
          step={1}
          marks
          valueLabelDisplay="auto"
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Visibility Controls */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showLabels}
              onChange={onToggleLabels}
              icon={<VisibilityOff />}
              checkedIcon={<Visibility />}
            />
          }
          label="Show Labels"
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Export Controls */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Export
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Export as PNG">
            <IconButton
              onClick={onExportPNG}
              size="small"
              disabled={!onExportPNG}
            >
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export as SVG">
            <IconButton
              onClick={onExportSVG}
              size="small"
              disabled={!onExportSVG}
            >
              <Download />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}

export default GraphControls;
