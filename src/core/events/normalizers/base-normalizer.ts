/**
 * Base Event Normalizer (v11.1.0)
 *
 * Abstract base class for provider-specific event normalizers.
 * Provides common functionality for normalizing raw provider events
 * to the unified event format.
 *
 * @module core/events/normalizers/base-normalizer
 * @since v11.1.0
 */

import type { EventNormalizer } from '../event-bridge.js';
import type {
  UnifiedEvent,
  EventSource,
  UnifiedEventType,
  EventPayload
} from '../unified-event.js';
import { createUnifiedEvent } from '../unified-event.js';

/**
 * Base normalizer with common functionality
 */
export abstract class BaseEventNormalizer implements EventNormalizer {
  abstract source: EventSource;

  abstract normalize(rawEvent: unknown, correlationId?: string): UnifiedEvent | null;

  abstract canHandle(rawEvent: unknown): boolean;

  /**
   * Create a unified event with the normalizer's source
   */
  protected createEvent(
    type: UnifiedEventType,
    payload: EventPayload,
    correlationId?: string
  ): UnifiedEvent {
    return createUnifiedEvent(type, this.source, payload, correlationId);
  }

  /**
   * Safely extract a string property from an object
   */
  protected getString(obj: unknown, key: string, defaultValue = ''): string {
    if (typeof obj === 'object' && obj !== null && key in obj) {
      const value = (obj as Record<string, unknown>)[key];
      return typeof value === 'string' ? value : defaultValue;
    }
    return defaultValue;
  }

  /**
   * Safely extract a number property from an object
   */
  protected getNumber(obj: unknown, key: string, defaultValue = 0): number {
    if (typeof obj === 'object' && obj !== null && key in obj) {
      const value = (obj as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : defaultValue;
    }
    return defaultValue;
  }

  /**
   * Safely extract a boolean property from an object
   */
  protected getBoolean(obj: unknown, key: string, defaultValue = false): boolean {
    if (typeof obj === 'object' && obj !== null && key in obj) {
      const value = (obj as Record<string, unknown>)[key];
      return typeof value === 'boolean' ? value : defaultValue;
    }
    return defaultValue;
  }

  /**
   * Check if object has a specific property
   */
  protected hasProperty(obj: unknown, key: string): boolean {
    return typeof obj === 'object' && obj !== null && key in obj;
  }

  /**
   * Check if object has a type property with specific value
   */
  protected hasType(obj: unknown, type: string): boolean {
    return this.getString(obj, 'type') === type;
  }
}
