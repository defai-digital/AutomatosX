/**
 * Search Manager
 *
 * Manages file finding and content searching with glob and grep.
 */

import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { spawn } from 'child_process';

export interface FindOptions {
  ignore?: string[];
  type?: 'f' | 'd' | 'all';
  maxDepth?: number;
  caseSensitive?: boolean;
}

export interface SearchOptions {
  type?: string[];          // File extensions
  ignore?: string[];
  ignoreCase?: boolean;
  context?: number;         // Lines of context
  before?: number;
  after?: number;
  count?: boolean;
  maxResults?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface TreeOptions {
  maxDepth?: number;
  ignore?: string[];
  filesOnly?: boolean;
  dirsOnly?: boolean;
}

export class SearchManager {
  private workspaceRoot: string;
  private readonly maxResults: number;
  private readonly searchTimeout: number;

  constructor(workspaceRoot: string, options?: {
    maxResults?: number;
    searchTimeout?: number;
  }) {
    this.workspaceRoot = workspaceRoot;
    this.maxResults = options?.maxResults || 1000;
    this.searchTimeout = options?.searchTimeout || 30000; // 30 seconds
  }

  /**
   * Find files by glob pattern
   */
  async findFiles(pattern: string, options: FindOptions = {}): Promise<string[]> {
    try {
      // Build ignore patterns
      const ignore = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '.next/**',
        '.cache/**',
        ...(options.ignore || [])
      ];

      // Build glob options
      const globOptions = {
        cwd: this.workspaceRoot,
        ignore,
        nodir: options.type === 'f',
        maxDepth: options.maxDepth,
        nocase: !options.caseSensitive,
        absolute: false
      };

      // Execute glob
      let files = await glob(pattern, globOptions);

      // Filter by type if specified
      if (options.type === 'd') {
        // Only directories
        const { stat } = await import('fs/promises');
        const dirChecks = await Promise.all(
          files.map(async (f) => {
            try {
              const stats = await stat(join(this.workspaceRoot, f));
              return stats.isDirectory();
            } catch {
              return false;
            }
          })
        );
        files = files.filter((_, i) => dirChecks[i]);
      }

      // Limit results
      if (files.length > this.maxResults) {
        files = files.slice(0, this.maxResults);
      }

      return files;
    } catch (error) {
      throw new Error(`File search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Search file contents using ripgrep or grep
   */
  async searchContent(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      // Try ripgrep first (much faster), fallback to grep
      const hasRipgrep = await this.hasCommand('rg');

      if (hasRipgrep) {
        return this.searchWithRipgrep(query, options);
      } else {
        return this.searchWithGrep(query, options);
      }
    } catch (error) {
      throw new Error(`Content search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Search using ripgrep
   */
  private async searchWithRipgrep(query: string, options: SearchOptions): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args: string[] = [
        '--json',  // JSON output for parsing
        '--line-number',
        '--column',
        '--no-heading',
        '--with-filename'
      ];

      // Add options
      if (options.ignoreCase) {
        args.push('--ignore-case');
      }

      if (options.context) {
        args.push(`--context=${options.context}`);
      } else {
        if (options.before) {
          args.push(`--before-context=${options.before}`);
        }
        if (options.after) {
          args.push(`--after-context=${options.after}`);
        }
      }

      // File type filters
      // BUG #38 FIX: Use correct ripgrep glob syntax with braces, not parentheses
      if (options.type && options.type.length > 0) {
        const pattern = `*.{${options.type.join(',')}}`;
        args.push('--glob', pattern);
      }

      // Ignore patterns
      const defaultIgnore = ['node_modules', '.git', 'dist', 'build', 'coverage'];
      const ignorePatterns = [...defaultIgnore, ...(options.ignore || [])];
      ignorePatterns.forEach(pattern => {
        args.push('--glob', `!${pattern}`);
      });

      // Max count
      const maxResults = options.maxResults || this.maxResults;
      args.push(`--max-count=${maxResults}`);

      // Add query
      args.push(query);

      // Execute ripgrep
      const rg = spawn('rg', args, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      rg.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      rg.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      // Timeout
      const timeout = setTimeout(() => {
        rg.kill();
        reject(new Error('Search timed out'));
      }, this.searchTimeout);

      rg.on('close', (code: number | null) => {
        clearTimeout(timeout);

        // Code 0 = matches found, Code 1 = no matches (not an error)
        if (code !== null && code !== 0 && code !== 1) {
          reject(new Error(`ripgrep failed: ${errorOutput}`));
          return;
        }

        try {
          const results = this.parseRipgrepOutput(output);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });

      rg.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Parse ripgrep JSON output
   */
  private parseRipgrepOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const json = JSON.parse(line);

        if (json.type === 'match') {
          const data = json.data;
          results.push({
            file: relative(this.workspaceRoot, data.path.text),
            line: data.line_number,
            column: data.submatches[0]?.start || 0,
            content: data.lines.text.trim()
          });
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return results;
  }

  /**
   * Search using grep (fallback)
   */
  private async searchWithGrep(query: string, options: SearchOptions): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args: string[] = [
        '-n',  // Line numbers
        '-H',  // Filename
        '-r',  // Recursive
      ];

      // Add options
      if (options.ignoreCase) {
        args.push('-i');
      }

      if (options.context) {
        args.push(`-C${options.context}`);
      } else {
        if (options.before) {
          args.push(`-B${options.before}`);
        }
        if (options.after) {
          args.push(`-A${options.after}`);
        }
      }

      // Exclude directories
      const defaultExclude = ['node_modules', '.git', 'dist', 'build', 'coverage'];
      const excludeDirs = [...defaultExclude, ...(options.ignore || [])];
      excludeDirs.forEach(dir => {
        args.push('--exclude-dir', dir);
      });

      // Add query and path
      args.push(query);
      args.push('.');

      // Execute grep
      const grepCmd = spawn('grep', args, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      grepCmd.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      grepCmd.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      // Timeout
      const timeout = setTimeout(() => {
        grepCmd.kill();
        reject(new Error('Search timed out'));
      }, this.searchTimeout);

      grepCmd.on('close', (code: number | null) => {
        clearTimeout(timeout);

        // Code 0 = matches found, Code 1 = no matches (not an error)
        if (code !== null && code !== 0 && code !== 1) {
          reject(new Error(`grep failed: ${errorOutput}`));
          return;
        }

        try {
          const results = this.parseGrepOutput(output);
          resolve(results.slice(0, this.maxResults));
        } catch (error) {
          reject(error);
        }
      });

      grepCmd.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Parse grep output
   */
  private parseGrepOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Format: filename:line:content
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        results.push({
          file: relative(this.workspaceRoot, match[1] || ''),
          line: parseInt(match[2] || '0', 10),
          column: 0,
          content: (match[3] || '').trim()
        });
      }
    }

    return results;
  }

  /**
   * Get directory tree
   */
  async getFileTree(path?: string, options: TreeOptions = {}): Promise<string> {
    const targetPath = path || '.';
    const fullPath = join(this.workspaceRoot, targetPath);

    // Try tree command first
    const hasTree = await this.hasCommand('tree');

    if (hasTree) {
      return this.getTreeWithCommand(fullPath, options);
    } else {
      // Fallback to manual tree generation
      return this.generateTree(fullPath, options);
    }
  }

  /**
   * Get tree using tree command
   */
  private async getTreeWithCommand(path: string, options: TreeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args: string[] = ['-C'];  // Colorize

      if (options.maxDepth) {
        args.push('-L', options.maxDepth.toString());
      }

      if (options.filesOnly) {
        args.push('--filesfirst');
      }

      if (options.dirsOnly) {
        args.push('-d');
      }

      // Default ignores
      const ignorePatterns = [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        ...(options.ignore || [])
      ];

      ignorePatterns.forEach(pattern => {
        args.push('-I', pattern);
      });

      args.push(path);

      const tree = spawn('tree', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      tree.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      tree.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      tree.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`tree command failed: ${errorOutput}`));
        }
      });

