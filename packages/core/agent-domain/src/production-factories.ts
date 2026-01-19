/**
 * Production Factory Implementations
 *
 * Provides real implementations of checkpoint, delegation, and parallel execution
 * factories for production use. These wire together the various domain packages.
 *
 * Usage:
 * ```typescript
 * import { createProductionFactories } from '@defai.digital/agent-domain';
 *
 * const factories = createProductionFactories({
 *   checkpointStorage: sqliteCheckpointStorage,
 *   // ... other config
 * });
 *
 * const executor = createEnhancedAgentExecutor(registry, {
 *   ...factories,
 *   // ... other config
 * });
 * ```
 */

import type { CheckpointConfig, ParallelExecutionConfig } from '@defai.digital/contracts';
import { createDefaultParallelExecutionConfig, getErrorMessage } from '@defai.digital/contracts';
import type {
  CheckpointStoragePort,
  CheckpointManagerPort,
  CheckpointStorageFactory,
  CheckpointManagerFactory,
  DelegationTrackerFactory,
  DelegationTrackerPort,
  ParallelExecutorPort,
  ParallelExecutorFactory,
  Checkpoint,
} from './types.js';
import type {
  DelegationContext,
  DelegationCheckResult,
  DelegationResult,
  DelegationRequest,
} from '@defai.digital/contracts';

// ============================================================================
// Production Checkpoint Manager
// ============================================================================

/**
 * Production checkpoint manager implementation
 *
 * INV-CP-001: Checkpoint contains all data needed to resume
 * INV-CP-002: Resumed execution starts from step after checkpoint
 */
class ProductionCheckpointManager implements CheckpointManagerPort {
  private readonly agentId: string;
  private readonly sessionId: string | undefined;
  private readonly storage: CheckpointStoragePort;
  private readonly config: CheckpointConfig;
  private checkpointCount = 0;

  constructor(
    agentId: string,
    sessionId: string | undefined,
    storage: CheckpointStoragePort,
    config: CheckpointConfig
  ) {
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.storage = storage;
    this.config = config;
  }

  getConfig(): CheckpointConfig {
    return { ...this.config };
  }

  shouldCheckpoint(stepIndex: number): boolean {
    if (!this.config.enabled) return false;
    if (this.config.intervalSteps === 0) return true;
    return stepIndex % this.config.intervalSteps === 0;
  }

  async createCheckpoint(
    stepIndex: number,
    stepId: string,
    previousOutputs: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<Checkpoint> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.retentionHours * 60 * 60 * 1000
    );

    // INV-CP-001: Checkpoint contains all data needed to resume
    const checkpoint: Checkpoint = {
      checkpointId: crypto.randomUUID(),
      agentId: this.agentId,
      sessionId: this.sessionId,
      stepIndex,
      stepId,
      previousOutputs,
      metadata,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.storage.save(checkpoint);
    this.checkpointCount++;

    // Enforce max checkpoints
    if (this.checkpointCount > this.config.maxCheckpoints) {
      const allCheckpoints = await this.storage.list(this.agentId, this.sessionId);
      // Sort by creation date (oldest first) to keep newest checkpoints
      const sorted = [...allCheckpoints].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      // Delete oldest checkpoints (those before the maxCheckpoints cutoff)
      const toDelete = sorted.slice(0, sorted.length - this.config.maxCheckpoints);
      for (const cp of toDelete) {
        await this.storage.delete(cp.checkpointId);
      }
      this.checkpointCount = this.config.maxCheckpoints;
    }

    return checkpoint;
  }

  async getLatestCheckpoint(): Promise<Checkpoint | null> {
    return this.storage.loadLatest(this.agentId, this.sessionId);
  }

  async getResumeContext(checkpointId: string): Promise<{
    startFromStep: number;
    previousOutputs: Record<string, unknown>;
  } | null> {
    const checkpoint = await this.storage.load(checkpointId);

    if (!checkpoint) {
      return null;
    }

    // Check if expired
    if (checkpoint.expiresAt) {
      const expiresAt = new Date(checkpoint.expiresAt).getTime();
      if (expiresAt < Date.now()) {
        await this.storage.delete(checkpointId);
        return null;
      }
    }

    // INV-CP-002: Resumed execution starts from step after checkpoint
    return {
      startFromStep: checkpoint.stepIndex + 1,
      previousOutputs: checkpoint.previousOutputs,
    };
  }

