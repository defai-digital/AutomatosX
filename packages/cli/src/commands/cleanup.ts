/**
 * Cleanup Command
 *
 * Clean up old data based on retention policies.
 * Supports dry run mode by default for safety.
 *
 * Usage:
 *   ax cleanup                     # Dry run (show what would be cleaned)
 *   ax cleanup --force             # Actually perform cleanup
 *   ax cleanup --older-than=7      # Clean data older than 7 days
 *   ax cleanup --types=checkpoints # Clean only checkpoints
 *   ax cleanup --stuck             # Close stuck running traces (>1 hour)
 *   ax cleanup --stuck --max-age=30 # Close traces stuck for >30 minutes
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { checkDangerousOp } from '../utils/dangerous-op-guard.js';
import {
  safeValidateCleanupOptions,
  LIMIT_MAX,
  RETENTION_DAYS_CLEANUP,
  type CleanupResult,
  type CleanupTypeResult,
  type CleanupDataType,
} from '@defai.digital/contracts';
import {
  createSessionManager,
  createSessionStore,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionManager,
  type SessionStore,
} from '@defai.digital/session-domain';
import {
  getCheckpointStorage,
  getTraceStore,
  getDLQ,
  initializeStorageAsync,
} from '../utils/storage-instances.js';
import { formatBytes } from '../utils/formatters.js';

// Lazy-initialized shared instances
let sessionStore: SessionStore | undefined;
let sessionManager: SessionManager | undefined;

/**
 * Get or create shared session instances
 */
function getSessionInstances(): { store: SessionStore; manager: SessionManager } {
  if (sessionStore === undefined || sessionManager === undefined) {
    sessionStore = createSessionStore();
    sessionManager = createSessionManager(sessionStore, DEFAULT_SESSION_DOMAIN_CONFIG);
  }
  return { store: sessionStore, manager: sessionManager };
}

/**
 * Cleanup command handler
 */
export async function cleanupCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Initialize storage (required for trace store access)
  await initializeStorageAsync();

  // Handle --stuck option for closing stuck running traces
  // Note: --stuck is passed through args, not options (since it's command-specific)
  if (args.includes('--stuck')) {
    return handleStuckTraces(args, options);
  }

  // Parse and validate options
  const extractedOpts = extractCleanupOptions(args, options);
  const validation = safeValidateCleanupOptions(extractedOpts);

  if (!validation.success) {
    return {
      success: false,
      exitCode: 1,
      message: `Invalid options: ${validation.error.errors.map((e) => e.message).join(', ')}`,
      data: undefined,
    };
  }

  const cleanupOpts = validation.data;
  const dryRun = !cleanupOpts.force;

  // Check dangerous operation guard if force cleanup
  if (cleanupOpts.force) {
    const extOpts = options as unknown as Record<string, unknown>;
    const check = await checkDangerousOp('cleanup.force', {
      force: extOpts.yes === true,
    });

    if (!check.allowed) {
      return {
        success: false,
        exitCode: 1,
        message: check.reason ?? 'Operation cancelled',
        data: undefined,
      };
    }
  }

  // Display header
  if (options.format !== 'json') {
    console.log('');
    if (dryRun) {
      console.log('Dry run - no data will be deleted:');
    } else {
      console.log('Cleaning up...');
    }
    console.log('');
  }

  // Perform cleanup for each type
  const results: CleanupTypeResult[] = [];
  let totalCount = 0;
  let totalFreedBytes = 0;

  for (const type of cleanupOpts.types) {
    const result = await cleanDataType(type, cleanupOpts.olderThan, dryRun);
    results.push(result);
    totalCount += result.count;
    if (result.freedBytes) {
      totalFreedBytes += result.freedBytes;
    }

    if (options.format !== 'json') {
      const action = dryRun ? 'would be' : 'were';
      console.log(`  ${type}: ${result.count} items ${action} cleaned`);
    }
  }

  const cleanupResult: CleanupResult = {
    cleaned: results,
    totalCount,
    totalFreedBytes: totalFreedBytes > 0 ? totalFreedBytes : undefined,
    dryRun,
  };

  // Format output
  if (options.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      message: undefined,
      data: cleanupResult,
    };
  }

  // Text output summary
  console.log('');
  if (dryRun) {
    console.log(`Total: ${totalCount} items would be cleaned.`);
    if (totalCount > 0) {
      console.log('Run with --force to actually clean.');
    }
  } else {
    console.log(`Total: ${totalCount} items cleaned.`);
    if (totalFreedBytes > 0) {
      console.log(`Freed: ${formatBytes(totalFreedBytes)}`);
    }
  }
  console.log('');

  return {
    success: true,
    exitCode: 0,
    message: undefined,
    data: cleanupResult,
  };
}

