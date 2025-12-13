/**
 * TSProgramManager - Shared TypeScript Program Instance
 *
 * Manages TypeScript program creation with type checker access, caching,
 * and incremental compilation support. Lazy-loads TypeScript to avoid
 * Windows ESM bundling issues.
 *
 * @module core/refactor/semantic/ts-program-manager
 * @since v12.9.0
 */

import { existsSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { logger } from '../../../shared/logging/logger.js';
import type { TSProgramManagerOptions } from './types.js';

// Type-only import for TypeScript API types
import type * as TypeScriptTypes from 'typescript';

// Lazy-loaded TypeScript module
let ts: typeof TypeScriptTypes | null = null;

/**
 * Lazy-load TypeScript module.
 * Avoids bundling issues where ESM shim's fake require() throws errors.
 */
async function loadTypeScript(): Promise<typeof TypeScriptTypes> {
  if (!ts) {
    ts = await import('typescript');
    logger.debug('TypeScript module loaded', { version: ts.version });
  }
  return ts;
}

/**
 * Get TypeScript module (must call loadTypeScript first)
 */
function getTS(): typeof TypeScriptTypes {
  if (!ts) {
    throw new Error('TypeScript not loaded. Call TSProgramManager.init() first.');
  }
  return ts;
}

/**
 * Cached program entry
 */
interface ProgramCacheEntry {
  program: TypeScriptTypes.Program;
  configPath: string;
  createdAt: number;
  fileVersions: Map<string, number>;
  accessedAt: number;
}

/**
 * TSProgramManager - Manages shared TypeScript program instances
 *
 * Features:
 * - Lazy TypeScript loading (Windows ESM compatibility)
 * - tsconfig.json auto-detection
 * - LRU cache with TTL
 * - File version tracking for incremental invalidation
 * - Type checker access
 */
export class TSProgramManager {
  private cache: Map<string, ProgramCacheEntry> = new Map();
  private options: Required<TSProgramManagerOptions>;
  private initialized = false;

  constructor(options: TSProgramManagerOptions) {
    this.options = {
      rootDir: resolve(options.rootDir),
      configPath: options.configPath || '',
      maxProgramAgeMs: options.maxProgramAgeMs ?? 60000,
      enableIncrementalMode: options.enableIncrementalMode ?? true,
      maxCachedPrograms: options.maxCachedPrograms ?? 3,
      includeFiles: options.includeFiles || [],
      excludeFiles: options.excludeFiles || [],
    };
  }

  /**
   * Initialize the manager by loading TypeScript
   */
  async init(): Promise<void> {
    if (!this.initialized) {
      await loadTypeScript();
      this.initialized = true;
      logger.debug('TSProgramManager initialized', {
        rootDir: this.options.rootDir,
      });
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get or create a TypeScript program for the given root
   */
  async getProgram(rootDir?: string): Promise<TypeScriptTypes.Program> {
    if (!this.initialized) {
      await this.init();
    }

    const targetRoot = rootDir ? resolve(rootDir) : this.options.rootDir;
    const configPath = this.findTsConfig(targetRoot);
    const cacheKey = configPath || targetRoot;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      cached.accessedAt = Date.now();
      logger.debug('Using cached TypeScript program', { cacheKey });
      return cached.program;
    }

    // Create new program
    const program = await this.createProgram(configPath, targetRoot);

    // Cache the program
    this.cacheProgram(cacheKey, program, configPath);

    return program;
  }

  /**
   * Get the type checker from a program
   */
  async getTypeChecker(rootDir?: string): Promise<TypeScriptTypes.TypeChecker> {
    const program = await this.getProgram(rootDir);
    return program.getTypeChecker();
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): void {
    const absolutePath = resolve(filePath);

    for (const [key, entry] of this.cache.entries()) {
      const sourceFile = entry.program.getSourceFile(absolutePath);
      if (sourceFile) {
        logger.debug('Invalidating program cache due to file change', {
          file: absolutePath,
          cacheKey: key,
        });
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all cached programs
   */
  invalidateAll(): void {
    this.cache.clear();
    logger.debug('All TypeScript program caches invalidated');
  }

  /**
   * Get all source files from the program
   */
  async getSourceFiles(rootDir?: string): Promise<readonly TypeScriptTypes.SourceFile[]> {
    const program = await this.getProgram(rootDir);
    return program.getSourceFiles();
  }

  /**
   * Get a specific source file
   */
  async getSourceFile(
    filePath: string,
    rootDir?: string
  ): Promise<TypeScriptTypes.SourceFile | undefined> {
    const program = await this.getProgram(rootDir);
    return program.getSourceFile(resolve(filePath));
  }

  /**
   * Get compiler options from the program
   */
  async getCompilerOptions(rootDir?: string): Promise<TypeScriptTypes.CompilerOptions> {
    const program = await this.getProgram(rootDir);
    return program.getCompilerOptions();
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.cache.clear();
    this.initialized = false;
    logger.debug('TSProgramManager disposed');
  }

  /**
   * Find tsconfig.json by walking up the directory tree
   */
  private findTsConfig(startDir: string): string {
    // Use provided config path if set
    if (this.options.configPath) {
      const configPath = resolve(this.options.configPath);
      if (existsSync(configPath)) {
        return configPath;
      }
      logger.warn('Provided tsconfig.json not found', { path: configPath });
    }

    // Walk up directory tree to filesystem root
    let currentDir = startDir;
    let previousDir = '';

    // Continue until we reach the filesystem root (when dirname returns the same path)
    while (currentDir !== previousDir) {
      const configPath = join(currentDir, 'tsconfig.json');
      if (existsSync(configPath)) {
        logger.debug('Found tsconfig.json', { path: configPath });
        return configPath;
      }
      previousDir = currentDir;
      currentDir = dirname(currentDir);
    }

    logger.debug('No tsconfig.json found, using default compiler options');
    return '';
  }

  /**
   * Create a TypeScript program
   */
  private async createProgram(
    configPath: string,
    rootDir: string
  ): Promise<TypeScriptTypes.Program> {
    const typescript = getTS();
    const startTime = Date.now();

    let compilerOptions: TypeScriptTypes.CompilerOptions;
    let fileNames: string[];

    if (configPath) {
      // Parse tsconfig.json
      const configFile = typescript.readConfigFile(configPath, typescript.sys.readFile);

      if (configFile.error) {
        logger.warn('Error reading tsconfig.json', {
          path: configPath,
          error: typescript.flattenDiagnosticMessageText(configFile.error.messageText, '\n'),
        });
        // Fall through to default options
        compilerOptions = this.getDefaultCompilerOptions();
        fileNames = this.findTypeScriptFiles(rootDir);
      } else {
        const parsed = typescript.parseJsonConfigFileContent(
          configFile.config,
          typescript.sys,
          dirname(configPath)
        );

        compilerOptions = parsed.options;
        fileNames = parsed.fileNames;

        // Add/remove files based on options
        if (this.options.includeFiles.length > 0) {
          fileNames = [...new Set([...fileNames, ...this.options.includeFiles])];
        }
        if (this.options.excludeFiles.length > 0) {
          const excludeSet = new Set(this.options.excludeFiles.map(f => resolve(f)));
          fileNames = fileNames.filter(f => !excludeSet.has(resolve(f)));
        }
      }
    } else {
      // No tsconfig, use defaults
      compilerOptions = this.getDefaultCompilerOptions();
      fileNames = this.findTypeScriptFiles(rootDir);
    }

    // Create the program
    const program = typescript.createProgram(fileNames, compilerOptions);

    const duration = Date.now() - startTime;
    logger.debug('TypeScript program created', {
      files: fileNames.length,
      durationMs: duration,
      configPath: configPath || '(default)',
    });

    return program;
  }

  /**
   * Get default compiler options when no tsconfig exists
   */
  private getDefaultCompilerOptions(): TypeScriptTypes.CompilerOptions {
    const typescript = getTS();
    return {
      target: typescript.ScriptTarget.ES2020,
      module: typescript.ModuleKind.ESNext,
      moduleResolution: typescript.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      declaration: false,
      noEmit: true,
      allowJs: true,
      checkJs: false,
    };
  }

  /**
   * Find TypeScript/JavaScript files in a directory
   */
  private findTypeScriptFiles(rootDir: string): string[] {
    const typescript = getTS();
    const files: string[] = [];

    const walk = (dir: string): void => {
      try {
        const entries = typescript.sys.readDirectory(
          dir,
          ['.ts', '.tsx', '.js', '.jsx'],
          ['node_modules', 'dist', 'build', '.git'],
          ['**/*']
        );
        files.push(...entries);
      } catch (error) {
        logger.warn('Error scanning directory', { dir, error });
      }
    };

    walk(rootDir);
    return files;
  }

  /**
   * Check if a cached program is still valid
   */
  private isCacheValid(entry: ProgramCacheEntry): boolean {
    const now = Date.now();

    // Check age
    if (now - entry.createdAt > this.options.maxProgramAgeMs) {
      logger.debug('Program cache expired due to age');
      return false;
    }

    // Check file versions (simple mtime check)
    for (const [filePath, version] of entry.fileVersions) {
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs !== version) {
          logger.debug('Program cache invalidated due to file change', { file: filePath });
          return false;
        }
      } catch {
        // File doesn't exist anymore
        return false;
      }
    }

    return true;
  }

  /**
   * Cache a program with LRU eviction
   */
  private cacheProgram(
    key: string,
    program: TypeScriptTypes.Program,
    configPath: string
  ): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.options.maxCachedPrograms) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.accessedAt < oldestTime) {
          oldestTime = v.accessedAt;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug('Evicted oldest program from cache', { key: oldestKey });
      }
    }

    // Build file version map
    const fileVersions = new Map<string, number>();
    for (const sourceFile of program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        try {
          const stat = statSync(sourceFile.fileName);
          fileVersions.set(sourceFile.fileName, stat.mtimeMs);
        } catch {
          // File might not exist on disk (e.g., lib files)
        }
      }
    }

    // Add to cache
    const now = Date.now();
    this.cache.set(key, {
      program,
      configPath,
      createdAt: now,
      fileVersions,
      accessedAt: now,
    });

    logger.debug('Program cached', {
      key,
      files: fileVersions.size,
      cacheSize: this.cache.size,
    });
  }
}

/**
 * Create a TSProgramManager instance
 */
export function createTSProgramManager(
  options: TSProgramManagerOptions
): TSProgramManager {
  return new TSProgramManager(options);
}
