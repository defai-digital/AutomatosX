/**
 * MCP Tool: bugfix_scan
 *
 * Scans codebase for bugs without applying fixes.
 * Returns list of detected bugs with severity and suggested fixes.
 *
 * @since v12.4.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { BugDetector, createDefaultBugfixConfig } from '../../core/bugfix/bug-detector.js';
import type { BugType, BugSeverity, BugFinding } from '../../core/bugfix/types.js';

export interface BugfixScanInput {
  /** Directory to scan (default: current directory) */
  path?: string;
  /** Bug types to scan for (default: all) */
  types?: BugType[];
  /** Minimum severity to report (default: low) */
  minSeverity?: BugSeverity;
  /** File patterns to include (default: ['**\/*.ts', '**\/*.js']) */
  includePatterns?: string[];
  /** File patterns to exclude (default: ['node_modules', 'dist']) */
  excludePatterns?: string[];
  /** Maximum number of bugs to return (default: 50) */
  limit?: number;
}

export interface BugfixScanOutput {
  /** Total bugs found */
  total: number;
  /** Bugs by severity */
  bySeverity: Record<BugSeverity, number>;
  /** Bugs by type */
  byType: Record<string, number>;
  /** Bug findings (up to limit) */
  findings: Array<{
    id: string;
    file: string;
    line: number;
    type: BugType;
    severity: BugSeverity;
    message: string;
    confidence: number;
    hasAutoFix: boolean;
  }>;
  /** Scan duration in ms */
  durationMs: number;
}

export function createBugfixScanHandler(): ToolHandler<BugfixScanInput, BugfixScanOutput> {
  return async (input: BugfixScanInput): Promise<BugfixScanOutput> => {
    const startTime = Date.now();
    logger.info('[MCP] bugfix_scan called', { path: input.path, types: input.types });

    try {
      const rootDir = input.path || process.cwd();
      const limit = input.limit || 50;

      // Build config from input
      // Note: includePatterns is handled by file scanning, not in BugfixConfig
      const config = createDefaultBugfixConfig({
        bugTypes: input.types,
        excludePatterns: input.excludePatterns
      });

      // Create detector and scan
      const detector = new BugDetector(config);
      let findings = await detector.scan(rootDir);

      // Filter by minimum severity
      if (input.minSeverity) {
        const severityOrder: BugSeverity[] = ['low', 'medium', 'high', 'critical'];
        const minIndex = severityOrder.indexOf(input.minSeverity);
        findings = findings.filter(f => severityOrder.indexOf(f.severity) >= minIndex);
      }

      // Calculate statistics
      const bySeverity: Record<BugSeverity, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      };

      const byType: Record<string, number> = {};

      for (const finding of findings) {
        bySeverity[finding.severity]++;
        byType[finding.type] = (byType[finding.type] || 0) + 1;
      }

      // Limit and transform findings
      const limitedFindings = findings.slice(0, limit).map((f: BugFinding) => ({
        id: f.id,
        file: f.file,
        line: f.lineStart,
        type: f.type,
        severity: f.severity,
        message: f.message,
        confidence: f.confidence,
        hasAutoFix: !!f.fixStrategy
      }));

      const result: BugfixScanOutput = {
        total: findings.length,
        bySeverity,
        byType,
        findings: limitedFindings,
        durationMs: Date.now() - startTime
      };

      logger.info('[MCP] bugfix_scan completed', {
        total: result.total,
        durationMs: result.durationMs
      });

      return result;
    } catch (error) {
      logger.error('[MCP] bugfix_scan failed', { error });
      throw new Error(`Bug scan failed: ${(error as Error).message}`);
    }
  };
}

/** JSON Schema for bugfix_scan tool */
export const bugfixScanSchema = {
  name: 'bugfix_scan',
  description: `Scan codebase for bugs without applying fixes.

Detects common issues like:
- Timer leaks (setInterval without cleanup)
- Missing destroy() in EventEmitter classes
- Promise timeout leaks
- Resource management issues

Returns severity-sorted list of findings with auto-fix availability.`,
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory to scan (default: current directory)'
      },
      types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['timer_leak', 'missing_destroy', 'promise_timeout_leak', 'event_leak', 'resource_leak', 'race_condition', 'memory_leak', 'uncaught_promise', 'deprecated_api', 'security_issue', 'type_error', 'test_failure', 'custom']
        },
        description: 'Bug types to scan for (default: all)'
      },
      minSeverity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Minimum severity to report (default: low)'
      },
      includePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to include (default: ["**/*.ts", "**/*.js"])'
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to exclude (default: ["node_modules", "dist"])'
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Maximum number of bugs to return (default: 50)'
      }
    }
  }
};
