// Memory Domain
// Event sourcing following contract invariants

export {
  InMemoryEventStore,
  EventStoreError,
  createInMemoryEventStore,
} from './event-store.js';
export {
  AggregateRepository,
  createAggregateRepository,
} from './aggregate.js';
export {
  ConversationAggregate,
  createConversationAggregate,
} from './conversation.js';
export {
  MemoryErrorCodes,
  type MemoryErrorCode,
  type EventStore,
  type AggregateState,
  type EventHandler,
  type ConversationState,
  type Message,
  type MemoryItem,
  type MemoryStoreState,
} from './types.js';
