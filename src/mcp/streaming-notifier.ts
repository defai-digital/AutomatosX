/**
 * MCP Streaming Notifier (v11.1.0)
 *
 * Sends real-time progress notifications to MCP clients during tool execution.
 * Uses JSON-RPC notifications (no id field, no response expected).
 *
 * Features:
 * - Connects to EventBridge for unified events
 * - Throttles high-frequency events (tokens, progress)
 * - Content-Length framed stdio output
 * - Configurable notification types
 *
 * MCP Notification Format:
 * {"jsonrpc": "2.0", "method": "notifications/progress", "params": {...}}
 *
 * @module mcp/streaming-notifier
 * @since v11.1.0
 */

import { logger } from '../utils/logger.js';
import { getGlobalEventBridge, EventBridge } from '../core/events/event-bridge.js';
import type { UnifiedEvent, UnifiedEventType } from '../core/events/unified-event.js';

// ============================================
// Types
// ============================================

/**
 * MCP notification structure (JSON-RPC 2.0 notification)
 */
interface McpNotification {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
}

/**
 * Progress notification params
 */
interface ProgressNotificationParams {
  /** Progress token for tracking */
  progressToken: string;
  /** Current value (0-100 for percentage, or token count) */
  value: number | ProgressValue;
}

interface ProgressValue {
  kind: 'report' | 'begin' | 'end';
  title?: string;
  message?: string;
  percentage?: number;
  cancellable?: boolean;
}

/**
 * Streaming notifier options
 */
export interface StreamingNotifierOptions {
  /** Enable streaming notifications (default: true) */
  enabled?: boolean;
  /** Throttle interval for high-frequency events (ms, default: 100) */
  throttleMs?: number;
  /** Event types to notify (default: all progress types) */
  eventTypes?: UnifiedEventType[];
  /** Custom event bridge (default: global) */
  eventBridge?: EventBridge;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_OPTIONS: Required<StreamingNotifierOptions> = {
  enabled: true,
  throttleMs: 100,
  eventTypes: [
    'execution.started',
    'execution.progress',
    'execution.completed',
    'execution.error',
    'tool.called',
    'tool.progress',
    'tool.result',
    'agent.selected',
    'agent.delegated'
  ],
  eventBridge: undefined as unknown as EventBridge, // Will use global
  debug: false
};

// ============================================
// MCP Streaming Notifier
// ============================================

export class McpStreamingNotifier {
  private options: Required<StreamingNotifierOptions>;
  private eventBridge: EventBridge;
  private unsubscribe: (() => void) | null = null;
  private isActive = false;
  private activeProgressTokens = new Map<string, string>(); // correlationId -> progressToken
  private lastNotificationTime = new Map<string, number>(); // type -> timestamp

