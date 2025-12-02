/**
 * Unified Event System (v11.1.0)
 *
 * Provides a unified event protocol for all streaming and messaging operations
 * across AutomatosX providers (Claude, Gemini, Codex, ax-cli).
 *
 * Components:
 * - UnifiedEvent: Standard event schema
 * - EventBridge: Central event hub with pattern subscriptions
 * - EventNormalizers: Provider-specific to unified format converters
 * - ProgressBridge: Connects legacy ProgressChannel to EventBridge
 *
 * @module core/events
 * @since v11.1.0
 */

// Core event types and schemas
export {
  type UnifiedEvent,
  type UnifiedEventType,
  type EventSource,
  type EventPayload,
  type ExecutionStartedPayload,
  type ExecutionProgressPayload,
  type ExecutionTokenPayload,
  type ExecutionCompletedPayload,
  type ExecutionErrorPayload,
  type ToolCalledPayload,
  type ToolProgressPayload,
  type ToolResultPayload,
  type AgentSelectedPayload,
  type AgentDelegatedPayload,
  UnifiedEventSchema,
  EventSourceSchema,
  UnifiedEventTypeSchema,
  createUnifiedEvent,
  createExecutionStartedEvent,
  createExecutionProgressEvent,
  createExecutionTokenEvent,
  createExecutionCompletedEvent,
  createExecutionErrorEvent,
  createToolProgressEvent,
  createAgentSelectedEvent,
  generateEventId
} from './unified-event.js';

// Event bridge (pub/sub hub)
export {
  EventBridge,
  type EventHandler,
  type EventNormalizer,
  type EventBridgeOptions,
  getGlobalEventBridge,
  resetGlobalEventBridge
} from './event-bridge.js';

// Provider normalizers
export {
  BaseEventNormalizer,
  ClaudeEventNormalizer,
  GeminiEventNormalizer,
  CodexEventNormalizer,
  AxCliEventNormalizer
} from './normalizers/index.js';

// Progress channel bridge
export {
  ProgressBridge,
  type ProgressBridgeOptions,
  createProgressBridge,
  bridgeProgressChannels
} from './progress-bridge.js';
