import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryTraceStore, TraceRecorderError, createTraceRecorder, createTraceAnalyzer, } from '@defai.digital/trace-domain';
describe('Trace Domain', () => {
    describe('Trace Store (INV-TR-002, INV-TR-004)', () => {
        let store;
        beforeEach(() => {
            store = createInMemoryTraceStore();
        });
        it('INV-TR-002: should return events in sequence order', async () => {
            const traceId = 'trace-1';
            // Add events out of order
            await store.write({
                traceId,
                eventId: 'event-3',
                type: 'run.end',
                timestamp: '2024-01-01T00:00:03Z',
                sequence: 2,
            });
            await store.write({
                traceId,
                eventId: 'event-1',
                type: 'run.start',
                timestamp: '2024-01-01T00:00:01Z',
                sequence: 0,
            });
            await store.write({
                traceId,
                eventId: 'event-2',
                type: 'step.execute',
                timestamp: '2024-01-01T00:00:02Z',
                sequence: 1,
            });
            const events = await store.getTrace(traceId);
            expect(events[0]?.eventId).toBe('event-1');
            expect(events[1]?.eventId).toBe('event-2');
            expect(events[2]?.eventId).toBe('event-3');
        });
        it('INV-TR-004: traces should be independent', async () => {
            await store.write({
                traceId: 'trace-1',
                eventId: 'event-1',
                type: 'run.start',
                timestamp: '2024-01-01T00:00:00Z',
            });
            await store.write({
                traceId: 'trace-2',
                eventId: 'event-2',
                type: 'run.start',
                timestamp: '2024-01-01T00:00:00Z',
            });
            const trace1 = await store.getTrace('trace-1');
            const trace2 = await store.getTrace('trace-2');
            expect(trace1).toHaveLength(1);
            expect(trace2).toHaveLength(1);
            expect(trace1[0]?.eventId).toBe('event-1');
            expect(trace2[0]?.eventId).toBe('event-2');
        });
        it('should list traces with summaries', async () => {
            await store.write({
                traceId: 'trace-1',
                eventId: 'event-1',
                type: 'run.start',
                timestamp: '2024-01-01T00:00:00Z',
            });
            await store.write({
                traceId: 'trace-1',
                eventId: 'event-2',
                type: 'run.end',
                timestamp: '2024-01-01T00:00:05Z',
                payload: { success: true },
            });
            const summaries = await store.listTraces();
            expect(summaries).toHaveLength(1);
            expect(summaries[0]?.status).toBe('success');
            expect(summaries[0]?.eventCount).toBe(2);
        });
    });
    describe('Trace Recorder (INV-TR-001, INV-TR-003, INV-TR-005)', () => {
        let store;
        let recorder;
        beforeEach(() => {
            store = createInMemoryTraceStore();
            recorder = createTraceRecorder(store);
        });
        it('INV-TR-001: should emit run.start as first event', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            const events = await store.getTrace(traceId);
            expect(events).toHaveLength(1);
            expect(events[0]?.type).toBe('run.start');
        });
        it('INV-TR-001: should emit run.end as last event', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.endTrace(traceId, true, { result: 'done' });
            const events = await store.getTrace(traceId);
            const lastEvent = events[events.length - 1];
            expect(lastEvent?.type).toBe('run.end');
            expect((lastEvent?.payload).success).toBe(true);
        });
        it('INV-TR-001: should create complete event chain', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordRoutingDecision(traceId, 'claude-3', 'anthropic', 'Best for task');
            await recorder.recordStepExecution(traceId, 'step-1', 'prompt', { query: 'test' }, { response: 'result' }, 100);
            await recorder.endTrace(traceId, true);
            const events = await store.getTrace(traceId);
            expect(events[0]?.type).toBe('run.start');
            expect(events[events.length - 1]?.type).toBe('run.end');
        });
        it('INV-TR-003: should capture routing decisions for replay', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordRoutingDecision(traceId, 'claude-3-opus', 'anthropic', 'Selected for code tasks');
            const events = await store.getTrace(traceId);
            const routingEvent = events.find((e) => e.type === 'decision.routing');
            expect(routingEvent).toBeDefined();
            expect((routingEvent?.payload).selectedModel).toBe('claude-3-opus');
            expect((routingEvent?.payload).reasoning).toBe('Selected for code tasks');
        });
        it('INV-TR-005: should capture errors with full context', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordError(traceId, 'STEP_FAILED', 'Step execution failed', { stepId: 'step-1', attempt: 3 });
            const events = await store.getTrace(traceId);
            const errorEvent = events.find((e) => e.type === 'error');
            expect(errorEvent).toBeDefined();
            expect((errorEvent?.payload).code).toBe('STEP_FAILED');
            expect((errorEvent?.payload).context.stepId).toBe('step-1');
            expect((errorEvent?.payload).stack).toBeDefined();
        });
        it('should prevent ending trace twice', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.endTrace(traceId, true);
            await expect(recorder.endTrace(traceId, true)).rejects.toThrow(TraceRecorderError);
        });
        it('should assign sequence numbers', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordEvent(traceId, 'step.execute');
            await recorder.recordEvent(traceId, 'step.execute');
            await recorder.endTrace(traceId, true);
            const events = await store.getTrace(traceId);
            expect(events[0]?.sequence).toBe(0);
            expect(events[1]?.sequence).toBe(1);
            expect(events[2]?.sequence).toBe(2);
            expect(events[3]?.sequence).toBe(3);
        });
        it('should support scoped operations', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            const stepEventId = await recorder.startScope(traceId, 'step.start');
            await recorder.recordEvent(traceId, 'tool.invoke');
            await recorder.endScope(traceId, 'step.end', true, 100);
            const events = await store.getTrace(traceId);
            const toolEvent = events.find((e) => e.type === 'tool.invoke');
            expect(toolEvent?.parentEventId).toBe(stepEventId);
        });
    });
    describe('Trace Analyzer (INV-TR-001, INV-TR-003)', () => {
        let store;
        let recorder;
        let analyzer;
        beforeEach(() => {
            store = createInMemoryTraceStore();
            recorder = createTraceRecorder(store);
            analyzer = createTraceAnalyzer(store);
        });
        it('INV-TR-001: should detect complete traces', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.endTrace(traceId, true);
            const analysis = await analyzer.analyze(traceId);
            expect(analysis.isComplete).toBe(true);
            expect(analysis.status).toBe('success');
        });
        it('INV-TR-001: should detect incomplete traces', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            // Don't end the trace
            // Need to check the store directly since recorder cleans up
            await store.write({
                traceId: 'incomplete-trace',
                eventId: 'event-1',
                type: 'run.start',
                timestamp: new Date().toISOString(),
            });
            const analysis = await analyzer.analyze('incomplete-trace');
            expect(analysis.isComplete).toBe(false);
        });
        it('INV-TR-003: should support routing decision replay', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordRoutingDecision(traceId, 'claude-3', 'anthropic', 'Reason 1');
            await recorder.recordRoutingDecision(traceId, 'claude-3-opus', 'anthropic', 'Reason 2');
            await recorder.endTrace(traceId, true);
            const decisions = await analyzer.replayRoutingDecisions(traceId);
            expect(decisions).toHaveLength(2);
            expect(decisions[0]?.selectedModel).toBe('claude-3');
            expect(decisions[1]?.selectedModel).toBe('claude-3-opus');
        });
        it('should calculate analysis metrics', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordStepExecution(traceId, 'step-1', 'prompt', {}, {}, 100);
            await recorder.recordStepExecution(traceId, 'step-2', 'tool', {}, {}, 200);
            await recorder.recordError(traceId, 'ERROR', 'Test error');
            await recorder.endTrace(traceId, false);
            const analysis = await analyzer.analyze(traceId);
            expect(analysis.eventCount).toBe(5); // start + 2 steps + error + end
            expect(analysis.errorCount).toBe(1);
            expect(analysis.stepDurations.get('step-1')).toBe(100);
            expect(analysis.stepDurations.get('step-2')).toBe(200);
        });
        it('should build timeline with depth', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.startScope(traceId, 'step.start');
            await recorder.recordEvent(traceId, 'tool.invoke');
            await recorder.endScope(traceId, 'step.end', true);
            await recorder.endTrace(traceId, true);
            const analysis = await analyzer.analyze(traceId);
            expect(analysis.timeline.length).toBe(5);
            // Check depths are assigned
            expect(analysis.timeline.some((t) => t.depth > 0)).toBe(true);
        });
        it('should get full trace object', async () => {
            const traceId = await recorder.startTrace('workflow-1');
            await recorder.recordStepExecution(traceId, 'step-1', 'prompt');
            await recorder.endTrace(traceId, true);
            const trace = await analyzer.getFullTrace(traceId);
            expect(trace.traceId).toBe(traceId);
            expect(trace.events).toHaveLength(3);
            expect(trace.status).toBe('success');
            expect(trace.summary).toBeDefined();
        });
    });
});
//# sourceMappingURL=trace-domain.test.js.map