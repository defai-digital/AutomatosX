/**
 * Process Manager - Track and cleanup child processes
 *
 * Fixes bug: Background tasks hanging when run via Claude Code
 *
 * Problem: Provider child processes (spawn) may continue running after
 * parent process calls process.exit(), causing Bash tool to hang waiting
 * for stdio streams to close.
 *
 * Solution: Track all spawned child processes and forcefully kill them
 * before process exit.
 *
 * @since v5.6.15
 */

import { ChildProcess } from 'child_process';
import { logger } from '../logging/logger.js';

class ProcessManager {
  private childProcesses: Set<ChildProcess> = new Set();
  private isShuttingDown = false;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  /**
   * Register a child process for tracking
   */
  register(child: ChildProcess, name?: string): void {
    if (this.isShuttingDown) {
      // Already shutting down, kill immediately
      child.kill('SIGTERM');
      return;
    }

    this.childProcesses.add(child);

    logger.debug('Child process registered', {
      pid: child.pid,
      name: name || 'unnamed'
    });

    // Auto-cleanup when process exits
    child.once('exit', () => {
      this.childProcesses.delete(child);
      logger.debug('Child process exited', {
        pid: child.pid,
        name: name || 'unnamed'
      });
    });
  }

  /**
   * Add a shutdown handler (async cleanup function)
   */
  onShutdown(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Gracefully shutdown all child processes and run cleanup handlers
   *
   * @param timeout Maximum time to wait for graceful shutdown (ms)
   */
  async shutdown(timeout: number = 5000): Promise<void> {
    if (this.isShuttingDown) {
      return; // Already shutting down
    }

    this.isShuttingDown = true;

    logger.info('ProcessManager: Starting graceful shutdown', {
      childProcesses: this.childProcesses.size,
      shutdownHandlers: this.shutdownHandlers.length
    });

    // Step 1: Run custom shutdown handlers (close DB connections, etc.)
    // CRITICAL FIX (v5.6.18): Track and clear timeout to prevent leak
    for (const handler of this.shutdownHandlers) {
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        await Promise.race([
          handler(),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Handler timeout')), timeout / 2);
          })
        ]);
      } catch (error) {
        logger.warn('Shutdown handler failed', {
          error: (error as Error).message
        });
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    // Step 2: Send SIGTERM to all child processes
    const killPromises: Promise<void>[] = [];
    for (const child of this.childProcesses) {
      if (child.killed || child.exitCode !== null) {
        continue; // Already dead
      }

      killPromises.push(new Promise((resolve) => {
        let mainTimeoutId: NodeJS.Timeout | null = null;
        let fallbackTimeoutId: NodeJS.Timeout | null = null;
        let resolved = false;

        const cleanup = () => {
          if (mainTimeoutId) {
            clearTimeout(mainTimeoutId);
            mainTimeoutId = null;
          }
          if (fallbackTimeoutId) {
            clearTimeout(fallbackTimeoutId);
            fallbackTimeoutId = null;
          }
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        // Resolve when process exits
        child.once('exit', () => {
          cleanup();
        });

        child.kill('SIGTERM');

        // Force kill after timeout/2 if still running
        mainTimeoutId = setTimeout(() => {
          mainTimeoutId = null;
          if (!child.killed && child.exitCode === null) {
            logger.warn('Force killing child process', { pid: child.pid });
            child.kill('SIGKILL');

            // Set fallback timeout in case SIGKILL doesn't trigger exit event
            fallbackTimeoutId = setTimeout(() => {
              cleanup();
            }, 100);
          } else {
            // Process already exited, cleanup immediately
            cleanup();
          }
        }, timeout / 2);
      }));
    }

    // Wait for all children to exit (or timeout)
    // CRITICAL FIX (v5.6.24): Track and clear timeout to prevent leak
    let finalTimeoutId: NodeJS.Timeout | null = null;
    try {
      await Promise.race([
        Promise.all(killPromises),
        new Promise((resolve) => {
          finalTimeoutId = setTimeout(resolve, timeout);
        })
      ]);
    } finally {
      // Always clear the timeout, whether processes completed or timed out
      if (finalTimeoutId !== null) {
        clearTimeout(finalTimeoutId);
      }
    }

    logger.info('ProcessManager: Shutdown complete', {
      remainingProcesses: this.childProcesses.size
    });

    // Clear tracking
    this.childProcesses.clear();
    this.shutdownHandlers = [];
  }

  /**
   * Force kill all child processes immediately (no grace period)
   */
  forceKillAll(): void {
    logger.warn('ProcessManager: Force killing all child processes', {
      count: this.childProcesses.size
    });

    for (const child of this.childProcesses) {
      try {
        if (!child.killed && child.exitCode === null) {
          child.kill('SIGKILL');
        }
      } catch (error) {
        logger.warn('Failed to force kill child process', {
          pid: child.pid,
          error: (error as Error).message,
        });
      }
    }

    this.childProcesses.clear();
  }

  /**
   * Get current child process count
   */
  getActiveCount(): number {
    // Filter out processes that have already exited
    const activeProcesses = Array.from(this.childProcesses).filter(
      child => !child.killed && child.exitCode === null
    );
    return activeProcesses.length;
  }
}

// Singleton instance
export const processManager = new ProcessManager();

// Module-level flags for exit handler management
let exitHandlersInstalled = false;
let exitInProgress = false;

/**
 * Install process exit handlers to ensure cleanup
 *
 * This should be called once at application startup (in CLI index.ts)
 */
export function installExitHandlers(): void {
  if (exitHandlersInstalled) {
    logger.warn('Exit handlers already installed, skipping duplicate installation');
    return;
  }
  exitHandlersInstalled = true;

  const exitHandler = async (signal: string) => {
    if (exitInProgress) {
      return; // Prevent re-entry
    }
    exitInProgress = true;

    // Remove all other listeners to prevent race conditions
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    logger.info(`Received ${signal}, initiating shutdown...`);

    // Graceful shutdown with 5 second timeout
    await processManager.shutdown(5000);

    // Force kill any remaining processes
    processManager.forceKillAll();

    // Close stdio streams to signal completion to Bash tool
    try {
      if (process.stdout.writable) {
        process.stdout.end();
      }
      if (process.stderr.writable) {
        process.stderr.end();
      }
    } catch (error) {
      // Ignore errors
    }

    // Exit with appropriate code
    process.exit(signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1);
  };

  // Handle various exit signals
  process.once('SIGTERM', async () => await exitHandler('SIGTERM'));
  process.once('SIGINT', async () => await exitHandler('SIGINT'));
  process.once('SIGHUP', async () => await exitHandler('SIGHUP'));

  // Handle uncaught exceptions
  process.once('uncaughtException', async (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    await exitHandler('uncaughtException');
  });

  // Handle unhandled rejections
  process.once('unhandledRejection', async (reason) => {
    logger.error('Unhandled rejection', { reason });
    await exitHandler('unhandledRejection');
  });
}
