import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { success, usageError } from '../utils/formatters.js';

const DEFAULT_MAX_AGE_MS = 86_400_000;

export async function cleanupCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const scope = args[0] ?? 'stuck';
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createSharedRuntimeService({ basePath });
  const maxAgeMs = parseMaxAgeMs(args[1]);

  if (maxAgeMs.error !== undefined) {
    return usageError(maxAgeMs.error);
  }

  switch (scope) {
    case 'stuck': {
      const [sessions, traces] = await Promise.all([
        runtime.closeStuckSessions(maxAgeMs.value),
        runtime.closeStuckTraces(maxAgeMs.value),
      ]);
      return buildCleanupResult('stuck runtime entries', maxAgeMs.value, sessions, traces);
    }
    case 'sessions': {
      const sessions = await runtime.closeStuckSessions(maxAgeMs.value);
      return buildCleanupResult('stale sessions', maxAgeMs.value, sessions, []);
    }
    case 'traces': {
      const traces = await runtime.closeStuckTraces(maxAgeMs.value);
      return buildCleanupResult('stale traces', maxAgeMs.value, [], traces);
    }
    default:
      return usageError('ax cleanup [stuck|sessions|traces] [max-age-ms]');
  }
}

function parseMaxAgeMs(raw: string | undefined): { value: number; error?: string } {
  if (raw === undefined) {
    return { value: DEFAULT_MAX_AGE_MS };
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: DEFAULT_MAX_AGE_MS, error: 'ax cleanup [stuck|sessions|traces] [max-age-ms]' };
  }

  return { value: parsed };
}

function buildCleanupResult(
  label: string,
  maxAgeMs: number,
  sessions: Array<{ sessionId: string }>,
  traces: Array<{ traceId: string; workflowId: string }>,
): CommandResult {
  const lines = [
    `Cleanup complete: ${label}`,
    `Max age: ${maxAgeMs}ms`,
    `Closed sessions: ${sessions.length}`,
    ...sessions.map((session) => `- session ${session.sessionId}`),
    `Closed traces: ${traces.length}`,
    ...traces.map((trace) => `- trace ${trace.traceId} (${trace.workflowId})`),
  ];

  return success(lines.join('\n'), {
    maxAgeMs,
    closedSessions: sessions,
    closedTraces: traces,
  });
}
