/**
 * Abilities Manager - Load and inject agent abilities from markdown files
 */

import { readFile, readdir } from 'fs/promises';
import { join, extname, basename, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { TTLCache } from '../core/cache.js';

// Get the directory of this file for locating built-in abilities
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package root - handle both dev (src/) and prod (dist/) scenarios
function getPackageRoot(): string {
  const currentDir = __dirname;
  // Use path.sep-independent check for cross-platform compatibility
  if (currentDir.includes(`${sep}dist`) || currentDir.includes('/dist')) {
    return join(currentDir, '..');
  } else {
    return join(currentDir, '../..');
  }
}

/**
 * Abilities Manager - Load and manage agent abilities
 */
export class AbilitiesManager {
  private abilitiesDir: string;
  private fallbackAbilitiesDir: string;
  private cache: TTLCache<string>;

  constructor(abilitiesDir: string, fallbackAbilitiesDir?: string) {
    this.abilitiesDir = abilitiesDir;
    // Default fallback to built-in examples/abilities
    this.fallbackAbilitiesDir = fallbackAbilitiesDir || join(getPackageRoot(), 'examples/abilities');
    // Use TTLCache with 10 minute TTL for abilities (they change less frequently)
    this.cache = new TTLCache<string>({
      maxEntries: 50,
      ttl: 600000, // 10 minutes
      maxSize: 5 * 1024 * 1024, // 5MB total cache size
      cleanupInterval: 120000, // Cleanup every 2 minutes
      debug: false
    });
  }

  /**
   * Load a single ability by name
   */
  async loadAbility(name: string): Promise<string> {
    // Security: Validate ability name to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      logger.warn('Invalid ability name rejected', { name });
      throw new Error(`Invalid ability name: ${name}. Only alphanumeric characters, dashes, and underscores are allowed.`);
    }

    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      logger.debug('Ability loaded from cache', { name });
      return cached;
    }

    // Try primary directory first, then fallback
    const paths = [
      join(this.abilitiesDir, `${name}.md`),
      join(this.fallbackAbilitiesDir, `${name}.md`)
    ];

    for (const abilityPath of paths) {
      try {
        const content = await readFile(abilityPath, 'utf-8');

        // Security: Limit file size to prevent DoS (max 500KB for ability)
        if (content.length > 500 * 1024) {
          throw new Error('Ability file too large (max 500KB)');
        }

        // Cache it
        this.cache.set(name, content);

        logger.trace('Ability loaded', { name, path: abilityPath });
        return content;

      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Try next path
          continue;
        }
        throw error;
      }
    }

    // If not found in any location, log debug and return empty string
    // This is expected behavior - not all agents have all abilities
    logger.debug('Ability not found in any location', { name });
    return ''; // Return empty string for missing abilities
  }

  /**
   * Load multiple abilities
   */
  async loadAbilities(names: string[]): Promise<Map<string, string>> {
    const abilities = new Map<string, string>();

    // v5.7.0: Parallel loading for better performance (60-80% faster)
    // Load all abilities in parallel using Promise.all
    const results = await Promise.all(
      names.map(async (name) => {
        try {
          const content = await this.loadAbility(name);
          return { name, content };
        } catch (error) {
          logger.warn('Failed to load ability', {
            name,
            error: (error as Error).message
          });
          return { name, content: null };
        }
      })
    );

    // Populate map with successfully loaded abilities
    for (const { name, content } of results) {
      if (content) {
        abilities.set(name, content);
      }
    }

    return abilities;
  }

  /**
   * Get concatenated abilities text
   */
  async getAbilitiesText(names: string[]): Promise<string> {
    const abilities = await this.loadAbilities(names);

    if (abilities.size === 0) {
      return '';
    }

    // Concatenate all abilities with section headers
    const sections: string[] = [];

    for (const [name, content] of abilities.entries()) {
      sections.push(`## Ability: ${name}\n\n${content}`);
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * List all available abilities
   */
  async listAbilities(): Promise<string[]> {
    try {
      const files = await readdir(this.abilitiesDir);

      const abilities = files
        .filter(file => extname(file) === '.md')
        .map(file => basename(file, extname(file)));

      return abilities.sort();

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
