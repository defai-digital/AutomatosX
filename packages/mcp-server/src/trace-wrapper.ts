/**
 * MCP Tool Trace Wrapper
 *
 * Wraps tool handlers with tracing for observability.
 *
 * Invariants:
 * - INV-MCP-007: Every tool call produces exactly one trace
 * - INV-MCP-008: Trace includes input/output/duration/success
 */

import type { ToolHandler, MCPToolResult } from './types.js';
import { createToolTraceEvent, type ToolTraceEvent } from '@automatosx/contracts';

// ============================================================================
// Trace Event Collector
// ============================================================================

/**
 * Collects trace events for analysis and persistence
 */
export interface TraceCollector {
  /**
   * Records a tool trace event
   */
  record(event: ToolTraceEvent): void;

  /**
   * Gets all recorded events
   */
  getEvents(): ToolTraceEvent[];

  /**
   * Clears recorded events
   */
  clear(): void;
}

/**
 * In-memory trace collector implementation
 */
export class InMemoryTraceCollector implements TraceCollector {
  private events: ToolTraceEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  record(event: ToolTraceEvent): void {
    this.events.push(event);
    // Trim old events if over limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getEvents(): ToolTraceEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  /**
   * Gets summary statistics
   */
  getSummary(): {
    totalInvocations: number;
    successCount: number;
    failureCount: number;
    avgDurationMs: number;
    byTool: Record<string, number>;
  } {
    const byTool: Record<string, number> = {};
    let totalDuration = 0;
    let successCount = 0;

    for (const event of this.events) {
      byTool[event.toolName] = (byTool[event.toolName] ?? 0) + 1;
      totalDuration += event.durationMs;
      if (event.success) {
        successCount++;
      }
    }

    return {
      totalInvocations: this.events.length,
      successCount,
      failureCount: this.events.length - successCount,
      avgDurationMs: this.events.length > 0 ? totalDuration / this.events.length : 0,
      byTool,
    };
  }
}

// ============================================================================
// Global Trace Collector
// ============================================================================

/**
 * Global trace collector instance
 */
let globalCollector: TraceCollector | undefined;

/**
 * Sets the global trace collector
 */
export function setTraceCollector(collector: TraceCollector): void {
  globalCollector = collector;
}

/**
 * Gets the global trace collector
 */
export function getTraceCollector(): TraceCollector | undefined {
  return globalCollector;
}

// ============================================================================
// Trace Wrapper Functions
// ============================================================================

/**
 * Wraps a single tool handler with tracing
 *
 * INV-MCP-007: Every tool call produces exactly one trace event
 * INV-MCP-008: Trace includes input/output/duration/success
 */
export function withTracing(
  toolName: string,
  handler: ToolHandler,
  collector?: TraceCollector
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const startTime = Date.now();
    const effectiveCollector = collector ?? globalCollector;

    try {
      // Execute the handler
      const result = await handler(args);
      const durationMs = Date.now() - startTime;

      // INV-MCP-007: Record trace event
      if (effectiveCollector !== undefined) {
        const firstContent = result.content.length > 0 ? result.content[0] : undefined;
        const traceEvent = createToolTraceEvent(
          toolName,
          args,
          durationMs,
          !result.isError,
          {
            output: firstContent?.text,
          }
        );
        effectiveCollector.record(traceEvent);
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      // INV-MCP-007: Record trace event even on error
      if (effectiveCollector !== undefined) {
        const traceEvent = createToolTraceEvent(
          toolName,
          args,
          durationMs,
          false,
          {
            errorCode: 'TOOL_ERROR',
            errorMessage: message,
          }
        );
        effectiveCollector.record(traceEvent);
      }

      // Re-throw to let the server handle it
      throw error;
    }
  };
}

/**
 * Wraps all handlers in a registry with tracing
 */
export function wrapHandlersWithTracing(
  handlers: Record<string, ToolHandler>,
  collector?: TraceCollector
): Record<string, ToolHandler> {
  const wrapped: Record<string, ToolHandler> = {};

  for (const [name, handler] of Object.entries(handlers)) {
    wrapped[name] = withTracing(name, handler, collector);
  }

  return wrapped;
}

// ============================================================================
// Default Initialization
// ============================================================================

/**
 * Initializes default trace collector if not already set
 */
export function initializeDefaultTracing(): InMemoryTraceCollector {
  if (globalCollector === undefined) {
    globalCollector = new InMemoryTraceCollector();
  }
  return globalCollector as InMemoryTraceCollector;
}
