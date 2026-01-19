/**
 * Critique Pattern Executor
 *
 * One model proposes, others critique, author refines.
 *
 * Flow:
 * 1. Round 1: First provider proposes solution
 * 2. Round 2: Other providers critique the proposal
 * 3. Round 3: Original proposer revises based on feedback
 * 4. (Optional) Additional critique-revision cycles
 */

import type { DiscussionRound, DebateRole } from '@defai.digital/contracts';
import { getErrorMessage } from '@defai.digital/contracts';
import type {
  PatternExecutor,
  PatternExecutionContext,
  PatternExecutionResult,
} from '../types.js';
import {
  CRITIQUE_PROPOSAL,
  CRITIQUE_REVIEW,
  CRITIQUE_REVISION,
  interpolate,
  formatPreviousResponses,
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

export class CritiquePattern implements PatternExecutor {
  readonly pattern = 'critique' as const;

  async execute(context: PatternExecutionContext): Promise<PatternExecutionResult> {
    const startTime = Date.now();
    const { config, providerExecutor, availableProviders, abortSignal, onProgress } = context;

    const rounds: DiscussionRound[] = [];
    const participatingProviders = new Set<string>();
    const failedProviders = new Set<string>();

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

    // First provider is the proposer (guaranteed to exist since we checked providers.length >= minProviders)
    const proposerId = providers[0]!;
    const critiquers = providers.slice(1);

    let currentProposal = '';

    // Round 1: Initial proposal
    onProgress?.({
      type: 'round_start',
      round: 1,
      message: `${proposerId} creating initial proposal`,
      timestamp: new Date().toISOString(),
    });

    const proposalRound = await this.executeProposalRound(
      1,
      proposerId,
      config,
      providerExecutor,
      abortSignal,
      onProgress
    );

    rounds.push(proposalRound.round);
    if (proposalRound.success) {
      participatingProviders.add(proposerId);
      currentProposal = proposalRound.content;
    } else {
      failedProviders.add(proposerId);
      return {
        rounds,
        participatingProviders: Array.from(participatingProviders),
        failedProviders: Array.from(failedProviders),
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: 'Proposer failed to create initial proposal',
      };
    }

    // Critique-Revision cycles
    const cycles = Math.floor((config.rounds - 1) / 2);
    let allCritiques: DiscussionProviderResponse[] = [];

    for (let cycle = 0; cycle < cycles; cycle++) {
      if (abortSignal?.aborted) break;

      const critiqueRoundNum = 2 + cycle * 2;
      const revisionRoundNum = critiqueRoundNum + 1;

      // Critique round
      onProgress?.({
        type: 'round_start',
        round: critiqueRoundNum,
        message: 'Gathering critiques',
        timestamp: new Date().toISOString(),
      });

      const critiqueRound = await this.executeCritiqueRound(
        critiqueRoundNum,
        critiquers.filter(c => !failedProviders.has(c)),
        currentProposal,
        config,
        providerExecutor,
        abortSignal,
        onProgress
      );

      rounds.push(critiqueRound.round);
      critiqueRound.succeeded.forEach(p => participatingProviders.add(p));
      critiqueRound.failed.forEach(p => failedProviders.add(p));
      allCritiques = critiqueRound.round.responses;

      onProgress?.({
        type: 'round_complete',
        round: critiqueRoundNum,
        message: `Received ${critiqueRound.succeeded.length} critiques`,
        timestamp: new Date().toISOString(),
      });

      // Check if we have enough critiques
      if (critiqueRound.succeeded.length === 0) {
        break; // No valid critiques to incorporate
      }

      // Revision round
      if (revisionRoundNum <= config.rounds) {
        onProgress?.({
          type: 'round_start',
          round: revisionRoundNum,
          message: `${proposerId} revising proposal`,
          timestamp: new Date().toISOString(),
        });

        const revisionRound = await this.executeRevisionRound(
          revisionRoundNum,
          proposerId,
          currentProposal,
          allCritiques,
          config,
          providerExecutor,
          abortSignal,
          onProgress
        );

        rounds.push(revisionRound.round);
        if (revisionRound.success) {
          currentProposal = revisionRound.content;
        }

        onProgress?.({
          type: 'round_complete',
          round: revisionRoundNum,
          message: 'Proposal revised',
          timestamp: new Date().toISOString(),
        });
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

  private async executeProposalRound(
    roundNum: number,
    proposerId: string,
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; success: boolean; content: string }> {
    const roundStart = Date.now();

    onProgress?.({
      type: 'provider_start',
      round: roundNum,
      provider: proposerId,
      timestamp: new Date().toISOString(),
    });

    try {
      const prompt = interpolate(CRITIQUE_PROPOSAL, {
        topic: config.prompt,
        context: config.context || '',
      });

      const result = await providerExecutor.execute({
        providerId: proposerId,
        prompt,
        systemPrompt: getProviderSystemPrompt(proposerId),
        temperature: config.temperature,
        timeoutMs: config.providerTimeout,
        abortSignal,
      });

      const response: DiscussionProviderResponse = {
        provider: proposerId,
        content: result.success ? result.content || '' : '',
        round: roundNum,
        timestamp: new Date().toISOString(),
        durationMs: result.durationMs,
        tokenCount: result.tokenCount,
        error: result.success ? undefined : result.error,
      };

      onProgress?.({
        type: 'provider_complete',
        round: roundNum,
        provider: proposerId,
        timestamp: new Date().toISOString(),
        // Extended fields for trace visibility
        success: result.success,
        durationMs: result.durationMs,
        tokenCount: result.tokenCount,
        error: result.success ? undefined : result.error,
        content: result.success ? result.content : undefined,
        prompt,
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
      const errorMessage = getErrorMessage(error);

      return {
        round: {
          roundNumber: roundNum,
          responses: [{
            provider: proposerId,
            content: '',
            round: roundNum,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - roundStart,
            error: errorMessage,
          }],
          durationMs: Date.now() - roundStart,
        },
        success: false,
        content: '',
      };
    }
  }

  private async executeCritiqueRound(
    roundNum: number,
    critiquers: string[],
    proposal: string,
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; succeeded: string[]; failed: string[] }> {
    const roundStart = Date.now();
    const succeeded: string[] = [];
    const failed: string[] = [];

    const prompt = interpolate(CRITIQUE_REVIEW, {
      topic: config.prompt,
      proposal,
    });

    // Execute critiques in parallel
    const promises = critiquers.map(async (critiquerId) => {
      if (abortSignal?.aborted) return null;

      onProgress?.({
        type: 'provider_start',
        round: roundNum,
        provider: critiquerId,
        timestamp: new Date().toISOString(),
      });

      const responseStart = Date.now();

      try {
        const result = await providerExecutor.execute({
          providerId: critiquerId,
          prompt,
          systemPrompt: getProviderSystemPrompt(critiquerId),
          temperature: config.temperature,
          timeoutMs: config.providerTimeout,
          abortSignal,
        });

        if (result.success) {
          succeeded.push(critiquerId);
        } else {
          failed.push(critiquerId);
        }

        onProgress?.({
          type: 'provider_complete',
          round: roundNum,
          provider: critiquerId,
          timestamp: new Date().toISOString(),
          // Extended fields for trace visibility
          success: result.success,
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          error: result.success ? undefined : result.error,
          content: result.success ? result.content : undefined,
          prompt,
        });

        return {
          provider: critiquerId,
          content: result.success ? result.content || '' : '',
          round: roundNum,
          timestamp: new Date().toISOString(),
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          error: result.success ? undefined : result.error,
        } as DiscussionProviderResponse;

      } catch (error) {
        const errorMessage = getErrorMessage(error);
        failed.push(critiquerId);

        return {
          provider: critiquerId,
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

  private async executeRevisionRound(
    roundNum: number,
    proposerId: string,
    originalProposal: string,
    critiques: DiscussionProviderResponse[],
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; success: boolean; content: string }> {
    const roundStart = Date.now();

    onProgress?.({
      type: 'provider_start',
      round: roundNum,
      provider: proposerId,
      timestamp: new Date().toISOString(),
    });

    try {
      const formattedCritiques = formatPreviousResponses(
        critiques.map(c => ({
          provider: c.provider,
          content: c.content,
        }))
      );

      const prompt = interpolate(CRITIQUE_REVISION, {
        topic: config.prompt,
        originalProposal,
        critiques: formattedCritiques,
      });

      const result = await providerExecutor.execute({
        providerId: proposerId,
        prompt,
        systemPrompt: getProviderSystemPrompt(proposerId),
        temperature: config.temperature,
        timeoutMs: config.providerTimeout,
        abortSignal,
      });

      const response: DiscussionProviderResponse = {
        provider: proposerId,
        content: result.success ? result.content || '' : '',
        round: roundNum,
        timestamp: new Date().toISOString(),
        durationMs: result.durationMs,
        tokenCount: result.tokenCount,
        error: result.success ? undefined : result.error,
      };

      onProgress?.({
        type: 'provider_complete',
        round: roundNum,
        provider: proposerId,
        timestamp: new Date().toISOString(),
        // Extended fields for trace visibility
        success: result.success,
        durationMs: result.durationMs,
        tokenCount: result.tokenCount,
        error: result.success ? undefined : result.error,
        content: result.success ? result.content : undefined,
        prompt,
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
      const errorMessage = getErrorMessage(error);

      return {
        round: {
          roundNumber: roundNum,
          responses: [{
            provider: proposerId,
            content: '',
            round: roundNum,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - roundStart,
            error: errorMessage,
          }],
          durationMs: Date.now() - roundStart,
        },
        success: false,
        content: '',
      };
    }
  }
}
