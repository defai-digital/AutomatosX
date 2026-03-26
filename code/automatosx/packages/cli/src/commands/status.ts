import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, resolveCliBasePath, success, usageError } from '../utils/formatters.js';
import {
  buildDeniedImportedSkillAggregate,
  buildRuntimeGovernanceAggregate,
  formatDeniedImportedSkillSummaryLines,
  formatRuntimeGuardSummaryLine,
} from '../utils/runtime-guard-summary.js';

export async function statusCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (args[0] !== undefined) {
    return args[0].startsWith('--')
      ? failure(`Unknown status flag: ${args[0]}.`)
      : usageError('ax status');
  }

  const basePath = resolveCliBasePath(options);
  const runtime = createRuntime(options);
  const status = await runtime.getStatus({ limit: options.limit });
  const deniedImportedSkills = await buildDeniedImportedSkillAggregate(basePath);
  const governance = buildRuntimeGovernanceAggregate(status.recentFailedTraces, {
    deniedImportedSkills,
  });
  const recentFailedTraces = status.recentFailedTraces.length > 0
    ? status.recentFailedTraces.flatMap((trace) => {
      const lines = [`- ${trace.traceId} ${trace.workflowId} ${trace.error?.message ?? 'Unknown error'}`];
      const guardLine = formatRuntimeGuardSummaryLine(trace.metadata, '  guard:', 104);
      if (guardLine !== undefined) {
        lines.push(guardLine);
      }
      return lines;
    })
    : ['- none'];
  const deniedImportedSkillLines = formatDeniedImportedSkillSummaryLines(governance.deniedImportedSkills);

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
    ...recentFailedTraces,
    '',
    'Denied imported skills:',
    ...deniedImportedSkillLines,
  ].join('\n'), {
    ...status,
    governance,
  });
}
