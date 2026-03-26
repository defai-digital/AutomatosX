import type {
  TraceRecord,
  TraceStore,
  TraceTreeNode,
} from '@defai.digital/trace-store';
import type { StateStore, SessionEntry } from '@defai.digital/state-store';
import {
  listReviewTraces,
  runReviewAnalysis,
  type ReviewFocus,
  type RuntimeReviewResponse,
} from './review.js';
import { buildSessionTask, ensureSessionRecord } from './runtime-session-support.js';
import type { ProviderExecutionMode } from './provider-bridge.js';
import {
  getWorkflowCatalogEntry,
  listWorkflowCatalog,
} from './stable-workflow-catalog.js';
import {
  loadWorkflowWithBundledFallback,
  loadWorkflowsWithBundledFallback,
} from './workflow-definition-resolution.js';
import type {
  RuntimeStatusResponse,
  RuntimeTraceAnalysis,
  RuntimeTraceTreeNode,
  RuntimeWorkflowDescription,
  SharedRuntimeService,
} from './index.js';

interface ProviderBridgeLike {
  getExecutionMode(): ProviderExecutionMode;
}

export interface RuntimeQueryServiceConfig {
  basePath: string;
  traceStore: TraceStore;
  stateStore: StateStore;
  providerBridge: ProviderBridgeLike;
  readWorkspaceConfig(basePath: string): Promise<Record<string, unknown>>;
  writeWorkspaceConfig(basePath: string, config: Record<string, unknown>): Promise<void>;
  listConfiguredExecutors(config: Record<string, unknown>): string[];
  resolveWorkflowDir(
    explicitWorkflowDir: string | undefined,
    requestBasePath: string | undefined,
    defaultBasePath: string,
  ): string;
  getValueAtPath(config: Record<string, unknown>, path: string): unknown;
  setValueAtPath(config: Record<string, unknown>, path: string, value: unknown): void;
  analyzeTraceRecord(trace: TraceRecord): RuntimeTraceAnalysis;
}

type RuntimeQueryService = Pick<
  SharedRuntimeService,
  | 'getStatus'
  | 'listWorkflows'
  | 'describeWorkflow'
  | 'analyzeReview'
  | 'listReviewTraces'
  | 'getConfig'
  | 'showConfig'
  | 'setConfig'
  | 'getTrace'
  | 'analyzeTrace'
  | 'getTraceTree'
  | 'listTraces'
  | 'closeStuckTraces'
  | 'listTracesBySession'
>;

