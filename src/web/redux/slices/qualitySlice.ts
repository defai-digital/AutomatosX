/**
 * Quality Slice
 * Redux slice for managing code quality metrics and reports
 */

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { QualityState, QualityMetrics, FileQualityReport, QualityFilters, RootState } from '../../types/redux.js';

const initialState: QualityState = {
  metrics: null,
  fileReports: [],
  selectedFile: null,
  filters: {
    grade: [],
    riskLevel: [],
    minQualityScore: 0,
  },
  loading: false,
  error: null,
};

// Async thunks
export const fetchQualityMetrics = createAsyncThunk(
  'quality/fetchMetrics',
  async (projectPath: string) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/quality/metrics?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch quality metrics');
    }
    return response.json() as Promise<QualityMetrics>;
  }
);

export const fetchFileReports = createAsyncThunk(
  'quality/fetchFileReports',
  async (projectPath: string) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/quality/reports?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch file reports');
    }
    return response.json() as Promise<FileQualityReport[]>;
  }
);

export const fetchFileReport = createAsyncThunk(
  'quality/fetchFileReport',
  async (filePath: string) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/quality/report?file=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch file report');
    }
    return response.json() as Promise<FileQualityReport>;
  }
);

const qualitySlice = createSlice({
  name: 'quality',
  initialState,
  reducers: {
    selectFile: (state, action: PayloadAction<FileQualityReport | null>) => {
      state.selectedFile = action.payload;
    },
    setFilters: (state, action: PayloadAction<QualityFilters>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetQuality: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch quality metrics
    builder
      .addCase(fetchQualityMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQualityMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = action.payload;
      })
      .addCase(fetchQualityMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch quality metrics';
      });

    // Fetch file reports
    builder
      .addCase(fetchFileReports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFileReports.fulfilled, (state, action) => {
        state.loading = false;
        state.fileReports = action.payload;
      })
      .addCase(fetchFileReports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch file reports';
      });

    // Fetch file report
    builder
      .addCase(fetchFileReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFileReport.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedFile = action.payload;
      })
      .addCase(fetchFileReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch file report';
      });
  },
});

export const { selectFile, setFilters, clearFilters, clearError, resetQuality } = qualitySlice.actions;

// Selectors
export const selectQualityMetrics = (state: RootState) => state.quality.metrics;
export const selectFileReports = (state: RootState) => state.quality.fileReports;
export const selectSelectedFile = (state: RootState) => state.quality.selectedFile;
export const selectQualityFilters = (state: RootState) => state.quality.filters;
export const selectQualityLoading = (state: RootState) => state.quality.loading;
export const selectQualityError = (state: RootState) => state.quality.error;

// Filtered file reports selector
export const selectFilteredFileReports = createSelector(
  [selectFileReports, selectQualityFilters],
  (fileReports, filters) => {
    return fileReports.filter((report) => {
      // Filter by grade
      if (filters.grade.length > 0 && !filters.grade.includes(report.grade)) {
        return false;
      }

      // Filter by risk level
      if (filters.riskLevel.length > 0 && !filters.riskLevel.includes(report.riskLevel)) {
        return false;
      }

      // Filter by minimum quality score
      if (report.qualityScore < filters.minQualityScore) {
        return false;
      }

      return true;
    });
  }
);

export default qualitySlice.reducer;
