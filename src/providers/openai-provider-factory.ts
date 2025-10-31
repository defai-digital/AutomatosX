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
import { OpenAISDKProvider } from './openai-sdk-provider.js';
import {
  getModeWithAutoResolution,
  shouldShowWizard,
  showModeWizard,
  detectEnvironment
} from './integration-mode-wizard.js';
import { logger } from '../utils/logger.js';

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
): OpenAIProvider | OpenAISDKProvider {
  // Resolve mode using sync-safe heuristics
  let resolvedMode: 'cli' | 'sdk' = 'cli'; // Default to CLI for safety

  if (integrationMode === 'sdk') {
    resolvedMode = 'sdk';
  } else if (integrationMode === 'cli') {
    resolvedMode = 'cli';
  } else if (integrationMode === 'auto' || !integrationMode) {
    // Simple sync check: if API key exists, prefer SDK, otherwise CLI
    const hasAPIKey = !!process.env.OPENAI_API_KEY;
    resolvedMode = hasAPIKey ? 'sdk' : 'cli';

    if (process.env.AUTOMATOSX_DEBUG === 'true') {
      logger.debug('OpenAI integration mode auto-resolved (sync)', {
        hasAPIKey,
        resolvedMode,
        provider: config.name
      });
    }
  }

  // Create appropriate provider
  if (resolvedMode === 'sdk') {
    const sdkConfig = {
      apiKey: config.sdk?.apiKey || process.env.OPENAI_API_KEY,
      organization: config.sdk?.organization,
      baseURL: config.sdk?.baseURL,
      timeout: config.sdk?.timeout || config.timeout,
      maxRetries: config.sdk?.maxRetries || 2,
      defaultModel: config.sdk?.defaultModel || 'gpt-4o'
    };

    logger.debug('Created OpenAI SDK provider (sync)', {
      provider: config.name,
      mode: 'sdk'
    });

    return new OpenAISDKProvider(config, sdkConfig);
  } else {
    logger.debug('Created OpenAI CLI provider (sync)', {
      provider: config.name,
      mode: 'cli'
    });

    return new OpenAIProvider(config);
  }
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
): Promise<OpenAIProvider | OpenAISDKProvider> {
  // Resolve integration mode
  let resolvedMode: 'cli' | 'sdk';

  // v6.0.7: Check if wizard should be shown
  const needsWizard = await shouldShowWizard(integrationMode, !integrationMode);

  if (interactive && needsWizard) {
    // Show wizard for interactive mode selection
    const selectedMode = await showModeWizard(integrationMode, {
      autoDetect: false,
      verbose: process.env.AUTOMATOSX_DEBUG === 'true'
    });

    // Resolve 'auto' to actual mode
    resolvedMode = await getModeWithAutoResolution(selectedMode);

    logger.info('OpenAI integration mode selected via wizard', {
      selectedMode,
      resolvedMode,
      provider: config.name
    });
  } else {
    // Non-interactive: resolve mode automatically
    resolvedMode = await getModeWithAutoResolution(integrationMode);

    // v6.0.7: Log warnings for detected conflicts
    if (needsWizard && !interactive) {
      const env = await detectEnvironment();

      if (integrationMode === 'sdk' && env.isBehindFirewall) {
        logger.warn('OpenAI SDK mode configured but firewall detected', {
          configuredMode: integrationMode,
          resolvedMode,
          canReachAPI: env.canReachAPI,
          suggestion: 'Run "ax setup openai" to reconfigure'
        });
      } else if (integrationMode === 'cli' && !env.hasCodexCLI && env.hasAPIKey && env.canReachAPI) {
        logger.warn('OpenAI CLI mode configured but Codex CLI not found', {
          configuredMode: integrationMode,
          resolvedMode,
          hasCodexCLI: env.hasCodexCLI,
          hasAPIKey: env.hasAPIKey,
          suggestion: 'Run "ax setup openai" to switch to SDK mode'
        });
      }
    }

    if (process.env.AUTOMATOSX_DEBUG === 'true') {
      logger.debug('OpenAI integration mode resolved', {
        configuredMode: integrationMode,
        resolvedMode,
        provider: config.name
      });
    }
  }

  // Create appropriate provider instance
  if (resolvedMode === 'sdk') {
    logger.info('Creating OpenAI SDK provider', {
      provider: config.name,
      mode: 'sdk'
    });

    // Extract SDK configuration from provider config
    const sdkConfig = {
      apiKey: config.sdk?.apiKey || process.env.OPENAI_API_KEY,
      organization: config.sdk?.organization,
      baseURL: config.sdk?.baseURL,
      timeout: config.sdk?.timeout || config.timeout,
      maxRetries: config.sdk?.maxRetries || 2,
      defaultModel: config.sdk?.defaultModel || 'gpt-4o'
    };

    return new OpenAISDKProvider(config, sdkConfig);
  } else {
    logger.info('Creating OpenAI CLI provider', {
      provider: config.name,
      mode: 'cli'
    });

    return new OpenAIProvider(config);
  }
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
