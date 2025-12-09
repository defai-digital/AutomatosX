/**
 * MCP Tool: bugfix_scan
 *
 * Scans codebase for bugs without applying fixes.
 * Returns list of detected bugs with severity and suggested fixes.
 *
 * v12.6.0: Added streaming progress notifications.
 *
 * @since v12.4.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { BugDetector, createDefaultBugfixConfig } from '../../core/bugfix/bug-detector.js';
import type { BugType, BugSeverity, BugFinding } from '../../core/bugfix/types.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';

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

    // v12.6.0: Start streaming progress notification
    const progressToken = sendMcpProgressBegin('Bug Scan', 'Scanning codebase...');

    try {
      const rootDir = input.path || process.cwd();
      const limit = input.limit || 50;

      // Build config from input
      // Note: includePatterns is handled by file scanning, not in BugfixConfig
      // Only pass defined values to avoid overriding defaults with undefined
      const configOverrides: Partial<Parameters<typeof createDefaultBugfixConfig>[0]> = {};
      if (input.types) configOverrides.bugTypes = input.types;
      if (input.excludePatterns) configOverrides.excludePatterns = input.excludePatterns;
      const config = createDefaultBugfixConfig(configOverrides);

      // Create detector and scan
      sendMcpProgress('Initializing bug detector...', progressToken);
      const detector = new BugDetector(config);
      let findings = await detector.scan(rootDir);
      sendMcpProgress(`Found ${findings.length} potential bugs`, progressToken);

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

      // v12.6.0: End streaming progress notification
      sendMcpProgressEnd(progressToken, `Completed: ${result.total} bugs found`);

      return result;
    } catch (error) {
      logger.error('[MCP] bugfix_scan failed', { error });
      // v12.6.0: End streaming progress notification on error
      sendMcpProgressEnd(progressToken, `Error: ${(error as Error).message}`);
      throw new Error(`Bug scan failed: ${(error as Error).message}`);
    }
  };
}

/** JSON Schema for bugfix_scan tool */
export const bugfixScanSchema = {
  name: 'bugfix_scan',
  description: `Scan codebase for bugs without applying fixes.

**Time**: Usually 10-60 seconds. You can stop anytime.
**Progress**: Streamed notifications show scanning status.

Detects: Timer leaks, missing destroy(), promise leaks, resource issues.
Returns: Severity-sorted findings with auto-fix availability.`,
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
