import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as EventBus from '../../../packages/rescript-core/src/events/EventBus.gen';

describe('EventBus - Creation', () => {
  it('should create default config', () => {
    const config = EventBus.createConfig(undefined, undefined, undefined, undefined, undefined);

    expect(config.maxHistorySize).toBe(1000);
    expect(config.enableHistory).toBe(true);
    expect(config.enableFiltering).toBe(true);
    expect(config.defaultPriority).toBe(0);
  });

  it('should create custom config', () => {
    const config = EventBus.createConfig(500, false, false, 5, undefined);

    expect(config.maxHistorySize).toBe(500);
    expect(config.enableHistory).toBe(false);
    expect(config.enableFiltering).toBe(false);
    expect(config.defaultPriority).toBe(5);
  });

  it('should create event bus with default config', () => {
    const bus = EventBus.create(undefined, undefined);

    expect(bus.eventCount).toBe(0);
    expect(bus.errorCount).toBe(0);
    expect(bus.history).toEqual([]);
    expect(bus.config.maxHistorySize).toBe(1000);
  });

  it('should create event bus with custom config', () => {
    const config = EventBus.createConfig(100, false, true, 10, undefined);
    const bus = EventBus.create(config, undefined);

    expect(bus.config.maxHistorySize).toBe(100);
    expect(bus.config.enableHistory).toBe(false);
    expect(bus.config.defaultPriority).toBe(10);
  });
});

describe('EventBus - Subscriptions', () => {
  let bus: any;

  beforeEach(() => {
    bus = EventBus.create(undefined, undefined);
  });

  it('should subscribe to event pattern', () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);

    expect(result.TAG).toBe('Ok');
    const [newBus, subId] = result._0;
    expect(typeof subId).toBe('string');
    expect(subId.startsWith('sub-')).toBe(true);
  });

  it('should subscribe with custom priority', () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result = EventBus.subscribe(bus, 'test.event', handler, 10, undefined);

    expect(result.TAG).toBe('Ok');
    const [newBus, subId] = result._0;

    const sub = EventBus.getSubscription(newBus, subId);
    expect(sub).toBeDefined();
    expect(sub!.priority).toBe(10);
  });

  it('should get subscription by ID', () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [newBus, subId] = result._0;

    const sub = EventBus.getSubscription(newBus, subId);
    expect(sub).toBeDefined();
    expect(sub!.id).toBe(subId);
    expect(sub!.pattern).toBe('test.event');
    expect(sub!.active).toBe(true);
  });

  it('should return undefined for non-existent subscription', () => {
    const sub = EventBus.getSubscription(bus, 'non-existent');
    expect(sub).toBeUndefined();
  });

  it('should unsubscribe', () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2, subId] = subscribeResult._0;

    const unsubResult = EventBus.unsubscribe(bus2, subId);
    expect(unsubResult.TAG).toBe('Ok');

    const sub = EventBus.getSubscription(unsubResult._0, subId);
    expect(sub).toBeUndefined();
  });

  it('should fail to unsubscribe non-existent subscription', () => {
    const result = EventBus.unsubscribe(bus, 'non-existent');

    expect(result.TAG).toBe('Error');
    expect(result._0).toContain('Subscriber not found');
  });

  it('should pause subscription', () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2, subId] = subscribeResult._0;

    const pauseResult = EventBus.pauseSubscription(bus2, subId);
    expect(pauseResult.TAG).toBe('Ok');

    const sub = EventBus.getSubscription(pauseResult._0, subId);
    expect(sub!.active).toBe(false);
  });

  it('should resume subscription', () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2, subId] = subscribeResult._0;

    const pauseResult = EventBus.pauseSubscription(bus2, subId);
    const resumeResult = EventBus.resumeSubscription(pauseResult._0, subId);

    expect(resumeResult.TAG).toBe('Ok');
    const sub = EventBus.getSubscription(resumeResult._0, subId);
    expect(sub!.active).toBe(true);
  });

  it('should get all subscriptions', () => {
    const handler1 = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));
    const handler2 = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result1 = EventBus.subscribe(bus, 'event.1', handler1, undefined, undefined);
    const [bus2] = result1._0;
    const result2 = EventBus.subscribe(bus2, 'event.2', handler2, undefined, undefined);
    const [bus3] = result2._0;

    const allSubs = EventBus.getAllSubscriptions(bus3);
    expect(allSubs.length).toBe(2);
  });

  it('should get only active subscriptions', () => {
    const handler1 = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));
    const handler2 = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result1 = EventBus.subscribe(bus, 'event.1', handler1, undefined, undefined);
    const [bus2, subId1] = result1._0;
    const result2 = EventBus.subscribe(bus2, 'event.2', handler2, undefined, undefined);
    const [bus3] = result2._0;

    const pauseResult = EventBus.pauseSubscription(bus3, subId1);

    const activeSubs = EventBus.getActiveSubscriptions(pauseResult._0);
    expect(activeSubs.length).toBe(1);
    expect(activeSubs[0].pattern).toBe('event.2');
  });
});

