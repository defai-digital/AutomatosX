import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Grid, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { Speed as ComplexityIcon, Assessment as MaintainabilityIcon, Build as TechDebtIcon, Warning as RiskIcon, TrendingUp, TrendingDown, TrendingFlat, } from '@mui/icons-material';
function MetricCard({ title, value, icon, color, trend, trendValue }) {
    const getTrendIcon = () => {
        if (!trend)
            return null;
        const trendIcons = {
            up: _jsx(TrendingUp, { fontSize: "small" }),
            down: _jsx(TrendingDown, { fontSize: "small" }),
            flat: _jsx(TrendingFlat, { fontSize: "small" }),
        };
        const trendColors = {
            up: 'success',
            down: 'error',
            flat: 'default',
        };
        return (_jsx(Chip, { icon: trendIcons[trend], label: trendValue, size: "small", color: trendColors[trend], sx: { mt: 1 } }));
    };
    return (_jsx(Card, { sx: { height: '100%' }, children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', mb: 2 }, children: [_jsx(Box, { sx: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                bgcolor: `${color}.light`,
                                color: `${color}.dark`,
                                mr: 2,
                            }, children: icon }), _jsxs(Box, { children: [_jsx(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: title }), _jsx(Typography, { variant: "h4", component: "div", children: value })] })] }), getTrendIcon()] }) }));
}
export function QualityOverviewCards({ metrics }) {
    // Calculate average risk level
    const calculateRiskLevel = () => {
        const { low, medium, high, critical } = metrics.riskDistribution;
        const total = low + medium + high + critical;
        if (total === 0)
            return 'None';
        const criticalPercent = (critical / total) * 100;
        const highPercent = (high / total) * 100;
        if (criticalPercent > 10)
            return 'Critical';
        if (highPercent > 20)
            return 'High';
        if ((medium / total) * 100 > 40)
            return 'Medium';
        return 'Low';
    };
    // Format complexity score
    const formatComplexity = (complexity) => {
        return complexity.toFixed(1);
    };
    // Format maintainability score
    const formatMaintainability = (score) => {
        return `${score.toFixed(0)}%`;
    };
    // Format tech debt in hours
    const formatTechDebt = (minutes) => {
        const hours = Math.round(minutes / 60);
        return `${hours}h`;
    };
    return (_jsxs(Grid, { container: true, spacing: 3, children: [_jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(MetricCard, { title: "Average Complexity", value: formatComplexity(metrics.averageComplexity), icon: _jsx(ComplexityIcon, {}), color: "primary", trend: metrics.averageComplexity < 10 ? 'down' : metrics.averageComplexity > 20 ? 'up' : 'flat', trendValue: metrics.averageComplexity < 10 ? 'Good' : metrics.averageComplexity > 20 ? 'High' : 'Normal' }) }), _jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(MetricCard, { title: "Maintainability Score", value: formatMaintainability(metrics.averageMaintainability), icon: _jsx(MaintainabilityIcon, {}), color: "success", trend: metrics.averageMaintainability > 70 ? 'up' : metrics.averageMaintainability < 50 ? 'down' : 'flat', trendValue: metrics.averageMaintainability > 70 ? 'Excellent' : metrics.averageMaintainability < 50 ? 'Poor' : 'Fair' }) }), _jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(MetricCard, { title: "Technical Debt", value: formatTechDebt(metrics.totalTechDebt), icon: _jsx(TechDebtIcon, {}), color: "warning", trend: metrics.totalTechDebt < 300 ? 'down' : metrics.totalTechDebt > 600 ? 'up' : 'flat', trendValue: metrics.totalTechDebt < 300 ? 'Low' : metrics.totalTechDebt > 600 ? 'High' : 'Medium' }) }), _jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(MetricCard, { title: "Risk Level", value: calculateRiskLevel(), icon: _jsx(RiskIcon, {}), color: "error", trend: calculateRiskLevel() === 'Low' ? 'down' :
                        calculateRiskLevel() === 'Critical' ? 'up' :
                            'flat', trendValue: `${metrics.fileCount} files` }) })] }));
}
export default QualityOverviewCards;
//# sourceMappingURL=QualityOverviewCards.js.map