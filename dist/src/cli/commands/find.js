/**
 * find.ts
 *
 * CLI command: ax find <query>
 * Search with automatic intent detection using QueryRouter
 */
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { FileService, SearchResultType } from '../../services/FileService.js';
import { QueryIntent } from '../../services/QueryRouter.js';
import { runMigrations } from '../../database/migrations.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
/**
 * Color mapping for symbol kinds
 */
const SYMBOL_COLORS = {
    function: chalk.blue,
    class: chalk.yellow,
    interface: chalk.cyan,
    type: chalk.magenta,
    variable: chalk.green,
    constant: chalk.green.bold,
    method: chalk.blue.dim,
};
/**
 * Color mapping for chunk types
 */
const CHUNK_COLORS = {
    function: chalk.blue,
    class: chalk.yellow,
    method: chalk.blue.dim,
    interface: chalk.cyan,
    type: chalk.magenta,
    declaration: chalk.green,
};
/**
 * Get color for symbol/chunk type
 */
function getColor(type) {
    return SYMBOL_COLORS[type] || CHUNK_COLORS[type] || chalk.white;
}
/**
 * Format file path (relative to current directory if possible)
 */
function formatFilePath(path) {
    return path.startsWith('/') ? path.substring(1) : path;
}
/**
 * Display unified search results
 */
function displayResults(results, intent, query) {
    if (results.length === 0) {
        const error = ErrorHandler.noResultsFound(query || 'query');
        console.log();
        console.log(chalk.yellow(chalk.bold('No results found')));
        console.log();
        console.log(chalk.yellow(chalk.bold('💡 Suggestions:')));
        error.suggestions.forEach((suggestion, index) => {
            if (suggestion.startsWith('  ')) {
                console.log(chalk.dim(suggestion));
            }
            else {
                console.log(chalk.yellow(`  ${index + 1}.`) + ' ' + chalk.dim(suggestion));
            }
        });
        console.log();
        return;
    }
    console.log(chalk.green(`Found ${results.length} result${results.length === 1 ? '' : 's'}:`));
    console.log();
    // Display based on result type
    const hasSymbols = results.some((r) => r.type === SearchResultType.SYMBOL);
    const hasChunks = results.some((r) => r.type === SearchResultType.CHUNK);
    if (intent === QueryIntent.SYMBOL || (hasSymbols && !hasChunks)) {
        displaySymbolResults(results);
    }
    else if (intent === QueryIntent.NATURAL || (hasChunks && !hasSymbols)) {
        displayChunkResults(results);
    }
    else {
        // Hybrid: show both
        displayHybridResults(results);
    }
}
/**
 * Display symbol results in table format
 */
function displaySymbolResults(results) {
    const table = new Table({
        head: [
            chalk.bold('Name'),
            chalk.bold('Kind'),
            chalk.bold('File'),
            chalk.bold('Line'),
            chalk.bold('Score'),
        ],
        style: {
            head: [],
            border: [],
        },
    });
    for (const result of results) {
        if (result.type === SearchResultType.SYMBOL) {
            const colorFn = getColor(result.kind || '');
            table.push([
                colorFn(result.name || ''),
                colorFn(result.kind || ''),
                chalk.dim(formatFilePath(result.file_path)),
                chalk.white(result.line.toString()),
                chalk.yellow((result.score * 100).toFixed(0) + '%'),
            ]);
        }
    }
    console.log(table.toString());
    console.log();
}
/**
 * Display chunk results with snippets
 */
function displayChunkResults(results) {
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.type === SearchResultType.CHUNK) {
            // Header: rank. file:line-line (type) [score%]
            console.log(chalk.bold(`${i + 1}. `) +
                chalk.cyan(formatFilePath(result.file_path)) +
                chalk.dim(':') +
                chalk.yellow(result.start_line?.toString() || result.line.toString()) +
                chalk.dim('-') +
                chalk.yellow(result.end_line?.toString() || result.line.toString()) +
                chalk.dim(` (${result.chunk_type})`) +
                chalk.dim(` [score: ${(result.score * 100).toFixed(0)}%]`));
            // Snippet
            if (result.content) {
                const snippetLines = result.content.split('\n').slice(0, 3);
                const snippet = snippetLines.join('\n');
                console.log(chalk.dim('  ' + snippet.replace(/\n/g, '\n  ')));
                if (result.content.split('\n').length > 3) {
                    console.log(chalk.dim('  ...'));
                }
            }
            console.log();
        }
    }
}
/**
 * Display hybrid results (mix of symbols and chunks)
 */
