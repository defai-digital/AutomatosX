import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * QualityDashboard Page
 * Displays code quality metrics and analysis
 */
import React from 'react';
import { Container, Typography, Box, Grid, CircularProgress, Alert, Button, } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchQualityMetrics, fetchFileReports, setFilters, selectQualityMetrics, selectFilteredFileReports, selectQualityFilters, selectQualityLoading, selectQualityError, } from '../redux/slices/qualitySlice.js';
import { QualityOverviewCards } from '../components/quality/QualityOverviewCards.js';
import { ComplexityChart } from '../components/quality/ComplexityChart.js';
import { CodeSmellsChart } from '../components/quality/CodeSmellsChart.js';
import { GradeDistributionChart } from '../components/quality/GradeDistributionChart.js';
import { FileQualityTable } from '../components/quality/FileQualityTable.js';
import { QualityFilters } from '../components/quality/QualityFilters.js';
export function QualityDashboard() {
    const dispatch = useDispatch();
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
    const handleFiltersChange = (newFilters) => {
        dispatch(setFilters(newFilters));
    };
    // Determine if we should show loading
    const showLoading = loading && !metrics && !error;
    // Loading state
    if (showLoading) {
        return (_jsx(Container, { maxWidth: "lg", children: _jsx(Box, { sx: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }, children: _jsx(CircularProgress, {}) }) }));
    }
    return (_jsx(Container, { maxWidth: "xl", children: _jsxs(Box, { sx: { my: 4 }, children: [_jsxs(Box, { sx: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "h4", component: "h1", gutterBottom: true, children: "Quality Dashboard" }), _jsx(Typography, { variant: "body1", color: "text.secondary", children: "View code quality metrics, complexity analysis, and technical debt" })] }), _jsx(Button, { variant: "outlined", startIcon: _jsx(RefreshIcon, {}), onClick: handleRefresh, disabled: loading, children: "Refresh" })] }), error && (_jsx(Alert, { severity: "error", sx: { mb: 3 }, onClose: () => dispatch({ type: 'quality/clearError' }), children: error })), metrics && (_jsx(Box, { sx: { mb: 3 }, children: _jsx(QualityOverviewCards, { metrics: metrics }) })), _jsxs(Grid, { container: true, spacing: 3, children: [_jsx(Grid, { item: true, xs: 12, lg: 8, children: _jsxs(Grid, { container: true, spacing: 3, children: [filteredFileReports.length > 0 && (_jsx(Grid, { item: true, xs: 12, children: _jsx(ComplexityChart, { fileReports: filteredFileReports, maxFiles: 20 }) })), _jsx(Grid, { item: true, xs: 12, md: 6, children: metrics && _jsx(GradeDistributionChart, { metrics: metrics }) }), _jsx(Grid, { item: true, xs: 12, md: 6, children: filteredFileReports.length > 0 && (_jsx(CodeSmellsChart, { fileReports: filteredFileReports })) })] }) }), _jsx(Grid, { item: true, xs: 12, lg: 4, children: _jsx(QualityFilters, { filters: filters, onFiltersChange: handleFiltersChange }) })] }), filteredFileReports.length > 0 && (_jsxs(Box, { sx: { mt: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "File Quality Reports" }), _jsxs(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: [filteredFileReports.length, " files", filters.grade.length > 0 || filters.riskLevel.length > 0 || filters.minQualityScore > 0
                                    ? ' (filtered)'
                                    : ''] }), _jsx(FileQualityTable, { fileReports: filteredFileReports })] })), !loading && (!metrics || filteredFileReports.length === 0) && (_jsx(Alert, { severity: "info", sx: { mt: 3 }, children: "No quality data available. Run quality analysis to generate metrics." }))] }) }));
}
export default QualityDashboard;
//# sourceMappingURL=QualityDashboard.js.map