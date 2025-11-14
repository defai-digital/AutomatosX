import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Paper, Typography, List, ListItem, ListItemText, Chip, Button, Divider, IconButton, Tooltip, } from '@mui/material';
import { Code, Folder, TrendingUp, TrendingDown, Close, } from '@mui/icons-material';
export function NodeDetailsPanel({ node, onClose, onGoToDefinition, onShowInFileTree, }) {
    if (!node) {
        return (_jsx(Paper, { sx: { p: 2, height: '100%' }, children: _jsx(Typography, { variant: "body2", color: "text.secondary", align: "center", children: "Select a node to view details" }) }));
    }
    const fanOut = node.dependencies.length;
    const fanIn = node.dependents.length;
    const centrality = fanIn + fanOut;
    const getTypeColor = (type) => {
        switch (type) {
            case 'file':
                return 'success';
            case 'function':
                return 'primary';
            case 'class':
                return 'warning';
            default:
                return 'primary';
        }
    };
    return (_jsxs(Paper, { sx: { p: 2, height: '100%', overflow: 'auto' }, children: [_jsxs(Box, { sx: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }, children: [_jsx(Typography, { variant: "h6", children: "Node Details" }), _jsx(IconButton, { onClick: onClose, size: "small", children: _jsx(Close, {}) })] }), _jsxs(Box, { sx: { mb: 2 }, children: [_jsx(Typography, { variant: "subtitle2", color: "text.secondary", gutterBottom: true, children: "Type" }), _jsx(Chip, { label: node.type, color: getTypeColor(node.type), size: "small", sx: { textTransform: 'capitalize' } })] }), _jsxs(Box, { sx: { mb: 2 }, children: [_jsx(Typography, { variant: "subtitle2", color: "text.secondary", gutterBottom: true, children: "Path" }), _jsx(Typography, { variant: "body2", sx: {
                            wordBreak: 'break-all',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            bgcolor: 'action.hover',
                            p: 1,
                            borderRadius: 1,
                        }, children: node.label })] }), _jsx(Divider, { sx: { my: 2 } }), _jsxs(Box, { sx: { mb: 2 }, children: [_jsx(Typography, { variant: "subtitle2", color: "text.secondary", gutterBottom: true, children: "Metrics" }), _jsxs(Box, { sx: { display: 'flex', gap: 2, flexWrap: 'wrap' }, children: [_jsx(Tooltip, { title: "Number of dependencies (outgoing edges)", children: _jsx(Chip, { icon: _jsx(TrendingUp, {}), label: `Fan-out: ${fanOut}`, size: "small", variant: "outlined" }) }), _jsx(Tooltip, { title: "Number of dependents (incoming edges)", children: _jsx(Chip, { icon: _jsx(TrendingDown, {}), label: `Fan-in: ${fanIn}`, size: "small", variant: "outlined" }) }), _jsx(Tooltip, { title: "Total connections (fan-in + fan-out)", children: _jsx(Chip, { label: `Centrality: ${centrality}`, size: "small", variant: "outlined" }) })] })] }), _jsx(Divider, { sx: { my: 2 } }), _jsxs(Box, { sx: { mb: 2 }, children: [_jsxs(Typography, { variant: "subtitle2", color: "text.secondary", gutterBottom: true, children: ["Dependencies (", fanOut, ")"] }), fanOut === 0 ? (_jsx(Typography, { variant: "body2", color: "text.secondary", sx: { fontStyle: 'italic' }, children: "No dependencies" })) : (_jsx(List, { dense: true, sx: { maxHeight: 150, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }, children: node.dependencies.map((dep) => (_jsx(ListItem, { children: _jsx(ListItemText, { primary: dep.split('/').pop() || dep, secondary: dep, primaryTypographyProps: { fontSize: '0.875rem' }, secondaryTypographyProps: { fontSize: '0.75rem' } }) }, dep))) }))] }), _jsxs(Box, { sx: { mb: 2 }, children: [_jsxs(Typography, { variant: "subtitle2", color: "text.secondary", gutterBottom: true, children: ["Dependents (", fanIn, ")"] }), fanIn === 0 ? (_jsx(Typography, { variant: "body2", color: "text.secondary", sx: { fontStyle: 'italic' }, children: "No dependents" })) : (_jsx(List, { dense: true, sx: { maxHeight: 150, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }, children: node.dependents.map((dep) => (_jsx(ListItem, { children: _jsx(ListItemText, { primary: dep.split('/').pop() || dep, secondary: dep, primaryTypographyProps: { fontSize: '0.875rem' }, secondaryTypographyProps: { fontSize: '0.75rem' } }) }, dep))) }))] }), _jsx(Divider, { sx: { my: 2 } }), _jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', gap: 1 }, children: [onGoToDefinition && (_jsx(Button, { startIcon: _jsx(Code, {}), variant: "outlined", size: "small", onClick: () => onGoToDefinition(node), fullWidth: true, children: "Go to Definition" })), onShowInFileTree && (_jsx(Button, { startIcon: _jsx(Folder, {}), variant: "outlined", size: "small", onClick: () => onShowInFileTree(node), fullWidth: true, children: "Show in File Tree" }))] })] }));
}
export default NodeDetailsPanel;
//# sourceMappingURL=NodeDetailsPanel.js.map