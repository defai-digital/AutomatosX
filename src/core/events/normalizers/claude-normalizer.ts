/**
 * Claude Event Normalizer (v11.1.0)
 *
 * Normalizes Claude CLI stream-json events to unified event format.
 *
 * Claude stream-json format:
 * - { role: 'user', content: '...' }
 * - { role: 'assistant', content: '...' }
 * - { role: 'assistant', tool_calls: [...] }
 * - { role: 'tool', content: '...' }
 *
 * @module core/events/normalizers/claude-normalizer
 * @since v11.1.0
 */

import { BaseEventNormalizer } from './base-normalizer.js';
import type { UnifiedEvent, EventSource } from '../unified-event.js';

/**
 * Claude stream-json event structure
 */
interface ClaudeStreamEvent {
  role?: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export class ClaudeEventNormalizer extends BaseEventNormalizer {
  source: EventSource = 'claude';

  private tokenCount = 0;
  private startTime = Date.now();

  canHandle(rawEvent: unknown): boolean {
    if (typeof rawEvent !== 'object' || rawEvent === null) {
      return false;
    }

    // Claude events have 'role' property
    const event = rawEvent as Record<string, unknown>;
    return 'role' in event && ['user', 'assistant', 'tool'].includes(event.role as string);
  }

  normalize(rawEvent: unknown, correlationId?: string): UnifiedEvent | null {
    if (!this.canHandle(rawEvent)) {
      return null;
    }

    const event = rawEvent as ClaudeStreamEvent;

    switch (event.role) {
      case 'user':
        return this.normalizeUserMessage(event, correlationId);
      case 'assistant':
        return this.normalizeAssistantMessage(event, correlationId);
      case 'tool':
        return this.normalizeToolResult(event, correlationId);
      default:
        return null;
    }
  }

  /**
   * Normalize user message (task started)
   */
  private normalizeUserMessage(event: ClaudeStreamEvent, correlationId?: string): UnifiedEvent {
    this.startTime = Date.now();
    this.tokenCount = 0;

    return this.createEvent('execution.started', {
      agent: 'claude',
      task: event.content?.substring(0, 200) || 'Unknown task',
      provider: 'claude',
      model: 'claude-3'
    }, correlationId);
  }

  /**
   * Normalize assistant message (response or tool call)
   */
  private normalizeAssistantMessage(event: ClaudeStreamEvent, correlationId?: string): UnifiedEvent | null {
    // Check for tool calls
    if (event.tool_calls && event.tool_calls.length > 0) {
      const toolCall = event.tool_calls[0];
      if (toolCall) {
        let args: Record<string, unknown> = {};

        try {
          if (toolCall.function?.arguments) {
            args = JSON.parse(toolCall.function.arguments);
          }
        } catch {
          // Keep empty args if parsing fails
        }

        return this.createEvent('tool.called', {
          tool: toolCall.function?.name || 'unknown',
          arguments: args,
          caller: 'claude'
        }, correlationId);
      }
    }

    // Content response (token event)
    if (event.content) {
      // Estimate tokens (1 token ≈ 4 chars)
      const newTokens = Math.ceil(event.content.length / 4);
      this.tokenCount += newTokens;

      const elapsed = Date.now() - this.startTime;
      const throughput = elapsed > 0 ? (this.tokenCount / elapsed) * 1000 : 0;

      return this.createEvent('execution.token', {
        agent: 'claude',
        token: event.content,
        tokensReceived: this.tokenCount,
        throughput: Math.round(throughput)
      }, correlationId);
    }

    return null;
  }

  /**
   * Normalize tool result
   */
  private normalizeToolResult(event: ClaudeStreamEvent, correlationId?: string): UnifiedEvent {
    return this.createEvent('tool.result', {
      tool: event.name || 'unknown',
      result: event.content,
      latencyMs: 0, // Not tracked in stream-json
      success: true
    }, correlationId);
  }

  /**
   * Create completion event from accumulated data
   */
  createCompletionEvent(content: string, correlationId?: string): UnifiedEvent {
    const latencyMs = Date.now() - this.startTime;

    return this.createEvent('execution.completed', {
      agent: 'claude',
      content,
      tokens: {
        prompt: 0, // Not available in stream-json
        completion: this.tokenCount,
        total: this.tokenCount
      },
      latencyMs,
      provider: 'claude',
      model: 'claude-3'
    }, correlationId);
  }

  /**
   * Reset state for new execution
   */
  reset(): void {
    this.tokenCount = 0;
    this.startTime = Date.now();
  }
}
