/**
 * CodeSmellsChart Component
 * Displays code smell type distribution using Recharts PieChart
 */

import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { FileQualityReport } from '../../types/redux.js';

interface CodeSmellsChartProps {
  fileReports: FileQualityReport[];
}

interface SmellData {
  name: string;
  value: number;
  color: string;
}

// Code smell categories and colors
const SMELL_CATEGORIES = {
  'High Complexity': '#f44336',
  'Low Maintainability': '#ff9800',
  'High Tech Debt': '#ff5722',
  'Poor Quality': '#e91e63',
  'Clean Code': '#4caf50',
};

export function CodeSmellsChart({ fileReports }: CodeSmellsChartProps): React.ReactElement {
  // Calculate smell distribution
  const smellData: SmellData[] = React.useMemo(() => {
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
  const renderLabel = (entry: any): string => {
    const percent = ((entry.value / totalSmells) * 100).toFixed(0);
    return `${percent}%`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any): React.ReactElement | null => {
    if (!active || !payload || !payload[0]) {
      return null;
    }

    const data = payload[0];
    const percent = ((data.value / totalSmells) * 100).toFixed(1);

    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {data.name}
        </Typography>
        <Typography variant="body2">
          <strong>Count:</strong> {data.value}
        </Typography>
        <Typography variant="body2">
          <strong>Percentage:</strong> {percent}%
        </Typography>
      </Paper>
    );
  };

  // Custom legend
  const renderLegend = (props: any): React.ReactElement => {
    const { payload } = props;

    return (
      <Box sx={{ mt: 2 }}>
        {payload.map((entry: any, index: number) => (
          <Box
            key={`legend-${index}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  bgcolor: entry.color,
                  borderRadius: 0.5,
                }}
              />
              <Typography variant="body2">{entry.value}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {entry.payload.value} files
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  if (smellData.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Code Smells Distribution
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
        Code Smells Distribution
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        <Typography variant="h3" color="text.secondary">
          {totalSmells}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Total Issues
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={smellData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {smellData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  );
}

export default CodeSmellsChart;