/**
 * Extract cleanup options from CLI args and options
 */
function extractCleanupOptions(args: string[], options: CLIOptions): Record<string, unknown> {
  // Parse args for command-specific flags
  const hasForce = args.includes('--force');
  const typesArg = getArgValue(args, '--types');
  const olderThanArg = getArgValue(args, '--older-than');

  const types = parseTypes(typesArg);
  return {
    force: hasForce,
    types: types.length > 0 ? types : undefined,
    olderThan: parseNumber(olderThanArg),
    format: options.format,
  };
}

/**
 * Get value for an argument from args array
 */
function getArgValue(args: string[], flag: string): string | undefined {
  // Check for --flag=value format
  const equalMatch = args.find((a) => a.startsWith(`${flag}=`));
  if (equalMatch) {
    return equalMatch.split('=')[1];
  }
  // Check for --flag value format
  const flagIndex = args.indexOf(flag);
  if (flagIndex !== -1 && flagIndex + 1 < args.length) {
    const nextArg = args[flagIndex + 1];
    if (nextArg && !nextArg.startsWith('-')) {
      return nextArg;
    }
  }
  return undefined;
}

/**
 * Valid cleanup data types
 */
const VALID_CLEANUP_TYPES: CleanupDataType[] = ['checkpoints', 'sessions', 'traces', 'dlq'];

/**
 * Parse types option with validation
 */
function parseTypes(value: unknown): CleanupDataType[] {
  if (!value) return [];

  const rawTypes: string[] = typeof value === 'string'
    ? value.split(',').map((t) => t.trim())
    : Array.isArray(value)
      ? value
      : [];

  // Filter to only valid types to prevent invalid data from passing through
  return rawTypes.filter((t): t is CleanupDataType =>
    VALID_CLEANUP_TYPES.includes(t as CleanupDataType)
  );
}

/**
 * Parse number option
 */
function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Clean data of a specific type
 */
async function cleanDataType(
  type: CleanupDataType,
  olderThanDays: number | undefined,
  dryRun: boolean
): Promise<CleanupTypeResult> {
  switch (type) {
    case 'checkpoints':
      return cleanCheckpoints(olderThanDays, dryRun);

    case 'sessions':
      return cleanSessions(olderThanDays, dryRun);

    case 'traces':
      return cleanTraces(olderThanDays, dryRun);

    case 'dlq':
      return cleanDLQ(olderThanDays, dryRun);

    default:
      return { type, count: 0 };
  }
}

/**
 * Clean expired checkpoints
 * Uses checkpoint storage's deleteExpired() method
 */
async function cleanCheckpoints(
  _olderThanDays: number | undefined,
  dryRun: boolean
): Promise<CleanupTypeResult> {
  try {
    const storage = getCheckpointStorage();

    // For dry run, we can't easily count expired without deletion
    // So we return 0 for dry run and actual count for real cleanup
    if (dryRun) {
      // List all checkpoints to give an estimate
      // Note: This is an approximation since we can't filter by date easily
      const allCheckpoints = await storage.list('*');
      return { type: 'checkpoints', count: allCheckpoints.length };
    }

    // Actually delete expired checkpoints
    const deletedCount = await storage.deleteExpired();
    return { type: 'checkpoints', count: deletedCount };
  } catch {
    return { type: 'checkpoints', count: 0 };
  }
}

/**
 * Clean old sessions
 * Sessions are cleaned if they are completed/failed AND older than threshold
 */
async function cleanSessions(
  olderThanDays: number | undefined,
  dryRun: boolean
): Promise<CleanupTypeResult> {
  try {
    const { store } = getSessionInstances();
    const cutoffDate = getCutoffDate(olderThanDays);

    // Get all sessions
    const sessions = await store.list();

    // Find sessions to clean (completed/failed and older than threshold)
    const toClean = sessions.filter((session) => {
      // Only clean completed or failed sessions
      if (session.status === 'active') return false;

      // Check age
      const createdAt = new Date(session.createdAt);
      return createdAt < cutoffDate;
    });

    // If not dry run, actually delete (in parallel for performance)
    if (!dryRun) {
      await Promise.all(
        toClean.map((session) => store.delete(session.sessionId))
      );
    }

    return { type: 'sessions', count: toClean.length };
  } catch {
    // Return 0 on error
    return { type: 'sessions', count: 0 };
  }
}

