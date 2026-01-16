/**
 * Ability Loader
 *
 * Loads abilities from markdown files.
 * Format: Each .md file is an ability with YAML frontmatter for metadata.
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import type { Ability } from '@defai.digital/contracts';
import { validateAbility } from '@defai.digital/contracts';
import type { AbilityLoader, AbilityLoaderConfig } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EXTENSIONS = ['.md'];

// ============================================================================
// File System Ability Loader
// ============================================================================

/**
 * Loads abilities from markdown files
 */
export class FileSystemAbilityLoader implements AbilityLoader {
  private readonly config: Required<AbilityLoaderConfig>;
  private cache = new Map<string, Ability>();
  private loaded = false;

  constructor(config: AbilityLoaderConfig) {
    this.config = {
      abilitiesDir: config.abilitiesDir,
      extensions: config.extensions ?? DEFAULT_EXTENSIONS,
    };
  }

  async load(abilityId: string): Promise<Ability | undefined> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.get(abilityId);
  }

  async loadAll(): Promise<Ability[]> {
    this.cache.clear();

    const dirPath = this.config.abilitiesDir;
    const abilities: Ability[] = [];

    // Read directory with file types to filter out directories
    // Handle missing/inaccessible directory gracefully
    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'EACCES' || code === 'ENOTDIR') {
        this.loaded = true;
        return [];
      }
      throw err;
    }

    // Filter to only files with matching extensions
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => this.config.extensions.includes(path.extname(name).toLowerCase()));

    // Load all files in parallel for better performance
    const loadResults = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dirPath, file);
        const ability = await this.loadFile(filePath, file);
        return { file, ability };
      })
    );

    // Process results sequentially to handle duplicates consistently
    for (const { file, ability } of loadResults) {
      if (ability) {
        if (this.cache.has(ability.abilityId)) {
          console.warn(
            `Duplicate ability ID "${ability.abilityId}" in ${file}, skipping`
          );
          continue;
        }

        this.cache.set(ability.abilityId, ability);
        abilities.push(ability);
      }
    }

    this.loaded = true;
    return abilities;
  }

  async exists(abilityId: string): Promise<boolean> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.has(abilityId);
  }

  async reload(): Promise<void> {
    this.loaded = false;
    await this.loadAll();
  }

  /**
   * Load an ability from a markdown file
   */
  private async loadFile(
    filePath: string,
    fileName: string
  ): Promise<Ability | undefined> {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const { metadata, body } = this.parseMarkdown(content);

      // Generate ability ID from filename if not in metadata
      const abilityId = typeof metadata.abilityId === 'string'
        ? metadata.abilityId
        : fileName.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const ability: Ability = {
        abilityId,
        displayName: typeof metadata.displayName === 'string' ? metadata.displayName : this.titleCase(abilityId),
        version: typeof metadata.version === 'string' ? metadata.version : undefined,
        description: typeof metadata.description === 'string' ? metadata.description : undefined,
        category: typeof metadata.category === 'string' ? metadata.category : undefined,
        tags: Array.isArray(metadata.tags) ? metadata.tags as string[] : undefined,
        content: body.trim(),
        author: typeof metadata.author === 'string' ? metadata.author : undefined,
        source: typeof metadata.source === 'string' ? metadata.source : undefined,
        requires: Array.isArray(metadata.requires) ? metadata.requires as string[] : undefined,
        conflicts: Array.isArray(metadata.conflicts) ? metadata.conflicts as string[] : undefined,
        applicableTo: Array.isArray(metadata.applicableTo) ? metadata.applicableTo as string[] : undefined,
        excludeFrom: Array.isArray(metadata.excludeFrom) ? metadata.excludeFrom as string[] : undefined,
        priority: typeof metadata.priority === 'number' ? metadata.priority : 50,
        enabled: typeof metadata.enabled === 'boolean' ? metadata.enabled : true,
      };

      // Validate
      return validateAbility(ability);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to load ability from ${filePath}: ${message}`);
      return undefined;
    }
  }

  /**
   * Parse markdown with optional YAML frontmatter
   */
  private parseMarkdown(content: string): {
    metadata: Record<string, unknown>;
    body: string;
  } {
    // Normalize Windows line endings to Unix for cross-platform compatibility
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = frontmatterRegex.exec(normalizedContent);

    if (!match) {
      return { metadata: {}, body: normalizedContent };
    }

    const frontmatter = match[1] ?? '';
    const body = match[2] ?? '';

    // Simple YAML parser for frontmatter
    const metadata: Record<string, unknown> = {};
    const lines = frontmatter.split('\n');

    let currentKey: string | null = null;
    let currentArray: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Check if this is a YAML array item (starts with "  - " or "- ")
      const arrayItemMatch = /^\s+-\s+(.*)$/.exec(line);
      if (arrayItemMatch && currentKey !== null && currentArray !== null) {
        const itemValue = arrayItemMatch[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
        currentArray.push(itemValue);
        continue;
      }

      // If we were building an array and hit a non-array line, save it
      if (currentKey !== null && currentArray !== null) {
        metadata[currentKey] = currentArray;
        currentKey = null;
        currentArray = null;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value: unknown = line.substring(colonIndex + 1).trim();

      // Check if this starts a multi-line array
      if (value === '') {
        // Look ahead to see if next line is an array item
        const nextLine = lines[i + 1];
        if (nextLine !== undefined && /^\s+-\s+/.test(nextLine)) {
          currentKey = key;
          currentArray = [];
          continue;
        }
        // Empty value, skip
        continue;
      }

      // Parse booleans
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
      // Parse arrays (simple inline format)
      else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
        value = (value as string)
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      }

      metadata[key] = value;
    }

    // Don't forget to save any trailing array
    if (currentKey !== null && currentArray !== null) {
      metadata[currentKey] = currentArray;
    }

    return { metadata, body };
  }

  /**
   * Convert kebab-case to Title Case
   */
  private titleCase(str: string): string {
    return str
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

/**
 * Creates a file system ability loader
 */
export function createAbilityLoader(config: AbilityLoaderConfig): AbilityLoader {
  return new FileSystemAbilityLoader(config);
}
