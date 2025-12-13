/**
 * Refactor Command - Autonomous code refactoring
 *
 * @module cli/commands/refactor
 * @since v12.7.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import {
  RefactorController,
  type RefactorFinding,
  type RefactorResult,
  type RefactorSeverity,
  type RefactorType,
  type RefactorState,
} from '../../core/refactor/index.js';
import { logger } from '../../shared/logging/logger.js';
import { formatSeverity } from '../../shared/logging/severity-formatter.js';

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
  noReport?: boolean;
  changed?: boolean;
  staged?: boolean;
  since?: string;
  check?: boolean;
  severity?: string;
  triage?: boolean;
  triageProvider?: string;
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
 * v12.10.0: Status markers for refactoring results (PRD-022)
 */
const STATUS_MARKERS = {
  auto: chalk.green('✓ [AUTO]'),
  manual: chalk.yellow('⚠ [MANUAL]'),
  skipped: chalk.gray('○ [SKIPPED]'),
  failed: chalk.red('✗ [FAILED]'),
} as const;

/**
 * v12.10.0: Get status marker based on attempt status (PRD-022)
 */
function getStatusMarker(status: string, autoApplied?: boolean): string {
  if (status === 'success' && autoApplied) {
    return STATUS_MARKERS.auto;
  }
  if (status === 'skipped') {
    return STATUS_MARKERS.manual;
  }
  if (status === 'failed' || status === 'rolled_back') {
    return STATUS_MARKERS.failed;
  }
  return STATUS_MARKERS.skipped;
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
 * v12.10.0: Added autoRefactored, manualReview fields (PRD-022)
 */
function generateJsonOutput(result: RefactorResult): string {
  // v12.10.0: Calculate counts for auto-refactored vs manual review (PRD-022)
  const autoRefactoredCount = result.attempts.filter(
    (a) => a.status === 'success' && a.autoApplied
  ).length;
  const manualReviewCount = result.attempts.filter(
    (a) => a.status === 'skipped'
  ).length;

  // v12.10.0: Build autoRefactored list
  const autoRefactored = result.attempts
    .filter((a) => a.status === 'success' && a.autoApplied)
    .map((a) => {
      const finding = result.findings.find((f) => f.id === a.findingId);
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'dead_code',
        message: finding?.message || 'Refactored',
        autoRefactored: true,
      };
    });

  // v12.10.0: Build manual review list
  const manualReview = result.attempts
    .filter((a) => a.status === 'skipped')
    .map((a) => {
      const finding = result.findings.find((f) => f.id === a.findingId);
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'dead_code',
        message: finding?.message || 'Unknown',
        reason: a.error || 'Complex pattern requires manual review',
      };
    });

  return JSON.stringify(
    {
      sessionId: result.sessionId,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      finalState: result.finalState,
      stats: {
        ...result.stats,
        autoRefactoredCount,
        manualReviewCount,
      },
      metricsBefore: result.metricsBefore,
      metricsAfter: result.metricsAfter,
      improvements: result.improvements,
      findings: result.findings.map((f) => {
        const attempt = result.attempts.find((a) => a.findingId === f.id);
        return {
          id: f.id,
          file: f.file,
          line: f.lineStart,
          type: f.type,
          severity: f.severity,
          message: f.message,
          suggestion: f.suggestedFix,
          confidence: f.confidence,
          autoRefactored: attempt?.status === 'success' && attempt?.autoApplied,
        };
      }),
      autoRefactored,
      manualReview,
    },
    null,
    2
  );
}

/**
 * Generate markdown report
 * v12.10.0: Updated with auto-refactor markers (PRD-022)
 */
