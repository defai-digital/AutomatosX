import type { MCPTool, ToolHandler } from '../types.js';
import {
  createListResponse,
  successResponse,
} from '../utils/response.js';
import { storeArtifact } from '../utils/artifact-store.js';
import { LIMIT_TRACES } from '@defai.digital/contracts';

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
export const handleTraceList: ToolHandler = (args) => {
  const status = args.status as string | undefined;

  // Sample traces
  const traces = [
    {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      label: 'data-pipeline',
      status: 'success' as const,
      durationMs: 5000,
    },
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      label: 'code-review',
      status: 'success' as const,
      durationMs: 5000,
    },
    {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      label: 'deploy-staging',
      status: 'failure' as const,
      durationMs: 2000,
    },
  ];

  const filtered = status !== undefined
    ? traces.filter((t) => t.status === status)
    : traces;

  // Use createListResponse for automatic pagination (max 10 items)
  return Promise.resolve(createListResponse(filtered, {
    domain: 'traces',
    idField: 'id',
    labelField: 'label',
    limit: 10,
  }));
};

/**
 * Handler for trace_get tool
 * INV-MCP-RESP-001: Response < 10KB with summary, events stored as artifact
 */
export const handleTraceGet: ToolHandler = async (args) => {
  const traceId = args.traceId as string;

  const now = new Date();

  // Sample trace detail - full events stored as artifact
  const fullEvents = [
    {
      eventId: crypto.randomUUID(),
      type: 'run.start',
      sequence: 0,
      timestamp: new Date(now.getTime() - 60000).toISOString(),
      payload: { workflowId: 'data-pipeline' },
    },
    {
      eventId: crypto.randomUUID(),
      type: 'decision.routing',
      sequence: 1,
      timestamp: new Date(now.getTime() - 59500).toISOString(),
      payload: {
        selectedModel: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
      },
    },
    {
      eventId: crypto.randomUUID(),
      type: 'step.execute',
      sequence: 2,
      timestamp: new Date(now.getTime() - 59000).toISOString(),
      payload: { stepId: 'step-1', stepName: 'Initialize' },
      status: 'success',
      durationMs: 500,
    },
    {
      eventId: crypto.randomUUID(),
      type: 'step.execute',
      sequence: 3,
      timestamp: new Date(now.getTime() - 57000).toISOString(),
      payload: { stepId: 'step-2', stepName: 'Process' },
      status: 'success',
      durationMs: 2000,
    },
    {
      eventId: crypto.randomUUID(),
      type: 'run.end',
      sequence: 4,
      timestamp: new Date(now.getTime() - 55000).toISOString(),
      payload: { success: true },
      status: 'success',
    },
  ];

  // Store full events as artifact
  const artifactRef = await storeArtifact(`trace:${traceId}`, { events: fullEvents });

  // Return summary with only first/last events
  return successResponse(
    `Trace ${traceId}: success (5000ms, ${fullEvents.length} events)`,
    {
      traceId,
      workflowId: 'data-pipeline',
      status: 'success',
      durationMs: 5000,
      eventCount: fullEvents.length,
      // Only include first and last events in response
      firstEvent: { type: fullEvents[0]?.type, timestamp: fullEvents[0]?.timestamp },
      lastEvent: { type: fullEvents[fullEvents.length - 1]?.type, status: 'success' },
      artifactRef,
      hasMore: true,
    }
  );
};

/**
 * Handler for trace_analyze tool
 * INV-MCP-RESP-006: Response includes summary field with key metrics only
 */
export const handleTraceAnalyze: ToolHandler = (args) => {
  const traceId = args.traceId as string;

  // Return optimized analysis with summary and key metrics
  return Promise.resolve(successResponse(
    'Trace OK: 5000ms, 3 steps, no issues',
    {
      traceId,
      status: 'success',
      performance: {
        totalDuration: 5000,
        stepCount: 3,
        slowestStep: 'Process (2000ms)',
      },
      issueCount: 0,
      recommendationCount: 1,
      // Only include top recommendation
      topRecommendation: 'Consider caching step-2 results',
    }
  ));
};
