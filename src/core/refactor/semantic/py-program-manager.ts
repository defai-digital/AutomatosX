/**
 * PyProgramManager - Python AST Bridge Manager
 *
 * Manages communication with the Python AST bridge subprocess for
 * dead code detection in Python codebases.
 *
 * @module core/refactor/semantic/py-program-manager
 * @since v12.10.0
 */

import { spawn, ChildProcess, execSync, SpawnOptions } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { logger } from '../../../shared/logging/logger.js';
import { fileURLToPath } from 'url';
import type {
  PyProgramManagerOptions,
  PyBridgeResult,
  PyBridgeSymbol,
  PyBridgeUsage,
  PyDynamicPattern,
} from './py-types.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Cached analysis entry
 */
interface AnalysisCacheEntry {
  result: PyBridgeResult;
  timestamp: number;
  fileModTime: number;
}

/**
 * Query types for Python analysis
 */
export type PyQueryType =
  | 'unused_import'
  | 'unused_function'
  | 'unused_class'
  | 'unused_variable'
  | 'unused_parameter'
  | 'type_only_import'
  | 'resource_leak';

/**
 * PyProgramManager - Manages Python AST bridge subprocess
 *
 * Features:
 * - Automatic Python detection
 * - Analysis result caching with TTL
 * - Symbol and usage extraction
 * - Dynamic pattern detection
 */
export class PyProgramManager {
  private options: Required<PyProgramManagerOptions>;
  private cache: Map<string, AnalysisCacheEntry> = new Map();
  private initialized = false;
  private bridgePath: string;

  constructor(options: PyProgramManagerOptions) {
    this.options = {
      rootDir: resolve(options.rootDir),
      pythonPath: options.pythonPath || '',
      configPath: options.configPath || '',
      maxCacheAgeMs: options.maxCacheAgeMs ?? 60000,
      subprocessTimeoutMs: options.subprocessTimeoutMs ?? 30000,
    };

    // Find the bridge script
    this.bridgePath = this.findBridgePath();
  }

  /**
   * Initialize the manager by detecting Python
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Find Python if not specified
    if (!this.options.pythonPath) {
      this.options.pythonPath = this.findPython();
    }

    // Verify Python works
    try {
      execSync(`"${this.options.pythonPath}" --version`, {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch (error) {
      throw new Error(
        `Python not available at ${this.options.pythonPath}. ` +
          'Install Python 3.8+ or set pythonPath option.'
      );
    }

    // Verify bridge script exists
    if (!existsSync(this.bridgePath)) {
      throw new Error(`Python AST bridge not found at ${this.bridgePath}`);
    }

    this.initialized = true;
    logger.debug('PyProgramManager initialized', {
      rootDir: this.options.rootDir,
      pythonPath: this.options.pythonPath,
      bridgePath: this.bridgePath,
    });
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Analyze a Python file for dead code
   */
  async analyzeFile(
    filePath: string,
    queryTypes: PyQueryType[] = ['unused_import', 'unused_function', 'unused_class', 'unused_variable'],
    includeSymbols = false
  ): Promise<PyBridgeResult> {
    if (!this.initialized) {
      await this.init();
    }

    const absolutePath = resolve(filePath);

    // Check cache
    const cached = this.getCachedResult(absolutePath);
    if (cached) {
      return cached;
    }

    // Read file content
    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf-8');
    } catch (error) {
      return {
        findings: [],
        parseErrors: [
          {
            message: `Failed to read file: ${(error as Error).message}`,
            line: undefined,
            column: undefined,
          },
        ],
        pythonVersion: 'unknown',
      };
    }

    // Run analysis
    const result = await this.runAnalysis(content, queryTypes, includeSymbols);

    // Cache the result
    this.cacheResult(absolutePath, result);

