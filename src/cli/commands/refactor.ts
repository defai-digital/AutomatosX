/**
 * Refactor Command - Autonomous code refactoring
 *
 * @module cli/commands/refactor
 * @since v12.7.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import {
  RefactorController,
  type RefactorFinding,
  type RefactorResult,
  type RefactorSeverity,
  type RefactorType,
  type RefactorState,
} from '../../core/refactor/index.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * CLI options for refactor command
 */
interface RefactorOptions {
  focus?: string[];
  iterations?: number;
  scope?: string;
  conservative?: boolean;
  dryRun?: boolean;
  noLlm?: boolean;
  maxChanges?: number;
  minImprovement?: number;
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  report?: boolean | string;
  changed?: boolean;
  staged?: boolean;
  since?: string;
  check?: boolean;
  severity?: string;
}

/**
 * Format severity with color
 */
function formatSeverity(severity: RefactorSeverity): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white(' CRITICAL ');
    case 'high':
      return chalk.red('[HIGH]');
    case 'medium':
      return chalk.yellow('[MED]');
    case 'low':
      return chalk.gray('[LOW]');
    default: {
      const s = severity as string;
      return `[${s.toUpperCase()}]`;
    }
  }
}

/**
 * Format refactor type for display
 */
function formatRefactorType(type: RefactorType): string {
  const typeNames: Record<RefactorType, string> = {
    duplication: 'Duplication',
    readability: 'Readability',
    performance: 'Performance',
    hardcoded_values: 'Hard-coded values',
    naming: 'Naming',
    conditionals: 'Conditionals',
    dead_code: 'Dead code',
    type_safety: 'Type safety',
  };

  return typeNames[type] || type;
}

/**
 * Parse focus areas from CLI input
 */
function parseFocusAreas(input: string[] | undefined): RefactorType[] {
  if (!input || input.length === 0) {
    return [
      'duplication',
      'readability',
      'performance',
      'hardcoded_values',
      'naming',
      'conditionals',
      'dead_code',
      'type_safety',
    ];
  }

  const validTypes: RefactorType[] = [
    'duplication',
    'readability',
    'performance',
    'hardcoded_values',
    'naming',
    'conditionals',
    'dead_code',
    'type_safety',
  ];

  // Handle comma-separated values
  const parsed: RefactorType[] = [];
  for (const item of input) {
    const parts = item.split(',').map((p) => p.trim().toLowerCase());
    for (const part of parts) {
      // Handle shorthand names
      const normalized = part === 'hardcoded' ? 'hardcoded_values' : part;
      if (validTypes.includes(normalized as RefactorType)) {
        parsed.push(normalized as RefactorType);
      }
    }
  }

  return parsed.length > 0 ? parsed : validTypes;
}

/**
 * Parse severity threshold
 */
function parseSeverity(input: string | undefined): RefactorSeverity {
  const valid: RefactorSeverity[] = ['low', 'medium', 'high', 'critical'];
  if (input && valid.includes(input as RefactorSeverity)) {
    return input as RefactorSeverity;
  }
  return 'low';
}

/**
 * Generate JSON output
 */
