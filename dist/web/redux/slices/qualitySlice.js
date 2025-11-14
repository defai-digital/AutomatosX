/**
 * Quality Slice
 * Redux slice for managing code quality metrics and reports
 */
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
const initialState = {
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
export const fetchQualityMetrics = createAsyncThunk('quality/fetchMetrics', async (projectPath) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/quality/metrics?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch quality metrics');
    }
    return response.json();
});
export const fetchFileReports = createAsyncThunk('quality/fetchFileReports', async (projectPath) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/quality/reports?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch file reports');
    }
    return response.json();
});
export const fetchFileReport = createAsyncThunk('quality/fetchFileReport', async (filePath) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/quality/report?file=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch file report');
    }
    return response.json();
});
const qualitySlice = createSlice({
    name: 'quality',
    initialState,
    reducers: {
        selectFile: (state, action) => {
            state.selectedFile = action.payload;
        },
        setFilters: (state, action) => {
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
export const selectQualityMetrics = (state) => state.quality.metrics;
export const selectFileReports = (state) => state.quality.fileReports;
export const selectSelectedFile = (state) => state.quality.selectedFile;
export const selectQualityFilters = (state) => state.quality.filters;
export const selectQualityLoading = (state) => state.quality.loading;
export const selectQualityError = (state) => state.quality.error;
// Filtered file reports selector
export const selectFilteredFileReports = createSelector([selectFileReports, selectQualityFilters], (fileReports, filters) => {
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
});
export default qualitySlice.reducer;
//# sourceMappingURL=qualitySlice.js.map