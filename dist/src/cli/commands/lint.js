/**
 * lint.ts
 *
 * CLI command: ax lint [pattern]
 * Pattern-based code linting and issue detection
 */
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ChunkDAO } from '../../database/dao/ChunkDAO.js';
import { runMigrations } from '../../database/migrations.js';
/**
 * Pre-defined lint patterns
 */
const LINT_PATTERNS = {
    todo: {
        pattern: 'TODO',
        description: 'TODO comments',
        severity: 'info',
    },
    fixme: {
        pattern: 'FIXME',
        description: 'FIXME comments',
        severity: 'warning',
    },
    console: {
        pattern: 'console',
        description: 'Console statements',
        severity: 'warning',
    },
    debugger: {
        pattern: 'debugger',
        description: 'Debugger statements',
        severity: 'error',
    },
    any: {
        pattern: 'any',
        description: 'TypeScript any type usage',
        severity: 'warning',
    },
};
/**
 * Severity colors
 */
const SEVERITY_COLORS = {
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
};
/**
 * Format file path
 */
function formatFilePath(path) {
    return path.startsWith('/') ? path.substring(1) : path;
}
/**
 * Display lint results
 */
function displayLintResults(pattern, description, severity, results) {
    if (results.length === 0) {
        console.log();
        console.log(chalk.green(`✓ No issues found for: ${description}`));
        console.log();
        return;
    }
    const severityColor = SEVERITY_COLORS[severity];
    const severityLabel = severity.toUpperCase();
    console.log();
    console.log(severityColor(chalk.bold(`${severityLabel}: ${description}`)));
    console.log(chalk.dim(`Found ${results.length} occurrence(s)`));
    console.log();
    // Create table
    const table = new Table({
        head: [
            chalk.bold('File'),
            chalk.bold('Line'),
            chalk.bold('Type'),
            chalk.bold('Preview'),
        ],
        style: {
            head: [],
            border: [],
        },
        colWidths: [30, 8, 12, 40],
    });
    for (const result of results) {
        // Find the line containing the pattern
        const lines = result.content.split('\n');
        const matchingLine = lines.find((line) => line.toLowerCase().includes(pattern.toLowerCase().split(' ')[0])) || lines[0];
        const preview = matchingLine.trim().substring(0, 35) + '...';
        table.push([
            chalk.cyan(formatFilePath(result.file_path)),
            chalk.yellow(result.start_line.toString()),
            chalk.dim(result.chunk_type),
            chalk.dim(preview),
        ]);
    }
    console.log(table.toString());
    console.log();
}
/**
 * Create lint command
 */
export function createLintCommand() {
    const lintCommand = new Command('lint');
    lintCommand
        .description('Run pattern-based code linting')
        .argument('[pattern]', 'Lint pattern name (todo, fixme, console, debugger, any) or custom pattern')
        .option('-a, --all', 'Run all pre-defined lint patterns')
        .option('-l, --limit <number>', 'Maximum results per pattern (default: 50)', '50')
        .option('--list', 'List available lint patterns')
        .option('--no-color', 'Disable colored output')
        .action(async (pattern, options) => {
        try {
            // Ensure migrations are run
            runMigrations();
            // List patterns and exit
            if (options.list) {
                console.log();
                console.log(chalk.bold('Available lint patterns:'));
                console.log();
                for (const [name, config] of Object.entries(LINT_PATTERNS)) {
                    const severityColor = SEVERITY_COLORS[config.severity];
                    console.log(chalk.cyan(name.padEnd(12)) +
                        chalk.dim(' - ') +
                        config.description +
                        chalk.dim(' [') +
                        severityColor(config.severity) +
                        chalk.dim(']'));
                }
                console.log();
                console.log(chalk.dim('Usage:'));
                console.log(chalk.dim('  ax lint todo           # Run single pattern'));
                console.log(chalk.dim('  ax lint --all          # Run all patterns'));
                console.log(chalk.dim('  ax lint "custom pattern"  # Search for custom pattern'));
                console.log();
                process.exit(0);
            }
            const chunkDAO = new ChunkDAO();
            const limit = parseInt(options.limit, 10);
            // Determine which patterns to run
            let patternsToRun = [];
            if (options.all) {
                // Run all pre-defined patterns
                patternsToRun = Object.entries(LINT_PATTERNS).map(([name, config]) => ({
                    name,
                    ...config,
                }));
            }
            else if (pattern) {
                // Check if it's a pre-defined pattern
                if (LINT_PATTERNS[pattern]) {
                    patternsToRun = [{ name: pattern, ...LINT_PATTERNS[pattern] }];
                }
                else {
                    // Custom pattern
                    patternsToRun = [{
                            name: 'custom',
                            pattern,
                            description: `Custom pattern: "${pattern}"`,
                            severity: 'info',
                        }];
                }
            }
            else {
                // No pattern specified, show usage
                console.log();
                console.log(chalk.yellow('No pattern specified.'));
                console.log();
                console.log(chalk.dim('Usage:'));
                console.log(chalk.dim('  ax lint todo           # Run single pattern'));
                console.log(chalk.dim('  ax lint --all          # Run all patterns'));
                console.log(chalk.dim('  ax lint --list         # List available patterns'));
                console.log();
                process.exit(0);
            }
            console.log();
            console.log(chalk.bold('Running lint checks...'));
            let totalIssues = 0;
            const issuesBySeverity = { error: 0, warning: 0, info: 0 };
            // Run each pattern
            for (const lintPattern of patternsToRun) {
                const results = chunkDAO.search(lintPattern.pattern, limit);
                displayLintResults(lintPattern.pattern, lintPattern.description, lintPattern.severity, results);
                totalIssues += results.length;
                issuesBySeverity[lintPattern.severity] += results.length;
            }
            // Summary
            console.log(chalk.dim('─'.repeat(80)));
            console.log();
            console.log(chalk.bold('Summary:'));
            console.log(chalk.dim(`  Total issues: ${totalIssues}`));
            if (issuesBySeverity.error > 0) {
                console.log(chalk.red(`  Errors: ${issuesBySeverity.error}`));
            }
            if (issuesBySeverity.warning > 0) {
                console.log(chalk.yellow(`  Warnings: ${issuesBySeverity.warning}`));
            }
            if (issuesBySeverity.info > 0) {
                console.log(chalk.blue(`  Info: ${issuesBySeverity.info}`));
            }
            console.log();
            // Exit code based on severity
            if (issuesBySeverity.error > 0) {
                process.exit(1);
            }
        }
        catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    return lintCommand;
}
//# sourceMappingURL=lint.js.map