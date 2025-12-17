import type { MCPTool, ToolHandler } from '../types.js';
import { randomUUID } from 'crypto';

/**
 * Metrics record tool definition
 */
export const metricsRecordTool: MCPTool = {
  name: 'metrics_record',
  description: 'Record a metric value',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      metricName: {
        type: 'string',
        description: 'Name of the metric (e.g., agent_requests_total)',
      },
      value: {
        type: 'number',
        description: 'Metric value',
      },
      labels: {
        type: 'object',
        description: 'Labels for the metric (key-value pairs)',
        additionalProperties: { type: 'string' },
      },
      type: {
        type: 'string',
        description: 'Metric type',
        enum: ['counter', 'gauge', 'histogram', 'summary', 'timer'],
        default: 'gauge',
      },
    },
    required: ['metricName', 'value'],
  },
};

/**
 * Metrics increment tool definition
 */
export const metricsIncrementTool: MCPTool = {
  name: 'metrics_increment',
  description: 'Increment a counter metric',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      metricName: {
        type: 'string',
        description: 'Name of the counter metric',
      },
      delta: {
        type: 'number',
        description: 'Amount to increment by',
        default: 1,
      },
      labels: {
        type: 'object',
        description: 'Labels for the metric',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['metricName'],
  },
};

/**
 * Metrics query tool definition
 */
export const metricsQueryTool: MCPTool = {
  name: 'metrics_query',
  description: 'Query metric values',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      metricName: {
        type: 'string',
        description: 'Name of the metric to query',
      },
      labels: {
        type: 'object',
        description: 'Filter by labels',
        additionalProperties: { type: 'string' },
      },
      aggregation: {
        type: 'string',
        description: 'Aggregation function',
        enum: ['sum', 'avg', 'min', 'max', 'count', 'rate', 'percentile', 'last'],
      },
      limit: {
        type: 'number',
        description: 'Maximum data points to return',
        default: 100,
      },
    },
    required: ['metricName'],
  },
};

/**
 * Metrics list tool definition
 */
export const metricsListTool: MCPTool = {
  name: 'metrics_list',
  description: 'List all available metrics',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category',
        enum: ['system', 'application', 'agent', 'workflow', 'session', 'memory', 'provider', 'tool', 'trace', 'custom'],
      },
      type: {
        type: 'string',
        description: 'Filter by metric type',
        enum: ['counter', 'gauge', 'histogram', 'summary', 'timer'],
      },
      prefix: {
        type: 'string',
        description: 'Filter by name prefix',
      },
    },
  },
};

/**
 * Telemetry summary tool definition
 */
export const telemetrySummaryTool: MCPTool = {
  name: 'telemetry_summary',
  description: 'Get a summary of telemetry data',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        description: 'Categories to include',
        items: {
          type: 'string',
          enum: ['system', 'application', 'agent', 'workflow', 'session', 'memory', 'provider', 'tool', 'trace', 'custom'],
        },
      },
      includeDetails: {
        type: 'boolean',
        description: 'Include metric details',
        default: false,
      },
    },
  },
};

/**
 * Timer start tool definition
 */
export const timerStartTool: MCPTool = {
  name: 'timer_start',
  description: 'Start a timer for measuring duration',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      metricName: {
        type: 'string',
        description: 'Name of the timer metric',
      },
      labels: {
        type: 'object',
        description: 'Labels for the timer',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['metricName'],
  },
};

/**
 * Timer stop tool definition
 */
export const timerStopTool: MCPTool = {
  name: 'timer_stop',
  description: 'Stop a timer and record the duration',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      timerId: {
        type: 'string',
        description: 'Timer ID returned by timer_start',
      },
    },
    required: ['timerId'],
  },
};

// In-memory storage for metrics
interface MetricRecord {
  name: string;
  type: string;
  category: string;
  unit: string;
  values: Array<{
    value: number;
    labels: Record<string, string>;
    timestamp: string;
  }>;
  currentValue: number;
}

interface TimerRecord {
  timerId: string;
  metricName: string;
  labels: Record<string, string>;
  startedAt: number;
}

const metricStore = new Map<string, MetricRecord>();
const timerStore = new Map<string, TimerRecord>();

// Initialize default metrics
function ensureMetric(name: string, type: string = 'gauge'): MetricRecord {
  let metric = metricStore.get(name);
  if (metric === undefined) {
    const category = name.split('_')[0] ?? 'custom';
    metric = {
      name,
      type,
      category,
      unit: 'none',
      values: [],
      currentValue: 0,
    };
    metricStore.set(name, metric);
  }
  return metric;
}

/**
 * Handler for metrics_record tool
 */
