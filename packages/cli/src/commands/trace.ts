import type { CommandResult, CLIOptions } from '../types.js';
import type { TraceEvent } from '@defai.digital/contracts';
import { getTraceStore } from '../bootstrap.js';

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
 * Gets recent traces from the trace store
 */
async function getRecentTraces(limit: number): Promise<TraceSummary[]> {
  const store = getTraceStore();
  const summaries = await store.listTraces(limit);

  // Map TraceSummary from trace-domain to our local TraceSummary type
  return summaries.map((s) => ({
    traceId: s.traceId,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    eventCount: s.eventCount,
    durationMs: s.durationMs,
  }));
}

/**
 * Gets events for a specific trace from the trace store
 */
async function getTraceEvents(traceId: string): Promise<TraceEvent[]> {
  const store = getTraceStore();
  return store.getTrace(traceId);
}
