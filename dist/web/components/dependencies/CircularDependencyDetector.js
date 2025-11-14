import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Paper, Typography, List, ListItem, ListItemButton, ListItemText, Chip, Alert, IconButton, Tooltip, } from '@mui/material';
import { Warning, Error as ErrorIcon, Download } from '@mui/icons-material';
export function CircularDependencyDetector({ circularDependencies, onHighlightCycle, onExportReport, }) {
    const getSeverityColor = (cycleLength) => {
        return cycleLength >= 5 ? 'error' : 'warning';
    };
    const getSeverityIcon = (cycleLength) => {
        return cycleLength >= 5 ? _jsx(ErrorIcon, {}) : _jsx(Warning, {});
    };
    const formatCyclePath = (cycle) => {
        const displayCycle = cycle.map((id) => id.split('/').pop() || id);
        return displayCycle.join(' → ') + ' → ' + displayCycle[0];
    };
    if (circularDependencies.length === 0) {
        return (_jsxs(Paper, { sx: { p: 2 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "Circular Dependencies" }), _jsx(Alert, { severity: "success", children: "No circular dependencies detected! Your codebase has a healthy dependency structure." })] }));
    }
    return (_jsxs(Paper, { sx: { p: 2 }, children: [_jsxs(Box, { sx: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }, children: [_jsx(Typography, { variant: "h6", children: "Circular Dependencies" }), _jsxs(Box, { sx: { display: 'flex', gap: 1, alignItems: 'center' }, children: [_jsx(Chip, { label: `${circularDependencies.length} cycles found`, color: "error", size: "small" }), onExportReport && (_jsx(Tooltip, { title: "Export Report", children: _jsx(IconButton, { onClick: onExportReport, size: "small", children: _jsx(Download, {}) }) }))] })] }), _jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: "Circular dependencies can lead to build issues, runtime errors, and make code harder to maintain." }), _jsx(List, { sx: { maxHeight: 400, overflow: 'auto' }, children: circularDependencies.map((cycle, index) => (_jsx(ListItem, { disablePadding: true, secondaryAction: _jsx(Chip, { icon: getSeverityIcon(cycle.length), label: `${cycle.length} files`, color: getSeverityColor(cycle.length), size: "small" }), children: _jsx(ListItemButton, { onClick: () => onHighlightCycle(cycle), children: _jsx(ListItemText, { primary: `Cycle ${index + 1}`, secondary: formatCyclePath(cycle), secondaryTypographyProps: {
                                sx: {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                },
                            } }) }) }, index))) }), _jsx(Box, { sx: { mt: 2 }, children: _jsx(Typography, { variant: "caption", color: "text.secondary", children: "Click on a cycle to highlight it in the graph. Cycles with 5+ files are marked as high severity." }) })] }));
}
export default CircularDependencyDetector;
//# sourceMappingURL=CircularDependencyDetector.js.map