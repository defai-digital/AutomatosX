/**
 * SpecLoader - Markdown spec file parser
 *
 * Parses spec.md, plan.md, and tasks.md files
 * Supports multiple task formats and incremental parsing
 *
 * @module core/spec/SpecLoader
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type {
  SpecLoaderOptions,
  ParsedSpec,
  SpecMetadata,
  SpecTask,
  TaskStatus,
  SpecError,
  SpecErrorCode
} from '../../types/spec.js';
import { SpecError as SpecErrorClass } from '../../types/spec.js';
import { logger } from '../../utils/logger.js';

/**
 * Task format regex patterns
 */
const TASK_PATTERNS = {
  // Format 1: Inline attributes
  // - [ ] id:auth:setup ops:"ax run backend 'Setup'" dep:core:init labels:auth,backend
  inline: /^-\s*\[([ x])\]\s+id:(\S+)\s+ops:"([^"]+)"\s*(?:dep:(\S+))?\s*(?:labels:(\S+))?/,

  // Format 2: Simpler inline
  // - [ ] id:auth:setup ops:"command" dep:dep1,dep2
  simple: /^-\s*\[([ x])\]\s+id:(\S+)\s+ops:"([^"]+)"(?:\s+dep:([^"\s]+))?/,

  // Format 3: Very simple (just ID and ops)
  // - [ ] id:auth:setup ops:"command"
  minimal: /^-\s*\[([ x])\]\s+id:(\S+)\s+ops:"([^"]+)"/
};

/**
 * Default loader options
 */
const DEFAULT_OPTIONS: Partial<SpecLoaderOptions> = {
  specDir: '.specify',
  watch: false,
  parseOptions: {
    strict: false,
    maxFileSize: 10 * 1024 * 1024 // 10MB
  }
};

/**
 * SpecLoader class
 * Handles parsing of spec files
 */
export class SpecLoader {
  private options: SpecLoaderOptions;
  private workspacePath: string;
  private specDir: string;

  constructor(options: SpecLoaderOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.workspacePath = options.workspacePath;
    this.specDir = join(this.workspacePath, this.options.specDir || '.specify');
  }

