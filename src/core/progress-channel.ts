/**
 * Progress Channel (v5.3.0)
 *
 * Event-based progress system for real-time updates during stage execution.
 * Supports publish/subscribe pattern with throttling and backpressure handling.
 */

/**
 * Progress Event Types
 */
export type ProgressEventType =
  | 'stage-start'
  | 'stage-progress'
  | 'stage-complete'
  | 'stage-error'
  | 'token-stream'
  | 'checkpoint'
  | 'user-prompt';

/**
 * Progress Event
 *
 * Event emitted during stage execution to track progress.
 */
export interface ProgressEvent {
  /** Event type identifier */
  type: ProgressEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Stage index (0-based) */
  stageIndex?: number;
  /** Stage name */
  stageName?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Token content (for token-stream events) */
  token?: string;
  /** Human-readable message */
  message?: string;
  /** Additional event data */
  data?: any;
}

/**
 * Progress Listener
 *
 * Callback function invoked when progress event occurs.
 */
export type ProgressListener = (event: ProgressEvent) => void;

/**
 * ProgressChannel Options
 */
export interface ProgressChannelOptions {
  /** Throttle interval in milliseconds (default: 100ms) */
  throttleMs?: number;
}

/**
 * ProgressChannel - Event-based progress system
 *
 * Supports publish/subscribe pattern for real-time progress updates.
 * Handles backpressure by throttling events when needed.
 *
 * Features:
 * - Throttling to prevent event flooding
 * - Critical events bypass throttling
 * - Automatic queue processing
 * - Error-safe listener invocation
 */
export class ProgressChannel {
  private listeners: Set<ProgressListener> = new Set();
  private eventQueue: ProgressEvent[] = [];
  private processing = false;
  private throttleMs: number;
  private lastEmitTime = 0;
  private processQueueTimeout?: NodeJS.Timeout;

  /**
   * Create ProgressChannel
   *
   * @param options - Channel configuration
   */
  constructor(options: ProgressChannelOptions = {}) {
    this.throttleMs = options.throttleMs || 100; // Default 100ms throttle
  }

  /**
   * Subscribe to progress events
   *
   * @param listener - Event listener callback
   * @returns Unsubscribe function
   */
  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit progress event
   *
   * Critical events (stage-start, stage-complete, stage-error, user-prompt)
   * bypass throttling and emit immediately. Other events are queued and
   * throttled to prevent flooding.
   *
   * @param event - Progress event to emit
   */
  emit(event: ProgressEvent): void {
    const now = Date.now();
    const timeSinceLastEmit = now - this.lastEmitTime;

    // Apply throttling (except for critical events)
    const isCriticalEvent =
      event.type === 'stage-start' ||
      event.type === 'stage-complete' ||
      event.type === 'stage-error' ||
      event.type === 'user-prompt';

    if (!isCriticalEvent && timeSinceLastEmit < this.throttleMs) {
      // Queue event for later
      this.eventQueue.push(event);
      this.scheduleProcessQueue();
      return;
    }

    // Emit immediately
    this.lastEmitTime = now;
    this.notifyListeners(event);
  }

  /**
   * Clear all listeners and pending events
   */
  clear(): void {
    this.listeners.clear();
    this.eventQueue = [];

    // Clear pending timeout
    if (this.processQueueTimeout) {
      clearTimeout(this.processQueueTimeout);
      this.processQueueTimeout = undefined;
    }
    this.processing = false;
  }

  /**
   * Get listener count
   */
  get listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Notify all listeners
   *
   * Catches and logs listener errors to prevent propagation.
   */
  private notifyListeners(event: ProgressEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('ProgressChannel listener error:', error);
      }
    });
  }

  /**
   * Schedule queue processing
   *
   * Ensures only one processing loop runs at a time.
   */
  private scheduleProcessQueue(): void {
    if (this.processing) return;

    this.processing = true;
    this.processQueueTimeout = setTimeout(() => {
      this.processQueueTimeout = undefined;
      this.processQueue();
    }, this.throttleMs);
  }

  /**
   * Process queued events
   *
   * Emits queued events one at a time with throttling.
   */
  private processQueue(): void {
    if (this.eventQueue.length === 0) {
      this.processing = false;
      return;
    }

    // Emit next event
    const event = this.eventQueue.shift();
    if (event) {
      this.lastEmitTime = Date.now();
      this.notifyListeners(event);
    }

    // Schedule next processing
    if (this.eventQueue.length > 0) {
      this.processQueueTimeout = setTimeout(() => {
        this.processQueueTimeout = undefined;
        this.processQueue();
      }, this.throttleMs);
    } else {
      this.processing = false;
    }
  }

  /**
   * Cleanup channel and clear pending timers
   *
   * FIXED (v6.5.12 Bug #122): Added cleanup method to prevent timer leaks
   * Clears pending timeout and removes all listeners to allow proper garbage collection.
   */
  destroy(): void {
    // Clear pending timeout
    if (this.processQueueTimeout) {
      clearTimeout(this.processQueueTimeout);
      this.processQueueTimeout = undefined;
    }

    // Clear listeners
    this.listeners.clear();

    // Clear event queue
    this.eventQueue = [];

    // Reset processing state
    this.processing = false;
  }
}
