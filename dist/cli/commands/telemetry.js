/**
 * telemetry.ts
 *
 * CLI command to manage telemetry and view usage analytics
 */
import { Command } from 'commander';
import { TelemetryDAO } from '../../database/dao/TelemetryDAO.js';
import { initializeTelemetryService } from '../../services/TelemetryService.js';
import Table from 'cli-table3';
import chalk from 'chalk';
/**
 * Format date to YYYY-MM-DD
 */
function formatDate(timestamp) {
    return new Date(timestamp).toISOString().split('T')[0];
}
/**
 * Format duration in ms
 */
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
}
/**
 * Create telemetry command with subcommands
 */
export function createTelemetryCommand() {
    const command = new Command('telemetry')
        .description('Manage telemetry and view usage analytics')
        .alias('tel');
    // Subcommand: status
    command
        .command('status')
        .description('Show telemetry configuration and current status')
        .action(async () => {
        try {
            const dao = new TelemetryDAO();
            const service = initializeTelemetryService(dao);
            await service.initialize();
            const config = dao.getConfig();
            console.log(chalk.bold('\n📊 Telemetry Status\n'));
            // Configuration table
            const configTable = new Table({
                head: [chalk.cyan('Setting'), chalk.cyan('Value')],
                colWidths: [25, 30],
            });
            if (config) {
                configTable.push(['Enabled', config.enabled ? chalk.green('Yes') : chalk.red('No')], ['Remote Submission', config.remote ? chalk.green('Yes') : chalk.red('No')], ['Session ID', chalk.gray(config.sessionId.substring(0, 16) + '...')], [
                    'Consent Date',
                    config.consentDate
                        ? chalk.gray(formatDate(config.consentDate))
                        : chalk.gray('N/A')
                ], [
                    'Opt-out Date',
                    config.optOutDate
                        ? chalk.gray(formatDate(config.optOutDate))
                        : chalk.gray('N/A')
                ]);
            }
            else {
                configTable.push(['Enabled', chalk.red('No')], ['Status', chalk.gray('Not configured')]);
            }
            console.log(configTable.toString());
            // If enabled and remote, show queue stats
            if (config && config.enabled && config.remote) {
                const queueStats = service.getQueueStats();
                if (queueStats) {
                    console.log(chalk.bold('\n📤 Remote Submission Queue:\n'));
                    const queueTable = new Table({
                        head: [chalk.cyan('Metric'), chalk.cyan('Count')],
                        colWidths: [25, 15],
                    });
                    queueTable.push(['Pending Events', chalk.yellow(queueStats.pending.toString())], ['Retrying Events', chalk.blue(queueStats.retrying.toString())], ['Total in Queue', chalk.cyan(queueStats.total.toString())]);
                    console.log(queueTable.toString());
                    if (queueStats.total > 0) {
                        console.log(chalk.gray('\n  Manual submission: ax telemetry submit'));
                    }
                }
            }
            // Local storage stats (if enabled)
            if (config && config.enabled) {
                const eventCount = dao.getEventCount();
                console.log(chalk.bold('\n💾 Local Storage:\n'));
                const storageTable = new Table({
                    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
                    colWidths: [25, 15],
                });
                storageTable.push(['Total Events', chalk.yellow(eventCount.toLocaleString())]);
                console.log(storageTable.toString());
            }
            if (!config || !config.enabled) {
                console.log(chalk.bold('\n💡 Enable Telemetry:'));
                console.log(chalk.gray('  Run: ax telemetry enable'));
                console.log(chalk.gray('  This helps improve AutomatosX by collecting anonymous usage data'));
                console.log(chalk.gray('  All data is stored locally and never contains PII'));
            }
            console.log();
        }
        catch (error) {
            console.error(chalk.red('Error getting telemetry status:'), error);
            process.exit(1);
        }
    });
    // Subcommand: enable
    command
        .command('enable')
        .description('Enable telemetry collection')
        .option('-r, --remote', 'Enable remote submission (default: local only)')
        .action(async (options) => {
        try {
            const dao = new TelemetryDAO();
            const service = initializeTelemetryService(dao);
            await service.enable(options.remote || false);
            console.log(chalk.green('\n✓ Telemetry enabled successfully!\n'));
            console.log(chalk.gray('Telemetry data will be collected locally.'));
            if (options.remote) {
                console.log(chalk.gray('Remote submission is enabled.'));
            }
            else {
                console.log(chalk.gray('Remote submission is disabled (local only).'));
            }
            console.log(chalk.gray('\nWhat data is collected:'));
            console.log(chalk.gray('  • Command execution times'));
            console.log(chalk.gray('  • Query performance metrics'));
            console.log(chalk.gray('  • Parser invocation statistics'));
            console.log(chalk.gray('  • Error occurrences (no stack traces)'));
            console.log(chalk.gray('  • Performance metrics'));
            console.log(chalk.gray('\nWhat is NOT collected:'));
            console.log(chalk.gray('  • File paths or names'));
            console.log(chalk.gray('  • Code content'));
            console.log(chalk.gray('  • User identifiers'));
            console.log(chalk.gray('  • Any personally identifiable information'));
            console.log(chalk.gray('\nYou can disable telemetry anytime with:'));
            console.log(chalk.gray('  ax telemetry disable'));
            console.log();
        }
        catch (error) {
            console.error(chalk.red('Error enabling telemetry:'), error);
            process.exit(1);
        }
    });
    // Subcommand: disable
    command
        .command('disable')
        .description('Disable telemetry collection')
        .action(async () => {
        try {
            const dao = new TelemetryDAO();
            const service = initializeTelemetryService(dao);
            await service.disable();
            console.log(chalk.yellow('\n✓ Telemetry disabled successfully\n'));
            console.log(chalk.gray('No telemetry data will be collected.'));
            console.log(chalk.gray('Existing data has been preserved.'));
            console.log(chalk.gray('\nTo clear existing data:'));
            console.log(chalk.gray('  ax telemetry clear'));
            console.log();
        }
        catch (error) {
            console.error(chalk.red('Error disabling telemetry:'), error);
            process.exit(1);
        }
    });
    // Subcommand: stats
    command
        .command('stats')
        .description('Show telemetry statistics and usage analytics')
        .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
        .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
        .option('-t, --type <type>', 'Stat type (command|query|error|performance)')
        .action(async (options) => {
        try {
            const dao = new TelemetryDAO();
            console.log(chalk.bold('\n📊 Telemetry Statistics\n'));
            // Get stats
            const stats = options.type
                ? dao.getStatsByType(options.type, 50)
                : dao.getStats(options.start, options.end);
            if (stats.length === 0) {
                console.log(chalk.gray('No telemetry data available.'));
                console.log(chalk.gray('\nEnable telemetry to start collecting data:'));
                console.log(chalk.gray('  ax telemetry enable'));
                console.log();
                return;
            }
            // Group by stat type
            const commandStats = stats.filter(s => s.statType === 'command');
            const queryStats = stats.filter(s => s.statType === 'query');
            const errorStats = stats.filter(s => s.statType === 'error');
            const perfStats = stats.filter(s => s.statType === 'performance');
            // Command statistics
            if (commandStats.length > 0) {
                console.log(chalk.bold('📝 Command Usage:'));
                const cmdTable = new Table({
                    head: [
                        chalk.cyan('Command'),
                        chalk.cyan('Count'),
                        chalk.cyan('Avg Duration'),
                        chalk.cyan('Min'),
                        chalk.cyan('Max')
                    ],
                    colWidths: [20, 10, 15, 10, 10],
                });
                commandStats
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .forEach(stat => {
                    cmdTable.push([
                        stat.statKey,
                        chalk.yellow(stat.count.toLocaleString()),
                        stat.avgDuration ? chalk.blue(formatDuration(stat.avgDuration)) : 'N/A',
                        stat.minDuration ? chalk.gray(formatDuration(stat.minDuration)) : 'N/A',
                        stat.maxDuration ? chalk.gray(formatDuration(stat.maxDuration)) : 'N/A',
                    ]);
                });
                console.log(cmdTable.toString());
            }
            // Query statistics
            if (queryStats.length > 0) {
                console.log(chalk.bold('\n🔍 Query Performance:'));
                const queryTable = new Table({
                    head: [
                        chalk.cyan('Query Type'),
                        chalk.cyan('Count'),
                        chalk.cyan('Avg Duration'),
                        chalk.cyan('Min'),
                        chalk.cyan('Max')
                    ],
                    colWidths: [20, 10, 15, 10, 10],
                });
                queryStats
                    .sort((a, b) => b.count - a.count)
                    .forEach(stat => {
                    queryTable.push([
                        stat.statKey,
                        chalk.yellow(stat.count.toLocaleString()),
                        stat.avgDuration ? chalk.blue(formatDuration(stat.avgDuration)) : 'N/A',
                        stat.minDuration ? chalk.gray(formatDuration(stat.minDuration)) : 'N/A',
                        stat.maxDuration ? chalk.gray(formatDuration(stat.maxDuration)) : 'N/A',
                    ]);
                });
                console.log(queryTable.toString());
            }
            // Error statistics
            if (errorStats.length > 0) {
                console.log(chalk.bold('\n❌ Error Summary:'));
                const errorTable = new Table({
                    head: [chalk.cyan('Error Type'), chalk.cyan('Count')],
                    colWidths: [40, 10],
                });
                errorStats
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .forEach(stat => {
                    errorTable.push([
                        stat.statKey,
                        chalk.red(stat.count.toLocaleString())
                    ]);
                });
                console.log(errorTable.toString());
            }
            // Performance statistics
            if (perfStats.length > 0) {
                console.log(chalk.bold('\n⚡ Performance Metrics:'));
                const perfTable = new Table({
                    head: [chalk.cyan('Metric'), chalk.cyan('Count')],
                    colWidths: [40, 10],
                });
                perfStats
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .forEach(stat => {
                    perfTable.push([
                        stat.statKey,
                        chalk.blue(stat.count.toLocaleString())
                    ]);
                });
                console.log(perfTable.toString());
            }
            // Summary
            const totalEvents = stats.reduce((sum, s) => sum + s.count, 0);
            console.log(chalk.bold('\n📈 Summary:'));
            console.log(chalk.gray(`  Total Events: ${totalEvents.toLocaleString()}`));
            console.log(chalk.gray(`  Date Range: ${options.start || 'All'} to ${options.end || 'Now'}`));
            console.log();
        }
        catch (error) {
            console.error(chalk.red('Error getting telemetry stats:'), error);
            process.exit(1);
        }
    });
    // Subcommand: submit
    command
        .command('submit')
        .description('Manually trigger remote submission of queued events')
        .action(async () => {
        try {
            const dao = new TelemetryDAO();
            const service = initializeTelemetryService(dao);
            await service.initialize();
            console.log(chalk.bold('\n📤 Submitting queued events...\n'));
            // Check if remote enabled
            const config = dao.getConfig();
            if (!config || !config.remote) {
                console.log(chalk.yellow('⚠ Remote submission is not enabled'));
                console.log(chalk.gray('\nTo enable remote submission:'));
                console.log(chalk.gray('  ax telemetry enable --remote'));
                console.log();
                return;
            }
            // Get queue stats before submission
            const statsBefore = service.getQueueStats();
            if (!statsBefore || (statsBefore.pending === 0 && statsBefore.retrying === 0)) {
                console.log(chalk.gray('✓ No events in queue'));
                console.log();
                return;
            }
            console.log(chalk.gray(`Queue before: ${statsBefore.pending} pending, ${statsBefore.retrying} retrying`));
            // Force submission
            const result = await service.forceSubmission();
            if (!result) {
                console.log(chalk.yellow('\n⚠ Submission skipped (rate limited or no events)'));
                console.log(chalk.gray('\nAutomatic submission will occur in background.'));
                console.log();
                return;
            }
            // Show results
            if (result.success) {
                console.log(chalk.green(`\n✓ Submitted ${result.accepted} events successfully`));
            }
            else {
                console.log(chalk.red(`\n✗ Submission failed`));
                console.log(chalk.red(`  Rejected: ${result.rejected} events`));
                if (result.errors && result.errors.length > 0) {
                    console.log(chalk.red(`  Errors: ${result.errors.join(', ')}`));
                }
            }
            // Get queue stats after submission
            const statsAfter = service.getQueueStats();
            if (statsAfter) {
                console.log(chalk.gray(`Queue after: ${statsAfter.pending} pending, ${statsAfter.retrying} retrying`));
            }
            console.log();
        }
        catch (error) {
            console.error(chalk.red('Error submitting telemetry data:'), error);
            process.exit(1);
        }
    });
    // Subcommand: clear
    command
        .command('clear')
        .description('Clear all telemetry data')
        .option('--before <date>', 'Clear data before date (YYYY-MM-DD)')
        .action(async (options) => {
        try {
            const dao = new TelemetryDAO();
            const service = initializeTelemetryService(dao);
            await service.initialize();
            if (options.before) {
                dao.clearEventsBefore(options.before);
                console.log(chalk.green(`\n✓ Cleared telemetry data before ${options.before}\n`));
            }
            else {
                // Clear both events and queue
                dao.clearAllEvents();
                const queueCleared = service.clearQueue();
                console.log(chalk.green('\n✓ All telemetry data cleared successfully'));
                if (queueCleared > 0) {
                    console.log(chalk.gray(`  Cleared ${queueCleared} queued submissions`));
                }
                console.log();
            }
            console.log(chalk.gray('Telemetry collection remains enabled.'));
            console.log(chalk.gray('New events will continue to be collected.'));
            console.log();
        }
        catch (error) {
            console.error(chalk.red('Error clearing telemetry data:'), error);
            process.exit(1);
        }
    });
    // Subcommand: export
    command
        .command('export')
        .description('Export telemetry data for debugging')
        .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
        .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
        .option('-o, --output <file>', 'Output file (default: stdout)')
        .action(async (options) => {
        try {
            const dao = new TelemetryDAO();
            const events = dao.getEvents(options.start, options.end);
            const output = JSON.stringify(events, null, 2);
            if (options.output) {
                const fs = await import('fs');
                fs.writeFileSync(options.output, output, 'utf-8');
                console.log(chalk.green(`\n✓ Exported ${events.length} events to ${options.output}\n`));
            }
            else {
                console.log(output);
            }
        }
        catch (error) {
            console.error(chalk.red('Error exporting telemetry data:'), error);
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=telemetry.js.map