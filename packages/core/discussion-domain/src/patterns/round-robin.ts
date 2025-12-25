/**
 * Round-Robin Pattern Executor
 *
 * Models respond sequentially, each building on previous responses.
 * Good for: brainstorming, iterative refinement, building consensus.
 */

import type { DiscussionRound, DebateRole } from '@defai.digital/contracts';
import type {
  PatternExecutor,
  PatternExecutionContext,
  PatternExecutionResult,
} from '../types.js';

// Local type for discussion ProviderResponse (avoids conflict with provider/v1 ProviderResponse)
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
import {
  ROUND_ROBIN_INITIAL,
  ROUND_ROBIN_FOLLOWUP,
  interpolate,
  formatPreviousResponses,
  getProviderSystemPrompt,
} from '../prompts/templates.js';

export class RoundRobinPattern implements PatternExecutor {
  readonly pattern = 'round-robin' as const;

  async execute(context: PatternExecutionContext): Promise<PatternExecutionResult> {
    const startTime = Date.now();
    const { config, providerExecutor, availableProviders, abortSignal, onProgress } = context;

    const rounds: DiscussionRound[] = [];
    const participatingProviders = new Set<string>();
    const failedProviders = new Set<string>();
    const allResponses: DiscussionProviderResponse[] = [];

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

    // Execute rounds
    for (let roundNum = 1; roundNum <= config.rounds; roundNum++) {
      if (abortSignal?.aborted) {
        break;
      }

      onProgress?.({
        type: 'round_start',
        round: roundNum,
        message: `Starting round ${roundNum} of ${config.rounds}`,
        timestamp: new Date().toISOString(),
      });

      const roundStart = Date.now();
      const roundResponses: DiscussionProviderResponse[] = [];

      // Each provider responds sequentially
      for (const providerId of providers) {
        if (abortSignal?.aborted) {
          break;
        }

        onProgress?.({
          type: 'provider_start',
          round: roundNum,
          provider: providerId,
          message: `${providerId} is responding...`,
          timestamp: new Date().toISOString(),
        });

        const responseStart = Date.now();

        try {
          // Build prompt based on round
          const prompt = this.buildPrompt(
            config.prompt,
            config.context || '',
            allResponses,
            roundNum === 1
          );

          const result = await providerExecutor.execute({
            providerId,
            prompt,
            systemPrompt: getProviderSystemPrompt(providerId),
            temperature: config.temperature,
            timeoutMs: config.providerTimeout,
            abortSignal,
          });

          const response: DiscussionProviderResponse = {
            provider: providerId,
            content: result.success ? result.content || '' : '',
            round: roundNum,
            timestamp: new Date().toISOString(),
            durationMs: result.durationMs,
            tokenCount: result.tokenCount,
            truncated: result.truncated,
            error: result.success ? undefined : result.error,
          };

          roundResponses.push(response);
          allResponses.push(response);

          if (result.success) {
            participatingProviders.add(providerId);
          } else if (!config.continueOnProviderFailure) {
            failedProviders.add(providerId);
            break;
          } else {
            failedProviders.add(providerId);
          }

          onProgress?.({
            type: 'provider_complete',
            round: roundNum,
            provider: providerId,
            message: result.success ? `${providerId} completed` : `${providerId} failed: ${result.error}`,
            timestamp: new Date().toISOString(),
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedProviders.add(providerId);

          roundResponses.push({
            provider: providerId,
            content: '',
            round: roundNum,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - responseStart,
            error: errorMessage,
          });

          if (!config.continueOnProviderFailure) {
            break;
          }
        }
      }

      rounds.push({
        roundNumber: roundNum,
        responses: roundResponses,
        durationMs: Date.now() - roundStart,
      });

      onProgress?.({
        type: 'round_complete',
        round: roundNum,
        message: `Round ${roundNum} complete`,
        timestamp: new Date().toISOString(),
      });

      // Check if we have enough participating providers
      if (participatingProviders.size < config.minProviders) {
        return {
          rounds,
          participatingProviders: Array.from(participatingProviders),
          failedProviders: Array.from(failedProviders),
          totalDurationMs: Date.now() - startTime,
          success: false,
          error: `Only ${participatingProviders.size} providers succeeded, need ${config.minProviders}`,
        };
      }
    }

    return {
      rounds,
      participatingProviders: Array.from(participatingProviders),
      failedProviders: Array.from(failedProviders),
      totalDurationMs: Date.now() - startTime,
      success: participatingProviders.size >= config.minProviders,
    };
  }

  private buildPrompt(
    topic: string,
    context: string,
    previousResponses: DiscussionProviderResponse[],
    isInitial: boolean
  ): string {
    if (isInitial || previousResponses.length === 0) {
      return interpolate(ROUND_ROBIN_INITIAL, {
        topic,
        context: context ? `\n## Additional Context\n${context}` : '',
      });
    }

    const formattedResponses = formatPreviousResponses(
      previousResponses.map(r => ({
        provider: r.provider,
        content: r.content,
      }))
    );

    return interpolate(ROUND_ROBIN_FOLLOWUP, {
      topic,
      previousResponses: formattedResponses,
    });
  }
}
