/**
 * ComplexityChart Component
 * Displays code complexity distribution by file using Recharts BarChart
 */

import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import type { FileQualityReport } from '../../types/redux.js';

interface ComplexityChartProps {
  fileReports: FileQualityReport[];
  maxFiles?: number;
}

interface ChartData {
  name: string;
  complexity: number;
  grade: string;
  fullPath: string;
}

// Grade-based color mapping
const GRADE_COLORS: Record<string, string> = {
  A: '#4caf50', // Green
  B: '#2196f3', // Blue
  C: '#ffeb3b', // Yellow
  D: '#ff9800', // Orange
  F: '#f44336', // Red
};

export function ComplexityChart({ fileReports, maxFiles = 20 }: ComplexityChartProps): React.ReactElement {
  // Prepare chart data
  const chartData: ChartData[] = React.useMemo(() => {
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
  const CustomTooltip = ({ active, payload }: any): React.ReactElement | null => {
    if (!active || !payload || !payload[0]) {
      return null;
    }

    const data = payload[0].payload as ChartData;

    return (
      <Paper sx={{ p: 2, maxWidth: 400 }}>
        <Typography variant="subtitle2" gutterBottom>
          {data.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, wordBreak: 'break-all' }}>
          {data.fullPath}
        </Typography>
        <Typography variant="body2">
          <strong>Complexity:</strong> {data.complexity}
        </Typography>
        <Typography variant="body2">
          <strong>Grade:</strong> {data.grade}
        </Typography>
      </Paper>
    );
  };

  // Custom legend
  const renderLegend = (): React.ReactElement => {
    const grades = ['A', 'B', 'C', 'D', 'F'];
    return (
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
        {grades.map((grade) => (
          <Box key={grade} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                bgcolor: GRADE_COLORS[grade],
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption">Grade {grade}</Typography>
          </Box>
        ))}
      </Box>
    );
  };

  if (chartData.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Complexity Distribution
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No data available
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Complexity Distribution
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Top {maxFiles} most complex files
      </Typography>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Complexity Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="complexity" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={GRADE_COLORS[entry.grade] || '#999'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {renderLegend()}
    </Paper>
  );
}

export default ComplexityChart;
