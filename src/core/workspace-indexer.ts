/**
 * Workspace Indexer - Fast file tree indexing for smart context selection
 *
 * Inspired by Claude Code's /init - NO embeddings, just fast keyword search
 *
 * @version 8.5.0
 * @since 2025-11-17
 */

import Database from 'better-sqlite3';
import { glob } from 'glob';
import { readFile, stat } from 'fs/promises';
import { join, parse } from 'path';
import { logger } from '../shared/logging/logger.js';
import { DatabaseFactory } from '../core/database/factory.js';

/**
 * File metadata stored in index
 */
export interface FileEntry {
  id?: number;
  path: string;              // Relative to project root
  type: FileType;            // 'source' | 'config' | 'doc' | 'asset'
  language?: string;         // 'typescript', 'javascript', 'python', etc.
  size: number;              // Bytes
  lastModified: number;      // Unix timestamp (seconds)
  importance: number;        // 0-1 score
}

export type FileType = 'source' | 'config' | 'doc' | 'asset' | 'test';

/**
 * Project summary metadata
 */
export interface ProjectSummary {
  name: string;
  version: string;
  framework?: string;        // Detected framework (Next.js, React, etc.)
  language: string;          // Primary language
  entryPoints: string[];     // Main entry files
  configFiles: string[];     // Important config files
  totalFiles: number;
  totalSize: number;         // Total size in bytes
  indexedAt: number;         // Unix timestamp
}

/**
 * Index statistics
 */
export interface IndexStats {
  totalFiles: number;
  sourceFiles: number;
  configFiles: number;
  docFiles: number;
  totalSize: number;
  lastIndexed: number;
}

/**
 * Indexing options
 */
export interface IndexOptions {
  force?: boolean;           // Rebuild from scratch
  fast?: boolean;            // Skip detailed analysis
  maxFiles?: number;         // Limit for large repos
  ignorePatterns?: string[]; // Additional ignore patterns
}

/**
 * File selection options
 */
export interface SelectionOptions {
  maxFiles?: number;         // Max files to return (default: 10)
  includeTests?: boolean;    // Include test files (default: false)
  includeRecent?: boolean;   // Boost recently modified (default: true)
  minImportance?: number;    // Min importance score (default: 0)
}

/**
 * Default ignore patterns (like .gitignore)
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.automatosx/**',
  'coverage/**',
  '.next/**',
  '.nuxt/**',
  '.cache/**',
  '**/*.min.js',
  '**/*.map',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

/**
 * Language detection map
 */
const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell'
};

/**
 * Workspace Indexer - Fast file tree indexing
 *
 * NO embeddings, NO AI - just smart heuristics and keyword search
 */
export class WorkspaceIndexer {
  private db: Database.Database;
  private projectRoot: string;
  private ignorePatterns: string[];

  constructor(projectRoot: string, options?: { dbPath?: string }) {
    this.projectRoot = projectRoot;

    // Database path: .automatosx/workspace/index.db
    const dbPath = options?.dbPath || join(projectRoot, '.automatosx', 'workspace', 'index.db');

    // v9.0.2: Use DatabaseFactory for standardized initialization
    this.db = DatabaseFactory.create(dbPath, {
      enableWal: true,
      createDir: true
    });
    this.ignorePatterns = DEFAULT_IGNORE_PATTERNS;

    this.initSchema();

    logger.debug('WorkspaceIndexer initialized', {
      projectRoot,
      dbPath
    });
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      -- Files table
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        language TEXT,
        size INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
      CREATE INDEX IF NOT EXISTS idx_files_importance ON files(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_files_modified ON files(last_modified DESC);

      -- FTS5 full-text search on file paths
      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
        path,
        content='files',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
        INSERT INTO files_fts(rowid, path) VALUES (new.id, new.path);
      END;

      CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, path) VALUES('delete', old.id, old.path);
      END;

      CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, path) VALUES('delete', old.id, old.path);
        INSERT INTO files_fts(rowid, path) VALUES (new.id, new.path);
      END;

