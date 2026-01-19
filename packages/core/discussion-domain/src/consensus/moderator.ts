/**
 * Moderator Consensus Executor
 *
 * A designated moderator evaluates all perspectives and makes a final decision.
 * Used primarily in debate pattern where the judge renders a verdict.
 */

import { DEFAULT_CONSENSUS_TIMEOUT, type DissentRecord, getErrorMessage } from '@defai.digital/contracts';
import type { ConsensusExecutor, ConsensusExecutionContext, ConsensusExecutionResult } from '../types.js';
import {
  DEBATE_JUDGE,
  interpolate,
  getProviderSystemPrompt,
} from '../prompts/templates.js';

export class ModeratorConsensus implements ConsensusExecutor {
  readonly method = 'moderator' as const;

  async execute(context: ConsensusExecutionContext): Promise<ConsensusExecutionResult> {
    const startTime = Date.now();
    const { topic, rounds, participatingProviders, config, providerExecutor, abortSignal, onProgress } = context;

    // Moderator is required for this method
    const moderatorId = config.synthesizer;
    if (!moderatorId) {
      return {
        synthesis: '',
        consensus: {
          method: 'moderator',
        },
        durationMs: Date.now() - startTime,
        success: false,
        error: 'Moderator method requires synthesizer to be specified',
      };
    }

    onProgress?.({
      type: 'synthesis_start',
      provider: moderatorId,
      message: `${moderatorId} moderating discussion`,
      timestamp: new Date().toISOString(),
    });

    // Extract debate-specific content if available
    const debateContent = this.extractDebateContent(rounds);

    // Build moderator prompt
    const prompt = this.buildModeratorPrompt(topic, rounds, debateContent);

    try {
      const result = await providerExecutor.execute({
        providerId: moderatorId,
        prompt,
        systemPrompt: getProviderSystemPrompt(moderatorId),
        temperature: 0.5, // Lower temperature for more consistent judgment
        timeoutMs: DEFAULT_CONSENSUS_TIMEOUT, // Moderation needs time (3 min default)
        abortSignal,
      });

      onProgress?.({
        type: 'synthesis_complete',
        provider: moderatorId,
        message: result.success ? 'Moderation complete' : `Moderation failed: ${result.error}`,
        timestamp: new Date().toISOString(),
        // Extended fields for Phase 2 tracing
        success: result.success,
        durationMs: result.durationMs,
        tokenCount: result.tokenCount,
        error: result.success ? undefined : result.error,
      });

      if (!result.success) {
        return {
          synthesis: '',
          consensus: {
            method: 'moderator',
            synthesizer: moderatorId,
          },
          durationMs: Date.now() - startTime,
          success: false,
          error: result.error || 'Moderation failed',
        };
      }

      // Analyze moderator decision
      const analysis = this.analyzeModeratorDecision(result.content || '', participatingProviders);
      const consensusDurationMs = Date.now() - startTime;

      // Emit consensus_complete event for Phase 2 tracing
      onProgress?.({
        type: 'consensus_complete',
        message: 'Moderator consensus reached',
        timestamp: new Date().toISOString(),
        success: true,
        consensusMethod: 'moderator',
        confidence: analysis.agreementScore,
        durationMs: consensusDurationMs,
      });

      return {
        synthesis: result.content || '',
        consensus: {
          method: 'moderator',
          synthesizer: moderatorId,
          agreementScore: analysis.agreementScore,
          agreements: analysis.agreements,
          dissent: config.includeDissent ? analysis.dissent : undefined,
        },
        durationMs: consensusDurationMs,
        success: true,
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);

      onProgress?.({
        type: 'synthesis_complete',
        provider: moderatorId,
        message: `Moderation error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });

      return {
        synthesis: '',
        consensus: {
          method: 'moderator',
          synthesizer: moderatorId,
        },
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMessage,
      };
    }
  }

  private extractDebateContent(rounds: ConsensusExecutionContext['rounds']): {
    proponentArguments: string;
    opponentArguments: string;
    proponentRebuttal: string;
    opponentRebuttal: string;
  } {
    let proponentArguments = '';
    let opponentArguments = '';
    let proponentRebuttal = '';
    let opponentRebuttal = '';

    for (const round of rounds) {
      for (const response of round.responses) {
        if (response.role === 'proponent') {
          if (!proponentArguments) {
            proponentArguments = response.content;
          } else {
            proponentRebuttal = response.content;
          }
        } else if (response.role === 'opponent') {
          if (!opponentArguments) {
            opponentArguments = response.content;
          } else {
            opponentRebuttal = response.content;
          }
        }
      }
    }

    return { proponentArguments, opponentArguments, proponentRebuttal, opponentRebuttal };
  }

  private buildModeratorPrompt(
    topic: string,
    rounds: ConsensusExecutionContext['rounds'],
    debateContent: { proponentArguments: string; opponentArguments: string; proponentRebuttal: string; opponentRebuttal: string }
  ): string {
    // If this looks like a debate (has proponent/opponent), use debate judge template
    if (debateContent.proponentArguments && debateContent.opponentArguments) {
      return interpolate(DEBATE_JUDGE, {
        topic,
        proponentArguments: debateContent.proponentArguments,
        opponentArguments: debateContent.opponentArguments,
        proponentRebuttal: debateContent.proponentRebuttal || 'No rebuttal provided.',
        opponentRebuttal: debateContent.opponentRebuttal || 'No rebuttal provided.',
      });
    }

    // Otherwise, build a general moderation prompt
    const allPerspectives = rounds.flatMap(round =>
      round.responses.map(r => `### ${r.provider}\n${r.content}`)
    ).join('\n\n');

    return `You are moderating a discussion on the following topic:

## Topic
${topic}

## All Perspectives

${allPerspectives}

## Your Task as Moderator

1. **Summary**: Summarize the key points from all participants
2. **Evaluation**: Assess the quality and validity of each perspective
3. **Common Ground**: Identify areas where participants agree
4. **Differences**: Note significant disagreements and their reasoning
5. **Decision**: Provide your moderated conclusion
6. **Recommendations**: Offer actionable next steps

Be fair, balanced, and thorough in your moderation.`;
  }

  private analyzeModeratorDecision(
    decision: string,
    _providers: string[]
  ): { agreementScore: number; agreements: string[]; dissent: DissentRecord[] } {
    const agreements: string[] = [];
    const dissent: DissentRecord[] = [];

    // Look for winner declaration in debate context
    const winnerMatch = /winner[:\s]+(\w+)|(\w+)\s+(?:wins?|prevails?|presents?\s+the\s+stronger\s+case)/i.exec(decision);
    if (winnerMatch) {
      const winner = winnerMatch[1] || winnerMatch[2];
      agreements.push(`Moderator determined ${winner} presented the stronger argument`);
    }

    // Look for common ground section
    const commonGroundMatch = /common\s+ground[:\s]*([^#]+?)(?=##|$)/is.exec(decision);
    if (commonGroundMatch?.[1]) {
      const bullets = commonGroundMatch[1].match(/[-•*]\s*([^\n]+)/g);
      if (bullets) {
        agreements.push(...bullets.map(b => b.replace(/^[-•*]\s*/, '').trim()));
      }
    }

    // Look for disagreement mentions
    const disagreementMatch = /(?:key\s+)?(?:difference|disagreement)s?[:\s]*([^#]+?)(?=##|$)/is.exec(decision);
    if (disagreementMatch?.[1]) {
      const bullets = disagreementMatch[1].match(/[-•*]\s*([^\n]+)/g);
      if (bullets && bullets.length > 0) {
        dissent.push({
          provider: 'general',
          position: 'Key areas of disagreement identified',
          keyPoints: bullets.map(b => b.replace(/^[-•*]\s*/, '').trim()),
        });
      }
    }

    // Calculate agreement score
    // Higher score if there's a clear winner or strong common ground
    const hasWinner = !!winnerMatch;
    const agreementCount = agreements.length;
    const dissentCount = dissent.reduce((acc, d) => acc + (d.keyPoints?.length || 1), 0);

    let agreementScore = 0.5; // Base score
    if (hasWinner) agreementScore += 0.2;
    if (agreementCount > dissentCount) agreementScore += 0.2;
    agreementScore = Math.min(1, agreementScore);

    return { agreementScore, agreements, dissent };
  }
}
