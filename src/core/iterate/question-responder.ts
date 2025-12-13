/**
 * LLM-Powered Question Responder for Iterate Mode
 *
 * Answers technical questions during autonomous iterate mode execution.
 * Uses blocklist patterns to ensure sensitive questions still pause for user.
 *
 * @module core/iterate/question-responder
 * @since v12.9.0
 */

import type {
  QuestionResponderConfig,
  QuestionContext,
  QuestionAnswer,
  QuestionResponderStats
} from '../../types/iterate.js';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { appendFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Default system prompt for question answering
 */
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant helping answer technical questions during an automated coding session.

INSTRUCTIONS:
1. Provide a concise, direct answer (1-3 sentences maximum)
2. Focus on practical, safe, industry-standard choices
3. When unsure between options, prefer the simpler/safer option
4. If the question requires human judgment (business decisions, credentials, destructive actions), respond EXACTLY with: PAUSE_REQUIRED
5. Do not ask follow-up questions - give your best answer or PAUSE_REQUIRED

CONTEXT:
- Task: {{task}}
- Agent: {{agent}}

QUESTION:
{{question}}

ANSWER:`;

/**
 * Provider executor function type
 * Allows dependency injection for testing
 */
export type ProviderExecutor = (request: ExecutionRequest) => Promise<ExecutionResponse>;

/**
 * QuestionResponder - LLM-powered question answering for iterate mode
 *
 * @example
 * ```typescript
 * const responder = new QuestionResponder(config, providerExecutor, sessionId);
 *
 * if (!responder.mustPause(question)) {
 *   const answer = await responder.answer(context);
 *   if (answer) {
 *     // Use the auto-generated answer
 *   }
 * }
 * ```
 */
export class QuestionResponder {
  private config: QuestionResponderConfig;
  private executor: ProviderExecutor;
  private compiledPatterns: RegExp[] = [];
  private stats: QuestionResponderStats;
  private sessionId: string;
  private logPath: string;
  private confidenceAccumulator: number = 0;
  private latencyAccumulator: number = 0;

  constructor(
    config: QuestionResponderConfig,
    executor: ProviderExecutor,
    sessionId: string,
    logDir: string = '.automatosx/logs'
  ) {
    this.config = config;
    this.executor = executor;
    this.sessionId = sessionId;
    this.logPath = `${logDir}/question-responder-${sessionId}.jsonl`;

    // Initialize stats
    this.stats = {
      totalQuestions: 0,
      autoAnswered: 0,
      pausedForUser: 0,
      blockedByPattern: 0,
      belowThreshold: 0,
      tokensUsed: 0,
      avgConfidence: 0,
      avgLatencyMs: 0
    };

    // Compile must-pause patterns
    this.compilePatterns();

    logger.debug('QuestionResponder initialized', {
      provider: config.provider,
      confidenceThreshold: config.confidenceThreshold,
      patternCount: this.compiledPatterns.length,
      maxAutoAnswers: config.maxAutoAnswers
    });
  }

  /**
   * Check if feature is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if question must pause (matches blocklist)
   */
  mustPause(question: string): boolean {
    for (const pattern of this.compiledPatterns) {
      if (pattern.test(question)) {
        logger.debug('Question matches must-pause pattern', {
          question: question.substring(0, 100),
          pattern: pattern.source.substring(0, 50)
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Generate answer for a question
   * @returns Answer object or null if should pause
   */
  async answer(context: QuestionContext): Promise<QuestionAnswer | null> {
    const startTime = Date.now();
    this.stats.totalQuestions++;

    const question = context.question;

    // Check blocklist first (fast path)
    if (this.mustPause(question)) {
      this.stats.blockedByPattern++;
      this.stats.pausedForUser++;
      await this.logEvent('blocked_by_pattern', { question: question.substring(0, 500) });
      return null;
    }

    // Check max auto-answers limit
    if (this.stats.autoAnswered >= this.config.maxAutoAnswers) {
      logger.warn('Max auto-answers reached', {
        limit: this.config.maxAutoAnswers,
        current: this.stats.autoAnswered
      });
      this.stats.pausedForUser++;
      await this.logEvent('max_limit_reached', { question: question.substring(0, 500) });
      return null;
    }

    try {
      // Build prompt
      const systemPrompt = this.buildSystemPrompt(context);

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), this.config.timeout);

      try {
        // Call LLM via executor
        const response = await this.executor({
          prompt: question,
          systemPrompt,
          maxTokens: 500, // Keep answers concise
          temperature: 0.3, // Lower temperature for more consistent answers
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startTime;
        const answerText = response.content?.trim() || '';

        // Check for PAUSE_REQUIRED response
        if (answerText.toUpperCase().includes('PAUSE_REQUIRED')) {
          logger.info('LLM indicated pause required', {
            question: question.substring(0, 100)
          });
          this.stats.pausedForUser++;
          await this.logEvent('llm_pause_required', {
            question: question.substring(0, 500),
            response: answerText.substring(0, 200)
          });
          return null;
        }

        // Check for empty response
        if (!answerText || answerText.length < 5) {
          logger.warn('LLM returned empty or too short response', {
            responseLength: answerText.length
          });
          this.stats.pausedForUser++;
          await this.logEvent('empty_response', { question: question.substring(0, 500) });
          return null;
        }

        // Calculate confidence (heuristic based on response characteristics)
        const confidence = this.calculateConfidence(answerText, question);

        // Check confidence threshold
        if (confidence < this.config.confidenceThreshold) {
          logger.info('Answer below confidence threshold', {
            confidence,
            threshold: this.config.confidenceThreshold
          });
          this.stats.belowThreshold++;
          this.stats.pausedForUser++;
          await this.logEvent('below_threshold', {
            question: question.substring(0, 500),
            answer: answerText.substring(0, 200),
            confidence
          });
          return null;
        }

        // Success - update stats
        const tokensUsed = response.tokensUsed?.total || 0;
        this.stats.autoAnswered++;
        this.stats.tokensUsed += tokensUsed;
        this.updateAverages(confidence, latencyMs);

        const result: QuestionAnswer = {
          answer: answerText,
          confidence,
          tokensUsed,
          latencyMs
        };

        await this.logEvent('auto_answered', {
          question: question.substring(0, 500),
          answer: answerText.substring(0, 500),
          confidence,
          latencyMs,
          tokensUsed
        });

        logger.info('Question auto-answered', {
          question: question.substring(0, 50),
          answer: answerText.substring(0, 50),
          confidence,
          latencyMs
        });

        return result;

      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Handle abort/timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Question answering timed out', {
          timeout: this.config.timeout,
          latencyMs
        });
        await this.logEvent('timeout', {
          question: question.substring(0, 500),
          timeout: this.config.timeout
        });
      } else {
        logger.error('Question answering failed', {
          error: (error as Error).message,
          latencyMs
        });
        await this.logEvent('error', {
          question: question.substring(0, 500),
          error: (error as Error).message,
          latencyMs
        });
      }

      this.stats.pausedForUser++;
      return null;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): QuestionResponderStats {
    return { ...this.stats };
  }

  /**
   * Compile must-pause regex patterns
   */
  private compilePatterns(): void {
    this.compiledPatterns = [];

    for (const patternStr of this.config.mustPausePatterns) {
      try {
        // Remove the (?i) prefix if present since we use 'i' flag
        const cleanPattern = patternStr.replace(/^\(\?i\)/, '');
        this.compiledPatterns.push(new RegExp(cleanPattern, 'i'));
      } catch (error) {
        logger.warn('Invalid must-pause pattern', {
          pattern: patternStr,
          error: (error as Error).message
        });
      }
    }

    logger.debug('Compiled must-pause patterns', {
      count: this.compiledPatterns.length
    });
  }

  /**
   * Build system prompt with context substitution
   */
  private buildSystemPrompt(context: QuestionContext): string {
    const template = this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    return template
      .replace(/\{\{task\}\}/g, context.task || 'unknown task')
      .replace(/\{\{agent\}\}/g, context.agent || 'unknown agent')
      .replace(/\{\{question\}\}/g, context.question);
  }

  /**
   * Calculate confidence score for an answer
   * Simple heuristic - can be improved with ML later
   */
  private calculateConfidence(answer: string, _question: string): number {
    let confidence = 0.8; // Base confidence

    // Reduce confidence for very short answers
    if (answer.length < 15) {
      confidence -= 0.2;
    }

    // Reduce confidence for answers with uncertainty markers
    const uncertaintyMarkers = [
      'maybe',
      'perhaps',
      'not sure',
      'could be',
      'might',
      'possibly',
      'i think',
      'i believe',
      'probably'
    ];
    const lowerAnswer = answer.toLowerCase();
    for (const marker of uncertaintyMarkers) {
      if (lowerAnswer.includes(marker)) {
        confidence -= 0.15;
        break;
      }
    }

    // Increase confidence for direct/decisive answers
    const decisiveMarkers = [
      'use ',
      'choose ',
      'go with ',
      'recommend ',
      'prefer ',
      'best ',
      'should ',
      'would ',
      'the answer is',
      'you should'
    ];
    for (const marker of decisiveMarkers) {
      if (lowerAnswer.includes(marker)) {
        confidence += 0.05;
        break;
      }
    }

    // Reduce confidence for very long answers (likely over-explaining or hedging)
    if (answer.length > 500) {
      confidence -= 0.1;
    }

    // Reduce confidence for answers with questions (likely asking for clarification)
    if (answer.includes('?') && !answer.includes('PAUSE_REQUIRED')) {
      confidence -= 0.2;
    }

    // Clamp to valid range
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Update running averages
   */
  private updateAverages(confidence: number, latencyMs: number): void {
    const n = this.stats.autoAnswered;

    // Accumulate values
    this.confidenceAccumulator += confidence;
    this.latencyAccumulator += latencyMs;

    // Calculate averages
    this.stats.avgConfidence = this.confidenceAccumulator / n;
    this.stats.avgLatencyMs = this.latencyAccumulator / n;
  }

  /**
   * Log event to JSONL file
   */
  private async logEvent(type: string, payload: Record<string, unknown>): Promise<void> {
    const event = {
      type: `question_responder.${type}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      provider: this.config.provider,
      payload
    };

    const line = JSON.stringify(event) + '\n';

    try {
      const dir = dirname(this.logPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      await appendFile(this.logPath, line);
    } catch (error) {
      // Non-critical - don't fail on logging errors
      logger.debug('Failed to write question responder log', {
        error: (error as Error).message
      });
    }
  }
}

/**
 * Default must-pause patterns for sensitive questions
 * These patterns identify questions that should NOT be auto-answered
 */
export const DEFAULT_MUST_PAUSE_PATTERNS = [
  // Credentials and secrets
  '(password|secret|api.?key|token|credential|private.?key)',
  // Business decisions
  '(which (client|customer|user|account)|pricing|cost|budget)',
  // Production/sensitive environments
  '(production|prod|live) (database|server|environment|url)',
  // Destructive operations
  '(delete|remove|drop|truncate).*(all|everything|database)',
  // Personal data
  '(user.*(email|phone|address)|personal.*(data|information)|PII)',
  // Authentication
  '(login|auth).*(credentials|password)',
  // Financial
  '(payment|billing|invoice|credit.?card)'
];

/**
 * Create default question responder configuration
 */
export function createDefaultQuestionResponderConfig(
  enabled: boolean = false,
  provider: QuestionResponderConfig['provider'] = 'gemini'
): QuestionResponderConfig {
  return {
    enabled,
    provider,
    confidenceThreshold: 0.7,
    maxAutoAnswers: 50,
    timeout: 30000,
    mustPausePatterns: DEFAULT_MUST_PAUSE_PATTERNS
  };
}
