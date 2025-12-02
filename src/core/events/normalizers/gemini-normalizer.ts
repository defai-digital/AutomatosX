/**
 * Gemini Event Normalizer (v11.1.0)
 *
 * Normalizes Gemini CLI stream-json events to unified event format.
 *
 * Gemini uses similar stream-json format to Claude:
 * - { role: 'user', content: '...' }
 * - { role: 'model', content: '...' }
 * - { role: 'model', tool_calls: [...] }
 * - { role: 'tool', content: '...' }
 *
 * @module core/events/normalizers/gemini-normalizer
 * @since v11.1.0
 */

import { BaseEventNormalizer } from './base-normalizer.js';
import type { UnifiedEvent, EventSource } from '../unified-event.js';

/**
 * Gemini stream-json event structure
 */
interface GeminiStreamEvent {
  role?: 'user' | 'model' | 'tool';
  content?: string;
  parts?: Array<{
    text?: string;
    functionCall?: {
      name?: string;
      args?: Record<string, unknown>;
    };
    functionResponse?: {
      name?: string;
      response?: unknown;
    };
  }>;
  tool_calls?: Array<{
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export class GeminiEventNormalizer extends BaseEventNormalizer {
  source: EventSource = 'gemini';

  private tokenCount = 0;
  private startTime = Date.now();

  canHandle(rawEvent: unknown): boolean {
    if (typeof rawEvent !== 'object' || rawEvent === null) {
      return false;
    }

    const event = rawEvent as Record<string, unknown>;

    // Gemini events have 'role' property with 'model' instead of 'assistant'
    // or have 'parts' array (Gemini native format)
    if ('role' in event) {
      return ['user', 'model', 'assistant', 'tool'].includes(event.role as string);
    }

    if ('parts' in event && Array.isArray(event.parts)) {
      return true;
    }

    return false;
  }

  normalize(rawEvent: unknown, correlationId?: string): UnifiedEvent | null {
    if (!this.canHandle(rawEvent)) {
      return null;
    }

    const event = rawEvent as GeminiStreamEvent;

    // Handle 'model' role as 'assistant'
    const role = event.role === 'model' ? 'assistant' : event.role;

    switch (role) {
      case 'user':
        return this.normalizeUserMessage(event, correlationId);
      case 'assistant':
        return this.normalizeModelMessage(event, correlationId);
      case 'tool':
        return this.normalizeToolResult(event, correlationId);
      default:
        // Handle parts-based format
        if (event.parts) {
          return this.normalizePartsMessage(event, correlationId);
        }
        return null;
    }
  }

  /**
   * Normalize user message (task started)
   */
  private normalizeUserMessage(event: GeminiStreamEvent, correlationId?: string): UnifiedEvent {
    this.startTime = Date.now();
    this.tokenCount = 0;

    const content = event.content || this.extractTextFromParts(event.parts);

    return this.createEvent('execution.started', {
      agent: 'gemini',
      task: content?.substring(0, 200) || 'Unknown task',
      provider: 'gemini',
      model: 'gemini-pro'
    }, correlationId);
  }

  /**
   * Normalize model message (response or function call)
   */
  private normalizeModelMessage(event: GeminiStreamEvent, correlationId?: string): UnifiedEvent | null {
    // Check for function calls in parts format
    if (event.parts) {
      const functionCall = event.parts.find(p => p.functionCall);
      if (functionCall?.functionCall) {
        return this.createEvent('tool.called', {
          tool: functionCall.functionCall.name || 'unknown',
          arguments: functionCall.functionCall.args || {},
          caller: 'gemini'
        }, correlationId);
      }
    }

    // Check for tool_calls (Claude-compatible format)
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
          caller: 'gemini'
        }, correlationId);
      }
    }

    // Content response (token event)
    const content = event.content || this.extractTextFromParts(event.parts);
    if (content) {
      // Estimate tokens (1 token ≈ 4 chars)
      const newTokens = Math.ceil(content.length / 4);
      this.tokenCount += newTokens;

      const elapsed = Date.now() - this.startTime;
      const throughput = elapsed > 0 ? (this.tokenCount / elapsed) * 1000 : 0;

      return this.createEvent('execution.token', {
        agent: 'gemini',
        token: content,
        tokensReceived: this.tokenCount,
        throughput: Math.round(throughput)
      }, correlationId);
    }

    return null;
  }

  /**
   * Normalize parts-based message (Gemini native format)
   */
  private normalizePartsMessage(event: GeminiStreamEvent, correlationId?: string): UnifiedEvent | null {
    if (!event.parts || event.parts.length === 0) {
      return null;
    }

    // Check for function call
    const functionCall = event.parts.find(p => p.functionCall);
    if (functionCall?.functionCall) {
      return this.createEvent('tool.called', {
        tool: functionCall.functionCall.name || 'unknown',
        arguments: functionCall.functionCall.args || {},
        caller: 'gemini'
      }, correlationId);
    }

    // Check for function response
    const functionResponse = event.parts.find(p => p.functionResponse);
    if (functionResponse?.functionResponse) {
      return this.createEvent('tool.result', {
        tool: functionResponse.functionResponse.name || 'unknown',
        result: functionResponse.functionResponse.response,
        latencyMs: 0,
        success: true
      }, correlationId);
    }

    // Text content
    const text = this.extractTextFromParts(event.parts);
    if (text) {
      const newTokens = Math.ceil(text.length / 4);
      this.tokenCount += newTokens;

      const elapsed = Date.now() - this.startTime;
      const throughput = elapsed > 0 ? (this.tokenCount / elapsed) * 1000 : 0;

      return this.createEvent('execution.token', {
        agent: 'gemini',
        token: text,
        tokensReceived: this.tokenCount,
        throughput: Math.round(throughput)
      }, correlationId);
    }

    return null;
  }

  /**
   * Normalize tool result
   */
  private normalizeToolResult(event: GeminiStreamEvent, correlationId?: string): UnifiedEvent {
    return this.createEvent('tool.result', {
      tool: 'unknown',
      result: event.content || this.extractTextFromParts(event.parts),
      latencyMs: 0,
      success: true
    }, correlationId);
  }

  /**
   * Extract text from parts array
   */
  private extractTextFromParts(parts?: GeminiStreamEvent['parts']): string | undefined {
    if (!parts) return undefined;
    return parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('');
  }

  /**
   * Create completion event from accumulated data
   */
  createCompletionEvent(content: string, correlationId?: string): UnifiedEvent {
    const latencyMs = Date.now() - this.startTime;

    return this.createEvent('execution.completed', {
      agent: 'gemini',
      content,
      tokens: {
        prompt: 0,
        completion: this.tokenCount,
        total: this.tokenCount
      },
      latencyMs,
      provider: 'gemini',
      model: 'gemini-pro'
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
