/**
 * Type definitions for ax-cli integration (v10.0.0)
 *
 * @module integrations/ax-cli/types
 */

import { z } from 'zod';

/**
 * ax-cli JSONL message schema
 *
 * ax-cli outputs in JSONL (JSON Lines) format:
 * {"role":"user","content":"..."}
 * {"role":"assistant","content":"...","model":"glm-4.6","usage":{"input_tokens":10,"output_tokens":20}}
 */
export const AxCliMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  model: z.string().optional(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional()
  }).optional()
});

export type AxCliMessage = z.infer<typeof AxCliMessageSchema>;

/**
 * ax-cli configuration schema
 *
 * Matches ~/.ax-cli/config.json structure
 */
export const AxCliConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  mcpServers: z.record(z.string(), z.unknown()).optional()
});

export type AxCliConfig = z.infer<typeof AxCliConfigSchema>;

/**
 * Provider name for ax-cli
 *
 * Note: The actual provider (GLM, Grok, OpenAI, etc.) is configured via
 * `ax-cli setup` and stored in ~/.ax-cli/config.json. AutomatosX should
 * not hardcode provider names.
 *
 * @deprecated Provider selection is handled by ax-cli setup, not by AutomatosX
 */
export type AxCliProvider = string;

/**
 * ax-cli command build result
 */
export interface AxCliCommand {
  /** CLI command (always 'ax-cli') */
  command: string;

  /** Command arguments */
  args: string[];

  /** Full command string for logging */
  fullCommand: string;
}