    return result;
  }

  /**
   * Analyze Python source code directly
   */
  async analyzeSource(
    content: string,
    queryTypes: PyQueryType[] = ['unused_import', 'unused_function', 'unused_class', 'unused_variable'],
    includeSymbols = false
  ): Promise<PyBridgeResult> {
    if (!this.initialized) {
      await this.init();
    }

    return this.runAnalysis(content, queryTypes, includeSymbols);
  }

  /**
   * Get symbols from a Python file
   * Note: We must pass at least one dead code query type to initialize the DeadCodeDetector
   */
  async getSymbols(filePath: string): Promise<PyBridgeSymbol[]> {
    // Pass dead code query types to ensure DeadCodeDetector is initialized
    const result = await this.analyzeFile(
      filePath,
      ['unused_import', 'unused_function', 'unused_class', 'unused_variable'],
      true
    );
    return result.symbols || [];
  }

  /**
   * Get usages from a Python file
   * Note: We must pass at least one dead code query type to initialize the DeadCodeDetector
   */
  async getUsages(filePath: string): Promise<Record<string, PyBridgeUsage[]>> {
    // Pass dead code query types to ensure DeadCodeDetector is initialized
    const result = await this.analyzeFile(
      filePath,
      ['unused_import', 'unused_function', 'unused_class', 'unused_variable'],
      true
    );
    return result.usages || {};
  }

  /**
   * Get dynamic patterns from a Python file
   * Note: We must pass at least one dead code query type to initialize the DeadCodeDetector
   */
  async getDynamicPatterns(filePath: string): Promise<PyDynamicPattern[]> {
    // Pass dead code query types to ensure DeadCodeDetector is initialized
    const result = await this.analyzeFile(
      filePath,
      ['unused_import', 'unused_function', 'unused_class', 'unused_variable'],
      true
    );
    return result.dynamicPatterns || [];
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): void {
    const absolutePath = resolve(filePath);
    this.cache.delete(absolutePath);
    logger.debug('PyProgramManager cache invalidated', { file: absolutePath });
  }

  /**
   * Invalidate all cached results
   */
  invalidateAll(): void {
    this.cache.clear();
    logger.debug('PyProgramManager cache cleared');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.cache.clear();
    this.initialized = false;
    logger.debug('PyProgramManager disposed');
  }

  /**
   * Run analysis via Python bridge subprocess
   */
  private async runAnalysis(
    content: string,
    queryTypes: PyQueryType[],
    includeSymbols: boolean
  ): Promise<PyBridgeResult> {
    const payload = JSON.stringify({
      content,
      queries: queryTypes.map(type => ({ type })),
      include_symbols: includeSymbols,
    });

    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        cwd: this.options.rootDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.options.subprocessTimeoutMs,
      };

      const child = spawn(this.options.pythonPath, [this.bridgePath], spawnOptions);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        logger.warn('Python bridge spawn error', { error: error.message });
        resolve({
          findings: [],
          parseErrors: [
            {
              message: `Python bridge error: ${error.message}`,
              line: undefined,
              column: undefined,
            },
          ],
          pythonVersion: 'unknown',
        });
      });

      child.on('close', (code) => {
        if (code !== 0) {
          logger.warn('Python bridge non-zero exit', { code, stderr });
        }

        try {
          const result = JSON.parse(stdout) as PyBridgeResult;
          resolve(result);
        } catch (parseError) {
          logger.warn('Python bridge output parse error', {
            stdout: stdout.slice(0, 200),
            stderr: stderr.slice(0, 200),
          });
          resolve({
            findings: [],
            parseErrors: [
              {
                message: `Failed to parse Python bridge output: ${(parseError as Error).message}`,
                line: undefined,
                column: undefined,
              },
            ],
            pythonVersion: 'unknown',
          });
        }
      });

      // Send payload to stdin
      child.stdin?.write(payload);
      child.stdin?.end();
    });
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(filePath: string): PyBridgeResult | null {
    const entry = this.cache.get(filePath);
    if (!entry) return null;

    const now = Date.now();

    // Check age
    if (now - entry.timestamp > this.options.maxCacheAgeMs) {
      this.cache.delete(filePath);
      return null;
    }

    // Check file modification time
    try {
      const stats = require('fs').statSync(filePath);
      if (stats.mtimeMs !== entry.fileModTime) {
        this.cache.delete(filePath);
        return null;
      }
    } catch {
      this.cache.delete(filePath);
      return null;
    }

    logger.debug('PyProgramManager cache hit', { file: filePath });
    return entry.result;
  }

  /**
   * Cache analysis result
   */
  private cacheResult(filePath: string, result: PyBridgeResult): void {
    try {
      const stats = require('fs').statSync(filePath);
      this.cache.set(filePath, {
        result,
        timestamp: Date.now(),
        fileModTime: stats.mtimeMs,
      });

      // Limit cache size
      if (this.cache.size > 100) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
    } catch {
      // File might not exist, skip caching
    }
  }

  /**
   * Find Python executable
   */
  private findPython(): string {
    const candidates = [
      process.env.AX_PYTHON_BIN,
      process.env.PYTHON_PATH,
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      '/opt/homebrew/bin/python3',
      'python3',
      'python',
    ].filter((p): p is string => !!p);

    for (const candidate of candidates) {
      try {
        execSync(`"${candidate}" --version`, {
          stdio: 'pipe',
          timeout: 2000,
        });
        logger.debug('Found Python', { path: candidate });
        return candidate;
      } catch {
        // Try next candidate
      }
    }

    throw new Error(
      'Python not found. Install Python 3.8+ or set AX_PYTHON_BIN environment variable.'
    );
  }

  /**
   * Find Python AST bridge script
   */
  private findBridgePath(): string {
    // Try relative to this module (in dist)
    const candidates = [
      // Development: relative to src
      resolve(__dirname, '../../../../tools/python_ast_bridge.py'),
      // Production: relative to dist
      resolve(__dirname, '../../../tools/python_ast_bridge.py'),
      // Project root
      resolve(process.cwd(), 'tools/python_ast_bridge.py'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    // Default to project root
    return resolve(process.cwd(), 'tools/python_ast_bridge.py');
  }
}

/**
 * Create a PyProgramManager instance
 */
export function createPyProgramManager(
  options: PyProgramManagerOptions
): PyProgramManager {
  return new PyProgramManager(options);
}
