/**
 * Bugfix Command - Autonomous bug finding and fixing
 *
 * @module cli/commands/bugfix
 * @since v12.4.0
 * @updated v12.6.0 - Added JSON output, report generation, git-aware scanning, check subcommand
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import {
  BugfixController,
  getChangedFiles,
  generateJsonOutput,
  writeReport,
  getDefaultReportPath,
  type BugFinding,
  type BugfixConfig,
  type BugSeverity,
  type BugType,
  getMetricsTracker
} from '../../core/bugfix/index.js';
import { logger } from '../../shared/logging/logger.js';
import { detectProjectRoot } from '../../shared/validation/path-resolver.js';
import { getVersion } from '../../shared/helpers/version.js';
import { formatSeverity } from '../../shared/logging/severity-formatter.js';

/**
 * CLI options for bugfix command
 */
interface BugfixOptions {
  auto?: boolean;
  scope?: string;
  severity?: string;
  maxIterations?: number;
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  types?: string[];
  // New options (v12.6.0)
  json?: boolean;
  report?: boolean | string;
  changed?: boolean;
  staged?: boolean;
  since?: string;
  check?: boolean;
  // New options (v12.9.0) - PRD-018
  minConfidence?: number;
  verifyLint?: boolean;
  verifyStrict?: boolean;
}

/**
 * Format bug type for display
 */
function formatBugType(type: BugType): string {
  const typeNames: Record<BugType, string> = {
    timer_leak: 'Timer leak',
    missing_destroy: 'Missing destroy()',
    promise_timeout_leak: 'Promise timeout leak',
    event_leak: 'Event listener leak',
    resource_leak: 'Resource leak',
    race_condition: 'Race condition',
    memory_leak: 'Memory leak',
    uncaught_promise: 'Uncaught promise',
    deprecated_api: 'Deprecated API',
    security_issue: 'Security issue',
    type_error: 'Type error',
    test_failure: 'Test failure',
    custom: 'Custom'
  };

  return typeNames[type] || type;
}

