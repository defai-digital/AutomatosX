/**
 * QualityOverviewCards Component
 * Displays four key quality metrics in Material-UI cards with trend indicators
 */

import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import {
  Speed as ComplexityIcon,
  Assessment as MaintainabilityIcon,
  Build as TechDebtIcon,
  Warning as RiskIcon,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';
import type { QualityMetrics } from '../../types/redux.js';

interface QualityOverviewCardsProps {
  metrics: QualityMetrics;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
}

function MetricCard({ title, value, icon, color, trend, trendValue }: MetricCardProps): React.ReactElement {
  const getTrendIcon = () => {
    if (!trend) return null;

    const trendIcons = {
      up: <TrendingUp fontSize="small" />,
      down: <TrendingDown fontSize="small" />,
      flat: <TrendingFlat fontSize="small" />,
    };

    const trendColors = {
      up: 'success',
      down: 'error',
      flat: 'default',
    } as const;

    return (
      <Chip
        icon={trendIcons[trend]}
        label={trendValue}
        size="small"
        color={trendColors[trend]}
        sx={{ mt: 1 }}
      />
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}.light`,
              color: `${color}.dark`,
              mr: 2,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
          </Box>
        </Box>
        {getTrendIcon()}
      </CardContent>
    </Card>
  );
}

export function QualityOverviewCards({ metrics }: QualityOverviewCardsProps): React.ReactElement {
  // Calculate average risk level
  const calculateRiskLevel = (): string => {
    const { low, medium, high, critical } = metrics.riskDistribution;
    const total = low + medium + high + critical;

    if (total === 0) return 'None';

    const criticalPercent = (critical / total) * 100;
    const highPercent = (high / total) * 100;

    if (criticalPercent > 10) return 'Critical';
    if (highPercent > 20) return 'High';
    if ((medium / total) * 100 > 40) return 'Medium';
    return 'Low';
  };

  // Format complexity score
  const formatComplexity = (complexity: number): string => {
    return complexity.toFixed(1);
  };

  // Format maintainability score
  const formatMaintainability = (score: number): string => {
    return `${score.toFixed(0)}%`;
  };

  // Format tech debt in hours
  const formatTechDebt = (minutes: number): string => {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Average Complexity"
          value={formatComplexity(metrics.averageComplexity)}
          icon={<ComplexityIcon />}
          color="primary"
          trend={metrics.averageComplexity < 10 ? 'down' : metrics.averageComplexity > 20 ? 'up' : 'flat'}
          trendValue={metrics.averageComplexity < 10 ? 'Good' : metrics.averageComplexity > 20 ? 'High' : 'Normal'}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Maintainability Score"
          value={formatMaintainability(metrics.averageMaintainability)}
          icon={<MaintainabilityIcon />}
          color="success"
          trend={metrics.averageMaintainability > 70 ? 'up' : metrics.averageMaintainability < 50 ? 'down' : 'flat'}
          trendValue={metrics.averageMaintainability > 70 ? 'Excellent' : metrics.averageMaintainability < 50 ? 'Poor' : 'Fair'}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Technical Debt"
          value={formatTechDebt(metrics.totalTechDebt)}
          icon={<TechDebtIcon />}
          color="warning"
          trend={metrics.totalTechDebt < 300 ? 'down' : metrics.totalTechDebt > 600 ? 'up' : 'flat'}
          trendValue={metrics.totalTechDebt < 300 ? 'Low' : metrics.totalTechDebt > 600 ? 'High' : 'Medium'}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Risk Level"
          value={calculateRiskLevel()}
          icon={<RiskIcon />}
          color="error"
          trend={
            calculateRiskLevel() === 'Low' ? 'down' :
            calculateRiskLevel() === 'Critical' ? 'up' :
            'flat'
          }
          trendValue={`${metrics.fileCount} files`}
        />
      </Grid>
    </Grid>
  );
}

export default QualityOverviewCards;
