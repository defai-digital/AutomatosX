/**
 * watch.ts
 *
 * CLI command: ax watch <directory>
 * Watch directory for changes and automatically index
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { FileService } from '../../services/FileService.js';
import { FileWatcher, FileChangeType } from '../../services/FileWatcher.js';
import { IndexQueue } from '../../services/IndexQueue.js';
import { runMigrations } from '../../database/migrations.js';
import { relative } from 'path';
/**
 * Default configuration
 */
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
/**
 * Create watch command
 */
export function createWatchCommand() {
    const watchCommand = new Command('watch');
    watchCommand
        .description('Watch directory for changes and automatically index')
        .argument('[directory]', 'Directory to watch (default: current directory)', '.')
        .option('-e, --extensions <exts>', 'File extensions to watch (comma-separated)', DEFAULT_EXTENSIONS.join(','))
        .option('--no-color', 'Disable colored output')
        .action(async (directory, options) => {
        try {
            // Ensure migrations are run
            runMigrations();
            // Parse options
            const extensions = options.extensions.split(',').map((e) => e.trim().startsWith('.') ? e.trim() : `.${e.trim()}`);
            // Resolve directory
            const targetDir = directory;
            console.log();
            console.log(chalk.bold(chalk.cyan('AutomatosX v2 - File Watcher')));
            console.log(chalk.dim('─'.repeat(60)));
            console.log();
            console.log(chalk.bold(`Watching: ${chalk.cyan(targetDir)}`));
            console.log(chalk.dim(`Extensions: ${extensions.join(', ')}`));
            console.log();
            console.log(chalk.dim('Press Ctrl+C to stop watching'));
            console.log();
            // Create services
            const fileService = new FileService();
            const indexQueue = new IndexQueue(fileService, 3);
            const watcher = new FileWatcher({
                paths: [targetDir],
                extensions,
            });
            // Track stats
            let changeCount = 0;
            let lastChangeTime = Date.now();
            // Handle file changes
            watcher.on('change', (event) => {
                changeCount++;
                lastChangeTime = Date.now();
                const relativePath = relative(process.cwd(), event.path);
                const timestamp = new Date(event.timestamp).toLocaleTimeString();
                // Determine operation and priority
                let operation = 'update';
                let icon = '~';
                let color = chalk.white;
                switch (event.type) {
                    case FileChangeType.ADDED:
                        operation = 'add';
                        icon = '+';
                        color = chalk.green;
                        break;
                    case FileChangeType.MODIFIED:
                        operation = 'update';
                        icon = '~';
                        color = chalk.yellow;
                        break;
                    case FileChangeType.DELETED:
                        operation = 'delete';
                        icon = '-';
                        color = chalk.red;
                        break;
                }
                console.log(color(chalk.bold(`[${icon}]`)) +
                    chalk.dim(` ${timestamp} `) +
                    color(event.type.padEnd(10)) +
                    chalk.dim(relativePath));
                // Enqueue indexing task
                indexQueue.enqueue(event.path, operation, event.type === FileChangeType.MODIFIED ? 1 : 0);
            });
            // Handle task completion
            indexQueue.on('task-completed', (result) => {
                if (result.result) {
                    const relativePath = relative(process.cwd(), result.task.path);
                    console.log(chalk.green(chalk.bold('  ✓')) +
                        chalk.dim(` Indexed ${relativePath}`) +
                        chalk.dim(` (${result.result.symbolCount} symbols, ${result.duration.toFixed(2)}ms)`));
                }
            });
            // Handle task failure
            indexQueue.on('task-failed', (result) => {
                const relativePath = relative(process.cwd(), result.task.path);
                console.log(chalk.red(chalk.bold('  ✗')) +
                    chalk.dim(` Failed ${relativePath}`) +
                    chalk.red(` - ${result.error?.message}`));
            });
            // Handle watcher ready
            watcher.on('ready', () => {
                console.log(chalk.green('✓ Watcher ready'));
                console.log();
            });
            // Handle errors
            watcher.on('error', (error) => {
                console.error(chalk.red('Watcher error:'), error);
            });
            // Start watching
            await watcher.start();
            // Handle graceful shutdown
            let isShuttingDown = false;
            const shutdown = async () => {
                if (isShuttingDown)
                    return;
                isShuttingDown = true;
                console.log();
                console.log(chalk.yellow('Shutting down...'));
                // Stop watcher
                await watcher.stop();
                // Wait for queue to finish
                if (!indexQueue.isIdle()) {
                    console.log(chalk.dim('Waiting for pending tasks to complete...'));
                    await indexQueue.waitForIdle();
                }
                // Show final stats
                const queueStats = indexQueue.getStats();
                const dbStats = fileService.getStats();
                console.log();
                console.log(chalk.bold('Session Summary:'));
                console.log(chalk.dim(`  Total changes detected: ${changeCount}`));
                console.log(chalk.dim(`  Files indexed: ${queueStats.completed}`));
                console.log(chalk.dim(`  Failures: ${queueStats.failed}`));
                console.log(chalk.dim(`  Total symbols: ${dbStats.totalSymbols}`));
                console.log(chalk.dim(`  Total chunks: ${dbStats.totalChunks}`));
                console.log();
                process.exit(0);
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
            // Show periodic stats
            const statsInterval = setInterval(() => {
                const timeSinceLastChange = Date.now() - lastChangeTime;
                // Only show stats if idle and there were changes
                if (changeCount > 0 && indexQueue.isIdle() && timeSinceLastChange > 30000) {
                    const stats = indexQueue.getStats();
                    console.log();
                    console.log(chalk.dim(`[Idle] ${stats.completed} files indexed, ${stats.failed} failed`));
                    console.log();
                }
            }, 30000); // Every 30 seconds
            // Cleanup interval on shutdown
            process.on('exit', () => {
                clearInterval(statsInterval);
            });
        }
        catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    return watchCommand;
}
//# sourceMappingURL=watch.js.map