/**
 * Bugfix command implementation
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const bugfixCommand: CommandModule<{}, BugfixOptions> = {
  command: 'bugfix [check]',
  describe: 'Find and fix bugs in the codebase',
  builder: {
    check: {
      type: 'boolean',
      default: false,
      describe: 'Check for bugs without fixing (exit 1 if found) - for pre-commit hooks'
    },
    auto: {
      type: 'boolean',
      default: false,
      describe: 'Run autonomously without prompts'
    },
    scope: {
      type: 'string',
      describe: 'Limit scan to directory (e.g., src/core/)'
    },
    severity: {
      type: 'string',
      choices: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      describe: 'Minimum severity to fix'
    },
    'max-iterations': {
      type: 'number',
      default: 10,
      describe: 'Maximum bugs to fix per session'
    },
    'dry-run': {
      type: 'boolean',
      default: false,
      describe: 'Preview fixes without applying'
    },
    verbose: {
      type: 'boolean',
      default: false,
      describe: 'Verbose output'
    },
    quiet: {
      type: 'boolean',
      default: false,
      describe: 'Minimal output'
    },
    types: {
      type: 'array',
      describe: 'Bug types to scan for',
      choices: [
        'timer_leak',
        'missing_destroy',
        'promise_timeout_leak',
        'event_leak',
        'resource_leak',
        'memory_leak',
        'race_condition',
        'uncaught_promise',
        'deprecated_api',
        'security_issue',
        'type_error',
        'test_failure',
        'custom'
      ]
    },
    // New options (v12.6.0)
    json: {
      type: 'boolean',
      default: false,
      describe: 'Output results as JSON'
    },
    report: {
      type: 'string',
      describe: 'Generate markdown report (optionally specify path)',
      coerce: (val: string | boolean) => val === '' ? true : val
    },
    changed: {
      type: 'boolean',
      default: false,
      describe: 'Only scan files changed in git working tree'
    },
    staged: {
      type: 'boolean',
      default: false,
      describe: 'Only scan files staged in git'
    },
    since: {
      type: 'string',
      describe: 'Only scan files changed since branch/commit (e.g., main, HEAD~5)'
    },
    // New options (v12.9.0) - PRD-018
    'min-confidence': {
      type: 'number',
      default: 0.5,
      describe: 'Minimum confidence threshold (0.0-1.0) for bug detection',
      coerce: (val: number) => Math.max(0, Math.min(1, val))
    },
    'verify-lint': {
      type: 'boolean',
      default: false,
      describe: 'Run ESLint verification after fixes'
    },
    'verify-strict': {
      type: 'boolean',
      default: false,
      describe: 'Run strict TypeScript check after fixes'
    }
  },
  handler: async (argv) => {
    const spinner = ora();
    const findings: BugFinding[] = [];
    const fixedBugs: BugFinding[] = [];
    const failedBugs: BugFinding[] = [];
    const skippedBugs: BugFinding[] = [];

    // JSON output mode suppresses all other output
    const isJsonMode = argv.json === true;
    const isQuiet = argv.quiet === true || isJsonMode;
    const isCheckMode = argv.check === true;

    // Detect project root
    const rootDir = await detectProjectRoot() || process.cwd();

    // Get file filter for git-aware scanning
    let fileFilter: string[] | undefined;

    if (argv.changed || argv.staged || argv.since) {
      fileFilter = await getChangedFiles({
        changed: argv.changed,
        staged: argv.staged,
        since: argv.since,
        cwd: rootDir
      });

      if (fileFilter.length === 0) {
        if (isJsonMode) {
          console.log(JSON.stringify({
            version: getVersion(),
            timestamp: new Date().toISOString(),
            message: 'No files to scan',
            summary: { bugsFound: 0, bugsFixed: 0, bugsFailed: 0, bugsSkipped: 0, successRate: 1, durationMs: 0 },
            findings: [],
            fixed: [],
            failed: [],
            skipped: []
          }));
        } else if (!isQuiet) {
          console.log(chalk.green('\nNo changed files to scan.\n'));
        }
        process.exitCode = 0;
        return;
      }

      if (!isQuiet) {
        console.log(chalk.gray(`  Git filter: ${fileFilter.length} file(s) to scan`));
      }
    }

    // Build configuration
    // In check mode, always use dry-run (no fixes)
    const config: Partial<BugfixConfig> = {
      maxBugs: isCheckMode ? 1000 : (argv.maxIterations || 10), // In check mode, find all bugs
      severityThreshold: (argv.severity || 'medium') as BugSeverity,
      scope: argv.scope,
      dryRun: isCheckMode ? true : (argv.dryRun || false), // Check mode is always dry-run
      verbose: argv.verbose || false,
      bugTypes: (argv.types as BugType[]) || ['timer_leak', 'missing_destroy', 'promise_timeout_leak'],
      // v12.9.0: PRD-018 confidence filtering
      minConfidence: argv.minConfidence ?? 0.5,
      // v12.9.0: PRD-018 enhanced verification
      verifyLint: argv.verifyLint || false,
      verifyStrict: argv.verifyStrict || false
    };

    if (!isQuiet) {
      console.log(chalk.cyan('\n🔧 AutomatosX Bug Fixer\n'));

      if (isCheckMode) {
        console.log(chalk.blue('  🔍 Check mode - scanning for bugs (no fixes)\n'));
      } else if (argv.dryRun) {
        console.log(chalk.yellow('  ⚠️  Dry run mode - no changes will be made\n'));
      }

      if (argv.scope) {
        console.log(chalk.gray(`  Scope: ${argv.scope}`));
      }
      console.log(chalk.gray(`  Severity threshold: ${argv.severity}`));
      if (!isCheckMode) {
        console.log(chalk.gray(`  Max bugs: ${argv.maxIterations}`));
      }
      console.log();
    }

    try {
      // Create controller with callbacks
      const controller = new BugfixController({
        config,
        rootDir,
        fileFilter, // Pass file filter for git-aware scanning
        onProgress: (message, _data) => {
          if (isQuiet) return;

          if (message.startsWith('Scanning')) {
            spinner.start(message);
          } else if (message.includes('Found')) {
            spinner.succeed(message);
          } else if (message.startsWith('Fixing')) {
            spinner.start(message);
          } else if (message.includes('verified') || message.includes('Verified')) {
            spinner.succeed(message);
          } else if (message.includes('failed') || message.includes('Failed')) {
            spinner.fail(message);
          } else if (message.includes('Skipped')) {
            spinner.info(message);
          } else if (argv.verbose) {
            spinner.info(message);
          }
        },
        onBugFound: (finding) => {
          findings.push(finding);
        },
        onFixApplied: (finding, attempt) => {
          if (attempt.status === 'verified') {
            fixedBugs.push(finding);
          } else if (attempt.status === 'failed') {
            failedBugs.push(finding);
          } else if (attempt.status === 'skipped') {
            skippedBugs.push(finding);
          }
        },
        onVerification: (finding, success) => {
          if (!isQuiet && argv.verbose) {
            const icon = success ? '✓' : '✗';
            console.log(chalk.gray(`   ${icon} Verification: ${success ? 'passed' : 'failed'}`));
          }
        }
      });

      // Execute
      const result = await controller.execute();

      // Generate report if requested
      if (argv.report) {
        const reportPath = typeof argv.report === 'string'
          ? argv.report
          : getDefaultReportPath(rootDir, 'markdown');

        await writeReport(result, reportPath, 'markdown');

        if (!isQuiet) {
          console.log(chalk.green(`\n📄 Report saved to: ${reportPath}\n`));
        }
      }

      // JSON output mode
      if (isJsonMode) {
        const jsonOutput = generateJsonOutput(result);
        console.log(JSON.stringify(jsonOutput, null, 2));

        // Set exit code based on results
        if (isCheckMode && result.stats.bugsFound > 0) {
          process.exitCode = 1;
        } else if (result.stats.bugsFailed > 0) {
          process.exitCode = 1;
        }
        return;
      }

      // Display results (non-JSON mode)
      if (!isQuiet) {
        spinner.stop();

        console.log('\n' + chalk.cyan('━'.repeat(50)));
        console.log(chalk.cyan.bold('  Results'));
        console.log(chalk.cyan('━'.repeat(50)) + '\n');

        // Bugs found
        if (findings.length > 0) {
          console.log(chalk.bold('📋 Bugs found:\n'));

          for (const finding of findings.slice(0, 20)) {
            const severity = formatSeverity(finding.severity);
            const type = formatBugType(finding.type);
            console.log(`   ${severity} ${type} in ${chalk.cyan(finding.file)}:${finding.lineStart}`);
          }

          if (findings.length > 20) {
            console.log(chalk.gray(`   ... and ${findings.length - 20} more`));
          }
          console.log();
        }

        // In check mode, just show the bugs found
        if (isCheckMode) {
          console.log(chalk.cyan('━'.repeat(50)));
          console.log(chalk.bold('  Summary'));
          console.log(chalk.cyan('━'.repeat(50)));
          console.log();
          console.log(`   Bugs found:    ${result.stats.bugsFound > 0 ? chalk.red(result.stats.bugsFound.toString()) : chalk.green('0')}`);
          console.log(`   Duration:      ${(result.stats.totalDurationMs / 1000).toFixed(1)}s`);
          console.log();

          if (result.stats.bugsFound > 0) {
            console.log(chalk.red('  ✗ Check failed: bugs found in codebase\n'));
            process.exitCode = 1;
          } else {
            console.log(chalk.green('  ✓ Check passed: no bugs found\n'));
            process.exitCode = 0;
          }
          return;
        }

        // Fixed bugs
        if (fixedBugs.length > 0) {
          console.log(chalk.green.bold(`✅ Fixed: ${fixedBugs.length} bug(s)\n`));

          for (const bug of fixedBugs.slice(0, 10)) {
            console.log(chalk.green(`   ✓ ${formatBugType(bug.type)} in ${bug.file}:${bug.lineStart}`));
          }

          if (fixedBugs.length > 10) {
            console.log(chalk.gray(`   ... and ${fixedBugs.length - 10} more`));
          }
          console.log();
        }

        // Failed bugs
        if (failedBugs.length > 0) {
          console.log(chalk.red.bold(`❌ Failed: ${failedBugs.length} bug(s)\n`));

          for (const bug of failedBugs.slice(0, 5)) {
            console.log(chalk.red(`   ✗ ${formatBugType(bug.type)} in ${bug.file}:${bug.lineStart}`));
          }
          console.log();
        }

        // Skipped bugs
        if (skippedBugs.length > 0) {
          console.log(chalk.yellow.bold(`⚠️  Skipped (manual review needed): ${skippedBugs.length} bug(s)\n`));

          for (const bug of skippedBugs.slice(0, 5)) {
            console.log(chalk.yellow(`   → ${formatBugType(bug.type)} in ${bug.file}:${bug.lineStart}`));
          }
          console.log();
        }

        // Summary
        console.log(chalk.cyan('━'.repeat(50)));
        console.log(chalk.bold('  Summary'));
        console.log(chalk.cyan('━'.repeat(50)));
        console.log();
        console.log(`   Bugs found:    ${result.stats.bugsFound}`);
        console.log(`   Bugs fixed:    ${chalk.green(result.stats.bugsFixed.toString())}`);
        console.log(`   Bugs failed:   ${result.stats.bugsFailed > 0 ? chalk.red(result.stats.bugsFailed.toString()) : '0'}`);
        console.log(`   Bugs skipped:  ${result.stats.bugsSkipped}`);
        console.log(`   Success rate:  ${(result.stats.successRate * 100).toFixed(1)}%`);
        console.log(`   Duration:      ${(result.stats.totalDurationMs / 1000).toFixed(1)}s`);
        console.log(`   Stop reason:   ${result.stats.stopReason}`);
        console.log();

        if (argv.dryRun) {
          console.log(chalk.yellow('  ℹ️  This was a dry run. Run without --dry-run to apply fixes.\n'));
        }
      } else {
        // Quiet mode - just output JSON summary
        console.log(JSON.stringify({
          found: result.stats.bugsFound,
          fixed: result.stats.bugsFixed,
          failed: result.stats.bugsFailed,
          skipped: result.stats.bugsSkipped,
          successRate: result.stats.successRate,
          durationMs: result.stats.totalDurationMs
        }));
      }

      // Exit with error if bugs couldn't be fixed
      if (result.stats.bugsFailed > 0) {
        process.exitCode = 1;
      }

    } catch (error) {
      if (!isQuiet) {
        spinner.fail(chalk.red(`Error: ${(error as Error).message}`));
      }
      logger.error('Bugfix command failed', { error: (error as Error).message });

      if (isJsonMode) {
        console.log(JSON.stringify({
          error: (error as Error).message,
          summary: { bugsFound: 0, bugsFixed: 0, bugsFailed: 0, bugsSkipped: 0, successRate: 0, durationMs: 0 }
        }));
      }

      process.exitCode = 1;
    }
  }
};

export default bugfixCommand;

/**
 * Bugfix feedback subcommand - Mark false positives
 * v12.9.0: PRD-018 - False positive feedback system
 */
