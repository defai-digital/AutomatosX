/**
 * Synthesis Pattern Executor
 *
 * Models give parallel perspectives, then cross-discuss, then one synthesizes.
 * This is the default and most commonly used pattern.
 *
 * Flow:
 * 1. Round 1: All providers respond in parallel with initial perspectives
 * 2. Round 2: Each provider responds to others' perspectives
 * 3. (Optional) Additional cross-discussion rounds
 * 4. Final synthesis by designated synthesizer (default: claude)
 *
 * Invariants:
 * - INV-DISC-643: Early exit only after minProviders responded
 */

import type { DiscussionRound, DebateRole } from '@defai.digital/contracts';
import { DEFAULT_ROUND_AGREEMENT_THRESHOLD } from '@defai.digital/contracts';
import type {
  PatternExecutor,
  PatternExecutionContext,
  PatternExecutionResult,
  EarlyExitInfo,
} from '../types.js';
import {
  SYNTHESIS_INITIAL,
  SYNTHESIS_CROSS_DISCUSS,
  interpolate,
  formatPreviousResponses,
  getProviderSystemPrompt,
} from '../prompts/templates.js';
import { extractConfidence, evaluateEarlyExit, calculateAgreementScore } from '../confidence-extractor.js';

// Local type for discussion DiscussionProviderResponse (avoids conflict with provider/v1 DiscussionProviderResponse)
interface DiscussionProviderResponse {
  provider: string;
  content: string;
  round: number;
  role?: DebateRole | undefined;
  confidence?: number | undefined;
  vote?: string | undefined;
  timestamp: string;
  durationMs: number;
  tokenCount?: number | undefined;
  truncated?: boolean | undefined;
  error?: string | undefined;
}

export class SynthesisPattern implements PatternExecutor {
  readonly pattern = 'synthesis' as const;

