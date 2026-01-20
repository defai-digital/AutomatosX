import type { MCPTool, ToolHandler } from '../types.js';
import {
  createListResponse,
  successResponse,
  errorResponse,
} from '../utils/response.js';
import { storeArtifact } from '../utils/artifact-store.js';
import { LIMIT_TRACES, TIMEOUT_SESSION, getErrorMessage } from '@defai.digital/contracts';
import { getTraceStore } from '../bootstrap.js';
import type { TraceTreeNode } from '@defai.digital/trace-domain';

/**
 * Trace list tool definition
 */
export const traceListTool: MCPTool = {
  name: 'trace_list',
  description: 'List recent execution traces',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of traces to return',
        default: LIMIT_TRACES,
      },
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['success', 'failure', 'running'],
      },
    },
  },
};

/**
 * Trace get tool definition
 */
export const traceGetTool: MCPTool = {
  name: 'trace_get',
  description: 'Get detailed information about a specific trace',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      traceId: {
        type: 'string',
        description: 'The ID of the trace to retrieve',
      },
    },
    required: ['traceId'],
  },
};

/**
 * Trace analyze tool definition
 */
export const traceAnalyzeTool: MCPTool = {
  name: 'trace_analyze',
  description: 'Analyze a trace for performance issues or errors',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      traceId: {
        type: 'string',
        description: 'The ID of the trace to analyze',
      },
    },
    required: ['traceId'],
  },
};

/**
 * Handler for trace_list tool
 * INV-MCP-RESP-002: Arrays limited to 10 items with pagination
 */
export const handleTraceList: ToolHandler = async (args) => {
  const status = args.status as string | undefined;
  // INV-TR-024: Ensure limit is at least 1 and at most LIMIT_TRACES
  const limit = Math.max(1, Math.min((args.limit as number) ?? LIMIT_TRACES, LIMIT_TRACES));

  try {
    const traceStore = getTraceStore();
    const traceSummaries = await traceStore.listTraces(limit);

    // Filter by status if provided
    const filtered = status !== undefined
      ? traceSummaries.filter((t) => t.status === status)
      : traceSummaries;

    // Map to response format
    const traces = filtered.map((t) => ({
      id: t.traceId,
      label: t.name ?? t.traceId.slice(0, 8),
      status: t.status,
      durationMs: t.durationMs,
      eventCount: t.eventCount,
      startTime: t.startTime,
    }));

    // Use createListResponse for automatic pagination
    return createListResponse(traces, {
      domain: 'traces',
      idField: 'id',
      labelField: 'label',
      limit,
    });
  } catch (error) {
    return errorResponse(
      'TRACE_LIST_ERROR',
      getErrorMessage(error)
    );
  }
};

/**
 * Handler for trace_get tool
 * INV-MCP-RESP-001: Response < 10KB with summary, events stored as artifact
 * INV-MCP-VAL-001: Validate input types before use
 */
export const handleTraceGet: ToolHandler = async (args) => {
  // INV-MCP-VAL-001: Validate traceId is a non-empty string
  const rawTraceId = args.traceId;
  if (typeof rawTraceId !== 'string' || rawTraceId.length === 0) {
    return errorResponse('INVALID_TRACE_ID', 'traceId must be a non-empty string');
  }
  const traceId = rawTraceId;

  try {
    const traceStore = getTraceStore();
    const events = await traceStore.getTrace(traceId);

    if (!events || events.length === 0) {
      return errorResponse('TRACE_NOT_FOUND', `Trace not found: ${traceId}`);
    }

    // Find start and end events
    const startEvent = events.find(e => e.type === 'run.start' || e.type === 'discussion.start');
    const endEvent = events.find(e => e.type === 'run.end' || e.type === 'discussion.end');

    // Extract metadata from events
    const startPayload = startEvent?.payload;
    const endPayload = endEvent?.payload;
    const context = startEvent?.context as Record<string, unknown> | undefined;

    // Determine status
    const status = endPayload?.success === true ? 'success' :
      endEvent ? 'failure' : 'running';

    // Calculate duration
    const durationMs = endEvent?.durationMs ??
      (endEvent && startEvent ?
        new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime() :
        undefined);

    // Store full events as artifact for large traces
    const artifactRef = events.length > 5
      ? await storeArtifact(`trace:${traceId}`, { events })
      : undefined;

    // Return summary with key events
    return successResponse(
      `Trace ${traceId.slice(0, 8)}: ${status}${durationMs ? ` (${durationMs}ms)` : ''}, ${events.length} events`,
      {
        traceId,
        workflowId: context?.workflowId ?? startPayload?.workflowId ?? startPayload?.agentId,
        command: startPayload?.command,
        status,
        durationMs,
        eventCount: events.length,
        // Include first and last events in response
        firstEvent: startEvent ? {
          type: startEvent.type,
          timestamp: startEvent.timestamp,
          payload: startPayload,
        } : undefined,
        lastEvent: endEvent ? {
          type: endEvent.type,
          timestamp: endEvent.timestamp,
          status: endPayload?.success === true ? 'success' : 'failure',
        } : undefined,
        artifactRef,
        hasMore: events.length > 5,
      }
    );
  } catch (error) {
    return errorResponse(
      'TRACE_GET_ERROR',
      getErrorMessage(error)
    );
  }
};