      tree.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate tree manually (fallback)
   */
  private async generateTree(path: string, options: TreeOptions): Promise<string> {
    const { readdir, stat } = await import('fs/promises');
    const ignorePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      ...(options.ignore || [])
    ];

    const buildTree = async (dir: string, prefix = '', depth = 0): Promise<string[]> => {
      if (options.maxDepth && depth >= options.maxDepth) {
        return [];
      }

      try {
        const entries = await readdir(dir);
        const filtered = entries.filter(entry => !ignorePatterns.includes(entry));
        const lines: string[] = [];

        for (let i = 0; i < filtered.length; i++) {
          const entry = filtered[i];
          const fullPath = join(dir, entry || '');
          const isLast = i === filtered.length - 1;
          const stats = await stat(fullPath);
          const isDir = stats.isDirectory();

          if (options.filesOnly && isDir) continue;
          if (options.dirsOnly && !isDir) continue;

          const connector = isLast ? '└── ' : '├── ';
          const name = isDir ? `${entry}/` : entry;

          lines.push(`${prefix}${connector}${name}`);

          if (isDir) {
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            const subLines = await buildTree(fullPath, newPrefix, depth + 1);
            lines.push(...subLines);
          }
        }

        return lines;
      } catch {
        return [];
      }
    };

    const lines = await buildTree(path);
    return relative(this.workspaceRoot, path) + '/\n' + lines.join('\n');
  }

  /**
   * Check if a command is available
   */
  private async hasCommand(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const which = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd], {
        stdio: 'ignore'
      });

      which.on('close', (code: number | null) => {
        resolve(code === 0);
      });

      which.on('error', () => {
        resolve(false);
      });
    });
  }
}