  async execute(context: PatternExecutionContext): Promise<PatternExecutionResult> {
    const startTime = Date.now();
    const { config, providerExecutor, availableProviders, abortSignal, onProgress, cascadingConfidence } = context;

    const rounds: DiscussionRound[] = [];
    const participatingProviders = new Set<string>();
    const failedProviders = new Set<string>();
    let earlyExit: EarlyExitInfo | undefined;

    // Extract round early exit config
    const roundEarlyExit = config.roundEarlyExit ?? { enabled: true, agreementThreshold: DEFAULT_ROUND_AGREEMENT_THRESHOLD, minRounds: 1 };

    // Filter to available providers
    const providers = config.providers.filter(p => availableProviders.includes(p));

    if (providers.length < config.minProviders) {
      return {
        rounds: [],
        participatingProviders: [],
        failedProviders: config.providers.filter(p => !availableProviders.includes(p)),
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: `Only ${providers.length} providers available, need ${config.minProviders}`,
      };
    }

    // Round 1: Gather initial perspectives in parallel
    onProgress?.({
      type: 'round_start',
      round: 1,
      message: config.fastMode
        ? 'Fast mode: Gathering perspectives (single round)'
        : 'Gathering initial perspectives in parallel',
      timestamp: new Date().toISOString(),
    });

    const initialRound = await this.executeParallelRound(
      1,
      providers,
      config,
      providerExecutor,
      [],
      abortSignal,
      onProgress
    );

    rounds.push(initialRound.round);
    initialRound.succeeded.forEach(p => participatingProviders.add(p));
    initialRound.failed.forEach(p => failedProviders.add(p));

    onProgress?.({
      type: 'round_complete',
      round: 1,
      message: `Initial perspectives gathered from ${initialRound.succeeded.length} providers`,
      timestamp: new Date().toISOString(),
      // Extended fields for Phase 2 tracing
      participatingProviders: initialRound.succeeded,
      failedProviders: initialRound.failed,
      responseCount: initialRound.round.responses.length,
      durationMs: initialRound.round.durationMs,
    });

    // Check if enough providers participated
    if (participatingProviders.size < config.minProviders) {
      return {
        rounds,
        participatingProviders: Array.from(participatingProviders),
        failedProviders: Array.from(failedProviders),
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: `Only ${participatingProviders.size} providers succeeded in round 1`,
      };
    }

    // FAST MODE: Skip cross-discussion rounds entirely
    if (config.fastMode) {
      onProgress?.({
        type: 'round_complete',
        message: 'Fast mode: Skipping cross-discussion, proceeding to synthesis',
        timestamp: new Date().toISOString(),
      });

      return {
        rounds,
        participatingProviders: Array.from(participatingProviders),
        failedProviders: Array.from(failedProviders),
        totalDurationMs: Date.now() - startTime,
        success: true,
        earlyExit: {
          triggered: true,
          reason: 'Fast mode enabled - single round',
          atProviderCount: participatingProviders.size,
        },
      };
    }

    // Check for early exit after round 1 (INV-DISC-643)
    if (cascadingConfidence?.enabled) {
      const responsesWithConfidence = initialRound.round.responses.map(r => ({
        provider: r.provider,
        content: r.content,
        confidence: r.confidence,
      }));

      const exitDecision = evaluateEarlyExit(responsesWithConfidence, {
        enabled: cascadingConfidence.enabled,
        threshold: cascadingConfidence.threshold,
        minProviders: cascadingConfidence.minProviders,
      });

      if (exitDecision.shouldExit) {
        onProgress?.({
          type: 'round_complete',
          message: `Early exit triggered: ${exitDecision.reason}`,
          timestamp: new Date().toISOString(),
        });

        return {
          rounds,
          participatingProviders: Array.from(participatingProviders),
          failedProviders: Array.from(failedProviders),
          totalDurationMs: Date.now() - startTime,
          success: true,
          earlyExit: {
            triggered: true,
            reason: exitDecision.reason,
            atProviderCount: exitDecision.providerCount,
            confidenceScore: exitDecision.confidence,
          },
        };
      }
    }

    // ROUND-LEVEL EARLY EXIT: Check agreement after round 1
    if (roundEarlyExit.enabled && rounds.length >= (roundEarlyExit.minRounds ?? 1)) {
      const agreementScore = this.calculateRoundAgreement(initialRound.round.responses);
      const threshold = roundEarlyExit.agreementThreshold ?? DEFAULT_ROUND_AGREEMENT_THRESHOLD;

      if (agreementScore >= threshold) {
        onProgress?.({
          type: 'round_complete',
          message: `Round early exit: High agreement detected (${(agreementScore * 100).toFixed(0)}% >= ${(threshold * 100).toFixed(0)}%)`,
          timestamp: new Date().toISOString(),
        });

        return {
          rounds,
          participatingProviders: Array.from(participatingProviders),
          failedProviders: Array.from(failedProviders),
          totalDurationMs: Date.now() - startTime,
          success: true,
          earlyExit: {
            triggered: true,
            reason: `High agreement after round 1 (${(agreementScore * 100).toFixed(0)}%)`,
            atProviderCount: participatingProviders.size,
            confidenceScore: agreementScore,
          },
        };
      }
    }

    // Additional rounds: Cross-discussion
    for (let roundNum = 2; roundNum <= config.rounds; roundNum++) {
      if (abortSignal?.aborted) {
        break;
      }

      onProgress?.({
        type: 'round_start',
        round: roundNum,
        message: `Starting cross-discussion round ${roundNum}`,
        timestamp: new Date().toISOString(),
      });

      const crossRound = await this.executeCrossDiscussionRound(
        roundNum,
        providers.filter(p => participatingProviders.has(p)),
        config,
        providerExecutor,
        rounds,
        abortSignal,
        onProgress
      );

      rounds.push(crossRound.round);
      crossRound.failed.forEach(p => failedProviders.add(p));

      onProgress?.({
        type: 'round_complete',
        round: roundNum,
        message: `Cross-discussion round ${roundNum} complete`,
        timestamp: new Date().toISOString(),
        // Extended fields for Phase 2 tracing
        participatingProviders: providers.filter(p => !crossRound.failed.includes(p)),
        failedProviders: crossRound.failed,
        responseCount: crossRound.round.responses.length,
        durationMs: crossRound.round.durationMs,
      });

      // Check for early exit after each round
      if (cascadingConfidence?.enabled && roundNum < config.rounds) {
        const allResponses = crossRound.round.responses.map(r => ({
          provider: r.provider,
          content: r.content,
          confidence: r.confidence,
        }));

        const exitDecision = evaluateEarlyExit(allResponses, {
          enabled: cascadingConfidence.enabled,
          threshold: cascadingConfidence.threshold,
          minProviders: cascadingConfidence.minProviders,
        });

        if (exitDecision.shouldExit) {
          earlyExit = {
            triggered: true,
            reason: exitDecision.reason,
            atProviderCount: exitDecision.providerCount,
            confidenceScore: exitDecision.confidence,
          };

          onProgress?.({
            type: 'round_complete',
            message: `Early exit after round ${roundNum}: ${exitDecision.reason}`,
            timestamp: new Date().toISOString(),
          });

          break; // Exit the rounds loop
        }
      }
    }

    return {
      rounds,
      participatingProviders: Array.from(participatingProviders),
      failedProviders: Array.from(failedProviders),
      totalDurationMs: Date.now() - startTime,
      success: participatingProviders.size >= config.minProviders,
      earlyExit: earlyExit ?? { triggered: false },
    };
  }

