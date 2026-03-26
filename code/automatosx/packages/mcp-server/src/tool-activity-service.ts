import { randomUUID } from 'node:crypto';
import type { SharedRuntimeService } from '@defai.digital/shared-runtime';
import type { MpcToolResult } from './surface-types.js';

const SESSION_AWARE_TOOL_NAMES = new Set([
  'workflow_run',
  'agent_run',
  'discuss_run',
  'discuss_quick',
  'discuss_recursive',
  'review_analyze',
  'parallel_run',
  'feedback_submit',
  'research_query',
  'research_synthesize',
  'design_api',
  'design_architecture',
  'design_component',
  'design_schema',
  'skill_run',
  'bridge_run',
]);

const TOOLS_WITH_RUNTIME_TRACES = new Set([
  'workflow_run',
  'agent_run',
  'discuss_run',
  'discuss_quick',
  'discuss_recursive',
  'review_analyze',
  'parallel_run',
  'research_query',
  'research_synthesize',
  'design_api',
  'design_architecture',
  'design_component',
  'design_schema',
  'skill_run',
  'bridge_run',
]);

const MCP_TOOL_TRACE_PREFIX = 'mcp.tool.';
const MAX_STRING_LENGTH = 200;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 10;
const MAX_SANITIZE_DEPTH = 2;
const ACTIVITY_SUMMARY_MAX_LENGTH = 120;

interface ToolActivityDescriptor {
  displayLabel: string;
  sessionTask: string;
  summary?: string;
  subject?: string;
}

export interface McpToolActivityService {
  augmentArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown>;
  recordInvocation(
    toolName: string,
    args: Record<string, unknown>,
    result: MpcToolResult,
    startedAtMs: number,
  ): Promise<void>;
}

export function createMcpToolActivityService(config: {
  runtimeService: SharedRuntimeService;
  basePath: string;
}): McpToolActivityService {
  const autoManagedSessionIds = new Set<string>();

  return {
    augmentArgs(toolName, args) {
      if (!SESSION_AWARE_TOOL_NAMES.has(toolName)) {
        return args;
      }
      if (asOptionalString(args.sessionId) !== undefined) {
        return args;
      }
      const sessionId = `mcp-session-${randomUUID()}`;
      autoManagedSessionIds.add(sessionId);
      return {
        ...args,
        sessionId,
      };
    },

    async recordInvocation(toolName, args, result, startedAtMs) {
      const descriptor = describeToolActivity(toolName, args);
      const sessionId = resolveActivitySessionId(toolName, args);
      if (sessionId !== undefined) {
        await ensureSession(config.runtimeService, sessionId, config.basePath, toolName, descriptor);
      }

      const traceId = extractTraceId(result.data);
      if (traceId !== undefined) {
        await enrichRecordedTrace(config.runtimeService, traceId, toolName, sessionId, descriptor);
      }

      if (sessionId !== undefined && autoManagedSessionIds.has(sessionId)) {
        await finalizeAutoManagedSession(config.runtimeService, sessionId, descriptor, result);
        autoManagedSessionIds.delete(sessionId);
      }

      if (!shouldRecordEnvelopeTrace(toolName, result)) {
        return;
      }

      const startedAt = new Date(startedAtMs).toISOString();
      const completedAt = new Date().toISOString();
      const durationMs = Math.max(0, Date.parse(completedAt) - startedAtMs);

      await config.runtimeService.getStores().traceStore.upsertTrace({
        traceId: randomUUID(),
        workflowId: `${MCP_TOOL_TRACE_PREFIX}${toolName}`,
        surface: 'mcp',
        status: result.success ? 'completed' : 'failed',
        startedAt,
        completedAt,
        input: sanitizeInputForTrace(args),
        stepResults: [
          {
            stepId: toolName,
            success: result.success,
            durationMs,
            retryCount: 0,
            error: result.success ? undefined : result.error,
          },
        ],
        output: result.success ? sanitizeForTrace(result.data) : undefined,
        error: result.success ? undefined : {
          code: 'MCP_TOOL_FAILED',
          message: result.error ?? `MCP tool "${toolName}" failed.`,
        },
        metadata: {
          command: toolName,
          sessionId,
          requestKind: 'mcp-tool',
          displayLabel: descriptor.displayLabel,
          summary: descriptor.summary,
          subject: descriptor.subject,
        },
      });
    },
  };
}

