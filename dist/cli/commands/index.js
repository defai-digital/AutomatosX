/**
 * index.ts
 *
 * CLI command: ax index <directory>
 * Index all code files in a directory
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { FileService } from '../../services/FileService.js';
import { IndexQueue } from '../../services/IndexQueue.js';
import { runMigrations } from '../../database/migrations.js';
import { readdir } from 'fs/promises';
import { join, relative, extname } from 'path';
import { stat } from 'fs/promises';
/**
 * Default configuration
 */
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const DEFAULT_IGNORED = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
];
/**
 * Recursively find all files in directory
 */
async function findFiles(dir, extensions, ignored) {
    const files = [];
    async function walk(currentDir) {
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(currentDir, entry.name);
            // Skip ignored directories/files
            if (ignored.some((pattern) => entry.name.includes(pattern))) {
                continue;
            }
            if (entry.isDirectory()) {
                await walk(fullPath);
            }
            else if (entry.isFile()) {
                const ext = extname(entry.name);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    await walk(dir);
    return files;
}
/**
 * Create index command
 */
export function createIndexCommand() {
    const indexCommand = new Command('index');
    indexCommand
        .description('Index all code files in a directory')
        .argument('[directory]', 'Directory to index (default: current directory)', '.')
        .option('-e, --extensions <exts>', 'File extensions to index (comma-separated)', DEFAULT_EXTENSIONS.join(','))
        .option('-i, --ignore <patterns>', 'Patterns to ignore (comma-separated)', DEFAULT_IGNORED.join(','))
        .option('-c, --concurrency <number>', 'Number of parallel indexing tasks (default: 3)', '3')
        .option('--clear', 'Clear existing index before indexing')
        .option('--no-color', 'Disable colored output')
        .action(async (directory, options) => {
        try {
            // Ensure migrations are run
            runMigrations();
            const spinner = ora();
            // Parse options
            const extensions = options.extensions.split(',').map((e) => e.trim().startsWith('.') ? e.trim() : `.${e.trim()}`);
            const ignored = options.ignore.split(',').map((p) => p.trim());
            const concurrency = parseInt(options.concurrency, 10);
            // Resolve directory
            const targetDir = join(process.cwd(), directory);
            // Check if directory exists
            try {
                const stats = await stat(targetDir);
                if (!stats.isDirectory()) {
                    console.error(chalk.red(`Error: ${directory} is not a directory`));
                    process.exit(1);
                }
            }
            catch (error) {
                console.error(chalk.red(`Error: Directory ${directory} not found`));
                process.exit(1);
            }
            console.log();
            console.log(chalk.bold(`Indexing directory: ${chalk.cyan(targetDir)}`));
            console.log(chalk.dim(`Extensions: ${extensions.join(', ')}`));
            console.log(chalk.dim(`Concurrency: ${concurrency}`));
            console.log();
            // Clear existing index if requested
            if (options.clear) {
                spinner.start('Clearing existing index...');
                const fileService = new FileService();
                const stats = fileService.getStats();
                fileService['fileDAO'].clear();
                fileService['symbolDAO'].clear();
                fileService['chunkDAO'].clear();
                spinner.succeed(`Cleared existing index (${stats.totalFiles} files, ${stats.totalSymbols} symbols, ${stats.totalChunks} chunks)`);
            }
            // Find all files
            spinner.start('Scanning directory...');
            const files = await findFiles(targetDir, extensions, ignored);
            spinner.succeed(`Found ${chalk.cyan(files.length.toString())} file(s)`);
            if (files.length === 0) {
                console.log();
                console.log(chalk.yellow('No files to index.'));
                console.log();
                process.exit(0);
            }
            // Create indexing queue
            const fileService = new FileService();
            const indexQueue = new IndexQueue(fileService, concurrency);
            // Track progress
            let processedCount = 0;
            let failedCount = 0;
            spinner.start(`Indexing files... (0/${files.length})`);
            indexQueue.on('task-completed', (result) => {
                processedCount++;
                spinner.text = `Indexing files... (${processedCount}/${files.length})`;
                if (result.result) {
                    const relativePath = relative(process.cwd(), result.task.path);
                    spinner.text = `Indexing files... (${processedCount}/${files.length}) - ${chalk.dim(relativePath)}`;
                }
            });
            indexQueue.on('task-failed', (result) => {
                failedCount++;
                processedCount++;
                spinner.text = `Indexing files... (${processedCount}/${files.length}) - ${chalk.red('Failed:')} ${result.task.path}`;
            });
            // Enqueue all files
            for (const file of files) {
                indexQueue.enqueue(file, 'add', 0);
            }
            // Wait for completion
            await indexQueue.waitForIdle();
            const stats = indexQueue.getStats();
            if (failedCount === 0) {
                spinner.succeed(`Indexed ${chalk.green(stats.completed.toString())} file(s) successfully`);
            }
            else {
                spinner.warn(`Indexed ${chalk.green(stats.completed.toString())} file(s), ${chalk.red(failedCount.toString())} failed`);
            }
            // Show statistics
            console.log();
            console.log(chalk.bold('Statistics:'));
            const dbStats = fileService.getStats();
            console.log(chalk.dim(`  Total files: ${dbStats.totalFiles}`));
            console.log(chalk.dim(`  Total symbols: ${dbStats.totalSymbols}`));
            console.log(chalk.dim(`  Total chunks: ${dbStats.totalChunks}`));
            console.log(chalk.dim(`  Average time per file: ${stats.averageTime.toFixed(2)}ms`));
            console.log(chalk.dim(`  Total time: ${stats.totalTime.toFixed(2)}ms`));
            console.log();
            if (dbStats.symbolsByKind && Object.keys(dbStats.symbolsByKind).length > 0) {
                console.log(chalk.bold('Symbols by kind:'));
                for (const [kind, count] of Object.entries(dbStats.symbolsByKind)) {
                    console.log(chalk.dim(`  ${kind}: ${count}`));
                }
                console.log();
            }
        }
        catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    return indexCommand;
}
//# sourceMappingURL=index.js.map