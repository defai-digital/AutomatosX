/**
 * ax-cli Event Normalizer (v11.1.0)
 *
 * Normalizes ax-cli SDK events to unified event format.
 *
 * ax-cli SDK v1.3.0 event types:
 * - execution.started, execution.progress, execution.completed
 * - tool.called, tool.progress, tool.result
 * - agent events
 *
 * @module core/events/normalizers/ax-cli-normalizer
 * @since v11.1.0
 */

import { BaseEventNormalizer } from './base-normalizer.js';
import type { UnifiedEvent, EventSource } from '../unified-event.js';

/**
 * ax-cli SDK event structure (based on TypedEventMap from SDK v1.3.0)
 */
interface AxCliEvent {
  type: string;
  timestamp?: number;
  // Execution events
  agent?: string;
  task?: string;
  provider?: string;
  model?: string;
  content?: string;
  progress?: number;
  message?: string;
  stage?: string;
  // Token events
  token?: string;
  tokensReceived?: number;
  throughput?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  latencyMs?: number;
  // Tool events
  tool?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  success?: boolean;
  caller?: string;
  // Error events
  error?: string | Error;
  code?: string;
  retryable?: boolean;
  // Agent events
  fromAgent?: string;
  toAgent?: string;
  reason?: string;
  score?: number;
  confidence?: string;
  alternatives?: string[];
  autoSelected?: boolean;
}

export class AxCliEventNormalizer extends BaseEventNormalizer {
  source: EventSource = 'ax-cli';

  private tokenCount = 0;
  private startTime = Date.now();

  canHandle(rawEvent: unknown): boolean {
    if (typeof rawEvent !== 'object' || rawEvent === null) {
      return false;
    }

    const event = rawEvent as Record<string, unknown>;

    // ax-cli events have 'type' property that matches UnifiedEventType pattern
    if ('type' in event && typeof event.type === 'string') {
      // Check if it looks like an ax-cli event type
      const validPatterns = [
        'execution.', 'tool.', 'agent.', 'memory.', 'session.',
        // Legacy ax-cli event types
        'start', 'progress', 'complete', 'error', 'token'
      ];
      return validPatterns.some(pattern =>
        (event.type as string).includes(pattern) ||
        (event.type as string) === pattern.replace('.', '')
      );
    }

    return false;
  }

  normalize(rawEvent: unknown, correlationId?: string): UnifiedEvent | null {
    if (!this.canHandle(rawEvent)) {
      return null;
    }

    const event = rawEvent as AxCliEvent;

    // If event already matches unified format, pass through with minor normalization
    if (this.isUnifiedFormat(event.type)) {
      return this.normalizeUnifiedEvent(event, correlationId);
    }

    // Handle legacy ax-cli event types
    return this.normalizeLegacyEvent(event, correlationId);
  }

  /**
   * Check if event type matches unified format
   */
  private isUnifiedFormat(type: string): boolean {
    const unifiedTypes = [
      'execution.started', 'execution.progress', 'execution.token',
      'execution.completed', 'execution.error', 'execution.cancelled',
      'tool.called', 'tool.progress', 'tool.result', 'tool.error',
      'agent.selected', 'agent.delegated', 'agent.context_loaded',
      'memory.searched', 'memory.added',
      'session.created', 'session.updated', 'session.completed'
    ];
    return unifiedTypes.includes(type);
  }

  /**
   * Normalize events that already match unified format
   */
  private normalizeUnifiedEvent(event: AxCliEvent, correlationId?: string): UnifiedEvent {
    // Build payload based on event type
    const payload = this.buildPayload(event);

    return this.createEvent(
      event.type as any,
      payload,
      correlationId
    );
  }

  /**
   * Normalize legacy ax-cli event types
   */
  private normalizeLegacyEvent(event: AxCliEvent, correlationId?: string): UnifiedEvent | null {
    const type = event.type.toLowerCase();

    if (type === 'start' || type.includes('start')) {
      this.startTime = Date.now();
      this.tokenCount = 0;
      return this.createEvent('execution.started', {
        agent: event.agent || 'ax-cli',
        task: event.task || event.message || 'Unknown task',
        provider: event.provider || 'ax-cli',
        model: event.model
      }, correlationId);
    }

    if (type === 'progress') {
      return this.createEvent('execution.progress', {
        agent: event.agent || 'ax-cli',
        progress: event.progress ?? 0,
        message: event.message,
        stage: event.stage
      }, correlationId);
    }

    if (type === 'token') {
      this.tokenCount += 1;
      return this.createEvent('execution.token', {
        agent: event.agent || 'ax-cli',
        token: event.token || event.content || '',
        tokensReceived: event.tokensReceived ?? this.tokenCount,
        throughput: event.throughput
      }, correlationId);
    }

    if (type === 'complete' || type.includes('complete')) {
      const latencyMs = Date.now() - this.startTime;
      return this.createEvent('execution.completed', {
        agent: event.agent || 'ax-cli',
        content: event.content || '',
        tokens: event.tokens || {
          prompt: 0,
          completion: this.tokenCount,
          total: this.tokenCount
        },
        latencyMs: event.latencyMs ?? latencyMs,
        provider: event.provider || 'ax-cli',
        model: event.model
      }, correlationId);
    }

    if (type === 'error') {
      const errorMessage = typeof event.error === 'string'
        ? event.error
        : event.error?.message || 'Unknown error';

      return this.createEvent('execution.error', {
        agent: event.agent || 'ax-cli',
        error: errorMessage,
        code: event.code,
        retryable: event.retryable ?? false,
        provider: event.provider || 'ax-cli'
      }, correlationId);
    }

    return null;
  }

  /**
   * Build payload from event data
   */
  private buildPayload(event: AxCliEvent): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    // Copy relevant fields based on event type
    const copyFields = [
      'agent', 'task', 'provider', 'model', 'content',
      'progress', 'message', 'stage', 'token', 'tokensReceived',
      'throughput', 'tokens', 'latencyMs', 'tool', 'arguments',
      'result', 'success', 'caller', 'error', 'code', 'retryable',
      'fromAgent', 'toAgent', 'reason', 'score', 'confidence',
      'alternatives', 'autoSelected'
    ];

    for (const field of copyFields) {
      if (field in event && event[field as keyof AxCliEvent] !== undefined) {
        payload[field] = event[field as keyof AxCliEvent];
      }
    }

    // Ensure required fields have defaults
    if (!payload.agent) payload.agent = 'ax-cli';

    return payload;
  }

  /**
   * Reset state for new execution
   */
  reset(): void {
    this.tokenCount = 0;
    this.startTime = Date.now();
  }
}
