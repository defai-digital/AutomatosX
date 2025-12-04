/**
 * SubagentAdapter - Orchestrates multiple subagents via ax-cli SDK (v10.4.0)
 *
 * Leverages ax-cli's SubagentOrchestrator for efficient multi-agent execution
 * with shared context and parallel processing.
 *
 * Benefits over separate LLMAgent instances:
 * - Shared context between subagents
 * - Parallel execution built-in
 * - Reduced memory footprint
 * - Automatic coordination
 *
 * Updated for SDK v1.3.0:
 * - Typed event interfaces (SubagentEvents)
 * - Progress reporting integration
 * - Enhanced state management
 *
 * @module integrations/ax-cli-sdk/subagent-adapter
 */

import { logger } from '../../shared/logging/logger.js';
import type {
  SubagentEvents,
  SubagentProgressData,
  SubagentStateChangeData,
  SubagentStateType,
  ProgressCallback,
  ProgressEvent
} from './sdk-types.js';

/**
 * Subagent role types supported by ax-cli SDK
 */
export type SubagentRole =
  | 'developer'
  | 'reviewer'
  | 'tester'
  | 'architect'
  | 'auditor'
  | 'documenter'
  | 'analyst'
  | 'custom';

/**
 * Subagent configuration
 */
export interface SubagentConfig {
  /** Role of the subagent */
  role: SubagentRole;

  /** Specialization (e.g., 'backend', 'security', 'frontend') */
  specialization?: string;

  /** Custom instructions for the subagent */
  instructions?: string;

  /** Maximum tool rounds for this subagent */
  maxToolRounds?: number;
}

/**
 * Task to execute with a subagent
 */
export interface SubagentTask {
  /** Task description */
  task: string;

  /** Subagent configuration */
  config: SubagentConfig;

  /** Optional context from other tasks */
  context?: string;

  /** Priority (lower = higher priority) */
  priority?: number;
}

/**
 * Result from subagent execution
 */
export interface SubagentResult {
  /** Task that was executed */
  task: string;

  /** Subagent role */
  role: SubagentRole;

  /** Execution result content */
  content: string;

  /** Execution success status */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Execution time in ms */
  latencyMs: number;

  /** Token usage */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Orchestrator options
 */
export interface OrchestratorOptions {
  /** Maximum parallel subagents */
  maxParallel?: number;

  /** Timeout per subagent in ms */
  timeout?: number;

  /** Enable shared context between subagents */
  sharedContext?: boolean;

  /** Continue on individual task failure */
  continueOnError?: boolean;

  /** Event handlers (SDK v1.3.0) */
  events?: SubagentEvents;

  /** Progress callback (SDK v1.3.0) */
  onProgress?: ProgressCallback;
}

/**
 * SubagentAdapter - Orchestrates multiple specialized subagents
 *
 * Uses ax-cli SDK's SubagentOrchestrator for efficient multi-agent workflows.
 *
 * Features:
 * - Parallel execution with configurable concurrency
 * - Shared context propagation
 * - Automatic role-based specialization
 * - Fault-tolerant execution (continue on error)
 *
 * @example
 * ```typescript
 * const adapter = new SubagentAdapter();
 *
 * const results = await adapter.executeParallel([
 *   { task: 'Implement auth API', config: { role: 'developer', specialization: 'backend' } },
 *   { task: 'Write unit tests', config: { role: 'tester' } },
 *   { task: 'Audit security', config: { role: 'auditor', specialization: 'security' } }
 * ]);
 * ```
 */
export class SubagentAdapter {
  private orchestrator: any = null;
  private subagents: Map<string, any> = new Map();
  private sdkAvailable: boolean | null = null;
  private readonly options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxParallel: options.maxParallel ?? 4,
      timeout: options.timeout ?? 300000, // 5 minutes
      sharedContext: options.sharedContext ?? true,
      continueOnError: options.continueOnError ?? true,
      events: options.events,
      onProgress: options.onProgress
    };

