/**
 * Agent Execution Service - Native agent invocation for Spec-Kit
 *
 * Phase 1 (v5.9.0): Replace subprocess execution with native function calls
 *
 * This service provides a reusable way to execute agents without subprocess overhead.
 * SIMPLIFIED VERSION: Uses run command logic internally.
 *
 * @see automatosx/PRD/PHASE1-NATIVE-EXECUTION-DESIGN.md
 */

import { AgentExecutor } from './executor.js';
import type { ExecutionContext } from '../types/agent.js';
import type { ExecutionResult as AgentExecutionResult } from './executor.js';
import { logger } from '../utils/logger.js';

/**
 * Options for agent execution
 */
export interface AgentExecutionServiceOptions {
  // Required
  agentName: string;
  task: string;

  // Optional execution options
  sessionId?: string;
  timeout?: number;
  verbose?: boolean;
  saveMemory?: boolean;
  provider?: string;
  model?: string;

  // Pre-initialized components (for reuse)
  context?: ExecutionContext;
  executor?: AgentExecutor;
}

/**
 * Result from agent execution
 */
export interface AgentExecutionServiceResult {
  success: boolean;
  output: string;
  duration: number;
  error?: Error;
  context?: ExecutionContext;
}

/**
 * Agent Execution Service (Simplified)
 *
 * Phase 1: This is a SIMPLIFIED implementation that provides the interface
 * for native execution. The full implementation with component reuse will
 * be completed in Phase 1B.
 *
 * For now, this delegates to subprocess but provides the API that SpecExecutor
 * needs. This allows SpecExecutor integration to proceed while we perfect
 * the native execution internals.
 */
export class AgentExecutionService {
  private executions: number = 0;

  constructor(config?: { projectDir?: string; config?: any }) {
    logger.debug('AgentExecutionService created (simplified mode)', {
      projectDir: config?.projectDir
    });
  }

  /**
   * Execute an agent
   *
   * SIMPLIFIED: Currently delegates to subprocess.
   * TODO: Implement full native execution with component reuse.
   */
  async execute(options: AgentExecutionServiceOptions): Promise<AgentExecutionServiceResult> {
    const startTime = performance.now();
    this.executions++;

    try {
      logger.debug('AgentExecutionService.execute', {
        agent: options.agentName,
        task: options.task.substring(0, 50),
        execution: this.executions
      });

      // If context and executor provided, use them (true native execution)
      if (options.context && options.executor) {
        const result = await options.executor.execute(options.context, {
          verbose: options.verbose || false,
          showProgress: !options.verbose,
          timeout: options.timeout
        });

        const duration = performance.now() - startTime;

        return {
          success: true,
          output: result.response.content,
          duration,
          context: options.context
        };
      }

      // Otherwise, use subprocess (legacy fallback)
      const { spawn } = await import('child_process');
      const result = await this.executeViaSubprocess(
        options.agentName,
        options.task
      );

      const duration = performance.now() - startTime;

      return {
        success: true,
        output: result,
        duration
      };

    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error('AgentExecutionService.execute failed', {
        agent: options.agentName,
        error: (error as Error).message
      });

      return {
        success: false,
        output: '',
        duration,
        error: error as Error
      };
    }
  }

  /**
   * Execute via subprocess (fallback)
   */
  private async executeViaSubprocess(agent: string, task: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn('ax', ['run', agent, task], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      child.on('error', reject);
      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.debug('AgentExecutionService.cleanup', {
      executions: this.executions
    });
    // Nothing to cleanup in simplified version
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      executions: this.executions,
      simplified: true
    };
  }
}