  async cleanup(): Promise<number> {
    return this.storage.deleteExpired();
  }
}

// ============================================================================
// Production Delegation Tracker
// ============================================================================

/**
 * Production delegation tracker implementation
 *
 * INV-DT-001: Maximum delegation depth enforced
 * INV-DT-002: Circular delegations prevented
 */
class ProductionDelegationTracker implements DelegationTrackerPort {
  private readonly agentId: string;
  private readonly context: DelegationContext;
  private readonly maxDepth: number;
  private readonly history: DelegationResult[] = [];
  private readonly rootTaskId: string;

  constructor(
    agentId: string,
    parentContext: DelegationContext | undefined,
    maxDepth: number
  ) {
    this.agentId = agentId;
    this.maxDepth = maxDepth;

    if (parentContext) {
      this.rootTaskId = parentContext.rootTaskId;
      this.context = {
        initiatorAgentId: parentContext.initiatorAgentId,
        rootTaskId: parentContext.rootTaskId,
        currentDepth: parentContext.currentDepth + 1,
        delegationChain: [...parentContext.delegationChain, agentId],
        maxDepth: parentContext.maxDepth,
        startedAt: parentContext.startedAt,
      };
    } else {
      this.rootTaskId = crypto.randomUUID();
      this.context = {
        initiatorAgentId: agentId,
        rootTaskId: this.rootTaskId,
        currentDepth: 0,
        delegationChain: [agentId],
        maxDepth,
        startedAt: new Date().toISOString(),
      };
    }
  }

  getContext(): DelegationContext {
    return { ...this.context };
  }

  canDelegate(toAgentId: string): DelegationCheckResult {
    // INV-DT-001: Check depth limit
    if (this.context.currentDepth >= this.maxDepth) {
      return {
        allowed: false,
        reason: 'MAX_DEPTH_EXCEEDED',
        message: `Maximum delegation depth (${this.maxDepth}) exceeded`,
      };
    }

    // INV-DT-002: Check for circular delegation
    if (this.context.delegationChain.includes(toAgentId)) {
      return {
        allowed: false,
        reason: 'CIRCULAR_DELEGATION',
        message: `Circular delegation detected: ${this.context.delegationChain.join(' -> ')} -> ${toAgentId}`,
      };
    }

    return {
      allowed: true,
    };
  }

  createDelegationRequest(
    toAgentId: string,
    task: string,
    input?: unknown,
    timeout?: number
  ): DelegationRequest | null {
    const check = this.canDelegate(toAgentId);
    if (!check.allowed) {
      return null;
    }

    return {
      fromAgentId: this.agentId,
      toAgentId,
      task,
      input,
      timeout,
      context: this.context,
    };
  }

  createChildContext(toAgentId: string): DelegationContext {
    return {
      initiatorAgentId: this.context.initiatorAgentId,
      rootTaskId: this.context.rootTaskId,
      currentDepth: this.context.currentDepth + 1,
      delegationChain: [...this.context.delegationChain, toAgentId],
      maxDepth: this.context.maxDepth,
      startedAt: this.context.startedAt,
    };
  }

  recordResult(result: DelegationResult): void {
    this.history.push(result);
  }

  getHistory(): DelegationResult[] {
    return [...this.history];
  }

  isRoot(): boolean {
    return this.context.currentDepth === 0;
  }

  getRemainingDepth(): number {
    return this.maxDepth - this.context.currentDepth;
  }
}

// ============================================================================
// Production Parallel Executor
// ============================================================================

import type { AgentWorkflowStep } from '@defai.digital/contracts';
import type { ParallelStepExecutor, ParallelGroupResult, ParallelStepResult } from './types.js';

/**
 * Production parallel executor implementation
 *
 * INV-PE-001: Independent steps execute concurrently
 * INV-PE-002: Dependencies honored (DAG ordering)
 * INV-PE-003: Concurrency limit respected
 */
