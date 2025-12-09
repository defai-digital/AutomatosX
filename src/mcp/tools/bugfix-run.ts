/**
 * MCP Tool: bugfix_run
 *
 * Runs autonomous bug-fixing workflow.
 * Scans, analyzes, fixes, and verifies bugs automatically.
 *
 * v12.5.5: Added streaming progress notifications to inform users
 * that the process is running (prevents "hung" perception).
 *
 * @since v12.4.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { BugfixController } from '../../core/bugfix/bugfix-controller.js';
import type { BugType, BugSeverity } from '../../core/bugfix/types.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';

export interface BugfixRunInput {
  /** Directory to scan (default: current directory) */
  path?: string;
  /** Bug types to fix (default: all) */
  types?: BugType[];
  /** Maximum bugs to fix (default: 10) */
  maxBugs?: number;
  /** Dry run mode - show fixes without applying (default: false) */
  dryRun?: boolean;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Require typecheck after each fix (default: true) */
  requireTypecheck?: boolean;
  /** Require tests to pass after fixes (default: false) */
  requireTests?: boolean;
}

export interface BugfixRunOutput {
  /** Session ID for tracking */
  sessionId: string;
  /** Number of bugs found */
  bugsFound: number;
  /** Number of bugs fixed */
  bugsFixed: number;
  /** Number of bugs that failed to fix */
  bugsFailed: number;
  /** Number of bugs skipped (no auto-fix available) */
  bugsSkipped: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total duration in ms */
  durationMs: number;
  /** Final state */
  finalState: string;
  /** Bugs by severity */
  bySeverity: Record<BugSeverity, number>;
  /** Fixed bugs details */
  fixed: Array<{
    file: string;
    line: number;
    type: BugType;
    message: string;
  }>;
  /** Error message if failed */
  error?: string;
}

export function createBugfixRunHandler(): ToolHandler<BugfixRunInput, BugfixRunOutput> {
  return async (input: BugfixRunInput): Promise<BugfixRunOutput> => {
    logger.info('[MCP] bugfix_run called', {
      path: input.path,
      maxBugs: input.maxBugs,
      dryRun: input.dryRun
    });

    // v12.5.5: Start streaming progress notification
    const progressToken = sendMcpProgressBegin('Bugfix', 'Starting bug scan...');

    try {
      // Note: includePatterns is handled by file scanning, not in BugfixConfig
      // v12.5.5: Add onProgress callback to send streaming updates
      const controller = new BugfixController({
        rootDir: input.path || process.cwd(),
        config: {
          bugTypes: input.types,
          maxBugs: input.maxBugs || 10,
          dryRun: input.dryRun || false,
          excludePatterns: input.excludePatterns,
          requireTypecheck: input.requireTypecheck ?? true,
          requireTests: input.requireTests ?? false
        },
        // v12.5.5: Stream brief progress updates to MCP client
        onProgress: (message: string) => {
          sendMcpProgress(message, progressToken);
        },
        onBugFound: (finding) => {
          sendMcpProgress(`Found: ${finding.type} in ${finding.file}`, progressToken);
        },
        onFixApplied: (finding, attempt) => {
          const status = attempt.status === 'applied' ? '✓' : '○';
          sendMcpProgress(`${status} Fix applied: ${finding.file}:${finding.lineStart}`, progressToken);
        }
      });

      const result = await controller.execute();

      // Build output
      const fixed = result.attempts
        .filter(a => a.status === 'verified')
        .map(a => {
          const finding = result.findings.find(f => f.id === a.bugId);
          return {
            file: finding?.file || 'unknown',
            line: finding?.lineStart || 0,
            type: finding?.type || 'custom' as BugType,
            message: finding?.message || 'Fixed'
          };
        });

      const output: BugfixRunOutput = {
        sessionId: result.sessionId,
        bugsFound: result.stats.bugsFound,
        bugsFixed: result.stats.bugsFixed,
        bugsFailed: result.stats.bugsFailed,
        bugsSkipped: result.stats.bugsSkipped,
        successRate: result.stats.successRate,
        durationMs: result.stats.totalDurationMs,
        finalState: result.finalState,
        bySeverity: result.stats.bugsBySeverity,
        fixed,
        error: result.error
      };

      logger.info('[MCP] bugfix_run completed', {
        sessionId: output.sessionId,
        bugsFixed: output.bugsFixed,
        durationMs: output.durationMs
      });

      // v12.5.5: End streaming progress notification
      sendMcpProgressEnd(progressToken, `Completed: ${output.bugsFixed} bugs fixed`);

      return output;
    } catch (error) {
      logger.error('[MCP] bugfix_run failed', { error });
      // v12.5.5: End streaming progress notification on error
      sendMcpProgressEnd(progressToken, `Error: ${(error as Error).message}`);
      throw new Error(`Bugfix run failed: ${(error as Error).message}`);
    }
  };
}

/** JSON Schema for bugfix_run tool */
export const bugfixRunSchema = {
  name: 'bugfix_run',
  description: `Run autonomous bug-fixing workflow.

**Time limit**: Max 45 minutes. You can stop anytime.
**Progress**: Streamed notifications show what's happening.

Workflow:
1. Scans codebase for bugs
2. Prioritizes by severity
3. Applies fixes with backups
4. Verifies via typecheck/tests
5. Rolls back failed fixes

Safety: Backups created, dry-run available, stops at limits.`,
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
        description: 'Bug types to fix (default: all)'
      },
      maxBugs: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Maximum bugs to fix (default: 10)'
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview fixes without applying (default: false)'
      },
      includePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to include'
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to exclude'
      },
      requireTypecheck: {
        type: 'boolean',
        description: 'Require typecheck after each fix (default: true)'
      },
      requireTests: {
        type: 'boolean',
        description: 'Require tests to pass after fixes (default: false)'
      }
    }
  }
};