  private async executeParallelRound(
    roundNum: number,
    providers: string[],
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    _previousRounds: DiscussionRound[],
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; succeeded: string[]; failed: string[] }> {
    const roundStart = Date.now();
    const succeeded: string[] = [];
    const failed: string[] = [];

    // Build prompts for all providers
    const prompt = interpolate(SYNTHESIS_INITIAL, {
      topic: config.prompt,
      context: config.context ? `\n## Additional Context\n${config.context}` : '',
    });

    // Execute all providers in parallel
    const promises = providers.map(async (providerId) => {
      if (abortSignal?.aborted) {
        return null;
      }

      onProgress?.({
        type: 'provider_start',
        round: roundNum,
        provider: providerId,
        timestamp: new Date().toISOString(),
      });

      const responseStart = Date.now();

      try {
        const result = await providerExecutor.execute({
          providerId,
          prompt: config.providerPrompts?.[providerId] || prompt,
          systemPrompt: getProviderSystemPrompt(providerId),
          temperature: config.temperature,
          timeoutMs: config.providerTimeout,
          abortSignal,
        });

        // Extract confidence from response content
        const content = result.success ? result.content || '' : '';
        const confidenceResult = result.success ? extractConfidence(content) : null;

        const response: DiscussionProviderResponse = {
          provider: providerId,
          content,
          round: roundNum,
          timestamp: new Date().toISOString(),
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          truncated: result.truncated,
          error: result.success ? undefined : result.error,
          confidence: confidenceResult?.score ?? undefined,
        };

        if (result.success) {
          succeeded.push(providerId);
        } else {
          failed.push(providerId);
        }

        onProgress?.({
          type: 'provider_complete',
          round: roundNum,
          provider: providerId,
          message: result.success ? 'completed' : `failed: ${result.error}`,
          timestamp: new Date().toISOString(),
          // Extended fields for Phase 2 tracing
          success: result.success,
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          error: result.success ? undefined : result.error,
        });

        return response;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push(providerId);

        return {
          provider: providerId,
          content: '',
          round: roundNum,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - responseStart,
          error: errorMessage,
        } as DiscussionProviderResponse;
      }
    });

    const responses = await Promise.all(promises);
    const validResponses = responses.filter((r): r is DiscussionProviderResponse => r !== null);

    return {
      round: {
        roundNumber: roundNum,
        responses: validResponses,
        durationMs: Date.now() - roundStart,
      },
      succeeded,
      failed,
    };
  }

  private async executeCrossDiscussionRound(
    roundNum: number,
    providers: string[],
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    previousRounds: DiscussionRound[],
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; failed: string[] }> {
    const roundStart = Date.now();
    const failed: string[] = [];

    // Execute all providers in parallel
    const promises = providers.map(async (providerId) => {
      if (abortSignal?.aborted) {
        return null;
      }

      onProgress?.({
        type: 'provider_start',
        round: roundNum,
        provider: providerId,
        timestamp: new Date().toISOString(),
      });

      const responseStart = Date.now();

      try {
        // Get other providers' responses from previous round
        const previousRound = previousRounds[previousRounds.length - 1];
        const otherResponses = previousRound?.responses.filter(r => r.provider !== providerId) || [];

        const prompt = interpolate(SYNTHESIS_CROSS_DISCUSS, {
          topic: config.prompt,
          otherPerspectives: formatPreviousResponses(
            otherResponses.map(r => ({
              provider: r.provider,
              content: r.content,
            }))
          ),
        });

        const result = await providerExecutor.execute({
          providerId,
          prompt,
          systemPrompt: getProviderSystemPrompt(providerId),
          temperature: config.temperature,
          timeoutMs: config.providerTimeout,
          abortSignal,
        });

        // Extract confidence from response content
        const content = result.success ? result.content || '' : '';
        const confidenceResult = result.success ? extractConfidence(content) : null;

        const response: DiscussionProviderResponse = {
          provider: providerId,
          content,
          round: roundNum,
          timestamp: new Date().toISOString(),
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          error: result.success ? undefined : result.error,
          confidence: confidenceResult?.score ?? undefined,
        };

        if (!result.success) {
          failed.push(providerId);
        }

        onProgress?.({
          type: 'provider_complete',
          round: roundNum,
          provider: providerId,
          timestamp: new Date().toISOString(),
          // Extended fields for Phase 2 tracing
          success: result.success,
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          error: result.success ? undefined : result.error,
        });

        return response;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push(providerId);

        return {
          provider: providerId,
          content: '',
          round: roundNum,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - responseStart,
          error: errorMessage,
        } as DiscussionProviderResponse;
      }
    });

    const responses = await Promise.all(promises);
    const validResponses = responses.filter((r): r is DiscussionProviderResponse => r !== null);

    return {
      round: {
        roundNumber: roundNum,
        responses: validResponses,
        durationMs: Date.now() - roundStart,
      },
      failed,
    };
  }

  /**
   * Calculate agreement score for responses in a round.
   * Uses semantic similarity and key phrase overlap to detect consensus.
   */
  private calculateRoundAgreement(responses: DiscussionProviderResponse[]): number {
    if (responses.length < 2) {
      return 1.0; // Single response = full agreement
    }

    const successfulResponses = responses.filter(r => !r.error && r.content.length > 0);
    if (successfulResponses.length < 2) {
      return 0.5; // Not enough responses to compare
    }

    // Use the calculateAgreementScore function from confidence-extractor
    const responsesForScoring = successfulResponses.map(r => ({
      provider: r.provider,
      content: r.content,
      confidence: r.confidence,
    }));

    return calculateAgreementScore(responsesForScoring);
  }
}
