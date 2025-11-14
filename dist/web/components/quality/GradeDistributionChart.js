import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * GradeDistributionChart Component
 * Displays file count distribution by grade using horizontal bar chart
 */
import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, } from 'recharts';
// Grade colors
const GRADE_COLORS = {
    A: '#4caf50', // Green
    B: '#2196f3', // Blue
    C: '#ffeb3b', // Yellow
    D: '#ff9800', // Orange
    F: '#f44336', // Red
};
export function GradeDistributionChart({ metrics }) {
    // Prepare chart data
    const chartData = React.useMemo(() => {
        const total = metrics.fileCount;
        return [
            {
                grade: 'A',
                count: metrics.gradeDistribution.A,
                percentage: total > 0 ? (metrics.gradeDistribution.A / total) * 100 : 0,
                color: GRADE_COLORS.A,
            },
            {
                grade: 'B',
                count: metrics.gradeDistribution.B,
                percentage: total > 0 ? (metrics.gradeDistribution.B / total) * 100 : 0,
                color: GRADE_COLORS.B,
            },
            {
                grade: 'C',
                count: metrics.gradeDistribution.C,
                percentage: total > 0 ? (metrics.gradeDistribution.C / total) * 100 : 0,
                color: GRADE_COLORS.C,
            },
            {
                grade: 'D',
                count: metrics.gradeDistribution.D,
                percentage: total > 0 ? (metrics.gradeDistribution.D / total) * 100 : 0,
                color: GRADE_COLORS.D,
            },
            {
                grade: 'F',
                count: metrics.gradeDistribution.F,
                percentage: total > 0 ? (metrics.gradeDistribution.F / total) * 100 : 0,
                color: GRADE_COLORS.F,
            },
        ];
    }, [metrics]);
    // Custom label renderer for percentage
    const renderCustomLabel = (props) => {
        const { x, y, width, height, value } = props;
        const percentage = chartData.find((d) => d.count === value)?.percentage || 0;
        return (_jsxs("text", { x: x + width + 10, y: y + height / 2, fill: "#666", textAnchor: "start", dominantBaseline: "middle", fontSize: 12, children: [percentage.toFixed(1), "%"] }));
    };
    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload[0]) {
            return null;
        }
        const data = payload[0].payload;
        return (_jsxs(Paper, { sx: { p: 2 }, children: [_jsxs(Typography, { variant: "subtitle2", gutterBottom: true, children: ["Grade ", data.grade] }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: "Files:" }), " ", data.count] }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: "Percentage:" }), " ", data.percentage.toFixed(1), "%"] })] }));
    };
    // Grade descriptions
    const gradeDescriptions = {
        A: 'Excellent (90-100%)',
        B: 'Good (80-89%)',
        C: 'Fair (70-79%)',
        D: 'Poor (60-69%)',
        F: 'Failing (<60%)',
    };
    if (metrics.fileCount === 0) {
        return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Grade Distribution" }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "No data available" })] }));
    }
    return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Grade Distribution" }), _jsxs(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: ["Quality grades across ", metrics.fileCount, " files"] }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: chartData, layout: "vertical", margin: { top: 20, right: 80, left: 20, bottom: 20 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number", label: { value: 'File Count', position: 'insideBottom', offset: -10 } }), _jsx(YAxis, { type: "category", dataKey: "grade", width: 60, tick: { fontSize: 14, fontWeight: 'bold' } }), _jsx(Tooltip, { content: _jsx(CustomTooltip, {}) }), _jsxs(Bar, { dataKey: "count", radius: [0, 4, 4, 0], children: [_jsx(LabelList, { dataKey: "count", content: renderCustomLabel }), chartData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`)))] })] }) }), _jsxs(Box, { sx: { mt: 3 }, children: [_jsx(Typography, { variant: "subtitle2", gutterBottom: true, children: "Grade Scale" }), Object.entries(gradeDescriptions).map(([grade, description]) => {
                        const data = chartData.find((d) => d.grade === grade);
                        return (_jsxs(Box, { sx: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                mb: 0.5,
                            }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: {
                                                width: 16,
                                                height: 16,
                                                bgcolor: GRADE_COLORS[grade],
                                                borderRadius: 0.5,
                                            } }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: grade }), " - ", description] })] }), _jsxs(Typography, { variant: "body2", color: "text.secondary", children: [data?.count || 0, " files"] })] }, grade));
                    })] })] }));
}
export default GradeDistributionChart;
//# sourceMappingURL=GradeDistributionChart.js.map