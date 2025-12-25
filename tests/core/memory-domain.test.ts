import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryEventStore,
  createInMemoryEventStore,
  EventStoreError,
  AggregateRepository,
  createAggregateRepository,
  ConversationAggregate,
  createConversationAggregate,
  MemoryErrorCodes,
  type EventStore,
} from '@defai.digital/memory-domain';
import { createMemoryEvent, type MemoryEvent } from '@defai.digital/contracts';

describe('Memory Domain', () => {
  describe('Event Store (INV-MEM-001, INV-MEM-004)', () => {
    let store: InMemoryEventStore;

    beforeEach(() => {
      store = createInMemoryEventStore();
    });

    it('INV-MEM-001: should freeze events to make them immutable', async () => {
      const event = createMemoryEvent(
        'memory.stored',
        { key: 'test', value: 'data' },
        { aggregateId: 'agg-1', version: 1 }
      );

      await store.append(event);
      const stored = await store.getEvents('agg-1');

      expect(stored).toHaveLength(1);
      expect(Object.isFrozen(stored[0])).toBe(true);
    });

    it('INV-MEM-004: should enforce version ordering', async () => {
      const event1 = createMemoryEvent(
        'memory.stored',
        { key: 'test' },
        { aggregateId: 'agg-1', version: 1 }
      );

      const event3 = createMemoryEvent(
        'memory.stored',
        { key: 'test2' },
        { aggregateId: 'agg-1', version: 3 } // Skipping version 2
      );

      await store.append(event1);

      // Should throw on version gap
      await expect(store.append(event3)).rejects.toThrow(EventStoreError);
      try {
        await store.append(event3);
      } catch (err) {
        expect((err as EventStoreError).code).toBe(MemoryErrorCodes.VERSION_CONFLICT);
      }
    });

    it('should return events in order', async () => {
      const events = [
        createMemoryEvent('memory.stored', { key: 'a' }, { aggregateId: 'agg-1', version: 1 }),
        createMemoryEvent('memory.stored', { key: 'b' }, { aggregateId: 'agg-1', version: 2 }),
        createMemoryEvent('memory.stored', { key: 'c' }, { aggregateId: 'agg-1', version: 3 }),
      ];

      for (const event of events) {
        await store.append(event);
      }

      const stored = await store.getEvents('agg-1');
      expect(stored).toHaveLength(3);
      expect((stored[0]?.payload as { key: string }).key).toBe('a');
      expect((stored[1]?.payload as { key: string }).key).toBe('b');
      expect((stored[2]?.payload as { key: string }).key).toBe('c');
    });

    it('should get current version', async () => {
      expect(await store.getVersion('new-agg')).toBe(0);

      const event = createMemoryEvent(
        'memory.stored',
        { key: 'test' },
        { aggregateId: 'new-agg', version: 1 }
      );
      await store.append(event);

      expect(await store.getVersion('new-agg')).toBe(1);
    });
  });

  describe('Event Store Correlation (INV-MEM-005)', () => {
    let store: InMemoryEventStore;

    beforeEach(() => {
      store = createInMemoryEventStore();
    });

    it('INV-MEM-005: should index events by correlation ID', async () => {
      const correlationId = crypto.randomUUID();

      const event1 = createMemoryEvent(
        'memory.stored',
        { key: 'a' },
        {
          aggregateId: 'agg-1',
          version: 1,
          metadata: { correlationId },
        }
      );

      const event2 = createMemoryEvent(
        'memory.stored',
        { key: 'b' },
        {
          aggregateId: 'agg-2',
          version: 1,
          metadata: { correlationId },
        }
      );

      const unrelatedEvent = createMemoryEvent(
        'memory.stored',
        { key: 'c' },
        { aggregateId: 'agg-3', version: 1 }
      );

      await store.append(event1);
      await store.append(event2);
      await store.append(unrelatedEvent);

      const correlated = await store.getEventsByCorrelation(correlationId);
      expect(correlated).toHaveLength(2);
    });

    it('should get events by type', async () => {
      await store.append(
        createMemoryEvent('memory.stored', { key: 'a' }, { aggregateId: 'agg-1', version: 1 })
      );
      await store.append(
        createMemoryEvent('memory.retrieved', { key: 'a', found: true }, { aggregateId: 'agg-1', version: 2 })
      );
      await store.append(
        createMemoryEvent('memory.stored', { key: 'b' }, { aggregateId: 'agg-2', version: 1 })
      );

      const stored = await store.getEventsByType('memory.stored');
      expect(stored).toHaveLength(2);
    });
  });

  describe('Aggregate Repository (INV-MEM-002)', () => {
    let store: EventStore;

    interface CounterState {
      count: number;
    }

    const initialState = (): CounterState => ({ count: 0 });

    const handler = (state: CounterState, event: MemoryEvent): CounterState => {
      const payload = event.payload as { delta?: number };
      return { count: state.count + (payload.delta ?? 0) };
    };

    beforeEach(() => {
      store = createInMemoryEventStore();
    });

    it('INV-MEM-002: should replay events consistently', async () => {
      const repo = createAggregateRepository(store, initialState, handler);

      // Store some events
      await store.append(
        createMemoryEvent(
          'memory.stored',
          { delta: 5 },
          { aggregateId: 'counter-1', version: 1 }
        )
      );
      await store.append(
        createMemoryEvent(
          'memory.stored',
          { delta: 3 },
          { aggregateId: 'counter-1', version: 2 }
        )
      );
      await store.append(
        createMemoryEvent(
          'memory.stored',
          { delta: -2 },
          { aggregateId: 'counter-1', version: 3 }
        )
      );

      // Replay should produce consistent state
      const result1 = await repo.load('counter-1');
      const result2 = await repo.load('counter-1');

      expect(result1.state.count).toBe(6); // 5 + 3 - 2
      expect(result2.state.count).toBe(6);
      expect(result1.version).toBe(3);
    });

    it('should support point-in-time queries', async () => {
      const repo = createAggregateRepository(store, initialState, handler);

      await store.append(
        createMemoryEvent(
          'memory.stored',
          { delta: 10 },
          { aggregateId: 'counter-1', version: 1 }
        )
      );
      await store.append(
        createMemoryEvent(
          'memory.stored',
          { delta: 5 },
          { aggregateId: 'counter-1', version: 2 }
        )
      );

      const atV1 = await repo.loadAtVersion('counter-1', 1);
      const atV2 = await repo.loadAtVersion('counter-1', 2);

      expect(atV1.state.count).toBe(10);
      expect(atV2.state.count).toBe(15);
    });

    it('should handle optimistic concurrency', async () => {
      const repo = createAggregateRepository(store, initialState, handler);

      await store.append(
        createMemoryEvent(
          'memory.stored',
          { delta: 1 },
          { aggregateId: 'counter-1', version: 1 }
        )
      );

      const newEvent = createMemoryEvent(
        'memory.stored',
        { delta: 1 },
        { aggregateId: 'counter-1', version: 2 }
      );

      // Should succeed with correct expected version
      await expect(repo.save('counter-1', newEvent, 1)).resolves.toBeUndefined();

      // Should fail with stale version
      const staleEvent = createMemoryEvent(
        'memory.stored',
        { delta: 1 },
        { aggregateId: 'counter-1', version: 3 }
      );

      try {
        await repo.save('counter-1', staleEvent, 1);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as EventStoreError).code).toBe(MemoryErrorCodes.VERSION_CONFLICT);
      }
    });
  });

  describe('Conversation Aggregate', () => {
    let store: InMemoryEventStore;
    let conversations: ConversationAggregate;

    beforeEach(() => {
      store = createInMemoryEventStore();
      conversations = createConversationAggregate(store);
    });

    it('should create a conversation', async () => {
      const conv = await conversations.create('conv-1', {
        title: 'Test Conversation',
        initialContext: { topic: 'testing' },
      });

      expect(conv.conversationId).toBe('conv-1');
      expect(conv.title).toBe('Test Conversation');
      expect(conv.context.topic).toBe('testing');
      expect(conv.messages).toHaveLength(0);
    });

    it('should add messages', async () => {
      await conversations.create('conv-1');

      let conv = await conversations.addMessage('conv-1', {
        messageId: 'msg-1',
        role: 'user',
        content: 'Hello!',
      });

      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0]?.content).toBe('Hello!');

      conv = await conversations.addMessage('conv-1', {
        messageId: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
      });

      expect(conv.messages).toHaveLength(2);
    });

    it('should update conversation metadata', async () => {
      await conversations.create('conv-1', { title: 'Original' });

      const updated = await conversations.update('conv-1', {
        title: 'Updated Title',
        context: { newKey: 'newValue' },
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.context.newKey).toBe('newValue');
    });

    it('should support point-in-time queries', async () => {
      await conversations.create('conv-1');
      await conversations.addMessage('conv-1', {
        messageId: 'msg-1',
        role: 'user',
        content: 'First',
      });
      await conversations.addMessage('conv-1', {
        messageId: 'msg-2',
        role: 'assistant',
        content: 'Second',
      });

      const atV2 = await conversations.getAtVersion('conv-1', 2);
      const atV3 = await conversations.getAtVersion('conv-1', 3);

      expect(atV2.messages).toHaveLength(1);
      expect(atV3.messages).toHaveLength(2);
    });
  });
});
