/**
 * Unified Event Protocol (v11.1.0)
 *
 * Standard event schema for all streaming and messaging operations.
 * Provides consistent event types across all providers (Claude, Gemini, Codex, ax-cli).
 *
 * Benefits:
 * - Single source of truth for event handling
 * - Provider-agnostic event processing
 * - Consistent UX across CLI, MCP, and logging
 * - Easy to add new providers or subscribers
 *
 * @module core/events/unified-event
 * @since v11.1.0
 */

import { z } from 'zod';

// ============================================
// Event Source Types
// ============================================

/**
 * Source of the event (which provider/system generated it)
 */
export type EventSource =
  | 'claude'
  | 'gemini'
  | 'codex'
  | 'ax-cli'
  | 'mcp'
  | 'internal';

export const EventSourceSchema = z.enum([
  'claude',
  'gemini',
  'codex',
  'ax-cli',
  'mcp',
  'internal'
]);

// ============================================
// Unified Event Types
// ============================================

/**
 * Standard event types for all streaming operations
 */
export type UnifiedEventType =
  // Execution lifecycle
  | 'execution.started'
  | 'execution.progress'
  | 'execution.token'
  | 'execution.completed'
  | 'execution.error'
  | 'execution.cancelled'
  // Tool operations
  | 'tool.called'
  | 'tool.progress'
  | 'tool.result'
  | 'tool.error'
  // Agent operations
  | 'agent.selected'
  | 'agent.delegated'
  | 'agent.context_loaded'
  // Memory operations
  | 'memory.searched'
  | 'memory.added'
  // Session operations
  | 'session.created'
  | 'session.updated'
  | 'session.completed';

export const UnifiedEventTypeSchema = z.enum([
  'execution.started',
  'execution.progress',
  'execution.token',
  'execution.completed',
  'execution.error',
  'execution.cancelled',
  'tool.called',
  'tool.progress',
  'tool.result',
  'tool.error',
  'agent.selected',
  'agent.delegated',
  'agent.context_loaded',
  'memory.searched',
  'memory.added',
  'session.created',
  'session.updated',
  'session.completed'
]);

// ============================================
// Event Payloads
// ============================================

/**
 * Payload for execution.started events
 */
export interface ExecutionStartedPayload {
  agent: string;
  task: string;
  provider: string;
  model?: string;
  sessionId?: string;
}

/**
 * Payload for execution.progress events
 */
export interface ExecutionProgressPayload {
  agent: string;
  progress: number; // 0-100
  message?: string;
  stage?: string;
  tokensUsed?: number;
  estimatedTotal?: number;
}

/**
 * Payload for execution.token events (streaming)
 */
export interface ExecutionTokenPayload {
  agent: string;
  token: string;
  tokensReceived: number;
  throughput?: number; // tokens/sec
}

/**
 * Payload for execution.completed events
 */
export interface ExecutionCompletedPayload {
  agent: string;
  content: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  provider: string;
  model?: string;
}

/**
 * Payload for execution.error events
 */
export interface ExecutionErrorPayload {
  agent: string;
  error: string;
  code?: string;
  retryable?: boolean;
  provider?: string;
}

/**
 * Payload for tool.called events
 */
export interface ToolCalledPayload {
  tool: string;
  arguments: Record<string, unknown>;
  caller?: string;
}

/**
 * Payload for tool.progress events
 */
export interface ToolProgressPayload {
  tool: string;
  progress: number;
  message?: string;
}

/**
 * Payload for tool.result events
 */
export interface ToolResultPayload {
  tool: string;
  result: unknown;
  latencyMs: number;
  success: boolean;
}

/**
 * Payload for agent.selected events
 */
export interface AgentSelectedPayload {
  agent: string;
  task: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  alternatives: string[];
  autoSelected: boolean;
}

/**
 * Payload for agent.delegated events
 */
export interface AgentDelegatedPayload {
  fromAgent: string;
  toAgent: string;
  task: string;
  reason?: string;
}

/**
 * Union type for all payloads
 */
export type EventPayload =
  | ExecutionStartedPayload
  | ExecutionProgressPayload
  | ExecutionTokenPayload
  | ExecutionCompletedPayload
  | ExecutionErrorPayload
  | ToolCalledPayload
  | ToolProgressPayload
  | ToolResultPayload
  | AgentSelectedPayload
  | AgentDelegatedPayload
  | Record<string, unknown>;

// ============================================
// Unified Event Interface
// ============================================

/**
 * Unified event structure for all streaming operations
 */
export interface UnifiedEvent {
  /** Unique event ID (UUID v4) */
  id: string;

  /** Event type (e.g., 'execution.progress') */
  type: UnifiedEventType;

  /** Source provider/system */
  source: EventSource;

  /** Unix timestamp in milliseconds */
  timestamp: number;

  /** Links related events (e.g., all events for one agent execution) */
  correlationId?: string;

  /** Type-specific payload data */
  payload: EventPayload;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// Zod Schema for Validation
// ============================================

export const UnifiedEventSchema = z.object({
  id: z.string().uuid(),
  type: UnifiedEventTypeSchema,
  source: EventSourceSchema,
  timestamp: z.number().int().positive(),
  correlationId: z.string().uuid().optional(),
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// ============================================
// Factory Functions
// ============================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new unified event
 */
export function createUnifiedEvent(
  type: UnifiedEventType,
  source: EventSource,
  payload: EventPayload,
  correlationId?: string
): UnifiedEvent {
  return {
    id: generateEventId(),
    type,
    source,
    timestamp: Date.now(),
    correlationId,
    payload
  };
}

/**
 * Create an execution.started event
 */
export function createExecutionStartedEvent(
  source: EventSource,
  payload: ExecutionStartedPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('execution.started', source, payload, correlationId);
}

/**
 * Create an execution.progress event
 */
export function createExecutionProgressEvent(
  source: EventSource,
  payload: ExecutionProgressPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('execution.progress', source, payload, correlationId);
}

/**
 * Create an execution.token event
 */
export function createExecutionTokenEvent(
  source: EventSource,
  payload: ExecutionTokenPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('execution.token', source, payload, correlationId);
}

/**
 * Create an execution.completed event
 */
export function createExecutionCompletedEvent(
  source: EventSource,
  payload: ExecutionCompletedPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('execution.completed', source, payload, correlationId);
}

/**
 * Create an execution.error event
 */
export function createExecutionErrorEvent(
  source: EventSource,
  payload: ExecutionErrorPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('execution.error', source, payload, correlationId);
}

/**
 * Create a tool.progress event
 */
export function createToolProgressEvent(
  source: EventSource,
  payload: ToolProgressPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('tool.progress', source, payload, correlationId);
}

/**
 * Create an agent.selected event
 */
export function createAgentSelectedEvent(
  payload: AgentSelectedPayload,
  correlationId?: string
): UnifiedEvent {
  return createUnifiedEvent('agent.selected', 'internal', payload, correlationId);
}
