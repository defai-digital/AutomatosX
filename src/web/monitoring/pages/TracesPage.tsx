/**
 * TracesPage.tsx
 *
 * Distributed trace viewer with span visualization
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 3
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Alert,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import axios from 'axios';

interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, unknown>;
  events: Array<{ timestamp: number; name: string; attributes?: Record<string, unknown> }>;
}

interface Trace {
  traceId: string;
  workflowExecutionId: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  spans: Span[];
}

export const TracesPage: React.FC = () => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  useEffect(() => {
    fetchTraces();
    const interval = setInterval(fetchTraces, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTraces = async () => {
    try {
      // Get recent workflows
      const workflowsResponse = await axios.get('/api/monitoring/workflows?limit=10');
      const workflows = workflowsResponse.data;

      // Fetch traces for each workflow
      const tracePromises = workflows.map((workflow: any) =>
        axios.get(`/api/monitoring/traces/execution/${workflow.executionId}`)
      );

      const traceResponses = await Promise.all(tracePromises);
      const allTraces = traceResponses.flatMap((response) => response.data);

      setTraces(allTraces);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traces');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'default' => {
    switch (status) {
      case 'ok':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const renderSpanTree = (spans: Span[], parentId?: string, depth = 0): JSX.Element[] => {
    return spans
      .filter((span) => span.parentSpanId === parentId)
      .map((span) => (
        <React.Fragment key={span.spanId}>
          <TableRow>
            <TableCell style={{ paddingLeft: `${depth * 20 + 16}px` }}>{span.name}</TableCell>
            <TableCell>{span.kind}</TableCell>
            <TableCell>
              <Chip label={span.status} color={getStatusColor(span.status)} size="small" />
            </TableCell>
            <TableCell>{span.duration ? formatDuration(span.duration) : 'In progress'}</TableCell>
            <TableCell>{new Date(span.startedAt).toLocaleTimeString()}</TableCell>
          </TableRow>
          {renderSpanTree(spans, span.spanId, depth + 1)}
        </React.Fragment>
      ));
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading traces...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Distributed Traces
      </Typography>

      {traces.length === 0 ? (
        <Alert severity="info">No traces available</Alert>
      ) : (
        traces.map((trace) => (
          <Paper key={trace.traceId} sx={{ mb: 2 }}>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedTrace(expandedTrace === trace.traceId ? null : trace.traceId)}
            >
              <Box>
                <Typography variant="h6">Trace: {trace.traceId}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Workflow: {trace.workflowExecutionId} | Spans: {trace.spans.length} |
                  Duration: {trace.duration ? formatDuration(trace.duration) : 'In progress'}
                </Typography>
              </Box>
              <IconButton size="small">
                {expandedTrace === trace.traceId ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            </Box>

            <Collapse in={expandedTrace === trace.traceId} timeout="auto" unmountOnExit>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Span Name</TableCell>
                      <TableCell>Kind</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Started At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>{renderSpanTree(trace.spans)}</TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Paper>
        ))
      )}
    </Box>
  );
};
