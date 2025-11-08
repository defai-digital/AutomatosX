/**
 * def.ts
 *
 * CLI command: ax def <symbol>
 * Show symbol definition with full context
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { FileService } from '../../services/FileService.js';
import { SymbolDAO } from '../../database/dao/SymbolDAO.js';
import { FileDAO } from '../../database/dao/FileDAO.js';
import { runMigrations } from '../../database/migrations.js';

/**
 * Color mapping for symbol kinds
 */
const SYMBOL_COLORS: Record<string, (text: string) => string> = {
  function: chalk.blue,
  class: chalk.yellow,
  interface: chalk.cyan,
  type: chalk.magenta,
  variable: chalk.green,
  constant: chalk.green.bold,
  method: chalk.blue.dim,
};

/**
 * Get color for symbol kind
 */
function getSymbolColor(kind: string): (text: string) => string {
  return SYMBOL_COLORS[kind] || chalk.white;
}

/**
 * Format file path
 */
function formatFilePath(path: string): string {
  return path.startsWith('/') ? path.substring(1) : path;
}

/**
 * Display symbol definition with context
 */
function displayDefinition(
  symbolName: string,
  kind: string,
  filePath: string,
  line: number,
  column: number,
  endLine: number | null,
  content: string,
  contextLines: number
): void {
  const colorFn = getSymbolColor(kind);
  const lines = content.split('\n');

  // Calculate context range
  const startLine = Math.max(1, line - contextLines);
  const stopLine = Math.min(lines.length, (endLine || line) + contextLines);

  // Header
  console.log();
  console.log(
    colorFn(chalk.bold(`${kind} `)) +
    colorFn(chalk.bold(symbolName)) +
    chalk.dim(' at ') +
    chalk.cyan(formatFilePath(filePath)) +
    chalk.dim(':') +
    chalk.yellow(line.toString())
  );
  console.log(chalk.dim('─'.repeat(80)));

  // Show code with line numbers
  for (let i = startLine - 1; i < stopLine; i++) {
    const lineNum = i + 1;
    const lineContent = lines[i] || '';

    // Highlight the definition line(s)
    const isDefinitionLine = lineNum >= line && lineNum <= (endLine || line);

    if (isDefinitionLine) {
      console.log(
        chalk.yellow(`${lineNum.toString().padStart(4)} │ `) +
        chalk.bold(lineContent)
      );
    } else {
      console.log(
        chalk.dim(`${lineNum.toString().padStart(4)} │ `) +
        chalk.dim(lineContent)
      );
    }
  }

  console.log(chalk.dim('─'.repeat(80)));
  console.log();
}

/**
 * Create def command
 */
export function createDefCommand(): Command {
  const defCommand = new Command('def');

  defCommand
    .description('Show symbol definition with context')
    .argument('<symbol>', 'Symbol name to look up')
    .option('-c, --context <lines>', 'Number of context lines (default: 5)', '5')
    .option('-a, --all', 'Show all definitions if multiple found')
    .option('--no-color', 'Disable colored output')
    .action(async (symbolName: string, options) => {
      try {
        // Ensure migrations are run
        runMigrations();

        // Create DAOs
        const symbolDAO = new SymbolDAO();
        const fileDAO = new FileDAO();

        console.log();
        console.log(chalk.bold(`Looking up: "${chalk.cyan(symbolName)}"`));

        // Find symbol(s)
        const symbols = symbolDAO.findWithFile(symbolName);

        if (symbols.length === 0) {
          console.log();
          console.log(chalk.yellow(`Symbol "${symbolName}" not found.`));
          console.log();
          console.log(chalk.dim('Try:'));
          console.log(chalk.dim('  • Checking your spelling'));
          console.log(chalk.dim('  • Using ax find to search for similar names'));
          console.log(chalk.dim('  • Indexing more files'));
          console.log();
          process.exit(0);
        }

        // Show count if multiple
        if (symbols.length > 1) {
          console.log(chalk.dim(`Found ${symbols.length} definition(s)`));
        }

        const contextLines = parseInt(options.context, 10);
        const showAll = options.all || symbols.length === 1;
        const symbolsToShow = showAll ? symbols : symbols.slice(0, 1);

        // Display each definition
        for (const symbol of symbolsToShow) {
          // Get file content
          const file = fileDAO.findByPath(symbol.file_path);
          if (!file) {
            console.log(chalk.red(`Error: File not found: ${symbol.file_path}`));
            continue;
          }

          displayDefinition(
            symbol.name,
            symbol.kind,
            symbol.file_path,
            symbol.line,
            symbol.column,
            symbol.end_line,
            file.content,
            contextLines
          );
        }

        // Show hint if not showing all
        if (!showAll && symbols.length > 1) {
          console.log(chalk.dim(`Showing 1 of ${symbols.length} definitions. Use --all to see all.`));
          console.log();
        }

      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return defCommand;
}