function generateJsonOutput(result: RefactorResult): string {
  return JSON.stringify(
    {
      sessionId: result.sessionId,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      finalState: result.finalState,
      stats: result.stats,
      metricsBefore: result.metricsBefore,
      metricsAfter: result.metricsAfter,
      improvements: result.improvements,
      findings: result.findings.map((f) => ({
        id: f.id,
        file: f.file,
        line: f.lineStart,
        type: f.type,
        severity: f.severity,
        message: f.message,
        suggestion: f.suggestedFix,
        confidence: f.confidence,
      })),
    },
    null,
    2
  );
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(result: RefactorResult): string {
  const lines: string[] = [
    '# Refactoring Report',
    '',
    `**Session ID**: ${result.sessionId}`,
    `**Date**: ${new Date(result.startedAt).toLocaleString()}`,
    `**Duration**: ${(result.stats.totalDurationMs / 1000).toFixed(1)}s`,
    `**Status**: ${result.finalState}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Opportunities Found | ${result.stats.opportunitiesFound} |`,
    `| Refactors Applied | ${result.stats.refactorsApplied} |`,
    `| Refactors Skipped | ${result.stats.refactorsSkipped} |`,
    `| Success Rate | ${(result.stats.successRate * 100).toFixed(1)}% |`,
    '',
  ];

  // Add metrics comparison if available
  if (result.improvements.length > 0) {
    lines.push('## Metrics Comparison', '');
    lines.push('| Metric | Before | After | Change |');
    lines.push('|--------|--------|-------|--------|');

    for (const imp of result.improvements) {
      if (imp.improvementPercent !== 0) {
        const change =
          imp.improvementPercent > 0
            ? chalk.green(`+${imp.improvementPercent.toFixed(1)}%`)
            : chalk.red(`${imp.improvementPercent.toFixed(1)}%`);
        lines.push(`| ${imp.metric} | ${imp.before} | ${imp.after} | ${change} |`);
      }
    }
    lines.push('');
  }

  // Add findings by type
  lines.push('## Findings by Type', '');
  lines.push('| Type | Count |');
  lines.push('|------|-------|');

  for (const [type, count] of Object.entries(result.stats.opportunitiesByType)) {
    if (count > 0) {
      lines.push(`| ${formatRefactorType(type as RefactorType)} | ${count} |`);
    }
  }
  lines.push('');

  // Add detailed findings
  if (result.findings.length > 0) {
    lines.push('## Detailed Findings', '');

    for (const finding of result.findings) {
      lines.push(`### ${finding.file}:${finding.lineStart}`);
      lines.push('');
      lines.push(`- **Type**: ${formatRefactorType(finding.type)}`);
      lines.push(`- **Severity**: ${finding.severity}`);
      lines.push(`- **Message**: ${finding.message}`);
      if (finding.suggestedFix) {
        lines.push(`- **Suggestion**: ${finding.suggestedFix}`);
      }
      lines.push('');
      lines.push('```');
      lines.push(finding.context);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Refactor command implementation
 */
export const refactorCommand: CommandModule<object, RefactorOptions> = {
  command: 'refactor [check]',
  describe: 'Find and apply code refactoring opportunities',
  builder: {
    check: {
      type: 'boolean',
      describe: 'Check mode - exit with code 1 if issues found (for pre-commit hooks)',
      default: false,
    },
    focus: {
      type: 'array',
      describe:
        'Focus areas: duplication, readability, performance, hardcoded, naming, conditionals, dead_code, type_safety',
      default: undefined,
    },
    iterations: {
      type: 'number',
      describe: 'Number of refactoring iterations',
      default: 1,
    },
    scope: {
      type: 'string',
      describe: 'Directory to scan',
      default: '.',
    },
    conservative: {
      type: 'boolean',
      describe: 'Enable conservative mode (prevent over-engineering)',
      default: true,
    },
    'dry-run': {
      type: 'boolean',
      describe: 'Preview changes without applying',
      default: false,
    },
    'no-llm': {
      type: 'boolean',
      describe: 'Static-only mode (no LLM, fast, no API costs)',
      default: false,
    },
    'max-changes': {
      type: 'number',
      describe: 'Maximum changes per file',
      default: 3,
    },
    'min-improvement': {
      type: 'number',
      describe: 'Minimum improvement threshold (0-1)',
      default: 0.1,
    },
    severity: {
      type: 'string',
      describe: 'Minimum severity: low, medium, high, critical',
      default: 'low',
    },
    verbose: {
      type: 'boolean',
      describe: 'Verbose output',
      default: false,
    },
    quiet: {
      type: 'boolean',
      describe: 'Quiet mode (minimal output)',
      default: false,
    },
    json: {
      type: 'boolean',
      describe: 'Output results as JSON',
      default: false,
    },
    report: {
      type: 'string',
      describe: 'Generate markdown report (optional path)',
      default: undefined,
    },
    changed: {
      type: 'boolean',
      describe: 'Only scan git changed files',
      default: false,
    },
    staged: {
      type: 'boolean',
      describe: 'Only scan git staged files',
      default: false,
    },
    since: {
      type: 'string',
      describe: 'Only scan files changed since branch/commit',
      default: undefined,
    },
  },
  handler: async (argv) => {
    const spinner = ora();
    const isQuiet = argv.quiet || argv.json;
    const isCheck = argv.check;

    try {
      // Parse focus areas
      const focusAreas = parseFocusAreas(argv.focus);
      const severityThreshold = parseSeverity(argv.severity);

      // Get file filter if git-aware scanning enabled
      let fileFilter: string[] | undefined;
      if (argv.changed || argv.staged || argv.since) {
        // Simplified git file detection - in production would use git-utils
        if (!isQuiet) {
          spinner.start('Getting changed files from git...');
        }
        // For now, don't filter - full implementation would use git-utils
        fileFilter = undefined;
        if (!isQuiet) {
          spinner.succeed('Git file detection not yet implemented - scanning all files');
        }
      }

      // Create controller
      const controller = new RefactorController({
        rootDir: argv.scope || process.cwd(),
        fileFilter,
        config: {
          focusAreas,
          maxIterations: argv.iterations || 1,
          conservative: argv.conservative !== false,
          dryRun: argv.dryRun || isCheck,
          useLLMForDetection: !argv.noLlm,
          useLLMForRefactoring: !argv.noLlm,
          maxChangesPerFile: argv.maxChanges || 3,
          minImprovementThreshold: argv.minImprovement || 0.1,
          severityThreshold,
          verbose: argv.verbose || false,
          jsonOutput: argv.json || false,
        },
        onProgress: (state: RefactorState, message: string, data?: Record<string, unknown>) => {
          if (!isQuiet && argv.verbose) {
            logger.info(`[${state}] ${message}`, data);
          }
        },
        onFindingFound: (finding: RefactorFinding) => {
          if (!isQuiet && !argv.json) {
            console.log(
              `  ${formatSeverity(finding.severity)} ${chalk.cyan(formatRefactorType(finding.type))} ${finding.file}:${finding.lineStart}`
            );
            console.log(`    ${finding.message}`);
            if (finding.suggestedFix && argv.verbose) {
              console.log(chalk.gray(`    → ${finding.suggestedFix}`));
            }
          }
        },
      });

      // Execute
      if (!isQuiet) {
        spinner.start(
          isCheck
            ? 'Checking for refactoring opportunities...'
            : 'Scanning for refactoring opportunities...'
        );
      }

      let result: RefactorResult;

      if (isCheck) {
        // Scan only mode
        const { findings, metrics } = await controller.scan();
        result = {
          sessionId: controller.getSessionId(),
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          config: controller.getConfig(),
          findings,
          attempts: [],
          metricsBefore: metrics,
          metricsAfter: metrics,
          improvements: [],
          stats: {
            opportunitiesFound: findings.length,
            refactorsApplied: 0,
            refactorsFailed: 0,
            refactorsSkipped: findings.length,
            totalAttempts: 0,
            successRate: 0,
            totalDurationMs: 0,
            complexityReduced: 0,
            duplicationRemoved: 0,
            maintainabilityImproved: 0,
            linesRemoved: 0,
            stopReason: 'Check mode',
            opportunitiesByType: findings.reduce(
              (acc, f) => {
                acc[f.type] = (acc[f.type] || 0) + 1;
                return acc;
              },
              {} as Record<RefactorType, number>
            ),
            opportunitiesBySeverity: findings.reduce(
              (acc, f) => {
                acc[f.severity] = (acc[f.severity] || 0) + 1;
                return acc;
              },
              {} as Record<RefactorSeverity, number>
            ),
            iterationsCompleted: 0,
          },
          finalState: 'COMPLETE',
        };
      } else {
        result = await controller.execute();
      }

      if (!isQuiet) {
        spinner.stop();
      }

      // Output results
      if (argv.json) {
        console.log(generateJsonOutput(result));
      } else if (!isQuiet) {
        console.log('');
        console.log(chalk.bold('Refactoring Summary'));
        console.log('─'.repeat(40));
        console.log(`  Opportunities found: ${chalk.cyan(result.stats.opportunitiesFound)}`);
        console.log(`  Refactors applied:   ${chalk.green(result.stats.refactorsApplied)}`);
        console.log(`  Refactors skipped:   ${chalk.yellow(result.stats.refactorsSkipped)}`);
        console.log(`  Duration:            ${(result.stats.totalDurationMs / 1000).toFixed(1)}s`);
        console.log(`  Status:              ${result.finalState}`);

        if (result.stats.stopReason) {
          console.log(`  Stop reason:         ${result.stats.stopReason}`);
        }
      }

      // Generate report if requested
      if (argv.report !== undefined) {
        const reportPath =
          typeof argv.report === 'string' ? argv.report : './refactor-report.md';
        const fs = await import('fs');
        fs.writeFileSync(reportPath, generateMarkdownReport(result));
        if (!isQuiet) {
          console.log(`\n${chalk.green('✓')} Report saved to ${reportPath}`);
        }
      }

      // Exit with code 1 if check mode and issues found
      if (isCheck && result.stats.opportunitiesFound > 0) {
        if (!isQuiet) {
          console.log(
            chalk.yellow(
              `\n${result.stats.opportunitiesFound} refactoring opportunities found. Use 'ax refactor' to apply fixes.`
            )
          );
        }
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Refactoring failed');
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  },
};

export default refactorCommand;
