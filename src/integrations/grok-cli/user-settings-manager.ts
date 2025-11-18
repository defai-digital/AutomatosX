/**
 * Grok User Settings Manager (v8.6.0)
 *
 * Manages ~/.grok/user-settings.json for global user preferences.
 * Provides CRUD operations with atomic writes and Zod validation.
 *
 * @module integrations/grok-cli/user-settings-manager
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from '../../utils/logger.js';

/**
 * Grok User Settings Schema
 * Validates ~/.grok/user-settings.json structure
 */
const grokUserSettingsSchema = z.object({
  apiKey: z.string().min(1).optional().describe('Grok API key'),
  baseUrl: z.string().url().optional().describe('API base URL'),
  defaultModel: z.string().min(1).optional().describe('Default model name'),
  availableModels: z.array(z.string()).optional().describe('List of available models'),
  preferences: z.object({
    verbosity: z.enum(['quiet', 'normal', 'verbose']).optional().describe('Output verbosity level'),
    autoApprove: z.boolean().optional().describe('Auto-approve operations'),
    maxToolRounds: z.number().int().min(1).max(1000).optional().describe('Max tool execution rounds')
  }).optional().describe('User preferences')
}).describe('Grok user settings');

/**
 * Grok User Settings Type
 * Inferred from Zod schema for type safety
 */
export type GrokUserSettings = z.infer<typeof grokUserSettingsSchema>;

/**
 * Grok User Settings Manager
 *
 * Manages global user preferences in ~/.grok/user-settings.json
 *
 * Features:
 * - Atomic file writes (temp file + rename pattern)
 * - Zod validation for all operations
 * - Comprehensive error handling
 * - Type-safe operations
 */
export class GrokUserSettingsManager {
  private settingsPath: string;
  private settings: GrokUserSettings | null = null;

  /**
   * Create a new GrokUserSettingsManager
   *
   * @param customPath - Optional custom path to settings file (for testing)
   */
  constructor(customPath?: string) {
    this.settingsPath = customPath || path.join(
      os.homedir(),
      '.grok',
      'user-settings.json'
    );

    logger.debug('GrokUserSettingsManager initialized', {
      path: this.settingsPath
    });
  }

  /**
   * Load user settings from disk
   *
   * @returns User settings object (empty if file doesn't exist or is invalid)
   */
  async load(): Promise<GrokUserSettings> {
    try {
      // Check if file exists
      if (!fs.existsSync(this.settingsPath)) {
        logger.debug('User settings file not found, using defaults', {
          path: this.settingsPath
        });
        return {};
      }

      // Read file content
      const content = await fs.promises.readFile(this.settingsPath, 'utf-8');
      const raw = JSON.parse(content);

      // Validate with Zod
      const result = grokUserSettingsSchema.safeParse(raw);
      if (!result.success) {
        logger.warn('Invalid user settings, using defaults', {
          path: this.settingsPath,
          errors: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
        return {};
      }

      // Cache settings
      this.settings = result.data;

      logger.info('Loaded Grok user settings', {
        path: this.settingsPath,
        hasApiKey: !!result.data.apiKey,
        defaultModel: result.data.defaultModel,
        modelCount: result.data.availableModels?.length || 0
      });

      return result.data;
    } catch (error) {
      logger.error('Failed to load user settings', {
        error: (error as Error).message,
        path: this.settingsPath
      });
      return {};
    }
  }

  /**
   * Save user settings to disk
   *
   * Uses atomic write pattern (temp file + rename) to prevent corruption.
   *
   * @param settings - Settings object to save
   * @throws Error if validation fails or write fails
   */
  async save(settings: GrokUserSettings): Promise<void> {
    try {
      // Validate before saving
      const result = grokUserSettingsSchema.safeParse(settings);
      if (!result.success) {
        const errors = result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }));
        throw new Error(`Invalid settings: ${JSON.stringify(errors)}`);
      }

      // Ensure directory exists
      const dir = path.dirname(this.settingsPath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Atomic write: temp file + rename
      const tempPath = `${this.settingsPath}.tmp`;
      await fs.promises.writeFile(
        tempPath,
        JSON.stringify(result.data, null, 2),
        'utf-8'
      );
      await fs.promises.rename(tempPath, this.settingsPath);

      // Update cache
      this.settings = result.data;

      logger.info('Saved Grok user settings', {
        path: this.settingsPath
      });
    } catch (error) {
      logger.error('Failed to save user settings', {
        error: (error as Error).message,
        path: this.settingsPath
      });
      throw error;
    }
  }

  /**
   * Merge updates into existing settings
   *
   * Loads current settings, merges updates, and saves.
   *
   * @param updates - Partial settings to merge
   */
  async merge(updates: Partial<GrokUserSettings>): Promise<void> {
    const current = await this.load();
    const merged = { ...current, ...updates };
    await this.save(merged);
  }

  /**
   * Get a specific setting value
   *
   * @param key - Setting key to retrieve
   * @returns Setting value or undefined if not set
   */
  async get<K extends keyof GrokUserSettings>(
    key: K
  ): Promise<GrokUserSettings[K] | undefined> {
    const settings = await this.load();
    return settings[key];
  }

  /**
   * Set a specific setting value
   *
   * @param key - Setting key to update
   * @param value - New value for the setting
   */
  async set<K extends keyof GrokUserSettings>(
    key: K,
    value: GrokUserSettings[K]
  ): Promise<void> {
    await this.merge({ [key]: value } as Partial<GrokUserSettings>);
  }

  /**
   * Check if settings file exists
   *
   * @returns True if file exists, false otherwise
   */
  exists(): boolean {
    return fs.existsSync(this.settingsPath);
  }

  /**
   * Get settings file path
   *
   * @returns Absolute path to settings file
   */
  getPath(): string {
    return this.settingsPath;
  }

  /**
   * Delete settings file
   *
   * Removes the settings file from disk and clears cache.
   */
  async delete(): Promise<void> {
    try {
      if (fs.existsSync(this.settingsPath)) {
        await fs.promises.unlink(this.settingsPath);
        this.settings = null;
        logger.info('Deleted user settings file', {
          path: this.settingsPath
        });
      }
    } catch (error) {
      logger.error('Failed to delete user settings', {
        error: (error as Error).message,
        path: this.settingsPath
      });
      throw error;
    }
  }

  /**
   * Get cached settings (if available)
   *
   * Returns cached settings without reading from disk.
   * Returns null if settings haven't been loaded yet.
   *
   * @returns Cached settings or null
   */
  getCached(): GrokUserSettings | null {
    return this.settings;
  }
}

/**
 * Create a new GrokUserSettingsManager instance
 *
 * Convenience factory function.
 *
 * @param customPath - Optional custom path to settings file
 * @returns New GrokUserSettingsManager instance
 */
export function createGrokUserSettingsManager(customPath?: string): GrokUserSettingsManager {
  return new GrokUserSettingsManager(customPath);
}