export const handleMetricsRecord: ToolHandler = async (args) => {
  const metricName = args.metricName as string;
  const value = args.value as number;
  const labels = (args.labels as Record<string, string>) ?? {};
  const type = (args.type as string) ?? 'gauge';

  try {
    const metric = ensureMetric(metricName, type);

    metric.currentValue = value;
    metric.values.push({
      value,
      labels,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 1000 values
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            recorded: true,
            metricName,
            value,
            labels,
            type: metric.type,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'RECORD_FAILED',
            message,
            metricName,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for metrics_increment tool
 */
export const handleMetricsIncrement: ToolHandler = async (args) => {
  const metricName = args.metricName as string;
  const delta = (args.delta as number) ?? 1;
  const labels = (args.labels as Record<string, string>) ?? {};

  try {
    const metric = ensureMetric(metricName, 'counter');

    metric.currentValue += delta;
    metric.values.push({
      value: metric.currentValue,
      labels,
      timestamp: new Date().toISOString(),
    });

    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            incremented: true,
            metricName,
            delta,
            currentValue: metric.currentValue,
            labels,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'INCREMENT_FAILED',
            message,
            metricName,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for metrics_query tool
 */
export const handleMetricsQuery: ToolHandler = async (args) => {
  const metricName = args.metricName as string;
  const labels = args.labels as Record<string, string> | undefined;
  const aggregation = args.aggregation as string | undefined;
  const limit = (args.limit as number) ?? 100;

  try {
    const metric = metricStore.get(metricName);

    if (metric === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'METRIC_NOT_FOUND',
              message: `Metric "${metricName}" not found`,
              metricName,
            }),
          },
        ],
        isError: true,
      };
    }

    // Filter by labels if specified
    let filteredValues = metric.values;
    if (labels !== undefined && Object.keys(labels).length > 0) {
      filteredValues = metric.values.filter((v) =>
        Object.entries(labels).every(([k, val]) => v.labels[k] === val)
      );
    }

    // Apply limit
    filteredValues = filteredValues.slice(-limit);

    // Apply aggregation
    let aggregatedValue: number | null = null;
    if (aggregation !== undefined && filteredValues.length > 0) {
      const values = filteredValues.map((v) => v.value);
      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        case 'last':
          aggregatedValue = values[values.length - 1] ?? null;
          break;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            metricName,
            type: metric.type,
            category: metric.category,
            currentValue: metric.currentValue,
            dataPoints: filteredValues,
            total: filteredValues.length,
            aggregation: aggregation ?? null,
            aggregatedValue,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'QUERY_FAILED',
            message,
            metricName,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for metrics_list tool
 */
export const handleMetricsList: ToolHandler = async (args) => {
  const category = args.category as string | undefined;
  const type = args.type as string | undefined;
  const prefix = args.prefix as string | undefined;

  try {
    let metrics = Array.from(metricStore.values());

    if (category !== undefined) {
      metrics = metrics.filter((m) => m.category === category);
    }
    if (type !== undefined) {
      metrics = metrics.filter((m) => m.type === type);
    }
    if (prefix !== undefined) {
      metrics = metrics.filter((m) => m.name.startsWith(prefix));
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            metrics: metrics.map((m) => ({
              name: m.name,
              type: m.type,
              category: m.category,
              currentValue: m.currentValue,
              dataPointCount: m.values.length,
              lastUpdated: m.values.length > 0 ? m.values[m.values.length - 1]?.timestamp : null,
            })),
            total: metrics.length,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for telemetry_summary tool
 */
export const handleTelemetrySummary: ToolHandler = async (args) => {
  const categories = args.categories as string[] | undefined;
  const includeDetails = (args.includeDetails as boolean) ?? false;

  try {
    let metrics = Array.from(metricStore.values());

    if (categories !== undefined && categories.length > 0) {
      metrics = metrics.filter((m) => categories.includes(m.category));
    }

    // Group by category
    const byCategory = new Map<string, MetricRecord[]>();
    for (const metric of metrics) {
      const existing = byCategory.get(metric.category);
      if (existing !== undefined) {
        existing.push(metric);
      } else {
        byCategory.set(metric.category, [metric]);
      }
    }

    const categorySummaries = Array.from(byCategory.entries()).map(([cat, catMetrics]) => ({
      category: cat,
      metricCount: catMetrics.length,
      dataPointCount: catMetrics.reduce((sum, m) => sum + m.values.length, 0),
      metrics: includeDetails
        ? catMetrics.map((m) => ({
            name: m.name,
            type: m.type,
            currentValue: m.currentValue,
            lastUpdated: m.values.length > 0 ? m.values[m.values.length - 1]?.timestamp : null,
          }))
        : undefined,
    }));

    const totalDataPoints = metrics.reduce((sum, m) => sum + m.values.length, 0);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalMetrics: metrics.length,
            totalDataPoints,
            byCategory: categorySummaries,
            generatedAt: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'SUMMARY_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for timer_start tool
 */
export const handleTimerStart: ToolHandler = async (args) => {
  const metricName = args.metricName as string;
  const labels = (args.labels as Record<string, string>) ?? {};

  try {
    const timerId = randomUUID();

    timerStore.set(timerId, {
      timerId,
      metricName,
      labels,
      startedAt: Date.now(),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            timerId,
            metricName,
            labels,
            startedAt: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'TIMER_START_FAILED',
            message,
            metricName,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for timer_stop tool
 */
export const handleTimerStop: ToolHandler = async (args) => {
  const timerId = args.timerId as string;

  try {
    const timer = timerStore.get(timerId);

    if (timer === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'TIMER_NOT_FOUND',
              message: `Timer "${timerId}" not found`,
              timerId,
            }),
          },
        ],
        isError: true,
      };
    }

    const duration = Date.now() - timer.startedAt;

    // Record the duration as a metric
    const metric = ensureMetric(timer.metricName, 'timer');
    metric.currentValue = duration;
    metric.values.push({
      value: duration,
      labels: timer.labels,
      timestamp: new Date().toISOString(),
    });

    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    // Clean up timer
    timerStore.delete(timerId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            timerId,
            metricName: timer.metricName,
            durationMs: duration,
            labels: timer.labels,
            stoppedAt: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'TIMER_STOP_FAILED',
            message,
            timerId,
          }),
        },
      ],
      isError: true,
    };
  }
};
