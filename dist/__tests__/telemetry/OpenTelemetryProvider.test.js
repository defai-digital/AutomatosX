/**
 * OpenTelemetry Provider Tests
 * Sprint 5 Day 42: OTLP integration tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenTelemetryProvider, createOTelProvider, getOTelProvider, setOTelProvider, resetOTelProvider, } from '../../telemetry/OpenTelemetryProvider.js';
describe('OpenTelemetryProvider', () => {
    let provider;
    beforeEach(() => {
        provider = createOTelProvider({
            serviceName: 'test-service',
            enabled: true,
        });
    });
    describe('Configuration', () => {
        it('should create provider with config', () => {
            const provider = createOTelProvider({
                serviceName: 'my-service',
                serviceVersion: '1.0.0',
                endpoint: 'http://localhost:4318',
                enabled: true,
                sampleRate: 0.5,
            });
            expect(provider).toBeInstanceOf(OpenTelemetryProvider);
        });
        it('should default to enabled', () => {
            const provider = createOTelProvider({ serviceName: 'test' });
            expect(provider.isEnabled()).toBe(true);
        });
        it('should respect enabled flag', () => {
            const provider = createOTelProvider({
                serviceName: 'test',
                enabled: false,
            });
            expect(provider.isEnabled()).toBe(false);
        });
    });
    describe('Span Operations', () => {
        it('should start a span', () => {
            const span = provider.startSpan('test-span');
            expect(span).toMatchObject({
                name: 'test-span',
                context: {
                    traceId: expect.any(String),
                    spanId: expect.any(String),
                },
                startTime: expect.any(Number),
                attributes: {},
                events: [],
                status: 'ok',
            });
        });
        it('should start span with attributes', () => {
            const span = provider.startSpan('test-span', {
                userId: '123',
                action: 'create',
            });
            expect(span.attributes).toEqual({
                userId: '123',
                action: 'create',
            });
        });
        it('should end a span', () => {
            const span = provider.startSpan('test-span');
            expect(span.endTime).toBeUndefined();
            expect(span.duration).toBeUndefined();
            provider.endSpan(span);
            expect(span.endTime).toBeGreaterThan(span.startTime);
            expect(span.duration).toBeGreaterThan(0);
        });
        it('should add span to completed list after ending', () => {
            const span = provider.startSpan('test-span');
            provider.endSpan(span);
            const completed = provider.getCompletedSpans();
            expect(completed).toContainEqual(span);
        });
        it('should remove span from active list after ending', () => {
            const span = provider.startSpan('test-span');
            expect(provider.getActiveSpans()).toHaveLength(1);
            provider.endSpan(span);
            expect(provider.getActiveSpans()).toHaveLength(0);
        });
        it('should emit span-started event', () => {
            const listener = vi.fn();
            provider.on('span-started', listener);
            const span = provider.startSpan('test-span');
            expect(listener).toHaveBeenCalledWith(span);
        });
        it('should emit span-ended event', () => {
            const listener = vi.fn();
            provider.on('span-ended', listener);
            const span = provider.startSpan('test-span');
            provider.endSpan(span);
            expect(listener).toHaveBeenCalledWith(span);
        });
    });
    describe('Child Spans', () => {
        it('should create child span', () => {
            const parent = provider.startSpan('parent');
            const child = provider.startChildSpan(parent, 'child');
            expect(child.context.traceId).toBe(parent.context.traceId);
            expect(child.context.parentSpanId).toBe(parent.context.spanId);
            expect(child.context.spanId).not.toBe(parent.context.spanId);
        });
        it('should create child span with attributes', () => {
            const parent = provider.startSpan('parent');
            const child = provider.startChildSpan(parent, 'child', {
                step: 1,
            });
            expect(child.attributes).toEqual({ step: 1 });
        });
        it('should track multiple child spans', () => {
            const parent = provider.startSpan('parent');
            const child1 = provider.startChildSpan(parent, 'child-1');
            const child2 = provider.startChildSpan(parent, 'child-2');
            expect(provider.getActiveSpans()).toHaveLength(3);
            expect(child1.context.parentSpanId).toBe(parent.context.spanId);
            expect(child2.context.parentSpanId).toBe(parent.context.spanId);
        });
    });
    describe('Span Attributes', () => {
        it('should set span attribute', () => {
            const span = provider.startSpan('test');
            provider.setSpanAttribute(span, 'key', 'value');
            expect(span.attributes.key).toBe('value');
        });
        it('should update existing attribute', () => {
            const span = provider.startSpan('test', { key: 'old' });
            provider.setSpanAttribute(span, 'key', 'new');
            expect(span.attributes.key).toBe('new');
        });
        it('should set multiple attributes', () => {
            const span = provider.startSpan('test');
            provider.setSpanAttribute(span, 'key1', 'value1');
            provider.setSpanAttribute(span, 'key2', 'value2');
            expect(span.attributes).toMatchObject({
                key1: 'value1',
                key2: 'value2',
            });
        });
    });
    describe('Span Events', () => {
        it('should add event to span', () => {
            const span = provider.startSpan('test');
            provider.addSpanEvent(span, 'checkpoint-1');
            expect(span.events).toHaveLength(1);
            expect(span.events[0]).toMatchObject({
                name: 'checkpoint-1',
                timestamp: expect.any(Number),
            });
        });
        it('should add event with attributes', () => {
            const span = provider.startSpan('test');
            provider.addSpanEvent(span, 'checkpoint', {
                step: 1,
                progress: '50%',
            });
            expect(span.events[0].attributes).toEqual({
                step: 1,
                progress: '50%',
            });
        });
        it('should add multiple events', () => {
            const span = provider.startSpan('test');
            provider.addSpanEvent(span, 'start');
            provider.addSpanEvent(span, 'middle');
            provider.addSpanEvent(span, 'end');
            expect(span.events).toHaveLength(3);
            expect(span.events[0].name).toBe('start');
            expect(span.events[1].name).toBe('middle');
            expect(span.events[2].name).toBe('end');
        });
        it('should emit span-event event', () => {
            const listener = vi.fn();
            provider.on('span-event', listener);
            const span = provider.startSpan('test');
            provider.addSpanEvent(span, 'checkpoint');
            expect(listener).toHaveBeenCalledWith({
                span,
                event: expect.objectContaining({ name: 'checkpoint' }),
            });
        });
    });
    describe('Span Status', () => {
        it('should set span status to ok', () => {
            const span = provider.startSpan('test');
            provider.setSpanStatus(span, 'ok');
            expect(span.status).toBe('ok');
            expect(span.error).toBeUndefined();
        });
        it('should set span status to error', () => {
            const span = provider.startSpan('test');
            const error = new Error('Test error');
            provider.setSpanStatus(span, 'error', error);
            expect(span.status).toBe('error');
            expect(span.error).toBe(error);
            expect(span.attributes.error).toBe('Test error');
            expect(span.attributes.errorStack).toBe(error.stack);
        });
        it('should set error status without error object', () => {
            const span = provider.startSpan('test');
            provider.setSpanStatus(span, 'error');
            expect(span.status).toBe('error');
            expect(span.error).toBeUndefined();
        });
    });
    describe('Metrics', () => {
        it('should record counter metric', () => {
            provider.recordMetric('requests', 'counter', 1);
            const metrics = provider.getMetrics();
            expect(metrics).toHaveLength(1);
            expect(metrics[0]).toMatchObject({
                name: 'requests',
                type: 'counter',
                value: 1,
                timestamp: expect.any(Number),
            });
        });
        it('should record gauge metric', () => {
            provider.recordMetric('memory_usage', 'gauge', 1024);
            const metrics = provider.getMetrics();
            expect(metrics[0].type).toBe('gauge');
            expect(metrics[0].value).toBe(1024);
        });
        it('should record histogram metric', () => {
            provider.recordMetric('request_duration', 'histogram', 123.45);
            const metrics = provider.getMetrics();
            expect(metrics[0].type).toBe('histogram');
            expect(metrics[0].value).toBe(123.45);
        });
        it('should record metric with labels', () => {
            provider.recordMetric('requests', 'counter', 1, {
                method: 'GET',
                status: '200',
            });
            const metrics = provider.getMetrics();
            expect(metrics[0].labels).toEqual({
                method: 'GET',
                status: '200',
            });
        });
        it('should emit metric-recorded event', () => {
            const listener = vi.fn();
            provider.on('metric-recorded', listener);
            provider.recordMetric('test', 'counter', 1);
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                name: 'test',
                type: 'counter',
                value: 1,
            }));
        });
        it('should record multiple metrics', () => {
            provider.recordMetric('metric1', 'counter', 1);
            provider.recordMetric('metric2', 'gauge', 2);
            provider.recordMetric('metric3', 'histogram', 3);
            const metrics = provider.getMetrics();
            expect(metrics).toHaveLength(3);
        });
    });
    describe('Disabled State', () => {
        beforeEach(() => {
            provider.disable();
        });
        it('should create no-op span when disabled', () => {
            const span = provider.startSpan('test');
            expect(span.context.traceId).toBe('');
            expect(span.context.spanId).toBe('');
        });
        it('should not track active spans when disabled', () => {
            provider.startSpan('test');
            expect(provider.getActiveSpans()).toHaveLength(0);
        });
        it('should not record metrics when disabled', () => {
            provider.recordMetric('test', 'counter', 1);
            expect(provider.getMetrics()).toHaveLength(0);
        });
        it('should allow re-enabling', () => {
            provider.enable();
            const span = provider.startSpan('test');
            expect(span.context.traceId).not.toBe('');
            expect(provider.getActiveSpans()).toHaveLength(1);
        });
    });
    describe('Data Management', () => {
        it('should clear completed spans', () => {
            const span = provider.startSpan('test');
            provider.endSpan(span);
            provider.clearCompletedSpans();
            expect(provider.getCompletedSpans()).toHaveLength(0);
        });
        it('should clear metrics', () => {
            provider.recordMetric('test', 'counter', 1);
            provider.clearMetrics();
            expect(provider.getMetrics()).toHaveLength(0);
        });
        it('should return copy of completed spans', () => {
            const span = provider.startSpan('test');
            provider.endSpan(span);
            const completed1 = provider.getCompletedSpans();
            const completed2 = provider.getCompletedSpans();
            expect(completed1).not.toBe(completed2);
            expect(completed1).toEqual(completed2);
        });
        it('should return copy of metrics', () => {
            provider.recordMetric('test', 'counter', 1);
            const metrics1 = provider.getMetrics();
            const metrics2 = provider.getMetrics();
            expect(metrics1).not.toBe(metrics2);
            expect(metrics1).toEqual(metrics2);
        });
    });
    describe('Export', () => {
        it('should export span when endpoint configured', () => {
            const listener = vi.fn();
            const provider = createOTelProvider({
                serviceName: 'test',
                endpoint: 'http://localhost:4318',
            });
            provider.on('span-exported', listener);
            const span = provider.startSpan('test');
            provider.endSpan(span);
            expect(listener).toHaveBeenCalledWith(span);
        });
        it('should export metric when endpoint configured', () => {
            const listener = vi.fn();
            const provider = createOTelProvider({
                serviceName: 'test',
                endpoint: 'http://localhost:4318',
            });
            provider.on('metric-exported', listener);
            provider.recordMetric('test', 'counter', 1);
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                name: 'test',
                type: 'counter',
                value: 1,
            }));
        });
        it('should not export without endpoint', () => {
            const listener = vi.fn();
            provider.on('span-exported', listener);
            const span = provider.startSpan('test');
            provider.endSpan(span);
            expect(listener).not.toHaveBeenCalled();
        });
        it('should flush all data', async () => {
            const provider = createOTelProvider({
                serviceName: 'test',
                endpoint: 'http://localhost:4318',
            });
            const spanListener = vi.fn();
            const metricListener = vi.fn();
            provider.on('span-exported', spanListener);
            provider.on('metric-exported', metricListener);
            const span = provider.startSpan('test');
            provider.endSpan(span);
            provider.recordMetric('test', 'counter', 1);
            await provider.flush();
            // Should have exported all data
            expect(spanListener).toHaveBeenCalled();
            expect(metricListener).toHaveBeenCalled();
            // Should have cleared data
            expect(provider.getCompletedSpans()).toHaveLength(0);
            expect(provider.getMetrics()).toHaveLength(0);
        });
    });
    describe('withSpan Helper', () => {
        it('should wrap async function with span', async () => {
            const result = await provider.withSpan('test-operation', async (span) => {
                expect(span.name).toBe('test-operation');
                return 'success';
            });
            expect(result).toBe('success');
            const completed = provider.getCompletedSpans();
            expect(completed).toHaveLength(1);
            expect(completed[0].status).toBe('ok');
        });
        it('should pass attributes to span', async () => {
            await provider.withSpan('test', async (span) => {
                expect(span.attributes.key).toBe('value');
            }, { key: 'value' });
        });
        it('should set error status on exception', async () => {
            const error = new Error('Test error');
            await expect(provider.withSpan('test', async () => {
                throw error;
            })).rejects.toThrow('Test error');
            const completed = provider.getCompletedSpans();
            expect(completed[0].status).toBe('error');
            expect(completed[0].error).toBe(error);
        });
        it('should end span on success', async () => {
            await provider.withSpan('test', async (span) => {
                expect(span.endTime).toBeUndefined();
            });
            const completed = provider.getCompletedSpans();
            expect(completed[0].endTime).toBeDefined();
            expect(completed[0].duration).toBeGreaterThan(0);
        });
        it('should end span on error', async () => {
            try {
                await provider.withSpan('test', async () => {
                    throw new Error('Test');
                });
            }
            catch {
                // Expected
            }
            const completed = provider.getCompletedSpans();
            expect(completed[0].endTime).toBeDefined();
            expect(completed[0].duration).toBeGreaterThan(0);
        });
    });
    describe('Global Provider', () => {
        afterEach(() => {
            resetOTelProvider();
        });
        it('should get global provider', () => {
            const provider = getOTelProvider();
            expect(provider).toBeInstanceOf(OpenTelemetryProvider);
        });
        it('should return same instance on multiple calls', () => {
            const provider1 = getOTelProvider();
            const provider2 = getOTelProvider();
            expect(provider1).toBe(provider2);
        });
        it('should set global provider', () => {
            const custom = createOTelProvider({
                serviceName: 'custom',
                enabled: true,
            });
            setOTelProvider(custom);
            expect(getOTelProvider()).toBe(custom);
        });
        it('should reset global provider', () => {
            const provider1 = getOTelProvider();
            resetOTelProvider();
            const provider2 = getOTelProvider();
            expect(provider2).not.toBe(provider1);
        });
        it('should create disabled provider by default', () => {
            const provider = getOTelProvider();
            expect(provider.isEnabled()).toBe(false);
        });
    });
    describe('ID Generation', () => {
        it('should generate unique trace IDs', () => {
            const span1 = provider.startSpan('test-1');
            const span2 = provider.startSpan('test-2');
            expect(span1.context.traceId).not.toBe(span2.context.traceId);
        });
        it('should generate unique span IDs', () => {
            const span1 = provider.startSpan('test-1');
            const span2 = provider.startSpan('test-2');
            expect(span1.context.spanId).not.toBe(span2.context.spanId);
        });
        it('should generate non-empty IDs', () => {
            const span = provider.startSpan('test');
            expect(span.context.traceId).toMatch(/^[a-z0-9]+$/);
            expect(span.context.spanId).toMatch(/^[a-z0-9]+$/);
            expect(span.context.traceId.length).toBeGreaterThan(10);
            expect(span.context.spanId.length).toBeGreaterThan(10);
        });
    });
});
//# sourceMappingURL=OpenTelemetryProvider.test.js.map