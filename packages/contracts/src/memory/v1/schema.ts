import { z } from 'zod';

/**
 * Memory event types
 */
export const MemoryEventTypeSchema = z.enum([
  'conversation.created',
  'conversation.updated',
  'message.added',
  'memory.stored',
  'memory.retrieved',
  'memory.deleted',
  'context.snapshot',
]);

export type MemoryEventType = z.infer<typeof MemoryEventTypeSchema>;

/**
 * Message roles
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Event metadata for auditing and tracing
 */
export const EventMetadataSchema = z.object({
  correlationId: z.string().uuid().optional(),
  causationId: z.string().uuid().optional(),
  userId: z.string().optional(),
  source: z.string().optional(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

/**
 * Payload for conversation.created event
 */
export const ConversationCreatedPayloadSchema = z.object({
  conversationId: z.string(),
  title: z.string().optional(),
  initialContext: z.record(z.unknown()).optional(),
});

export type ConversationCreatedPayload = z.infer<
  typeof ConversationCreatedPayloadSchema
>;

/**
 * Payload for message.added event
 */
export const MessageAddedPayloadSchema = z.object({
  messageId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  tokenCount: z.number().int().min(0).optional(),
});

export type MessageAddedPayload = z.infer<typeof MessageAddedPayloadSchema>;

/**
 * Payload for memory.stored event
 */
export const MemoryStoredPayloadSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  ttlMs: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

export type MemoryStoredPayload = z.infer<typeof MemoryStoredPayloadSchema>;

/**
 * Payload for memory.retrieved event
 */
export const MemoryRetrievedPayloadSchema = z.object({
  key: z.string(),
  found: z.boolean(),
});

export type MemoryRetrievedPayload = z.infer<typeof MemoryRetrievedPayloadSchema>;

/**
 * Payload for memory.deleted event
 */
export const MemoryDeletedPayloadSchema = z.object({
  key: z.string(),
});

export type MemoryDeletedPayload = z.infer<typeof MemoryDeletedPayloadSchema>;

/**
 * Base memory event
 */
export const MemoryEventSchema = z.object({
  eventId: z.string().uuid(),
  type: MemoryEventTypeSchema,
  timestamp: z.string().datetime(),
  aggregateId: z.string().optional(),
  version: z.number().int().min(1).optional(),
  payload: z.record(z.unknown()),
  metadata: EventMetadataSchema.optional(),
});

export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

/**
 * Creates a new memory event
 */
export function createMemoryEvent(
  type: MemoryEventType,
  payload: Record<string, unknown>,
  options?: {
    aggregateId?: string;
    version?: number;
    metadata?: EventMetadata;
  }
): MemoryEvent {
  return {
    eventId: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    payload,
    ...options,
  };
}

/**
 * Validates a memory event
 */
export function validateMemoryEvent(data: unknown): MemoryEvent {
  return MemoryEventSchema.parse(data);
}

/**
 * Safely validates a memory event
 */
export function safeValidateMemoryEvent(
  data: unknown
): z.SafeParseReturnType<unknown, MemoryEvent> {
  return MemoryEventSchema.safeParse(data);
}

/**
 * Type guard for specific event types
 */
export function isEventType(
  event: MemoryEvent,
  type: MemoryEventType
): boolean {
  return event.type === type;
}
