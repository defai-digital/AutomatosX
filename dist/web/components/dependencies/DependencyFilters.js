import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Paper, Typography, TextField, FormControl, FormLabel, FormGroup, FormControlLabel, Checkbox, Switch, Chip, IconButton, Tooltip, Divider, } from '@mui/material';
import { Clear, FilterList } from '@mui/icons-material';
export function DependencyFilters({ filters, onFiltersChange, onClearFilters, }) {
    const activeFiltersCount = [
        filters.nodeTypes.length > 0,
        filters.fileExtensions.length > 0,
        filters.directoryPaths.length > 0,
        filters.hideExternal,
        filters.showOnlyCircular,
        filters.searchQuery.length > 0,
    ].filter(Boolean).length;
    const handleNodeTypeChange = (type, checked) => {
        const newTypes = checked
            ? [...filters.nodeTypes, type]
            : filters.nodeTypes.filter((t) => t !== type);
        onFiltersChange({ nodeTypes: newTypes });
    };
    const handleFileExtensionChange = (ext, checked) => {
        const newExts = checked
            ? [...filters.fileExtensions, ext]
            : filters.fileExtensions.filter((e) => e !== ext);
        onFiltersChange({ fileExtensions: newExts });
    };
    const handleSearchChange = (event) => {
        onFiltersChange({ searchQuery: event.target.value });
    };
    const handleHideExternalChange = (event) => {
        onFiltersChange({ hideExternal: event.target.checked });
    };
    const handleShowOnlyCircularChange = (event) => {
        onFiltersChange({ showOnlyCircular: event.target.checked });
    };
    return (_jsxs(Paper, { sx: { p: 2 }, children: [_jsxs(Box, { sx: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(FilterList, {}), _jsx(Typography, { variant: "h6", children: "Filters" }), activeFiltersCount > 0 && (_jsx(Chip, { label: activeFiltersCount, color: "primary", size: "small" }))] }), activeFiltersCount > 0 && (_jsx(Tooltip, { title: "Clear All Filters", children: _jsx(IconButton, { onClick: onClearFilters, size: "small", children: _jsx(Clear, {}) }) }))] }), _jsx(Box, { sx: { mb: 2 }, children: _jsx(TextField, { fullWidth: true, size: "small", label: "Search nodes", placeholder: "Enter node name...", value: filters.searchQuery, onChange: handleSearchChange, InputProps: {
                        endAdornment: filters.searchQuery && (_jsx(IconButton, { size: "small", onClick: () => onFiltersChange({ searchQuery: '' }), children: _jsx(Clear, { fontSize: "small" }) })),
                    } }) }), _jsx(Divider, { sx: { my: 2 } }), _jsxs(FormControl, { component: "fieldset", sx: { mb: 2 }, fullWidth: true, children: [_jsx(FormLabel, { component: "legend", children: "Node Type" }), _jsxs(FormGroup, { children: [_jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: filters.nodeTypes.includes('file'), onChange: (e) => handleNodeTypeChange('file', e.target.checked), size: "small" }), label: "Files" }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: filters.nodeTypes.includes('function'), onChange: (e) => handleNodeTypeChange('function', e.target.checked), size: "small" }), label: "Functions" }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: filters.nodeTypes.includes('class'), onChange: (e) => handleNodeTypeChange('class', e.target.checked), size: "small" }), label: "Classes" })] })] }), _jsx(Divider, { sx: { my: 2 } }), _jsxs(FormControl, { component: "fieldset", sx: { mb: 2 }, fullWidth: true, children: [_jsx(FormLabel, { component: "legend", children: "File Extension" }), _jsxs(FormGroup, { children: [_jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: filters.fileExtensions.includes('.ts'), onChange: (e) => handleFileExtensionChange('.ts', e.target.checked), size: "small" }), label: "TypeScript (.ts)" }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: filters.fileExtensions.includes('.js'), onChange: (e) => handleFileExtensionChange('.js', e.target.checked), size: "small" }), label: "JavaScript (.js)" }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: filters.fileExtensions.includes('.py'), onChange: (e) => handleFileExtensionChange('.py', e.target.checked), size: "small" }), label: "Python (.py)" })] })] }), _jsx(Divider, { sx: { my: 2 } }), _jsxs(Box, { children: [_jsx(FormControlLabel, { control: _jsx(Switch, { checked: filters.hideExternal, onChange: handleHideExternalChange, size: "small" }), label: "Hide External Dependencies" }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: filters.showOnlyCircular, onChange: handleShowOnlyCircularChange, size: "small" }), label: "Show Only Circular Dependencies" })] })] }));
}
export default DependencyFilters;
//# sourceMappingURL=DependencyFilters.js.map