import { createTraceStore } from '@defai.digital/trace-store';
export function createDashboardService(config = {}) {
    const traceStore = config.traceStore ?? createTraceStore({ basePath: config.basePath });
    return {
        async listWorkflowExecutions(limit) {
            const traces = await traceStore.listTraces(limit);
            return traces.map((trace) => ({
                traceId: trace.traceId,
                workflowId: trace.workflowId,
                surface: trace.surface,
                status: trace.status,
                startedAt: trace.startedAt,
                completedAt: trace.completedAt,
            }));
        },
        getWorkflowExecution(traceId) {
            return traceStore.getTrace(traceId);
        },
    };
}