/**
 * Handler for trace_analyze tool
 * INV-MCP-RESP-006: Response includes summary field with key metrics only
 */
export const handleTraceAnalyze: ToolHandler = async (args) => {
  const traceId = args.traceId as string;

  try {
    const traceStore = getTraceStore();
    const events = await traceStore.getTrace(traceId);

    if (!events || events.length === 0) {
      return errorResponse('TRACE_NOT_FOUND', `Trace not found: ${traceId}`);
    }

    // Find key events
    const startEvent = events.find(e => e.type === 'run.start' || e.type === 'discussion.start');
    const endEvent = events.find(e => e.type === 'run.end' || e.type === 'discussion.end');
    const stepEvents = events.filter(e => e.type === 'step.end' || e.type === 'step.execute');
    const errorEvents = events.filter(e => e.type === 'error');

    // Determine status
    const endPayload = endEvent?.payload;
    const status = endPayload?.success === true ? 'success' :
      endEvent ? 'failure' : 'running';

    // Calculate total duration
    const totalDuration = endEvent?.durationMs ??
      (endEvent && startEvent ?
        new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime() :
        undefined);

    // Find slowest step
    let slowestStep: { name: string; durationMs: number } | undefined;
    for (const step of stepEvents) {
      if (step.durationMs && (!slowestStep || step.durationMs > slowestStep.durationMs)) {
        const stepPayload = step.payload;
        slowestStep = {
          name: (stepPayload?.stepId as string) ?? 'unknown',
          durationMs: step.durationMs,
        };
      }
    }

    // Generate recommendations based on analysis
    const recommendations: string[] = [];
    if (totalDuration && totalDuration > 10000) {
      recommendations.push('Consider optimizing slow steps or adding caching');
    }
    if (errorEvents.length > 0) {
      recommendations.push(`Review ${errorEvents.length} error event(s) for root cause`);
    }
    if (slowestStep && slowestStep.durationMs > 5000) {
      recommendations.push(`Step "${slowestStep.name}" took ${slowestStep.durationMs}ms - consider optimization`);
    }

    const summaryParts = [
      `Trace ${status}`,
      totalDuration ? `${totalDuration}ms` : 'running',
      `${stepEvents.length} steps`,
      errorEvents.length > 0 ? `${errorEvents.length} errors` : 'no errors',
    ];

    return successResponse(
      summaryParts.join(', '),
      {
        traceId,
        status,
        performance: {
          totalDuration,
          stepCount: stepEvents.length,
          slowestStep: slowestStep ? `${slowestStep.name} (${slowestStep.durationMs}ms)` : undefined,
        },
        issueCount: errorEvents.length,
        recommendationCount: recommendations.length,
        topRecommendation: recommendations[0],
      }
    );
  } catch (error) {
    return errorResponse(
      'TRACE_ANALYZE_ERROR',
      getErrorMessage(error)
    );
  }
};

// ============================================================================
// Hierarchical Tracing Tools (INV-TR-020 through INV-TR-024)
// ============================================================================

/**
 * Trace tree tool definition
 * Get a hierarchical tree view of a trace and its child traces
 */
export const traceTreeTool: MCPTool = {
  name: 'trace_tree',
  description: 'Get a hierarchical tree view of a trace and its delegated child traces. Returns the complete trace tree structure for visualization.',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      traceId: {
        type: 'string',
        description: 'The ID of the trace to get the tree for. Can be any trace in the hierarchy - will return that trace and all its descendants.',
      },
    },
    required: ['traceId'],
  },
};

/**
 * Trace by session tool definition
 * Get all traces in a session
 */
export const traceBySessionTool: MCPTool = {
  name: 'trace_by_session',
  description: 'Get all traces associated with a collaboration session. Returns traces sorted by start time.',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to get traces for (UUID format)',
      },
    },
    required: ['sessionId'],
  },
};

/**
 * Escape special regex characters in a string
 * INV-TR-022: Prevent regex injection when building dynamic patterns
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a trace tree node for display
 */
function formatTreeNode(node: TraceTreeNode, indent: string = ''): string {
  const statusIcon = node.trace.status === 'success' ? '[OK]' :
    node.trace.status === 'failure' ? '[FAIL]' :
    node.trace.status === 'running' ? '[...]' : '[?]';

  const agentLabel = node.trace.agentId ? ` - ${node.trace.agentId}` : '';
  const durationLabel = node.trace.durationMs ? ` (${node.trace.durationMs}ms)` : '';

  const line = `${indent}${statusIcon} ${node.trace.traceId.slice(0, 8)}${agentLabel}${durationLabel}`;

  const childLines = node.children.map((child, i, arr) => {
    const isLast = i === arr.length - 1;
    const childIndent = indent + (isLast ? ' └─ ' : ' ├─ ');
    const grandchildIndent = indent + (isLast ? '    ' : ' │  ');
    // INV-TR-022: Escape regex special characters to prevent injection
    return formatTreeNode(child, childIndent).replace(new RegExp(`^${escapeRegex(childIndent)}`, 'gm'), (m, offset) =>
      offset === 0 ? m : grandchildIndent
    );
  });

  return [line, ...childLines].join('\n');
}

