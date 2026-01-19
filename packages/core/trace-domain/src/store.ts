import type { TraceEvent, TraceContext } from '@defai.digital/contracts';
import type { TraceSummary, TraceStore, TraceTreeNode } from './types.js';

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
    const context = event.context;
    const existingSummary = this.summaries.get(traceId);

    // Create or update summary
    const summary: TraceSummary = existingSummary ?? {
      traceId,
      startTime: event.timestamp,
      status: 'pending',
      eventCount: 0,
      errorCount: 0,
      // Initialize hierarchy fields from first event context (INV-TR-020 through INV-TR-024)
      parentTraceId: context?.parentTraceId,
      rootTraceId: context?.rootTraceId,
      traceDepth: context?.traceDepth,
      sessionId: context?.sessionId,
      agentId: context?.agentId,
    };

    // Store if newly created
    if (!existingSummary) {
      this.summaries.set(traceId, summary);
    }

    // Extract name from first event's payload if not already set
    if (!summary.name && event.payload) {
      const extractedName = this.extractTraceName(event.payload, context);
      if (extractedName) {
        summary.name = extractedName;
      }
    }

    summary.eventCount++;

    if (event.type === 'error') {
      summary.errorCount++;
    }

    if (event.type === 'run.start') {
      summary.startTime = event.timestamp;
      summary.status = 'running';
      // Update hierarchy fields on run.start if not already set
      if (context?.parentTraceId && !summary.parentTraceId) {
        summary.parentTraceId = context.parentTraceId;
      }
      if (context?.rootTraceId && !summary.rootTraceId) {
        summary.rootTraceId = context.rootTraceId;
      }
      if (context?.traceDepth !== undefined && summary.traceDepth === undefined) {
        summary.traceDepth = context.traceDepth;
      }
      if (context?.sessionId && !summary.sessionId) {
        summary.sessionId = context.sessionId;
      }
      if (context?.agentId && !summary.agentId) {
        summary.agentId = context.agentId;
      }
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
   * Extracts a human-readable name from event payload
   */
  private extractTraceName(
    payload: Record<string, unknown>,
    context?: TraceContext
  ): string | undefined {
    // Priority: agentId > topic > command + prompt > command > tool > workflowId

    // Agent execution
    if (payload.agentId) {
      return `ax agent run ${payload.agentId}`;
    }

    if (context?.agentId) {
      return `ax agent run ${context.agentId}`;
    }

    // Discussion
    if (payload.topic) {
      const topic = String(payload.topic);
      const truncated = topic.length > 40 ? `${topic.slice(0, 40)}...` : topic;
      return `ax discuss "${truncated}"`;
    }

    const command = payload.command ? String(payload.command) : undefined;

    // Provider call with prompt
    if (payload.prompt) {
      const prompt = String(payload.prompt);
      const truncated = prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;
      return `${command ?? 'ax call'} "${truncated}"`;
    }

    // Explicit command
    if (command) {
      return command;
    }

    // MCP tool invocation (parallel_run, review_analyze, etc.)
    if (payload.tool) {
      const tool = String(payload.tool);
      // Format tool name nicely: parallel_run -> parallel run
      const formattedTool = tool.replace(/_/g, ' ');
      return `ax ${formattedTool}`;
    }

    // Workflow execution
    if (payload.workflowId) {
      const workflowName = payload.workflowName ? String(payload.workflowName) : String(payload.workflowId);
      return `workflow ${workflowName}`;
    }

    // Check context for workflowId
    if (context?.workflowId) {
      return `workflow ${context.workflowId}`;
    }

    return undefined;
  }

  /**
   * Gets all traces that share the same root trace ID
   * INV-TR-020: All traces in hierarchy share rootTraceId
   */
  getTracesByRoot(rootTraceId: string): Promise<TraceSummary[]> {
    const result = [...this.summaries.values()]
      .filter((summary) => {
        // Include if rootTraceId matches OR if this is the root trace itself
        return summary.rootTraceId === rootTraceId || summary.traceId === rootTraceId;
      })
      .sort((a, b) => {
        // Sort by trace depth ascending (root first), then by start time
        const depthDiff = (a.traceDepth ?? 0) - (b.traceDepth ?? 0);
        if (depthDiff !== 0) return depthDiff;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
    return Promise.resolve(result);
  }

  /**
   * Gets direct children of a trace
   * INV-TR-021: Child traces reference parentTraceId
   */
  getChildTraces(parentTraceId: string): Promise<TraceSummary[]> {
    const result = [...this.summaries.values()]
      .filter((summary) => summary.parentTraceId === parentTraceId)
      .sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    return Promise.resolve(result);
  }

  /**
   * Gets all traces in a session
   * INV-TR-023: Session trace correlation
   */
  getTracesBySession(sessionId: string): Promise<TraceSummary[]> {
    const result = [...this.summaries.values()]
      .filter((summary) => summary.sessionId === sessionId)
      .sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    return Promise.resolve(result);
  }

  /**
   * Builds a hierarchical tree from a root trace
   * Returns the complete tree structure for visualization
   */
  async getTraceTree(traceId: string): Promise<TraceTreeNode | undefined> {
    const rootSummary = this.summaries.get(traceId);
    if (!rootSummary) return undefined;

    // Determine the effective root trace ID
    const effectiveRootId = rootSummary.rootTraceId ?? traceId;

    // Get all traces in this hierarchy
    const allTraces = await this.getTracesByRoot(effectiveRootId);

    // Create a map for quick lookup
    const traceMap = new Map<string, TraceSummary>();
    for (const trace of allTraces) {
      traceMap.set(trace.traceId, trace);
    }

    // Build tree recursively
    const buildNode = (summary: TraceSummary): TraceTreeNode => {
      const children = allTraces
        .filter((t) => t.parentTraceId === summary.traceId)
        .map((childSummary) => buildNode(childSummary));

      const childDuration = children.reduce(
        (sum, child) => sum + (child.totalDurationMs ?? 0),
        0
      );
      const childEventCount = children.reduce(
        (sum, child) => sum + child.totalEventCount,
        0
      );

      return {
        trace: summary,
        children,
        totalDurationMs: (summary.durationMs ?? 0) + childDuration,
        totalEventCount: summary.eventCount + childEventCount,
      };
    };

    // Build tree starting from the requested trace
    const targetSummary = traceMap.get(traceId);
    if (!targetSummary) return undefined;

    return buildNode(targetSummary);
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

  /**
   * Closes stuck traces that have been running longer than maxAgeMs
   * Writes a run.end event marking them as failed
   * @param maxAgeMs Maximum age in milliseconds (default: 1 hour)
   * @returns number of traces that were closed
   */
  async closeStuckTraces(maxAgeMs = 3600000): Promise<number> {
    // Input validation
    if (maxAgeMs <= 0) {
      throw new Error('maxAgeMs must be a positive number');
    }

    const currentTime = Date.now();
    const cutoff = currentTime - maxAgeMs;
    let closedCount = 0;

    for (const [traceId, summary] of this.summaries) {
      // Only process traces that are stuck in running or pending status
      if (summary.status !== 'running' && summary.status !== 'pending') continue;

      const startTime = new Date(summary.startTime).getTime();
      if (startTime < cutoff) {
        // Write a run.end event to close the trace
        // Use timestamp in eventId to prevent collisions on repeated cleanup calls
        const endEvent: TraceEvent = {
          eventId: `${traceId}-auto-close-${currentTime}`,
          traceId,
          type: 'run.end',
          timestamp: new Date().toISOString(),
          payload: {
            success: false,
            error: 'Trace closed automatically - exceeded maximum running time',
            autoClose: true,
          },
          status: 'failure',
          durationMs: currentTime - startTime,
        };

        await this.write(endEvent);
        closedCount++;
      }
    }

    return closedCount;
  }
}

/**
 * Creates an in-memory trace store
 */
export function createInMemoryTraceStore(): InMemoryTraceStore {
  return new InMemoryTraceStore();
}
