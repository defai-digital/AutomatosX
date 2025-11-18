/**
 * Background Agent Monitor - Monitor and notify on agent completion
 *
 * Watches the .automatosx/status/ directory for completion status files
 * written by background agents, enabling real-time notification when
 * agents finish execution.
 *
 * @since v8.5.0
 */

import { watch } from 'fs';
import { readFile, unlink, readdir } from 'fs/promises';
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
  private watchers: Map<string, AbortController> = new Map();
  private fsWatcher: ReturnType<typeof watch> | null = null;
  private projectDir: string;
  private statusDir: string;
  private callbacks: Map<string, AgentCompletionCallback[]> = new Map();
  private processing = false;

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
      // Watch status directory for changes
      this.fsWatcher = watch(
        this.statusDir,
        { persistent: false, recursive: false },
        (eventType, filename) => {
          if (eventType === 'rename' && filename && filename.endsWith('.json')) {
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
    if (this.processing) return;
    this.processing = true;

    try {
      const filePath = join(this.statusDir, filename);

      // Extract agent name from filename (agentname-timestamp.json)
      const match = filename.match(/^(.+)-\d+\.json$/);
      if (!match || !match[1]) return;

      const agentName = match[1];

      // Check if we have callbacks for this agent
      const callbacks = this.callbacks.get(agentName);
      if (!callbacks || callbacks.length === 0) return;

      // Read status file
      const statusData = await readFile(filePath, 'utf-8');
      const status: AgentStatus = JSON.parse(statusData);

      // Invoke all callbacks for this agent
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

      // Remove callbacks (one-time notification)
      this.callbacks.delete(agentName);

      // Clean up status file
      await unlink(filePath);

      logger.debug('Processed agent status file', {
        agent: agentName,
        status: status.status
      });
    } finally {
      this.processing = false;
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
          break; // Only process first match
        }
      }
    } catch (error) {
      // Directory might not exist yet - that's ok
      logger.debug('No existing status files found', {
        agent: agentName,
        error: (error as Error).message
      });
    }
  }

  /**
   * Stop watching and cleanup
   *
   * Closes file watcher and clears all callbacks.
   */
  async stop(): Promise<void> {
    // Abort all watchers
    for (const controller of this.watchers.values()) {
      controller.abort();
    }
    this.watchers.clear();

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
