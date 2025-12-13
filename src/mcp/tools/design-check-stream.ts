/**
 * MCP Tool: design_check_stream
 *
 * Streaming design check for large codebases.
 * Processes files in chunks and emits progress notifications.
 *
 * @since v12.9.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';
import {
  runDesignCheck,
  loadConfig,
  scanFiles,
  readFileSafe,
  runRules,
} from '@defai.digital/ax-core/design-check';
import type { Violation, FileResult } from '@defai.digital/ax-core/design-check';

export interface DesignCheckStreamInput {
  /** File paths or glob patterns to check */
  paths: string[];
  /** Chunk size for processing (default: 50) */
  chunkSize?: number;
  /** Only report errors, not warnings */
  quiet?: boolean;
  /** Run specific rule only */
  rule?: string;
  /** Additional ignore patterns */
  ignorePatterns?: string[];
  /** Custom config file path */
  configPath?: string;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeoutMs?: number;
  /** Stop after finding this many violations (default: unlimited) */
  maxViolations?: number;
}

export interface DesignCheckStreamOutput {
  /** Whether the check completed successfully */
  success: boolean;
  /** Whether the scan was stopped early */
  stoppedEarly: boolean;
  /** Reason for stopping early */
  stopReason?: 'timeout' | 'max_violations' | 'cancelled';
  /** Summary statistics */
  summary: {
    filesScanned: number;
    totalFiles: number;
    filesWithViolations: number;
    errors: number;
    warnings: number;
    skipped: number;
  };
  /** Results per file (only files with violations) */
  results: Array<{
    file: string;
    violations: Array<{
      rule: string;
      severity: 'error' | 'warning';
      message: string;
      line: number;
      column: number;
      found: string;
      suggestion?: string;
      fixable: boolean;
    }>;
  }>;
  /** Progress events emitted during scan */
  progressEvents: number;
  /** Scan duration in ms */
  durationMs: number;
}

