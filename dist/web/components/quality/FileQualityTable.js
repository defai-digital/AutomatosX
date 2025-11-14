import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FileQualityTable Component
 * Material-UI table with sortable columns, search, and pagination
 */
import React from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel, TextField, Box, Chip, Typography, } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
// Grade colors
const GRADE_COLORS = {
    A: 'success',
    B: 'info',
    C: 'warning',
    D: 'error',
    F: 'error',
};
// Risk level colors
const RISK_COLORS = {
    low: 'success',
    medium: 'info',
    high: 'warning',
    critical: 'error',
};
export function FileQualityTable({ fileReports, onFileSelect }) {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [orderBy, setOrderBy] = React.useState('qualityScore');
    const [order, setOrder] = React.useState('desc');
    const [searchTerm, setSearchTerm] = React.useState('');
    // Handle sort
    const handleSort = (field) => {
        const isAsc = orderBy === field && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(field);
    };
    // Sort comparator
    const sortComparator = (a, b) => {
        let aValue = a[orderBy];
        let bValue = b[orderBy];
        // Special handling for grade sorting
        if (orderBy === 'grade') {
            const gradeOrder = { A: 5, B: 4, C: 3, D: 2, F: 1 };
            aValue = gradeOrder[a.grade] || 0;
            bValue = gradeOrder[b.grade] || 0;
        }
        // Special handling for risk level sorting
        if (orderBy === 'riskLevel') {
            const riskOrder = { low: 1, medium: 2, high: 3, critical: 4 };
            aValue = riskOrder[a.riskLevel] || 0;
            bValue = riskOrder[b.riskLevel] || 0;
        }
        if (bValue < aValue) {
            return order === 'asc' ? 1 : -1;
        }
        if (bValue > aValue) {
            return order === 'asc' ? -1 : 1;
        }
        return 0;
    };
    // Filter and sort data
    const filteredAndSortedReports = React.useMemo(() => {
        return fileReports
            .filter((report) => report.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.grade.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort(sortComparator);
    }, [fileReports, searchTerm, order, orderBy]);
    // Paginated data
    const paginatedReports = React.useMemo(() => {
        return filteredAndSortedReports.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredAndSortedReports, page, rowsPerPage]);
    // Handle page change
    const handleChangePage = (_event, newPage) => {
        setPage(newPage);
    };
    // Handle rows per page change
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    // Handle search
    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
        setPage(0);
    };
    // Handle row click
    const handleRowClick = (report) => {
        if (onFileSelect) {
            onFileSelect(report);
        }
    };
    // Format tech debt
    const formatTechDebt = (minutes) => {
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };
    return (_jsxs(Paper, { sx: { width: '100%' }, children: [_jsx(Box, { sx: { p: 2 }, children: _jsx(TextField, { fullWidth: true, placeholder: "Search by file path, language, or grade...", value: searchTerm, onChange: handleSearch, InputProps: {
                        startAdornment: _jsx(SearchIcon, { sx: { mr: 1, color: 'text.secondary' } }),
                    } }) }), _jsx(TableContainer, { children: _jsxs(Table, { children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx(TableSortLabel, { active: orderBy === 'filePath', direction: orderBy === 'filePath' ? order : 'asc', onClick: () => handleSort('filePath'), children: "File Path" }) }), _jsx(TableCell, { align: "center", children: _jsx(TableSortLabel, { active: orderBy === 'grade', direction: orderBy === 'grade' ? order : 'asc', onClick: () => handleSort('grade'), children: "Grade" }) }), _jsx(TableCell, { align: "right", children: _jsx(TableSortLabel, { active: orderBy === 'qualityScore', direction: orderBy === 'qualityScore' ? order : 'asc', onClick: () => handleSort('qualityScore'), children: "Quality Score" }) }), _jsx(TableCell, { align: "right", children: _jsx(TableSortLabel, { active: orderBy === 'complexity', direction: orderBy === 'complexity' ? order : 'asc', onClick: () => handleSort('complexity'), children: "Complexity" }) }), _jsx(TableCell, { align: "right", children: _jsx(TableSortLabel, { active: orderBy === 'techDebt', direction: orderBy === 'techDebt' ? order : 'asc', onClick: () => handleSort('techDebt'), children: "Tech Debt" }) }), _jsx(TableCell, { align: "center", children: _jsx(TableSortLabel, { active: orderBy === 'riskLevel', direction: orderBy === 'riskLevel' ? order : 'asc', onClick: () => handleSort('riskLevel'), children: "Risk Level" }) })] }) }), _jsx(TableBody, { children: paginatedReports.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, align: "center", children: _jsx(Typography, { variant: "body2", color: "text.secondary", sx: { py: 3 }, children: "No files found" }) }) })) : (paginatedReports.map((report) => (_jsxs(TableRow, { hover: true, onClick: () => handleRowClick(report), sx: { cursor: onFileSelect ? 'pointer' : 'default' }, children: [_jsxs(TableCell, { children: [_jsx(Typography, { variant: "body2", sx: { fontFamily: 'monospace' }, children: report.filePath }), _jsx(Typography, { variant: "caption", color: "text.secondary", children: report.language })] }), _jsx(TableCell, { align: "center", children: _jsx(Chip, { label: report.grade, color: GRADE_COLORS[report.grade] || 'default', size: "small" }) }), _jsx(TableCell, { align: "right", children: _jsx(Typography, { variant: "body2", children: report.qualityScore.toFixed(0) }) }), _jsx(TableCell, { align: "right", children: _jsx(Typography, { variant: "body2", children: report.complexity.toFixed(1) }) }), _jsx(TableCell, { align: "right", children: _jsx(Typography, { variant: "body2", children: formatTechDebt(report.techDebt) }) }), _jsx(TableCell, { align: "center", children: _jsx(Chip, { label: report.riskLevel, color: RISK_COLORS[report.riskLevel] || 'default', size: "small", variant: "outlined" }) })] }, report.filePath)))) })] }) }), _jsx(TablePagination, { rowsPerPageOptions: [5, 10, 25, 50], component: "div", count: filteredAndSortedReports.length, rowsPerPage: rowsPerPage, page: page, onPageChange: handleChangePage, onRowsPerPageChange: handleChangeRowsPerPage })] }));
}
export default FileQualityTable;
//# sourceMappingURL=FileQualityTable.js.map