/**
 * Grok Project Instructions Loader (v8.6.0)
 *
 * Manages .grok/GROK.md project-specific instructions.
 * Provides CRUD operations with validation and atomic writes.
 *
 * @module integrations/grok-cli/project-instructions-loader
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger.js';

/**
 * Grok Project Instructions Schema
 * Validates GROK.md content structure
 */
const grokProjectInstructionsSchema = z.object({
  content: z.string().min(1).describe('Project instructions markdown content')
}).describe('Grok project instructions');

/**
 * Grok Project Instructions Type
 * Inferred from Zod schema for type safety
 */
export type GrokProjectInstructions = z.infer<typeof grokProjectInstructionsSchema>;

/**
 * Grok Project Instructions Loader
 *
 * Manages project-specific instructions in .grok/GROK.md
 *
 * Features:
 * - Atomic file writes (temp file + rename pattern)
 * - Zod validation for content
 * - Comprehensive error handling
 * - Type-safe operations
 */
export class GrokProjectInstructionsLoader {
  private instructionsPath: string;
  private instructions: string | null = null;

  /**
   * Create a new GrokProjectInstructionsLoader
   *
   * @param customPath - Optional custom path to GROK.md file (for testing)
   */
  constructor(customPath?: string) {
    this.instructionsPath = customPath || path.join(
      process.cwd(),
      '.grok',
      'GROK.md'
    );

    logger.debug('GrokProjectInstructionsLoader initialized', {
      path: this.instructionsPath
    });
  }

  /**
   * Load project instructions from disk
   *
   * @returns Project instructions content (empty string if file doesn't exist)
   */
  async load(): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(this.instructionsPath)) {
        logger.debug('Project instructions file not found', {
          path: this.instructionsPath
        });
        return '';
      }

      // Read file content
      const content = await fs.promises.readFile(this.instructionsPath, 'utf-8');

      // Validate with Zod
      const result = grokProjectInstructionsSchema.safeParse({ content });
      if (!result.success) {
        logger.warn('Invalid project instructions, using empty', {
          path: this.instructionsPath,
          errors: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
        return '';
      }

      // Cache content
      this.instructions = result.data.content;

      logger.info('Loaded Grok project instructions', {
        path: this.instructionsPath,
        length: result.data.content.length
      });

      return result.data.content;
    } catch (error) {
      logger.error('Failed to load project instructions', {
        error: (error as Error).message,
        path: this.instructionsPath
      });
      return '';
    }
  }

  /**
   * Create/save project instructions to disk
   *
   * Uses atomic write pattern (temp file + rename) to prevent corruption.
   *
   * @param content - Markdown content to save
   * @throws Error if validation fails or write fails
   */
  async create(content: string): Promise<void> {
    try {
      // Validate before saving
      const result = grokProjectInstructionsSchema.safeParse({ content });
      if (!result.success) {
        const errors = result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }));
        throw new Error(`Invalid instructions: ${JSON.stringify(errors)}`);
      }

      // Ensure directory exists
      const dir = path.dirname(this.instructionsPath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Atomic write: temp file + rename
      const tempPath = `${this.instructionsPath}.tmp`;
      await fs.promises.writeFile(
        tempPath,
        result.data.content,
        'utf-8'
      );
      await fs.promises.rename(tempPath, this.instructionsPath);

      // Update cache
      this.instructions = result.data.content;

      logger.info('Saved Grok project instructions', {
        path: this.instructionsPath,
        length: content.length
      });
    } catch (error) {
      logger.error('Failed to save project instructions', {
        error: (error as Error).message,
        path: this.instructionsPath
      });
      throw error;
    }
  }

  /**
   * Check if instructions file exists
   *
   * @returns True if file exists, false otherwise
   */
  exists(): boolean {
    return fs.existsSync(this.instructionsPath);
  }

  /**
   * Get instructions file path
   *
   * @returns Absolute path to GROK.md file
   */
  getPath(): string {
    return this.instructionsPath;
  }

  /**
   * Delete instructions file
   *
   * Removes the GROK.md file from disk and clears cache.
   */
  async delete(): Promise<void> {
    try {
      if (fs.existsSync(this.instructionsPath)) {
        await fs.promises.unlink(this.instructionsPath);
        this.instructions = null;
        logger.info('Deleted project instructions file', {
          path: this.instructionsPath
        });
      }
    } catch (error) {
      logger.error('Failed to delete project instructions', {
        error: (error as Error).message,
        path: this.instructionsPath
      });
      throw error;
    }
  }

  /**
   * Get cached instructions (if available)
   *
   * Returns cached content without reading from disk.
   * Returns null if instructions haven't been loaded yet.
   *
   * @returns Cached instructions or null
   */
  getCached(): string | null {
    return this.instructions;
  }
}

/**
 * Create a new GrokProjectInstructionsLoader instance
 *
 * Convenience factory function.
 *
 * @param customPath - Optional custom path to GROK.md file
 * @returns New GrokProjectInstructionsLoader instance
 */
export function createGrokProjectInstructionsLoader(customPath?: string): GrokProjectInstructionsLoader {
  return new GrokProjectInstructionsLoader(customPath);
}
