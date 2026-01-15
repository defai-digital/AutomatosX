/**
 * Provider Factory for CLI Commands
 *
 * Creates shared provider infrastructure for CLI commands that need
 * LLM provider access (bugfix, refactor, etc.)
 *
 * All adapter imports are centralized in bootstrap.ts (composition root).
 * This file delegates to bootstrap for provider registry access.
 */

import { getProviderRegistry as getBootstrapProviderRegistry } from '../bootstrap.js';
import type {
  ProviderRegistry,
  LLMProvider,
} from '../bootstrap.js';
import type {
  ProviderRouter,
  AnalysisProvider,
  ProviderRequest,
  ProviderResponse,
} from '@defai.digital/analysis-domain';

/**
 * Gets the shared provider registry from bootstrap
 */
export function getProviderRegistry(): ProviderRegistry {
  return getBootstrapProviderRegistry();
}

/**
 * Wraps an LLMProvider as an AnalysisProvider for use with analysis-domain
 */
function wrapAsAnalysisProvider(
  provider: LLMProvider,
  providerId: string
): AnalysisProvider {
  return {
    id: providerId,
    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      // Get default model for this provider
      const models = provider.getModels();
      const defaultModel = models.find((m) => m.isDefault === true) ?? models[0];
      const model = defaultModel?.modelId ?? 'default';

      const response = await provider.complete({
        requestId: crypto.randomUUID(),
        model,
        messages: [{ role: 'user', content: request.prompt }],
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Provider error');
      }

      return {
        content: response.content,
        tokensUsed: response.usage?.totalTokens,
      };
    },
  };
}

/**
 * Creates a ProviderRouter for use with analysis services
 *
 * This bridges the CLI provider infrastructure with the analysis-domain's
 * ProviderRouter interface.
 */
export function createAnalysisProviderRouter(): ProviderRouter {
  const registry = getProviderRegistry();

  return {
    async getProvider(providerId: string): Promise<AnalysisProvider> {
      const provider = registry.get(providerId);
      if (provider === undefined) {
        throw new Error(`Provider "${providerId}" not found in registry`);
      }

      // Check if available
      const available = await provider.isAvailable();
      if (!available) {
        throw new Error(
          `Provider "${providerId}" is not available (CLI not installed or not in PATH)`
        );
      }

      return wrapAsAnalysisProvider(provider, providerId);
    },

    async selectProvider(_task: string): Promise<AnalysisProvider> {
      // Default provider selection strategy:
      // 1. Try claude first (most capable for analysis)
      // 2. Fall back to any available provider
      const preferredProviders = ['claude', 'gemini', 'codex', 'grok'];

      for (const providerId of preferredProviders) {
        const provider = registry.get(providerId);
        if (provider !== undefined) {
          try {
            const available = await provider.isAvailable();
            if (available) {
              return wrapAsAnalysisProvider(provider, providerId);
            }
          } catch {
            // Try next provider
            continue;
          }
        }
      }

      throw new Error(
        'No providers available. Install at least one provider CLI:\n' +
          '  - claude (Claude Code): https://github.com/anthropics/claude-code\n' +
          '  - gemini (Gemini CLI): https://github.com/google-gemini/gemini-cli\n' +
          '  - codex (OpenAI Codex): https://github.com/openai/codex'
      );
    },
  };
}

/**
 * Gets the IDs of all registered providers
 */
export function getRegisteredProviderIds(): string[] {
  return getProviderRegistry().getProviderIds();
}

/**
 * Checks if a specific provider is available
 */
export async function isProviderAvailable(providerId: string): Promise<boolean> {
  const provider = getProviderRegistry().get(providerId);
  if (provider === undefined) {
    return false;
  }
  return provider.isAvailable();
}
