/**
 * Spec Event Emitter - Phase 2 (v5.10.0)
 *
 * Event bus for real-time task lifecycle events and streaming progress.
 * Enables live log visibility and better error diagnostics.
 *
 * @see automatosx/PRD/ax-spec-integration-improvements.md (I-5)
 */

import { EventEmitter } from 'events';
import type { SpecTask, TaskStatus, SpecRunState } from '../../types/spec.js';

/**
 * Spec event types
 */
export type SpecEventType =
  | 'spec:started'      // Spec execution started
  | 'spec:progress'     // Overall progress update
  | 'spec:completed'    // Spec execution completed
  | 'spec:failed'       // Spec execution failed
  | 'task:queued'       // Task added to queue
  | 'task:started'      // Task execution started
  | 'task:progress'     // Task progress update
  | 'task:log'          // Task log output
  | 'task:completed'    // Task completed successfully
  | 'task:failed'       // Task failed
  | 'task:skipped'      // Task skipped due to dependencies
  | 'level:started'     // Dependency level started
  | 'level:completed';  // Dependency level completed

/**
 * Base event payload
 */
export interface SpecEventPayload {
  type: SpecEventType;
  timestamp: Date;
  specId: string;
  sessionId: string;
}

/**
 * Spec started event
 */
export interface SpecStartedEvent extends SpecEventPayload {
  type: 'spec:started';
  totalTasks: number;
  workspacePath: string;
  parallel: boolean;
}

/**
 * Spec progress event
 */
export interface SpecProgressEvent extends SpecEventPayload {
  type: 'spec:progress';
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  currentLevel?: number;
  totalLevels?: number;
}

/**
 * Spec completed event
 */
export interface SpecCompletedEvent extends SpecEventPayload {
  type: 'spec:completed';
  duration: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  totalTasks: number;
}

/**
 * Spec failed event
 */
export interface SpecFailedEvent extends SpecEventPayload {
  type: 'spec:failed';
  duration: number;
  error: {
    message: string;
    code?: string;
    stack?: string;
    taskId?: string;
  };
  completedTasks: number;
  failedTasks: number;
}

/**
 * Task queued event
 */
export interface TaskQueuedEvent extends SpecEventPayload {
  type: 'task:queued';
  taskId: string;
  taskTitle: string;
  level: number;
  dependencies: string[];
}

/**
 * Task started event
 */
export interface TaskStartedEvent extends SpecEventPayload {
  type: 'task:started';
  taskId: string;
  taskTitle: string;
  agent?: string;
  level: number;
}

/**
 * Task progress event
 */
export interface TaskProgressEvent extends SpecEventPayload {
  type: 'task:progress';
  taskId: string;
  taskTitle: string;
  progress?: number;  // 0-100
  message?: string;
}

/**
 * Task log event
 */
export interface TaskLogEvent extends SpecEventPayload {
  type: 'task:log';
  taskId: string;
  taskTitle: string;
  logLevel: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Task completed event
 */
export interface TaskCompletedEvent extends SpecEventPayload {
  type: 'task:completed';
  taskId: string;
  taskTitle: string;
  duration: number;
  output?: string;
  tokensUsed?: number;
}

/**
 * Task failed event
 */
export interface TaskFailedEvent extends SpecEventPayload {
  type: 'task:failed';
  taskId: string;
  taskTitle: string;
  duration: number;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  retryCount?: number;
}

/**
 * Task skipped event
 */
export interface TaskSkippedEvent extends SpecEventPayload {
  type: 'task:skipped';
  taskId: string;
  taskTitle: string;
  reason: string;
  failedDependencies: string[];
}

/**
 * Level started event
 */
export interface LevelStartedEvent extends SpecEventPayload {
  type: 'level:started';
  level: number;
  totalLevels: number;
  taskCount: number;
  taskIds: string[];
}

/**
 * Level completed event
 */
export interface LevelCompletedEvent extends SpecEventPayload {
  type: 'level:completed';
  level: number;
  totalLevels: number;
  duration: number;
  completedTasks: number;
  failedTasks: number;
}

/**
 * Union type for all spec events
 */
export type SpecEvent =
  | SpecStartedEvent
  | SpecProgressEvent
  | SpecCompletedEvent
  | SpecFailedEvent
  | TaskQueuedEvent
  | TaskStartedEvent
  | TaskProgressEvent
  | TaskLogEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskSkippedEvent
  | LevelStartedEvent
  | LevelCompletedEvent;

/**
 * Event listener function type
 */
export type SpecEventListener = (event: SpecEvent) => void | Promise<void>;

/**
 * Spec Event Emitter
 *
 * Central event bus for spec execution lifecycle.
 * Emits structured events for real-time progress tracking and logging.
 */
export class SpecEventEmitter extends EventEmitter {
  private specId: string;
  private sessionId: string;
  private eventCount: number = 0;
  private startTime?: number;

