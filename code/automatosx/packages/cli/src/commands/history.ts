/**
 * History Command
 *
 * View past workflow run history from the trace store.
 *
 * Usage:
 *   ax history                      # Show last 20 runs
 *   ax history --limit 50           # Show last 50 runs
 *   ax history --agent coder        # Filter by agent id
 *   ax history --status failed      # Show only failed runs
 *   ax history --verbose            # Show full details per run
 */

import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success } from '../utils/formatters.js';
import { formatRuntimeGuardSummaryLine } from '../utils/runtime-guard-summary.js';
import { asOptionalRecord, asStringValue, findUnexpectedFlag } from '../utils/validation.js';

const DEFAULT_LIMIT = 20;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms < 0) return '-';
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${Math.round(ms / MS_PER_SECOND)}s`;
  if (ms < MS_PER_HOUR) return `${Math.round(ms / MS_PER_MINUTE)}m`;
  return `${Math.round(ms / MS_PER_HOUR)}h`;
}

function formatAge(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (diffMs < MS_PER_MINUTE) return `${Math.round(diffMs / MS_PER_SECOND)}s ago`;
  if (diffMs < MS_PER_HOUR) return `${Math.round(diffMs / MS_PER_MINUTE)}m ago`;
  const diffDays = diffMs / (24 * MS_PER_HOUR);
  if (diffDays < 2) return `${Math.round(diffMs / MS_PER_HOUR)}h ago`;
  return `${Math.round(diffDays)}d ago`;
}

function formatStatus(status: string): string {
  switch (status) {
    case 'completed': return '[OK]  ';
    case 'failed':    return '[FAIL]';
    case 'running':   return '[... ]';
    default:          return '[?]   ';
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export async function historyCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (args[0] === 'help' || options.help) {
    return success(
      'Usage: ax history [options]\n\n' +
      'Options:\n' +
      '  --limit <n>       Number of runs to show (default: 20)\n' +
      '  --agent <id>      Filter by agent / workflow id\n' +
      '  --status <s>      Filter by status: completed | failed | running\n' +
      '  --verbose         Show full details per run\n' +
      '  --format json     Output as JSON',
    );
  }

  const unexpectedFlag = findUnexpectedFlag(args);
  if (unexpectedFlag !== undefined) {
    return failure(`Unknown history flag: ${unexpectedFlag}.`);
  }
  if (args[0] !== undefined) {
    return failure('Usage: ax history [options]');
  }

  const limit = options.limit ?? DEFAULT_LIMIT;
  const agentFilter = options.agent;
  const statusFilter = options.status;

  const runtime = createRuntime(options);
  let traces = await runtime.listTraces(limit * 3); // fetch extra for client-side filtering

  if (agentFilter !== undefined) {
    traces = traces.filter((t) =>
      t.workflowId.includes(agentFilter) ||
      asStringValue(asOptionalRecord(t.metadata)?.['agentId']) === agentFilter,
    );
  }

  if (statusFilter !== undefined) {
    traces = traces.filter((t) => t.status === statusFilter);
  }

  traces = traces.slice(0, limit);

  if (traces.length === 0) {
    const filterDesc = agentFilter ? ` for agent "${agentFilter}"` : '';
    return success(`No runs found${filterDesc}.`, { runs: [] });
  }

  if (options.format === 'json') {
    return success('', { runs: traces, count: traces.length });
  }

  const lines: string[] = ['', 'Run History:', ''];

  if (options.verbose) {
    for (const t of traces) {
      const durationMs = t.completedAt !== undefined
        ? Date.parse(t.completedAt) - Date.parse(t.startedAt)
        : undefined;
      lines.push(`${formatStatus(t.status)} ${t.workflowId}`);
      lines.push(`   Trace:    ${t.traceId}`);
      lines.push(`   Started:  ${formatAge(t.startedAt)}`);
      lines.push(`   Duration: ${formatDuration(durationMs)}`);
      lines.push(`   Steps:    ${t.stepResults.length}`);
      if (t.error?.message !== undefined) {
        lines.push(`   Error:    ${t.error.message}`);
      }
      if (t.status === 'failed' && t.checkpoint !== undefined && t.checkpoint.lastCompletedStepIndex >= 0) {
        lines.push(`   Resume:   ax resume ${t.traceId} (checkpoint at step ${t.checkpoint.lastCompletedStepIndex + 1})`);
      }
      const verboseGuard = formatRuntimeGuardSummaryLine(t.metadata, '   Policy:  ', 108);
      if (verboseGuard !== undefined) {
        lines.push(verboseGuard);
      }
      lines.push('');
    }
  } else {
    lines.push('Status  Workflow              Started       Duration  Steps');
    lines.push('------  --------------------  ------------  --------  -----');
    for (const t of traces) {
      const durationMs = t.completedAt !== undefined
        ? Date.parse(t.completedAt) - Date.parse(t.startedAt)
        : undefined;
      const resumable = t.status === 'failed' && t.checkpoint !== undefined && t.checkpoint.lastCompletedStepIndex >= 0;
      const status   = formatStatus(t.status);
      const workflow = truncate(t.workflowId, 20).padEnd(20);
      const started  = formatAge(t.startedAt).padEnd(12);
      const duration = formatDuration(durationMs).padEnd(8);
      const steps    = String(t.stepResults.length).padEnd(5);
      lines.push(`${status}  ${workflow}  ${started}  ${duration}  ${steps}${resumable ? '  [R]' : ''}`);
      const compactGuard = formatRuntimeGuardSummaryLine(t.metadata, '        policy:', 96);
      if (compactGuard !== undefined) {
        lines.push(compactGuard);
      }
    }
  }

  lines.push('');
  return success(lines.join('\n'), { runs: traces, count: traces.length });
}