    logger.debug('SubagentAdapter initialized', { options: this.options });
  }

  /**
   * Emit a subagent event if handler is registered
   */
  private emitEvent<K extends keyof SubagentEvents>(
    event: K,
    ...args: Parameters<NonNullable<SubagentEvents[K]>>
  ): void {
    const handler = this.options.events?.[event];
    if (handler) {
      try {
        (handler as (...args: unknown[]) => void)(...args);
      } catch (error) {
        logger.warn('Event handler error', {
          event,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Report progress if callback is registered
   */
  private reportProgress(event: ProgressEvent): void {
    if (this.options.onProgress) {
      try {
        this.options.onProgress(event);
      } catch (error) {
        logger.warn('Progress callback error', {
          taskId: event.taskId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Execute multiple tasks in parallel using subagents
   *
   * @param tasks - Array of tasks with subagent configs
   * @returns Array of results (order matches input tasks)
   */
  async executeParallel(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const startTime = Date.now();

    if (!(await this.ensureSDKAvailable())) {
      throw new Error('ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli');
    }

    await this.ensureOrchestrator();

    logger.info('Executing parallel subagent tasks', {
      taskCount: tasks.length,
      maxParallel: this.options.maxParallel
    });

    // Sort by priority if provided
    const sortedTasks = [...tasks].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    // Execute in batches based on maxParallel
    const results: SubagentResult[] = [];
    const batchSize = this.options.maxParallel!;

    for (let i = 0; i < sortedTasks.length; i += batchSize) {
      const batch = sortedTasks.slice(i, i + batchSize);
      const batchResults = await this.executeBatch(batch);
      results.push(...batchResults);

      // Propagate context if enabled
      if (this.options.sharedContext && i + batchSize < sortedTasks.length) {
        await this.propagateContext(batchResults);
      }
    }

    logger.info('Parallel execution complete', {
      taskCount: tasks.length,
      successCount: results.filter(r => r.success).length,
      totalLatencyMs: Date.now() - startTime
    });

    return results;
  }

  /**
   * Execute tasks sequentially with context propagation
   *
   * @param tasks - Array of tasks with subagent configs
   * @returns Array of results (order matches input tasks)
   */
  async executeSequential(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const startTime = Date.now();

    if (!(await this.ensureSDKAvailable())) {
      throw new Error('ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli');
    }

    await this.ensureOrchestrator();

    logger.info('Executing sequential subagent tasks', { taskCount: tasks.length });

    const results: SubagentResult[] = [];
    let accumulatedContext = '';

    for (const task of tasks) {
      // Add accumulated context to task
      const taskWithContext = {
        ...task,
        context: task.context
          ? `${task.context}\n\nPrevious results:\n${accumulatedContext}`
          : accumulatedContext || undefined
      };

      const result = await this.executeTask(taskWithContext);
      results.push(result);

      // Accumulate context for next task
      if (result.success && this.options.sharedContext) {
        accumulatedContext += `\n[${result.role}]: ${result.content.substring(0, 500)}...\n`;
      }

      // Stop on error if not continuing
      if (!result.success && !this.options.continueOnError) {
        logger.warn('Sequential execution stopped due to error', {
          failedTask: task.task,
          error: result.error
        });
        break;
      }
    }

    logger.info('Sequential execution complete', {
      taskCount: tasks.length,
      completedCount: results.length,
      successCount: results.filter(r => r.success).length,
      totalLatencyMs: Date.now() - startTime
    });

    return results;
  }

  /**
   * Execute a single task with a subagent
   */
  private async executeTask(task: SubagentTask): Promise<SubagentResult> {
    const startTime = Date.now();
    const subagentKey = this.getSubagentKey(task.config);
    const taskId = `${subagentKey}:${Date.now()}`;

    // Emit task start event
    this.emitEvent('task_start', task.task);
    this.emitEvent('state_change', {
      previousState: 'idle',
      currentState: 'running',
      subagentId: subagentKey
    });

    // Report progress: start
    this.reportProgress({
      type: 'start',
      taskId,
      message: `Starting ${task.config.role} task`
    });

    try {
      // Get or create subagent
      const subagent = await this.getOrCreateSubagent(task.config);

      // Build prompt with context
      const prompt = task.context
        ? `Context:\n${task.context}\n\nTask:\n${task.task}`
        : task.task;

      logger.debug('Executing subagent task', {
        role: task.config.role,
        specialization: task.config.specialization,
        taskPreview: task.task.substring(0, 100)
      });

      // Report progress: 25%
      this.reportProgress({
        type: 'progress',
        taskId,
        progress: 25,
        message: 'Subagent initialized, executing...'
      });

      // Execute via SDK
      let content = '';
      let totalTokens = 0;

      for await (const chunk of subagent.processUserMessageStream(prompt)) {
        if (chunk.type === 'content') {
          content += chunk.content || '';
        }
        if (chunk.type === 'token_count' && chunk.tokenCount) {
          totalTokens += chunk.tokenCount;
        }
      }

      const latencyMs = Date.now() - startTime;

      // Emit task complete event
      this.emitEvent('task_complete', task.task, content);
      this.emitEvent('state_change', {
        previousState: 'running',
        currentState: 'completed',
        subagentId: subagentKey
      });
      this.emitEvent('progress', {
        subagentId: subagentKey,
        progress: 100,
        message: 'Task completed'
      });

      // Report progress: complete
      this.reportProgress({
        type: 'complete',
        taskId,
        message: `${task.config.role} task completed`,
        metadata: { latencyMs, tokensUsed: totalTokens }
      });

      logger.debug('Subagent task completed', {
        role: task.config.role,
        contentLength: content.length,
        latencyMs
      });

      return {
        task: task.task,
        role: task.config.role,
        content,
        success: true,
        latencyMs,
        tokensUsed: totalTokens > 0 ? {
          prompt: Math.floor(totalTokens * 0.3), // Estimated split
          completion: Math.floor(totalTokens * 0.7),
          total: totalTokens
        } : undefined
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const err = error instanceof Error ? error : new Error(errorMessage);

      // Emit error event
      this.emitEvent('error', err);
      this.emitEvent('state_change', {
        previousState: 'running',
        currentState: 'failed',
        subagentId: subagentKey
      });

      // Report progress: error
      this.reportProgress({
        type: 'error',
        taskId,
        error: err,
        message: `${task.config.role} task failed: ${errorMessage}`
      });

      logger.error('Subagent task failed', {
        role: task.config.role,
        error: errorMessage,
        latencyMs
      });

      return {
        task: task.task,
        role: task.config.role,
        content: '',
        success: false,
        error: errorMessage,
        latencyMs
      };
    }
  }

  /**
   * Execute a batch of tasks in parallel
   */
  private async executeBatch(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const promises = tasks.map(task =>
      this.executeTask(task).catch(error => ({
        task: task.task,
        role: task.config.role,
        content: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: 0
      } as SubagentResult))
    );

    return Promise.all(promises);
  }

  /**
   * Propagate context from completed tasks
   */
  private async propagateContext(results: SubagentResult[]): Promise<void> {
    // Build context summary from successful results
    const contextSummary = results
      .filter(r => r.success)
      .map(r => `[${r.role}]: ${r.content.substring(0, 200)}...`)
      .join('\n');

    if (contextSummary && this.orchestrator?.setSharedContext) {
      try {
        await this.orchestrator.setSharedContext(contextSummary);
        logger.debug('Context propagated to orchestrator', {
          contextLength: contextSummary.length
        });
      } catch (error) {
        logger.warn('Failed to propagate context', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Get or create a subagent for the given config
   */
  private async getOrCreateSubagent(config: SubagentConfig): Promise<any> {
    const key = this.getSubagentKey(config);

    if (this.subagents.has(key)) {
      return this.subagents.get(key);
    }

    try {
      const { createSubagent } = await import('@defai.digital/ax-cli/sdk');

      // Cast role and config to SDK's expected types - SDK may have different property names
      const subagent = createSubagent(config.role as any, {
        systemPrompt: config.instructions,
        maxToolRounds: config.maxToolRounds ?? 100
      } as any);

      this.subagents.set(key, subagent);

      logger.debug('Created new subagent', {
        role: config.role,
        specialization: config.specialization,
        key
      });

      return subagent;
    } catch (error) {
      logger.error('Failed to create subagent', {
        role: config.role,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate unique key for subagent config
   */
  private getSubagentKey(config: SubagentConfig): string {
    return `${config.role}:${config.specialization || 'default'}`;
  }

  /**
   * Ensure orchestrator is initialized
   */
  private async ensureOrchestrator(): Promise<void> {
    if (this.orchestrator) return;

    try {
      const sdk = await import('@defai.digital/ax-cli/sdk');

      // Try to use SubagentOrchestrator if available
      if (sdk.SubagentOrchestrator) {
        // Pass config as any to handle SDK type differences
        this.orchestrator = new sdk.SubagentOrchestrator({
          concurrency: this.options.maxParallel,
          timeoutMs: this.options.timeout
        } as any);
        logger.debug('SubagentOrchestrator initialized');
      } else {
        // Fallback: use basic coordination
        this.orchestrator = { initialized: true };
        logger.debug('Using basic subagent coordination (SubagentOrchestrator not available)');
      }
    } catch (error) {
      logger.warn('Failed to initialize orchestrator, using basic coordination', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.orchestrator = { initialized: true };
    }
  }

  /**
   * Check if SDK is available
   */
  private async ensureSDKAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = true;
      return true;
    } catch {
      this.sdkAvailable = false;
      return false;
    }
  }

  /**
   * Check if adapter is available
   */
  async isAvailable(): Promise<boolean> {
    return this.ensureSDKAvailable();
  }

  /**
   * Get active subagent count
   */
  getSubagentCount(): number {
    return this.subagents.size;
  }

  /**
   * Cleanup all subagents
   */
  async destroy(): Promise<void> {
    for (const [key, subagent] of this.subagents) {
      try {
        if (subagent.dispose) {
          subagent.dispose();
        }
        logger.debug('Subagent disposed', { key });
      } catch (error) {
        logger.warn('Error disposing subagent', {
          key,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.subagents.clear();
    this.orchestrator = null;

    logger.debug('SubagentAdapter destroyed');
  }
}

/**
 * Map AutomatosX agent names to ax-cli subagent roles
 */
export function mapAgentToSubagentRole(agentName: string): SubagentRole {
  const roleMap: Record<string, SubagentRole> = {
    // Development roles
    'backend': 'developer',
    'frontend': 'developer',
    'fullstack': 'developer',
    'mobile': 'developer',

    // Review/audit roles
    'security': 'auditor',
    'quality': 'tester',

    // Architecture roles
    'architecture': 'architect',
    'cto': 'architect',

    // Analysis roles
    'researcher': 'analyst',
    'data-scientist': 'analyst',
    'data': 'analyst',

    // Documentation roles
    'writer': 'documenter',
    'product': 'documenter',

    // Default
    'devops': 'developer',
    'design': 'custom',
    'ceo': 'custom',
    'creative-marketer': 'custom',
    'standard': 'reviewer'
  };

  return roleMap[agentName.toLowerCase()] || 'custom';
}