function generateMarkdownReport(result: RefactorResult): string {
  // v12.10.0: Calculate counts for auto-refactored vs manual review (PRD-022)
  const autoRefactoredCount = result.attempts.filter(
    (a) => a.status === 'success' && a.autoApplied
  ).length;
  const manualReviewCount = result.attempts.filter(
    (a) => a.status === 'skipped'
  ).length;
  const failedCount = result.attempts.filter(
    (a) => a.status === 'failed' || a.status === 'rolled_back'
  ).length;

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
    `| Auto-Refactored | ${autoRefactoredCount} |`,
    `| Manual Review | ${manualReviewCount} |`,
    `| Failed | ${failedCount} |`,
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
        const changeSign = imp.improvementPercent > 0 ? '+' : '';
        lines.push(`| ${imp.metric} | ${imp.before} | ${imp.after} | ${changeSign}${imp.improvementPercent.toFixed(1)}% |`);
      }
    }
    lines.push('');
  }

  // v12.10.0: Add auto-refactored section (PRD-022)
  const autoRefactored = result.attempts.filter((a) => a.status === 'success' && a.autoApplied);
  if (autoRefactored.length > 0) {
    lines.push('## Auto-Refactored', '');
    lines.push('| Status | Type | File | Line | Message |');
    lines.push('|--------|------|------|------|---------|');

    for (const attempt of autoRefactored) {
      const finding = result.findings.find((f) => f.id === attempt.findingId);
      if (finding) {
        lines.push(`| [AUTO] | ${formatRefactorType(finding.type)} | ${finding.file} | ${finding.lineStart} | ${finding.message} |`);
      }
    }
    lines.push('');
  }

  // v12.10.0: Add manual review required section (PRD-022)
  const manualReview = result.attempts.filter((a) => a.status === 'skipped');
  if (manualReview.length > 0) {
    lines.push('## Manual Review Required', '');
    lines.push('| Type | File | Line | Message | Reason |');
    lines.push('|------|------|------|---------|--------|');

    for (const attempt of manualReview) {
      const finding = result.findings.find((f) => f.id === attempt.findingId);
      if (finding) {
        const reason = attempt.error || 'Complex pattern requires manual review';
        lines.push(`| ${formatRefactorType(finding.type)} | ${finding.file} | ${finding.lineStart} | ${finding.message} | ${reason} |`);
      }
    }
    lines.push('');
  }

  // v12.10.0: Add failed section (PRD-022)
  const failed = result.attempts.filter((a) => a.status === 'failed' || a.status === 'rolled_back');
  if (failed.length > 0) {
    lines.push('## Failed Refactors', '');
    lines.push('| Type | File | Line | Error |');
    lines.push('|------|------|------|-------|');

    for (const attempt of failed) {
      const finding = result.findings.find((f) => f.id === attempt.findingId);
      if (finding) {
        const error = attempt.error || 'Unknown error';
        lines.push(`| ${formatRefactorType(finding.type)} | ${finding.file} | ${finding.lineStart} | ${error} |`);
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

  // Add detailed findings (optional, verbose)
  if (result.findings.length > 0 && result.findings.length <= 20) {
    lines.push('## Detailed Findings', '');

    for (const finding of result.findings) {
      const attempt = result.attempts.find((a) => a.findingId === finding.id);
      const marker = attempt?.status === 'success' && attempt?.autoApplied
        ? '[AUTO]'
        : attempt?.status === 'skipped'
        ? '[MANUAL]'
        : attempt?.status === 'failed'
        ? '[FAILED]'
        : '';

      lines.push(`### ${marker} ${finding.file}:${finding.lineStart}`);
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
        'Focus areas: duplication, readability, performance, hardcoded_values, naming, conditionals, dead_code, type_safety',
      choices: [
        'duplication',
        'readability',
        'performance',
        'hardcoded_values',
        'naming',
        'conditionals',
        'dead_code',
        'type_safety',
      ],
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
      describe: 'static-only mode (no LLM, fast, no API costs)',
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
      choices: ['low', 'medium', 'high', 'critical'],
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
    'no-report': {
      type: 'boolean',
      describe: 'Disable automatic report generation',
      default: false,
    },
    triage: {
      type: 'boolean',
      describe: 'Enable LLM triage to filter false positives',
      default: false,
    },
    'triage-provider': {
      type: 'string',
      describe: 'Provider for LLM triage (claude, gemini, openai)',
      choices: ['claude', 'gemini', 'openai'],
      default: 'claude',
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
            // v12.10.0: Show auto-fix marker based on safeToAutoFix (PRD-022)
            const autoFixMarker = finding.estimatedImpact?.safeToAutoFix
              ? chalk.green('[AUTO]')
              : chalk.yellow('[MANUAL]');
            console.log(
              `  ${formatSeverity(finding.severity)} ${autoFixMarker} ${chalk.cyan(formatRefactorType(finding.type))} ${finding.file}:${finding.lineStart}`
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
        // v12.10.0: Calculate auto-applied vs manual review counts (PRD-022)
        const autoAppliedCount = result.attempts.filter(
          (a) => a.status === 'success' && a.autoApplied
        ).length;
        const manualReviewCount = result.attempts.filter(
          (a) => a.status === 'skipped'
        ).length;
        const failedCount = result.attempts.filter(
          (a) => a.status === 'failed' || a.status === 'rolled_back'
        ).length;

        console.log('');
        console.log(chalk.bold('Refactoring Summary'));
        console.log('─'.repeat(40));
        console.log(`  Opportunities found: ${chalk.cyan(result.stats.opportunitiesFound)}`);
        console.log(`  ${STATUS_MARKERS.auto} Auto-applied:   ${chalk.green(autoAppliedCount)}`);
        console.log(`  ${STATUS_MARKERS.manual} Manual review:  ${chalk.yellow(manualReviewCount)}`);
        if (failedCount > 0) {
          console.log(`  ${STATUS_MARKERS.failed} Failed:         ${chalk.red(failedCount)}`);
        }
        console.log(`  Duration:            ${(result.stats.totalDurationMs / 1000).toFixed(1)}s`);
        console.log(`  Status:              ${result.finalState}`);

        if (result.stats.stopReason) {
          console.log(`  Stop reason:         ${result.stats.stopReason}`);
        }
      }

      // v12.10.0: Auto-generate report by default when refactors are applied (PRD-022)
      const autoAppliedCount = result.attempts.filter(
        (a) => a.status === 'success' && a.autoApplied
      ).length;
      const shouldGenerateReport = !isCheck &&
        !argv.dryRun &&
        !argv.noReport &&
        (argv.report !== undefined || autoAppliedCount > 0);

      if (shouldGenerateReport) {
        // Determine report path
        let reportPath: string;
        if (typeof argv.report === 'string') {
          // User provided explicit path: --report ./path.md
          reportPath = argv.report;
        } else if (argv.report === true) {
          // User passed --report flag without path (legacy behavior)
          reportPath = './refactor-report.md';
        } else {
          // Auto-generated report: default to REPORT/ directory (PRD-022)
          const reportDir = 'REPORT';
          if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          reportPath = path.join(reportDir, `refactor-${timestamp}.md`);
        }

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
