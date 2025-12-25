/**
 * Voting Consensus Executor
 *
 * Tallies votes from all providers and determines winner based on
 * raw counts or confidence-weighted scores.
 *
 * Invariants:
 * - INV-DISC-642: Agent responses weighted by agentWeightMultiplier (default 1.5x)
 */

import { DEFAULT_AGENT_WEIGHT_MULTIPLIER, type VotingResults, type VoteRecord } from '@defai.digital/contracts';
import type { ConsensusExecutor, ConsensusExecutionContext, ConsensusExecutionResult } from '../types.js';
import {
  VOTING_TALLY,
  interpolate,
  formatVotes,
  getProviderSystemPrompt,
} from '../prompts/templates.js';

/**
 * Default agent weight multiplier (INV-DISC-642)
 * Uses constant from contracts for single source of truth
 */
const DEFAULT_AGENT_WEIGHT = DEFAULT_AGENT_WEIGHT_MULTIPLIER;

export class VotingConsensus implements ConsensusExecutor {
  readonly method = 'voting' as const;

  async execute(context: ConsensusExecutionContext): Promise<ConsensusExecutionResult> {
    const startTime = Date.now();
    const { topic, rounds, participatingProviders, config, providerExecutor, abortSignal, onProgress } = context;

    // Extract votes from round responses
    const votes = this.extractVotes(rounds);

    if (votes.length === 0) {
      return {
        synthesis: 'No valid votes were cast.',
        consensus: {
          method: 'voting',
        },
        durationMs: Date.now() - startTime,
        success: false,
        error: 'No valid votes found in discussion rounds',
      };
    }

    // Tally votes with agent weight multiplier (INV-DISC-642)
    const votingResults = this.tallyVotes(votes, context.agentWeightMultiplier);

    // Generate synthesis summary
    const synthesizerId = config.synthesizer ||
      (participatingProviders.includes('claude') ? 'claude' : participatingProviders[0]) ||
      'claude';

    onProgress?.({
      type: 'synthesis_start',
      provider: synthesizerId,
      message: 'Generating vote summary',
      timestamp: new Date().toISOString(),
    });

    const synthesis = await this.generateVoteSummary(
      topic,
      votingResults,
      synthesizerId,
      providerExecutor,
      abortSignal,
      onProgress
    );

    return {
      synthesis,
      consensus: {
        method: 'voting',
        synthesizer: synthesizerId,
        agreementScore: votingResults.unanimous ? 1.0 : votingResults.margin,
      },
      votingResults,
      durationMs: Date.now() - startTime,
      success: true,
    };
  }

  private extractVotes(rounds: ConsensusExecutionContext['rounds']): Array<VoteRecord & { isAgent: boolean }> {
    const votes: Array<VoteRecord & { isAgent: boolean }> = [];

    for (const round of rounds) {
      for (const response of round.responses) {
        if (response.vote && response.confidence !== undefined) {
          votes.push({
            provider: response.provider,
            choice: response.vote,
            confidence: response.confidence,
            reasoning: this.extractReasoning(response.content),
            isAgent: response.isAgent ?? false,
          });
        }
      }
    }

    return votes;
  }

  private extractReasoning(content: string): string {
    const reasoningMatch = /reasoning:\s*(.+?)(?=\n\n|$)/is.exec(content);
    return reasoningMatch?.[1] ? reasoningMatch[1].trim() : '';
  }

  private tallyVotes(
    votes: Array<VoteRecord & { isAgent: boolean }>,
    agentWeightMultiplier: number = DEFAULT_AGENT_WEIGHT
  ): VotingResults {
    // Count raw votes
    const rawVotes: Record<string, number> = {};
    const weightedVotes: Record<string, number> = {};

    for (const vote of votes) {
      // Apply agent weight multiplier (INV-DISC-642)
      const weight = vote.isAgent ? agentWeightMultiplier : 1.0;
      const weightedConfidence = vote.confidence * weight;

      rawVotes[vote.choice] = (rawVotes[vote.choice] || 0) + 1;
      weightedVotes[vote.choice] = (weightedVotes[vote.choice] || 0) + weightedConfidence;
    }

    // Determine winner (by weighted votes)
    let winner = '';
    let maxWeight = 0;
    let secondMaxWeight = 0;

    for (const [choice, weight] of Object.entries(weightedVotes)) {
      if (weight > maxWeight) {
        secondMaxWeight = maxWeight;
        maxWeight = weight;
        winner = choice;
      } else if (weight > secondMaxWeight) {
        secondMaxWeight = weight;
      }
    }

    // Calculate total weight
    const totalWeight = Object.values(weightedVotes).reduce((a, b) => a + b, 0);

    // Check if unanimous
    const uniqueChoices = new Set(votes.map(v => v.choice));
    const unanimous = uniqueChoices.size === 1;

    // Calculate margin
    const margin = totalWeight > 0 ? (maxWeight - secondMaxWeight) / totalWeight : 0;

    return {
      winner,
      votes: rawVotes,
      weightedVotes,
      voteRecords: votes,
      unanimous,
      margin,
    };
  }

  private async generateVoteSummary(
    topic: string,
    votingResults: VotingResults,
    synthesizerId: string,
    providerExecutor: ConsensusExecutionContext['providerExecutor'],
    abortSignal?: AbortSignal,
    onProgress?: ConsensusExecutionContext['onProgress']
  ): Promise<string> {
    // Build options list
    const options = Object.keys(votingResults.votes);

    // Build formatted votes
    const formattedVotes = formatVotes(votingResults.voteRecords);

    const prompt = interpolate(VOTING_TALLY, {
      topic,
      options: options.join(', '),
      votes: formattedVotes,
    });

    try {
      const result = await providerExecutor.execute({
        providerId: synthesizerId,
        prompt,
        systemPrompt: getProviderSystemPrompt(synthesizerId),
        temperature: 0.5,
        timeoutMs: 60000,
        abortSignal,
      });

      onProgress?.({
        type: 'synthesis_complete',
        provider: synthesizerId,
        timestamp: new Date().toISOString(),
      });

      if (result.success && result.content) {
        return result.content;
      }

      // Fallback to generated summary
      return this.generateFallbackSummary(votingResults);

    } catch {
      return this.generateFallbackSummary(votingResults);
    }
  }

  private generateFallbackSummary(votingResults: VotingResults): string {
    const { winner, votes, weightedVotes, unanimous, margin, voteRecords } = votingResults;

    let summary = `## Voting Results\n\n`;
    summary += `**Winner**: ${winner}\n\n`;

    if (unanimous) {
      summary += `The vote was **unanimous** - all providers agreed on ${winner}.\n\n`;
    } else {
      summary += `**Margin of victory**: ${(margin * 100).toFixed(1)}%\n\n`;
    }

    summary += `### Vote Breakdown\n\n`;
    for (const [choice, count] of Object.entries(votes)) {
      const weight = weightedVotes[choice] || 0;
      summary += `- **${choice}**: ${count} vote(s), weighted score: ${weight.toFixed(2)}\n`;
    }

    summary += `\n### Individual Votes\n\n`;
    for (const record of voteRecords) {
      summary += `- **${record.provider}**: ${record.choice} (${(record.confidence * 100).toFixed(0)}% confidence)\n`;
      if (record.reasoning) {
        summary += `  - Reasoning: ${record.reasoning}\n`;
      }
    }

    return summary;
  }
}
