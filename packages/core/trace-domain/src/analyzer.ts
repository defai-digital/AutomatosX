import {
  isTraceComplete,
  getOrderedEvents,
  type TraceEvent,
  type Trace,
  type TraceStatus,
} from '@automatosx/contracts';
import type { TraceReader } from './types.js';

/**
 * Analysis result for a trace
 */
export interface TraceAnalysis {
  traceId: string;
  isComplete: boolean;
  status: TraceStatus;
  eventCount: number;
  errorCount: number;
  totalDurationMs: number;
  stepDurations: Map<string, number>;
  routingDecisions: RoutingDecisionInfo[];
  errors: ErrorInfo[];
  timeline: TimelineEntry[];
}

/**
 * Routing decision info
 */
export interface RoutingDecisionInfo {
  eventId: string;
  timestamp: string;
  selectedModel: string;
  provider: string;
  reasoning: string;
}

/**
 * Error info
 */
export interface ErrorInfo {
  eventId: string;
  timestamp: string;
  code: string;
  message: string;
  context?: Record<string, unknown> | undefined;
}

/**
 * Timeline entry
 */
export interface TimelineEntry {
  eventId: string;
  type: string;
  timestamp: string;
  durationMs?: number | undefined;
  status?: TraceStatus | undefined;
  depth: number;
}

/**
 * Trace analyzer for understanding execution traces
 * INV-TR-003: Supports full decision replay
 */
export class TraceAnalyzer {
  constructor(private readonly reader: TraceReader) {}

  /**
   * Analyzes a trace
   * INV-TR-001: Checks for complete event chain
   */
  async analyze(traceId: string): Promise<TraceAnalysis> {
    const events = await this.reader.getTrace(traceId);
    const orderedEvents = getOrderedEvents(events);

    // INV-TR-001: Check completeness
    const isComplete = isTraceComplete(events);

    // Extract routing decisions (INV-TR-003)
    const routingDecisions = this.extractRoutingDecisions(orderedEvents);

    // Extract errors (INV-TR-005)
    const errors = this.extractErrors(orderedEvents);

    // Build timeline
    const timeline = this.buildTimeline(orderedEvents);

    // Calculate step durations
    const stepDurations = this.calculateStepDurations(orderedEvents);

    // Determine status
    const status = this.determineStatus(orderedEvents, isComplete);

    // Calculate total duration
    const totalDurationMs = this.calculateTotalDuration(orderedEvents);

    return {
      traceId,
      isComplete,
      status,
      eventCount: events.length,
      errorCount: errors.length,
      totalDurationMs,
      stepDurations,
      routingDecisions,
      errors,
      timeline,
    };
  }

  /**
   * Gets a complete trace object
   */
  async getFullTrace(traceId: string): Promise<Trace> {
    const events = await this.reader.getTrace(traceId);
    const orderedEvents = getOrderedEvents(events);
    const status = this.determineStatus(orderedEvents, isTraceComplete(events));

    const startEvent = orderedEvents.find((e) => e.type === 'run.start');
    const endEvent = orderedEvents.find((e) => e.type === 'run.end');

    return {
      traceId,
      startTime: startEvent?.timestamp ?? new Date().toISOString(),
      endTime: endEvent?.timestamp,
      events: orderedEvents,
      status,
      summary: {
        totalDurationMs: this.calculateTotalDuration(orderedEvents),
        eventCount: events.length,
        errorCount: events.filter((e) => e.type === 'error').length,
      },
    };
  }

  /**
   * Replays routing decisions from a trace
   * INV-TR-003: Full decision replay
   */
  async replayRoutingDecisions(
    traceId: string
  ): Promise<RoutingDecisionInfo[]> {
    const analysis = await this.analyze(traceId);
    return analysis.routingDecisions;
  }

  /**
   * Extracts routing decisions from events
   */
  private extractRoutingDecisions(events: TraceEvent[]): RoutingDecisionInfo[] {
    return events
      .filter((e) => e.type === 'decision.routing')
      .map((e) => {
        const payload = e.payload as {
          selectedModel?: string;
          provider?: string;
          reasoning?: string;
        };
        return {
          eventId: e.eventId,
          timestamp: e.timestamp,
          selectedModel: payload.selectedModel ?? 'unknown',
          provider: payload.provider ?? 'unknown',
          reasoning: payload.reasoning ?? '',
        };
      });
  }

  /**
   * Extracts errors from events
   */
  private extractErrors(events: TraceEvent[]): ErrorInfo[] {
    return events
      .filter((e) => e.type === 'error')
      .map((e) => {
        const payload = e.payload as {
          code?: string;
          message?: string;
          context?: Record<string, unknown>;
        };
        return {
          eventId: e.eventId,
          timestamp: e.timestamp,
          code: payload.code ?? 'UNKNOWN_ERROR',
          message: payload.message ?? 'Unknown error',
          context: payload.context,
        };
      });
  }

  /**
   * Builds a timeline from events
   */
  private buildTimeline(events: TraceEvent[]): TimelineEntry[] {
    const depthMap = new Map<string, number>();

    return events.map((e) => {
      // Calculate depth based on parent
      let depth = 0;
      if (e.parentEventId !== undefined) {
        const parentDepth = depthMap.get(e.parentEventId) ?? 0;
        depth = parentDepth + 1;
      }
      depthMap.set(e.eventId, depth);

      return {
        eventId: e.eventId,
        type: e.type,
        timestamp: e.timestamp,
        durationMs: e.durationMs,
        status: e.status,
        depth,
      };
    });
  }

  /**
   * Calculates step durations
   */
  private calculateStepDurations(events: TraceEvent[]): Map<string, number> {
    const durations = new Map<string, number>();

    for (const event of events) {
      if (event.type === 'step.execute' && event.durationMs !== undefined) {
        const payload = event.payload as { stepId?: string };
        if (payload.stepId !== undefined) {
          durations.set(payload.stepId, event.durationMs);
        }
      }
    }

    return durations;
  }

  /**
   * Determines trace status
   */
  private determineStatus(
    events: TraceEvent[],
    isComplete: boolean
  ): TraceStatus {
    if (!isComplete) {
      return 'running';
    }

    const endEvent = events.find((e) => e.type === 'run.end');
    if (endEvent !== undefined) {
      const payload = endEvent.payload as { success?: boolean };
      return payload.success === true ? 'success' : 'failure';
    }

    // Check for any errors
    const hasErrors = events.some((e) => e.type === 'error');
    return hasErrors ? 'failure' : 'success';
  }

  /**
   * Calculates total duration
   */
  private calculateTotalDuration(events: TraceEvent[]): number {
    const endEvent = events.find((e) => e.type === 'run.end');
    if (endEvent?.durationMs !== undefined) {
      return endEvent.durationMs;
    }

    // Calculate from timestamps
    const startEvent = events.find((e) => e.type === 'run.start');
    if (startEvent === undefined) {
      return 0;
    }

    const lastEvent = events[events.length - 1];
    if (lastEvent === undefined) {
      return 0;
    }

    return (
      new Date(lastEvent.timestamp).getTime() -
      new Date(startEvent.timestamp).getTime()
    );
  }
}

/**
 * Creates a trace analyzer
 */
export function createTraceAnalyzer(reader: TraceReader): TraceAnalyzer {
  return new TraceAnalyzer(reader);
}