/**
 * Calculate cutoff date based on older-than days
 */
function getCutoffDate(olderThanDays: number | undefined): Date {
  const days = olderThanDays ?? RETENTION_DAYS_CLEANUP;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/**
 * Clean old traces
 * Deletes traces older than the specified cutoff date
 */
async function cleanTraces(
  olderThanDays: number | undefined,
  dryRun: boolean
): Promise<CleanupTypeResult> {
  try {
    const store = getTraceStore();
    const cutoffDate = getCutoffDate(olderThanDays);

    // List all trace summaries (up to LIMIT_MAX for cleanup)
    const summaries = await store.listTraces(LIMIT_MAX);

    // Find traces to delete (older than cutoff)
    const toDelete = summaries.filter((summary) => new Date(summary.startTime) < cutoffDate);

    // If not dry run, actually delete (in parallel for performance)
    if (!dryRun) {
      await Promise.all(
        toDelete.map((trace) => store.deleteTrace(trace.traceId))
      );
    }

    return { type: 'traces', count: toDelete.length };
  } catch {
    return { type: 'traces', count: 0 };
  }
}

/**
 * Clean resolved DLQ entries
 * Purges resolved entries based on retention configuration
 */
async function cleanDLQ(
  _olderThanDays: number | undefined,
  dryRun: boolean
): Promise<CleanupTypeResult> {
  try {
    const dlq = getDLQ();

    if (dryRun) {
      // For dry run, get stats to show how many resolved entries exist
      const stats = await dlq.getStats();
      return { type: 'dlq', count: stats.resolvedCount };
    }

    // Actually purge resolved entries
    // Note: purgeResolved() uses the DLQ config's retentionDays
    const purgedCount = await dlq.purgeResolved();
    return { type: 'dlq', count: purgedCount };
  } catch {
    return { type: 'dlq', count: 0 };
  }
}

/**
 * Handle --stuck option: close traces stuck in running status
 */
async function handleStuckTraces(args: string[], options: CLIOptions): Promise<CommandResult> {
  const dryRun = !args.includes('--force');
  const maxAgeArg = getArgValue(args, '--max-age');
  const maxAgeMinutes = parseNumber(maxAgeArg) ?? 60;
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  try {
    const store = getTraceStore();

    // Find stuck traces first (for reporting)
    const summaries = await store.listTraces(LIMIT_MAX);
    const currentTime = Date.now();
    const cutoff = currentTime - maxAgeMs;

    const stuckTraces = summaries.filter((summary) => {
      if (summary.status !== 'running' && summary.status !== 'pending') return false;
      const startTime = new Date(summary.startTime).getTime();
      return startTime < cutoff;
    });

    if (options.format !== 'json') {
      console.log('');
      if (dryRun) {
        console.log(`Found ${stuckTraces.length} stuck trace(s) running for more than ${maxAgeMinutes} minutes:`);
      } else {
        console.log(`Closing ${stuckTraces.length} stuck trace(s):`);
      }
      console.log('');

      for (const trace of stuckTraces) {
        const startTime = new Date(trace.startTime).getTime();
        const runningMs = currentTime - startTime;
        const runningMins = Math.round(runningMs / 60000);
        const runningHours = Math.round(runningMs / 3600000 * 10) / 10;
        const timeStr = runningMins >= 60 ? `${runningHours}h` : `${runningMins}m`;
        console.log(`  ${trace.traceId.slice(0, 8)}... - running for ${timeStr} (status: ${trace.status})`);
      }
      console.log('');
    }

    if (stuckTraces.length === 0) {
      return {
        success: true,
        exitCode: 0,
        message: 'No stuck traces found',
        data: { stuckCount: 0, closedCount: 0, dryRun },
      };
    }

    if (dryRun) {
      if (options.format !== 'json') {
        console.log(`Run with --force to close these traces.`);
        console.log('');
      }
      return {
        success: true,
        exitCode: 0,
        message: undefined,
        data: { stuckCount: stuckTraces.length, closedCount: 0, dryRun: true },
      };
    }

    // Actually close stuck traces
    const closedCount = await store.closeStuckTraces(maxAgeMs);

    if (options.format !== 'json') {
      console.log(`Closed ${closedCount} stuck trace(s).`);
      console.log('');
    }

    return {
      success: true,
      exitCode: 0,
      message: undefined,
      data: { stuckCount: stuckTraces.length, closedCount, dryRun: false },
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      message: error instanceof Error ? error.message : 'Failed to close stuck traces',
      data: undefined,
    };
  }
}

