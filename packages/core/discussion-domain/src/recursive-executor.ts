/**
 * Recursive Discussion Executor
 *
 * Extends the base discussion executor with support for recursive sub-discussions.
 * Providers can spawn sub-discussions during their response.
 *
 * Invariants:
 * - INV-DISC-600: Depth never exceeds maxDepth
 * - INV-DISC-601: No circular discussions
 * - INV-DISC-610: Child timeout ≤ parent remaining budget
 * - INV-DISC-620: Total calls ≤ maxTotalCalls
 */

import {
  DEFAULT_PROVIDERS,
  DiscussionErrorCodes,
  createFailedDiscussionResult,
  type DiscussStepConfig,
  type DiscussionResult,
  type DiscussionRequest,
  type DiscussionContext,
  type SubDiscussionResult,
  type RecursiveConfig,
  type TimeoutConfig,
  type CostControlConfig,
  DEFAULT_DISCUSSION_DEPTH,
  DEFAULT_TOTAL_BUDGET_MS,
  DEFAULT_MAX_TOTAL_CALLS,
  MIN_SYNTHESIS_TIME_MS,
} from '@defai.digital/contracts';

import type {
  DiscussionProviderExecutor,
  RecursiveDiscussionExecutorOptions,
  DiscussionProgressEvent,
  RecursivePatternExecutionResult,
} from './types.js';
import { getPatternExecutor } from './patterns/index.js';
import { getConsensusExecutor } from './consensus/index.js';
import { createContextTracker } from './context-tracker.js';
import { createBudgetManager } from './budget-manager.js';

/**
 * Extended discussion result with recursive info
 */
export interface RecursiveDiscussionResult extends DiscussionResult {
  /** Sub-discussions that were spawned */
  subDiscussions?: SubDiscussionResult[];

  /** Total provider calls across all levels */
  totalProviderCalls?: number;

  /** Maximum depth reached */
  maxDepthReached?: number;

  /** Discussion context */
  context?: DiscussionContext;
}

/**
 * Recursive discussion executor class.
 *
 * Orchestrates multi-model discussions with support for nested sub-discussions.
 */
export class RecursiveDiscussionExecutor {
  private readonly providerExecutor: DiscussionProviderExecutor;
  private readonly defaultTimeoutMs: number;
  private readonly checkProviderHealth: boolean;
  private readonly traceId: string | undefined;
  private readonly recursiveConfig: RecursiveConfig;
  private readonly timeoutConfig: TimeoutConfig;
  private readonly costConfig: CostControlConfig;
  private readonly parentContext: DiscussionContext | undefined;
  private readonly onSubDiscussionSpawn: ((context: DiscussionContext, topic: string) => void) | undefined;
  private readonly onSubDiscussionComplete: ((result: SubDiscussionResult) => void) | undefined;

  constructor(options: RecursiveDiscussionExecutorOptions) {
    this.providerExecutor = options.providerExecutor;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60000;
    this.checkProviderHealth = options.checkProviderHealth ?? true;
    this.traceId = options.traceId;
    this.parentContext = options.parentContext;
    this.onSubDiscussionSpawn = options.onSubDiscussionSpawn;
    this.onSubDiscussionComplete = options.onSubDiscussionComplete;

    // Initialize recursive config with defaults
    this.recursiveConfig = {
      enabled: options.recursive?.enabled ?? false,
      maxDepth: options.recursive?.maxDepth ?? DEFAULT_DISCUSSION_DEPTH,
      allowedProviders: options.recursive?.allowedProviders,
      allowSubDiscussions: options.recursive?.allowSubDiscussions ?? true,
    };

    // Initialize timeout config
    this.timeoutConfig = {
      strategy: options.timeout?.strategy ?? 'cascade',
      totalBudgetMs: options.timeout?.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS,
      minSynthesisMs: options.timeout?.minSynthesisMs ?? MIN_SYNTHESIS_TIME_MS,
      levelTimeouts: options.timeout?.levelTimeouts,
    };

    // Initialize cost config
    this.costConfig = {
      maxTotalCalls: options.cost?.maxTotalCalls ?? DEFAULT_MAX_TOTAL_CALLS,
      budgetUsd: options.cost?.budgetUsd,
      cascadingConfidence: {
        enabled: options.cost?.cascadingConfidence?.enabled ?? true,
        threshold: options.cost?.cascadingConfidence?.threshold ?? 0.9,
        minProviders: options.cost?.cascadingConfidence?.minProviders ?? 2,
      },
    };
  }

