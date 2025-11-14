/**
 * FileQualityTable Component
 * Material-UI table with sortable columns, search, and pagination
 */

import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  TextField,
  Box,
  Chip,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { FileQualityReport } from '../../types/redux.js';

interface FileQualityTableProps {
  fileReports: FileQualityReport[];
  onFileSelect?: (file: FileQualityReport) => void;
}

type SortField = 'filePath' | 'grade' | 'qualityScore' | 'complexity' | 'techDebt' | 'riskLevel';
type SortOrder = 'asc' | 'desc';

// Grade colors
const GRADE_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  A: 'success',
  B: 'info',
  C: 'warning',
  D: 'error',
  F: 'error',
};

// Risk level colors
const RISK_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

export function FileQualityTable({ fileReports, onFileSelect }: FileQualityTableProps): React.ReactElement {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [orderBy, setOrderBy] = React.useState<SortField>('qualityScore');
  const [order, setOrder] = React.useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Handle sort
  const handleSort = (field: SortField) => {
    const isAsc = orderBy === field && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(field);
  };

  // Sort comparator
  const sortComparator = (a: FileQualityReport, b: FileQualityReport): number => {
    let aValue: string | number = a[orderBy];
    let bValue: string | number = b[orderBy];

    // Special handling for grade sorting
    if (orderBy === 'grade') {
      const gradeOrder = { A: 5, B: 4, C: 3, D: 2, F: 1 };
      aValue = gradeOrder[a.grade as keyof typeof gradeOrder] || 0;
      bValue = gradeOrder[b.grade as keyof typeof gradeOrder] || 0;
    }

    // Special handling for risk level sorting
    if (orderBy === 'riskLevel') {
      const riskOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      aValue = riskOrder[a.riskLevel as keyof typeof riskOrder] || 0;
      bValue = riskOrder[b.riskLevel as keyof typeof riskOrder] || 0;
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
      .filter((report) =>
        report.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.grade.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort(sortComparator);
  }, [fileReports, searchTerm, order, orderBy]);

  // Paginated data
  const paginatedReports = React.useMemo(() => {
    return filteredAndSortedReports.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredAndSortedReports, page, rowsPerPage]);

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle search
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Handle row click
  const handleRowClick = (report: FileQualityReport) => {
    if (onFileSelect) {
      onFileSelect(report);
    }
  };

  // Format tech debt
  const formatTechDebt = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Paper sx={{ width: '100%' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by file path, language, or grade..."
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'filePath'}
                  direction={orderBy === 'filePath' ? order : 'asc'}
                  onClick={() => handleSort('filePath')}
                >
                  File Path
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === 'grade'}
                  direction={orderBy === 'grade' ? order : 'asc'}
                  onClick={() => handleSort('grade')}
                >
                  Grade
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'qualityScore'}
                  direction={orderBy === 'qualityScore' ? order : 'asc'}
                  onClick={() => handleSort('qualityScore')}
                >
                  Quality Score
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'complexity'}
                  direction={orderBy === 'complexity' ? order : 'asc'}
                  onClick={() => handleSort('complexity')}
                >
                  Complexity
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'techDebt'}
                  direction={orderBy === 'techDebt' ? order : 'asc'}
                  onClick={() => handleSort('techDebt')}
                >
                  Tech Debt
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === 'riskLevel'}
                  direction={orderBy === 'riskLevel' ? order : 'asc'}
                  onClick={() => handleSort('riskLevel')}
                >
                  Risk Level
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No files found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedReports.map((report) => (
                <TableRow
                  key={report.filePath}
                  hover
                  onClick={() => handleRowClick(report)}
                  sx={{ cursor: onFileSelect ? 'pointer' : 'default' }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {report.filePath}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {report.language}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={report.grade}
                      color={GRADE_COLORS[report.grade] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{report.qualityScore.toFixed(0)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{report.complexity.toFixed(1)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatTechDebt(report.techDebt)}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={report.riskLevel}
                      color={RISK_COLORS[report.riskLevel] || 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredAndSortedReports.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}

export default FileQualityTable;