      -- Project metadata (key-value store)
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);

    logger.debug('Database schema initialized');
  }

  /**
   * Index the workspace
   */
  async index(options?: IndexOptions): Promise<IndexStats> {
    const startTime = Date.now();

    logger.info('Starting workspace indexing', {
      projectRoot: this.projectRoot,
      force: options?.force
    });

    // Clear existing index if force rebuild
    if (options?.force) {
      logger.debug('Force rebuild - clearing existing index');
      this.db.exec('DELETE FROM files');
      this.db.exec('DELETE FROM metadata');
    }

    // Scan files
    const files = await this.scanFiles(options);

    logger.info('Files scanned', { count: files.length });

    // Insert files in transaction (fast!)
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, type, language, size, last_modified, importance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);

    const insertMany = this.db.transaction((entries: FileEntry[]) => {
      for (const entry of entries) {
        insert.run(
          entry.path,
          entry.type,
          entry.language || null,
          entry.size,
          entry.lastModified,
          entry.importance
        );
      }
    });

    insertMany(files);

    // Build and save project summary
    const summary = await this.buildProjectSummary();
    this.saveMetadata('summary', summary);

    const duration = Date.now() - startTime;
    const stats = await this.getStats();

    logger.info('Workspace indexing complete', {
      duration: `${duration}ms`,
      stats
    });

    return stats;
  }

  /**
   * Scan files in project
   */
  private async scanFiles(options?: IndexOptions): Promise<FileEntry[]> {
    const patterns = '**/*';
    const ignore = [...this.ignorePatterns, ...(options?.ignorePatterns || [])];

    // Use glob to find files
    const filePaths = await glob(patterns, {
      cwd: this.projectRoot,
      ignore,
      nodir: true,
      dot: false,
      absolute: false,
      maxDepth: 20
    });

    logger.debug('Glob scan complete', { fileCount: filePaths.length });

    // Apply maxFiles limit if specified
    const limitedPaths = options?.maxFiles
      ? filePaths.slice(0, options.maxFiles)
      : filePaths;

    // Process each file
    const entries: FileEntry[] = [];
    for (const relativePath of limitedPaths) {
      try {
        const entry = await this.createFileEntry(relativePath);
        entries.push(entry);
      } catch (error) {
        logger.warn('Failed to process file', {
          path: relativePath,
          error: (error as Error).message
        });
      }
    }

    return entries;
  }

  /**
   * Create file entry with metadata
   */
  private async createFileEntry(relativePath: string): Promise<FileEntry> {
    const fullPath = join(this.projectRoot, relativePath);
    const stats = await stat(fullPath);
    const ext = parse(relativePath).ext;

    // Detect type and language
    const { type, language } = this.detectTypeAndLanguage(relativePath, ext);

    // Calculate importance
    const importance = this.calculateImportance(relativePath, type, stats.size);

    return {
      path: relativePath,
      type,
      language,
      size: stats.size,
      lastModified: Math.floor(stats.mtimeMs / 1000),
      importance
    };
  }

  /**
   * Detect file type and language
   */
  private detectTypeAndLanguage(path: string, ext: string): {
    type: FileType;
    language?: string;
  } {
    // Config files
    if (path.match(/package\.json|tsconfig\.json|\.config\.(js|ts|json|yaml|yml)|\.eslintrc|\.prettierrc/)) {
      return { type: 'config', language: 'json' };
    }

    // Test files
    if (path.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/) || path.includes('__tests__')) {
      const lang = LANGUAGE_MAP[ext];
      return { type: 'test', language: lang };
    }

    // Source code
    if (ext in LANGUAGE_MAP) {
      return { type: 'source', language: LANGUAGE_MAP[ext] };
    }

    // Documentation
    if (ext === '.md' || ext === '.mdx' || ext === '.txt') {
      return { type: 'doc' };
    }

    // Everything else is asset
    return { type: 'asset' };
  }

  /**
   * Calculate importance score (0-1)
   *
   * Higher score = more likely to be relevant
   */
  private calculateImportance(path: string, type: FileType, size: number): number {
    let score = 0.5; // Default

    // Entry points (highest priority)
    if (path.match(/^(index|main|app)\.(ts|js|tsx|jsx)$/)) score = 1.0;
    if (path.match(/^src\/(index|main|app)\.(ts|js|tsx|jsx)$/)) score = 0.95;
    if (path.match(/^src\/cli\/(index|main)\.(ts|js)$/)) score = 0.9;

    // Config files (high priority)
    if (type === 'config') score = 0.85;

    // Core directories (boost)
    if (path.includes('/core/')) score += 0.15;
    if (path.includes('/types/')) score += 0.1;
    if (path.includes('/utils/')) score += 0.05;

    // Tests (lower priority)
    if (type === 'test') score = Math.max(0.3, score - 0.3);

    // Docs (lower priority)
    if (type === 'doc') score = Math.max(0.4, score - 0.2);

    // Large files (slightly boost - likely important)
    if (size > 10000) score += 0.05;
    if (size > 50000) score += 0.05;

    // Very small files (likely not important)
    if (size < 100) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Build project summary from package.json and files
   */
  private async buildProjectSummary(): Promise<ProjectSummary> {
    try {
      const pkgPath = join(this.projectRoot, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      // Detect framework
      const framework = this.detectFramework(pkg);

      // Get entry points
      const entryPoints = this.getEntryPoints(pkg);

      // Get config files
      const configFiles = this.getConfigFiles();

      // Get total stats
      const totalStats = this.db.prepare(`
        SELECT COUNT(*) as count, SUM(size) as totalSize FROM files
      `).get() as { count: number; totalSize: number };

      return {
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
        framework,
        language: 'TypeScript', // TODO: Auto-detect from files
        entryPoints,
        configFiles,
        totalFiles: totalStats.count,
        totalSize: totalStats.totalSize,
        indexedAt: Math.floor(Date.now() / 1000)
      };
    } catch (error) {
      logger.warn('Failed to build project summary', { error });
      return {
        name: 'unknown',
        version: '0.0.0',
        language: 'unknown',
        entryPoints: [],
        configFiles: [],
        totalFiles: 0,
        totalSize: 0,
        indexedAt: Math.floor(Date.now() / 1000)
      };
    }
  }

  /**
   * Detect framework from package.json dependencies
   */
  private detectFramework(pkg: any): string | undefined {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next) return 'Next.js';
    if (deps.react) return 'React';
    if (deps.vue) return 'Vue';
    if (deps['@angular/core']) return 'Angular';
    if (deps.express) return 'Express';
    if (deps.fastify) return 'Fastify';
    if (deps.nestjs) return 'NestJS';

    return undefined;
  }

  /**
   * Get entry points from package.json
   */
  private getEntryPoints(pkg: any): string[] {
    const entryPoints: string[] = [];

    if (pkg.main) entryPoints.push(pkg.main);
    if (pkg.module) entryPoints.push(pkg.module);
    if (pkg.bin) {
      if (typeof pkg.bin === 'string') {
        entryPoints.push(pkg.bin);
      } else {
        const binValues = Object.values(pkg.bin).filter((v): v is string => typeof v === 'string');
        entryPoints.push(...binValues);
      }
    }

    return entryPoints;
  }

  /**
   * Get config files from index
   */
  private getConfigFiles(): string[] {
    const result = this.db.prepare(`
      SELECT path FROM files WHERE type = 'config' ORDER BY importance DESC LIMIT 10
    `).all() as { path: string }[];

    return result.map(r => r.path);
  }

  /**
   * Select relevant files for a task using keyword matching
   *
   * NO embeddings - just smart heuristics!
   */
  async selectRelevantFiles(task: string, options?: SelectionOptions): Promise<string[]> {
    const maxFiles = options?.maxFiles || 10;
    const includeTests = options?.includeTests || false;
    const includeRecent = options?.includeRecent !== false; // Default true
    const minImportance = options?.minImportance || 0;

    // Extract keywords from task
    const keywords = this.extractKeywords(task);

    logger.debug('Selecting relevant files', { keywords, maxFiles });

    // Build SQL query
    let query = `
      SELECT DISTINCT f.path, f.importance, f.last_modified, f.type
      FROM files f
      WHERE f.importance >= ?
    `;

    const params: any[] = [minImportance];

    // Exclude tests unless explicitly included
    if (!includeTests) {
      query += ` AND f.type != 'test'`;
    }

    // Keyword matching using FTS5
    if (keywords.length > 0) {
      query = `
        SELECT DISTINCT f.path, f.importance, f.last_modified, f.type
        FROM files f
        INNER JOIN files_fts fts ON f.id = fts.rowid
        WHERE fts.path MATCH ?
        AND f.importance >= ?
      `;
      params.unshift(keywords.join(' OR '));
    }

    // Add scoring logic
    query += `
      ORDER BY
        f.importance DESC,
        ${includeRecent ? 'f.last_modified DESC,' : ''}
        f.path ASC
      LIMIT ?
    `;
    params.push(maxFiles * 2); // Get more candidates for scoring

    const candidates = this.db.prepare(query).all(...params) as FileEntry[];

    logger.debug('File candidates found', { count: candidates.length });

    // Score and rank
    const scored = candidates.map(file => ({
      path: file.path,
      score: this.scoreFileRelevance(file, keywords, includeRecent)
    }));

    // Sort by score and return top N
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, maxFiles).map(s => s.path);

    logger.debug('Selected relevant files', {
      count: selected.length,
      files: selected
    });

    return selected;
  }

  /**
   * Score file relevance to task
   */
  private scoreFileRelevance(file: FileEntry, keywords: string[], includeRecent: boolean): number {
    let score = file.importance * 2; // Base score from importance

    // Keyword matching boost
    const pathLower = file.path.toLowerCase();
    for (const keyword of keywords) {
      if (pathLower.includes(keyword)) {
        score += 1.5; // Strong boost for keyword match
      }
    }

    // Recent file boost (modified in last 7 days)
    if (includeRecent) {
      const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      if (file.lastModified > weekAgo) {
        score += 0.5;
      }
    }

    return score;
  }

  /**
   * Extract keywords from task description
   *
   * Simple but effective - no NLP needed
   */
  private extractKeywords(text: string): string[] {
    // Common stop words to ignore
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => word.length > 2) // Min 3 chars
      .filter(word => !stopWords.has(word))
      .filter(word => !/^\d+$/.test(word)); // Remove pure numbers
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    const result = this.db.prepare(`
      SELECT
        COUNT(*) as totalFiles,
        SUM(CASE WHEN type = 'source' THEN 1 ELSE 0 END) as sourceFiles,
        SUM(CASE WHEN type = 'config' THEN 1 ELSE 0 END) as configFiles,
        SUM(CASE WHEN type = 'doc' THEN 1 ELSE 0 END) as docFiles,
        SUM(size) as totalSize
      FROM files
    `).get() as {
      totalFiles: number;
      sourceFiles: number;
      configFiles: number;
      docFiles: number;
      totalSize: number;
    };

    const metadata = this.loadMetadata('summary');
    const lastIndexed = metadata ? metadata.indexedAt : 0;

    return {
      ...result,
      lastIndexed
    };
  }

  /**
   * Save metadata to database
   */
  private saveMetadata(key: string, value: any): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `).run(key, JSON.stringify(value));
  }

  /**
   * Load metadata from database
   */
  private loadMetadata(key: string): any {
    const result = this.db.prepare(`
      SELECT value FROM metadata WHERE key = ?
    `).get(key) as { value: string } | undefined;

    return result ? JSON.parse(result.value) : null;
  }

  /**
   * Get project summary
   */
  getProjectSummary(): ProjectSummary | null {
    return this.loadMetadata('summary');
  }

  /**
   * Check if index exists
   */
  async exists(): Promise<boolean> {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
      return result.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.debug('WorkspaceIndexer closed');
  }
}
