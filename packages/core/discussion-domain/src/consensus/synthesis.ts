/**
 * Synthesis Consensus Executor
 *
 * One model synthesizes all perspectives into a unified conclusion.
 * This is the default consensus method.
 */

import type { DissentRecord, DiscussionRound } from '@defai.digital/contracts';
import type { ConsensusExecutor, ConsensusExecutionContext, ConsensusExecutionResult } from '../types.js';
import {
  SYNTHESIS_FINAL,
  interpolate,
  formatPreviousResponses,
  getProviderSystemPrompt,
} from '../prompts/templates.js';

export class SynthesisConsensus implements ConsensusExecutor {
  readonly method = 'synthesis' as const;

  async execute(context: ConsensusExecutionContext): Promise<ConsensusExecutionResult> {
    const startTime = Date.now();
    const { topic, rounds, participatingProviders, config, providerExecutor, abortSignal, onProgress } = context;

    // Determine synthesizer (default to first participating provider or 'claude')
    const synthesizerId = config.synthesizer ||
      (participatingProviders.includes('claude') ? 'claude' : participatingProviders[0]) ||
      'claude';

    onProgress?.({
      type: 'synthesis_start',
      provider: synthesizerId,
      message: `${synthesizerId} synthesizing discussion`,
      timestamp: new Date().toISOString(),
    });

    // Build synthesis prompt with all round data
    const initialPerspectives = this.formatRoundPerspectives(rounds[0]);
    const crossDiscussion = rounds.slice(1).map((round, i) =>
      `### Round ${i + 2}\n${this.formatRoundPerspectives(round)}`
    ).join('\n\n');

    const prompt = interpolate(SYNTHESIS_FINAL, {
      topic,
      initialPerspectives,
      crossDiscussion: crossDiscussion || 'No cross-discussion rounds.',
    });

    try {
      const result = await providerExecutor.execute({
        providerId: synthesizerId,
        prompt,
        systemPrompt: getProviderSystemPrompt(synthesizerId),
        temperature: 0.7,
        timeoutMs: 90000, // Synthesis may take longer
        abortSignal,
      });

      onProgress?.({
        type: 'synthesis_complete',
        provider: synthesizerId,
        message: result.success ? 'Synthesis complete' : `Synthesis failed: ${result.error}`,
        timestamp: new Date().toISOString(),
      });

      if (!result.success) {
        return {
          synthesis: '',
          consensus: {
            method: 'synthesis',
            synthesizer: synthesizerId,
          },
          durationMs: Date.now() - startTime,
          success: false,
          error: result.error || 'Synthesis failed',
        };
      }

      // Extract agreement score and dissent from synthesis
      const analysisResult = this.analyzeSynthesis(result.content || '', participatingProviders);

      return {
        synthesis: result.content || '',
        consensus: {
          method: 'synthesis',
          synthesizer: synthesizerId,
          agreementScore: analysisResult.agreementScore,
          agreements: analysisResult.agreements,
          dissent: config.includeDissent ? analysisResult.dissent : undefined,
        },
        durationMs: Date.now() - startTime,
        success: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      onProgress?.({
        type: 'synthesis_complete',
        provider: synthesizerId,
        message: `Synthesis error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });

      return {
        synthesis: '',
        consensus: {
          method: 'synthesis',
          synthesizer: synthesizerId,
        },
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMessage,
      };
    }
  }

  private formatRoundPerspectives(round: DiscussionRound | undefined): string {
    if (!round?.responses) {
      return 'No responses in this round.';
    }

    return formatPreviousResponses(
      round.responses.map(r => ({
        provider: r.provider,
        content: r.content,
        role: r.role,
      }))
    );
  }

  private analyzeSynthesis(
    synthesis: string,
    providers: string[]
  ): { agreementScore: number; agreements: string[]; dissent: DissentRecord[] } {
    const agreements: string[] = [];
    const dissent: DissentRecord[] = [];

    // Look for agreement section
    const agreementMatch = /areas?\s+of\s+(?:strong\s+)?agreement[:\s]*([^#]+?)(?=##|$)/is.exec(synthesis);
    if (agreementMatch?.[1]) {
      const agreementText = agreementMatch[1];
      // Extract bullet points
      const bullets = agreementText.match(/[-•*]\s*([^\n]+)/g);
      if (bullets) {
        agreements.push(...bullets.map(b => b.replace(/^[-•*]\s*/, '').trim()));
      }
    }

    // Look for disagreement/dissent section
    const dissentMatch = /(?:key\s+)?disagreements?[:\s]*([^#]+?)(?=##|$)/is.exec(synthesis);
    if (dissentMatch?.[1]) {
      const dissentText = dissentMatch[1];

      // Try to extract provider-specific dissent
      for (const provider of providers) {
        const providerPattern = new RegExp(`${provider}[:\\s]+([^\\n]+)`, 'i');
        const match = dissentText.match(providerPattern);
        if (match?.[1]) {
          dissent.push({
            provider,
            position: match[1].trim(),
          });
        }
      }

      // If no provider-specific dissent found, create general entry
      if (dissent.length === 0 && dissentText.trim().length > 0) {
        const bullets = dissentText.match(/[-•*]\s*([^\n]+)/g);
        if (bullets && bullets.length > 0) {
          dissent.push({
            provider: 'general',
            position: 'Areas of disagreement noted',
            keyPoints: bullets.map(b => b.replace(/^[-•*]\s*/, '').trim()),
          });
        }
      }
    }

    // Calculate agreement score based on content analysis
    const agreementScore = this.calculateAgreementScore(synthesis, agreements.length, dissent.length);

    return { agreementScore, agreements, dissent };
  }

  private calculateAgreementScore(synthesis: string, agreementCount: number, dissentCount: number): number {
    // Base score from ratio of agreements to total points
    const totalPoints = agreementCount + dissentCount;
    if (totalPoints === 0) {
      return 0.7; // Default moderate agreement
    }

    const ratioScore = agreementCount / totalPoints;

    // Adjust based on sentiment indicators in text
    const strongAgreementIndicators = (synthesis.match(/unanimous|all\s+(?:models?\s+)?agree|consensus|strong\s+agreement/gi) || []).length;
    const disagreementIndicators = (synthesis.match(/disagree|conflict|diverge|oppose|contrary/gi) || []).length;

    const sentimentAdjustment = (strongAgreementIndicators * 0.1) - (disagreementIndicators * 0.05);

    return Math.max(0, Math.min(1, ratioScore + sentimentAdjustment));
  }
}
