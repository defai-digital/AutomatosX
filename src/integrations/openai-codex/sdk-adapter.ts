/**
 * Codex SDK Adapter
 *
 * Wraps @openai/codex-sdk for typed event handling.
 * The SDK internally spawns the CLI, so latency is similar.
 *
 * @module integrations/openai-codex/sdk-adapter
 */

import { logger } from '../../shared/logging/logger.js';
import type { CodexExecutionResult } from './types.js';
import { CodexError, CodexErrorType } from './types.js';
import { Mutex } from 'async-mutex';

// SDK types (dynamically imported)
type CodexSDK = typeof import('@openai/codex-sdk');
type CodexClass = InstanceType<CodexSDK['Codex']>;
type ThreadClass = InstanceType<CodexSDK['Thread']>;

export interface CodexSdkOptions {
  streamingEnabled?: boolean;
  reuseThreads?: boolean;
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
}

export class CodexSdkAdapter {
  private codex: CodexClass | null = null;
  private activeThread: ThreadClass | null = null;
  private sdkModule: CodexSDK | null = null;
  private readonly options: CodexSdkOptions;
  private initialized = false;
  private initMutex = new Mutex(); // v11.2.8: Prevent race condition in ensureInitialized

  constructor(options: CodexSdkOptions = {}) {
    this.options = {
      streamingEnabled: true,
      reuseThreads: false,
      sandboxMode: 'workspace-write',
      ...options,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.codex !== null;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      const version = execSync('codex --version', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      return `sdk:${version}`;
    } catch {
      return 'sdk:unknown';
    }
  }

  async execute(prompt: string, timeout?: number): Promise<CodexExecutionResult> {
    const startTime = Date.now();
    const effectiveTimeout = timeout || 120000; // Default 2 minutes
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      await this.ensureInitialized();

      if (!this.codex) {
        throw new CodexError(CodexErrorType.CLI_NOT_FOUND, 'Codex SDK not initialized');
      }

      const thread = this.getOrCreateThread();

      // Use buffered mode with timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new CodexError(
            CodexErrorType.TIMEOUT,
            `SDK execution timeout after ${effectiveTimeout}ms`
          ));
        }, effectiveTimeout);
      });

      const result = await Promise.race([thread.run(prompt), timeoutPromise]);

      // Clear timeout on success
      if (timeoutId) clearTimeout(timeoutId);

      // Extract content from agent messages
      let content = '';
      for (const item of result.items) {
        if (item.type === 'agent_message') {
          content += item.text;
        }
      }

      // Extract token usage
      const tokenCount = result.usage
        ? (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0)
        : undefined;

      // Clear thread if not reusing
      // BUG FIX: Properly dispose thread resources before setting to null
      // to prevent memory leaks from unclosed thread objects. The Codex SDK
      // thread may hold references to internal state that needs cleanup.
      if (!this.options.reuseThreads && this.activeThread) {
        try {
          // Try to dispose if method exists (SDK may add it in future versions)
          // Use type assertion to check for dispose method at runtime
          const threadWithDispose = this.activeThread as unknown as { dispose?: () => void | Promise<void> };
          if (typeof threadWithDispose.dispose === 'function') {
            const disposeResult = threadWithDispose.dispose();
            if (disposeResult instanceof Promise) {
              await disposeResult;
            }
          }
        } catch (disposeError) {
          logger.warn('Error disposing thread', {
            error: disposeError instanceof Error ? disposeError.message : String(disposeError)
          });
        }
        this.activeThread = null;
      }

      return {
        content,
        duration: Date.now() - startTime,
        exitCode: 0,
        tokenCount,
      };
    } catch (error) {
      // Clear timeout if SDK threw an error before timeout fired
      if (timeoutId) clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      logger.error('CodexSdkAdapter.execute failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      if (error instanceof CodexError) {
        throw error;
      }

      throw new CodexError(
        CodexErrorType.EXECUTION_FAILED,
        `SDK execution failed: ${error instanceof Error ? error.message : String(error)}`,
        { duration }
      );
    }
  }

  private getOrCreateThread(): ThreadClass {
    if (this.options.reuseThreads && this.activeThread) {
      return this.activeThread;
    }

    if (!this.codex) {
      throw new CodexError(CodexErrorType.CLI_NOT_FOUND, 'Codex not initialized');
    }

    this.activeThread = this.codex.startThread({
      sandboxMode: this.options.sandboxMode,
    });

    return this.activeThread;
  }

  private async ensureInitialized(): Promise<void> {
    // v11.2.8: Use mutex to prevent race condition when multiple calls occur concurrently
    return this.initMutex.runExclusive(async () => {
      if (this.initialized) return;

      try {
        this.sdkModule = await import('@openai/codex-sdk');
        this.codex = new this.sdkModule.Codex();
        this.initialized = true;
        logger.info('Codex SDK initialized');
      } catch (_error) {
        throw new CodexError(
          CodexErrorType.CLI_NOT_FOUND,
          'Codex SDK not available. Install with: npm install @openai/codex-sdk'
        );
      }
    });
  }

  async destroy(): Promise<void> {
    this.activeThread = null;
    this.codex = null;
    this.sdkModule = null;
    this.initialized = false;
  }
}
