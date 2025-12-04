/**
 * Event Bridge (v11.1.0)
 *
 * Central hub for event normalization and distribution.
 * Connects all providers to a unified event stream.
 *
 * Features:
 * - Normalizes provider-specific events to unified format
 * - Pattern-based subscriptions (e.g., 'execution.*')
 * - Event filtering and routing
 * - Correlation ID tracking for related events
 * - Throttling support for high-frequency events
 *
 * @module core/events/event-bridge
 * @since v11.1.0
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/logging/logger.js';
import type {
  UnifiedEvent,
  UnifiedEventType,
  EventSource,
  EventPayload
} from './unified-event.js';
import { createUnifiedEvent, generateEventId } from './unified-event.js';

// ============================================
// Types
// ============================================

/**
 * Event handler callback
 */
export type EventHandler = (event: UnifiedEvent) => void | Promise<void>;

/**
 * Event normalizer - converts provider-specific events to unified format
 */
export interface EventNormalizer {
  /** Provider source this normalizer handles */
  source: EventSource;

  /** Normalize a raw event to unified format */
  normalize(rawEvent: unknown, correlationId?: string): UnifiedEvent | null;

  /** Check if this normalizer can handle the raw event */
  canHandle(rawEvent: unknown): boolean;
}

/**
 * Subscription entry
 */
interface Subscription {
  /** Subscription ID */
  id: string;
  /** Pattern to match (e.g., 'execution.*', 'tool.progress') */
  pattern: string;
  /** Compiled regex for pattern matching */
  regex: RegExp;
  /** Event handler */
  handler: EventHandler;
  /** Whether to receive throttled events */
  receiveThrottled: boolean;
}

/**
 * Event Bridge options
 */
export interface EventBridgeOptions {
  /** Throttle interval for high-frequency events (ms) */
  throttleMs?: number;
  /** Event types to throttle */
  throttledTypes?: UnifiedEventType[];
  /** Maximum event history to keep */
  maxHistory?: number;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// Event Bridge Implementation
// ============================================

export class EventBridge extends EventEmitter {
  private normalizers: Map<EventSource, EventNormalizer> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private throttleState: Map<string, number> = new Map(); // type -> last emit time
  private eventHistory: UnifiedEvent[] = [];
  private options: Required<EventBridgeOptions>;

  constructor(options: EventBridgeOptions = {}) {
    super();
    this.options = {
      throttleMs: options.throttleMs ?? 100,
      throttledTypes: options.throttledTypes ?? ['execution.token', 'execution.progress'],
      maxHistory: options.maxHistory ?? 100,
      debug: options.debug ?? false
    };

    if (this.options.debug) {
      logger.debug('[EventBridge] Initialized', {
        throttleMs: this.options.throttleMs,
        throttledTypes: this.options.throttledTypes
      });
    }
  }

  // ============================================
  // Normalizer Registration
  // ============================================

  /**
   * Register an event normalizer for a specific provider
   */
  registerNormalizer(normalizer: EventNormalizer): void {
    this.normalizers.set(normalizer.source, normalizer);
    if (this.options.debug) {
      logger.debug('[EventBridge] Registered normalizer', { source: normalizer.source });
    }
  }

  /**
   * Unregister a normalizer
   */
  unregisterNormalizer(source: EventSource): void {
    this.normalizers.delete(source);
  }

  /**
   * Get registered normalizer sources
   */
  getNormalizerSources(): EventSource[] {
    return Array.from(this.normalizers.keys());
  }

  // ============================================
  // Event Ingestion
  // ============================================

  /**
   * Ingest a raw event from a provider and normalize it
   *
   * @param source - Provider source
   * @param rawEvent - Raw event data from provider
   * @param correlationId - Optional correlation ID for linking events
   * @returns Normalized unified event, or null if normalization failed
   */
  ingest(source: EventSource, rawEvent: unknown, correlationId?: string): UnifiedEvent | null {
    const normalizer = this.normalizers.get(source);

    if (!normalizer) {
      logger.warn('[EventBridge] No normalizer registered for source', { source });
      return null;
    }

    if (!normalizer.canHandle(rawEvent)) {
      if (this.options.debug) {
        logger.debug('[EventBridge] Normalizer cannot handle event', { source });
      }
      return null;
    }

    const event = normalizer.normalize(rawEvent, correlationId);
    if (event) {
      this.publish(event);
    }

    return event;
  }

  /**
   * Create and publish a unified event directly
   * Note: Named emitEvent to avoid conflict with EventEmitter.emit()
   */
  emitEvent(
    type: UnifiedEventType,
    source: EventSource,
    payload: EventPayload,
    correlationId?: string
  ): UnifiedEvent {
    const event = createUnifiedEvent(type, source, payload, correlationId);
    this.publish(event);
    return event;
  }

