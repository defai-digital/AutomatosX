/**
 * Discussion Executor
 *
 * Main orchestrator for multi-model discussions.
 * Coordinates pattern execution, consensus mechanisms, and result assembly.
 *
 * Invariants enforced:
 * - INV-DISC-100: Provider availability check before starting
 * - INV-DISC-101: Minimum participating providers enforced
 * - INV-DISC-102: Provider timeouts enforced
 * - INV-DISC-009: Result always contains synthesis
 */

import {
  DEFAULT_PROVIDERS,
  DiscussionErrorCodes,
  createFailedDiscussionResult,
  type DiscussStepConfig,
  type DiscussionResult,
  type DiscussionRequest,
} from '@defai.digital/contracts';

import type {
  DiscussionProviderExecutor,
  DiscussionExecutorOptions,
  PatternExecutionContext,
  DiscussionProgressEvent,
} from './types.js';
import { getPatternExecutor } from './patterns/index.js';
import { getConsensusExecutor } from './consensus/index.js';

/**
 * Main discussion executor class.
 *
 * Orchestrates multi-model discussions across different patterns and consensus mechanisms.
 */
export class DiscussionExecutor {
  private readonly providerExecutor: DiscussionProviderExecutor;
  private readonly defaultTimeoutMs: number;
  private readonly checkProviderHealth: boolean;
  private readonly traceId: string | undefined;

  constructor(options: DiscussionExecutorOptions) {
    this.providerExecutor = options.providerExecutor;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60000;
    this.checkProviderHealth = options.checkProviderHealth ?? true;
    this.traceId = options.traceId;
  }

  /**
   * Execute a discussion from a DiscussionRequest (CLI/MCP input format)
   */
  async executeRequest(
    request: DiscussionRequest,
    options?: {
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<DiscussionResult> {
    // Convert request to step config
    const config: DiscussStepConfig = {
      pattern: request.pattern || 'synthesis',
      rounds: request.rounds || 2,
      providers: request.providers || [...DEFAULT_PROVIDERS],
      prompt: request.topic,
      consensus: {
        method: request.consensusMethod || 'synthesis',
        threshold: 0.5,
        synthesizer: 'claude', // Default synthesizer
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
   * Execute a discussion with full configuration
   */
  async execute(
    config: DiscussStepConfig,
    options?: {
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<DiscussionResult> {
    const startedAt = new Date().toISOString();
    const { abortSignal, onProgress } = options || {};

    // Check for early abort
    if (abortSignal?.aborted) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.INVALID_CONFIG,
        'Discussion aborted before starting',
        startedAt
      );
    }

    // INV-DISC-100: Check provider availability
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
      );
    }

    // Get pattern executor
    const patternExecutor = getPatternExecutor(config.pattern);

    // Build execution context
    const patternContext: PatternExecutionContext = {
      config,
      providerExecutor: this.providerExecutor,
      availableProviders,
      abortSignal,
      traceId: this.traceId,
      onProgress,
      // No cascading confidence for base executor (recursive executor handles this)
    };

    // Execute pattern
    const patternResult = await patternExecutor.execute(patternContext);

    if (!patternResult.success) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.ALL_PROVIDERS_FAILED,
        patternResult.error || 'Pattern execution failed',
        startedAt
      );
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

    if (!consensusResult.success) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.CONSENSUS_FAILED,
        consensusResult.error || 'Consensus failed',
        startedAt
      );
    }

    // Build final result (INV-DISC-009: synthesis is always included)
    const result: DiscussionResult = {
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
        // Include early exit info if pattern triggered it
        ...(patternResult.earlyExit?.triggered ? {
          earlyExit: patternResult.earlyExit,
        } : {}),
      },
    };

    return result;
  }

  /**
   * Check provider availability (INV-DISC-100)
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
   * Create a quick synthesis discussion (2 rounds, default providers)
   */
  async quickSynthesis(
    topic: string,
    options?: {
      providers?: string[];
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<DiscussionResult> {
    return this.executeRequest(
      {
        topic,
        pattern: 'synthesis',
        providers: options?.providers,
        rounds: 2,
      },
      options
    );
  }

  /**
   * Create a debate discussion
   */
  async debate(
    topic: string,
    proponent = 'claude',
    opponent = 'glm',
    judge = 'gemini',
    options?: {
      rounds?: number;
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<DiscussionResult> {
    const config: DiscussStepConfig = {
      pattern: 'debate',
      rounds: options?.rounds || 4,
      providers: [proponent, opponent, judge],
      prompt: topic,
      verbose: false,
      roles: {
        [proponent]: 'proponent',
        [opponent]: 'opponent',
        [judge]: 'judge',
      },
      consensus: {
        method: 'moderator',
        threshold: 0.5,
        synthesizer: judge,
        includeDissent: true,
      },
      providerTimeout: this.defaultTimeoutMs,
      continueOnProviderFailure: false, // Debates require all participants
      minProviders: 3,
      temperature: 0.7,
      agentWeightMultiplier: 1.5,
    };

    return this.execute(config, options);
  }

  /**
   * Create a voting discussion
   */
  async vote(
    question: string,
    voteOptions: string[],
    options?: {
      providers?: string[];
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<DiscussionResult> {
    const providers = options?.providers || [...DEFAULT_PROVIDERS];

    const config: DiscussStepConfig = {
      pattern: 'voting',
      rounds: 1,
      providers,
      prompt: `${question}\n\nOptions: ${voteOptions.join(', ')}`,
      verbose: false,
      consensus: {
        method: 'voting',
        threshold: 0.5,
        includeDissent: true,
      },
      providerTimeout: this.defaultTimeoutMs,
      continueOnProviderFailure: true,
      minProviders: 2,
      temperature: 0.5, // Lower temperature for more consistent voting
      agentWeightMultiplier: 1.5,
    };

    return this.execute(config, options);
  }
}

/**
 * Create a discussion executor with default options
 */
export function createDiscussionExecutor(
  providerExecutor: DiscussionProviderExecutor,
  options?: Partial<Omit<DiscussionExecutorOptions, 'providerExecutor'>>
): DiscussionExecutor {
  return new DiscussionExecutor({
    providerExecutor,
    ...options,
  });
}
