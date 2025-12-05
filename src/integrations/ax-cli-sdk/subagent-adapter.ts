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

import { createHash } from 'crypto';
import { logger } from '../../shared/logging/logger.js';
import type {
  SubagentEvents,
  SubagentProgressData,
  SubagentStateChangeData,
  SubagentStateType,
  ProgressCallback,
  ProgressEvent,
  SDKSubagent,
  SDKStreamChunk
} from './sdk-types.js';

/** Estimated token split ratios when actual split is unknown */
const TOKEN_SPLIT = { PROMPT: 0.3, COMPLETION: 0.7 } as const;

/** Default maximum parallel subagent executions */
const DEFAULT_MAX_PARALLEL = 4;

/** Default timeout per subagent execution in milliseconds (5 minutes) */
const DEFAULT_TIMEOUT_MS = 300000;

/** Default maximum tool rounds for subagents */
const DEFAULT_SUBAGENT_MAX_TOOL_ROUNDS = 100;

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
/**
 * SDK Orchestrator interface - minimal typed interface
 * Note: Uses loose typing to accommodate SDK variations
 */
interface SDKOrchestrator {
  setSharedContext?(context: string): Promise<void>;
  dispose?(): Promise<void>;
  shutdown?(): Promise<void>;
  // Allow additional SDK-specific properties
  [key: string]: unknown;
}

export class SubagentAdapter {
  // PRODUCTION FIX: Use typed interfaces instead of 'any'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private orchestrator: SDKOrchestrator | { initialized: boolean } | any = null;
  private subagents: Map<string, SDKSubagent> = new Map();
  private busySubagents: Set<string> = new Set();
  private sdkAvailable: boolean | null = null;
  private readonly options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxParallel: options.maxParallel ?? DEFAULT_MAX_PARALLEL,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
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

    // Sort by priority if provided, but preserve original order in results
    const tasksWithIndex = tasks.map((task, index) => ({ task, index }));
    const sortedTasks = [...tasksWithIndex].sort(
      (a, b) => (a.task.priority ?? 0) - (b.task.priority ?? 0)
    );

    // Execute in batches based on maxParallel
    const results: Array<SubagentResult | undefined> = new Array(tasks.length);
    const batchSize = this.options.maxParallel!;

    for (let i = 0; i < sortedTasks.length; i += batchSize) {
      const batch = sortedTasks.slice(i, i + batchSize);
      const batchResults = await this.executeBatch(batch.map(item => item.task));

      // Place batch results back into the original order
      batch.forEach((item, idx) => {
        results[item.index] = batchResults[idx];
      });

      // Propagate context if enabled
      if (this.options.sharedContext && i + batchSize < sortedTasks.length) {
        await this.propagateContext(batchResults);
      }
    }

    const finalResults: SubagentResult[] = results.map((result, index) => {
      if (result) {
        return result;
      }

      // Fallback placeholder to maintain positional consistency
      return {
        task: tasks[index]?.task ?? 'unknown',
        role: tasks[index]?.config.role ?? 'custom',
        content: '',
        success: false,
        error: 'Subagent result missing',
        latencyMs: 0
      };
    });

    logger.info('Parallel execution complete', {
      taskCount: tasks.length,
      successCount: finalResults.filter(r => r.success).length,
      totalLatencyMs: Date.now() - startTime
    });

    return finalResults;
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
      // BUG FIX: Only add "Previous results:" section if there actually are previous results
      // to avoid misleading empty section on first task
      let combinedContext: string | undefined;
      if (task.context && accumulatedContext) {
        combinedContext = `${task.context}\n\nPrevious results:\n${accumulatedContext}`;
      } else if (task.context) {
        combinedContext = task.context;
      } else if (accumulatedContext) {
        combinedContext = accumulatedContext;
      }

      const taskWithContext = {
        ...task,
        context: combinedContext
      };

      const result = await this.executeTask(taskWithContext);
      results.push(result);

