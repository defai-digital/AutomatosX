import { describe, it, expect } from 'vitest';
import { TraceEventSchema, TraceEventTypeSchema, TraceStatusSchema, TraceContextSchema, RunStartPayloadSchema, RunEndPayloadSchema, createTraceEvent, createTrace, validateTraceEvent, safeValidateTraceEvent, validateTrace, isTraceComplete, getOrderedEvents, } from '@automatosx/contracts';
describe('Trace Event Contract V1', () => {
    describe('Schema Validation', () => {
        it('should validate a minimal trace event', () => {
            const event = {
                traceId: '550e8400-e29b-41d4-a716-446655440000',
                eventId: '550e8400-e29b-41d4-a716-446655440001',
                type: 'run.start',
                timestamp: '2024-12-14T12:00:00Z',
            };
            const result = safeValidateTraceEvent(event);
            expect(result.success).toBe(true);
        });
        it('should validate a complete trace event', () => {
            const event = {
                traceId: '550e8400-e29b-41d4-a716-446655440000',
                eventId: '550e8400-e29b-41d4-a716-446655440001',
                parentEventId: '550e8400-e29b-41d4-a716-446655440002',
                type: 'step.execute',
                timestamp: '2024-12-14T12:00:00Z',
                durationMs: 1500,
                sequence: 3,
                payload: {
                    stepId: 'step-1',
                    stepType: 'prompt',
                    input: { query: 'test' },
                    output: { response: 'result' },
                },
                context: {
                    workflowId: 'wf-123',
                    stepId: 'step-1',
                    model: 'claude-3',
                    provider: 'anthropic',
                    userId: 'user-1',
                },
                status: 'success',
            };
            const result = validateTraceEvent(event);
            expect(result.type).toBe('step.execute');
            expect(result.durationMs).toBe(1500);
        });
        it('should reject event without required fields', () => {
            const invalid = {
                traceId: '550e8400-e29b-41d4-a716-446655440000',
                // missing eventId, type, timestamp
            };
            const result = safeValidateTraceEvent(invalid);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-TR-001: Complete Event Chain', () => {
        it('should detect complete trace', () => {
            const events = [
                {
                    traceId: 'trace-1',
                    eventId: 'event-1',
                    type: 'run.start',
                    timestamp: '2024-12-14T12:00:00Z',
                    sequence: 0,
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-2',
                    type: 'step.execute',
                    timestamp: '2024-12-14T12:00:01Z',
                    sequence: 1,
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-3',
                    type: 'run.end',
                    timestamp: '2024-12-14T12:00:02Z',
                    sequence: 2,
                },
            ];
            expect(isTraceComplete(events)).toBe(true);
        });
        it('should detect incomplete trace (missing run.end)', () => {
            const events = [
                {
                    traceId: 'trace-1',
                    eventId: 'event-1',
                    type: 'run.start',
                    timestamp: '2024-12-14T12:00:00Z',
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-2',
                    type: 'step.execute',
                    timestamp: '2024-12-14T12:00:01Z',
                },
            ];
            expect(isTraceComplete(events)).toBe(false);
        });
        it('should detect incomplete trace (missing run.start)', () => {
            const events = [
                {
                    traceId: 'trace-1',
                    eventId: 'event-1',
                    type: 'step.execute',
                    timestamp: '2024-12-14T12:00:00Z',
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-2',
                    type: 'run.end',
                    timestamp: '2024-12-14T12:00:01Z',
                },
            ];
            expect(isTraceComplete(events)).toBe(false);
        });
    });
    describe('INV-TR-002: Strict Event Ordering', () => {
        it('should order events by sequence', () => {
            const events = [
                {
                    traceId: 'trace-1',
                    eventId: 'event-3',
                    type: 'run.end',
                    timestamp: '2024-12-14T12:00:02Z',
                    sequence: 2,
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-1',
                    type: 'run.start',
                    timestamp: '2024-12-14T12:00:00Z',
                    sequence: 0,
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-2',
                    type: 'step.execute',
                    timestamp: '2024-12-14T12:00:01Z',
                    sequence: 1,
                },
            ];
            const ordered = getOrderedEvents(events);
            expect(ordered[0]?.type).toBe('run.start');
            expect(ordered[1]?.type).toBe('step.execute');
            expect(ordered[2]?.type).toBe('run.end');
        });
        it('should order events by timestamp when sequence is missing', () => {
            const events = [
                {
                    traceId: 'trace-1',
                    eventId: 'event-2',
                    type: 'step.execute',
                    timestamp: '2024-12-14T12:00:01Z',
                },
                {
                    traceId: 'trace-1',
                    eventId: 'event-1',
                    type: 'run.start',
                    timestamp: '2024-12-14T12:00:00Z',
                },
            ];
            const ordered = getOrderedEvents(events);
            expect(ordered[0]?.type).toBe('run.start');
            expect(ordered[1]?.type).toBe('step.execute');
        });
        it('should validate sequence is non-negative integer', () => {
            const invalidSequences = [-1, 1.5];
            for (const sequence of invalidSequences) {
                const event = {
                    traceId: '550e8400-e29b-41d4-a716-446655440000',
                    eventId: '550e8400-e29b-41d4-a716-446655440001',
                    type: 'run.start',
                    timestamp: '2024-12-14T12:00:00Z',
                    sequence,
                };
                const result = TraceEventSchema.safeParse(event);
                expect(result.success).toBe(false);
            }
        });
    });
    describe('Event Type Validation', () => {
        it('should accept all valid event types', () => {
            const validTypes = [
                'run.start',
                'run.end',
                'decision.routing',
                'step.start',
                'step.execute',
                'step.end',
                'tool.invoke',
                'tool.result',
                'memory.write',
                'memory.read',
                'error',
            ];
            for (const type of validTypes) {
                const result = TraceEventTypeSchema.safeParse(type);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid event types', () => {
            const result = TraceEventTypeSchema.safeParse('invalid.type');
            expect(result.success).toBe(false);
        });
    });
    describe('Status Validation', () => {
        it('should accept all valid statuses', () => {
            const validStatuses = [
                'pending',
                'running',
                'success',
                'failure',
                'skipped',
            ];
            for (const status of validStatuses) {
                const result = TraceStatusSchema.safeParse(status);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('Payload Validation', () => {
        it('should validate run.start payload', () => {
            const payload = {
                workflowId: 'wf-123',
                workflowVersion: '1.0.0',
                input: { query: 'test' },
            };
            const result = RunStartPayloadSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });
        it('should validate run.end payload', () => {
            const payload = {
                success: true,
                output: { result: 'done' },
                totalDurationMs: 5000,
                stepCount: 3,
            };
            const result = RunEndPayloadSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });
        it('should validate failure run.end payload', () => {
            const payload = {
                success: false,
                error: {
                    code: 'STEP_FAILED',
                    message: 'Step execution failed',
                },
                totalDurationMs: 1000,
                stepCount: 1,
            };
            const result = RunEndPayloadSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });
    });
    describe('Context Validation', () => {
        it('should validate trace context', () => {
            const context = {
                workflowId: 'wf-123',
                stepId: 'step-1',
                model: 'claude-3',
                provider: 'anthropic',
                userId: 'user-1',
            };
            const result = TraceContextSchema.safeParse(context);
            expect(result.success).toBe(true);
        });
    });
    describe('Complete Trace Validation', () => {
        it('should validate a complete trace object', () => {
            const trace = {
                traceId: '550e8400-e29b-41d4-a716-446655440000',
                startTime: '2024-12-14T12:00:00Z',
                endTime: '2024-12-14T12:00:05Z',
                events: [
                    {
                        traceId: '550e8400-e29b-41d4-a716-446655440000',
                        eventId: '550e8400-e29b-41d4-a716-446655440001',
                        type: 'run.start',
                        timestamp: '2024-12-14T12:00:00Z',
                        sequence: 0,
                    },
                    {
                        traceId: '550e8400-e29b-41d4-a716-446655440000',
                        eventId: '550e8400-e29b-41d4-a716-446655440002',
                        type: 'run.end',
                        timestamp: '2024-12-14T12:00:05Z',
                        sequence: 1,
                    },
                ],
                status: 'success',
                summary: {
                    totalDurationMs: 5000,
                    eventCount: 2,
                    errorCount: 0,
                },
            };
            const result = validateTrace(trace);
            expect(result.traceId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.events).toHaveLength(2);
        });
    });
    describe('Helper Functions', () => {
        it('should create trace event with correct structure', () => {
            const event = createTraceEvent('trace-123', 'step.execute', {
                parentEventId: 'parent-1',
                payload: { stepId: 'step-1', stepType: 'prompt' },
                context: { workflowId: 'wf-1' },
                status: 'running',
                sequence: 5,
            });
            expect(event.traceId).toBe('trace-123');
            expect(event.type).toBe('step.execute');
            expect(event.parentEventId).toBe('parent-1');
            expect(event.sequence).toBe(5);
        });
        it('should create new trace with UUID', () => {
            const trace = createTrace();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            expect(trace.traceId).toMatch(uuidRegex);
            expect(trace.startTime).toBeDefined();
        });
    });
});
//# sourceMappingURL=trace.test.js.map