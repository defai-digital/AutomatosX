/**
 * Provider configurations
 *
 * Each provider config specifies:
 * - CLI command and arguments
 * - Environment variables (non-secret)
 * - Output format
 * - Timeout
 * - Available models
 *
 * NO API KEYS - CLIs handle their own authentication
 */

import type { CLIProviderConfig } from '../types.js';
import { claudeConfig } from './claude.js';
import { geminiConfig } from './gemini.js';
import { codexConfig } from './codex.js';
import { grokConfig } from './grok.js';
import { antigravityConfig } from './antigravity.js';
import { opencodeConfig } from './opencode.js';

// Re-export individual configs
export { claudeConfig } from './claude.js';
export { geminiConfig } from './gemini.js';
export { codexConfig } from './codex.js';
export { grokConfig } from './grok.js';
export { antigravityConfig } from './antigravity.js';
export { opencodeConfig } from './opencode.js';

/**
 * All registered provider configurations
 */
export const ALL_PROVIDER_CONFIGS: readonly CLIProviderConfig[] = [
  claudeConfig,
  geminiConfig,
  codexConfig,
  grokConfig,
  antigravityConfig,
  opencodeConfig,
];

/**
 * Gets a provider config by ID
 */
export function getProviderConfig(providerId: string): CLIProviderConfig | undefined {
  return ALL_PROVIDER_CONFIGS.find((config) => config.providerId === providerId);
}

/**
 * Gets all provider IDs
 */
export function getAllProviderIds(): readonly string[] {
  return ALL_PROVIDER_CONFIGS.map((config) => config.providerId);
}