async function ensureSession(
  runtimeService: SharedRuntimeService,
  sessionId: string,
  basePath: string,
  toolName: string,
  descriptor: ToolActivityDescriptor,
): Promise<void> {
  const existing = await runtimeService.getSession(sessionId);
  if (existing !== undefined) {
    return;
  }

  await runtimeService.createSession({
    sessionId,
    task: descriptor.sessionTask,
    initiator: 'mcp',
    workspace: basePath,
    metadata: {
      autoCreated: true,
      command: toolName,
      surface: 'mcp',
      displayLabel: descriptor.displayLabel,
      summary: descriptor.summary,
      subject: descriptor.subject,
    },
  });
}

async function enrichRecordedTrace(
  runtimeService: SharedRuntimeService,
  traceId: string,
  toolName: string,
  sessionId: string | undefined,
  descriptor: ToolActivityDescriptor,
): Promise<void> {
  const trace = await runtimeService.getTrace(traceId);
  if (trace === undefined) {
    return;
  }

  const metadata = isRecord(trace.metadata) ? trace.metadata : {};
  await runtimeService.getStores().traceStore.upsertTrace({
    ...trace,
    metadata: {
      ...metadata,
      command: metadata.command ?? normalizeToolCommand(toolName),
      sessionId: sessionId ?? asOptionalString(metadata.sessionId),
      requestKind: 'mcp-execution',
      displayLabel: descriptor.displayLabel,
      summary: descriptor.summary,
      subject: descriptor.subject,
    },
  });
}

async function finalizeAutoManagedSession(
  runtimeService: SharedRuntimeService,
  sessionId: string,
  descriptor: ToolActivityDescriptor,
  result: MpcToolResult,
): Promise<void> {
  const session = await runtimeService.getSession(sessionId);
  if (session === undefined || session.status !== 'active') {
    return;
  }

  if (result.success) {
    await runtimeService.completeSession(sessionId, descriptor.summary);
    return;
  }

  await runtimeService.failSession(
    sessionId,
    result.error ?? `${descriptor.displayLabel} failed.`,
  );
}

function shouldRecordEnvelopeTrace(toolName: string, result: MpcToolResult): boolean {
  if (extractTraceId(result.data) !== undefined) {
    return false;
  }
  if (!result.success) {
    return true;
  }
  return !TOOLS_WITH_RUNTIME_TRACES.has(toolName);
}

function resolveActivitySessionId(
  toolName: string,
  args: Record<string, unknown>,
): string | undefined {
  return SESSION_AWARE_TOOL_NAMES.has(toolName)
    ? asOptionalString(args.sessionId)
    : undefined;
}

function extractTraceId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return asOptionalString(value.traceId);
}