  constructor(options: StreamingNotifierOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    this.eventBridge = options.eventBridge || getGlobalEventBridge();

    if (this.options.debug) {
      logger.debug('[MCP Streaming] Notifier initialized', {
        enabled: this.options.enabled,
        throttleMs: this.options.throttleMs,
        eventTypes: this.options.eventTypes
      });
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Start listening for events and sending notifications
   */
  start(): void {
    if (!this.options.enabled || this.isActive) {
      return;
    }

    this.isActive = true;

    // Subscribe to all event types we care about
    this.unsubscribe = this.eventBridge.subscribe('*', (event) => {
      if (this.shouldNotify(event)) {
        this.handleEvent(event);
      }
    });

    if (this.options.debug) {
      logger.debug('[MCP Streaming] Started listening for events');
    }
  }

  /**
   * Stop listening for events
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // End all active progress
    for (const [correlationId, progressToken] of this.activeProgressTokens) {
      this.sendProgressEnd(progressToken, 'Operation stopped');
    }
    this.activeProgressTokens.clear();

    this.isActive = false;

    if (this.options.debug) {
      logger.debug('[MCP Streaming] Stopped');
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Check if we should notify for this event
   */
  private shouldNotify(event: UnifiedEvent): boolean {
    // Check if event type is in our list
    if (!this.options.eventTypes.includes(event.type)) {
      return false;
    }

    // Check throttling for high-frequency events
    if (this.isThrottled(event.type)) {
      return false;
    }

    return true;
  }

  /**
   * Check if event type is currently throttled
   */
  private isThrottled(type: UnifiedEventType): boolean {
    const throttledTypes: UnifiedEventType[] = ['execution.token', 'execution.progress', 'tool.progress'];

    if (!throttledTypes.includes(type)) {
      return false;
    }

    const lastTime = this.lastNotificationTime.get(type) ?? 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed < this.options.throttleMs) {
      return true;
    }

    this.lastNotificationTime.set(type, Date.now());
    return false;
  }

  /**
   * Handle unified event and send appropriate MCP notification
   */
  private handleEvent(event: UnifiedEvent): void {
    const progressToken = this.getProgressToken(event);

    switch (event.type) {
      case 'execution.started':
        this.handleExecutionStarted(event, progressToken);
        break;

      case 'execution.progress':
      case 'execution.token':
        this.handleExecutionProgress(event, progressToken);
        break;

      case 'execution.completed':
        this.handleExecutionCompleted(event, progressToken);
        break;

      case 'execution.error':
        this.handleExecutionError(event, progressToken);
        break;

      case 'tool.called':
        this.handleToolCalled(event, progressToken);
        break;

      case 'tool.progress':
        this.handleToolProgress(event, progressToken);
        break;

      case 'tool.result':
        this.handleToolResult(event, progressToken);
        break;

      case 'agent.selected':
      case 'agent.delegated':
        this.handleAgentEvent(event, progressToken);
        break;

      default:
        // Log custom events
        this.sendLogNotification(event);
    }
  }

  /**
   * Get or create progress token for event
   */
  private getProgressToken(event: UnifiedEvent): string {
    const correlationId = event.correlationId || event.id;

    if (!this.activeProgressTokens.has(correlationId)) {
      const token = `ax-progress-${correlationId.substring(0, 8)}`;
      this.activeProgressTokens.set(correlationId, token);
    }

    return this.activeProgressTokens.get(correlationId)!;
  }

  // ============================================
  // Event Type Handlers
  // ============================================

  private handleExecutionStarted(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as { agent?: string; task?: string };

    this.sendProgressBegin(progressToken, {
      title: `Agent: ${payload.agent || 'Unknown'}`,
      message: payload.task?.substring(0, 100) || 'Executing task...',
      cancellable: false
    });
  }

  private handleExecutionProgress(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as {
      progress?: number;
      message?: string;
      tokensReceived?: number;
    };

    const percentage = payload.progress ?? undefined;
    const message = payload.message ||
      (payload.tokensReceived ? `${payload.tokensReceived} tokens` : 'Processing...');

    this.sendProgressReport(progressToken, {
      message,
      percentage
    });
  }

  private handleExecutionCompleted(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as {
      agent?: string;
      latencyMs?: number;
      tokens?: { total?: number };
    };

    const message = `Completed in ${payload.latencyMs || 0}ms` +
      (payload.tokens?.total ? ` (${payload.tokens.total} tokens)` : '');

    this.sendProgressEnd(progressToken, message);

    // Clean up
    const correlationId = event.correlationId || event.id;
    this.activeProgressTokens.delete(correlationId);
  }

  private handleExecutionError(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as { error?: string; code?: string };

    this.sendProgressEnd(progressToken, `Error: ${payload.error || 'Unknown error'}`);

    // Clean up
    const correlationId = event.correlationId || event.id;
    this.activeProgressTokens.delete(correlationId);
  }

  private handleToolCalled(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as { tool?: string };

    this.sendProgressReport(progressToken, {
      message: `Calling tool: ${payload.tool || 'unknown'}`,
      percentage: undefined
    });
  }

  private handleToolProgress(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as { tool?: string; progress?: number; message?: string };

    this.sendProgressReport(progressToken, {
      message: payload.message || `Tool ${payload.tool}: ${payload.progress || 0}%`,
      percentage: payload.progress
    });
  }

  private handleToolResult(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as { tool?: string; success?: boolean; latencyMs?: number };

    const status = payload.success ? '✓' : '✗';
    this.sendProgressReport(progressToken, {
      message: `Tool ${payload.tool} ${status} (${payload.latencyMs || 0}ms)`,
      percentage: undefined
    });
  }

  private handleAgentEvent(event: UnifiedEvent, progressToken: string): void {
    const payload = event.payload as {
      agent?: string;
      fromAgent?: string;
      toAgent?: string;
      task?: string;
    };

    let message: string;
    if (event.type === 'agent.selected') {
      message = `Selected agent: ${payload.agent}`;
    } else {
      message = `Delegating to ${payload.toAgent}: ${payload.task?.substring(0, 50) || '...'}`;
    }

    this.sendProgressReport(progressToken, { message });
  }

  // ============================================
  // Notification Senders
  // ============================================

  /**
   * Send progress/begin notification
   */
  private sendProgressBegin(
    progressToken: string,
    options: { title: string; message?: string; cancellable?: boolean }
  ): void {
    const notification: McpNotification = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken,
        value: {
          kind: 'begin',
          title: options.title,
          message: options.message,
          cancellable: options.cancellable ?? false,
          percentage: 0
        }
      }
    };

    this.writeNotification(notification);
  }

  /**
   * Send progress/report notification
   */
  private sendProgressReport(
    progressToken: string,
    options: { message?: string; percentage?: number }
  ): void {
    const notification: McpNotification = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken,
        value: {
          kind: 'report',
          message: options.message,
          percentage: options.percentage
        }
      }
    };

    this.writeNotification(notification);
  }

  /**
   * Send progress/end notification
   */
  private sendProgressEnd(progressToken: string, message?: string): void {
    const notification: McpNotification = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken,
        value: {
          kind: 'end',
          message
        }
      }
    };

    this.writeNotification(notification);
  }

  /**
   * Send log notification for custom events
   */
  private sendLogNotification(event: UnifiedEvent): void {
    const notification: McpNotification = {
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: {
        level: 'info',
        logger: 'automatosx',
        data: {
          type: event.type,
          source: event.source,
          timestamp: event.timestamp,
          payload: event.payload
        }
      }
    };

    this.writeNotification(notification);
  }

  /**
   * Write notification to stdout with Content-Length framing
   */
  private writeNotification(notification: McpNotification): void {
    try {
      const json = JSON.stringify(notification);
      const contentLength = Buffer.byteLength(json, 'utf-8');
      const message = `Content-Length: ${contentLength}\r\n\r\n${json}`;

      process.stdout.write(message);

      if (this.options.debug) {
        logger.debug('[MCP Streaming] Notification sent', {
          method: notification.method,
          contentLength
        });
      }
    } catch (error) {
      logger.error('[MCP Streaming] Failed to write notification', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let globalNotifier: McpStreamingNotifier | null = null;

/**
 * Get or create the global MCP streaming notifier
 */
export function getGlobalStreamingNotifier(options?: StreamingNotifierOptions): McpStreamingNotifier {
  if (!globalNotifier) {
    globalNotifier = new McpStreamingNotifier(options);
  }
  return globalNotifier;
}

/**
 * Reset the global streaming notifier (for testing)
 */
export function resetGlobalStreamingNotifier(): void {
  if (globalNotifier) {
    globalNotifier.stop();
    globalNotifier = null;
  }
}
