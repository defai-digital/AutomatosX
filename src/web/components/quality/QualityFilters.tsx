/**
 * QualityFilters Component
 * Filter controls for quality dashboard with grade, risk level, and quality score filters
 */

import React from 'react';
import {
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';

export interface QualityFiltersState {
  grade: string[];
  riskLevel: string[];
  minQualityScore: number;
}

interface QualityFiltersProps {
  filters: QualityFiltersState;
  onFiltersChange: (filters: QualityFiltersState) => void;
}

const GRADES = ['A', 'B', 'C', 'D', 'F'];
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export function QualityFilters({ filters, onFiltersChange }: QualityFiltersProps): React.ReactElement {
  // Handle grade change
  const handleGradeChange = (event: any) => {
    const value = event.target.value;
    onFiltersChange({
      ...filters,
      grade: typeof value === 'string' ? value.split(',') : value,
    });
  };

  // Handle risk level change
  const handleRiskLevelChange = (event: any) => {
    const value = event.target.value;
    onFiltersChange({
      ...filters,
      riskLevel: typeof value === 'string' ? value.split(',') : value,
    });
  };

  // Handle quality score change
  const handleQualityScoreChange = (_event: Event, value: number | number[]) => {
    onFiltersChange({
      ...filters,
      minQualityScore: value as number,
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    onFiltersChange({
      grade: [],
      riskLevel: [],
      minQualityScore: 0,
    });
  };

  // Check if any filters are active
  const hasActiveFilters = filters.grade.length > 0 || filters.riskLevel.length > 0 || filters.minQualityScore > 0;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon />
          <Typography variant="h6">Filters</Typography>
          {hasActiveFilters && (
            <Chip
              label={`${
                filters.grade.length + filters.riskLevel.length + (filters.minQualityScore > 0 ? 1 : 0)
              } active`}
              size="small"
              color="primary"
            />
          )}
        </Box>
        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
          >
            Clear All
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Grade Filter */}
        <FormControl fullWidth>
          <InputLabel id="grade-filter-label">Grade</InputLabel>
          <Select
            labelId="grade-filter-label"
            id="grade-filter"
            multiple
            value={filters.grade}
            onChange={handleGradeChange}
            label="Grade"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
          >
            {GRADES.map((grade) => (
              <MenuItem key={grade} value={grade}>
                Grade {grade}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Risk Level Filter */}
        <FormControl fullWidth>
          <InputLabel id="risk-level-filter-label">Risk Level</InputLabel>
          <Select
            labelId="risk-level-filter-label"
            id="risk-level-filter"
            multiple
            value={filters.riskLevel}
            onChange={handleRiskLevelChange}
            label="Risk Level"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    size="small"
                    color={
                      value === 'low' ? 'success' :
                      value === 'medium' ? 'info' :
                      value === 'high' ? 'warning' :
                      'error'
                    }
                  />
                ))}
              </Box>
            )}
          >
            {RISK_LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Quality Score Filter */}
        <Box>
          <Typography variant="body2" gutterBottom>
            Minimum Quality Score: {filters.minQualityScore}
          </Typography>
          <Slider
            value={filters.minQualityScore}
            onChange={handleQualityScoreChange}
            aria-label="Minimum Quality Score"
            valueLabelDisplay="auto"
            step={5}
            marks={[
              { value: 0, label: '0' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 75, label: '75' },
              { value: 100, label: '100' },
            ]}
            min={0}
            max={100}
          />
        </Box>
      </Box>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Active Filters:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {filters.grade.map((grade) => (
              <Chip
                key={`grade-${grade}`}
                label={`Grade: ${grade}`}
                size="small"
                onDelete={() =>
                  onFiltersChange({
                    ...filters,
                    grade: filters.grade.filter((g) => g !== grade),
                  })
                }
              />
            ))}
            {filters.riskLevel.map((level) => (
              <Chip
                key={`risk-${level}`}
                label={`Risk: ${level}`}
                size="small"
                onDelete={() =>
                  onFiltersChange({
                    ...filters,
                    riskLevel: filters.riskLevel.filter((r) => r !== level),
                  })
                }
              />
            ))}
            {filters.minQualityScore > 0 && (
              <Chip
                label={`Min Score: ${filters.minQualityScore}`}
                size="small"
                onDelete={() =>
                  onFiltersChange({
                    ...filters,
                    minQualityScore: 0,
                  })
                }
              />
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default QualityFilters;