interface FeedbackOptions {
  file: string;
  line: number;
  feedback?: string;
  truePositive?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const bugfixFeedbackCommand: CommandModule<{}, FeedbackOptions> = {
  command: 'bugfix:feedback',
  describe: 'Report a false positive or confirm a true positive',
  builder: {
    file: {
      type: 'string',
      demandOption: true,
      describe: 'File path where the bug was detected'
    },
    line: {
      type: 'number',
      demandOption: true,
      describe: 'Line number of the detected bug'
    },
    feedback: {
      type: 'string',
      describe: 'Optional feedback explaining why this is a false positive'
    },
    'true-positive': {
      type: 'boolean',
      default: false,
      describe: 'Mark as true positive instead of false positive'
    }
  },
  handler: async (argv) => {
    const rootDir = await detectProjectRoot() || process.cwd();
    const tracker = getMetricsTracker(rootDir);

    try {
      await tracker.init();

      // Find the metric
      const metric = tracker.findByLocation(argv.file, argv.line);

      if (!metric) {
        console.log(chalk.yellow(`\nNo detection found at ${argv.file}:${argv.line}`));
        console.log(chalk.gray('Make sure the file path and line number match a previous detection.\n'));
        process.exitCode = 1;
        return;
      }

      if (argv.truePositive) {
        tracker.markTruePositive(metric.id);
        console.log(chalk.green(`\n✓ Marked as TRUE POSITIVE: ${argv.file}:${argv.line}`));
        console.log(chalk.gray(`  Rule: ${metric.ruleId}`));
        console.log(chalk.gray(`  Type: ${metric.bugType}\n`));
      } else {
        tracker.markFalsePositive(metric.id, argv.feedback);
        console.log(chalk.yellow(`\n⚠ Marked as FALSE POSITIVE: ${argv.file}:${argv.line}`));
        console.log(chalk.gray(`  Rule: ${metric.ruleId}`));
        console.log(chalk.gray(`  Type: ${metric.bugType}`));
        if (argv.feedback) {
          console.log(chalk.gray(`  Feedback: ${argv.feedback}`));
        }
        console.log(chalk.gray('\n  This feedback helps improve detection accuracy.\n'));
      }

    } catch (error) {
      console.log(chalk.red(`\nError: ${(error as Error).message}\n`));
      process.exitCode = 1;
    } finally {
      tracker.close();
    }
  }
};

/**
 * Bugfix metrics subcommand - View detection metrics
 * v12.9.0: PRD-018 - Metrics tracking
 */
interface MetricsOptions {
  json?: boolean;
  rule?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const bugfixMetricsCommand: CommandModule<{}, MetricsOptions> = {
  command: 'bugfix:metrics',
  describe: 'View bugfix detection metrics and accuracy stats',
  builder: {
    json: {
      type: 'boolean',
      default: false,
      describe: 'Output as JSON'
    },
    rule: {
      type: 'string',
      describe: 'Filter by specific rule ID'
    }
  },
  handler: async (argv) => {
    const rootDir = await detectProjectRoot() || process.cwd();
    const tracker = getMetricsTracker(rootDir);

    try {
      await tracker.init();

      if (argv.rule) {
        // Show metrics for specific rule
        const metrics = tracker.getRuleMetrics(argv.rule);

        if (!metrics) {
          console.log(chalk.yellow(`\nNo metrics found for rule: ${argv.rule}\n`));
          process.exitCode = 1;
          return;
        }

        if (argv.json) {
          console.log(JSON.stringify(metrics, null, 2));
        } else {
          console.log(chalk.cyan('\n📊 Rule Metrics: ') + chalk.bold(argv.rule) + '\n');
          console.log(`   Bug Type:       ${metrics.bugType}`);
          console.log(`   Total:          ${metrics.totalDetections}`);
          console.log(`   True Positives: ${chalk.green(metrics.truePositives.toString())}`);
          console.log(`   False Positives:${chalk.red(metrics.falsePositives.toString())}`);
          console.log(`   Unclassified:   ${metrics.unclassified}`);
          console.log(`   Precision:      ${(metrics.precision * 100).toFixed(1)}%`);
          console.log(`   Avg Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
          console.log(`   Fixes Attempted:${metrics.fixesAttempted}`);
          console.log(`   Fixes Success:  ${metrics.fixesSuccessful}`);
          console.log();
        }
        return;
      }

      // Show full summary
      const summary = tracker.getSummary();

      if (!summary || summary.totalDetections === 0) {
        console.log(chalk.yellow('\nNo detection metrics available yet.'));
        console.log(chalk.gray('Run `ax bugfix` to start collecting metrics.\n'));
        return;
      }

      if (argv.json) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      // Display summary
      console.log(chalk.cyan('\n📊 Bugfix Detection Metrics\n'));
      console.log(chalk.cyan('━'.repeat(50)));

      // Overall stats
      console.log(chalk.bold('\n  Overall Statistics\n'));
      console.log(`   Total Detections:  ${summary.totalDetections}`);
      console.log(`   True Positives:    ${chalk.green(summary.totalTruePositives.toString())}`);
      console.log(`   False Positives:   ${chalk.red(summary.totalFalsePositives.toString())}`);
      console.log(`   Unclassified:      ${summary.totalUnclassified}`);
      console.log(`   Overall Precision: ${chalk.bold((summary.overallPrecision * 100).toFixed(1) + '%')}`);

      // By type
      console.log(chalk.bold('\n  By Bug Type\n'));
      for (const [type, stats] of Object.entries(summary.byType)) {
        const precisionStr = stats.truePositives + stats.falsePositives > 0
          ? `${(stats.precision * 100).toFixed(0)}%`
          : 'N/A';
        console.log(`   ${type.padEnd(22)} ${stats.detections.toString().padStart(4)} detections, precision: ${precisionStr}`);
      }

      // By rule
      if (summary.byRule.length > 0) {
        console.log(chalk.bold('\n  By Detection Rule\n'));
        for (const rule of summary.byRule.slice(0, 10)) {
          const precisionStr = rule.truePositives + rule.falsePositives > 0
            ? `${(rule.precision * 100).toFixed(0)}%`
            : 'N/A';
          console.log(`   ${rule.ruleId.padEnd(25)} ${rule.totalDetections.toString().padStart(4)} detections, precision: ${precisionStr}`);
        }
      }

      // Recent false positives
      if (summary.recentFalsePositives.length > 0) {
        console.log(chalk.bold('\n  Recent False Positives\n'));
        for (const fp of summary.recentFalsePositives.slice(0, 5)) {
          console.log(chalk.gray(`   ${fp.file}:${fp.line} (${fp.ruleId})`));
          if (fp.feedback) {
            console.log(chalk.gray(`     Feedback: ${fp.feedback}`));
          }
        }
      }

      console.log(chalk.cyan('\n━'.repeat(50)));
      console.log(chalk.gray('\n  Use `ax bugfix:feedback` to report false positives.'));
      console.log(chalk.gray('  Use `ax bugfix:metrics --rule <rule-id>` for detailed rule metrics.\n'));

    } catch (error) {
      console.log(chalk.red(`\nError: ${(error as Error).message}\n`));
      process.exitCode = 1;
    } finally {
      tracker.close();
    }
  }
};
