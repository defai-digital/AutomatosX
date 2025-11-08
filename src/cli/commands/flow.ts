/**
 * flow.ts
 *
 * CLI command: ax flow <function>
 * Visualize function call flow (definition + references)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SymbolDAO } from '../../database/dao/SymbolDAO.js';
import { ChunkDAO } from '../../database/dao/ChunkDAO.js';
import { runMigrations } from '../../database/migrations.js';

/**
 * Format file path
 */
function formatFilePath(path: string): string {
  return path.startsWith('/') ? path.substring(1) : path;
}

/**
 * Display call flow visualization
 */
function displayFlow(
  functionName: string,
  definition: { file_path: string; line: number; kind: string } | null,
  references: Array<{ file_path: string; start_line: number; chunk_type: string; content: string }>
): void {
  console.log();
  console.log(chalk.bold(chalk.cyan(`Call Flow: ${functionName}`)));
  console.log(chalk.dim('═'.repeat(80)));
  console.log();

  // Show definition
  if (definition) {
    console.log(chalk.yellow('●') + chalk.bold(' Definition:'));
    console.log(
      chalk.dim('  ') +
      chalk.cyan(formatFilePath(definition.file_path)) +
      chalk.dim(':') +
      chalk.yellow(definition.line.toString()) +
      chalk.dim(` (${definition.kind})`)
    );
    console.log();
  } else {
    console.log(chalk.red('●') + chalk.dim(' Definition: Not found'));
    console.log();
  }

  // Show references
  if (references.length > 0) {
    console.log(chalk.green('●') + chalk.bold(` References (${references.length}):`));
    console.log();

    for (let i = 0; i < references.length; i++) {
      const ref = references[i];

      // Show reference location
      console.log(
        chalk.dim(`  ${i + 1}. `) +
        chalk.cyan(formatFilePath(ref.file_path)) +
        chalk.dim(':') +
        chalk.yellow(ref.start_line.toString()) +
        chalk.dim(` (${ref.chunk_type})`)
      );

      // Show snippet of the reference
      const snippet = ref.content.split('\n').find((line) =>
        line.toLowerCase().includes(functionName.toLowerCase())
      ) || ref.content.split('\n')[0];

      console.log(chalk.dim('     ') + chalk.dim(snippet.trim().substring(0, 70)));
      console.log();
    }
  } else {
    console.log(chalk.dim('●') + chalk.dim(' References: None found'));
    console.log();
  }

  console.log(chalk.dim('═'.repeat(80)));
  console.log();

  // Summary
  const totalReferences = references.length;
  const uniqueFiles = new Set(references.map((r) => r.file_path)).size;

  console.log(chalk.dim('Summary:'));
  console.log(chalk.dim(`  Total references: ${totalReferences}`));
  console.log(chalk.dim(`  Files with references: ${uniqueFiles}`));
  console.log();
}

/**
 * Create flow command
 */
export function createFlowCommand(): Command {
  const flowCommand = new Command('flow');

  flowCommand
    .description('Show function call flow (definition + references)')
    .argument('<function>', 'Function or method name')
    .option('-l, --limit <number>', 'Maximum number of references to show (default: 20)', '20')
    .option('--no-color', 'Disable colored output')
    .action(async (functionName: string, options) => {
      try {
        // Ensure migrations are run
        runMigrations();

        // Create DAOs
        const symbolDAO = new SymbolDAO();
        const chunkDAO = new ChunkDAO();

        console.log();
        console.log(chalk.bold(`Analyzing flow for: "${chalk.cyan(functionName)}"`));

        // 1. Find definition
        const symbols = symbolDAO.findWithFile(functionName);
        const definition = symbols.find((s) =>
          s.kind === 'function' || s.kind === 'method'
        ) || symbols[0] || null;

        // 2. Find references using FTS5
        const limit = parseInt(options.limit, 10);
        const searchResults = chunkDAO.search(functionName, limit);

        // Filter out the definition itself
        const references = searchResults.filter((result) => {
          if (!definition) return true;
          return !(
            result.file_path === definition.file_path &&
            result.start_line === definition.line
          );
        });

        // 3. Display flow
        displayFlow(functionName, definition, references);

      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return flowCommand;
}
