/**
 * QualityDashboard Page
 * Displays code quality metrics and analysis
 */

import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../redux/store.js';
import {
  fetchQualityMetrics,
  fetchFileReports,
  setFilters,
  selectQualityMetrics,
  selectFilteredFileReports,
  selectQualityFilters,
  selectQualityLoading,
  selectQualityError,
} from '../redux/slices/qualitySlice.js';
import { QualityOverviewCards } from '../components/quality/QualityOverviewCards.js';
import { ComplexityChart } from '../components/quality/ComplexityChart.js';
import { CodeSmellsChart } from '../components/quality/CodeSmellsChart.js';
import { GradeDistributionChart } from '../components/quality/GradeDistributionChart.js';
import { FileQualityTable } from '../components/quality/FileQualityTable.js';
import { QualityFilters } from '../components/quality/QualityFilters.js';

export function QualityDashboard(): React.ReactElement {
  const dispatch = useDispatch<AppDispatch>();

  // Select data from Redux
  const metrics = useSelector(selectQualityMetrics);
  const filteredFileReports = useSelector(selectFilteredFileReports);
  const filters = useSelector(selectQualityFilters);
  const loading = useSelector(selectQualityLoading);
  const error = useSelector(selectQualityError);

  // Fetch data on mount
  React.useEffect(() => {
    handleRefresh();
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    const projectPath = process.cwd();
    dispatch(fetchQualityMetrics(projectPath));
    dispatch(fetchFileReports(projectPath));
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: typeof filters) => {
    dispatch(setFilters(newFilters));
  };

  // Determine if we should show loading
  const showLoading = loading && !metrics && !error;

  // Loading state
  if (showLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Quality Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View code quality metrics, complexity analysis, and technical debt
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch({ type: 'quality/clearError' })}>
            {error}
          </Alert>
        )}

        {/* Overview Cards */}
        {metrics && (
          <Box sx={{ mb: 3 }}>
            <QualityOverviewCards metrics={metrics} />
          </Box>
        )}

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - Charts */}
          <Grid item xs={12} lg={8}>
            <Grid container spacing={3}>
              {/* Complexity Chart */}
              {filteredFileReports.length > 0 && (
                <Grid item xs={12}>
                  <ComplexityChart fileReports={filteredFileReports} maxFiles={20} />
                </Grid>
              )}

              {/* Grade Distribution and Code Smells */}
              <Grid item xs={12} md={6}>
                {metrics && <GradeDistributionChart metrics={metrics} />}
              </Grid>
              <Grid item xs={12} md={6}>
                {filteredFileReports.length > 0 && (
                  <CodeSmellsChart fileReports={filteredFileReports} />
                )}
              </Grid>
            </Grid>
          </Grid>

          {/* Right Column - Filters */}
          <Grid item xs={12} lg={4}>
            <QualityFilters filters={filters} onFiltersChange={handleFiltersChange} />
          </Grid>
        </Grid>

        {/* File Quality Table */}
        {filteredFileReports.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              File Quality Reports
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {filteredFileReports.length} files
              {filters.grade.length > 0 || filters.riskLevel.length > 0 || filters.minQualityScore > 0
                ? ' (filtered)'
                : ''}
            </Typography>
            <FileQualityTable fileReports={filteredFileReports} />
          </Box>
        )}

        {/* No Data Message */}
        {!loading && (!metrics || filteredFileReports.length === 0) && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No quality data available. Run quality analysis to generate metrics.
          </Alert>
        )}
      </Box>
    </Container>
  );
}

export default QualityDashboard;
