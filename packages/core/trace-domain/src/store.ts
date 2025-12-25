import type { TraceEvent } from '@defai.digital/contracts';
import type { TraceSummary, TraceStore } from './types.js';

/**
 * In-memory trace store implementation
 * INV-TR-004: Each trace is independent and self-contained
 */
export class InMemoryTraceStore implements TraceStore {
  private readonly traces = new Map<string, TraceEvent[]>();
  private readonly summaries = new Map<string, TraceSummary>();

  /**
   * Writes a trace event
   * INV-TR-002: Events must be strictly ordered
   */
  write(event: TraceEvent): Promise<void> {
    const { traceId } = event;

    // Get or create trace
    let events = this.traces.get(traceId);
    if (events === undefined) {
      events = [];
      this.traces.set(traceId, events);
    }

    // Freeze event for immutability
    const frozenEvent = Object.freeze(structuredClone(event));
    events.push(frozenEvent);

    // Update summary
    this.updateSummary(traceId, frozenEvent);

    return Promise.resolve();
  }

  /**
   * Flushes pending writes (no-op for in-memory)
   */
  flush(): Promise<void> {
    // No-op for in-memory store
    return Promise.resolve();
  }

  /**
   * Gets all events for a trace
   * INV-TR-002: Events returned in sequence order
   */
  getTrace(traceId: string): Promise<TraceEvent[]> {
    const events = this.traces.get(traceId);
    if (events === undefined) {
      return Promise.resolve([]);
    }

    // Sort by sequence (INV-TR-002)
    const sorted = [...events].sort((a, b) => {
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    return Promise.resolve(sorted);
  }

  /**
   * Gets a specific event
   */
  getEvent(
    traceId: string,
    eventId: string
  ): Promise<TraceEvent | undefined> {
    const events = this.traces.get(traceId);
    return Promise.resolve(events?.find((e) => e.eventId === eventId));
  }

  /**
   * Lists recent traces
   */
  listTraces(limit = 100): Promise<TraceSummary[]> {
    const result = [...this.summaries.values()]
      .sort((a, b) => {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeB - timeA; // Most recent first
      })
      .slice(0, limit);
    return Promise.resolve(result);
  }

  /**
   * Updates trace summary
   */
  private updateSummary(traceId: string, event: TraceEvent): void {
    let summary = this.summaries.get(traceId);

    if (summary === undefined) {
      summary = {
        traceId,
        startTime: event.timestamp,
        status: 'pending',
        eventCount: 0,
        errorCount: 0,
      };
      this.summaries.set(traceId, summary);
    }

    summary.eventCount++;

    if (event.type === 'error') {
      summary.errorCount++;
    }

    if (event.type === 'run.start') {
      summary.startTime = event.timestamp;
      summary.status = 'running';
    }

    if (event.type === 'run.end') {
      summary.endTime = event.timestamp;
      const payload = event.payload as { success?: boolean } | undefined;
      summary.status = payload?.success === true ? 'success' : 'failure';
      if (event.durationMs !== undefined) {
        summary.durationMs = event.durationMs;
      }
    }

    if (event.status !== undefined) {
      summary.status = event.status;
    }
  }

  /**
   * Deletes a trace and all its events
   * @returns true if trace existed and was deleted
   */
  deleteTrace(traceId: string): Promise<boolean> {
    const existed = this.traces.has(traceId);
    if (existed) {
      this.traces.delete(traceId);
      this.summaries.delete(traceId);
    }
    return Promise.resolve(existed);
  }

  /**
   * Clears all traces (for testing)
   */
  clear(): void {
    this.traces.clear();
    this.summaries.clear();
  }
}

/**
 * Creates an in-memory trace store
 */
export function createInMemoryTraceStore(): InMemoryTraceStore {
  return new InMemoryTraceStore();
}