describe('EventBus - Event Creation', () => {
  it('should create event with minimal parameters', () => {
    const event = EventBus.createEvent(
      'test.event',
      JSON.parse('{"data": "test"}'),
      undefined,
      undefined,
      undefined,
      undefined
    );

    expect(event.eventType).toBe('test.event');
    expect(event.id.startsWith('event-')).toBe(true);
    expect(event.priority).toBe(0);
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('should create event with all parameters', () => {
    const metadata = { key: 'value' };
    const event = EventBus.createEvent(
      'test.event',
      JSON.parse('{"data": "test"}'),
      'source-system',
      metadata,
      5,
      undefined
    );

    expect(event.eventType).toBe('test.event');
    expect(event.source).toBe('source-system');
    expect(event.metadata).toEqual(metadata);
    expect(event.priority).toBe(5);
  });
});

describe('EventBus - Event Publishing', () => {
  let bus: any;

  beforeEach(() => {
    bus = EventBus.create(undefined, undefined);
  });

  it('should publish event with no subscribers', async () => {
    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);

    const result = await EventBus.publish(bus, event);

    expect(result.TAG).toBe('Ok');
    expect(result._0.eventCount).toBe(1);
    expect(result._0.history.length).toBe(1);
  });

  it('should call matching subscriber', async () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const publishResult = await EventBus.publish(bus2, event);

    expect(publishResult.TAG).toBe('Ok');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'test.event'
    }));
  });

  it('should call multiple subscribers in priority order', async () => {
    const callOrder: number[] = [];
    const handler1 = vi.fn(async () => {
      callOrder.push(1);
      return { TAG: 'Ok', _0: undefined };
    });
    const handler2 = vi.fn(async () => {
      callOrder.push(2);
      return { TAG: 'Ok', _0: undefined };
    });

    // Subscribe with different priorities (higher priority should be called first)
    const result1 = EventBus.subscribe(bus, 'test.event', handler1, 1, undefined);
    const [bus2] = result1._0;
    const result2 = EventBus.subscribe(bus2, 'test.event', handler2, 10, undefined);
    const [bus3] = result2._0;

    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    await EventBus.publish(bus3, event);

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    // Handler2 has higher priority (10 vs 1) so should be first in the sorted array
    expect(callOrder[0]).toBe(2);
  });

  it('should match wildcard pattern', async () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, '*', handler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const event = EventBus.createEvent('any.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    await EventBus.publish(bus2, event);

    expect(handler).toHaveBeenCalled();
  });

  it('should match prefix wildcard pattern', async () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'workflow.*', handler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const event1 = EventBus.createEvent('workflow.started', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const event2 = EventBus.createEvent('task.started', JSON.parse('{}'), undefined, undefined, undefined, undefined);

    await EventBus.publish(bus2, event1);
    await EventBus.publish(bus2, event2);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not call paused subscribers', async () => {
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2, subId] = subscribeResult._0;

    const pauseResult = EventBus.pauseSubscription(bus2, subId);

    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    await EventBus.publish(pauseResult._0, event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should track errors from handlers', async () => {
    const errorHandler = vi.fn(async () => ({ TAG: 'Error', _0: 'Handler failed' }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', errorHandler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const publishResult = await EventBus.publish(bus2, event);

    expect(publishResult.TAG).toBe('Ok');
    expect(publishResult._0.errorCount).toBe(1);
  });

  it('should add events to history', async () => {
    const event1 = EventBus.createEvent('event.1', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const event2 = EventBus.createEvent('event.2', JSON.parse('{}'), undefined, undefined, undefined, undefined);

    const result1 = await EventBus.publish(bus, event1);
    const result2 = await EventBus.publish(result1._0, event2);

    expect(result2._0.history.length).toBe(2);
  });

  it('should trim history when exceeding max size', async () => {
    const config = EventBus.createConfig(2, true, true, 0, undefined);
    const smallBus = EventBus.create(config, undefined);

    const event1 = EventBus.createEvent('event.1', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const event2 = EventBus.createEvent('event.2', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const event3 = EventBus.createEvent('event.3', JSON.parse('{}'), undefined, undefined, undefined, undefined);

    const result1 = await EventBus.publish(smallBus, event1);
    const result2 = await EventBus.publish(result1._0, event2);
    const result3 = await EventBus.publish(result2._0, event3);

    expect(result3._0.history.length).toBe(2);
    expect(result3._0.history[0].eventType).toBe('event.2'); // event.1 was trimmed
    expect(result3._0.history[1].eventType).toBe('event.3');
  });
});

describe('EventBus - Event History', () => {
  let bus: any;

  beforeEach(async () => {
    bus = EventBus.create(undefined, undefined);

    // Add some events to history
    const event1 = EventBus.createEvent('event.1', JSON.parse('{}'), 'source-1', undefined, undefined, undefined);
    const event2 = EventBus.createEvent('event.2', JSON.parse('{}'), 'source-2', undefined, undefined, undefined);
    const event3 = EventBus.createEvent('event.1', JSON.parse('{}'), 'source-1', undefined, undefined, undefined);

    const result1 = await EventBus.publish(bus, event1);
    const result2 = await EventBus.publish(result1._0, event2);
    bus = (await EventBus.publish(result2._0, event3))._0;
  });

  it('should get full history without filter', () => {
    const history = EventBus.getHistory(bus, undefined, undefined);
    expect(history.length).toBe(3);
  });

  it('should filter history by event type', () => {
    const filter = EventBus.createFilter('event.1', undefined, undefined, undefined, undefined, undefined);
    const history = EventBus.getHistory(bus, filter, undefined);

    expect(history.length).toBe(2);
    expect(history.every(e => e.eventType === 'event.1')).toBe(true);
  });

  it('should filter history by source', () => {
    const filter = EventBus.createFilter(undefined, 'source-2', undefined, undefined, undefined, undefined);
    const history = EventBus.getHistory(bus, filter, undefined);

    expect(history.length).toBe(1);
    expect(history[0].source).toBe('source-2');
  });

  it('should filter history with limit', () => {
    const filter = EventBus.createFilter(undefined, undefined, undefined, undefined, 2, undefined);
    const history = EventBus.getHistory(bus, filter, undefined);

    expect(history.length).toBe(2);
  });

  it('should clear history', () => {
    const clearedBus = EventBus.clearHistory(bus);
    expect(clearedBus.history.length).toBe(0);
  });

  it('should get events by type', () => {
    const events = EventBus.getEventsByType(bus, 'event.1', undefined, undefined);
    expect(events.length).toBe(2);
  });

  it('should get events by type with limit', () => {
    const events = EventBus.getEventsByType(bus, 'event.1', 1, undefined);
    expect(events.length).toBe(1);
  });

  it('should get events by source', () => {
    const events = EventBus.getEventsBySource(bus, 'source-1', undefined, undefined);
    expect(events.length).toBe(2);
  });

  it('should get recent events', () => {
    const recent = EventBus.getRecentEvents(bus, 2);
    expect(recent.length).toBe(2);
    expect(recent[1].eventType).toBe('event.1'); // Most recent
  });
});

describe('EventBus - Statistics', () => {
  it('should calculate statistics for empty bus', () => {
    const bus = EventBus.create(undefined, undefined);
    const stats = EventBus.getStats(bus);

    expect(stats.totalEvents).toBe(0);
    expect(stats.totalSubscribers).toBe(0);
    expect(stats.activeSubscribers).toBe(0);
    expect(stats.historySize).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it('should calculate statistics with subscribers', async () => {
    const bus = EventBus.create(undefined, undefined);
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result1 = EventBus.subscribe(bus, 'event.1', handler, undefined, undefined);
    const [bus2] = result1._0;
    const result2 = EventBus.subscribe(bus2, 'event.2', handler, undefined, undefined);
    const [bus3] = result2._0;

    const stats = EventBus.getStats(bus3);
    expect(stats.totalSubscribers).toBe(2);
    expect(stats.activeSubscribers).toBe(2);
  });

  it('should track error count', async () => {
    const bus = EventBus.create(undefined, undefined);
    const errorHandler = vi.fn(async () => ({ TAG: 'Error', _0: 'Failed' }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', errorHandler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const publishResult = await EventBus.publish(bus2, event);

    const stats = EventBus.getStats(publishResult._0);
    expect(stats.errorCount).toBe(1);
  });
});

describe('EventBus - Utility Functions', () => {
  it('should check if bus has subscribers for pattern', () => {
    const bus = EventBus.create(undefined, undefined);
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    expect(EventBus.hasSubscribers(bus2, 'test.event')).toBe(true);
    expect(EventBus.hasSubscribers(bus2, 'other.event')).toBe(false);
  });

  it('should get subscriber count for pattern', () => {
    const bus = EventBus.create(undefined, undefined);
    const handler1 = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));
    const handler2 = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const result1 = EventBus.subscribe(bus, 'test.event', handler1, undefined, undefined);
    const [bus2] = result1._0;
    const result2 = EventBus.subscribe(bus2, 'test.event', handler2, undefined, undefined);
    const [bus3] = result2._0;

    expect(EventBus.getSubscriberCount(bus3, 'test.event')).toBe(2);
    expect(EventBus.getSubscriberCount(bus3, 'other.event')).toBe(0);
  });

  it('should reset bus', () => {
    const bus = EventBus.create(undefined, undefined);
    const handler = vi.fn(async () => ({ TAG: 'Ok', _0: undefined }));

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const resetBus = EventBus.reset(bus2);

    expect(resetBus.eventCount).toBe(0);
    expect(resetBus.errorCount).toBe(0);
    expect(resetBus.history.length).toBe(0);
    expect(EventBus.getAllSubscriptions(resetBus).length).toBe(0);
  });
});

describe('EventBus - Sync Publishing', () => {
  it('should publish event synchronously', () => {
    const bus = EventBus.create(undefined, undefined);
    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);

    const result = EventBus.publishSync(bus, event);

    expect(result.TAG).toBe('Ok');
    expect(result._0.eventCount).toBe(1);
    expect(result._0.history.length).toBe(1);
  });

  it('should fire subscribers without waiting', () => {
    const bus = EventBus.create(undefined, undefined);
    const handler = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { TAG: 'Ok', _0: undefined };
    });

    const subscribeResult = EventBus.subscribe(bus, 'test.event', handler, undefined, undefined);
    const [bus2] = subscribeResult._0;

    const event = EventBus.createEvent('test.event', JSON.parse('{}'), undefined, undefined, undefined, undefined);
    const result = EventBus.publishSync(bus2, event);

    // Sync publish returns immediately without waiting for handlers
    expect(result.TAG).toBe('Ok');
    // Handler will be called but we don't wait for it
  });
});
