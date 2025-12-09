/**
 * Bugfix Command - Autonomous bug finding and fixing
 *
 * @module cli/commands/bugfix
 * @since v12.4.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import {
  BugfixController,
  createDefaultBugfixConfig,
  type BugFinding,
  type FixAttempt,
  type BugfixConfig,
  type BugSeverity,
  type BugType
} from '../../core/bugfix/index.js';
import { logger } from '../../shared/logging/logger.js';
import { detectProjectRoot } from '../../shared/validation/path-resolver.js';

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
}

/**
 * Format severity with color
 */
function formatSeverity(severity: BugSeverity): string {
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
export const bugfixCommand: CommandModule<{}, BugfixOptions> = {
  command: 'bugfix',
  describe: 'Find and fix bugs in the codebase',
  builder: {
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
        'resource_leak'
      ]
    }
  },
  handler: async (argv) => {
    const spinner = ora();
    const findings: BugFinding[] = [];
    const fixedBugs: BugFinding[] = [];
    const failedBugs: BugFinding[] = [];
    const skippedBugs: BugFinding[] = [];

    // Detect project root
    const rootDir = await detectProjectRoot() || process.cwd();

    // Build configuration
    const config: Partial<BugfixConfig> = {
      maxBugs: argv.maxIterations || 10,
      severityThreshold: (argv.severity || 'medium') as BugSeverity,
      scope: argv.scope,
      dryRun: argv.dryRun || false,
      verbose: argv.verbose || false,
      bugTypes: (argv.types as BugType[]) || ['timer_leak', 'missing_destroy', 'promise_timeout_leak']
    };

    if (!argv.quiet) {
      console.log(chalk.cyan('\n🔧 AutomatosX Bug Fixer\n'));

      if (argv.dryRun) {
        console.log(chalk.yellow('  ⚠️  Dry run mode - no changes will be made\n'));
      }

      if (argv.scope) {
        console.log(chalk.gray(`  Scope: ${argv.scope}`));
      }
      console.log(chalk.gray(`  Severity threshold: ${argv.severity}`));
      console.log(chalk.gray(`  Max bugs: ${argv.maxIterations}`));
      console.log();
    }

    try {
      // Create controller with callbacks
      const controller = new BugfixController({
        config,
        rootDir,
        onProgress: (message, data) => {
          if (argv.quiet) return;

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
          if (!argv.quiet && argv.verbose) {
            const icon = success ? '✓' : '✗';
            console.log(chalk.gray(`   ${icon} Verification: ${success ? 'passed' : 'failed'}`));
          }
        }
      });

      // Execute
      const result = await controller.execute();

      // Display results
      if (!argv.quiet) {
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
        // Quiet mode - just output JSON
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
      spinner.fail(chalk.red(`Error: ${(error as Error).message}`));
      logger.error('Bugfix command failed', { error: (error as Error).message });
      process.exitCode = 1;
    }
  }
};

export default bugfixCommand;