      // Accumulate context for next task
      if (result.success && this.options.sharedContext) {
        // BUG FIX: Only add "..." suffix if content was actually truncated
        const truncated = result.content.length > 500;
        accumulatedContext += `\n[${result.role}]: ${result.content.substring(0, 500)}${truncated ? '...' : ''}\n`;
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
    // BUG FIX (v11.3.4): Type should be Promise<void> to match acquireSubagent signature
    let release: (() => Promise<void>) | null = null;

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
      const acquired = await this.acquireSubagent(task.config);
      const subagent = acquired.subagent;
      release = acquired.release;

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

      // Execute via SDK with timeout enforcement
      // BUG FIX (v11.3.4): Apply configured timeout to stream processing
      // Previously the timeout option was defined but never used, causing
      // tasks to hang indefinitely if the stream never completed.
      // PRODUCTION FIX (v11.3.4): Use proper timer variable pattern instead of
      // storing on Promise prototype to prevent GC-related leaks.
      let content = '';
      let totalTokens = 0;
      const timeoutMs = this.options.timeout!;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        // Create timeout promise with external timer reference for proper cleanup
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => {
            reject(new Error(`Subagent task timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        // Process stream with timeout - wrap in a promise we can race
        const streamPromise = (async () => {
          for await (const chunk of subagent.processUserMessageStream(prompt)) {
            if (chunk.type === 'content') {
              content += chunk.content || '';
            }
            if (chunk.type === 'token_count' && chunk.tokenCount) {
              totalTokens += chunk.tokenCount;
            }
          }
        })();

        // Race between stream completion and timeout
        await Promise.race([streamPromise, timeoutPromise]);
      } finally {
        // Always clear timeout to prevent memory leak
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
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
          prompt: Math.floor(totalTokens * TOKEN_SPLIT.PROMPT),
          completion: Math.floor(totalTokens * TOKEN_SPLIT.COMPLETION),
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
    } finally {
      // PRODUCTION FIX: Await async release to ensure proper cleanup
      if (release) {
        await release();
      }
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
    // BUG FIX: Only add "..." suffix if content was actually truncated
    const contextSummary = results
      .filter(r => r.success)
      .map(r => {
        const truncated = r.content.length > 200;
        const summary = r.content.substring(0, 200);
        return `[${r.role}]: ${summary}${truncated ? '...' : ''}`;
      })
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
   *
   * PRODUCTION FIX: Return typed SDKSubagent instead of 'any'
   * Note: We still need 'as unknown as SDKSubagent' cast since SDK types may differ,
   * but this is safer than raw 'any' as it enforces interface compliance.
   */
  private async getOrCreateSubagent(config: SubagentConfig): Promise<SDKSubagent> {
    const key = this.getSubagentKey(config);

    const cached = this.subagents.get(key);
    if (cached) {
      return cached;
    }

    try {
      const { createSubagent } = await import('@defai.digital/ax-cli/sdk');

      // Cast through unknown to SDKSubagent - safer than raw 'any'
      // SDK may have additional properties but must satisfy SDKSubagent interface
      // Note: Role type may differ between our definition and SDK's - use any for SDK compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subagent = createSubagent(config.role as any, {
        systemPrompt: config.instructions,
        maxToolRounds: config.maxToolRounds ?? DEFAULT_SUBAGENT_MAX_TOOL_ROUNDS
      } as Record<string, unknown>) as unknown as SDKSubagent;

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
   * Create a temporary subagent instance. Used when the cached subagent is busy.
   *
   * PRODUCTION FIX: Return typed SDKSubagent instead of 'any'
   */
  private async createEphemeralSubagent(config: SubagentConfig): Promise<SDKSubagent> {
    const { createSubagent } = await import('@defai.digital/ax-cli/sdk');

    // Cast through unknown to SDKSubagent - safer than raw 'any'
    // Note: Role type may differ between our definition and SDK's - use any for SDK compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createSubagent(config.role as any, {
      systemPrompt: config.instructions,
      maxToolRounds: config.maxToolRounds ?? DEFAULT_SUBAGENT_MAX_TOOL_ROUNDS
    } as Record<string, unknown>) as unknown as SDKSubagent;
  }

  /**
   * Acquire a subagent instance for a task. If a cached instance is already
   * running another task, create a short-lived one to avoid interleaved
   * streams from concurrent executions.
   *
   * PRODUCTION FIX (v11.3.4): Changed release() to return Promise for proper
   * async cleanup of ephemeral subagents. Callers must await release().
   */
  private async acquireSubagent(config: SubagentConfig): Promise<{ subagent: SDKSubagent; release: () => Promise<void> }> {
    const key = this.getSubagentKey(config);

    if (!this.busySubagents.has(key)) {
      this.busySubagents.add(key);
      // BUG FIX: If getOrCreateSubagent throws, we need to release the key
      // to prevent permanently marking this subagent as busy
      let subagent: SDKSubagent;
      try {
        subagent = await this.getOrCreateSubagent(config);
      } catch (error) {
        // Release the key on error so future calls don't always create ephemeral instances
        this.busySubagents.delete(key);
        throw error;
      }
      return {
        subagent,
        release: async () => this.releaseSubagent(key)
      };
    }

    logger.debug('Cached subagent busy, creating ephemeral instance', { key });
    const ephemeral = await this.createEphemeralSubagent(config);
    return {
      subagent: ephemeral,
      // PRODUCTION FIX: Properly await async dispose to ensure cleanup completes
      // before next task starts, preventing resource accumulation
      release: async () => {
        try {
          if (ephemeral.dispose) {
            const result = ephemeral.dispose();
            if (result instanceof Promise) {
              await result;
            }
          }
          logger.debug('Ephemeral subagent disposed successfully', { key });
        } catch (error) {
          logger.warn('Error disposing ephemeral subagent', {
            key,
            error: error instanceof Error ? error.message : String(error)
          });
          // Don't rethrow - cleanup errors shouldn't fail the task
        }
      }
    };
  }

  /**
   * Release a cached subagent so it can be reused.
   */
  private releaseSubagent(key: string): void {
    this.busySubagents.delete(key);
  }

  /**
   * Generate unique key for subagent config
   */
  private getSubagentKey(config: SubagentConfig): string {
    const instructionsHash = config.instructions
      ? createHash('sha256').update(config.instructions).digest('hex').slice(0, 12)
      : 'noinstr';
    const maxToolRounds = config.maxToolRounds ?? DEFAULT_SUBAGENT_MAX_TOOL_ROUNDS;

    return `${config.role}:${config.specialization || 'default'}:${maxToolRounds}:${instructionsHash}`;
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
   * BUG FIX: Continue cleanup even if individual subagent disposal fails,
   * and report all errors at the end to ensure no resources are leaked.
   */
  async destroy(): Promise<void> {
    const errors: Array<{ key: string; error: string }> = [];

    for (const [key, subagent] of this.subagents) {
      try {
        if (subagent.dispose) {
          // Await dispose in case it's async to ensure proper cleanup
          const result = subagent.dispose();
          if (result instanceof Promise) {
            await result;
          }
        }
        logger.debug('Subagent disposed', { key });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn('Error disposing subagent', {
          key,
          error: errorMsg
        });
        // BUG FIX: Collect errors but continue cleanup to ensure all subagents are attempted
        errors.push({ key, error: errorMsg });
      }
    }

    const orchestrator = this.orchestrator;
    this.subagents.clear();
    this.busySubagents.clear();

    if (orchestrator && typeof orchestrator.dispose === 'function') {
      try {
        await orchestrator.dispose();
      } catch (error) {
        logger.warn('Error disposing subagent orchestrator', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else if (orchestrator && typeof orchestrator.shutdown === 'function') {
      try {
        await orchestrator.shutdown();
      } catch (error) {
        logger.warn('Error shutting down subagent orchestrator', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    this.orchestrator = null;

    // Log summary of cleanup errors if any occurred
    if (errors.length > 0) {
      logger.error('SubagentAdapter cleanup had errors', {
        errorCount: errors.length,
        errors
      });
    }

    logger.debug('SubagentAdapter destroyed');
  }
}

/**
 * Map AutomatosX agent names to ax-cli subagent roles
 *
 * BUG FIX: Added missing mappings for 'debug' and 'performance' agents
 * that were added to AutomatosX but not mapped to SDK roles.
 * Also added 'debugging' and 'refactoring' which are SDK-specific roles
 * referenced in CLAUDE.md documentation.
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

    // BUG FIX: Added missing agent mappings
    // Debug and performance agents map to SDK-specific roles
    'debug': 'developer',      // BUG FIX: Was missing - debug tasks are development-oriented
    'performance': 'developer', // BUG FIX: Was missing - performance optimization is development work

    // DevOps and infrastructure
    'devops': 'developer',

    // Creative and leadership roles
    'design': 'custom',
    'ceo': 'custom',
    'creative-marketer': 'custom',

    // Default review role
    'standard': 'reviewer'
  };

  return roleMap[agentName.toLowerCase()] || 'custom';
}
