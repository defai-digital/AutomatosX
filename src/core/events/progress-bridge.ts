/**
 * Progress Bridge (v11.1.0)
 *
 * Connects the existing ProgressChannel to the unified EventBridge.
 * Translates ProgressEvent to UnifiedEvent for consistent event handling.
 *
 * @module core/events/progress-bridge
 * @since v11.1.0
 */

import { logger } from '../../shared/logging/logger.js';
import { ProgressChannel, type ProgressEvent, type ProgressEventType } from '../progress-channel.js';
import { getGlobalEventBridge, type EventBridge } from './event-bridge.js';
import type { UnifiedEventType, EventSource } from './unified-event.js';
import { generateEventId } from './unified-event.js';

// ============================================
// Types
// ============================================

/**
 * Progress bridge options
 */
export interface ProgressBridgeOptions {
  /** Event source to use for unified events (default: 'internal') */
  source?: EventSource;
  /** Custom event bridge (default: global) */
  eventBridge?: EventBridge;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// Event Type Mapping
// ============================================

/**
 * Map ProgressEventType to UnifiedEventType
 */
const EVENT_TYPE_MAP: Record<ProgressEventType, UnifiedEventType> = {
  'stage-start': 'execution.started',
  'stage-progress': 'execution.progress',
  'stage-complete': 'execution.completed',
  'stage-error': 'execution.error',
  'token-stream': 'execution.token',
  'checkpoint': 'execution.progress',
  'user-prompt': 'execution.progress'
};

// ============================================
// Progress Bridge
// ============================================

/**
 * ProgressBridge connects ProgressChannel to EventBridge
 *
 * Usage:
 * ```typescript
 * const channel = new ProgressChannel();
 * const bridge = new ProgressBridge(channel);
 * bridge.connect();
 *
 * // Progress events now flow to EventBridge
 * channel.emit({ type: 'stage-start', timestamp: new Date(), ... });
 * ```
 */
export class ProgressBridge {
  private channel: ProgressChannel;
  private eventBridge: EventBridge;
  private source: EventSource;
  private unsubscribe: (() => void) | null = null;
  private correlationId: string;
  private debug: boolean;

  constructor(channel: ProgressChannel, options: ProgressBridgeOptions = {}) {
    this.channel = channel;
    this.eventBridge = options.eventBridge || getGlobalEventBridge();
    this.source = options.source || 'internal';
    this.correlationId = generateEventId();
    this.debug = options.debug ?? false;

    if (this.debug) {
      logger.debug('[ProgressBridge] Initialized', {
        source: this.source,
        correlationId: this.correlationId
      });
    }
  }

  /**
   * Connect progress channel to event bridge
   */
  connect(): void {
    if (this.unsubscribe) {
      return; // Already connected
    }

    this.unsubscribe = this.channel.subscribe((event) => {
      this.handleProgressEvent(event);
    });

    if (this.debug) {
      logger.debug('[ProgressBridge] Connected to channel');
    }
  }

  /**
   * Disconnect from progress channel
   */
  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.debug) {
      logger.debug('[ProgressBridge] Disconnected');
    }
  }

  /**
   * Set correlation ID for linking events
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Handle progress event and emit to event bridge
   */
  private handleProgressEvent(event: ProgressEvent): void {
    const unifiedType = EVENT_TYPE_MAP[event.type];
    if (!unifiedType) {
      if (this.debug) {
        logger.debug('[ProgressBridge] Unknown event type', { type: event.type });
      }
      return;
    }

    const payload = this.buildPayload(event);

    this.eventBridge.emit(unifiedType, this.source, payload, this.correlationId);

    if (this.debug) {
      logger.debug('[ProgressBridge] Event emitted', {
        progressType: event.type,
        unifiedType,
        source: this.source
      });
    }
  }

  /**
   * Build unified event payload from progress event
   */
  private buildPayload(event: ProgressEvent): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      agent: event.stageName || 'unknown'
    };

    switch (event.type) {
      case 'stage-start':
        return {
          ...payload,
          task: event.message || 'Starting stage',
          provider: this.source
        };

      case 'stage-progress':
      case 'checkpoint':
        return {
          ...payload,
          progress: event.progress ?? 0,
          message: event.message,
          stage: event.stageName
        };

      case 'token-stream':
        return {
          ...payload,
          token: event.token || '',
          tokensReceived: event.data?.tokensReceived ?? 0
        };

      case 'stage-complete':
        return {
          ...payload,
          content: event.message || 'Stage completed',
          latencyMs: event.data?.latencyMs ?? 0,
          provider: this.source
        };

      case 'stage-error':
        return {
          ...payload,
          error: event.message || 'Unknown error',
          code: event.data?.code,
          retryable: event.data?.retryable ?? false
        };

      case 'user-prompt':
        return {
          ...payload,
          message: event.message,
          progress: 0,
          stage: 'awaiting-input'
        };

      default:
        return payload;
    }
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a connected progress bridge
 */
export function createProgressBridge(
  channel: ProgressChannel,
  options?: ProgressBridgeOptions
): ProgressBridge {
  const bridge = new ProgressBridge(channel, options);
  bridge.connect();
  return bridge;
}

/**
 * Bridge multiple progress channels to a single event bridge
 */
export function bridgeProgressChannels(
  channels: Array<{ channel: ProgressChannel; source: EventSource }>,
  eventBridge?: EventBridge
): ProgressBridge[] {
  const bridge = eventBridge || getGlobalEventBridge();

  return channels.map(({ channel, source }) => {
    const progressBridge = new ProgressBridge(channel, {
      source,
      eventBridge: bridge
    });
    progressBridge.connect();
    return progressBridge;
  });
}
