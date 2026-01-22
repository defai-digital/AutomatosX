/**
 * Discussion Executor
 *
 * Main orchestrator for multi-model discussions.
 * Coordinates pattern execution, consensus mechanisms, and result assembly.
 *
 * Invariants enforced:
 * - INV-DISC-009: Result always contains synthesis
 * - INV-DISC-100: Provider availability check before starting
 * - INV-DISC-101: Minimum participating providers enforced
 * - INV-DISC-102: Provider timeouts enforced
 * - INV-DISC-103: Promise.allSettled prevents race conditions on array mutation
 * - INV-DISC-104: Health checks have timeout to prevent blocking
 * - INV-DISC-RATE-001: Provider calls limited to configurable concurrency
 */

import pLimit from 'p-limit';
import {
  DEFAULT_PROVIDERS,
  DEFAULT_PROVIDER_TIMEOUT,
  DiscussionErrorCodes,
  createFailedDiscussionResult,
  DEFAULT_AGENT_WEIGHT_MULTIPLIER,
  getErrorMessage,
  type DiscussStepConfig,
  type DiscussionResult,
  type DiscussionRequest,
} from '@defai.digital/contracts';

// ============================================================================
// Constants
// ============================================================================

/** Default number of discussion rounds */
const DEFAULT_ROUNDS = 2;

/** Default consensus threshold */
const DEFAULT_CONSENSUS_THRESHOLD = 0.5;

/** Default minimum providers required */
const DEFAULT_MIN_PROVIDERS = 2;

/** Default temperature for discussions */
const DEFAULT_TEMPERATURE = 0.7;

/** Default synthesizer provider */
const DEFAULT_SYNTHESIZER = 'claude';

/** Default debate rounds */
const DEFAULT_DEBATE_ROUNDS = 4;

/** Lower temperature for voting (more consistent) */
const VOTING_TEMPERATURE = 0.5;

/** Default debate role providers */
const DEFAULT_DEBATE_PROPONENT = 'claude';
const DEFAULT_DEBATE_OPPONENT = 'grok';
const DEFAULT_DEBATE_JUDGE = 'gemini';

/** Default max concurrent provider calls (INV-DISC-RATE-001) */
const DEFAULT_MAX_CONCURRENT_PROVIDER_CALLS = 5;

/** Default timeout for provider health checks in milliseconds */
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5000;

import type {
  DiscussionProviderExecutor,
  DiscussionExecutorOptions,
  PatternExecutionContext,
  DiscussionProgressEvent,
  ResolvedParticipantLike,
  ProviderExecuteRequest,
  ProviderExecuteResult,
} from './types.js';
import { getPatternExecutor } from './patterns/index.js';
import { getConsensusExecutor } from './consensus/index.js';
import {
  resolveParticipants,
  getProviderIds,
} from './participant-resolver.js';

/**
 * Main discussion executor class.
 *
 * Orchestrates multi-model discussions across different patterns and consensus mechanisms.
 */
export class DiscussionExecutor {
  private readonly providerExecutor: DiscussionProviderExecutor;
  private readonly rateLimitedProviderExecutor: DiscussionProviderExecutor;
  private readonly defaultTimeoutMs: number;
  private readonly checkProviderHealth: boolean;
  private readonly traceId: string | undefined;
  private readonly participantResolverOptions: DiscussionExecutorOptions['participantResolverOptions'];
  private readonly cascadingConfidence: DiscussionExecutorOptions['cascadingConfidence'];
  private readonly providerConcurrencyLimit: ReturnType<typeof pLimit>;

  constructor(options: DiscussionExecutorOptions) {
    this.providerExecutor = options.providerExecutor;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT;
    this.checkProviderHealth = options.checkProviderHealth ?? true;
    this.traceId = options.traceId;
    this.participantResolverOptions = options.participantResolverOptions ?? {};
    this.cascadingConfidence = options.cascadingConfidence;

    // INV-DISC-RATE-001: Create concurrency limiter for provider calls
    this.providerConcurrencyLimit = pLimit(
      options.maxConcurrentProviderCalls ?? DEFAULT_MAX_CONCURRENT_PROVIDER_CALLS
    );

    // Create rate-limited wrapper for provider executor
    this.rateLimitedProviderExecutor = this.createRateLimitedExecutor(options.providerExecutor);
  }

