/**
 * Background Agent Monitor - Monitor and notify on agent completion
 *
 * Watches the .automatosx/status/ directory for completion status files
 * written by background agents, enabling real-time notification when
 * agents finish execution.
 *
 * @since v8.5.0
 */

import { watch, existsSync } from 'fs';
import { readFile, unlink, readdir, rename, mkdir } from 'fs/promises';
import { join } from 'path';
import type { AgentStatus } from '../utils/agent-status-writer.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

/**
 * Agent completion callback
 */
export type AgentCompletionCallback = (status: AgentStatus) => void | Promise<void>;

/**
 * Background Agent Monitor
 *
 * Monitors .automatosx/status/ directory for agent completion status files.
 * Uses fs.watch() for low-latency notifications (~10-50ms).
 *
 * Features:
 * - File-based notification system
 * - Automatic cleanup of processed status files
 * - Race condition handling (watcher starts after agent completes)
 * - Multiple callback support
 * - Graceful shutdown
 */
export class BackgroundAgentMonitor {
  private fsWatcher: ReturnType<typeof watch> | null = null;
  private projectDir: string;
  private statusDir: string;
  private callbacks: Map<string, AgentCompletionCallback[]> = new Map();

  /**
   * Create Background Agent Monitor
   *
   * @param projectDir - Project directory (defaults to cwd)
   */
  constructor(projectDir: string = process.cwd()) {
    this.projectDir = projectDir;
    this.statusDir = join(projectDir, '.automatosx', 'status');
  }

  /**
   * Watch for specific agent completion
   *
   * Registers a callback to be invoked when the specified agent completes.
   * Automatically cleans up after receiving notification.
   *
   * @param agentName - Agent name to watch for
   * @param callback - Callback invoked on completion
   * @returns Promise that resolves with agent status
   */
  async watchAgent(
    agentName: string,
    callback?: AgentCompletionCallback
  ): Promise<AgentStatus> {
    return new Promise((resolve, reject) => {
      // Register internal callback that resolves promise
      const wrappedCallback: AgentCompletionCallback = async (status) => {
        try {
          // Call user callback if provided
          if (callback) {
            await callback(status);
          }
          resolve(status);
        } catch (error) {
          reject(error);
        }
      };

      // Add callback for this agent
      if (!this.callbacks.has(agentName)) {
        this.callbacks.set(agentName, []);
      }
      this.callbacks.get(agentName)!.push(wrappedCallback);

      // Start watching if not already
      if (!this.fsWatcher) {
        this.startWatching().catch(reject);
      }

      // Check for existing status files (race condition handling)
      this.checkExistingStatusFiles(agentName).catch(reject);
    });
  }

  /**
   * Watch for multiple agents
   *
   * Convenient way to watch multiple agents at once.
   *
   * @param agentNames - Array of agent names to watch
   * @param callback - Callback invoked for each completion
   * @returns Promise that resolves when all agents complete
   */
  async watchAgents(
    agentNames: string[],
    callback?: AgentCompletionCallback
  ): Promise<AgentStatus[]> {
    const promises = agentNames.map(name => this.watchAgent(name, callback));
    return Promise.all(promises);
  }

  /**
   * Start watching status directory
   *
   * Uses fs.watch() for low-latency file system events.
   */
  private async startWatching(): Promise<void> {
    if (this.fsWatcher) return;

    try {
      // Ensure status directory exists before watching
      if (!existsSync(this.statusDir)) {
        await mkdir(this.statusDir, { recursive: true });
        logger.debug('Created status directory', { dir: this.statusDir });
      }

      // Watch status directory for changes
      this.fsWatcher = watch(
        this.statusDir,
        { persistent: false, recursive: false },
        (eventType, filename) => {
          if (eventType === 'rename' && filename) {
            // New file created or file removed
            this.processStatusFile(filename).catch(error => {
              logger.warn('Failed to process status file', {
                file: filename,
                error: (error as Error).message
              });
            });
          }
        }
      );

      logger.debug('Started watching status directory', {
        dir: this.statusDir
      });
    } catch (error) {
      logger.error('Failed to start watching status directory', {
        dir: this.statusDir,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process status file
   *
   * Reads status file, invokes callbacks, and cleans up.
   */
  private async processStatusFile(filename: string): Promise<void> {
    if (!filename.endsWith('.json')) {
      return;
    }

    const filePath = join(this.statusDir, filename);
    const processingPath = `${filePath}.processing`;

    try {
      await rename(filePath, processingPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return; // File already processed
      }
      logger.debug(`Could not acquire lock on status file: ${filename}`, {
        error: (error as Error).message
      });
      return;
    }

    try {
      const statusData = await readFile(processingPath, 'utf-8');
      const status: AgentStatus = JSON.parse(statusData);

      const match = filename.match(/^(.+?)-(\d+)(?:-\d+)?\.json$/);
      if (!match || !match[1]) {
        logger.warn(`Could not extract agent name from ${filename}, deleting.`);
        return;
      }
      const agentName = match[1];

      const callbacks = this.callbacks.get(agentName);
      if (callbacks && callbacks.length > 0) {
        await Promise.all(
          callbacks.map(async (callback) => {
            try {
              await callback(status);
            } catch (error) {
              logger.warn('Agent completion callback failed', {
                agent: agentName,
                error: (error as Error).message
              });
            }
          })
        );
        this.callbacks.delete(agentName);
        logger.debug('Processed agent status file', {
          agent: agentName,
          status: status.status
        });
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.warn(`Corrupt status file found, deleting: ${filename}`, {
          error: error.message
        });
      } else {
        logger.error(`Error processing status file: ${filename}`, {
          error: (error as Error).message
        });
      }
    } finally {
      try {
        await unlink(processingPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(`Failed to clean up processing file: ${processingPath}`, {
            error: (error as Error).message
          });
        }
      }
    }
  }

  /**
   * Check for existing status files (race condition handling)
   *
   * Handles case where agent completes before watcher starts.
   */
  private async checkExistingStatusFiles(agentName: string): Promise<void> {
    try {
      const files = await readdir(this.statusDir);

      for (const file of files) {
        if (file.startsWith(`${agentName}-`) && file.endsWith('.json')) {
          await this.processStatusFile(file);
          // Since processStatusFile is now atomic, we can continue checking
          // in case multiple files for the same agent exist for some reason.
        }
      }
    } catch (error) {
      // Directory might not exist yet - that's ok
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.debug('Could not check existing status files', {
          agent: agentName,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Stop watching and cleanup
   *
   * Closes file watcher and clears all callbacks.
   */
  async stop(): Promise<void> {
    // Close fs watcher
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }

    // Clear callbacks
    this.callbacks.clear();

    logger.debug('Stopped background agent monitor');
  }

  /**
   * Display notification in console
   *
   * Convenient helper to display completion notification.
   *
   * @param status - Agent status
   */
  static displayNotification(status: AgentStatus): void {
    const icon = status.status === 'completed' ? '✅' : '❌';
    const color = status.status === 'completed' ? chalk.green : chalk.red;

    console.log(
      color.bold(`\n${icon} Background agent '${status.agent}' ${status.status}`)
    );

    if (status.duration) {
      const durationSec = (status.duration / 1000).toFixed(1);
      console.log(chalk.gray(`   Duration: ${durationSec}s`));
    }

    if (status.error) {
      console.log(chalk.red(`   Error: ${status.error}`));
    }

    console.log(); // Empty line
  }
}
