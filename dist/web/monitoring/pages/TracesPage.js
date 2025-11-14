import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * TracesPage.tsx
 *
 * Distributed trace viewer with span visualization
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 3
 */
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Collapse, Alert, } from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import axios from 'axios';
export const TracesPage = () => {
    const [traces, setTraces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedTrace, setExpandedTrace] = useState(null);
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
            const tracePromises = workflows.map((workflow) => axios.get(`/api/monitoring/traces/execution/${workflow.executionId}`));
            const traceResponses = await Promise.all(tracePromises);
            const allTraces = traceResponses.flatMap((response) => response.data);
            setTraces(allTraces);
            setLoading(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch traces');
            setLoading(false);
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'ok':
                return 'success';
            case 'error':
                return 'error';
            default:
                return 'default';
        }
    };
    const formatDuration = (ms) => {
        if (ms < 1000)
            return `${ms.toFixed(0)}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(2)}s`;
        return `${(ms / 60000).toFixed(2)}m`;
    };
    const renderSpanTree = (spans, parentId, depth = 0) => {
        return spans
            .filter((span) => span.parentSpanId === parentId)
            .map((span) => (_jsxs(React.Fragment, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { style: { paddingLeft: `${depth * 20 + 16}px` }, children: span.name }), _jsx(TableCell, { children: span.kind }), _jsx(TableCell, { children: _jsx(Chip, { label: span.status, color: getStatusColor(span.status), size: "small" }) }), _jsx(TableCell, { children: span.duration ? formatDuration(span.duration) : 'In progress' }), _jsx(TableCell, { children: new Date(span.startedAt).toLocaleTimeString() })] }), renderSpanTree(spans, span.spanId, depth + 1)] }, span.spanId)));
    };
    if (loading) {
        return (_jsx(Box, { sx: { p: 3 }, children: _jsx(Typography, { children: "Loading traces..." }) }));
    }
    if (error) {
        return (_jsx(Box, { sx: { p: 3 }, children: _jsx(Alert, { severity: "error", children: error }) }));
    }
    return (_jsxs(Box, { sx: { p: 3 }, children: [_jsx(Typography, { variant: "h4", gutterBottom: true, children: "Distributed Traces" }), traces.length === 0 ? (_jsx(Alert, { severity: "info", children: "No traces available" })) : (traces.map((trace) => (_jsxs(Paper, { sx: { mb: 2 }, children: [_jsxs(Box, { sx: {
                            p: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                        }, onClick: () => setExpandedTrace(expandedTrace === trace.traceId ? null : trace.traceId), children: [_jsxs(Box, { children: [_jsxs(Typography, { variant: "h6", children: ["Trace: ", trace.traceId] }), _jsxs(Typography, { variant: "body2", color: "text.secondary", children: ["Workflow: ", trace.workflowExecutionId, " | Spans: ", trace.spans.length, " | Duration: ", trace.duration ? formatDuration(trace.duration) : 'In progress'] })] }), _jsx(IconButton, { size: "small", children: expandedTrace === trace.traceId ? _jsx(KeyboardArrowUp, {}) : _jsx(KeyboardArrowDown, {}) })] }), _jsx(Collapse, { in: expandedTrace === trace.traceId, timeout: "auto", unmountOnExit: true, children: _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: "Span Name" }), _jsx(TableCell, { children: "Kind" }), _jsx(TableCell, { children: "Status" }), _jsx(TableCell, { children: "Duration" }), _jsx(TableCell, { children: "Started At" })] }) }), _jsx(TableBody, { children: renderSpanTree(trace.spans) })] }) }) })] }, trace.traceId))))] }));
};
//# sourceMappingURL=TracesPage.js.map