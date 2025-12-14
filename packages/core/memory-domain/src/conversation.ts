import { createMemoryEvent } from '@automatosx/contracts';
import type {
  EventStore,
  ConversationState,
  Message,
  EventHandler,
} from './types.js';
import { AggregateRepository } from './aggregate.js';

/**
 * Initial state for a conversation
 */
function initialConversationState(): ConversationState {
  return {
    conversationId: '',
    messages: [],
    context: {},
  };
}

/**
 * Event handler for conversation events
 * INV-MEM-002: Pure function - no external state reads
 */
const conversationEventHandler: EventHandler<ConversationState> = (
  state,
  event
): ConversationState => {
  switch (event.type) {
    case 'conversation.created': {
      const payload = event.payload as {
        conversationId: string;
        title?: string;
        initialContext?: Record<string, unknown>;
      };
      return {
        ...state,
        conversationId: payload.conversationId,
        title: payload.title,
        context: payload.initialContext ?? {},
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    }

    case 'conversation.updated': {
      const payload = event.payload as {
        title?: string;
        context?: Record<string, unknown>;
      };
      return {
        ...state,
        title: payload.title ?? state.title,
        context: { ...state.context, ...payload.context },
        updatedAt: event.timestamp,
      };
    }

    case 'message.added': {
      const payload = event.payload as {
        messageId: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        tokenCount?: number;
      };
      const message: Message = {
        messageId: payload.messageId,
        role: payload.role,
        content: payload.content,
        tokenCount: payload.tokenCount,
        timestamp: event.timestamp,
      };
      return {
        ...state,
        messages: [...state.messages, message],
        updatedAt: event.timestamp,
      };
    }

    default:
      // Unknown event types are ignored (forward compatibility)
      return state;
  }
};

/**
 * Conversation aggregate for managing conversation state
 */
export class ConversationAggregate {
  private readonly repository: AggregateRepository<ConversationState>;

  constructor(eventStore: EventStore) {
    this.repository = new AggregateRepository(
      eventStore,
      initialConversationState,
      conversationEventHandler
    );
  }

  /**
   * Creates a new conversation
   */
  async create(
    conversationId: string,
    options?: { title?: string; initialContext?: Record<string, unknown> }
  ): Promise<ConversationState> {
    const event = createMemoryEvent(
      'conversation.created',
      {
        conversationId,
        title: options?.title,
        initialContext: options?.initialContext,
      },
      {
        aggregateId: conversationId,
        version: 1,
      }
    );

    await this.repository.save(conversationId, event, 0);
    return (await this.repository.load(conversationId)).state;
  }

  /**
   * Adds a message to a conversation
   */
  async addMessage(
    conversationId: string,
    message: Omit<Message, 'timestamp'>
  ): Promise<ConversationState> {
    const current = await this.repository.load(conversationId);

    const event = createMemoryEvent(
      'message.added',
      {
        messageId: message.messageId,
        role: message.role,
        content: message.content,
        tokenCount: message.tokenCount,
      },
      {
        aggregateId: conversationId,
        version: current.version + 1,
      }
    );

    await this.repository.save(conversationId, event, current.version);
    return (await this.repository.load(conversationId)).state;
  }

  /**
   * Updates conversation metadata
   */
  async update(
    conversationId: string,
    updates: { title?: string; context?: Record<string, unknown> }
  ): Promise<ConversationState> {
    const current = await this.repository.load(conversationId);

    const event = createMemoryEvent(
      'conversation.updated',
      updates,
      {
        aggregateId: conversationId,
        version: current.version + 1,
      }
    );

    await this.repository.save(conversationId, event, current.version);
    return (await this.repository.load(conversationId)).state;
  }

  /**
   * Gets a conversation by ID
   */
  async get(conversationId: string): Promise<ConversationState> {
    return (await this.repository.load(conversationId)).state;
  }

  /**
   * Gets a conversation at a specific version
   */
  async getAtVersion(
    conversationId: string,
    version: number
  ): Promise<ConversationState> {
    return (await this.repository.loadAtVersion(conversationId, version)).state;
  }
}

/**
 * Creates a conversation aggregate
 */
export function createConversationAggregate(
  eventStore: EventStore
): ConversationAggregate {
  return new ConversationAggregate(eventStore);
}
