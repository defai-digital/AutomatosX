/**
 * Debate Pattern Executor
 *
 * Models argue opposing positions with an impartial judge.
 * Requires role assignments: proponent, opponent, judge.
 *
 * Flow:
 * 1. Round 1: Proponent presents arguments
 * 2. Round 2: Opponent responds with counter-arguments
 * 3. Round 3+: Rebuttals (alternating)
 * 4. Final: Judge evaluates and declares winner
 */

import type { DiscussionRound, DebateRole } from '@defai.digital/contracts';
import { getErrorMessage } from '@defai.digital/contracts';
import type {
  PatternExecutor,
  PatternExecutionContext,
  PatternExecutionResult,
} from '../types.js';
import {
  DEBATE_PROPONENT,
  DEBATE_OPPONENT,
  DEBATE_REBUTTAL,
  interpolate,
  getProviderSystemPrompt,
} from '../prompts/templates.js';

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

export class DebatePattern implements PatternExecutor {
  readonly pattern = 'debate' as const;

  async execute(context: PatternExecutionContext): Promise<PatternExecutionResult> {
    const startTime = Date.now();
    const { config, providerExecutor, availableProviders, abortSignal, onProgress } = context;

    // Validate roles are assigned
    if (!config.roles) {
      return {
        rounds: [],
        participatingProviders: [],
        failedProviders: [],
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: 'Debate pattern requires role assignments',
      };
    }

    const rounds: DiscussionRound[] = [];
    const participatingProviders = new Set<string>();
    const failedProviders = new Set<string>();

    // Get role assignments
    const proponentId = this.findProviderByRole(config.roles, 'proponent');
    const opponentId = this.findProviderByRole(config.roles, 'opponent');
    const judgeId = this.findProviderByRole(config.roles, 'judge');

    if (!proponentId || !opponentId) {
      return {
        rounds: [],
        participatingProviders: [],
        failedProviders: [],
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: 'Debate requires proponent and opponent roles',
      };
    }

    // Check availability
    const requiredProviders = [proponentId, opponentId, judgeId].filter(Boolean) as string[];
    const unavailable = requiredProviders.filter(p => !availableProviders.includes(p));
    if (unavailable.length > 0) {
      return {
        rounds: [],
        participatingProviders: [],
        failedProviders: unavailable,
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: `Required providers unavailable: ${unavailable.join(', ')}`,
      };
    }

    let proponentArguments = '';
    let opponentArguments = '';

    // Round 1: Proponent's opening arguments
    onProgress?.({
      type: 'round_start',
      round: 1,
      message: 'Proponent presenting opening arguments',
      timestamp: new Date().toISOString(),
    });

    const round1 = await this.executeDebateRound(
      1,
      proponentId,
      'proponent',
      config,
      providerExecutor,
      interpolate(DEBATE_PROPONENT, {
        topic: config.prompt,
        context: config.context || '',
      }),
      abortSignal,
      onProgress
    );

    rounds.push(round1.round);
    if (round1.success) {
      participatingProviders.add(proponentId);
      proponentArguments = round1.content;
    } else {
      failedProviders.add(proponentId);
      return {
        rounds,
        participatingProviders: Array.from(participatingProviders),
        failedProviders: Array.from(failedProviders),
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: 'Proponent failed to present arguments',
      };
    }

    // Round 2: Opponent's counter-arguments
    onProgress?.({
      type: 'round_start',
      round: 2,
      message: 'Opponent presenting counter-arguments',
      timestamp: new Date().toISOString(),
    });

    const round2 = await this.executeDebateRound(
      2,
      opponentId,
      'opponent',
      config,
      providerExecutor,
      interpolate(DEBATE_OPPONENT, {
        topic: config.prompt,
        context: config.context || '',
        proponentArguments,
      }),
      abortSignal,
      onProgress
    );

    rounds.push(round2.round);
    if (round2.success) {
      participatingProviders.add(opponentId);
      opponentArguments = round2.content;
    } else {
      failedProviders.add(opponentId);
      return {
        rounds,
        participatingProviders: Array.from(participatingProviders),
        failedProviders: Array.from(failedProviders),
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: 'Opponent failed to present counter-arguments',
      };
    }

    // Additional rounds for rebuttals
    if (config.rounds > 2) {
      // Proponent rebuttal
      onProgress?.({
        type: 'round_start',
        round: 3,
        message: 'Proponent rebuttal',
        timestamp: new Date().toISOString(),
      });

      const round3 = await this.executeDebateRound(
        3,
        proponentId,
        'proponent',
        config,
        providerExecutor,
        interpolate(DEBATE_REBUTTAL, {
          topic: config.prompt,
          proponentArguments,
          opponentArguments,
          role: 'PROPONENT',
        }),
        abortSignal,
        onProgress
      );

      rounds.push(round3.round);

      // Opponent rebuttal
      if (config.rounds > 3) {
        onProgress?.({
          type: 'round_start',
          round: 4,
          message: 'Opponent rebuttal',
          timestamp: new Date().toISOString(),
        });

        const round4 = await this.executeDebateRound(
          4,
          opponentId,
          'opponent',
          config,
          providerExecutor,
          interpolate(DEBATE_REBUTTAL, {
            topic: config.prompt,
            proponentArguments,
            opponentArguments,
            role: 'OPPONENT',
          }),
          abortSignal,
          onProgress
        );

        rounds.push(round4.round);
      }
    }

    // Add judge if present (they participate but don't contribute rounds until consensus)
    if (judgeId && availableProviders.includes(judgeId)) {
      participatingProviders.add(judgeId);
    }

    return {
      rounds,
      participatingProviders: Array.from(participatingProviders),
      failedProviders: Array.from(failedProviders),
      totalDurationMs: Date.now() - startTime,
      success: participatingProviders.size >= 2,
    };
  }

  private findProviderByRole(
    roles: Record<string, DebateRole>,
    targetRole: DebateRole
  ): string | undefined {
    return Object.entries(roles).find(([_, role]) => role === targetRole)?.[0];
  }

  private async executeDebateRound(
    roundNum: number,
    providerId: string,
    role: DebateRole,
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    prompt: string,
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; success: boolean; content: string }> {
    const roundStart = Date.now();

    onProgress?.({
      type: 'provider_start',
      round: roundNum,
      provider: providerId,
      timestamp: new Date().toISOString(),
    });

    try {
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
        role,
        timestamp: new Date().toISOString(),
        durationMs: result.durationMs,
        tokenCount: result.tokenCount,
        error: result.success ? undefined : result.error,
      };

      onProgress?.({
        type: 'provider_complete',
        round: roundNum,
        provider: providerId,
        message: result.success ? 'completed' : `failed: ${result.error}`,
        timestamp: new Date().toISOString(),
      });

      onProgress?.({
        type: 'round_complete',
        round: roundNum,
        timestamp: new Date().toISOString(),
      });

      return {
        round: {
          roundNumber: roundNum,
          responses: [response],
          durationMs: Date.now() - roundStart,
        },
        success: result.success,
        content: result.content || '',
      };

    } catch (error) {
      return {
        round: {
          roundNumber: roundNum,
          responses: [{
            provider: providerId,
            content: '',
            round: roundNum,
            role,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - roundStart,
            error: getErrorMessage(error),
          }],
          durationMs: Date.now() - roundStart,
        },
        success: false,
        content: '',
      };
    }
  }
}
