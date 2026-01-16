/**
 * History Command
 *
 * View past agent run history.
 * Provides visibility into completed, failed, and running executions.
 *
 * Usage:
 *   ax history                      # Show last 10 runs
 *   ax history --limit=20           # Show last 20 runs
 *   ax history --agent=coder        # Filter by agent
 *   ax history --status=failed      # Show only failed runs
 *   ax history --verbose            # Show full details
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  safeValidateHistoryOptions,
  LIMIT_DEFAULT,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  type HistoryOptions,
  type RunRecord,
  type RunStatus,
} from '@defai.digital/contracts';
import {
  createSessionManager,
  createSessionStore,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionManager,
} from '@defai.digital/session-domain';
import { formatAge, truncate } from '../utils/formatters.js';

// Lazy-initialized session manager (shared across commands)
let sessionManager: SessionManager | undefined;

/**
 * Get or create the session manager instance
 */
function getSessionManager(): SessionManager {
  if (sessionManager === undefined) {
    const store = createSessionStore();
    sessionManager = createSessionManager(store, DEFAULT_SESSION_DOMAIN_CONFIG);
  }
  return sessionManager;
}

/**
 * History command handler
 */
export async function historyCommand(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Parse and validate options
  const opts = extractHistoryOptions(options);
  const validation = safeValidateHistoryOptions(opts);

  if (!validation.success) {
    return {
      success: false,
      exitCode: 1,
      message: `Invalid options: ${validation.error.errors.map((e) => e.message).join(', ')}`,
      data: undefined,
    };
  }

  const historyOpts = validation.data;

  // Get run history
  // Note: This would integrate with session-domain's getRunHistory
  const runs = await getRunHistory(
    historyOpts.agent,
    historyOpts.status,
    historyOpts.limit ?? LIMIT_DEFAULT
  );

  if (runs.length === 0) {
    return {
      success: true,
      exitCode: 0,
      message: historyOpts.agent
        ? `No runs found for agent: ${historyOpts.agent}`
        : 'No runs found',
      data: { runs: [] },
    };
  }

  // Format for JSON output
  if (historyOpts.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      message: undefined,
      data: { runs },
    };
  }

  // Format for text output
  console.log('');
  console.log('Run History:');
  console.log('');

  if (historyOpts.verbose) {
    // Detailed view
    for (const run of runs) {
      console.log(`${formatStatus(run.status)} ${run.agentId}`);
      console.log(`   Task:     ${truncate(run.task, 60)}`);
      console.log(`   Started:  ${formatAge(run.startedAt)}`);
      console.log(`   Duration: ${formatDuration(run.durationMs)}`);
      console.log(`   Steps:    ${run.stepsCompleted}`);
      if (run.error) {
        console.log(`   Error:    ${run.error}`);
      }
      console.log('');
    }
  } else {
    // Compact view
    console.log('Status  Agent           Started     Duration  Task');
    console.log('------  --------------  ----------  --------  ----');

    for (const run of runs) {
      const status = formatStatus(run.status);
      const agent = run.agentId.slice(0, 14).padEnd(14);
      const started = formatAge(run.startedAt).padEnd(10);
      const duration = formatDuration(run.durationMs).padEnd(8);
      const task = truncate(run.task, 40);

      console.log(`${status}  ${agent}  ${started}  ${duration}  ${task}`);
    }
  }

  console.log('');

  return {
    success: true,
    exitCode: 0,
    message: undefined,
    data: { runs, count: runs.length },
  };
}

/**
 * Extract history options from CLI options
 */
function extractHistoryOptions(options: CLIOptions): Partial<HistoryOptions> {
  const rawOpts = options as unknown as Record<string, unknown>;
  return {
    agent: rawOpts.agent as string | undefined,
    status: rawOpts.status as RunStatus | undefined,
    limit: (rawOpts.limit as number) ?? LIMIT_DEFAULT,
    verbose: options.verbose,
    format: options.format,
  };
}

/**
 * Get run history from session-domain
 */
async function getRunHistory(
  agentId?: string,
  status?: RunStatus,
  limit?: number
): Promise<RunRecord[]> {
  try {
    const manager = getSessionManager();

    // Build options object conforming to HistoryQuery contract
    // limit is required in the contract (has default in schema)
    const options: {
      agentId?: string;
      status?: RunStatus;
      limit: number;
    } = {
      limit: limit ?? LIMIT_DEFAULT,
    };

    if (agentId !== undefined) {
      options.agentId = agentId;
    }
    if (status !== undefined) {
      options.status = status;
    }

    const domainRecords = await manager.getRunHistory(options);

    // Map domain records to contract RunRecord type
    // They should be compatible but we cast explicitly for safety
    return domainRecords;
  } catch {
    // Return empty array on error
    return [];
  }
}

/**
 * Format run status for display
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return '[OK]  ';
    case 'failed':
      return '[FAIL]';
    case 'running':
      return '[... ]';
    case 'cancelled':
      return '[STOP]';
    default:
      return '[?]   ';
  }
}

/** Milliseconds per second */
const MS_PER_SECOND = 1000;

/** Milliseconds per minute */
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Milliseconds per hour */
const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;

/**
 * Format duration in milliseconds
 */
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${Math.round(ms / MS_PER_SECOND)}s`;
  if (ms < MS_PER_HOUR) return `${Math.round(ms / MS_PER_MINUTE)}m`;
  return `${Math.round(ms / MS_PER_HOUR)}h`;
}

