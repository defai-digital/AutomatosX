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
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { checkDangerousOp } from '../utils/dangerous-op-guard.js';
import {
  safeValidateCleanupOptions,
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
} from '../utils/storage-instances.js';

// Lazy-initialized shared instances
let sessionStore: SessionStore | undefined;
let sessionManager: SessionManager | undefined;

/**
 * Get or create shared session instances
 */
function getSessionInstances(): { store: SessionStore; manager: SessionManager } {
  if (sessionStore === undefined) {
    sessionStore = createSessionStore();
    sessionManager = createSessionManager(sessionStore, DEFAULT_SESSION_DOMAIN_CONFIG);
  }
  return { store: sessionStore, manager: sessionManager! };
}

/**
 * Cleanup command handler
 */
export async function cleanupCommand(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Parse and validate options
  const rawOpts = extractCleanupOptions(options);
  const validation = safeValidateCleanupOptions(rawOpts);

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
      const action = dryRun ? 'would be' : '';
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
 * Extract cleanup options from CLI options
 */
function extractCleanupOptions(options: CLIOptions): Record<string, unknown> {
  const opts = options as unknown as Record<string, unknown>;
  const types = parseTypes(opts.types);
  return {
    force: opts.force === true,
    types: types.length > 0 ? types : undefined,
    olderThan: parseNumber(opts['older-than'] ?? opts.olderThan),
    format: options.format,
  };
}

/**
 * Parse types option
 */
function parseTypes(value: unknown): CleanupDataType[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split(',') as CleanupDataType[];
  }
  if (Array.isArray(value)) {
    return value as CleanupDataType[];
  }
  return [];
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

    // If not dry run, actually delete
    if (!dryRun) {
      for (const session of toClean) {
        await store.delete(session.sessionId);
      }
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
  const days = olderThanDays ?? 30; // Default 30 days
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

    // List all trace summaries (up to 1000 for cleanup)
    const summaries = await store.listTraces(1000);

    // Find traces to delete (older than cutoff)
    const toDelete = summaries.filter((s) => new Date(s.startTime) < cutoffDate);

    // If not dry run, actually delete
    if (!dryRun) {
      for (const trace of toDelete) {
        await store.deleteTrace(trace.traceId);
      }
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
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