  /**
   * Execute a recursive discussion from a DiscussionRequest
   */
  async executeRequest(
    request: DiscussionRequest,
    options?: {
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<RecursiveDiscussionResult> {
    // Convert request to step config
    const config: DiscussStepConfig = {
      pattern: request.pattern || 'synthesis',
      rounds: request.rounds || 2,
      providers: request.providers || [...DEFAULT_PROVIDERS],
      prompt: request.topic,
      consensus: {
        method: request.consensusMethod || 'synthesis',
        threshold: 0.5,
        synthesizer: 'claude',
        includeDissent: true,
      },
      context: request.context,
      verbose: request.verbose ?? false,
      providerTimeout: this.defaultTimeoutMs,
      continueOnProviderFailure: true,
      minProviders: 2,
      temperature: 0.7,
      agentWeightMultiplier: 1.5,
    };

    return this.execute(config, options);
  }

  /**
   * Execute a recursive discussion with full configuration
   */
  async execute(
    config: DiscussStepConfig,
    options?: {
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<RecursiveDiscussionResult> {
    const startedAt = new Date().toISOString();
    const discussionId = crypto.randomUUID();
    const { abortSignal, onProgress } = options || {};

    // Check for early abort
    if (abortSignal?.aborted) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.INVALID_CONFIG,
        'Discussion aborted before starting',
        startedAt
      ) as RecursiveDiscussionResult;
    }

    // Create context tracker
    const contextTracker = createContextTracker(
      discussionId,
      {
        recursive: this.recursiveConfig,
        timeout: this.timeoutConfig,
        cost: this.costConfig,
      },
      this.parentContext
    );

    // Create budget manager
    const budgetManager = createBudgetManager(
      this.timeoutConfig,
      this.recursiveConfig.maxDepth
    );

    // Check provider availability
    let availableProviders: string[];
    try {
      availableProviders = await this.checkProviders(config.providers);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.ALL_PROVIDERS_FAILED,
        `Provider health check failed: ${errorMessage}`,
        startedAt
      ) as RecursiveDiscussionResult;
    }

    // Filter by allowed providers if recursive
    if (this.recursiveConfig.enabled && this.recursiveConfig.allowedProviders) {
      availableProviders = availableProviders.filter(
        p => this.recursiveConfig.allowedProviders!.includes(p)
      );
    }

    // Check minimum providers
    if (availableProviders.length < config.minProviders) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.INSUFFICIENT_PROVIDERS,
        `Only ${availableProviders.length} providers available, need ${config.minProviders}`,
        startedAt
      ) as RecursiveDiscussionResult;
    }

    // Track sub-discussions
    const subDiscussions: SubDiscussionResult[] = [];
    let totalProviderCalls = 0;
    let maxDepthReached = contextTracker.getContext().depth;

