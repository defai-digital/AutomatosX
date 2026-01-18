import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMemoryEvent } from '@defai.digital/contracts';
import { createTraceEvent, createTrace } from '@defai.digital/contracts';
import { createSqliteEventStore, SqliteEventStoreError, SqliteEventStoreErrorCodes, createSqliteTraceStore, } from '@defai.digital/sqlite-adapter';
describe('SQLite Adapter', () => {
    let db;
    beforeEach(() => {
        // Create in-memory database for testing
        db = new Database(':memory:');
    });
    afterEach(() => {
        db.close();
    });
    describe('SqliteEventStore', () => {
        let store;
        beforeEach(() => {
            store = createSqliteEventStore(db);
        });
        describe('INV-MEM-001: Event Immutability', () => {
            it('should store events that cannot be modified', async () => {
                const event = createMemoryEvent('memory.stored', { key: 'test', value: 'original' }, { aggregateId: 'agg-1', version: 1 });
                await store.append(event);
                const events = await store.getEvents('agg-1');
                expect(events).toHaveLength(1);
                expect(events[0]?.payload).toEqual({ key: 'test', value: 'original' });
            });
        });
        describe('INV-MEM-004: Version Ordering', () => {
            it('should enforce version ordering', async () => {
                const event1 = createMemoryEvent('memory.stored', { key: 'test1' }, { aggregateId: 'agg-1', version: 1 });
                const event3 = createMemoryEvent('memory.stored', { key: 'test2' }, { aggregateId: 'agg-1', version: 3 } // Skipping version 2
                );
                await store.append(event1);
                // Should throw on version gap
                await expect(store.append(event3)).rejects.toThrow(SqliteEventStoreError);
                try {
                    await store.append(event3);
                }
                catch (err) {
                    expect(err.code).toBe(SqliteEventStoreErrorCodes.VERSION_CONFLICT);
                }
            });
            it('should return events in version order', async () => {
                const events = [
                    createMemoryEvent('memory.stored', { key: 'a' }, { aggregateId: 'agg-1', version: 1 }),
                    createMemoryEvent('memory.stored', { key: 'b' }, { aggregateId: 'agg-1', version: 2 }),
                    createMemoryEvent('memory.stored', { key: 'c' }, { aggregateId: 'agg-1', version: 3 }),
                ];
                for (const event of events) {
                    await store.append(event);
                }
                const retrieved = await store.getEvents('agg-1');
                expect(retrieved).toHaveLength(3);
                expect(retrieved.map((e) => e.payload.key)).toEqual([
                    'a',
                    'b',
                    'c',
                ]);
            });
        });
        describe('INV-MEM-005: Correlation Tracing', () => {
            it('should support querying by correlation ID', async () => {
                const correlationId = '550e8400-e29b-41d4-a716-446655440000';
                const event1 = createMemoryEvent('memory.stored', { key: 'a' }, {
                    aggregateId: 'agg-1',
                    version: 1,
                    metadata: { correlationId },
                });
                const event2 = createMemoryEvent('memory.stored', { key: 'b' }, {
                    aggregateId: 'agg-2',
                    version: 1,
                    metadata: { correlationId },
                });
                const unrelatedEvent = createMemoryEvent('memory.stored', { key: 'c' }, { aggregateId: 'agg-3', version: 1 });
                await store.append(event1);
                await store.append(event2);
                await store.append(unrelatedEvent);
                const correlatedEvents = await store.getEventsByCorrelation(correlationId);
                expect(correlatedEvents).toHaveLength(2);
                expect(correlatedEvents.map((e) => e.aggregateId)).toEqual(['agg-1', 'agg-2']);
            });
        });
        describe('Event Type Queries', () => {
            it('should support querying by event type', async () => {
                const events = [
                    createMemoryEvent('memory.stored', { key: 'a' }, { aggregateId: 'agg-1', version: 1 }),
                    createMemoryEvent('memory.deleted', { key: 'b' }, { aggregateId: 'agg-1', version: 2 }),
                    createMemoryEvent('memory.stored', { key: 'c' }, { aggregateId: 'agg-2', version: 1 }),
                ];
                for (const event of events) {
                    await store.append(event);
                }
                const storedEvents = await store.getEventsByType('memory.stored');
                expect(storedEvents).toHaveLength(2);
                const deletedEvents = await store.getEventsByType('memory.deleted');
                expect(deletedEvents).toHaveLength(1);
            });
        });
        describe('Version Tracking', () => {
            it('should track aggregate versions correctly', async () => {
                expect(await store.getVersion('new-agg')).toBe(0);
                await store.append(createMemoryEvent('memory.stored', { key: 'a' }, { aggregateId: 'new-agg', version: 1 }));
                expect(await store.getVersion('new-agg')).toBe(1);
                await store.append(createMemoryEvent('memory.stored', { key: 'b' }, { aggregateId: 'new-agg', version: 2 }));
                expect(await store.getVersion('new-agg')).toBe(2);
            });
        });
        describe('Error Handling', () => {
            it('should reject events with empty eventId', async () => {
                const event = createMemoryEvent('memory.stored', { key: 'test' });
                // Manually set empty eventId
                event.eventId = '';
                await expect(store.append(event)).rejects.toThrow(SqliteEventStoreError);
            });
            it('should reject duplicate events', async () => {
                const event = createMemoryEvent('memory.stored', { key: 'test' }, { aggregateId: 'agg-1', version: 1 });
                await store.append(event);
                await expect(store.append(event)).rejects.toThrow(SqliteEventStoreError);
            });
        });
    });
    describe('SqliteTraceStore', () => {
        let store;
        beforeEach(() => {
            store = createSqliteTraceStore(db);
        });
        describe('INV-TR-002: Event Ordering', () => {
            it('should store and retrieve events in sequence order', async () => {
                const { traceId } = createTrace();
                const events = [
                    createTraceEvent(traceId, 'run.start', { sequence: 0 }),
                    createTraceEvent(traceId, 'step.execute', { sequence: 1 }),
                    createTraceEvent(traceId, 'step.execute', { sequence: 2 }),
                    createTraceEvent(traceId, 'run.end', { sequence: 3 }),
                ];
                for (const event of events) {
                    await store.write(event);
                }
                const retrieved = await store.getTrace(traceId);
                expect(retrieved).toHaveLength(4);
                expect(retrieved.map((e) => e.sequence)).toEqual([0, 1, 2, 3]);
                expect(retrieved.map((e) => e.type)).toEqual([
                    'run.start',
                    'step.execute',
                    'step.execute',
                    'run.end',
                ]);
            });
        });
        describe('INV-TR-004: Trace Isolation', () => {
            it('should keep traces independent', async () => {
                const trace1 = createTrace();
                const trace2 = createTrace();
                await store.write(createTraceEvent(trace1.traceId, 'run.start', { sequence: 0 }));
                await store.write(createTraceEvent(trace2.traceId, 'run.start', { sequence: 0 }));
                await store.write(createTraceEvent(trace1.traceId, 'run.end', { sequence: 1 }));
                const events1 = await store.getTrace(trace1.traceId);
                const events2 = await store.getTrace(trace2.traceId);
                expect(events1).toHaveLength(2);
                expect(events2).toHaveLength(1);
            });
        });
        describe('Trace Summaries', () => {
            it('should track trace summaries', async () => {
                const { traceId } = createTrace();
                await store.write(createTraceEvent(traceId, 'run.start', { sequence: 0, status: 'running' }));
                await store.write(createTraceEvent(traceId, 'step.execute', { sequence: 1 }));
                await store.write(createTraceEvent(traceId, 'error', { sequence: 2, status: 'failure' }));
                const summaries = await store.listTraces(10);
                expect(summaries).toHaveLength(1);
                expect(summaries[0]?.traceId).toBe(traceId);
                expect(summaries[0]?.eventCount).toBe(3);
                expect(summaries[0]?.errorCount).toBe(1);
            });
            it('should list traces in reverse chronological order', async () => {
                const traces = [createTrace(), createTrace(), createTrace()];
                for (const trace of traces) {
                    await store.write(createTraceEvent(trace.traceId, 'run.start', { sequence: 0 }));
                }
                const summaries = await store.listTraces(10);
                expect(summaries).toHaveLength(3);
                // Most recent first
                expect(summaries[0]?.traceId).toBe(traces[2]?.traceId);
            });
        });
        describe('Event Retrieval', () => {
            it('should retrieve specific events', async () => {
                const { traceId } = createTrace();
                const event = createTraceEvent(traceId, 'step.execute', {
                    sequence: 0,
                    payload: { stepId: 'test-step' },
                });
                await store.write(event);
                const retrieved = await store.getEvent(traceId, event.eventId);
                expect(retrieved).toBeDefined();
                expect(retrieved?.eventId).toBe(event.eventId);
                expect(retrieved?.payload).toEqual({ stepId: 'test-step' });
            });
            it('should return undefined for non-existent events', async () => {
                const event = await store.getEvent('non-existent', 'also-non-existent');
                expect(event).toBeUndefined();
            });
        });
        describe('Event Attributes', () => {
            it('should preserve all event attributes', async () => {
                const { traceId } = createTrace();
                const event = createTraceEvent(traceId, 'step.execute', {
                    sequence: 0,
                    parentEventId: 'parent-123',
                    payload: { stepId: 'test-step', result: { value: 42 } },
                    context: { workflowId: 'wf-1', provider: 'test' },
                    status: 'success',
                });
                event.durationMs = 150;
                await store.write(event);
                const retrieved = await store.getTrace(traceId);
                expect(retrieved).toHaveLength(1);
                const r = retrieved[0];
                expect(r?.sequence).toBe(0);
                expect(r?.parentEventId).toBe('parent-123');
                expect(r?.payload).toEqual({ stepId: 'test-step', result: { value: 42 } });
                expect(r?.context).toEqual({ workflowId: 'wf-1', provider: 'test' });
                expect(r?.status).toBe('success');
                expect(r?.durationMs).toBe(150);
            });
        });
    });
});
//# sourceMappingURL=sqlite-adapter.test.js.map