/**
 * Agent Status Writer - Write completion status for background agents
 *
 * Enables notification system for background agent completion.
 * Background agents write status files on completion, allowing
 * watchers to be notified when agents finish.
 *
 * @since v8.5.0
 */

import { writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '../logging/logger.js';

/**
 * Agent completion status
 */
export interface AgentStatus {
  /** Agent name */
  agent: string;
  /** Completion status */
  status: 'completed' | 'failed';
  /** ISO timestamp */
  timestamp: string;
  /** Process ID */
  pid: number;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Error message (if failed) */
  error?: string;
  /** Task description */
  task?: string;
  /** Provider used */
  provider?: string;
}

/**
 * Write agent completion status to file
 *
 * Creates a status file in .automatosx/status/ directory that
 * can be detected by file watchers for completion notifications.
 *
 * @param status - Agent status to write
 * @param projectDir - Project directory (defaults to cwd)
 */
export async function writeAgentStatus(
  status: AgentStatus,
  projectDir: string = process.cwd()
): Promise<void> {
  try {
    // Validate agent name before proceeding
    if (typeof status.agent !== 'string' || status.agent.trim() === '') {
      logger.warn('Cannot write agent status: agent name is missing or invalid.', {
        status
      });
      return;
    }

    // Create status directory if it doesn't exist
    const statusDir = join(projectDir, '.automatosx', 'status');
    await mkdir(statusDir, { recursive: true });

    // Get PID for filename and status data
    const pid = status.pid || process.pid;

    // Sanitize agent name for use in filename
    const sanitizedAgentName = status.agent.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Generate unique status filename
    const timestamp = Date.now();
    const statusFile = join(
      statusDir,
      `${sanitizedAgentName}-${timestamp}-${pid}.json`
    );

    // Write status file
    const statusData = {
      ...status,
      timestamp: status.timestamp || new Date().toISOString(),
      pid
    };

    await writeFile(statusFile, JSON.stringify(statusData, null, 2), 'utf-8');

    logger.debug('Agent status written', {
      agent: status.agent,
      status: status.status,
      file: statusFile
    });
  } catch (error) {
    // Non-critical error - don't fail the agent execution
    logger.warn('Failed to write agent status', {
      agent: status.agent,
      error: (error as Error).message
    });
  }
}

/**
 * Clean up old status files
 *
 * Removes status files older than the specified age to prevent
 * accumulation of old status files.
 *
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @param projectDir - Project directory (defaults to cwd)
 */
export async function cleanupOldStatusFiles(
  maxAgeMs: number = 3600000, // 1 hour default
  projectDir: string = process.cwd()
): Promise<void> {
  try {
    const statusDir = join(projectDir, '.automatosx', 'status');
    const files = await readdir(statusDir);

    const now = Date.now();
    const cutoff = now - maxAgeMs;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      // Extract timestamp from filename (agentname-timestamp-pid.json or agentname-timestamp.json)
      const match = file.match(/-(\d+)(?:-\d+)?\.json$/);
      if (!match || !match[1]) continue;

      const fileTimestamp = parseInt(match[1], 10);
      if (fileTimestamp < cutoff) {
        const filePath = join(statusDir, file);
        try {
          await unlink(filePath);
          logger.debug('Cleaned up old status file', { file });
        } catch (e: any) {
          // If the file does not exist, it might have been deleted by another process.
          // This is not an error in the context of cleanup.
          if (e.code !== 'ENOENT') {
            throw e; // Re-throw other errors
          }
        }
      }
    }
  } catch (error) {
    // Non-critical error - just log it
    logger.warn('Failed to cleanup status files', {
      error: (error as Error).message
    });
  }
}