  // ============================================
  // Event Publishing
  // ============================================

  /**
   * Publish a unified event to all matching subscribers
   */
  publish(event: UnifiedEvent): void {
    // Check throttling
    if (this.shouldThrottle(event)) {
      if (this.options.debug) {
        logger.debug('[EventBridge] Event throttled', { type: event.type });
      }
      return;
    }

    // Update throttle state
    if (this.options.throttledTypes.includes(event.type)) {
      this.throttleState.set(event.type, Date.now());
    }

    // Add to history
    this.addToHistory(event);

    // Notify matching subscribers
    let notified = 0;
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesPattern(event.type, subscription.regex)) {
        this.notifySubscriber(subscription, event);
        notified++;
      }
    }

    // Emit on EventEmitter for direct listeners
    super.emit('event', event);
    super.emit(event.type, event);

    if (this.options.debug) {
      logger.debug('[EventBridge] Event published', {
        type: event.type,
        source: event.source,
        subscribers: notified
      });
    }
  }

  /**
   * Check if event should be throttled
   */
  private shouldThrottle(event: UnifiedEvent): boolean {
    if (!this.options.throttledTypes.includes(event.type)) {
      return false;
    }

    const lastEmit = this.throttleState.get(event.type) ?? 0;
    const elapsed = Date.now() - lastEmit;
    return elapsed < this.options.throttleMs;
  }

  /**
   * Notify a subscriber with an event
   */
  private notifySubscriber(subscription: Subscription, event: UnifiedEvent): void {
    try {
      const result = subscription.handler(event);
      // Handle async handlers
      if (result instanceof Promise) {
        result.catch(error => {
          logger.error('[EventBridge] Async handler error', {
            subscriptionId: subscription.id,
            pattern: subscription.pattern,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    } catch (error) {
      logger.error('[EventBridge] Handler error', {
        subscriptionId: subscription.id,
        pattern: subscription.pattern,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================================
  // Subscription Management
  // ============================================

  /**
   * Subscribe to events matching a pattern
   *
   * Pattern examples:
   * - 'execution.progress' - Exact match
   * - 'execution.*' - All execution events
   * - '*' - All events
   * - 'tool.*' - All tool events
   *
   * @param pattern - Event type pattern
   * @param handler - Event handler callback
   * @param options - Subscription options
   * @returns Unsubscribe function
   */
  subscribe(
    pattern: string,
    handler: EventHandler,
    options: { receiveThrottled?: boolean } = {}
  ): () => void {
    const id = generateEventId();
    const regex = this.patternToRegex(pattern);

    const subscription: Subscription = {
      id,
      pattern,
      regex,
      handler,
      receiveThrottled: options.receiveThrottled ?? false
    };

    this.subscriptions.set(id, subscription);

    if (this.options.debug) {
      logger.debug('[EventBridge] Subscription added', { id, pattern });
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
      if (this.options.debug) {
        logger.debug('[EventBridge] Subscription removed', { id, pattern });
      }
    };
  }

  /**
   * Get active subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Convert glob-like pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    if (pattern === '*') {
      return /^.*$/;
    }

    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with regex wildcard
    const regexStr = '^' + escaped.replace(/\*/g, '[^.]*') + '$';
    return new RegExp(regexStr);
  }

  /**
   * Check if event type matches pattern
   */
  private matchesPattern(type: string, regex: RegExp): boolean {
    return regex.test(type);
  }

  // ============================================
  // Event History
  // ============================================

  /**
   * Add event to history (ring buffer)
   */
  private addToHistory(event: UnifiedEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.options.maxHistory) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get recent events, optionally filtered by correlation ID
   */
  getHistory(correlationId?: string): UnifiedEvent[] {
    if (correlationId) {
      return this.eventHistory.filter(e => e.correlationId === correlationId);
    }
    return [...this.eventHistory];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: UnifiedEventType): UnifiedEvent[] {
    return this.eventHistory.filter(e => e.type === type);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Destroy the event bridge and cleanup resources
   */
  destroy(): void {
    this.subscriptions.clear();
    this.normalizers.clear();
    this.eventHistory = [];
    this.throttleState.clear();
    this.removeAllListeners();

    if (this.options.debug) {
      logger.debug('[EventBridge] Destroyed');
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let globalBridge: EventBridge | null = null;

/**
 * Get or create the global event bridge instance
 */
export function getGlobalEventBridge(options?: EventBridgeOptions): EventBridge {
  if (!globalBridge) {
    globalBridge = new EventBridge(options);
  }
  return globalBridge;
}

/**
 * Reset the global event bridge (for testing)
 */
export function resetGlobalEventBridge(): void {
  if (globalBridge) {
    globalBridge.destroy();
    globalBridge = null;
  }
}
