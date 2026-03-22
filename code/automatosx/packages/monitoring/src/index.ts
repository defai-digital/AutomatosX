import { createTraceStore, type TraceRecord, type TraceStore } from '@defai.digital/trace-store';

export interface DashboardEntry {
  traceId: string;
  workflowId: string;
  surface: 'cli' | 'mcp';
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

export interface DashboardService {
  listWorkflowExecutions(limit?: number): Promise<DashboardEntry[]>;
  getWorkflowExecution(traceId: string): Promise<TraceRecord | undefined>;
}

export function createDashboardService(config: { traceStore?: TraceStore; basePath?: string } = {}): DashboardService {
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
