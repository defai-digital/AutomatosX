/**
 * Parameter Validator - Validates and warns about provider parameter support
 *
 * ⚠️ NOTE: This module is currently NOT USED in production code.
 * It was created for future use when parameters are read from Team/Global config.
 *
 * Current Reality (v5.0.5):
 * - Parameters are ONLY read from AgentProfile (agent YAML)
 * - No validation needed (users control their own agent configs)
 * - Team/Global config defaults are NOT read by any code
 *
 * Future Use Case:
 * When we implement Team/Global config parameter reading, this validator
 * will warn users when they configure unsupported parameters.
 *
 * For now, this is kept for reference and future implementation.
 */

import type { ExecutionRequest } from '../../types/provider.js';
import { logger } from '../logging/logger.js';

/**
 * Provider parameter support configuration
 */
interface ProviderParameterSupport {
  name: string;
  supportsMaxTokens: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  docsUrl: string;
  notes?: string;
}

/**
 * Provider support matrix
 */
const PROVIDER_SUPPORT: Record<string, ProviderParameterSupport> = {
  'openai': {
    name: 'Codex CLI',
    supportsMaxTokens: true,
    supportsTemperature: true,
    supportsTopP: false,  // v5.0.6: Removed for simplification
    docsUrl: 'https://developers.openai.com/codex/cli/',
    notes: 'Supports maxTokens and temperature via -c flags'
  },
  'gemini-cli': {
    name: 'Google Gemini',
    supportsMaxTokens: false,
    supportsTemperature: false,
    supportsTopP: false,
    docsUrl: 'https://github.com/google-gemini/gemini-cli/issues/5280',
    notes: 'Parameter support in development (Issue #5280)'
  },
  'claude-code': {
    name: 'Claude Code',
    supportsMaxTokens: false,
    supportsTemperature: false,
    supportsTopP: false,
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/setup',
    notes: 'Uses provider-optimized defaults'
  }
};

/**
 * Parameter Validator class
 */
export class ParameterValidator {
  /**
   * Validate parameters for a provider and warn if unsupported
   *
   * @param providerName Provider name (e.g., 'openai', 'gemini-cli', 'claude-code')
   * @param request Execution request with parameters
   * @param warnOnUnsupported Whether to log warnings for unsupported parameters (default: true)
   */
  static validateAndWarn(
    providerName: string,
    request: ExecutionRequest,
    warnOnUnsupported: boolean = true
  ): void {
    const provider = PROVIDER_SUPPORT[providerName];

    if (!provider) {
      logger.warn(`Unknown provider '${providerName}' - parameter support unknown`);
      return;
    }

    // Check maxTokens
    if (request.maxTokens !== undefined && !provider.supportsMaxTokens) {
      if (warnOnUnsupported) {
        logger.warn(
          `Provider '${provider.name}' does not support maxTokens parameter.\n` +
          `  Value will be ignored: ${request.maxTokens}\n` +
          `  ${provider.notes}\n` +
          `  See: ${provider.docsUrl}`
        );
      }
    }

    // Check temperature
    if (request.temperature !== undefined && !provider.supportsTemperature) {
      if (warnOnUnsupported) {
        logger.warn(
          `Provider '${provider.name}' does not support temperature parameter.\n` +
          `  Value will be ignored: ${request.temperature}\n` +
          `  ${provider.notes}\n` +
          `  See: ${provider.docsUrl}`
        );
      }
    }

    // topP parameter removed in v5.0.6 (simplified implementation)
  }

  /**
   * Get provider parameter support information
   *
   * @param providerName Provider name
   * @returns Provider support configuration or undefined if unknown
   */
  static getProviderSupport(providerName: string): ProviderParameterSupport | undefined {
    return PROVIDER_SUPPORT[providerName];
  }

  /**
   * Check if a provider supports a specific parameter
   *
   * @param providerName Provider name
   * @param parameter Parameter to check
   * @returns true if supported, false otherwise
   */
  static supportsParameter(
    providerName: string,
    parameter: 'maxTokens' | 'temperature' | 'topP'
  ): boolean {
    const provider = PROVIDER_SUPPORT[providerName];
    if (!provider) return false;

    switch (parameter) {
      case 'maxTokens':
        return provider.supportsMaxTokens;
      case 'temperature':
        return provider.supportsTemperature;
      case 'topP':
        return provider.supportsTopP;
      default:
        return false;
    }
  }

  /**
   * Get all providers that support a specific parameter
   *
   * @param parameter Parameter to check
   * @returns Array of provider names that support the parameter
   */
  static getProvidersSupporting(parameter: 'maxTokens' | 'temperature' | 'topP'): string[] {
    return Object.entries(PROVIDER_SUPPORT)
      .filter(([_, config]) => {
        switch (parameter) {
          case 'maxTokens':
            return config.supportsMaxTokens;
          case 'temperature':
            return config.supportsTemperature;
          case 'topP':
            return config.supportsTopP;
          default:
            return false;
        }
      })
      .map(([name, _]) => name);
  }

  /**
   * Get a summary of provider parameter support
   *
   * @returns Object mapping provider names to support info
   */
  static getSupportMatrix(): Record<string, ProviderParameterSupport> {
    return { ...PROVIDER_SUPPORT };
  }
}
