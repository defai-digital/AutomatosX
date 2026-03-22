import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success, usageError } from '../utils/formatters.js';

export async function resumeCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sourceTraceId = args[0] ?? options.traceId;
  if (sourceTraceId === undefined || sourceTraceId.length === 0) {
    return usageError('ax resume <trace-id>');
  }

  const basePath = options.outputDir ?? process.cwd();
  const runtime = createSharedRuntimeService({ basePath });
  const trace = await runtime.getTrace(sourceTraceId);
  if (trace === undefined) {
    return failure(`Trace not found: ${sourceTraceId}`);
  }

  const resumedTraceId = options.traceId !== undefined && options.traceId !== sourceTraceId
    ? options.traceId
    : undefined;

  if (trace.workflowId === 'discuss') {
    const input = isRecord(trace.input) ? trace.input : {};
    const topic = typeof input.topic === 'string' ? input.topic : undefined;
    if (topic === undefined) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original discussion topic is missing.`);
    }

    const result = await runtime.runDiscussion({
      topic,
      traceId: resumedTraceId,
      sessionId: typeof trace.metadata?.sessionId === 'string' ? trace.metadata.sessionId : options.sessionId,
      basePath,
      provider: typeof trace.metadata?.provider === 'string' ? trace.metadata.provider : options.provider,
      surface: 'cli',
      pattern: typeof input.pattern === 'string' ? input.pattern : undefined,
      rounds: typeof input.rounds === 'number' ? input.rounds : undefined,
      providers: Array.isArray(input.providers) ? input.providers.filter((entry): entry is string => typeof entry === 'string') : undefined,
      context: typeof input.context === 'string' ? input.context : undefined,
      minProviders: Array.isArray(input.providers)
        ? Math.min(2, Math.max(1, input.providers.filter((entry): entry is string => typeof entry === 'string').length))
        : undefined,
    });

    if (!result.success) {
      return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown discussion error'}`, result);
    }

    return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
  }

  if (trace.workflowId === 'review') {
    const input = isRecord(trace.input) ? trace.input : {};
    const paths = Array.isArray(input.paths) ? input.paths.filter((entry): entry is string => typeof entry === 'string') : [];
    if (paths.length === 0) {
      return failure(`Trace ${sourceTraceId} cannot be resumed because the original review paths are missing.`);
    }

    const result = await runtime.analyzeReview({
      paths,
      focus: normalizeReviewFocus(input.focus),
      maxFiles: typeof input.maxFiles === 'number' ? input.maxFiles : undefined,
      traceId: resumedTraceId,
      sessionId: typeof trace.metadata?.sessionId === 'string' ? trace.metadata.sessionId : options.sessionId,
      basePath,
      surface: 'cli',
    });

    if (!result.success) {
      return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown review error'}`, result);
    }

    return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
  }

  const workflowDir = typeof trace.metadata?.workflowDir === 'string'
    ? trace.metadata.workflowDir
    : options.workflowDir ?? resolveWorkflowDir();
  if (workflowDir === undefined) {
    return failure(`Trace ${sourceTraceId} cannot be resumed because no workflow directory is available.`);
  }

  const result = await runtime.runWorkflow({
    workflowId: trace.workflowId,
    traceId: resumedTraceId,
    sessionId: typeof trace.metadata?.sessionId === 'string' ? trace.metadata.sessionId : options.sessionId,
    workflowDir,
    basePath,
    provider: typeof trace.metadata?.provider === 'string' ? trace.metadata.provider : options.provider,
    model: typeof trace.metadata?.model === 'string' ? trace.metadata.model : 'v14-runtime-bridge',
    input: isRecord(trace.input) ? trace.input : {},
    surface: 'cli',
  });

  if (!result.success) {
    return failure(`Resume failed for ${sourceTraceId}: ${result.error?.message ?? 'Unknown workflow error'}`, result);
  }

  return success(`Resumed trace ${sourceTraceId} as ${result.traceId}.`, result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveWorkflowDir(): string | undefined {
  const candidateDirs = ['workflows', '.automatosx/workflows', 'examples/workflows'];
  for (const dir of candidateDirs) {
    const candidate = join(process.cwd(), dir);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function normalizeReviewFocus(value: unknown): 'all' | 'security' | 'correctness' | 'maintainability' | undefined {
  return value === 'all' || value === 'security' || value === 'correctness' || value === 'maintainability'
    ? value
    : undefined;
}
