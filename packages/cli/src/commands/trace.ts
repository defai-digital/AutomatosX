import type { CommandResult, CLIOptions } from '../types.js';
import type { TraceEvent } from '@automatosx/contracts';

/**
 * Trace summary for display
 */
interface TraceSummary {
  traceId: string;
  startTime: string;
  endTime: string | undefined;
  status: string;
  eventCount: number;
  durationMs: number | undefined;
}

/**
 * Handles the 'trace' command - views trace information
 */
export async function traceCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const traceId = args[0] ?? options.traceId;

  // If no trace ID, list recent traces
  if (traceId === undefined) {
    return listTraces(options);
  }

  // Get specific trace
  return getTrace(traceId, options);
}

/**
 * Lists recent traces
 */
async function listTraces(options: CLIOptions): Promise<CommandResult> {
  try {
    // Get traces (in real implementation, from trace store)
    const traces = await getRecentTraces(options.limit ?? 10);

    if (traces.length === 0) {
      return {
        success: true,
        message: 'No traces found.',
        data: [],
        exitCode: 0,
      };
    }

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: traces,
        exitCode: 0,
      };
    }

    // Format as text table
    const header = 'Trace ID                             | Start Time          | Status  | Events | Duration';
    const separator = '-'.repeat(header.length);
    const rows = traces.map((t) => {
      const duration = t.durationMs !== undefined ? `${String(t.durationMs)}ms` : 'N/A';
      return `${t.traceId} | ${t.startTime.slice(0, 19)} | ${t.status.padEnd(7)} | ${String(t.eventCount).padEnd(6)} | ${duration}`;
    });

    return {
      success: true,
      message: [header, separator, ...rows].join('\n'),
      data: traces,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list traces: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Gets a specific trace by ID
 */
async function getTrace(
  traceId: string,
  options: CLIOptions
): Promise<CommandResult> {
  try {
    const events = await getTraceEvents(traceId);

    if (events.length === 0) {
      return {
        success: false,
        message: `Trace not found: ${traceId}`,
        data: undefined,
        exitCode: 1,
      };
    }

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: { traceId, events },
        exitCode: 0,
      };
    }

    // Format as timeline
    const lines = [
      `Trace: ${traceId}`,
      `Events: ${String(events.length)}`,
      '',
      'Timeline:',
    ];

    for (const event of events) {
      const seq = event.sequence !== undefined ? `[${String(event.sequence)}]` : '[-]';
      const status = event.status !== undefined ? ` (${event.status})` : '';
      const duration = event.durationMs !== undefined ? ` - ${String(event.durationMs)}ms` : '';
      lines.push(`  ${seq} ${event.type}${status}${duration}`);

      if (options.verbose && event.payload !== undefined) {
        lines.push(`      Payload: ${JSON.stringify(event.payload)}`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { traceId, events },
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get trace: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Gets recent traces
 * In a real implementation, this would query the trace store
 */
function getRecentTraces(_limit: number): Promise<TraceSummary[]> {
  // Return sample traces for demonstration
  const now = new Date();
  return Promise.resolve([
    {
      traceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      startTime: new Date(now.getTime() - 60000).toISOString(),
      endTime: new Date(now.getTime() - 55000).toISOString(),
      status: 'success',
      eventCount: 8,
      durationMs: 5000,
    },
    {
      traceId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      startTime: new Date(now.getTime() - 120000).toISOString(),
      endTime: new Date(now.getTime() - 115000).toISOString(),
      status: 'success',
      eventCount: 6,
      durationMs: 5000,
    },
    {
      traceId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      startTime: new Date(now.getTime() - 180000).toISOString(),
      endTime: new Date(now.getTime() - 178000).toISOString(),
      status: 'failure',
      eventCount: 4,
      durationMs: 2000,
    },
  ]);
}

/**
 * Gets events for a specific trace
 * In a real implementation, this would query the trace store
 */
function getTraceEvents(traceId: string): Promise<TraceEvent[]> {
  // Return sample events for demonstration
  const now = new Date();
  return Promise.resolve([
    {
      eventId: crypto.randomUUID(),
      traceId,
      type: 'run.start',
      timestamp: new Date(now.getTime() - 5000).toISOString(),
      sequence: 0,
      payload: { workflowId: 'sample-workflow' },
      status: 'running',
    },
    {
      eventId: crypto.randomUUID(),
      traceId,
      type: 'decision.routing',
      timestamp: new Date(now.getTime() - 4500).toISOString(),
      sequence: 1,
      payload: { model: 'claude-3-5-sonnet-20241022' },
    },
    {
      eventId: crypto.randomUUID(),
      traceId,
      type: 'step.execute',
      timestamp: new Date(now.getTime() - 4000).toISOString(),
      sequence: 2,
      payload: { stepId: 'step-1' },
      status: 'success',
      durationMs: 500,
    },
    {
      eventId: crypto.randomUUID(),
      traceId,
      type: 'step.execute',
      timestamp: new Date(now.getTime() - 3000).toISOString(),
      sequence: 3,
      payload: { stepId: 'step-2' },
      status: 'success',
      durationMs: 1000,
    },
    {
      eventId: crypto.randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: now.toISOString(),
      sequence: 4,
      payload: { success: true },
      status: 'success',
      durationMs: 5000,
    },
  ]);
}