function displayHybridResults(results) {
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.type === SearchResultType.SYMBOL) {
            const colorFn = getColor(result.kind || '');
            console.log(chalk.bold(`${i + 1}. `) +
                chalk.blue('[SYMBOL] ') +
                colorFn(result.name || '') +
                chalk.dim(` (${result.kind})`) +
                chalk.dim(' at ') +
                chalk.cyan(formatFilePath(result.file_path)) +
                chalk.dim(':') +
                chalk.yellow(result.line.toString()) +
                chalk.dim(` [score: ${(result.score * 100).toFixed(0)}%]`));
        }
        else if (result.type === SearchResultType.CHUNK) {
            console.log(chalk.bold(`${i + 1}. `) +
                chalk.magenta('[CHUNK] ') +
                chalk.dim(`${result.chunk_type} at `) +
                chalk.cyan(formatFilePath(result.file_path)) +
                chalk.dim(':') +
                chalk.yellow(result.start_line?.toString() || result.line.toString()) +
                chalk.dim('-') +
                chalk.yellow(result.end_line?.toString() || result.line.toString()) +
                chalk.dim(` [score: ${(result.score * 100).toFixed(0)}%]`));
            // Show short snippet for chunks
            if (result.content) {
                const firstLine = result.content.split('\n')[0];
                console.log(chalk.dim('  ' + firstLine.substring(0, 80) + '...'));
            }
        }
        console.log();
    }
}
/**
 * Create find command with QueryRouter
 */
export function createFindCommand() {
    const findCommand = new Command('find');
    findCommand
        .description('Search for code using automatic intent detection')
        .argument('<query>', 'Symbol name or natural language query')
        .option('-s, --symbol', 'Force symbol search mode (exact name match)')
        .option('-n, --natural', 'Force natural language search mode (FTS5 + BM25)')
        .option('-l, --limit <number>', 'Maximum number of results (default: 10)', '10')
        .option('-v, --verbose', 'Show query analysis details')
        .option('--no-color', 'Disable colored output')
        .action(async (query, options) => {
        try {
            // Validate query
            ErrorHandler.validateQuery(query);
            // Ensure migrations are run
            runMigrations();
            // Create file service
            const fileService = new FileService();
            // Check if files are indexed
            const stats = fileService.getStats();
            if (stats.totalFiles === 0) {
                const error = ErrorHandler.noIndexData();
                ErrorHandler.display(error, options.verbose || false);
                process.exit(1);
            }
            console.log();
            console.log(chalk.bold(`Searching for: "${chalk.cyan(query)}"`));
            // Determine intent
            let forceIntent;
            if (options.symbol) {
                forceIntent = QueryIntent.SYMBOL;
            }
            else if (options.natural) {
                forceIntent = QueryIntent.NATURAL;
            }
            // Execute search
            const limit = parseInt(options.limit, 10);
            const response = fileService.search(query, limit, forceIntent);
            // Show analysis if verbose
            if (options.verbose) {
                console.log(chalk.dim('\nQuery Analysis:'));
                console.log(chalk.dim(`  Intent: ${response.intent.toUpperCase()} (confidence: ${(response.analysis.confidence * 100).toFixed(0)}%)`));
                console.log(chalk.dim(`  Features:`));
                console.log(chalk.dim(`    - Single word: ${response.analysis.features.isSingleWord}`));
                console.log(chalk.dim(`    - Identifier: ${response.analysis.features.isIdentifier}`));
                console.log(chalk.dim(`    - Has operators: ${response.analysis.features.hasOperators}`));
                console.log(chalk.dim(`    - Word count: ${response.analysis.features.wordCount}`));
            }
            // Show mode
            const modeText = {
                [QueryIntent.SYMBOL]: 'Symbol search (exact match)',
                [QueryIntent.NATURAL]: 'Natural language search (FTS5 + BM25)',
                [QueryIntent.HYBRID]: 'Hybrid search (symbols + natural language)',
            };
            console.log(chalk.dim(`Mode: ${modeText[response.intent]}`));
            console.log(chalk.dim(`Search time: ${response.searchTime.toFixed(2)}ms`));
            console.log();
            // Display results
            displayResults(response.results, response.intent, query);
            // Show summary if multiple result types
            const symbolCount = response.results.filter((r) => r.type === SearchResultType.SYMBOL).length;
            const chunkCount = response.results.filter((r) => r.type === SearchResultType.CHUNK).length;
            if (symbolCount > 0 && chunkCount > 0) {
                console.log(chalk.dim(`Results: ${symbolCount} symbol(s), ${chunkCount} chunk(s)`));
                console.log();
            }
        }
        catch (error) {
            ErrorHandler.handleAndExit(error, options.verbose || false);
        }
    });
    return findCommand;
}
//# sourceMappingURL=find.js.map