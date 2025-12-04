/**
 * Provider Detector - Detects which AI provider CLIs are installed
 *
 * This module detects which AI provider CLIs the user has installed on their system.
 * AutomatosX is provider-agnostic and only configures support for providers that are
 * already installed by the user.
 *
 * Supported Providers:
 * - Claude Code (claude)
 * - Gemini CLI (gemini)
 * - Codex CLI (codex)
 * - ax-cli (ax-cli) - optional multi-provider CLI
 *
 * @module core/provider-detector
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../shared/logging/logger.js';

const execAsync = promisify(exec);

export interface DetectedProviders {
  'claude-code': boolean;
  'gemini-cli': boolean;
  'codex': boolean;
  'ax-cli': boolean;
}

export interface ProviderInfo {
  name: string;
  command: string;
  detected: boolean;
  version?: string;
  error?: string;
}

/**
 * Provider Detector - Detects installed AI provider CLIs
 *
 * This class provides methods to detect which AI provider CLIs are installed
 * on the user's system. It never installs or bundles providers - it only
 * detects what the user has already installed.
 *
 * @example
 * ```typescript
 * const detector = new ProviderDetector();
 * const providers = await detector.detectAll();
 * console.log(providers);
 * // { 'claude-code': true, 'gemini-cli': false, ... }
 * ```
 */
export class ProviderDetector {
  private static readonly PROVIDER_COMMANDS = {
    'claude-code': 'claude',
    'gemini-cli': 'gemini',
    'codex': 'codex',
    'ax-cli': 'ax-cli'
  } as const;

  /**
   * Detect all supported AI provider CLIs
   *
   * Returns a map of provider names to detection results.
   * This method runs detection in parallel for performance.
   *
   * @returns Promise<DetectedProviders> - Map of provider names to detection status
   *
   * @example
   * ```typescript
   * const detector = new ProviderDetector();
   * const providers = await detector.detectAll();
   *
   * if (providers['claude-code']) {
   *   console.log('Claude Code is installed');
   * }
   * ```
   */
  async detectAll(): Promise<DetectedProviders> {
    logger.info('Detecting installed AI providers...');

    // Run all detections in parallel for better performance
    const results = await Promise.all([
      this.isCommandAvailable('claude-code'),
      this.isCommandAvailable('gemini-cli'),
      this.isCommandAvailable('codex'),
      this.isCommandAvailable('ax-cli')
    ]);

    const detected: DetectedProviders = {
      'claude-code': results[0],
      'gemini-cli': results[1],
      'codex': results[2],
      'ax-cli': results[3]
    };

    const foundProviders = Object.entries(detected)
      .filter(([_, isInstalled]) => isInstalled)
      .map(([provider]) => provider);

    logger.info('Provider detection complete', {
      found: foundProviders,
      total: foundProviders.length
    });

    return detected;
  }

  /**
   * Detect all providers with detailed information
   *
   * Returns detailed information about each provider including version
   * information when available.
   *
   * @returns Promise<ProviderInfo[]> - Array of provider information objects
   *
   * @example
   * ```typescript
   * const detector = new ProviderDetector();
   * const info = await detector.detectAllWithInfo();
   *
   * for (const provider of info) {
   *   if (provider.detected) {
   *     console.log(`${provider.name}: ${provider.version}`);
   *   }
   * }
   * ```
   */
  async detectAllWithInfo(): Promise<ProviderInfo[]> {
    const providers = Object.entries(ProviderDetector.PROVIDER_COMMANDS);

    // Run all detections in parallel
    const results = await Promise.all(
      providers.map(async ([name, command]) => {
        const info: ProviderInfo = {
          name,
          command,
          detected: false
        };

        try {
          const version = await this.getVersion(name as keyof typeof ProviderDetector.PROVIDER_COMMANDS);
          info.detected = true;
          info.version = version;
        } catch (error) {
          info.error = error instanceof Error ? error.message : String(error);
        }

        return info;
      })
    );

    return results;
  }

  /**
   * Check if a specific provider is available
   *
   * This method checks if the provider's CLI command exists on the system PATH.
   *
   * @param provider - Provider name (e.g., 'claude-code', 'gemini-cli')
   * @returns Promise<boolean> - true if provider is available, false otherwise
   *
   * @example
   * ```typescript
   * const detector = new ProviderDetector();
   *
   * if (await detector.isCommandAvailable('claude-code')) {
   *   console.log('Claude Code is available');
   * }
   * ```
   */
  async isCommandAvailable(provider: keyof DetectedProviders): Promise<boolean> {
    const command = ProviderDetector.PROVIDER_COMMANDS[provider];

    try {
      // Use 'which' on Unix-like systems, 'where' on Windows
      const whichCommand = process.platform === 'win32' ? 'where' : 'which';

      await execAsync(`${whichCommand} ${command}`, {
        timeout: 5000, // 5 second timeout
        windowsHide: true // Hide command window on Windows
      });

      logger.debug(`Provider ${provider} is available`, { command });
      return true;
    } catch {
      logger.debug(`Provider ${provider} is not available`, { command });
      return false;
    }
  }

  /**
   * Get version information for a provider
   *
   * Attempts to get the version string from the provider's CLI.
   * This helps users understand which version they have installed.
   *
   * @param provider - Provider name
   * @returns Promise<string | undefined> - Version string or undefined if unavailable
   *
   * @example
   * ```typescript
   * const detector = new ProviderDetector();
   * const version = await detector.getVersion('claude-code');
   * console.log(`Claude Code version: ${version}`);
   * ```
   */
  async getVersion(provider: keyof DetectedProviders): Promise<string | undefined> {
    const command = ProviderDetector.PROVIDER_COMMANDS[provider];

    try {
      // Try --version flag (most common)
      const { stdout } = await execAsync(`${command} --version`, {
        timeout: 5000,
        windowsHide: true
      });

      const version = stdout.trim();
      logger.debug(`Got version for ${provider}`, { version });
      return version;
    } catch {
      // Version detection failed - provider might not support --version
      // This is non-critical, just return undefined
      logger.debug(`Could not detect version for ${provider}`);
      return undefined;
    }
  }

  /**
   * Get list of detected provider names
   *
   * Returns a simple array of provider names that were detected.
   * Useful for user-facing messages.
   *
   * @returns Promise<string[]> - Array of detected provider names
   *
   * @example
   * ```typescript
   * const detector = new ProviderDetector();
   * const found = await detector.getDetectedProviderNames();
   * console.log(`Found providers: ${found.join(', ')}`);
   * ```
   */
  async getDetectedProviderNames(): Promise<string[]> {
    const detected = await this.detectAll();

    return Object.entries(detected)
      .filter(([_, isInstalled]) => isInstalled)
      .map(([provider]) => provider);
  }

  /**
   * Format provider names for display
   *
   * Converts provider IDs to user-friendly names.
   *
   * @param provider - Provider ID (e.g., 'claude-code')
   * @returns string - User-friendly name (e.g., 'Claude Code')
   */
  static formatProviderName(provider: string): string {
    const nameMap: Record<string, string> = {
      'claude-code': 'Claude Code',
      'gemini-cli': 'Gemini CLI',
      'codex': 'Codex CLI',
      'ax-cli': 'ax-cli'
    };

    return nameMap[provider] || provider;
  }
}