class ProductionParallelExecutor implements ParallelExecutorPort {
  private readonly config: ParallelExecutionConfig;
  private cancelled = false;

  constructor(config: ParallelExecutionConfig) {
    this.config = config;
  }

  getConfig(): ParallelExecutionConfig {
    return { ...this.config };
  }

  async executeGroup(
    steps: AgentWorkflowStep[],
    executor: ParallelStepExecutor,
    previousOutputs: Record<string, unknown> = {}
  ): Promise<ParallelGroupResult> {
    this.cancelled = false;
    const startTime = Date.now();
    const results: ParallelStepResult[] = [];
    const outputs = { ...previousOutputs };

    if (!this.config.enabled) {
      // Sequential execution
      for (const step of steps) {
        if (this.cancelled) {
          results.push(this.createCancelledResult(step.stepId));
          continue;
        }

        const stepResult = await this.executeStep(step, executor, outputs);
        results.push(stepResult);

        if (stepResult.success && stepResult.output !== undefined) {
          outputs[step.stepId] = stepResult.output;
        }

        // Handle failure strategy
        if (!stepResult.success && this.config.failureStrategy === 'failFast') {
          break;
        }
      }
    } else {
      // Parallel execution with DAG ordering
      // INV-PE-002: Dependencies honored
      const layers = this.buildExecutionLayers(steps);

      for (const layer of layers) {
        if (this.cancelled) {
          for (const step of layer) {
            results.push(this.createCancelledResult(step.stepId));
          }
          continue;
        }

        // INV-PE-001: Independent steps execute concurrently
        // INV-PE-003: Concurrency limit respected
        const layerResults = await this.executeLayer(layer, executor, outputs);
        results.push(...layerResults);

        // Collect outputs
        for (const result of layerResults) {
          if (result.success && result.output !== undefined) {
            outputs[result.stepId] = result.output;
          }
        }

        // Handle failure strategy
        if (this.config.failureStrategy === 'failFast') {
          if (layerResults.some((r) => !r.success)) {
            break;
          }
        }
      }
    }

    const failedCount = results.filter((r) => !r.success && !r.cancelled).length;
    const cancelledCount = results.filter((r) => r.cancelled).length;

    return {
      stepResults: results,
      totalDurationMs: Date.now() - startTime,
      allSucceeded: failedCount === 0 && cancelledCount === 0,
      failedCount,
      cancelledCount,
    };
  }