function describeToolActivity(
  toolName: string,
  args: Record<string, unknown>,
): ToolActivityDescriptor {
  switch (toolName) {
    case 'workflow_run': {
      const workflowId = asOptionalString(args.workflowId) ?? 'workflow';
      return {
        displayLabel: `Workflow: ${workflowId}`,
        sessionTask: buildTaskLabel('Run workflow', workflowId),
        summary: summarizeWorkflowInput(args.input),
        subject: workflowId,
      };
    }
    case 'agent_run': {
      const agentId = asOptionalString(args.agentId) ?? 'agent';
      return {
        displayLabel: `Agent Run: ${agentId}`,
        sessionTask: buildTaskLabel('Run agent', agentId),
        summary: firstNonEmptySummary([
          asOptionalString(args.task),
          summarizeWorkflowInput(args.input),
        ]),
        subject: agentId,
      };
    }
    case 'discuss_run':
    case 'discuss_quick':
    case 'discuss_recursive': {
      const topic = asOptionalString(args.topic);
      const rounds = asOptionalNumber(args.rounds);
      const providers = summarizeStringArray(args.providers, 3);
      const summary = firstNonEmptySummary([
        providers && rounds !== undefined ? `${providers} · ${rounds} rounds` : undefined,
        providers,
        rounds !== undefined ? `${rounds} rounds` : undefined,
      ]);
      return {
        displayLabel: toolName === 'discuss_quick'
          ? 'Discussion: Quick'
          : toolName === 'discuss_recursive'
            ? 'Discussion: Recursive'
            : 'Discussion',
        sessionTask: buildTaskLabel(
          toolName === 'discuss_quick'
            ? 'Discuss quickly'
            : toolName === 'discuss_recursive'
              ? 'Discuss recursively'
              : 'Discuss',
          topic,
        ),
        summary,
        subject: topic,
      };
    }
    case 'review_analyze': {
      const paths = summarizePathArray(args.paths);
      const focus = asOptionalString(args.focus);
      return {
        displayLabel: 'Review Analysis',
        sessionTask: buildTaskLabel('Review', paths ?? 'workspace'),
        summary: focus !== undefined ? `Focus: ${focus}` : undefined,
        subject: paths,
      };
    }
    case 'parallel_run': {
      const tasks = asTaskArray(args.tasks);
      return {
        displayLabel: 'Parallel Run',
        sessionTask: buildTaskLabel('Run parallel agent batch', `${tasks.length} tasks`),
        summary: summarizeParallelTasks(tasks),
        subject: `${tasks.length} tasks`,
      };
    }
    case 'research_query': {
      const query = asOptionalString(args.query);
      const provider = asOptionalString(args.provider);
      return {
        displayLabel: 'Research Query',
        sessionTask: buildTaskLabel('Research', query),
        summary: provider !== undefined ? `Provider: ${provider}` : undefined,
        subject: query,
      };
    }
    case 'research_synthesize': {
      const topic = asOptionalString(args.topic);
      const sourceCount = Array.isArray(args.sources) ? args.sources.length : undefined;
      return {
        displayLabel: 'Research Synthesis',
        sessionTask: buildTaskLabel('Synthesize research', topic),
        summary: sourceCount !== undefined ? `${sourceCount} source${sourceCount === 1 ? '' : 's'}` : undefined,
        subject: topic,
      };
    }
    case 'design_api':
      return describeDesignTool('Design API', 'Design API', asOptionalString(args.domain), args.requirements);
    case 'design_architecture':
      return describeDesignTool('Design Architecture', 'Design architecture', asOptionalString(args.system), args.constraints);
    case 'design_component':
      return describeDesignTool('Design Component', 'Design component', asOptionalString(args.name), args.purpose);
    case 'design_schema':
      return describeDesignTool('Design Schema', 'Design schema', asOptionalString(args.entity), args.fields);
    case 'feedback_submit': {
      const selectedAgent = asOptionalString(args.selectedAgent);
      return {
        displayLabel: 'Feedback Submit',
        sessionTask: buildTaskLabel('Feedback', selectedAgent),
        summary: firstNonEmptySummary([
          asOptionalString(args.taskDescription),
          asOptionalString(args.outcome),
        ]),
        subject: selectedAgent,
      };
    }
    default: {
      const subject = summarizeGenericToolSubject(args);
      return {
        displayLabel: `MCP: ${humanizeIdentifier(toolName)}`,
        sessionTask: buildTaskLabel(humanizeIdentifier(toolName), subject),
        summary: summarizeGenericToolSummary(args),
        subject,
      };
    }
  }
}

function describeDesignTool(
  displayLabel: string,
  taskLabel: string,
  subject: string | undefined,
  detailSource: unknown,
): ToolActivityDescriptor {
  return {
    displayLabel,
    sessionTask: buildTaskLabel(taskLabel, subject),
    summary: summarizeText(detailSource),
    subject,
  };
}

function buildTaskLabel(label: string, detail?: string): string {
  const normalizedLabel = normalizeSummaryText(label) ?? 'MCP activity';
  const normalizedDetail = normalizeSummaryText(detail);
  const combined = normalizedDetail === undefined ? normalizedLabel : `${normalizedLabel}: ${normalizedDetail}`;
  return truncateText(combined, ACTIVITY_SUMMARY_MAX_LENGTH);
}

