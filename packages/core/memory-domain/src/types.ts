import type { MemoryEvent, MemoryEventType } from '@automatosx/contracts';

/**
 * Event store interface for persistence
 * INV-MEM-003: Adapters must not accept domain objects directly
 */
export interface EventStore {
  /**
   * Appends an event to the store
   * INV-MEM-001: Events are immutable once stored
   */
  append(event: MemoryEvent): Promise<void>;

  /**
   * Gets all events for an aggregate
   * INV-MEM-004: Events returned in version order
   */
  getEvents(aggregateId: string): Promise<MemoryEvent[]>;

  /**
   * Gets events by type
   */
  getEventsByType(type: MemoryEventType): Promise<MemoryEvent[]>;

  /**
   * Gets events by correlation ID
   * INV-MEM-005: Support correlation tracing
   */
  getEventsByCorrelation(correlationId: string): Promise<MemoryEvent[]>;

  /**
   * Gets the current version for an aggregate
   */
  getVersion(aggregateId: string): Promise<number>;
}

/**
 * Aggregate state reconstructed from events
 */
export interface AggregateState<T> {
  aggregateId: string;
  version: number;
  state: T;
  lastEventId?: string | undefined;
  lastTimestamp?: string | undefined;
}

/**
 * Event handler for applying events to state
 */
export type EventHandler<T> = (state: T, event: MemoryEvent) => T;

/**
 * Conversation state
 */
export interface ConversationState {
  conversationId: string;
  title?: string | undefined;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

/**
 * Message in a conversation
 */
export interface Message {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount?: number | undefined;
  timestamp?: string | undefined;
}

/**
 * Memory item stored in the system
 */
export interface MemoryItem {
  key: string;
  value: unknown;
  ttlMs?: number;
  tags?: string[];
  createdAt: string;
  expiresAt?: string;
}

/**
 * Memory store state
 */
export interface MemoryStoreState {
  items: Map<string, MemoryItem>;
}

/**
 * Error codes for memory domain
 */
export const MemoryErrorCodes = {
  VERSION_CONFLICT: 'MEMORY_VERSION_CONFLICT',
  AGGREGATE_NOT_FOUND: 'MEMORY_AGGREGATE_NOT_FOUND',
  INVALID_EVENT: 'MEMORY_INVALID_EVENT',
  STORE_ERROR: 'MEMORY_STORE_ERROR',
} as const;

export type MemoryErrorCode =
  (typeof MemoryErrorCodes)[keyof typeof MemoryErrorCodes];