  /**
   * Create a rate-limited wrapper for the provider executor (INV-DISC-RATE-001)
   */
  private createRateLimitedExecutor(executor: DiscussionProviderExecutor): DiscussionProviderExecutor {
    const limit = this.providerConcurrencyLimit;
    return {
      execute: (request: ProviderExecuteRequest): Promise<ProviderExecuteResult> => {
        return limit(() => executor.execute(request));
      },
      isAvailable: (providerId: string): Promise<boolean> => {
        return executor.isAvailable(providerId);
      },
      getAvailableProviders: (): Promise<string[]> => {
        return executor.getAvailableProviders();
      },
    };
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
      rounds: request.rounds || DEFAULT_ROUNDS,
      providers: request.providers || [...DEFAULT_PROVIDERS],
      prompt: request.topic,
      consensus: {
        method: request.consensusMethod || 'synthesis',
        threshold: DEFAULT_CONSENSUS_THRESHOLD,
        synthesizer: DEFAULT_SYNTHESIZER,
        includeDissent: true,
      },
      context: request.context,
      verbose: request.verbose ?? false,
      providerTimeout: this.defaultTimeoutMs,
      continueOnProviderFailure: true,
      minProviders: DEFAULT_MIN_PROVIDERS,
      temperature: DEFAULT_TEMPERATURE,
      agentWeightMultiplier: DEFAULT_AGENT_WEIGHT_MULTIPLIER,
      fastMode: false,
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

    // Resolve participants if provided (INV-DISC-640, INV-DISC-641)
    let resolvedParticipants: ResolvedParticipantLike[] | undefined;
    let providersToCheck: string[];

    if (config.participants && config.participants.length > 0) {
      // Resolve participants (agents + providers) to execution config
      try {
        resolvedParticipants = await resolveParticipants(config.participants, {
          ...this.participantResolverOptions,
          topic: config.prompt,
          agentWeightMultiplier: config.agentWeightMultiplier,
        });
        // Extract unique provider IDs from resolved participants
        providersToCheck = getProviderIds(resolvedParticipants);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        return createFailedDiscussionResult(
          config.pattern,
          config.prompt,
          DiscussionErrorCodes.INVALID_CONFIG,
          `Failed to resolve participants: ${errorMessage}`,
          startedAt
        );
      }
    } else {
      // Use legacy providers array
      providersToCheck = config.providers;
    }

    // INV-DISC-100: Check provider availability
    let availableProviders: string[];
    try {
      availableProviders = await this.checkProviders(providersToCheck);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
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
    // INV-DISC-RATE-001: Use rate-limited provider executor
    const patternContext: PatternExecutionContext = {
      config,
      providerExecutor: this.rateLimitedProviderExecutor,
      availableProviders,
      abortSignal,
      traceId: this.traceId,
      onProgress,
      // Pass resolved participants for agent-aware execution
      resolvedParticipants,
      // Cascading confidence for early exit (INV-DISC-622, INV-DISC-623)
      cascadingConfidence: this.cascadingConfidence,
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

    // INV-DISC-104: Check abort signal between pattern and consensus execution
    if (abortSignal?.aborted) {
      return createFailedDiscussionResult(
        config.pattern,
        config.prompt,
        DiscussionErrorCodes.INVALID_CONFIG,
        'Discussion aborted after pattern execution',
        startedAt
      );
    }

    // Execute consensus mechanism
    const consensusExecutor = getConsensusExecutor(config.consensus.method);

    // INV-DISC-RATE-001: Use rate-limited provider executor for consensus
    const consensusResult = await consensusExecutor.execute({
      topic: config.prompt,
      rounds: patternResult.rounds,
      participatingProviders: patternResult.participatingProviders,
      config: config.consensus,
      agentWeightMultiplier: config.agentWeightMultiplier,
      providerExecutor: this.rateLimitedProviderExecutor,
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
   * INV-DISC-103: Use Promise.allSettled to avoid race condition on array mutation
   * INV-DISC-104: Health checks have timeout to prevent hung providers blocking discussions
   */
  private async checkProviders(providers: string[]): Promise<string[]> {
    if (!this.checkProviderHealth) {
      return providers;
    }

    // INV-DISC-103: Use Promise.allSettled pattern instead of concurrent array push
    // INV-DISC-104: Wrap each health check with timeout to prevent hangs
    const results = await Promise.allSettled(
      providers.map(async (providerId) => {
        // Race the health check against a timeout
        const isAvailable = await Promise.race([
          this.providerExecutor.isAvailable(providerId),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), DEFAULT_HEALTH_CHECK_TIMEOUT_MS)
          ),
        ]);
        return { providerId, isAvailable };
      })
    );

    // Filter fulfilled results where provider is available
    return results
      .filter((result): result is PromiseFulfilledResult<{ providerId: string; isAvailable: boolean }> =>
        result.status === 'fulfilled' && result.value.isAvailable)
      .map(result => result.value.providerId);
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
    proponent = DEFAULT_DEBATE_PROPONENT,
    opponent = DEFAULT_DEBATE_OPPONENT,
    judge = DEFAULT_DEBATE_JUDGE,
    options?: {
      rounds?: number;
      abortSignal?: AbortSignal;
      onProgress?: (event: DiscussionProgressEvent) => void;
    }
  ): Promise<DiscussionResult> {
    const config: DiscussStepConfig = {
      pattern: 'debate',
      rounds: options?.rounds || DEFAULT_DEBATE_ROUNDS,
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
        threshold: DEFAULT_CONSENSUS_THRESHOLD,
        synthesizer: judge,
        includeDissent: true,
      },
      providerTimeout: this.defaultTimeoutMs,
      continueOnProviderFailure: false, // Debates require all participants
      minProviders: 3,
      temperature: DEFAULT_TEMPERATURE,
      agentWeightMultiplier: DEFAULT_AGENT_WEIGHT_MULTIPLIER,
      fastMode: false,
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
        threshold: DEFAULT_CONSENSUS_THRESHOLD,
        includeDissent: true,
      },
      providerTimeout: this.defaultTimeoutMs,
      continueOnProviderFailure: true,
      minProviders: DEFAULT_MIN_PROVIDERS,
      temperature: VOTING_TEMPERATURE, // Lower temperature for more consistent voting
      agentWeightMultiplier: DEFAULT_AGENT_WEIGHT_MULTIPLIER,
      fastMode: false,
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
