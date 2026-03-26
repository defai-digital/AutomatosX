import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, resolveCliBasePath, success, usageError } from '../utils/formatters.js';
import {
  asOptionalNumber,
  asOptionalRecord,
  asOptionalString,
  asStringArray,
} from '../utils/validation.js';
import { resolveEffectiveWorkflowDir } from '../workflow-paths.js';

export async function resumeCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sourceTraceId = args[0] ?? options.traceId;
  if (sourceTraceId === undefined || sourceTraceId.length === 0) {
    return usageError('ax resume <trace-id>');
  }

  const basePath = resolveCliBasePath(options);
  const runtime = createRuntime(options);
  const trace = await runtime.getTrace(sourceTraceId);
  if (trace === undefined) {
    return failure(`Trace not found: ${sourceTraceId}`);
  }

  const resumedTraceId = options.traceId !== undefined && options.traceId !== sourceTraceId
    ? options.traceId
    : undefined;
  const traceInput = asOptionalRecord(trace.input) ?? {};
  const traceMetadata = trace.metadata;
  const providers = asStringArray(traceInput.providers);
  const commonDiscussionRequest = {
    traceId: resumedTraceId,
    sessionId: asOptionalString(traceMetadata?.sessionId) ?? options.sessionId,
    basePath,
    provider: asOptionalString(traceMetadata?.provider) ?? options.provider,
    surface: 'cli' as const,
    pattern: asOptionalString(traceInput.pattern),
    rounds: asOptionalNumber(traceInput.rounds),
    providers,
    context: asOptionalString(traceInput.context),
    minProviders: asOptionalNumber(traceInput.minProviders) ?? (
      providers !== undefined
        ? Math.min(2, Math.max(1, providers.length))
        : undefined
    ),
  };

  if (trace.workflowId === 'discuss' || trace.workflowId === 'discuss.recursive.root') {
    const topic = asOptionalString(traceInput.topic);
    if (topic === undefined) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original discussion topic is missing.`);
    }

    const result = await runtime.runDiscussion({
      topic,
      ...commonDiscussionRequest,
    });

    if (!result.success) {
      return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown discussion error'}`, result);
    }

    return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
  }

  if (trace.workflowId === 'discuss.quick' || trace.workflowId === 'discuss.recursive.child') {
    const topic = asOptionalString(traceInput.topic);
    if (topic === undefined) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original discussion topic is missing.`);
    }

    const result = await runtime.runDiscussionQuick({
      topic,
      ...commonDiscussionRequest,
    });

    if (!result.success) {
      return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown discussion error'}`, result);
    }

    return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
  }

  if (trace.workflowId === 'discuss.recursive') {
    const topic = asOptionalString(traceInput.topic);
    const subtopics = asStringArray(traceInput.subtopics) ?? [];
    if (topic === undefined) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original discussion topic is missing.`);
    }
    if (subtopics.length === 0) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original recursive subtopics are missing.`);
    }

    const result = await runtime.runDiscussionRecursive({
      topic,
      subtopics,
      ...commonDiscussionRequest,
    });

    if (!result.success) {
      return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown discussion error'}`, result);
    }

    return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
  }

  if (trace.workflowId === 'review') {
    const paths = asStringArray(traceInput.paths) ?? [];
    if (paths.length === 0) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original review paths are missing.`);
    }

    const result = await runtime.analyzeReview({
      paths,
      focus: normalizeReviewFocus(traceInput.focus),
      maxFiles: asOptionalNumber(traceInput.maxFiles),
      traceId: resumedTraceId,
      sessionId: asOptionalString(traceMetadata?.sessionId) ?? options.sessionId,
      basePath,
      surface: 'cli',
    });

    if (!result.success) {
      return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown review error'}`, result);
    }

    return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
  }

  const workflowDir = asOptionalString(traceMetadata?.workflowDir)
    ?? options.workflowDir
    ?? resolveEffectiveWorkflowDir({ basePath });
  if (workflowDir === undefined) {
    return failure(`Trace ${sourceTraceId} cannot be resumed because no workflow directory is available.`);
  }

  const result = await runtime.runWorkflow({
    workflowId: trace.workflowId,
    traceId: resumedTraceId,
    sessionId: asOptionalString(traceMetadata?.sessionId) ?? options.sessionId,
    workflowDir,
    basePath,
    provider: asOptionalString(traceMetadata?.provider) ?? options.provider,
    model: asOptionalString(traceMetadata?.model) ?? 'v14-runtime-bridge',
    input: traceInput,
    surface: 'cli',
  });

  if (!result.success) {
    return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown workflow error'}`, result);
  }

  return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
}

function normalizeReviewFocus(value: unknown): 'all' | 'security' | 'correctness' | 'maintainability' | undefined {
  return value === 'all' || value === 'security' || value === 'correctness' || value === 'maintainability'
    ? value
    : undefined;
}
