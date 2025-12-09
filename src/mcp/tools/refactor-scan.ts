/**
 * MCP Tool: refactor_scan
 *
 * Scans codebase for refactoring opportunities without applying changes.
 * Returns list of findings with severity and suggested fixes.
 *
 * @since v12.7.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import {
  RefactorController,
  createDefaultRefactorConfig,
  type RefactorType,
  type RefactorSeverity,
} from '../../core/refactor/index.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';

export interface RefactorScanInput {
  /** Directory to scan (default: current directory) */
  path?: string;
  /** Focus areas to scan for (default: all) */
  focus?: RefactorType[];
  /** Minimum severity to report (default: low) */
  minSeverity?: RefactorSeverity;
  /** Maximum findings to return (default: 50) */
  limit?: number;
  /** Static-only mode - no LLM (default: false) */
  noLlm?: boolean;
}

export interface RefactorScanOutput {
  /** Total findings */
  total: number;
  /** Duration in ms */
  durationMs: number;
  /** Code metrics */
  metrics: {
    linesOfCode: number;
    avgComplexity: number;
    duplicationPercent: number;
    maintainabilityIndex: number;
  };
  /** Findings by type */
  byType: Record<string, number>;
  /** Findings by severity */
  bySeverity: Record<string, number>;
  /** Findings (up to limit) */
  findings: Array<{
    file: string;
    line: number;
    type: RefactorType;
    severity: RefactorSeverity;
    message: string;
    suggestion?: string;
    confidence: number;
  }>;
}

export function createRefactorScanHandler(): ToolHandler<RefactorScanInput, RefactorScanOutput> {
  return async (input: RefactorScanInput): Promise<RefactorScanOutput> => {
    const startTime = Date.now();
    logger.info('[MCP] refactor_scan called', { path: input.path, focus: input.focus });

    const progressToken = sendMcpProgressBegin('Refactor Scan', 'Scanning codebase...');

    try {
      const rootDir = input.path || process.cwd();
      const limit = input.limit || 50;

      sendMcpProgress('Initializing refactor detector...', progressToken);

      const controller = new RefactorController({
        rootDir,
        config: createDefaultRefactorConfig({
          focusAreas: input.focus || [
            'duplication',
            'readability',
            'performance',
            'hardcoded_values',
            'naming',
            'conditionals',
            'dead_code',
            'type_safety',
          ],
          severityThreshold: input.minSeverity || 'low',
          maxFindings: limit,
          useLLMForDetection: !input.noLlm,
          useLLMForRefactoring: !input.noLlm,
          dryRun: true,
        }),
      });

      sendMcpProgress('Scanning for refactoring opportunities...', progressToken);
      const { findings, metrics } = await controller.scan();

      sendMcpProgress(`Found ${findings.length} opportunities`, progressToken);

      // Group findings
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};

      for (const finding of findings) {
        byType[finding.type] = (byType[finding.type] || 0) + 1;
        bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
      }

      const result: RefactorScanOutput = {
        total: findings.length,
        durationMs: Date.now() - startTime,
        metrics: {
          linesOfCode: metrics.linesOfCode,
          avgComplexity: metrics.avgCyclomaticComplexity,
          duplicationPercent: metrics.duplicationPercentage,
          maintainabilityIndex: metrics.maintainabilityIndex,
        },
        byType,
        bySeverity,
        findings: findings.slice(0, limit).map((f) => ({
          file: f.file,
          line: f.lineStart,
          type: f.type,
          severity: f.severity,
          message: f.message,
          suggestion: f.suggestedFix,
          confidence: f.confidence,
        })),
      };

      logger.info('[MCP] refactor_scan completed', {
        total: result.total,
        durationMs: result.durationMs,
      });

      sendMcpProgressEnd(progressToken, `Scan complete: ${findings.length} opportunities found`);

      return result;
    } catch (error) {
      logger.error('[MCP] refactor_scan failed', { error });
      sendMcpProgressEnd(progressToken, 'Scan failed');
      throw error;
    }
  };
}

/** JSON Schema for refactor_scan tool */
export const refactorScanSchema = {
  name: 'refactor_scan',
  description: `Scan codebase for refactoring opportunities without applying changes.

**Focus Areas (8 types)**:
- \`dead_code\`: Unused imports, variables, unreachable code (static-only, high confidence)
- \`type_safety\`: TypeScript any types, unsafe assertions (static-only)
- \`conditionals\`: Complex/nested conditionals, guard clauses
- \`hardcoded_values\`: Magic numbers, hardcoded URLs/paths
- \`naming\`: Poor variable names, inconsistent conventions
- \`duplication\`: Duplicate code blocks, repeated patterns
- \`readability\`: High complexity, deep nesting, long functions
- \`performance\`: N+1 queries, sync in async, sequential awaits

**Static-Only Mode** (\`noLlm: true\`):
Best for: dead_code, type_safety, conditionals, hardcoded_values
Fast, no API costs, high confidence detections.

Returns: Severity-sorted findings with suggestions.`,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory to scan (default: current directory)' },
      focus: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'duplication',
            'readability',
            'performance',
            'hardcoded_values',
            'naming',
            'conditionals',
            'dead_code',
            'type_safety',
          ],
        },
        description: 'Focus areas to scan for (default: all)',
      },
      minSeverity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Minimum severity to report (default: low)',
      },
      limit: {
        type: 'integer',
        description: 'Maximum findings to return (default: 50)',
        minimum: 1,
        maximum: 100,
      },
      noLlm: {
        type: 'boolean',
        description: 'Static-only mode - fast, no API costs (default: false)',
      },
    },
  },
};
