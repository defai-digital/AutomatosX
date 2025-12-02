/**
 * Event Normalizers Index (v11.1.0)
 *
 * Exports all provider-specific event normalizers.
 *
 * @module core/events/normalizers
 * @since v11.1.0
 */

export { BaseEventNormalizer } from './base-normalizer.js';
export { ClaudeEventNormalizer } from './claude-normalizer.js';
export { GeminiEventNormalizer } from './gemini-normalizer.js';
export { CodexEventNormalizer } from './codex-normalizer.js';
export { AxCliEventNormalizer } from './ax-cli-normalizer.js';

// Re-export types from unified-event for convenience
export type {
  UnifiedEvent,
  UnifiedEventType,
  EventSource,
  EventPayload
} from '../unified-event.js';

// Re-export EventNormalizer interface from event-bridge
export type { EventNormalizer } from '../event-bridge.js';