function normalizeToolCommand(toolName: string): string {
  return toolName.replace(/_/g, '.');
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[._-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function summarizeWorkflowInput(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return summarizeText(value);
  }

  return firstNonEmptySummary([
    describeField('Task', value.task),
    describeField('Request', value.request),
    describeField('Prompt', value.prompt),
    describeField('Topic', value.topic),
    describeField('Target', value.target),
    describeField('URL', value.url),
    describeField('Release', value.releaseVersion),
    describeField('Scope', value.scope),
    describeField('Path', value.path),
    Array.isArray(value.paths) && value.paths.length > 0 ? `Paths: ${summarizePathArray(value.paths)}` : undefined,
    typeof value.input === 'object' && value.input !== null ? summarizeWorkflowInput(value.input) : undefined,
  ]);
}

function summarizeGenericToolSubject(args: Record<string, unknown>): string | undefined {
  return firstNonEmptySummary([
    summarizeNamespaceKey(args),
    asOptionalString(args.path),
    summarizePathArray(args.paths),
    asOptionalString(args.sessionId),
    asOptionalString(args.traceId),
    asOptionalString(args.workflowId),
    asOptionalString(args.agentId),
    asOptionalString(args.policyId),
    asOptionalString(args.key),
    asOptionalString(args.reference),
    asOptionalString(args.name),
    asOptionalString(args.entity),
    asOptionalString(args.domain),
    asOptionalString(args.system),
    asOptionalString(args.query),
    asOptionalString(args.topic),
  ]);
}

function summarizeGenericToolSummary(args: Record<string, unknown>): string | undefined {
  return firstNonEmptySummary([
    summarizeNamespaceKey(args),
    describeField('Path', args.path),
    Array.isArray(args.paths) && args.paths.length > 0 ? `Paths: ${summarizePathArray(args.paths)}` : undefined,
    describeField('Session', args.sessionId),
    describeField('Trace', args.traceId),
    describeField('Workflow', args.workflowId),
    describeField('Agent', args.agentId),
    describeField('Policy', args.policyId),
    describeField('Queue', args.queueId),
    describeField('Metric', args.name),
    describeField('Query', args.query),
    describeField('Topic', args.topic),
    describeField('Title', args.title),
    summarizeWorkflowInput(args.input),
  ]);
}

function summarizeNamespaceKey(args: Record<string, unknown>): string | undefined {
  const namespace = asOptionalString(args.namespace);
  const key = asOptionalString(args.key);
  if (namespace !== undefined && key !== undefined) {
    return `${namespace}/${key}`;
  }
  return namespace;
}

function summarizePathArray(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return summarizeStringArray(value, 3);
}

function summarizeParallelTasks(tasks: Array<Record<string, unknown>>): string | undefined {
  if (tasks.length === 0) {
    return undefined;
  }
  const labels = tasks
    .map((task) => asOptionalString(task.task) ?? asOptionalString(task.taskId) ?? asOptionalString(task.agentId))
    .filter((value): value is string => value !== undefined);
  if (labels.length === 0) {
    return `${tasks.length} tasks`;
  }
  return truncateText(labels.slice(0, 2).join(' · '), ACTIVITY_SUMMARY_MAX_LENGTH);
}

function describeField(label: string, value: unknown): string | undefined {
  const summary = summarizeText(value);
  return summary === undefined ? undefined : `${label}: ${summary}`;
}

function summarizeText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return normalizeSummaryText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function summarizeStringArray(value: unknown, limit: number): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const items = value
    .map((entry) => normalizeSummaryText(typeof entry === 'string' ? entry : undefined))
    .filter((entry): entry is string => entry !== undefined)
    .slice(0, limit);
  if (items.length === 0) {
    return undefined;
  }
  return truncateText(items.join(', '), ACTIVITY_SUMMARY_MAX_LENGTH);
}

function normalizeSummaryText(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return undefined;
  }
  return truncateText(normalized, ACTIVITY_SUMMARY_MAX_LENGTH);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function firstNonEmptySummary(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asTaskArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
}

function sanitizeForTrace(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.length <= MAX_STRING_LENGTH
      ? value
      : `${value.slice(0, MAX_STRING_LENGTH - 1)}… (${value.length} chars)`;
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_SANITIZE_DEPTH) {
      return `[array:${value.length}]`;
    }
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeForTrace(entry, depth + 1));
  }
  if (isRecord(value)) {
    if (depth >= MAX_SANITIZE_DEPTH) {
      return {
        type: 'object',
        keys: Object.keys(value).slice(0, MAX_OBJECT_KEYS),
      };
    }
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, entry]) => [key, sanitizeForTrace(entry, depth + 1)]),
    );
  }
  return String(value);
}

function sanitizeInputForTrace(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeForTrace(value);
  return isRecord(sanitized) ? sanitized : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

