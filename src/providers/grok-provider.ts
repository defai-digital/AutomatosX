/**
 * GrokProvider - Pure CLI Wrapper for Grok (v8.4.0)
 *
 * Supports two CLI implementations:
 * 1. Z.AI GLM 4.6: `grok "prompt"` (free tier, Chinese model)
 * 2. X.AI Grok: `grok "prompt"` (official Grok, requires API key)
 *
 * Uses CLI's default model and authentication.
 * Configuration via YAML files for advanced setups.
 *
 * @see docs/providers/grok.md for detailed documentation
 * @see examples/providers/grok-*.yaml for configuration examples
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export class GrokProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);

    logger.debug('GrokProvider initialized', {
      name: config.name,
      enabled: config.enabled,
      priority: config.priority,
      command: config.command || 'grok'
    });
  }

  /**
   * Get the CLI command name for Grok
   * Returns 'grok' which can point to either:
   * - Z.AI GLM 4.6 CLI
   * - X.AI Official Grok CLI
   */
  protected getCLICommand(): string {
    // Allow custom command override via config (e.g., 'grok-z-ai' or 'grok-x-ai')
    // Handle empty string explicitly
    const command = this.config.command;
    return command && command.trim() !== '' ? command : 'grok';
  }

  /**
   * Get CLI arguments for headless mode
   * Grok CLI requires -p flag for non-interactive mode
   *
   * NOTE: The -p flag is currently hardcoded. If Grok CLI changes
   * its non-interactive flag in the future, this will need updating.
   * Consider making this configurable if multiple Grok CLI versions exist.
   */
  protected override getCLIArgs(): string[] {
    return ['-p'];  // -p = prompt mode (headless, single execution)
  }

  /**
   * Check if Grok CLI is available AND properly configured
   *
   * **Bug Fix (v9.0.0+)**: Validates that settings.json contains ALL required fields
   *
   * The Grok CLI loads settings from two locations:
   * 1. Project: .grok/settings.json (created by `ax setup`)
   * 2. Global: ~/.grok/settings.json (user's API key)
   *
   * **Problem**: If project .grok/settings.json exists but is incomplete (missing
   * apiKey, baseURL, or model), the Grok CLI will use it and fail, even if the
   * global ~/.grok/settings.json has valid credentials.
   *
   * **Solution**: Only mark Grok as "available" if:
   * - CLI command exists in PATH
   * - AND either:
   *   - Project .grok/settings.json has ALL required fields (baseURL, model, apiKey)
   *   - OR global ~/.grok/settings.json has ALL required fields
   *
   * This ensures AutomatosX router won't try to use Grok if configuration is incomplete.
   */
  override async isAvailable(): Promise<boolean> {
    try {
      // 1. Check if CLI command exists
      const cliAvailable = await this.checkCLIAvailable();
      if (!cliAvailable) {
        logger.debug('Grok CLI not found in PATH');
        return false;
      }

      // 2. Check project settings first (.grok/settings.json in current directory)
      const projectSettingsPath = path.join(process.cwd(), '.grok', 'settings.json');
      const projectSettingsValid = await this.validateSettingsFile(projectSettingsPath, 'project');

      if (projectSettingsValid) {
        logger.debug('Grok provider available: project settings valid', {
          path: projectSettingsPath
        });
        return true;
      }

      // 3. Fall back to global settings (~/.grok/settings.json)
      const globalSettingsPath = path.join(homedir(), '.grok', 'settings.json');
      const globalSettingsValid = await this.validateSettingsFile(globalSettingsPath, 'global');

      if (globalSettingsValid) {
        logger.debug('Grok provider available: global settings valid', {
          path: globalSettingsPath
        });
        return true;
      }

      // 4. Neither project nor global settings are valid
      logger.warn('Grok CLI found but no valid configuration detected', {
        projectSettings: projectSettingsPath,
        globalSettings: globalSettingsPath,
        reason: 'Missing required fields: baseURL, model, or apiKey'
      });

      return false;
    } catch (error) {
      logger.debug('Grok availability check failed', { error });
      return false;
    }
  }

  /**
   * Validate a Grok settings.json file
   *
   * Returns true only if ALL required fields are present and non-empty:
   * - baseURL
   * - model
   * - apiKey
   *
   * Fields starting with underscore (e.g., _baseURL, _model) are comments
   * and don't count as valid configuration.
   */
  private async validateSettingsFile(
    settingsPath: string,
    location: 'project' | 'global'
  ): Promise<boolean> {
    try {
      // Check if file exists
      const exists = await fs.access(settingsPath).then(() => true).catch(() => false);
      if (!exists) {
        logger.debug(`${location} Grok settings not found`, { path: settingsPath });
        return false;
      }

      // Read and parse JSON
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Validate required fields
      const hasBaseURL = typeof settings.baseURL === 'string' && settings.baseURL.trim() !== '';
      const hasModel = typeof settings.model === 'string' && settings.model.trim() !== '';
      const hasApiKey = typeof settings.apiKey === 'string' && settings.apiKey.trim() !== '';

      const isValid = hasBaseURL && hasModel && hasApiKey;

      if (!isValid) {
        const missing = [];
        if (!hasBaseURL) missing.push('baseURL');
        if (!hasModel) missing.push('model');
        if (!hasApiKey) missing.push('apiKey');

        logger.debug(`${location} Grok settings incomplete`, {
          path: settingsPath,
          missingFields: missing
        });
      } else {
        logger.debug(`${location} Grok settings valid`, {
          path: settingsPath,
          baseURL: settings.baseURL,
          model: settings.model,
          hasApiKey: true  // Don't log actual API key
        });
      }

      return isValid;
    } catch (error) {
      logger.debug(`Failed to validate ${location} Grok settings`, {
        path: settingsPath,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get mock response for testing
   * Returns a realistic Grok-style response
   */
  protected getMockResponse(): string {
    return `[Mock Grok Response]

This is a mock response from Grok for testing purposes.

Grok is designed to provide helpful, accurate, and witty responses to your queries. This mock response simulates the typical output you would receive from the Grok CLI.

Key features:
- Direct and informative answers
- Occasional humor and personality
- Factual accuracy
- Clear formatting

For actual Grok responses, ensure:
1. Grok CLI is installed (grok --version)
2. API credentials are configured (if using X.AI)
3. AX_MOCK_PROVIDERS is not set to 'true'`;
  }
}
