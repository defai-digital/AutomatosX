/**
 * Codex Event Normalizer (v11.1.0)
 *
 * Normalizes Codex CLI JSONL events to unified event format.
 *
 * Codex JSONL format:
 * - { type: 'progress', message: '...', percentage: N }
 * - { type: 'completion', content: '...', model: '...' }
 * - { type: 'error', error: '...', code: '...' }
 * - { type: 'token_usage', inputTokens: N, outputTokens: N }
 *
 * @module core/events/normalizers/codex-normalizer
 * @since v11.1.0
 */

import { BaseEventNormalizer } from './base-normalizer.js';
import type { UnifiedEvent, EventSource } from '../unified-event.js';

/**
 * Codex JSONL event types
 */
type CodexEventType = 'progress' | 'completion' | 'error' | 'token_usage' | 'start' | 'tool_call' | 'tool_result';

interface CodexEvent {
  type: CodexEventType;
  timestamp?: string;
  // Progress event
  message?: string;
  percentage?: number;
  // Completion event
  content?: string;
  model?: string;
  // Error event
  error?: string;
  code?: string;
  // Token usage event
  inputTokens?: number;
  outputTokens?: number;
  // Tool events
  tool?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  success?: boolean;
  latencyMs?: number;
}

export class CodexEventNormalizer extends BaseEventNormalizer {
  source: EventSource = 'codex';

  private tokenCount = 0;
  private startTime = Date.now();
  private lastModel = 'gpt-4';

  canHandle(rawEvent: unknown): boolean {
    if (typeof rawEvent !== 'object' || rawEvent === null) {
      return false;
    }

    const event = rawEvent as Record<string, unknown>;

    // Codex events have 'type' property with specific values
    if ('type' in event && typeof event.type === 'string') {
      return [
        'progress', 'completion', 'error', 'token_usage',
        'start', 'tool_call', 'tool_result'
      ].includes(event.type);
    }

    return false;
  }

  normalize(rawEvent: unknown, correlationId?: string): UnifiedEvent | null {
    if (!this.canHandle(rawEvent)) {
      return null;
    }

    const event = rawEvent as CodexEvent;

    switch (event.type) {
      case 'start':
        return this.normalizeStartEvent(event, correlationId);
      case 'progress':
        return this.normalizeProgressEvent(event, correlationId);
      case 'completion':
        return this.normalizeCompletionEvent(event, correlationId);
      case 'error':
        return this.normalizeErrorEvent(event, correlationId);
      case 'token_usage':
        return this.normalizeTokenUsageEvent(event, correlationId);
      case 'tool_call':
        return this.normalizeToolCallEvent(event, correlationId);
      case 'tool_result':
        return this.normalizeToolResultEvent(event, correlationId);
      default:
        return null;
    }
  }

  /**
   * Normalize start event
   */
  private normalizeStartEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    this.startTime = Date.now();
    this.tokenCount = 0;
    if (event.model) {
      this.lastModel = event.model;
    }

    return this.createEvent('execution.started', {
      agent: 'codex',
      task: event.message || 'Codex execution',
      provider: 'codex',
      model: event.model || this.lastModel
    }, correlationId);
  }

  /**
   * Normalize progress event
   */
  private normalizeProgressEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    return this.createEvent('execution.progress', {
      agent: 'codex',
      progress: event.percentage ?? 0,
      message: event.message,
      stage: 'processing'
    }, correlationId);
  }

  /**
   * Normalize completion event
   */
  private normalizeCompletionEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    const latencyMs = Date.now() - this.startTime;
    if (event.model) {
      this.lastModel = event.model;
    }

    return this.createEvent('execution.completed', {
      agent: 'codex',
      content: event.content || '',
      tokens: {
        prompt: 0,
        completion: this.tokenCount,
        total: this.tokenCount
      },
      latencyMs,
      provider: 'codex',
      model: event.model || this.lastModel
    }, correlationId);
  }

  /**
   * Normalize error event
   */
  private normalizeErrorEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    return this.createEvent('execution.error', {
      agent: 'codex',
      error: event.error || 'Unknown error',
      code: event.code,
      retryable: this.isRetryableError(event.code),
      provider: 'codex'
    }, correlationId);
  }

  /**
   * Normalize token usage event
   */
  private normalizeTokenUsageEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    const inputTokens = event.inputTokens ?? 0;
    const outputTokens = event.outputTokens ?? 0;
    this.tokenCount = inputTokens + outputTokens;

    const elapsed = Date.now() - this.startTime;
    const throughput = elapsed > 0 ? (outputTokens / elapsed) * 1000 : 0;

    return this.createEvent('execution.progress', {
      agent: 'codex',
      progress: 100, // Token usage usually comes at the end
      message: `Tokens: ${inputTokens} input, ${outputTokens} output`,
      tokensUsed: this.tokenCount,
      estimatedTotal: this.tokenCount
    }, correlationId);
  }

  /**
   * Normalize tool call event
   */
  private normalizeToolCallEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    return this.createEvent('tool.called', {
      tool: event.tool || 'unknown',
      arguments: event.arguments || {},
      caller: 'codex'
    }, correlationId);
  }

  /**
   * Normalize tool result event
   */
  private normalizeToolResultEvent(event: CodexEvent, correlationId?: string): UnifiedEvent {
    return this.createEvent('tool.result', {
      tool: event.tool || 'unknown',
      result: event.result,
      latencyMs: event.latencyMs ?? 0,
      success: event.success ?? true
    }, correlationId);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(code?: string): boolean {
    if (!code) return false;
    return ['RATE_LIMIT', 'TIMEOUT', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'].includes(code);
  }

  /**
   * Reset state for new execution
   */
  reset(): void {
    this.tokenCount = 0;
    this.startTime = Date.now();
  }
}
