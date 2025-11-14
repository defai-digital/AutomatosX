import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Paper, Box, FormControl, InputLabel, Select, MenuItem, Slider, Typography, Button, Chip, } from '@mui/material';
import { FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';
const GRADES = ['A', 'B', 'C', 'D', 'F'];
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
export function QualityFilters({ filters, onFiltersChange }) {
    // Handle grade change
    const handleGradeChange = (event) => {
        const value = event.target.value;
        onFiltersChange({
            ...filters,
            grade: typeof value === 'string' ? value.split(',') : value,
        });
    };
    // Handle risk level change
    const handleRiskLevelChange = (event) => {
        const value = event.target.value;
        onFiltersChange({
            ...filters,
            riskLevel: typeof value === 'string' ? value.split(',') : value,
        });
    };
    // Handle quality score change
    const handleQualityScoreChange = (_event, value) => {
        onFiltersChange({
            ...filters,
            minQualityScore: value,
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
    return (_jsxs(Paper, { sx: { p: 3 }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(FilterIcon, {}), _jsx(Typography, { variant: "h6", children: "Filters" }), hasActiveFilters && (_jsx(Chip, { label: `${filters.grade.length + filters.riskLevel.length + (filters.minQualityScore > 0 ? 1 : 0)} active`, size: "small", color: "primary" }))] }), hasActiveFilters && (_jsx(Button, { size: "small", startIcon: _jsx(ClearIcon, {}), onClick: handleClearFilters, children: "Clear All" }))] }), _jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', gap: 3 }, children: [_jsxs(FormControl, { fullWidth: true, children: [_jsx(InputLabel, { id: "grade-filter-label", children: "Grade" }), _jsx(Select, { labelId: "grade-filter-label", id: "grade-filter", multiple: true, value: filters.grade, onChange: handleGradeChange, label: "Grade", renderValue: (selected) => (_jsx(Box, { sx: { display: 'flex', flexWrap: 'wrap', gap: 0.5 }, children: selected.map((value) => (_jsx(Chip, { label: value, size: "small" }, value))) })), children: GRADES.map((grade) => (_jsxs(MenuItem, { value: grade, children: ["Grade ", grade] }, grade))) })] }), _jsxs(FormControl, { fullWidth: true, children: [_jsx(InputLabel, { id: "risk-level-filter-label", children: "Risk Level" }), _jsx(Select, { labelId: "risk-level-filter-label", id: "risk-level-filter", multiple: true, value: filters.riskLevel, onChange: handleRiskLevelChange, label: "Risk Level", renderValue: (selected) => (_jsx(Box, { sx: { display: 'flex', flexWrap: 'wrap', gap: 0.5 }, children: selected.map((value) => (_jsx(Chip, { label: value, size: "small", color: value === 'low' ? 'success' :
                                            value === 'medium' ? 'info' :
                                                value === 'high' ? 'warning' :
                                                    'error' }, value))) })), children: RISK_LEVELS.map((level) => (_jsx(MenuItem, { value: level, children: level.charAt(0).toUpperCase() + level.slice(1) }, level))) })] }), _jsxs(Box, { children: [_jsxs(Typography, { variant: "body2", gutterBottom: true, children: ["Minimum Quality Score: ", filters.minQualityScore] }), _jsx(Slider, { value: filters.minQualityScore, onChange: handleQualityScoreChange, "aria-label": "Minimum Quality Score", valueLabelDisplay: "auto", step: 5, marks: [
                                    { value: 0, label: '0' },
                                    { value: 25, label: '25' },
                                    { value: 50, label: '50' },
                                    { value: 75, label: '75' },
                                    { value: 100, label: '100' },
                                ], min: 0, max: 100 })] })] }), hasActiveFilters && (_jsxs(Box, { sx: { mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }, children: [_jsx(Typography, { variant: "caption", color: "text.secondary", gutterBottom: true, children: "Active Filters:" }), _jsxs(Box, { sx: { display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }, children: [filters.grade.map((grade) => (_jsx(Chip, { label: `Grade: ${grade}`, size: "small", onDelete: () => onFiltersChange({
                                    ...filters,
                                    grade: filters.grade.filter((g) => g !== grade),
                                }) }, `grade-${grade}`))), filters.riskLevel.map((level) => (_jsx(Chip, { label: `Risk: ${level}`, size: "small", onDelete: () => onFiltersChange({
                                    ...filters,
                                    riskLevel: filters.riskLevel.filter((r) => r !== level),
                                }) }, `risk-${level}`))), filters.minQualityScore > 0 && (_jsx(Chip, { label: `Min Score: ${filters.minQualityScore}`, size: "small", onDelete: () => onFiltersChange({
                                    ...filters,
                                    minQualityScore: 0,
                                }) }))] })] }))] }));
}
export default QualityFilters;
//# sourceMappingURL=QualityFilters.js.map