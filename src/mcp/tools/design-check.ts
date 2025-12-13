/**
 * MCP Tool: design_check
 *
 * Scans codebase for design system violations (colors, spacing, accessibility).
 * Returns violations with suggestions and fix availability.
 *
 * Uses @defai.digital/ax-core design-check module.
 *
 * @since v12.9.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';
import {
  runDesignCheck,
  loadConfig,
  getAvailableRules,
} from '@defai.digital/ax-core/design-check';
import type { CheckResult, Violation } from '@defai.digital/ax-core/design-check';
import type { IMemoryManager } from '../../types/memory.js';

export interface DesignCheckInput {
  /** File paths or glob patterns to check */
  paths: string[];
  /** Output format (default: json) */
  format?: 'json' | 'stylish';
  /** Only report errors, not warnings */
  quiet?: boolean;
  /** Run specific rule only */
  rule?: string;
  /** Additional ignore patterns */
  ignorePatterns?: string[];
  /** Custom config file path */
  configPath?: string;
  /** Include coverage statistics (default: true) */
  includeCoverage?: boolean;
  /** Maximum violations to return (default: 100) */
  limit?: number;
}

export interface DesignCheckOutput {
  /** Whether the check succeeded */
  success: boolean;
  /** Summary statistics */
  summary: {
    files: number;
    filesWithViolations: number;
    errors: number;
    warnings: number;
    skipped: number;
  };
  /** Results per file */
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
    skipped?: boolean;
    skipReason?: string;
  }>;
  /** Token coverage statistics */
  coverage?: {
    colorCoverage: number;
    spacingCoverage: number;
    totalColors: number;
    totalSpacing: number;
  };
  /** Available rules for reference */
  availableRules: string[];
  /** Memory key if results were stored */
  memoryKey?: string;
  /** Scan duration in ms */
  durationMs: number;
}

export interface DesignCheckDependencies {
  memoryManager?: IMemoryManager;
}

export function createDesignCheckHandler(
  deps: DesignCheckDependencies = {}
): ToolHandler<DesignCheckInput, DesignCheckOutput> {
  return async (input: DesignCheckInput): Promise<DesignCheckOutput> => {
    const startTime = Date.now();
    logger.info('[MCP] design_check called', {
      paths: input.paths,
      rule: input.rule,
      quiet: input.quiet,
    });

    const progressToken = sendMcpProgressBegin(
      'Design Check',
      'Scanning for design system violations...'
    );

    try {
      // Validate paths
      if (!input.paths || input.paths.length === 0) {
        throw new Error('paths parameter is required and must not be empty');
      }

      const limit = input.limit ?? 100;

      // Run design check
      sendMcpProgress('Loading configuration...', progressToken);

      const result = await runDesignCheck(input.paths, {
        format: 'json',
        quiet: input.quiet ?? false,
        rule: input.rule,
        ignorePatterns: input.ignorePatterns ?? [],
        config: input.configPath,
        fix: false,
        noColor: true,
        maxWarnings: -1,
      });

      sendMcpProgress(
        `Found ${result.summary.errors + result.summary.warnings} violations in ${result.summary.files} files`,
        progressToken
      );

      // Transform results to output format
      const transformedResults = result.results.map((fileResult) => ({
        file: fileResult.file,
        violations: fileResult.violations.slice(0, limit).map((v: Violation) => ({
          rule: v.rule,
          severity: v.severity as 'error' | 'warning',
          message: v.message,
          line: v.line,
          column: v.column,
          found: v.found,
          suggestion: v.suggestion,
          fixable: v.fixable ?? false,
        })),
        skipped: fileResult.skipped,
        skipReason: fileResult.skipReason,
      }));

      // Get available rules
      const availableRules = getAvailableRules();

      // Store in memory if manager available
      let memoryKey: string | undefined;
      if (deps.memoryManager && result.summary.errors + result.summary.warnings > 0) {
        try {
          const entry = await deps.memoryManager.add(
            JSON.stringify({
              type: 'design_check',
              timestamp: new Date().toISOString(),
              summary: result.summary,
              topViolations: getTopViolations(result),
              coverage: result.coverage,
            }),
            null,
            {
              type: 'other',
              source: 'design_check',
              agentId: 'design-stabilizer',
            }
          );
          memoryKey = `memory:${entry.id}`;
        } catch (memError) {
          logger.warn('[MCP] design_check failed to store in memory', { error: memError });
        }
      }

      const output: DesignCheckOutput = {
        success: true,
        summary: result.summary,
        results: transformedResults,
        coverage: input.includeCoverage !== false ? result.coverage : undefined,
        availableRules,
        memoryKey,
        durationMs: Date.now() - startTime,
      };

      logger.info('[MCP] design_check completed', {
        files: output.summary.files,
        errors: output.summary.errors,
        warnings: output.summary.warnings,
        durationMs: output.durationMs,
      });

      sendMcpProgressEnd(
        progressToken,
        `Completed: ${output.summary.errors} errors, ${output.summary.warnings} warnings`
      );

      return output;
    } catch (error) {
      logger.error('[MCP] design_check failed', { error });
      sendMcpProgressEnd(progressToken, `Error: ${(error as Error).message}`);
      throw new Error(`Design check failed: ${(error as Error).message}`);
    }
  };
}

/**
 * Extract top violation rules for memory storage
 */
function getTopViolations(result: CheckResult): string[] {
  const ruleCounts: Record<string, number> = {};

  for (const fileResult of result.results) {
    for (const violation of fileResult.violations) {
      ruleCounts[violation.rule] = (ruleCounts[violation.rule] || 0) + 1;
    }
  }

  return Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule]) => rule);
}

/** JSON Schema for design_check tool */
export const designCheckSchema = {
  name: 'design_check',
  description: `Scan code for design system violations (hardcoded colors, raw spacing, missing accessibility attributes).

**What it detects**:
- Hardcoded colors (hex, RGB, HSL)
- Raw pixel spacing values
- Missing alt text on images
- Missing form labels
- Inline styles

**Returns**: Violations with line numbers, suggestions, and fix availability.

Use design_suggest_fixes to preview fixes, design_apply_fixes to apply them.`,
  inputSchema: {
    type: 'object',
    required: ['paths'],
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'File paths or glob patterns to check (e.g., ["src/**/*.tsx"])',
      },
      format: {
        type: 'string',
        enum: ['json', 'stylish'],
        description: 'Output format (default: json)',
      },
      quiet: {
        type: 'boolean',
        description: 'Only report errors, not warnings (default: false)',
      },
      rule: {
        type: 'string',
        description:
          'Run specific rule only (e.g., "no-hardcoded-colors", "no-raw-spacing", "missing-alt-text")',
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
      includeCoverage: {
        type: 'boolean',
        description: 'Include token coverage statistics (default: true)',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 500,
        description: 'Maximum violations per file to return (default: 100)',
      },
    },
  },
};