  constructor(specId: string, sessionId: string) {
    super();
    this.specId = specId;
    this.sessionId = sessionId;
  }

  /**
   * Emit a spec event
   */
  private emitEvent(event: SpecEvent): void {
    this.eventCount++;
    this.emit('*', event);  // Wildcard listener
    this.emit(event.type, event);  // Type-specific listener
  }

  /**
   * Create base event payload
   */
  private createBasePayload(): Pick<SpecEventPayload, 'timestamp' | 'specId' | 'sessionId'> {
    return {
      timestamp: new Date(),
      specId: this.specId,
      sessionId: this.sessionId
    };
  }

  /**
   * Emit spec:started event
   */
  emitSpecStarted(data: {
    totalTasks: number;
    workspacePath: string;
    parallel: boolean;
  }): void {
    this.startTime = performance.now();
    this.emitEvent({
      type: 'spec:started',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit spec:progress event
   */
  emitSpecProgress(data: {
    completedTasks: number;
    failedTasks: number;
    totalTasks: number;
    currentLevel?: number;
    totalLevels?: number;
  }): void {
    this.emitEvent({
      type: 'spec:progress',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit spec:completed event
   */
  emitSpecCompleted(data: {
    completedTasks: number;
    failedTasks: number;
    skippedTasks: number;
    totalTasks: number;
  }): void {
    const duration = this.startTime ? performance.now() - this.startTime : 0;
    this.emitEvent({
      type: 'spec:completed',
      ...this.createBasePayload(),
      duration,
      ...data
    });
  }

  /**
   * Emit spec:failed event
   */
  emitSpecFailed(data: {
    error: {
      message: string;
      code?: string;
      stack?: string;
      taskId?: string;
    };
    completedTasks: number;
    failedTasks: number;
  }): void {
    const duration = this.startTime ? performance.now() - this.startTime : 0;
    this.emitEvent({
      type: 'spec:failed',
      ...this.createBasePayload(),
      duration,
      ...data
    });
  }

  /**
   * Emit task:queued event
   */
  emitTaskQueued(data: {
    taskId: string;
    taskTitle: string;
    level: number;
    dependencies: string[];
  }): void {
    this.emitEvent({
      type: 'task:queued',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit task:started event
   */
  emitTaskStarted(data: {
    taskId: string;
    taskTitle: string;
    agent?: string;
    level: number;
  }): void {
    this.emitEvent({
      type: 'task:started',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit task:progress event
   */
  emitTaskProgress(data: {
    taskId: string;
    taskTitle: string;
    progress?: number;
    message?: string;
  }): void {
    this.emitEvent({
      type: 'task:progress',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit task:log event
   */
  emitTaskLog(data: {
    taskId: string;
    taskTitle: string;
    logLevel: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: Record<string, unknown>;
  }): void {
    this.emitEvent({
      type: 'task:log',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit task:completed event
   */
  emitTaskCompleted(data: {
    taskId: string;
    taskTitle: string;
    duration: number;
    output?: string;
    tokensUsed?: number;
  }): void {
    this.emitEvent({
      type: 'task:completed',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit task:failed event
   */
  emitTaskFailed(data: {
    taskId: string;
    taskTitle: string;
    duration: number;
    error: {
      message: string;
      code?: string;
      stack?: string;
    };
    retryCount?: number;
  }): void {
    this.emitEvent({
      type: 'task:failed',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit task:skipped event
   */
  emitTaskSkipped(data: {
    taskId: string;
    taskTitle: string;
    reason: string;
    failedDependencies: string[];
  }): void {
    this.emitEvent({
      type: 'task:skipped',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit level:started event
   */
  emitLevelStarted(data: {
    level: number;
    totalLevels: number;
    taskCount: number;
    taskIds: string[];
  }): void {
    this.emitEvent({
      type: 'level:started',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Emit level:completed event
   */
  emitLevelCompleted(data: {
    level: number;
    totalLevels: number;
    duration: number;
    completedTasks: number;
    failedTasks: number;
  }): void {
    this.emitEvent({
      type: 'level:completed',
      ...this.createBasePayload(),
      ...data
    });
  }

  /**
   * Subscribe to all events
   */
  onAny(listener: SpecEventListener): void {
    this.on('*', listener);
  }

  /**
   * Subscribe to specific event type
   */
  onEvent<T extends SpecEvent>(
    type: T['type'],
    listener: (event: T) => void | Promise<void>
  ): void {
    this.on(type, listener);
  }

  /**
   * Get event statistics
   */
  getStats() {
    return {
      specId: this.specId,
      sessionId: this.sessionId,
      eventCount: this.eventCount,
      duration: this.startTime ? performance.now() - this.startTime : 0
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
  }
}