  buildExecutionLayers(steps: AgentWorkflowStep[]): AgentWorkflowStep[][] {
    const layers: AgentWorkflowStep[][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];

    // Guard against infinite loops with max iteration limit
    const maxIterations = steps.length + 1;
    let iterations = 0;

    while (remaining.length > 0 && iterations < maxIterations) {
      iterations++;
      const layer: AgentWorkflowStep[] = [];
      const toRemove: number[] = [];

      for (let i = 0; i < remaining.length; i++) {
        const step = remaining[i];
        if (!step) continue;
        const deps = step.dependencies ?? [];

        // Check if all dependencies are completed
        if (deps.every((d) => completed.has(d))) {
          layer.push(step);
          toRemove.push(i);
        }
      }

      // Remove processed steps
      for (let i = toRemove.length - 1; i >= 0; i--) {
        const idx = toRemove[i];
        if (idx !== undefined) {
          remaining.splice(idx, 1);
        }
      }

      if (layer.length === 0 && remaining.length > 0) {
        // Circular dependency or unresolvable - add remaining as single layer
        const unresolvableSteps = remaining.map((s) => s.stepId).join(', ');
        console.warn(
          `[buildExecutionLayers] Circular or unresolvable dependencies detected. ` +
          `Unresolvable steps: ${unresolvableSteps}`
        );
        layers.push(remaining);
        break;
      }

      if (layer.length > 0) {
        layers.push(layer);
        for (const step of layer) {
          completed.add(step.stepId);
        }
      }
    }

    if (iterations >= maxIterations) {
      console.error(
        `[buildExecutionLayers] Max iterations (${maxIterations}) reached. ` +
        `This indicates a bug in the algorithm or malformed input.`
      );
    }

    return layers;
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async executeLayer(
    layer: AgentWorkflowStep[],
    executor: ParallelStepExecutor,
    outputs: Record<string, unknown>
  ): Promise<ParallelStepResult[]> {
    // INV-PE-003: Respect concurrency limit
    const concurrency = this.config.maxConcurrency;
    const results: ParallelStepResult[] = [];

    for (let i = 0; i < layer.length; i += concurrency) {
      const batch = layer.slice(i, i + concurrency);
      const batchPromises = batch.map((step) =>
        this.executeStep(step, executor, outputs)
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  private async executeStep(
    step: AgentWorkflowStep,
    executor: ParallelStepExecutor,
    outputs: Record<string, unknown>
  ): Promise<ParallelStepResult> {
    const startTime = Date.now();

    try {
      const output = await executor(step, outputs);
      return {
        stepId: step.stepId,
        success: true,
        output,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepId: step.stepId,
        success: false,
        error: getErrorMessage(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private createCancelledResult(stepId: string): ParallelStepResult {
    return {
      stepId,
      success: false,
      cancelled: true,
      durationMs: 0,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a production checkpoint storage factory
 */
export function createCheckpointStorageFactory(
  storage: CheckpointStoragePort
): CheckpointStorageFactory {
  return () => storage;
}

/**
 * Create a production checkpoint manager factory
 */
export function createCheckpointManagerFactory(): CheckpointManagerFactory {
  return (
    agentId: string,
    sessionId: string | undefined,
    storage: CheckpointStoragePort,
    config: CheckpointConfig
  ) => new ProductionCheckpointManager(agentId, sessionId, storage, config);
}

/**
 * Create a production delegation tracker factory
 */
export function createDelegationTrackerFactory(): DelegationTrackerFactory {
  return (
    agentId: string,
    parentContext: DelegationContext | undefined,
    maxDepth: number
  ) => new ProductionDelegationTracker(agentId, parentContext, maxDepth);
}

/**
 * Create a production parallel executor factory
 */
export function createParallelExecutorFactory(): ParallelExecutorFactory {
  return (config: Partial<ParallelExecutionConfig>) =>
    new ProductionParallelExecutor({
      ...createDefaultParallelExecutionConfig(),
      ...config,
    });
}

// ============================================================================
// Combined Factory Configuration
// ============================================================================

/**
 * Configuration for production factories
 */
export interface ProductionFactoriesConfig {
  /** Checkpoint storage implementation */
  checkpointStorage?: CheckpointStoragePort;
  /** Checkpoint config overrides */
  checkpointConfig?: Partial<CheckpointConfig>;
  /** Parallel execution config overrides */
  parallelConfig?: Partial<ParallelExecutionConfig>;
  /** Maximum delegation depth */
  maxDelegationDepth?: number;
}

/**
 * Production factories result
 */
export interface ProductionFactories {
  checkpointStorageFactory?: CheckpointStorageFactory;
  checkpointManagerFactory: CheckpointManagerFactory;
  delegationTrackerFactory: DelegationTrackerFactory;
  parallelExecutorFactory: ParallelExecutorFactory;
  checkpointConfig?: Partial<CheckpointConfig>;
  parallelConfig?: Partial<ParallelExecutionConfig>;
}

/**
 * Create all production factories
 *
 * This is the main entry point for wiring real implementations.
 */
export function createProductionFactories(
  config: ProductionFactoriesConfig = {}
): ProductionFactories {
  const factories: ProductionFactories = {
    checkpointManagerFactory: createCheckpointManagerFactory(),
    delegationTrackerFactory: createDelegationTrackerFactory(),
    parallelExecutorFactory: createParallelExecutorFactory(),
  };

  if (config.checkpointStorage) {
    factories.checkpointStorageFactory = createCheckpointStorageFactory(
      config.checkpointStorage
    );
  }

  if (config.checkpointConfig) {
    factories.checkpointConfig = config.checkpointConfig;
  }

  if (config.parallelConfig) {
    factories.parallelConfig = config.parallelConfig;
  }

  return factories;
}