/**
 * Handler for trace_tree tool
 * INV-TR-020: Returns traces grouped by rootTraceId
 * INV-TR-021: Shows parent-child relationships
 */
export const handleTraceTree: ToolHandler = async (args) => {
  const traceId = args.traceId as string;

  try {
    const traceStore = getTraceStore();
    const tree = await traceStore.getTraceTree(traceId);

    if (!tree) {
      return errorResponse('TRACE_NOT_FOUND', `Trace not found: ${traceId}`);
    }

    // Format the tree for display
    const treeDisplay = formatTreeNode(tree);

    // Count nodes in tree
    const countNodes = (node: TraceTreeNode): number => {
      return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
    };
    const totalTraces = countNodes(tree);

    return successResponse(
      `Trace tree with ${totalTraces} trace(s), total ${tree.totalDurationMs ?? 0}ms`,
      {
        traceId,
        rootTraceId: tree.trace.rootTraceId ?? traceId,
        traceCount: totalTraces,
        totalDurationMs: tree.totalDurationMs,
        totalEventCount: tree.totalEventCount,
        maxDepth: tree.trace.traceDepth ?? 0,
        treeView: treeDisplay,
        tree: {
          traceId: tree.trace.traceId,
          status: tree.trace.status,
          agentId: tree.trace.agentId,
          durationMs: tree.trace.durationMs,
          depth: tree.trace.traceDepth ?? 0,
          childCount: tree.children.length,
          children: (tree.children).map(child => ({
            traceId: child.trace.traceId,
            status: child.trace.status,
            agentId: child.trace.agentId,
            durationMs: child.trace.durationMs,
            depth: child.trace.traceDepth ?? 0,
            childCount: child.children.length,
          })),
        },
      }
    );
  } catch (error) {
    return errorResponse(
      'TRACE_TREE_ERROR',
      getErrorMessage(error)
    );
  }
};

/**
 * Trace close stuck tool definition
 * Close traces that have been running longer than expected
 */
export const traceCloseStuckTool: MCPTool = {
  name: 'trace_close_stuck',
  description: 'Close stuck traces that have been running longer than the specified time. Marks them as failed with an auto-close message.',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      maxAgeMs: {
        type: 'number',
        description: `Maximum age in milliseconds before a trace is considered stuck (default: 1 hour = ${TIMEOUT_SESSION}ms)`,
        default: TIMEOUT_SESSION,
      },
    },
  },
};

/**
 * Handler for trace_close_stuck tool
 * Closes stuck traces by writing a run.end event
 */
export const handleTraceCloseStuck: ToolHandler = async (args) => {
  const maxAgeMs = (args.maxAgeMs as number) ?? TIMEOUT_SESSION;

  try {
    const traceStore = getTraceStore();
    const closedCount = await traceStore.closeStuckTraces(maxAgeMs);

    return successResponse(
      closedCount > 0
        ? `Closed ${closedCount} stuck trace(s)`
        : 'No stuck traces found to close',
      {
        closedCount,
        maxAgeMs,
        maxAgeHours: Math.round(maxAgeMs / 3600000 * 10) / 10,
      }
    );
  } catch (error) {
    return errorResponse(
      'TRACE_CLOSE_STUCK_ERROR',
      getErrorMessage(error)
    );
  }
};

/**
 * Handler for trace_by_session tool
 * INV-TR-023: Returns traces correlated by sessionId
 */
export const handleTraceBySession: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;

  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.getTracesBySession(sessionId);

    if (traces.length === 0) {
      return successResponse(
        `No traces found for session ${sessionId.slice(0, 8)}`,
        {
          sessionId,
          traceCount: 0,
          traces: [],
        }
      );
    }

    // Calculate session stats
    const successCount = traces.filter(t => t.status === 'success').length;
    const failureCount = traces.filter(t => t.status === 'failure').length;
    const totalDuration = traces.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);

    // Map to response format (limit to 10 for summary)
    const traceSummaries = traces.slice(0, 10).map(t => ({
      traceId: t.traceId,
      shortId: t.traceId.slice(0, 8),
      status: t.status,
      agentId: t.agentId,
      durationMs: t.durationMs,
      depth: t.traceDepth ?? 0,
      startTime: t.startTime,
    }));

    return successResponse(
      `Session ${sessionId.slice(0, 8)}: ${traces.length} trace(s), ${successCount} success, ${failureCount} failed`,
      {
        sessionId,
        traceCount: traces.length,
        successCount,
        failureCount,
        totalDurationMs: totalDuration,
        traces: traceSummaries,
        hasMore: traces.length > 10,
      }
    );
  } catch (error) {
    return errorResponse(
      'TRACE_BY_SESSION_ERROR',
      getErrorMessage(error)
    );
  }
};
