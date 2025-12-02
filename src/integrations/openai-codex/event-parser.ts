/**
 * Codex Event Parser
 *
 * Parses JSONL events from Codex CLI streaming output.
 *
 * Features:
 * - Type-safe event schemas with Zod
 * - Event callbacks (on/off)
 * - Statistics tracking (tokens, errors, events)
 * - Streaming support
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';

// ========== Event Schemas ==========

const BaseEventSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional()
});

const ProgressEventSchema = BaseEventSchema.extend({
  type: z.literal('progress'),
  message: z.string(),
  percentage: z.number().min(0).max(100).optional()
});

const CompletionEventSchema = BaseEventSchema.extend({
  type: z.literal('completion'),
  content: z.string(),
  model: z.string().optional()
});

const ErrorEventSchema = BaseEventSchema.extend({
  type: z.literal('error'),
  error: z.string(),
  code: z.string().optional()
});

const TokenUsageEventSchema = BaseEventSchema.extend({
  type: z.literal('token_usage'),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative()
});

const CodexEventSchema = z.discriminatedUnion('type', [
  ProgressEventSchema,
  CompletionEventSchema,
  ErrorEventSchema,
  TokenUsageEventSchema,
  BaseEventSchema
]);

// ========== Types ==========

type CodexEvent = z.infer<typeof CodexEventSchema>;
type CodexEventCallback = (event: CodexEvent) => void;

export interface EventStatistics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  totalTokens: number;
  errors: number;
}

// ========== Parser ==========

export class CodexEventParser {
  private eventCallbacks: Map<string, CodexEventCallback[]> = new Map();
  private statistics: EventStatistics = {
    totalEvents: 0,
    eventsByType: {},
    totalTokens: 0,
    errors: 0
  };

  /**
   * Parse a single JSONL line into a Codex event
   */
  parse(line: string): CodexEvent | null {
    if (!line.trim()) {
      return null;
    }

    try {
      const raw = JSON.parse(line);
      const result = BaseEventSchema.safeParse(raw);

      if (!result.success) {
        logger.warn('Invalid Codex event format', { line, error: result.error });
        return null;
      }

      const event = result.data as CodexEvent;
      this.updateStatistics(event);
      this.emitEvent(event);

      return event;
    } catch (error) {
      logger.warn('Failed to parse Codex event', { line, error });
      return null;
    }
  }

  /**
   * Parse multiple JSONL lines
   */
  parseMultiple(lines: string[]): CodexEvent[] {
    return lines.map(line => this.parse(line)).filter((e): e is CodexEvent => e !== null);
  }

  /**
   * Register event callback
   */
  on(eventType: string, callback: CodexEventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType) || [];
    callbacks.push(callback);
    this.eventCallbacks.set(eventType, callbacks);
  }

  /**
   * Unregister event callback
   */
  off(eventType: string, callback: CodexEventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      this.eventCallbacks.set(eventType, callbacks);
    }
  }

  /**
   * Get current statistics
   */
  getStatistics(): EventStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      totalEvents: 0,
      eventsByType: {},
      totalTokens: 0,
      errors: 0
    };
  }

  /**
   * Update statistics based on event
   */
  private updateStatistics(event: CodexEvent): void {
    this.statistics.totalEvents++;

    // Count events by type
    this.statistics.eventsByType[event.type] =
      (this.statistics.eventsByType[event.type] || 0) + 1;

    // Track token usage
    if (event.type === 'token_usage' && 'inputTokens' in event && 'outputTokens' in event) {
      this.statistics.totalTokens += event.inputTokens + event.outputTokens;
    }

    // Track errors
    if (event.type === 'error') {
      this.statistics.errors++;
    }
  }

  /**
   * Emit event to registered callbacks
   */
  private emitEvent(event: CodexEvent): void {
    // Emit to type-specific callbacks
    const callbacks = this.eventCallbacks.get(event.type) || [];
    callbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        logger.error('Event callback error', { eventType: event.type, error });
      }
    });

    // Emit to wildcard callbacks
    const wildcardCallbacks = this.eventCallbacks.get('*') || [];
    wildcardCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        logger.error('Wildcard callback error', { eventType: event.type, error });
      }
    });
  }
}

// ========== Exports ==========

export type { CodexEvent, CodexEventCallback };
export { ProgressEventSchema, CompletionEventSchema, ErrorEventSchema, TokenUsageEventSchema };
