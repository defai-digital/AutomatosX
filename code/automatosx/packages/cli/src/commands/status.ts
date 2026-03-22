import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { success } from '../utils/formatters.js';

export async function statusCommand(_args: string[], options: CLIOptions): Promise<CommandResult> {
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createSharedRuntimeService({ basePath });
  const status = await runtime.getStatus({ limit: options.limit });

  return success([
    'AutomatosX Status',
    '',
    `Sessions: ${status.sessions.active} active, ${status.sessions.completed} completed, ${status.sessions.failed} failed`,
    `Traces: ${status.traces.running} running, ${status.traces.completed} completed, ${status.traces.failed} failed`,
    `Provider mode: ${status.runtime.providerExecutionMode}`,
    `Default provider: ${status.runtime.defaultProvider ?? 'n/a'}`,
    `Configured executors: ${status.runtime.configuredExecutors.length > 0 ? status.runtime.configuredExecutors.join(', ') : 'none'}`,
    '',
    'Active sessions:',
    ...(status.activeSessions.length > 0
      ? status.activeSessions.map((session) => `- ${session.sessionId} ${session.initiator} ${session.task}`)
      : ['- none']),
    '',
    'Running traces:',
    ...(status.runningTraces.length > 0
      ? status.runningTraces.map((trace) => `- ${trace.traceId} ${trace.workflowId} ${trace.startedAt}`)
      : ['- none']),
    '',
    'Recent failed traces:',
    ...(status.recentFailedTraces.length > 0
      ? status.recentFailedTraces.map((trace) => `- ${trace.traceId} ${trace.workflowId} ${trace.error?.message ?? 'Unknown error'}`)
      : ['- none']),
  ].join('\n'), status);
}