    // Create sub-discussion spawner
    const spawnSubDiscussion = async (
      topic: string,
      providers?: string[]
    ): Promise<SubDiscussionResult | null> => {
      // Check if we can spawn
      const check = contextTracker.canSpawnSubDiscussion();
      if (!check.allowed) {
        onProgress?.({
          type: 'provider_complete',
          message: `Sub-discussion blocked: ${check.reason}`,
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      // Create child context
      const childId = crypto.randomUUID();
      const childContext = contextTracker.createChildContext(childId);

      // Notify spawn
      this.onSubDiscussionSpawn?.(childContext, topic);

      onProgress?.({
        type: 'round_start',
        message: `Spawning sub-discussion at depth ${childContext.depth}: ${topic.slice(0, 50)}...`,
        timestamp: new Date().toISOString(),
      });

      // Create child executor
      const childExecutor = new RecursiveDiscussionExecutor({
        providerExecutor: this.providerExecutor,
        defaultTimeoutMs: budgetManager.getProviderTimeout(childContext.depth),
        checkProviderHealth: false, // Already checked parent providers
        traceId: this.traceId,
        recursive: {
          ...this.recursiveConfig,
          maxDepth: this.recursiveConfig.maxDepth, // Keep same max depth
        },
        timeout: {
          ...this.timeoutConfig,
          totalBudgetMs: childContext.remainingBudgetMs,
        },
        cost: this.costConfig,
        parentContext: childContext,
      });

      // Execute sub-discussion
      const subStart = Date.now();
      const subResult = await childExecutor.execute(
        {
          pattern: 'synthesis',
          rounds: 1, // Sub-discussions are quick
          providers: providers || availableProviders.slice(0, 3),
          prompt: topic,
          consensus: { method: 'synthesis', synthesizer: 'claude', threshold: 0.5, includeDissent: false },
          providerTimeout: budgetManager.getProviderTimeout(childContext.depth),
          continueOnProviderFailure: true,
          minProviders: 2,
          temperature: 0.7,
          verbose: false,
          agentWeightMultiplier: 1.5,
        },
        abortSignal ? { abortSignal } : {}
      );
      const subDuration = Date.now() - subStart;

      // Record usage
      contextTracker.recordCalls(subResult.participatingProviders.length);
      contextTracker.recordElapsed(subDuration);
      budgetManager.recordUsage(childContext.depth, subDuration);

      // Update tracking
      totalProviderCalls += subResult.totalProviderCalls ?? subResult.participatingProviders.length;
      maxDepthReached = Math.max(maxDepthReached, childContext.depth);

      // Create sub-discussion result
      const subDiscussionResult: SubDiscussionResult = {
        discussionId: childId,
        topic,
        participatingProviders: subResult.participatingProviders,
        synthesis: subResult.synthesis,
        durationMs: subDuration,
        depth: childContext.depth,
      };

      subDiscussions.push(subDiscussionResult);
      this.onSubDiscussionComplete?.(subDiscussionResult);

      onProgress?.({
        type: 'round_complete',
        message: `Sub-discussion completed at depth ${childContext.depth}`,
        timestamp: new Date().toISOString(),
      });

      return subDiscussionResult;
    };

    // Get pattern executor
    const patternExecutor = getPatternExecutor(config.pattern);

    // Build execution context with recursion support
    const patternContext = {
      config: {
        ...config,
        providerTimeout: budgetManager.getProviderTimeout(contextTracker.getContext().depth),
      },
      providerExecutor: this.providerExecutor,
      availableProviders,
      abortSignal,
      traceId: this.traceId,
      onProgress,
      // Cascading confidence for early exit
      cascadingConfidence: this.costConfig.cascadingConfidence ? {
        enabled: this.costConfig.cascadingConfidence.enabled ?? true,
        threshold: this.costConfig.cascadingConfidence.threshold ?? 0.9,
        minProviders: this.costConfig.cascadingConfidence.minProviders ?? 2,
      } : undefined,
      // Recursive extensions
      discussionContext: contextTracker.getContext(),
      allowSubDiscussions: this.recursiveConfig.enabled && this.recursiveConfig.allowSubDiscussions,
      spawnSubDiscussion: this.recursiveConfig.enabled ? spawnSubDiscussion : undefined,
    };

    // Execute pattern
    const patternResult = await patternExecutor.execute(patternContext) as RecursivePatternExecutionResult;

    // Record calls from pattern execution
    totalProviderCalls += patternResult.participatingProviders.length;
    contextTracker.recordCalls(patternResult.participatingProviders.length);

    if (!patternResult.success) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.ALL_PROVIDERS_FAILED,
        patternResult.error || 'Pattern execution failed',
        startedAt
      ) as RecursiveDiscussionResult;
    }

    // Execute consensus mechanism
    const consensusExecutor = getConsensusExecutor(config.consensus.method);

    const consensusResult = await consensusExecutor.execute({
      topic: config.prompt,
      rounds: patternResult.rounds,
      participatingProviders: patternResult.participatingProviders,
      config: config.consensus,
      agentWeightMultiplier: config.agentWeightMultiplier,
      providerExecutor: this.providerExecutor,
      abortSignal,
      onProgress,
    });

    // Record synthesis call
    totalProviderCalls += 1;
    contextTracker.recordCalls(1);

    if (!consensusResult.success) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.CONSENSUS_FAILED,
        consensusResult.error || 'Consensus failed',
        startedAt
      ) as RecursiveDiscussionResult;
    }

    // Build final result
    const result: RecursiveDiscussionResult = {
      success: true,
      pattern: config.pattern,
      topic: config.prompt,
      participatingProviders: patternResult.participatingProviders,
      failedProviders: patternResult.failedProviders,
      rounds: patternResult.rounds,
      synthesis: consensusResult.synthesis,
      consensus: consensusResult.consensus,
      votingResults: consensusResult.votingResults,
      totalDurationMs: patternResult.totalDurationMs + consensusResult.durationMs,
      metadata: {
        startedAt,
        completedAt: new Date().toISOString(),
        traceId: this.traceId,
        // Include early exit info if triggered
        ...(patternResult.earlyExit?.triggered ? {
          earlyExit: patternResult.earlyExit,
        } : {}),
      },
      // Recursive extensions
      ...(subDiscussions.length > 0 ? { subDiscussions } : {}),
      totalProviderCalls,
      maxDepthReached,
      context: contextTracker.getContext(),
    };

    return result;
  }

  /**
   * Check provider availability
   */
  private async checkProviders(providers: string[]): Promise<string[]> {
    if (!this.checkProviderHealth) {
      return providers;
    }

    const available: string[] = [];

    await Promise.all(
      providers.map(async (providerId) => {
        try {
          const isAvailable = await this.providerExecutor.isAvailable(providerId);
          if (isAvailable) {
            available.push(providerId);
          }
        } catch {
          // Provider check failed, don't include
        }
      })
    );

    return available;
  }

  /**
   * Quick recursive synthesis discussion
   *
   * Creates a temporary child executor with recursion enabled to avoid
   * mutating the parent config (which could cause race conditions).
   */
  async quickRecursiveSynthesis(
    topic: string,
    options?: {
      providers?: string[];
      maxDepth?: number;
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<RecursiveDiscussionResult> {
    // Create a new executor with recursion enabled instead of mutating this instance
    const recursiveExecutor = new RecursiveDiscussionExecutor({
      providerExecutor: this.providerExecutor,
      defaultTimeoutMs: this.defaultTimeoutMs,
      checkProviderHealth: this.checkProviderHealth,
      traceId: this.traceId,
      recursive: {
        ...this.recursiveConfig,
        enabled: true,
        maxDepth: options?.maxDepth ?? this.recursiveConfig.maxDepth,
      },
      timeout: this.timeoutConfig,
      cost: this.costConfig,
      parentContext: this.parentContext,
      onSubDiscussionSpawn: this.onSubDiscussionSpawn,
      onSubDiscussionComplete: this.onSubDiscussionComplete,
    });

    return recursiveExecutor.executeRequest(
      {
        topic,
        pattern: 'synthesis',
        providers: options?.providers,
        rounds: 2,
      },
      options
    );
  }
}

/**
 * Create a recursive discussion executor with default options
 */
export function createRecursiveDiscussionExecutor(
  providerExecutor: DiscussionProviderExecutor,
  options?: Partial<Omit<RecursiveDiscussionExecutorOptions, 'providerExecutor'>>
): RecursiveDiscussionExecutor {
  return new RecursiveDiscussionExecutor({
    providerExecutor,
    ...options,
  });
}
