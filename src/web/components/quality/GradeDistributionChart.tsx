/**
 * GradeDistributionChart Component
 * Displays file count distribution by grade using horizontal bar chart
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
  LabelList,
} from 'recharts';
import type { QualityMetrics } from '../../types/redux.js';

interface GradeDistributionChartProps {
  metrics: QualityMetrics;
}

interface GradeData {
  grade: string;
  count: number;
  percentage: number;
  color: string;
}

// Grade colors
const GRADE_COLORS: Record<string, string> = {
  A: '#4caf50', // Green
  B: '#2196f3', // Blue
  C: '#ffeb3b', // Yellow
  D: '#ff9800', // Orange
  F: '#f44336', // Red
};

export function GradeDistributionChart({ metrics }: GradeDistributionChartProps): React.ReactElement {
  // Prepare chart data
  const chartData: GradeData[] = React.useMemo(() => {
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
  const renderCustomLabel = (props: any): React.ReactElement => {
    const { x, y, width, height, value } = props;
    const percentage = chartData.find((d) => d.count === value)?.percentage || 0;

    return (
      <text
        x={x + width + 10}
        y={y + height / 2}
        fill="#666"
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={12}
      >
        {percentage.toFixed(1)}%
      </text>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any): React.ReactElement | null => {
    if (!active || !payload || !payload[0]) {
      return null;
    }

    const data = payload[0].payload as GradeData;

    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Grade {data.grade}
        </Typography>
        <Typography variant="body2">
          <strong>Files:</strong> {data.count}
        </Typography>
        <Typography variant="body2">
          <strong>Percentage:</strong> {data.percentage.toFixed(1)}%
        </Typography>
      </Paper>
    );
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
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Grade Distribution
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
        Grade Distribution
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Quality grades across {metrics.fileCount} files
      </Typography>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 80, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" label={{ value: 'File Count', position: 'insideBottom', offset: -10 }} />
          <YAxis
            type="category"
            dataKey="grade"
            width={60}
            tick={{ fontSize: 14, fontWeight: 'bold' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="count" content={renderCustomLabel} />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Grade Scale
        </Typography>
        {Object.entries(gradeDescriptions).map(([grade, description]) => {
          const data = chartData.find((d) => d.grade === grade);
          return (
            <Box
              key={grade}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    bgcolor: GRADE_COLORS[grade],
                    borderRadius: 0.5,
                  }}
                />
                <Typography variant="body2">
                  <strong>{grade}</strong> - {description}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {data?.count || 0} files
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export default GradeDistributionChart;