  /**
   * Load and parse all spec files
   */
  async load(): Promise<ParsedSpec> {
    try {
      logger.info('Loading spec files', { specDir: this.specDir });

      // Check if spec directory exists
      const files = await this.getSpecFiles();

      // Read all files
      const [specContent, planContent, tasksContent] = await Promise.all([
        this.readFile(files.spec),
        this.readFile(files.plan),
        this.readFile(files.tasks)
      ]);

      // Calculate checksum
      const checksum = this.calculateChecksum(specContent, planContent, tasksContent);

      // Parse tasks
      const tasks = this.parseTasks(tasksContent);

      // Create metadata
      const metadata: SpecMetadata = {
        id: this.generateSpecId(checksum),
        version: this.extractVersion(specContent) || '1.0.0',
        checksum,
        workspacePath: this.workspacePath,
        files,
        tags: this.extractTags(specContent),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Spec loaded successfully', {
        specId: metadata.id,
        taskCount: tasks.length,
        checksum
      });

      return {
        metadata,
        content: {
          spec: specContent,
          plan: planContent,
          tasks: tasksContent
        },
        tasks
      };

    } catch (error) {
      logger.error('Failed to load spec', {
        error: (error as Error).message,
        specDir: this.specDir
      });
      throw this.wrapError(error as Error);
    }
  }

  /**
   * Get spec file paths
   */
  private async getSpecFiles(): Promise<{ spec: string; plan: string; tasks: string }> {
    const files = {
      spec: join(this.specDir, 'spec.md'),
      plan: join(this.specDir, 'plan.md'),
      tasks: join(this.specDir, 'tasks.md')
    };

    // Verify all files exist
    await Promise.all(
      Object.entries(files).map(async ([name, path]) => {
        try {
          const stats = await stat(path);
          if (!stats.isFile()) {
            throw new Error(`${name}.md is not a file`);
          }

          // Check file size
          const maxSize = this.options.parseOptions?.maxFileSize || 10 * 1024 * 1024;
          if (stats.size > maxSize) {
            throw new SpecErrorClass(
              'PARSE_ERROR' as SpecErrorCode,
              `File too large: ${name}.md (${stats.size} bytes, max: ${maxSize} bytes)`
            );
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new SpecErrorClass(
              'SPEC_NOT_FOUND' as SpecErrorCode,
              `Required file not found: ${name}.md`,
              { path, file: name }
            );
          }
          throw error;
        }
      })
    );

    return files;
  }

  /**
   * Read file with error handling
   */
  private async readFile(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch (error) {
      throw new SpecErrorClass(
        'PARSE_ERROR' as SpecErrorCode,
        `Failed to read file: ${path}`,
        { path, error: (error as Error).message }
      );
    }
  }

  /**
   * Parse tasks from tasks.md
   */
  private parseTasks(content: string): SpecTask[] {
    const tasks: SpecTask[] = [];
    const lines = content.split('\n');
    const seenIds = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const lineNum = i + 1;

      // Try each pattern
      let match = TASK_PATTERNS.inline.exec(line);
      let format = 'inline';

      if (!match) {
        match = TASK_PATTERNS.simple.exec(line);
        format = 'simple';
      }

      if (!match) {
        match = TASK_PATTERNS.minimal.exec(line);
        format = 'minimal';
      }

      if (match) {
        const [, checked, id, ops, deps, labels] = match;

        // Skip if missing required fields
        if (!id || !ops) {
          logger.warn('Skipping task with missing required fields', { line: lineNum });
          continue;
        }

        // Check for duplicate IDs
        if (seenIds.has(id)) {
          if (this.options.parseOptions?.strict) {
            throw new SpecErrorClass(
              'DUPLICATE_TASK_ID' as SpecErrorCode,
              `Duplicate task ID: ${id}`,
              { taskId: id, line: lineNum }
            );
          } else {
            logger.warn('Duplicate task ID found', { taskId: id, line: lineNum });
            continue;
          }
        }
        seenIds.add(id);

        // Parse status
        const status: TaskStatus = checked === 'x' ? 'completed' : 'pending';

        // Parse dependencies (comma-separated only, preserve colons in task IDs)
        const taskDeps = deps
          ? deps.split(',').map(d => d.trim()).filter(Boolean)
          : [];

        // Parse labels
        const taskLabels = labels
          ? labels.split(',').map(l => l.trim()).filter(Boolean)
          : [];

        // Extract assignee hint from ops (e.g., "ax run backend" -> "backend")
        const assigneeHint = this.extractAssignee(ops);

        tasks.push({
          id,
          title: this.extractTitle(ops),
          ops,
          deps: taskDeps,
          status,
          assigneeHint,
          labels: taskLabels,
          line: lineNum,
          metadata: { format }
        });

        logger.debug('Parsed task', { id, status, deps: taskDeps.length, line: lineNum });
      }
    }

    logger.info('Tasks parsed', { count: tasks.length });
    return tasks;
  }

  /**
   * Extract assignee hint from ops command
   */
  private extractAssignee(ops: string): string | undefined {
    // Pattern: ax run <agent> "task"
    const match = /ax\s+run\s+(\w+)/.exec(ops);
    return match ? match[1] : undefined;
  }

  /**
   * Extract title from ops command
   */
  private extractTitle(ops: string): string {
    // Try to extract quoted text
    const quotedMatch = /"([^"]+)"/.exec(ops);
    if (quotedMatch && quotedMatch[1]) {
      return quotedMatch[1];
    }

    // Try to extract single-quoted text
    const singleQuotedMatch = /'([^']+)'/.exec(ops);
    if (singleQuotedMatch && singleQuotedMatch[1]) {
      return singleQuotedMatch[1];
    }

    // Fallback: use ops as-is
    return ops;
  }

  /**
   * Calculate checksum of all content
   */
  private calculateChecksum(...contents: string[]): string {
    const hash = createHash('sha256');
    contents.forEach(content => hash.update(content));
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Generate spec ID
   */
  private generateSpecId(checksum: string): string {
    const workspaceHash = createHash('sha256')
      .update(this.workspacePath)
      .digest('hex')
      .substring(0, 8);
    return `spec-${workspaceHash}-${checksum}`;
  }

  /**
   * Extract version from spec.md
   */
  private extractVersion(content: string): string | null {
    // Look for version in various formats
    const patterns = [
      /version:\s*(\d+\.\d+\.\d+)/i,
      /v(\d+\.\d+\.\d+)/i,
      /#\s*version\s*(\d+\.\d+\.\d+)/i
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract tags from spec.md
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // Look for tags in various formats
    const patterns = [
      /tags?:\s*\[([^\]]+)\]/i,
      /tags?:\s*([^\n]+)/i,
      /#\s*tags?:?\s*([^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        const tagStr = match[1];
        tags.push(
          ...tagStr
            .split(/[,\s]+/)
            .map(t => t.trim())
            .filter(Boolean)
        );
        break;
      }
    }

    // Common tag inference
    if (content.toLowerCase().includes('feature')) tags.push('feature');
    if (content.toLowerCase().includes('refactor')) tags.push('refactor');
    if (content.toLowerCase().includes('bug')) tags.push('bugfix');

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Wrap errors with SpecError
   */
  private wrapError(error: Error): SpecError {
    if (error instanceof SpecErrorClass) {
      return error;
    }

    return new SpecErrorClass(
      'PARSE_ERROR' as SpecErrorCode,
      `Spec loading failed: ${error.message}`,
      { originalError: error.message }
    );
  }

  /**
   * Static factory method
   */
  static async create(options: SpecLoaderOptions): Promise<SpecLoader> {
    return new SpecLoader(options);
  }

  /**
   * Static load method (convenience)
   */
  static async load(workspacePath: string): Promise<ParsedSpec> {
    const loader = new SpecLoader({ workspacePath });
    return loader.load();
  }
}
