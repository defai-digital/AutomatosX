/**
 * Voting Pattern Executor
 *
 * Each model evaluates options and votes with confidence scores.
 *
 * Flow:
 * 1. Each provider evaluates all options in parallel
 * 2. Votes are collected with confidence scores
 * 3. Results are tallied (raw and confidence-weighted)
 */

import type { DiscussionRound, DebateRole } from '@defai.digital/contracts';
import type {
  PatternExecutor,
  PatternExecutionContext,
  PatternExecutionResult,
} from '../types.js';
import {
  VOTING_EVALUATE,
  interpolate,
  formatVotingOptions,
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

export class VotingPattern implements PatternExecutor {
  readonly pattern = 'voting' as const;

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

    // Extract options from prompt (look for numbered list or explicit options)
    const options = this.extractOptions(config.prompt);

    // Round 1: All providers vote in parallel
    onProgress?.({
      type: 'round_start',
      round: 1,
      message: 'Providers evaluating options and voting',
      timestamp: new Date().toISOString(),
    });

    const votingRound = await this.executeVotingRound(
      1,
      providers,
      options,
      config,
      providerExecutor,
      abortSignal,
      onProgress
    );

    rounds.push(votingRound.round);
    votingRound.succeeded.forEach(p => participatingProviders.add(p));
    votingRound.failed.forEach(p => failedProviders.add(p));

    onProgress?.({
      type: 'round_complete',
      round: 1,
      message: `Collected ${votingRound.succeeded.length} votes`,
      timestamp: new Date().toISOString(),
    });

    return {
      rounds,
      participatingProviders: Array.from(participatingProviders),
      failedProviders: Array.from(failedProviders),
      totalDurationMs: Date.now() - startTime,
      success: participatingProviders.size >= config.minProviders,
    };
  }

  private extractOptions(prompt: string): string[] {
    // Try to extract numbered options (1. Option, 2. Option, etc.)
    const numberedPattern = /^\d+\.\s*(.+)$/gm;
    const matches = [...prompt.matchAll(numberedPattern)];

    if (matches.length >= 2) {
      return matches.map(m => m[1] ? m[1].trim() : '').filter(Boolean);
    }

    // Try to extract from "Options: A, B, C" format
    const optionsMatch = /options?:\s*(.+?)(?:\n|$)/i.exec(prompt);
    if (optionsMatch?.[1]) {
      return optionsMatch[1].split(/[,;]/).map(o => o.trim()).filter(Boolean);
    }

    // Default: create Yes/No options
    return ['Yes', 'No'];
  }

  private async executeVotingRound(
    roundNum: number,
    providers: string[],
    options: string[],
    config: PatternExecutionContext['config'],
    providerExecutor: PatternExecutionContext['providerExecutor'],
    abortSignal?: AbortSignal,
    onProgress?: PatternExecutionContext['onProgress']
  ): Promise<{ round: DiscussionRound; succeeded: string[]; failed: string[] }> {
    const roundStart = Date.now();
    const succeeded: string[] = [];
    const failed: string[] = [];

    const formattedOptions = formatVotingOptions(options);
    const prompt = interpolate(VOTING_EVALUATE, {
      topic: config.prompt,
      options: formattedOptions,
      context: config.context || '',
    });

    // Execute all votes in parallel
    const promises = providers.map(async (providerId) => {
      if (abortSignal?.aborted) return null;

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
          prompt,
          systemPrompt: getProviderSystemPrompt(providerId),
          temperature: config.temperature,
          timeoutMs: config.providerTimeout,
          abortSignal,
        });

        // Parse vote from response
        const vote = result.success ? this.parseVote(result.content || '', options) : null;

        const response: DiscussionProviderResponse = {
          provider: providerId,
          content: result.success ? result.content || '' : '',
          round: roundNum,
          timestamp: new Date().toISOString(),
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          confidence: vote?.confidence,
          vote: vote?.choice,
          error: result.success ? undefined : result.error,
        };

        if (result.success && vote) {
          succeeded.push(providerId);
        } else {
          failed.push(providerId);
        }

        onProgress?.({
          type: 'provider_complete',
          round: roundNum,
          provider: providerId,
          message: vote ? `Voted: ${vote.choice} (${Math.round(vote.confidence * 100)}%)` : 'failed',
          timestamp: new Date().toISOString(),
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

  private parseVote(
    content: string,
    options: string[]
  ): { choice: string; confidence: number; reasoning?: string | undefined } | null {
    // Try to find "Your Vote: [option]" pattern
    const voteMatch = /your vote:\s*\[?([^\]\n]+)\]?/i.exec(content);
    const choice = voteMatch?.[1] ? voteMatch[1].trim() : null;

    // Try to find confidence pattern
    const confidenceMatch = /confidence:\s*\[?(\d+)%?\]?/i.exec(content);
    const confidence = confidenceMatch?.[1] ? parseInt(confidenceMatch[1], 10) / 100 : 0.5;

    // Try to find reasoning
    const reasoningMatch = /reasoning:\s*(.+?)(?=\n\n|$)/is.exec(content);
    const reasoning = reasoningMatch?.[1] ? reasoningMatch[1].trim() : undefined;

    if (!choice) {
      // Try to find which option is mentioned most prominently
      for (const option of options) {
        if (content.toLowerCase().includes(option.toLowerCase())) {
          return { choice: option, confidence: Math.min(confidence, 0.7), reasoning };
        }
      }
      return null;
    }

    // Normalize choice to match options
    const normalizedChoice = options.find(
      o => o.toLowerCase() === choice.toLowerCase() ||
           choice.toLowerCase().includes(o.toLowerCase())
    ) || choice;

    return {
      choice: normalizedChoice,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning,
    };
  }
}
