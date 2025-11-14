/**
 * DependencyFilters Component
 * Filtering controls for dependency graph visualization
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import { Clear, FilterList } from '@mui/icons-material';
import type { DependencyFilters as Filters } from '../../redux/slices/dependencySlice.js';

export interface DependencyFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  onClearFilters: () => void;
}

export function DependencyFilters({
  filters,
  onFiltersChange,
  onClearFilters,
}: DependencyFiltersProps): React.ReactElement {
  const activeFiltersCount = [
    filters.nodeTypes.length > 0,
    filters.fileExtensions.length > 0,
    filters.directoryPaths.length > 0,
    filters.hideExternal,
    filters.showOnlyCircular,
    filters.searchQuery.length > 0,
  ].filter(Boolean).length;

  const handleNodeTypeChange = (type: 'file' | 'function' | 'class', checked: boolean) => {
    const newTypes = checked
      ? [...filters.nodeTypes, type]
      : filters.nodeTypes.filter((t) => t !== type);
    onFiltersChange({ nodeTypes: newTypes });
  };

  const handleFileExtensionChange = (ext: string, checked: boolean) => {
    const newExts = checked
      ? [...filters.fileExtensions, ext]
      : filters.fileExtensions.filter((e) => e !== ext);
    onFiltersChange({ fileExtensions: newExts });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ searchQuery: event.target.value });
  };

  const handleHideExternalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ hideExternal: event.target.checked });
  };

  const handleShowOnlyCircularChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ showOnlyCircular: event.target.checked });
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterList />
          <Typography variant="h6">Filters</Typography>
          {activeFiltersCount > 0 && (
            <Chip
              label={activeFiltersCount}
              color="primary"
              size="small"
            />
          )}
        </Box>
        {activeFiltersCount > 0 && (
          <Tooltip title="Clear All Filters">
            <IconButton onClick={onClearFilters} size="small">
              <Clear />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Search Box */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="Search nodes"
          placeholder="Enter node name..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            endAdornment: filters.searchQuery && (
              <IconButton
                size="small"
                onClick={() => onFiltersChange({ searchQuery: '' })}
              >
                <Clear fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Node Types */}
      <FormControl component="fieldset" sx={{ mb: 2 }} fullWidth>
        <FormLabel component="legend">Node Type</FormLabel>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.nodeTypes.includes('file')}
                onChange={(e) => handleNodeTypeChange('file', e.target.checked)}
                size="small"
              />
            }
            label="Files"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.nodeTypes.includes('function')}
                onChange={(e) => handleNodeTypeChange('function', e.target.checked)}
                size="small"
              />
            }
            label="Functions"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.nodeTypes.includes('class')}
                onChange={(e) => handleNodeTypeChange('class', e.target.checked)}
                size="small"
              />
            }
            label="Classes"
          />
        </FormGroup>
      </FormControl>

      <Divider sx={{ my: 2 }} />

      {/* File Extensions */}
      <FormControl component="fieldset" sx={{ mb: 2 }} fullWidth>
        <FormLabel component="legend">File Extension</FormLabel>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.fileExtensions.includes('.ts')}
                onChange={(e) => handleFileExtensionChange('.ts', e.target.checked)}
                size="small"
              />
            }
            label="TypeScript (.ts)"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.fileExtensions.includes('.js')}
                onChange={(e) => handleFileExtensionChange('.js', e.target.checked)}
                size="small"
              />
            }
            label="JavaScript (.js)"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.fileExtensions.includes('.py')}
                onChange={(e) => handleFileExtensionChange('.py', e.target.checked)}
                size="small"
              />
            }
            label="Python (.py)"
          />
        </FormGroup>
      </FormControl>

      <Divider sx={{ my: 2 }} />

      {/* Toggle Filters */}
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={filters.hideExternal}
              onChange={handleHideExternalChange}
              size="small"
            />
          }
          label="Hide External Dependencies"
        />
        <FormControlLabel
          control={
            <Switch
              checked={filters.showOnlyCircular}
              onChange={handleShowOnlyCircularChange}
              size="small"
            />
          }
          label="Show Only Circular Dependencies"
        />
      </Box>
    </Paper>
  );
}

export default DependencyFilters;