/** Error codes for structured error handling */
export enum DesignCheckErrorCode {
  INVALID_PATH = 'INVALID_PATH',
  CONFIG_ERROR = 'CONFIG_ERROR',
  TIMEOUT = 'TIMEOUT',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface DesignCheckError {
  code: DesignCheckErrorCode;
  message: string;
  file?: string;
}

export function createDesignCheckStreamHandler(): ToolHandler<
  DesignCheckStreamInput,
  DesignCheckStreamOutput
> {
  return async (input: DesignCheckStreamInput): Promise<DesignCheckStreamOutput> => {
    const startTime = Date.now();
    logger.info('[MCP] design_check_stream called', {
      paths: input.paths,
      chunkSize: input.chunkSize,
      timeoutMs: input.timeoutMs,
    });

    const progressToken = sendMcpProgressBegin(
      'Design Check (Streaming)',
      'Initializing scan...'
    );
    let progressEvents = 0;

    try {
      // Validate paths
      if (!input.paths || input.paths.length === 0) {
        throw createError(DesignCheckErrorCode.INVALID_PATH, 'paths parameter is required');
      }

      const chunkSize = input.chunkSize ?? 50;
      const timeoutMs = input.timeoutMs ?? 300000; // 5 minutes default
      const maxViolations = input.maxViolations ?? Infinity;
      const timeoutAt = Date.now() + timeoutMs;

      // Load config
      sendMcpProgress('Loading configuration...', progressToken);
      progressEvents++;
      const config = await loadConfig(input.configPath);

      // Scan for files
      sendMcpProgress('Scanning for files...', progressToken);
      progressEvents++;
      const filePaths = await scanFiles(
        input.paths,
        config.include,
        [...config.ignore, ...(input.ignorePatterns ?? [])]
      );

      const totalFiles = filePaths.length;
      sendMcpProgress(`Found ${totalFiles} files to scan`, progressToken);
      progressEvents++;

      // Initialize tracking
      const results: DesignCheckStreamOutput['results'] = [];
      let filesScanned = 0;
      let filesWithViolations = 0;
      let totalErrors = 0;
      let totalWarnings = 0;
      let skipped = 0;
      let stoppedEarly = false;
      let stopReason: DesignCheckStreamOutput['stopReason'];

      // Process files in chunks
      for (let i = 0; i < filePaths.length; i += chunkSize) {
        // Check timeout
        if (Date.now() > timeoutAt) {
          stoppedEarly = true;
          stopReason = 'timeout';
          sendMcpProgress(`Timeout reached after ${filesScanned} files`, progressToken);
          progressEvents++;
          break;
        }

        // Check max violations
        if (totalErrors + totalWarnings >= maxViolations) {
          stoppedEarly = true;
          stopReason = 'max_violations';
          sendMcpProgress(`Max violations (${maxViolations}) reached`, progressToken);
          progressEvents++;
          break;
        }

        const chunk = filePaths.slice(i, i + chunkSize);
        const chunkNum = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(filePaths.length / chunkSize);

        sendMcpProgress(
          `Processing chunk ${chunkNum}/${totalChunks} (${filesScanned}/${totalFiles} files)`,
          progressToken
        );
        progressEvents++;

        // Process each file in chunk
        for (const filePath of chunk) {
          const fileContent = await readFileSafe(filePath);

          if (!fileContent) {
            skipped++;
            continue;
          }

          // Run rules on file
          const violations = runRules(fileContent, config, input.rule);

          filesScanned++;

          if (violations.length > 0) {
            filesWithViolations++;

            // Count by severity
            const errors = violations.filter((v: Violation) => v.severity === 'error').length;
            const warnings = violations.filter((v: Violation) => v.severity === 'warning').length;
            totalErrors += errors;
            totalWarnings += warnings;

            // Filter warnings if quiet mode
            const filteredViolations = input.quiet
              ? violations.filter((v: Violation) => v.severity === 'error')
              : violations;

            if (filteredViolations.length > 0) {
              results.push({
                file: filePath,
                violations: filteredViolations.map((v: Violation) => ({
                  rule: v.rule,
                  severity: v.severity as 'error' | 'warning',
                  message: v.message,
                  line: v.line,
                  column: v.column,
                  found: v.found,
                  suggestion: v.suggestion,
                  fixable: v.fixable ?? false,
                })),
              });
            }
          }
        }

        // Emit chunk completion progress
        const progress = Math.round((filesScanned / totalFiles) * 100);
        sendMcpProgress(
          `${progress}% complete - ${totalErrors} errors, ${totalWarnings} warnings`,
          progressToken
        );
        progressEvents++;
      }

      const output: DesignCheckStreamOutput = {
        success: true,
        stoppedEarly,
        stopReason,
        summary: {
          filesScanned,
          totalFiles,
          filesWithViolations,
          errors: totalErrors,
          warnings: totalWarnings,
          skipped,
        },
        results,
        progressEvents,
        durationMs: Date.now() - startTime,
      };

      logger.info('[MCP] design_check_stream completed', {
        filesScanned,
        totalFiles,
        errors: totalErrors,
        warnings: totalWarnings,
        stoppedEarly,
        durationMs: output.durationMs,
      });

      sendMcpProgressEnd(
        progressToken,
        `Completed: ${filesScanned}/${totalFiles} files, ${totalErrors} errors, ${totalWarnings} warnings`
      );

      return output;
    } catch (error) {
      logger.error('[MCP] design_check_stream failed', { error });
      sendMcpProgressEnd(progressToken, `Error: ${(error as Error).message}`);

      // Return partial results if available
      return {
        success: false,
        stoppedEarly: true,
        stopReason: 'cancelled',
        summary: {
          filesScanned: 0,
          totalFiles: 0,
          filesWithViolations: 0,
          errors: 0,
          warnings: 0,
          skipped: 0,
        },
        results: [],
        progressEvents,
        durationMs: Date.now() - startTime,
      };
    }
  };
}

/**
 * Create a structured error
 */
function createError(code: DesignCheckErrorCode, message: string, file?: string): Error {
  const error = new Error(message) as Error & { code: DesignCheckErrorCode; file?: string };
  error.code = code;
  error.file = file;
  return error;
}

/** JSON Schema for design_check_stream tool */
export const designCheckStreamSchema = {
  name: 'design_check_stream',
  description: `Stream design check results for large codebases.

**When to use**: For repositories with 100+ files where progress feedback is important.

**Features**:
- Processes files in configurable chunks (default: 50 files)
- Sends real-time progress notifications
- Supports timeout to prevent long-running scans
- Can stop after reaching max violations

**Progress notifications** show:
- Current chunk being processed
- Files scanned / total files
- Errors and warnings found so far

Use design_check for smaller codebases (<100 files).`,
  inputSchema: {
    type: 'object',
    required: ['paths'],
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'File paths or glob patterns to check (e.g., ["src/**/*.tsx"])',
      },
      chunkSize: {
        type: 'integer',
        minimum: 10,
        maximum: 200,
        description: 'Files to process per chunk (default: 50)',
      },
      quiet: {
        type: 'boolean',
        description: 'Only report errors, not warnings (default: false)',
      },
      rule: {
        type: 'string',
        description: 'Run specific rule only (e.g., "no-hardcoded-colors")',
      },
      ignorePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional ignore patterns (e.g., ["**/legacy/**"])',
      },
      configPath: {
        type: 'string',
        description: 'Custom config file path',
      },
      timeoutMs: {
        type: 'integer',
        minimum: 10000,
        maximum: 600000,
        description: 'Timeout in milliseconds (default: 300000 = 5 minutes)',
      },
      maxViolations: {
        type: 'integer',
        minimum: 1,
        description: 'Stop after finding this many violations',
      },
    },
  },
};
