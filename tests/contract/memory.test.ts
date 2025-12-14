import { describe, it, expect } from 'vitest';
import {
  MemoryEventSchema,
  MemoryEventTypeSchema,
  EventMetadataSchema,
  ConversationCreatedPayloadSchema,
  MessageAddedPayloadSchema,
  MemoryStoredPayloadSchema,
  createMemoryEvent,
  validateMemoryEvent,
  safeValidateMemoryEvent,
  isEventType,
  type MemoryEvent,
  type MemoryEventType,
} from '@automatosx/contracts';

describe('Memory Event Contract V1', () => {
  describe('Schema Validation', () => {
    it('should validate a minimal memory event', () => {
      const event: MemoryEvent = {
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'memory.stored',
        timestamp: '2024-12-14T12:00:00Z',
        payload: { key: 'test', value: 'data' },
      };

      const result = safeValidateMemoryEvent(event);
      expect(result.success).toBe(true);
    });

    it('should validate a complete memory event', () => {
      const event: MemoryEvent = {
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'message.added',
        timestamp: '2024-12-14T12:00:00Z',
        aggregateId: 'conversation-123',
        version: 5,
        payload: {
          messageId: 'msg-1',
          role: 'user',
          content: 'Hello',
        },
        metadata: {
          correlationId: '550e8400-e29b-41d4-a716-446655440001',
          causationId: '550e8400-e29b-41d4-a716-446655440002',
          userId: 'user-123',
          source: 'api',
        },
      };

      const result = validateMemoryEvent(event);
      expect(result.type).toBe('message.added');
      expect(result.version).toBe(5);
    });

    it('should reject event without required fields', () => {
      const invalid = {
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'memory.stored',
        // missing timestamp and payload
      };

      const result = safeValidateMemoryEvent(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('INV-MEM-001: Event Immutability', () => {
    it('should require valid UUID for eventId', () => {
      const invalidEvent = {
        eventId: 'not-a-uuid',
        type: 'memory.stored',
        timestamp: '2024-12-14T12:00:00Z',
        payload: {},
      };

      const result = safeValidateMemoryEvent(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('should create event with new UUID', () => {
      const event = createMemoryEvent('memory.stored', { key: 'test' });

      // UUID format check
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(event.eventId).toMatch(uuidRegex);
    });
  });

  describe('INV-MEM-004: Event Ordering', () => {
    it('should validate version is positive integer', () => {
      const validVersions = [1, 2, 100, 999999];

      for (const version of validVersions) {
        const event = {
          eventId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'memory.stored' as const,
          timestamp: '2024-12-14T12:00:00Z',
          version,
          payload: {},
        };
        const result = MemoryEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid version numbers', () => {
      const invalidVersions = [0, -1, 1.5];

      for (const version of invalidVersions) {
        const event = {
          eventId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'memory.stored',
          timestamp: '2024-12-14T12:00:00Z',
          version,
          payload: {},
        };
        const result = MemoryEventSchema.safeParse(event);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('INV-MEM-005: Correlation Tracing', () => {
    it('should validate correlation metadata', () => {
      const metadata = {
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        causationId: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user-123',
        source: 'workflow-engine',
      };

      const result = EventMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID in metadata', () => {
      const metadata = {
        correlationId: 'not-a-uuid',
      };

      const result = EventMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });
  });

  describe('Event Type Validation', () => {
    it('should accept all valid event types', () => {
      const validTypes: MemoryEventType[] = [
        'conversation.created',
        'conversation.updated',
        'message.added',
        'memory.stored',
        'memory.retrieved',
        'memory.deleted',
        'context.snapshot',
      ];

      for (const type of validTypes) {
        const result = MemoryEventTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid event types', () => {
      const result = MemoryEventTypeSchema.safeParse('invalid.type');
      expect(result.success).toBe(false);
    });
  });

  describe('Payload Validation', () => {
    it('should validate conversation.created payload', () => {
      const payload = {
        conversationId: 'conv-123',
        title: 'Test Conversation',
        initialContext: { topic: 'testing' },
      };

      const result = ConversationCreatedPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate message.added payload', () => {
      const payload = {
        messageId: 'msg-123',
        role: 'user' as const,
        content: 'Hello, world!',
        tokenCount: 5,
      };

      const result = MessageAddedPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate memory.stored payload', () => {
      const payload = {
        key: 'user-preferences',
        value: { theme: 'dark' },
        ttlMs: 3600000,
        tags: ['user', 'preferences'],
      };

      const result = MemoryStoredPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject invalid message role', () => {
      const payload = {
        messageId: 'msg-123',
        role: 'invalid-role',
        content: 'Hello',
      };

      const result = MessageAddedPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should create memory event with correct structure', () => {
      const event = createMemoryEvent('memory.stored', { key: 'test' }, {
        aggregateId: 'agg-123',
        version: 1,
        metadata: { userId: 'user-1' },
      });

      expect(event.type).toBe('memory.stored');
      expect(event.aggregateId).toBe('agg-123');
      expect(event.version).toBe(1);
      expect(event.metadata?.userId).toBe('user-1');
    });

    it('should check event type correctly', () => {
      const event = createMemoryEvent('memory.stored', { key: 'test' });

      expect(isEventType(event, 'memory.stored')).toBe(true);
      expect(isEventType(event, 'message.added')).toBe(false);
    });
  });
});
