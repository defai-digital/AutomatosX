import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CodeSmellsChart Component
 * Displays code smell type distribution using Recharts PieChart
 */
import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, } from 'recharts';
// Code smell categories and colors
const SMELL_CATEGORIES = {
    'High Complexity': '#f44336',
    'Low Maintainability': '#ff9800',
    'High Tech Debt': '#ff5722',
    'Poor Quality': '#e91e63',
    'Clean Code': '#4caf50',
};
export function CodeSmellsChart({ fileReports }) {
    // Calculate smell distribution
    const smellData = React.useMemo(() => {
        const smells = {
            highComplexity: 0,
            lowMaintainability: 0,
            highTechDebt: 0,
            poorQuality: 0,
            cleanCode: 0,
        };
        fileReports.forEach((report) => {
            // High complexity (cyclomatic complexity > 15)
            if (report.complexity > 15) {
                smells.highComplexity++;
            }
            // Low maintainability (< 50%)
            if (report.maintainability < 50) {
                smells.lowMaintainability++;
            }
            // High tech debt (> 60 minutes)
            if (report.techDebt > 60) {
                smells.highTechDebt++;
            }
            // Poor quality score (< 60)
            if (report.qualityScore < 60) {
                smells.poorQuality++;
            }
            // Clean code (grade A or B)
            if (report.grade === 'A' || report.grade === 'B') {
                smells.cleanCode++;
            }
        });
        return [
            {
                name: 'High Complexity',
                value: smells.highComplexity,
                color: SMELL_CATEGORIES['High Complexity'],
            },
            {
                name: 'Low Maintainability',
                value: smells.lowMaintainability,
                color: SMELL_CATEGORIES['Low Maintainability'],
            },
            {
                name: 'High Tech Debt',
                value: smells.highTechDebt,
                color: SMELL_CATEGORIES['High Tech Debt'],
            },
            {
                name: 'Poor Quality',
                value: smells.poorQuality,
                color: SMELL_CATEGORIES['Poor Quality'],
            },
            {
                name: 'Clean Code',
                value: smells.cleanCode,
                color: SMELL_CATEGORIES['Clean Code'],
            },
        ].filter((smell) => smell.value > 0);
    }, [fileReports]);
    // Calculate total smells
    const totalSmells = React.useMemo(() => {
        return smellData.reduce((acc, smell) => acc + smell.value, 0);
    }, [smellData]);
    // Custom label
    const renderLabel = (entry) => {
        const percent = ((entry.value / totalSmells) * 100).toFixed(0);
        return `${percent}%`;
    };
    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload[0]) {
            return null;
        }
        const data = payload[0];
        const percent = ((data.value / totalSmells) * 100).toFixed(1);
        return (_jsxs(Paper, { sx: { p: 2 }, children: [_jsx(Typography, { variant: "subtitle2", gutterBottom: true, children: data.name }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: "Count:" }), " ", data.value] }), _jsxs(Typography, { variant: "body2", children: [_jsx("strong", { children: "Percentage:" }), " ", percent, "%"] })] }));
    };
    // Custom legend
    const renderLegend = (props) => {
        const { payload } = props;
        return (_jsx(Box, { sx: { mt: 2 }, children: payload.map((entry, index) => (_jsxs(Box, { sx: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: {
                                    width: 16,
                                    height: 16,
                                    bgcolor: entry.color,
                                    borderRadius: 0.5,
                                } }), _jsx(Typography, { variant: "body2", children: entry.value })] }), _jsxs(Typography, { variant: "body2", color: "text.secondary", children: [entry.payload.value, " files"] })] }, `legend-${index}`))) }));
    };
    if (smellData.length === 0) {
        return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Code Smells Distribution" }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "No data available" })] }));
    }
    return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Code Smells Distribution" }), _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }, children: [_jsx(Typography, { variant: "h3", color: "text.secondary", children: totalSmells }), _jsx(Typography, { variant: "body2", color: "text.secondary", sx: { ml: 1 }, children: "Total Issues" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: smellData, cx: "50%", cy: "50%", labelLine: false, label: renderLabel, outerRadius: 100, fill: "#8884d8", dataKey: "value", children: smellData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`))) }), _jsx(Tooltip, { content: _jsx(CustomTooltip, {}) }), _jsx(Legend, { content: renderLegend })] }) })] }));
}
export default CodeSmellsChart;
//# sourceMappingURL=CodeSmellsChart.js.map