/**
 * Code Context Builder
 *
 * Gathers code from file paths for analysis.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  type CodeContext,
  type AnalysisFile,
  getLanguageFromPath,
} from '@automatosx/contracts';
import type { CodeContextBuilder, GatherOptions } from './types.js';

/**
 * Default exclude patterns
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '__pycache__',
  'venv',
  '.venv',
  'coverage',
  '.nyc_output',
  '*.min.js',
  '*.bundle.js',
  '*.map',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

/**
 * Analysis context builder error
 */
export class ContextBuilderError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ContextBuilderError';
  }
}

/**
 * Default gather options
 */
const DEFAULT_OPTIONS: GatherOptions = {
  maxFiles: 20,
  maxLinesPerFile: 1000,
};

/**
 * Creates a code context builder
 */
export function createCodeContextBuilder(): CodeContextBuilder {
  return {
    async gatherCode(paths: string[], options?: Partial<GatherOptions>): Promise<CodeContext> {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const excludePatterns = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...(opts.excludePatterns ?? []),
      ];

      const files: AnalysisFile[] = [];
      let totalLines = 0;
      let truncated = false;

      // Resolve and deduplicate paths
      const resolvedPaths = new Set<string>();
      for (const p of paths) {
        const resolved = path.resolve(p);
        resolvedPaths.add(resolved);
      }

      // Process each path
      for (const filePath of resolvedPaths) {
        if (files.length >= opts.maxFiles) {
          truncated = true;
          break;
        }

        try {
          const stat = await fs.stat(filePath);

          if (stat.isDirectory()) {
            // Recursively gather files from directory
            const dirFiles = await gatherFromDirectory(
              filePath,
              excludePatterns,
              opts.maxFiles - files.length,
              opts.maxLinesPerFile
            );
            files.push(...dirFiles);
            totalLines += dirFiles.reduce((sum, f) => sum + f.lines, 0);

            if (files.length >= opts.maxFiles) {
              truncated = true;
            }
          } else if (stat.isFile()) {
            // Read single file
            const file = await readFile(filePath, opts.maxLinesPerFile);
            if (file) {
              files.push(file);
              totalLines += file.lines;
            }
          }
        } catch (error) {
          // Skip files that can't be read
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            continue;
          }
          throw error;
        }
      }

      return {
        files,
        totalLines,
        truncated,
      };
    },
  };
}

/**
 * Gather files from a directory recursively
 */
async function gatherFromDirectory(
  dirPath: string,
  excludePatterns: string[],
  maxFiles: number,
  maxLinesPerFile: number
): Promise<AnalysisFile[]> {
  const files: AnalysisFile[] = [];

  async function walk(currentPath: string): Promise<void> {
    if (files.length >= maxFiles) return;

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) return;

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, fullPath);

      // Check exclude patterns
      if (shouldExclude(relativePath, entry.name, excludePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && isAnalyzableFile(entry.name)) {
        const file = await readFile(fullPath, maxLinesPerFile);
        if (file) {
          files.push(file);
        }
      }
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Read a single file
 */
async function readFile(
  filePath: string,
  maxLines: number
): Promise<AnalysisFile | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const truncatedContent =
      lines.length > maxLines ? lines.slice(0, maxLines).join('\n') + '\n// ... truncated' : content;

    return {
      path: filePath,
      content: truncatedContent,
      lines: Math.min(lines.length, maxLines),
      language: getLanguageFromPath(filePath),
    };
  } catch {
    return null;
  }
}

/**
 * Check if path should be excluded
 */
function shouldExclude(
  relativePath: string,
  name: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith('*.')) {
      // Extension pattern
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) return true;
    } else {
      // Name or path pattern
      if (name === pattern || relativePath.includes(pattern)) return true;
    }
  }
  return false;
}

/**
 * Check if file is analyzable (source code)
 */
function isAnalyzableFile(name: string): boolean {
  const analyzableExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.java',
    '.kt',
    '.swift',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.php',
    '.vue',
    '.svelte',
  ];

  return analyzableExtensions.some((ext) => name.endsWith(ext));
}

/**
 * Format code context for display/debugging
 */
export function formatCodeContext(context: CodeContext): string {
  const lines: string[] = [];
  lines.push(`Files: ${context.files.length}`);
  lines.push(`Total Lines: ${context.totalLines}`);
  lines.push(`Truncated: ${context.truncated}`);
  lines.push('');

  for (const file of context.files) {
    lines.push(`--- ${file.path} (${file.language}, ${file.lines} lines) ---`);
  }

  return lines.join('\n');
}
