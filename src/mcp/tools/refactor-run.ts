/**
 * MCP Tool: refactor_run
 *
 * Run autonomous refactoring workflow.
 * Applies refactorings with verification and rollback on failure.
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
  type RefactorState,
} from '../../core/refactor/index.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';

export interface RefactorRunInput {
  /** Directory to refactor (default: current directory) */
  path?: string;
  /** Focus areas to refactor (default: all) */
  focus?: RefactorType[];
  /** Number of refactoring iterations (default: 1) */
  iterations?: number;
  /** Preview changes without applying (default: false) */
  dryRun?: boolean;
  /** Enable overengineering prevention (default: true) */
  conservative?: boolean;
  /** Static-only mode - no LLM (default: false) */
  noLlm?: boolean;
  /** Max changes per file (default: 3) */
  maxChangesPerFile?: number;
  /** Min improvement threshold 0-1 (default: 0.1) */
  minImprovement?: number;
}

export interface RefactorRunOutput {
  /** Final status */
  status: 'completed' | 'failed';
  /** Session identifier */
  sessionId: string;
  /** Duration in ms */
  durationMs: number;
  /** Reason for stopping */
  stopReason: string;
  /** Statistics */
  stats: {
    opportunitiesFound: number;
    refactorsApplied: number;
    refactorsSkipped: number;
    successRate: number;
    iterationsCompleted: number;
  };
  /** Metrics before refactoring */
  metricsBefore: {
    linesOfCode: number;
    avgComplexity: number;
    duplicationPercent: number;
    maintainabilityIndex: number;
  };
  /** Metrics after refactoring */
  metricsAfter: {
    linesOfCode: number;
    avgComplexity: number;
    duplicationPercent: number;
    maintainabilityIndex: number;
  };
  /** Metric improvements */
  improvements: Array<{
    metric: string;
    before: number;
    after: number;
    changePercent: number;
    meetsThreshold: boolean;
  }>;
  /** Sample findings (up to 20) */
  findings: Array<{
    file: string;
    line: number;
    type: RefactorType;
    severity: RefactorSeverity;
    message: string;
    suggestion?: string;
  }>;
}

export function createRefactorRunHandler(): ToolHandler<RefactorRunInput, RefactorRunOutput> {
  return async (input: RefactorRunInput): Promise<RefactorRunOutput> => {
    const startTime = Date.now();
    logger.info('[MCP] refactor_run called', {
      path: input.path,
      focus: input.focus,
      dryRun: input.dryRun,
    });

    const progressToken = sendMcpProgressBegin(
      'Refactor Run',
      input.dryRun ? 'Analyzing (dry run)...' : 'Starting refactoring...'
    );

    try {
      const rootDir = input.path || process.cwd();

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
          maxIterations: input.iterations || 1,
          dryRun: input.dryRun || false,
          conservative: input.conservative !== false,
          useLLMForDetection: !input.noLlm,
          useLLMForRefactoring: !input.noLlm,
          maxChangesPerFile: input.maxChangesPerFile || 3,
          minImprovementThreshold: input.minImprovement || 0.1,
        }),
        onProgress: (state: RefactorState, message: string) => {
          sendMcpProgress(`[${state}] ${message}`, progressToken);
        },
      });

      sendMcpProgress('Executing refactoring workflow...', progressToken);
      const result = await controller.execute();

      const output: RefactorRunOutput = {
        status: result.finalState === 'COMPLETE' ? 'completed' : 'failed',
        sessionId: result.sessionId,
        durationMs: Date.now() - startTime,
        stopReason: result.stats.stopReason,
        stats: {
          opportunitiesFound: result.stats.opportunitiesFound,
          refactorsApplied: result.stats.refactorsApplied,
          refactorsSkipped: result.stats.refactorsSkipped,
          successRate: result.stats.successRate,
          iterationsCompleted: result.stats.iterationsCompleted,
        },
        metricsBefore: {
          linesOfCode: result.metricsBefore.linesOfCode,
          avgComplexity: result.metricsBefore.avgCyclomaticComplexity,
          duplicationPercent: result.metricsBefore.duplicationPercentage,
          maintainabilityIndex: result.metricsBefore.maintainabilityIndex,
        },
        metricsAfter: {
          linesOfCode: result.metricsAfter.linesOfCode,
          avgComplexity: result.metricsAfter.avgCyclomaticComplexity,
          duplicationPercent: result.metricsAfter.duplicationPercentage,
          maintainabilityIndex: result.metricsAfter.maintainabilityIndex,
        },
        improvements: result.improvements
          .filter((i) => i.improvementPercent !== 0)
          .map((i) => ({
            metric: i.metric,
            before: i.before,
            after: i.after,
            changePercent: i.improvementPercent,
            meetsThreshold: i.meetsThreshold,
          })),
        findings: result.findings.slice(0, 20).map((f) => ({
          file: f.file,
          line: f.lineStart,
          type: f.type,
          severity: f.severity,
          message: f.message,
          suggestion: f.suggestedFix,
        })),
      };

      logger.info('[MCP] refactor_run completed', {
        status: output.status,
        opportunitiesFound: output.stats.opportunitiesFound,
        refactorsApplied: output.stats.refactorsApplied,
        durationMs: output.durationMs,
      });

      sendMcpProgressEnd(
        progressToken,
        `${output.status}: ${output.stats.refactorsApplied}/${output.stats.opportunitiesFound} refactors applied`
      );

      return output;
    } catch (error) {
      logger.error('[MCP] refactor_run failed', { error });
      sendMcpProgressEnd(progressToken, 'Refactoring failed');
      throw error;
    }
  };
}

/** JSON Schema for refactor_run tool */
export const refactorRunSchema = {
  name: 'refactor_run',
  description: `Run autonomous refactoring workflow.

**Focus Areas** (8 types):
- \`dead_code\`: Remove unused imports, variables, unreachable code
- \`type_safety\`: Fix any types, unsafe assertions
- \`conditionals\`: Simplify with guard clauses
- \`hardcoded_values\`: Extract to constants
- \`naming\`: Improve variable/function names
- \`duplication\`: Extract duplicated code
- \`readability\`: Reduce complexity
- \`performance\`: Fix N+1, parallelize awaits

**Safety Features**:
- TypeScript typecheck verification
- Test verification
- Metrics must improve
- Overengineering guards (conservative mode)
- Rollback on failure

**Static-Only Mode** (\`noLlm: true\`):
Fast, no API costs. Best for: dead_code, type_safety, conditionals.

Returns: Before/after metrics, improvements, applied changes.`,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory to refactor (default: current directory)' },
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
        description: 'Focus areas (default: all)',
      },
      iterations: {
        type: 'integer',
        description: 'Refactoring iterations (default: 1)',
        minimum: 1,
        maximum: 5,
      },
      dryRun: { type: 'boolean', description: 'Preview without changes (default: false)' },
      conservative: { type: 'boolean', description: 'Prevent overengineering (default: true)' },
      noLlm: { type: 'boolean', description: 'Static-only mode (default: false)' },
      maxChangesPerFile: {
        type: 'integer',
        description: 'Max changes per file (default: 3)',
        minimum: 1,
        maximum: 10,
      },
      minImprovement: {
        type: 'number',
        description: 'Min improvement threshold (default: 0.1)',
        minimum: 0,
        maximum: 1,
      },
    },
  },
};
