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
 * @since v5.7.1
 */

import { ChildProcess } from 'child_process';
import { logger } from './logger.js';

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
    for (const handler of this.shutdownHandlers) {
      try {
        await Promise.race([
          handler(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Handler timeout')), timeout / 2)
          )
        ]);
      } catch (error) {
        logger.warn('Shutdown handler failed', {
          error: (error as Error).message
        });
      }
    }

    // Step 2: Send SIGTERM to all child processes
    const killPromises: Promise<void>[] = [];
    for (const child of this.childProcesses) {
      if (child.killed || child.exitCode !== null) {
        continue; // Already dead
      }

      killPromises.push(new Promise((resolve) => {
        child.once('exit', () => resolve());
        child.kill('SIGTERM');

        // Force kill after timeout/2
        setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            logger.warn('Force killing child process', { pid: child.pid });
            child.kill('SIGKILL');
          }
          resolve(); // Resolve anyway
        }, timeout / 2);
      }));
    }

    // Wait for all children to exit (or timeout)
    await Promise.race([
      Promise.all(killPromises),
      new Promise((resolve) => setTimeout(resolve, timeout))
    ]);

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
        // Ignore errors (process might already be dead)
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

/**
 * Install process exit handlers to ensure cleanup
 *
 * This should be called once at application startup (in CLI index.ts)
 */
export function installExitHandlers(): void {
  let handlerInstalled = false;

  const exitHandler = async (signal: string) => {
    if (handlerInstalled) {
      return; // Prevent re-entry
    }
    handlerInstalled = true;

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
  process.once('SIGTERM', () => exitHandler('SIGTERM'));
  process.once('SIGINT', () => exitHandler('SIGINT'));
  process.once('SIGHUP', () => exitHandler('SIGHUP'));

  // Handle uncaught exceptions
  process.once('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    exitHandler('uncaughtException');
  });

  // Handle unhandled rejections
  process.once('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    exitHandler('unhandledRejection');
  });
}
