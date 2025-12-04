/**
 * ax-cli Response Parser (v10.0.0)
 *
 * Parses JSONL (JSON Lines) output from ax-cli into ProviderResponse format
 *
 * @module integrations/ax-cli/response-parser
 */

import type { ExecutionResponse } from '../../types/provider.js';
import { AxCliMessageSchema, type AxCliMessage } from './types.js';
import { logger } from '../../shared/logging/logger.js';
import { ZodError } from 'zod';

/**
 * Parser for ax-cli JSONL output
 */
export class AxCliResponseParser {
  /** Maximum number of assistant messages to prevent memory exhaustion */
  private static readonly MAX_ASSISTANT_MESSAGES = 1000;

  /**
   * Parse JSONL output from ax-cli into ProviderResponse
   *
   * @param stdout - Raw stdout from ax-cli
   * @param defaultModel - Default model to use if not found in output
   * @returns Parsed response
   */
  parse(stdout: string, defaultModel?: string): ExecutionResponse {
    try {
      const lines = stdout.split('\n').filter(l => l.trim().length > 0);
      
      if (lines.length === 0) {
        throw new Error('Empty output from ax-cli');
      }

      let content = '';
      let model: string | undefined;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let hasUsage = false;
      const assistantMessages: string[] = [];

      // Process each line
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as AxCliMessage;

          // Validate message structure
          const validated = AxCliMessageSchema.parse(parsed);

          if (validated.role === 'assistant') {
            // Check for error messages
            if (validated.content.includes('Sorry, I encountered an error')) {
              // Check for error with colon first (non-greedy to prevent backtracking)
              const matchWithColon = validated.content.match(/Sorry, I encountered an error: (.+?)$/);
              if (matchWithColon) {
                throw new Error(`ax-cli error: ${matchWithColon[1]}`);
              }
              // Then check for error without colon (non-greedy)
              const matchWithoutColon = validated.content.match(/Sorry, I encountered an error(.*?)$/);
              if (matchWithoutColon) {
                const errorMsg = matchWithoutColon[1] ? matchWithoutColon[1].trim() : 'API error';
                throw new Error(`ax-cli error: ${errorMsg}`);
              }
              throw new Error('ax-cli error: API error');
            }

            // Prevent unbounded array growth (Bug #10 fix)
            if (assistantMessages.length >= AxCliResponseParser.MAX_ASSISTANT_MESSAGES) {
              throw new Error(
                `Too many assistant messages (max ${AxCliResponseParser.MAX_ASSISTANT_MESSAGES})`
              );
            }

            assistantMessages.push(validated.content);
          }

          // Extract model from first message if available
          if (!model && validated.model) {
            model = validated.model;
          }

          // Accumulate usage across all messages
          if (validated.usage) {
            totalInputTokens += validated.usage.input_tokens || 0;
            totalOutputTokens += validated.usage.output_tokens || 0;
            hasUsage = true;
          }
        } catch (error) {
          // If it's already an error we threw, re-throw it
          if (error instanceof Error && error.message.startsWith('ax-cli error:')) {
            throw error;
          }

          // Re-throw errors about too many messages (Bug #10)
          if (error instanceof Error && error.message.includes('Too many assistant messages')) {
            throw error;
          }

          // Log warning for invalid JSON lines but continue processing
          if (error instanceof ZodError) {
            logger.warn('Invalid message format', { line, errors: error.issues });
          } else {
            logger.warn('Failed to parse JSON line', { line, error });
          }
        }
      }

      if (assistantMessages.length === 0) {
        throw new Error('No assistant response found in output');
      }

      // Join assistant messages with double newlines
      content = assistantMessages.join('\n\n');

      // Detect finish reason based on content
      let finishReason: 'stop' | 'length' | 'error' = 'stop';
      if (assistantMessages.some(msg => msg.includes('Sorry, I encountered an error'))) {
        finishReason = 'error';
      }
      // Could add length detection if ax-cli reports truncation in future

      // Build ExecutionResponse
      return {
        content,
        model: model || defaultModel || 'unknown',
        tokensUsed: {
          prompt: totalInputTokens,
          completion: totalOutputTokens,
          total: Math.max(0, totalInputTokens + totalOutputTokens || 0)  // Guard against NaN
        },
        latencyMs: 0,  // Will be set by provider/adapter
        finishReason,
        cached: false
      };
    } catch (error) {
      // If it's already an error we threw, re-throw it
      if (error instanceof Error && error.message.startsWith('ax-cli error:')) {
        throw error;
      }
      
      logger.error('Failed to parse ax-cli response', {
        error: error instanceof Error ? error.message : String(error),
        stdout: stdout.substring(0, 500) // Log first 500 chars for debugging
      });
      throw error;
    }
  }

  /**
   * Extract error message from ax-cli output
   *
   * @param stdout - Raw stdout
   * @returns Error message or null if no error found
   */
  extractError(stdout: string): string | null {
    try {
      const lines = stdout.split('\n').filter(l => l.trim().length > 0);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.role === 'assistant' && parsed.content) {
            if (parsed.content.includes('Sorry, I encountered an error')) {
              // Check for error with colon first (non-greedy to prevent backtracking)
              const matchWithColon = parsed.content.match(/Sorry, I encountered an error: (.+?)$/);
              if (matchWithColon) {
                return matchWithColon[1];
              }
              // Then check for error without colon (non-greedy)
              const matchWithoutColon = parsed.content.match(/Sorry, I encountered an error(.*?)$/);
              if (matchWithoutColon) {
                return matchWithoutColon[1] ? matchWithoutColon[1].trim() : 'Sorry, I encountered an error';
              }
              return parsed.content;
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}