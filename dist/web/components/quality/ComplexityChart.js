import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ComplexityChart Component
 * Displays code complexity distribution by file using Recharts BarChart
 */
import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, } from 'recharts';
// Grade-based color mapping
const GRADE_COLORS = {
    A: '#4caf50', // Green
    B: '#2196f3', // Blue
    C: '#ffeb3b', // Yellow
    D: '#ff9800', // Orange
    F: '#f44336', // Red
};
export function ComplexityChart({ fileReports, maxFiles = 20 }) {
    // Prepare chart data
    const chartData = React.useMemo(() => {
        return fileReports
            .sort((a, b) => b.complexity - a.complexity)
            .slice(0, maxFiles)
            .map((report) => ({
            name: report.filePath.split('/').pop() || report.filePath,
            complexity: Math.round(report.complexity * 10) / 10,
            grade: report.grade,
            fullPath: report.filePath,
        }));
    }, [fileReports, maxFiles]);
    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload[0]) {
            return null;
        }
        const data = payload[0].payload;
        return (_jsxs(Paper, { sx: { p: 2, maxWidth: 400 }, children: [_jsx(Typography, { variant: "subtitle2", gutterBottom: true, children: data.name }), _jsx(Typography, { variant: "body2", color: "text.secondary", sx: { mb: 1, wordBreak: 'break-all' }, children: data.fullPath }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: "Complexity:" }), " ", data.complexity] }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: "Grade:" }), " ", data.grade] })] }));
    };
    // Custom legend
    const renderLegend = () => {
        const grades = ['A', 'B', 'C', 'D', 'F'];
        return (_jsx(Box, { sx: { display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }, children: grades.map((grade) => (_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 0.5 }, children: [_jsx(Box, { sx: {
                            width: 12,
                            height: 12,
                            bgcolor: GRADE_COLORS[grade],
                            borderRadius: 0.5,
                        } }), _jsxs(Typography, { variant: "caption", children: ["Grade ", grade] })] }, grade))) }));
    };
    if (chartData.length === 0) {
        return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Complexity Distribution" }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "No data available" })] }));
    }
    return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Complexity Distribution" }), _jsxs(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: ["Top ", maxFiles, " most complex files"] }), _jsx(ResponsiveContainer, { width: "100%", height: 400, children: _jsxs(BarChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 80 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name", angle: -45, textAnchor: "end", height: 100, interval: 0, tick: { fontSize: 12 } }), _jsx(YAxis, { label: { value: 'Complexity Score', angle: -90, position: 'insideLeft' } }), _jsx(Tooltip, { content: _jsx(CustomTooltip, {}) }), _jsx(Bar, { dataKey: "complexity", radius: [4, 4, 0, 0], children: chartData.map((entry, index) => (_jsx(Cell, { fill: GRADE_COLORS[entry.grade] || '#999' }, `cell-${index}`))) })] }) }), renderLegend()] }));
}
export default ComplexityChart;
//# sourceMappingURL=ComplexityChart.js.map