export function createRuntimeQueryService(config: RuntimeQueryServiceConfig): RuntimeQueryService {
  const {
    basePath,
    traceStore,
    stateStore,
    providerBridge,
    readWorkspaceConfig,
    writeWorkspaceConfig,
    listConfiguredExecutors,
    resolveWorkflowDir,
    getValueAtPath,
    setValueAtPath,
    analyzeTraceRecord,
  } = config;

  return {
    async getStatus(request) {
      const limit = request?.limit ?? 10;
      const [sessionCounts, activeSessions, traceCounts, runningTraces, recentFailedTraces, workspaceConfig] = await Promise.all([
        stateStore.getSessionStatusCounts(),
        stateStore.listSessionsByStatus('active', limit),
        traceStore.getTraceStatusCounts(),
        traceStore.listTracesByStatus('running', limit),
        traceStore.listTracesByStatus('failed', limit),
        readWorkspaceConfig(basePath),
      ]);

      return {
        sessions: buildSessionStatus(sessionCounts),
        traces: buildTraceStatus(traceCounts),
        runtime: {
          defaultProvider: resolveDefaultProvider(workspaceConfig),
          providerExecutionMode: providerBridge.getExecutionMode(),
          configuredExecutors: listConfiguredExecutors(workspaceConfig),
        },
        activeSessions,
        runningTraces,
        recentFailedTraces,
      };
    },

    async listWorkflows(options) {
      const workflowDir = resolveWorkflowDir(options?.workflowDir, options?.basePath, basePath);
      const workflows = await loadWorkflowsWithBundledFallback(workflowDir);
      const discoveredById = new Map(workflows.map((workflow) => [workflow.workflowId, workflow] as const));
      const stableCatalog = listWorkflowCatalog().map((entry) => {
        const discovered = discoveredById.get(entry.workflowId);
        return {
          workflowId: entry.workflowId,
          name: discovered?.name ?? entry.workflowName,
          version: discovered?.version ?? entry.version,
          steps: discovered?.steps.length ?? entry.stages.length,
        };
      });
      const stableIds = new Set(stableCatalog.map((entry) => entry.workflowId));
      const customWorkflows = workflows
        .filter((workflow) => !stableIds.has(workflow.workflowId))
        .map((workflow) => ({
          workflowId: workflow.workflowId,
          name: workflow.name,
          version: workflow.version,
          steps: workflow.steps.length,
        }));
      return [...stableCatalog, ...customWorkflows];
    },

    async describeWorkflow(request) {
      const workflowDir = resolveWorkflowDir(request.workflowDir, request.basePath, basePath);
      const { workflow, workflowDir: resolvedWorkflowDir } = await loadWorkflowWithBundledFallback(
        request.workflowId,
        workflowDir,
      );
      if (workflow !== undefined) {
        return {
          workflowId: workflow.workflowId,
          name: workflow.name,
          description: workflow.description,
          version: workflow.version,
          workflowDir: resolvedWorkflowDir,
          source: 'workflow-definition',
          steps: workflow.steps.map((step) => ({
            stepId: step.stepId,
            type: step.type,
          })),
        };
      }

      const catalogEntry = getWorkflowCatalogEntry(request.workflowId);
      if (catalogEntry === undefined) {
        return undefined;
      }

      return {
        workflowId: catalogEntry.workflowId,
        name: catalogEntry.workflowName,
        description: catalogEntry.description,
        version: catalogEntry.version,
        source: 'stable-catalog',
        steps: catalogEntry.stages.map((_, index) => ({
          stepId: `stage-${index + 1}`,
          type: 'catalog-stage',
        })),
      };
    },

    async analyzeReview(request) {
      await ensureSessionRecord(stateStore, {
        sessionId: request.sessionId,
        task: buildSessionTask('Review', request.paths.join(', ')),
        initiator: request.surface ?? 'cli',
        workspace: request.basePath ?? basePath,
        surface: request.surface,
        metadata: {
          command: 'review',
          focus: request.focus ?? 'all',
          pathCount: request.paths.length,
        },
      });
      return runReviewAnalysis(traceStore, {
        paths: request.paths,
        focus: request.focus,
        maxFiles: request.maxFiles,
        traceId: request.traceId,
        sessionId: request.sessionId,
        basePath: request.basePath ?? basePath,
        surface: request.surface ?? 'cli',
      });
    },

    listReviewTraces(limit) {
      return listReviewTraces(traceStore, limit);
    },

    async getConfig(path) {
      const workspaceConfig = await readWorkspaceConfig(basePath);
      if (path === undefined || path.length === 0) {
        return workspaceConfig;
      }
      return getValueAtPath(workspaceConfig, path);
    },

    showConfig() {
      return readWorkspaceConfig(basePath);
    },

    async setConfig(path, value) {
      const workspaceConfig = await readWorkspaceConfig(basePath);
      setValueAtPath(workspaceConfig, path, value);
      await writeWorkspaceConfig(basePath, workspaceConfig);
      return workspaceConfig;
    },

    getTrace(traceId) {
      return traceStore.getTrace(traceId);
    },

    async analyzeTrace(traceId) {
      const trace = await traceStore.getTrace(traceId);
      if (trace === undefined) {
        return undefined;
      }

      return analyzeTraceRecord(trace);
    },

    async getTraceTree(traceId) {
      const tree = await traceStore.getTraceTree(traceId);
      return tree === undefined ? undefined : toRuntimeTraceTreeNode(tree);
    },

    listTraces(limit) {
      return traceStore.listTraces(limit);
    },

    closeStuckTraces(maxAgeMs) {
      return traceStore.closeStuckTraces(maxAgeMs);
    },

    listTracesBySession(sessionId, limit) {
      return traceStore.listTracesBySession(sessionId, limit);
    },
  };
}

function toRuntimeTraceTreeNode(node: TraceTreeNode): RuntimeTraceTreeNode {
  return {
    traceId: node.trace.traceId,
    workflowId: node.trace.workflowId,
    surface: node.trace.surface,
    status: node.trace.status,
    startedAt: node.trace.startedAt,
    completedAt: node.trace.completedAt,
    parentTraceId: asMetadataString(node.trace.metadata, 'parentTraceId'),
    rootTraceId: asMetadataString(node.trace.metadata, 'rootTraceId'),
    children: node.children.map((child) => toRuntimeTraceTreeNode(child)),
  };
}

function buildSessionStatus(counts: RuntimeStatusResponse['sessions']): RuntimeStatusResponse['sessions'] {
  return counts;
}

function buildTraceStatus(
  counts: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  },
): RuntimeStatusResponse['traces'] {
  return {
    total: counts.total,
    running: counts.running,
    completed: counts.completed,
    failed: counts.failed,
  };
}

function resolveDefaultProvider(config: Record<string, unknown>): string | undefined {
  if (typeof config.providers === 'object' && config.providers !== null) {
    const providerConfig = config.providers as Record<string, unknown>;
    if (typeof providerConfig.default === 'string') {
      return providerConfig.default;
    }
  }

  return typeof config.defaultProvider === 'string'
    ? config.defaultProvider
    : undefined;
}

function asMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
