import type { CommandResult, CLIOptions } from '../types.js';
import type { TraceEvent } from '@defai.digital/contracts';
import { LIMIT_DEFAULT } from '@defai.digital/contracts';
import { getTraceStore } from '../bootstrap.js';
import {
  success,
  successJson,
  failure,
  failureFromError,
  formatList,
} from '../utils/formatters.js';

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

  return traceId === undefined
    ? listTraces(options)
    : getTrace(traceId, options);
}

/**
 * Lists recent traces
 */
async function listTraces(options: CLIOptions): Promise<CommandResult> {
  try {
    const store = getTraceStore();
    const summaries = await store.listTraces(options.limit ?? LIMIT_DEFAULT);
    const traces: TraceSummary[] = summaries.map(s => ({
      traceId: s.traceId,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      eventCount: s.eventCount,
      durationMs: s.durationMs,
    }));

    if (traces.length === 0) {
      return success('No traces found.', []);
    }

    if (options.format === 'json') {
      return successJson(traces);
    }

    const table = formatList(traces, [
      { header: 'Trace ID', width: 36, getValue: t => t.traceId },
      { header: 'Start Time', width: 19, getValue: t => t.startTime.slice(0, 19) },
      { header: 'Status', width: 7, getValue: t => t.status },
      { header: 'Events', width: 6, getValue: t => String(t.eventCount) },
      { header: 'Duration', width: 10, getValue: t => t.durationMs !== undefined ? `${t.durationMs}ms` : 'N/A' },
    ]);

    return success(table, traces);
  } catch (error) {
    return failureFromError('list traces', error);
  }
}

/**
 * Gets a specific trace by ID
 */
async function getTrace(traceId: string, options: CLIOptions): Promise<CommandResult> {
  try {
    const store = getTraceStore();
    const events = await store.getTrace(traceId);

    if (events.length === 0) {
      return failure(`Trace not found: ${traceId}`);
    }

    const data = { traceId, events };

    if (options.format === 'json') {
      return successJson(data);
    }

    // Format as timeline
    const lines = [
      `Trace: ${traceId}`,
      `Events: ${events.length}`,
      '',
      'Timeline:',
      ...events.map(e => formatEventLine(e, options.verbose)),
    ];

    return success(lines.join('\n'), data);
  } catch (error) {
    return failureFromError('get trace', error);
  }
}

/**
 * Formats a single trace event as a timeline line
 */
function formatEventLine(event: TraceEvent, verbose: boolean): string {
  const seq = event.sequence !== undefined ? `[${event.sequence}]` : '[-]';
  const status = event.status !== undefined ? ` (${event.status})` : '';
  const duration = event.durationMs !== undefined ? ` - ${event.durationMs}ms` : '';
  let line = `  ${seq} ${event.type}${status}${duration}`;

  if (verbose && event.payload !== undefined) {
    line += `\n      Payload: ${JSON.stringify(event.payload)}`;
  }

  return line;
}
