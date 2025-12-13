/**
 * Run Command Cleanup Helper
 *
 * Extracts duplicate cleanup logic from run.ts handler.
 * Provides testable, reusable cleanup functions for agent execution.
 *
 * @since v12.8.5
 */

import { logger } from '../logging/logger.js';
import { writeAgentStatus, type AgentStatus } from './agent-status-writer.js';

/**
 * Cleanup context for run command
 * Uses generic types to support different manager implementations
 */
export interface RunCleanupContext {
  /** Memory manager instance (optional) */
  memoryManager?: { close: () => Promise<void> } | null;
  /** Router instance (optional) */
  router?: { destroy: () => void } | null;
  /** Context manager instance (optional) - uses any for flexibility */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextManager?: { cleanup: (context: any) => Promise<void> } | null;
  /** Execution context (optional) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any;
}

/**
 * Status info for agent completion
 */
export interface RunStatusInfo {
  /** Agent name */
  agent: string;
  /** Execution start time (Date.now()) */
  startTime: number;
  /** Task description */
  task: string;
  /** Provider name */
  provider?: string;
  /** Error if failed */
  error?: Error;
}

/**
 * Clean up resources after agent execution
 *
 * Handles cleanup of:
 * - Memory manager (database connections)
 * - Router (health checks)
 * - Context manager (workspace, temp files)
 * - Process manager (child processes)
 * - Stdio streams
 *
 * @param ctx - Cleanup context
 * @param suppressErrors - Whether to suppress cleanup errors (default: false)
 */
export async function cleanupResources(
  ctx: RunCleanupContext,
  suppressErrors: boolean = false
): Promise<void> {
  const { memoryManager, router, contextManager, context } = ctx;

  // Clean up memory manager (close database connections)
  if (memoryManager) {
    try {
      await memoryManager.close();
    } catch (error) {
      if (!suppressErrors) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.debug('Memory manager cleanup error', { error: errMsg });
    }
  }

  // Clean up router (stop health checks)
  if (router) {
    try {
      router.destroy();
    } catch (error) {
      if (!suppressErrors) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.debug('Router cleanup error', { error: errMsg });
    }
  }

  // Clean up context (workspace, temp files)
  if (contextManager && context) {
    try {
      await contextManager.cleanup(context);
    } catch (error) {
      if (!suppressErrors) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.debug('Context cleanup error', { error: errMsg });
    }
  }

  // Ensure event loop completes all pending operations
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * Shutdown process manager gracefully
 *
 * @param timeoutMs - Shutdown timeout in milliseconds (default: 3000)
 */
export async function shutdownProcessManager(timeoutMs: number = 3000): Promise<void> {
  try {
    const { processManager } = await import('../process/process-manager.js');
    await processManager.shutdown(timeoutMs);
  } catch (error) {
    logger.error('Process manager shutdown failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Continue with process exit anyway
  }
}

/**
 * Close stdio streams to signal completion
 */
export function closeStdioStreams(): void {
  if (process.stdout.writable) {
    process.stdout.end();
  }
  if (process.stderr.writable) {
    process.stderr.end();
  }
}

/**
 * Write agent status and perform full cleanup
 *
 * This is the main cleanup function that combines all cleanup steps.
 *
 * @param ctx - Cleanup context
 * @param statusInfo - Status information
 * @param success - Whether execution was successful
 */
export async function performFullCleanup(
  ctx: RunCleanupContext,
  statusInfo: RunStatusInfo,
  success: boolean
): Promise<void> {
  // Clean up resources (suppress errors on failure path)
  await cleanupResources(ctx, !success);

  // Shutdown process manager
  await shutdownProcessManager(3000);

  // Close stdio streams
  closeStdioStreams();

  // Write agent status for notification system
  const status: AgentStatus = {
    agent: statusInfo.agent,
    status: success ? 'completed' : 'failed',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    duration: Date.now() - statusInfo.startTime,
    task: statusInfo.task,
    provider: statusInfo.provider,
    ...(statusInfo.error && { error: statusInfo.error.message })
  };

  await writeAgentStatus(status);
}
