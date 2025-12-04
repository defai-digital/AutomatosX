/**
 * OpenAI Provider Factory
 *
 * Creates appropriate OpenAI provider instance based on integration mode:
 * - 'cli': Use OpenAIProvider (subprocess-based)
 * - 'sdk': Use OpenAISDKProvider (native SDK)
 * - 'auto': Auto-detect and choose best mode
 *
 * v6.0.7 Phase 2: Smart integration mode selection with wizard
 */

import type { ProviderConfig } from '../types/provider.js';
import type { IntegrationMode } from '../types/config.js';
import { OpenAIProvider } from './openai-provider.js';
// v8.3.0: SDK provider removed - CLI only
// import { OpenAISDKProvider } from './openai-sdk-provider.js';
import {
  getModeWithAutoResolution,
  shouldShowWizard,
  showModeWizard,
  detectEnvironment
} from './integration-mode-wizard.js';
import { logger } from '../shared/logging/logger.js';

/**
 * Create OpenAI provider instance synchronously based on integration mode
 *
 * Uses simple heuristic for 'auto' mode (checks env vars only, no network calls).
 * For interactive wizard, use createOpenAIProviderAsync().
 *
 * @param config - Provider configuration
 * @param integrationMode - Integration mode from config
 * @returns Provider instance (OpenAIProvider or OpenAISDKProvider)
 */
export function createOpenAIProviderSync(
  config: ProviderConfig,
  integrationMode?: IntegrationMode
): OpenAIProvider {
  // v8.3.0: Always use CLI - SDK mode removed
  logger.debug('Created OpenAI CLI provider (v8.3.0: CLI-only)', {
    provider: config.name,
    mode: 'cli'
  });

  return new OpenAIProvider(config);
}

/**
 * Create OpenAI provider instance asynchronously with full environment detection
 *
 * @param config - Provider configuration
 * @param integrationMode - Integration mode ('cli', 'sdk', 'auto', or undefined)
 * @param interactive - Whether to show wizard if mode needs selection (default: false)
 * @returns Provider instance (OpenAIProvider or OpenAISDKProvider)
 */
export async function createOpenAIProviderAsync(
  config: ProviderConfig,
  integrationMode?: IntegrationMode,
  interactive: boolean = false
): Promise<OpenAIProvider> {
  // v8.3.0: Always use CLI - SDK mode removed
  logger.info('Creating OpenAI CLI provider (v8.3.0: CLI-only)', {
    provider: config.name,
    mode: 'cli'
  });

  return new OpenAIProvider(config);
}

/**
 * Get current integration mode from config
 *
 * Helper function to extract integration mode from provider config.
 *
 * @param config - Provider configuration
 * @returns Integration mode or undefined
 */
export function getIntegrationMode(config: ProviderConfig): IntegrationMode | undefined {
  return config.integration;
}

/**
 * Check if SDK mode is available
 *
 * Validates that SDK mode requirements are met:
 * - API key is configured
 * - OpenAI SDK package is installed
 *
 * @returns true if SDK mode can be used
 */
export function isSDKModeAvailable(): boolean {
  // Check if API key is available
  const hasAPIKey = !!process.env.OPENAI_API_KEY;

  // Check if OpenAI SDK is available
  let hasSDK = false;
  try {
    require.resolve('openai');
    hasSDK = true;
  } catch {
    hasSDK = false;
  }

  return hasAPIKey && hasSDK;
}

/**
 * Check if CLI mode is available
 *
 * Validates that CLI mode requirements are met:
 * - codex CLI is installed
 *
 * @returns true if CLI mode can be used
 */
export async function isCLIModeAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('codex --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000
    });
    return true;
  } catch {
    return false;
  }
}
