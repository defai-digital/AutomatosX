/**
 * Memory CLI Commands
 */

import type { CommandModule } from 'yargs';
import { resolve } from 'path';
import { LazyMemoryManager } from '../../core/memory/lazy-manager.js';
import type { IMemoryManager } from '../../types/memory.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import { printError } from '../../shared/errors/error-formatter.js';
import { ProgressIndicator } from '../../shared/logging/progress.js';
import { printSuccess } from '../../shared/logging/message-formatter.js';

const DEFAULT_DB_PATH = '.automatosx/memory/memory.db';

/**
 * Get memory manager instance
 *
 * v4.11.0: No embedding provider needed (uses FTS5)
 * v5.6.24: Use LazyMemoryManager for consistency
 */
function getMemoryManager(dbPath?: string): IMemoryManager {
  const path = dbPath || DEFAULT_DB_PATH;

  return new LazyMemoryManager({
    dbPath: resolve(path),
    maxEntries: 100000,
    autoCleanup: false,
    trackAccess: true
  });
}

/**
 * Memory search command
 *
 * v4.11.0: FTS5 full-text search only (no vector file support)
 */
export const searchCommand: CommandModule = {
  command: 'search <query>',
  describe: 'Search memory entries using full-text search',
  builder: (yargs) => {
    return (yargs as any).positional('query', {
        describe: 'Search query text (required)',
        type: 'string',
        demandOption: true
      })
      .option('limit', {
        alias: 'l',
        describe: 'Maximum number of results',
        type: 'number',
        default: 10
      })
      .option('threshold', {
        alias: 't',
        describe: 'Minimum similarity threshold (0-1)',
        type: 'number',
        default: 0
      })
      .option('type', {
        describe: 'Filter by entry type',
        type: 'string',
        choices: ['conversation', 'code', 'document', 'task', 'other']
      })
      .option('tags', {
        describe: 'Filter by tags (comma-separated)',
        type: 'string'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      // Build search query (v4.11.0: FTS5 text search only)
      const searchQuery: any = {
        text: argv.query,
        limit: argv.limit,
        threshold: argv.threshold
      };

      // Add filters
      if (argv.type || argv.tags) {
        searchQuery.filters = {};
        if (argv.type) {
          searchQuery.filters.type = argv.type;
        }
        if (argv.tags && argv.tags.trim()) {
          searchQuery.filters.tags = argv.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }

      // Execute search
      const results = await manager.search(searchQuery);

      // Output results
      if (argv.output === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        if (results.length === 0) {
          console.log(chalk.yellow('\n⚠ No matching entries found.'));
        } else {
          console.log(chalk.bold(`\n🔍 Found ${results.length} matching entries:\n`));

          const table = new Table({
            head: [
              chalk.cyan('ID'),
              chalk.cyan('Similarity'),
              chalk.cyan('Type'),
              chalk.cyan('Content'),
              chalk.cyan('Created')
            ],
            colWidths: [6, 12, 12, 60, 20],
            wordWrap: true
          });

          for (const result of results) {
            const content = result.entry.content.length > 57
              ? `${result.entry.content.substring(0, 57)}...`
              : result.entry.content;

            const similarity = `${(result.similarity * 100).toFixed(1)}%`;
            const similarityColored = result.similarity > 0.8 ? chalk.green(similarity) :
                                     result.similarity > 0.5 ? chalk.yellow(similarity) :
                                     chalk.red(similarity);

            table.push([
              chalk.white(result.entry.id.toString()),
              similarityColored,
              chalk.magenta(result.entry.metadata.type),
              chalk.white(content),
              chalk.gray(new Date(result.entry.createdAt).toLocaleString())
            ]);
          }

          console.log(table.toString());
          console.log();
        }
      }

      await manager.close();
    } catch (error) {
      printError(error, { verbose: false, showCode: true, showSuggestions: true, colors: true });
      process.exit(1);
    }
  }
};

/**
 * Memory export command
 */
export const exportCommand: CommandModule = {
  command: 'export <output>',
  describe: 'Export memory to JSON file',
  builder: (yargs) => {
    return yargs
      .positional('output', {
        describe: 'Output file path',
        type: 'string',
        demandOption: true
      })
      .option('type', {
        describe: 'Filter by entry type',
        type: 'string',
        choices: ['conversation', 'code', 'document', 'task', 'other']
      })
      .option('from', {
        describe: 'Start date (ISO format)',
        type: 'string'
      })
      .option('to', {
        describe: 'End date (ISO format)',
        type: 'string'
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      // Build export options (v4.11.0: no embeddings in FTS5 mode)
      const exportOptions: any = {
        includeEmbeddings: false,
        pretty: true
      };

      // Add filters
      if (argv.type || argv.from || argv.to) {
        exportOptions.filters = {};

        if (argv.type) {
          exportOptions.filters.type = argv.type;
        }

        if (argv.from || argv.to) {
          exportOptions.filters.dateRange = {};
          if (argv.from) {
            exportOptions.filters.dateRange.from = new Date(argv.from);
          }
          if (argv.to) {
            exportOptions.filters.dateRange.to = new Date(argv.to);
          }
        }
      }

      // Execute export with progress
      const progress = new ProgressIndicator();
      progress.start('Exporting memory...');

      const result = await manager.exportToJSON(argv.output, exportOptions);

      progress.succeed('Export complete');

      console.log(`- Entries exported: ${result.entriesExported}`);
      console.log(`- File size: ${(result.sizeBytes / 1024).toFixed(2)} KB`);
      console.log(`- Output: ${result.filePath}`);

      await manager.close();
    } catch (error) {
      printError(error, { verbose: false, showCode: true, showSuggestions: true, colors: true });
      process.exit(1);
    }
  }
};

/**
 * Memory import command
 */
export const importCommand: CommandModule = {
  command: 'import <input>',
  describe: 'Import memory from JSON file',
  builder: (yargs) => {
    return yargs
      .positional('input', {
        describe: 'Input file path',
        type: 'string',
        demandOption: true
      })
      .option('validate', {
        describe: 'Validate entries before import',
        type: 'boolean',
        default: true
      })
      .option('batch-size', {
        describe: 'Batch size for processing',
        type: 'number',
        default: 100
      })
      .option('skip-duplicates', {
        describe: 'Skip duplicate entries',
        type: 'boolean',
        default: true
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      const progress = new ProgressIndicator();
      progress.start('Importing memory...');

      const result = await manager.importFromJSON(argv.input, {
        skipDuplicates: argv.skipDuplicates,
        batchSize: argv.batchSize,
        validate: argv.validate
      });

      progress.succeed('Import complete');

      console.log(`- Entries imported: ${result.entriesImported}`);
      console.log(`- Entries skipped: ${result.entriesSkipped}`);
      console.log(`- Entries failed: ${result.entriesFailed}`);

      if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        result.errors.slice(0, 5).forEach(e => {
          console.log(`  - ${e.error}`);
        });
      }

      await manager.close();
    } catch (error) {
      printError(error, { verbose: false, showCode: true, showSuggestions: true, colors: true });
      process.exit(1);
    }
  }
};

/**
 * Memory add command
 */
export const addCommand: CommandModule = {
  command: 'add <content>',
  describe: 'Add a new memory entry',
  builder: (yargs) => {
    return yargs
      .positional('content', {
        describe: 'Content to store',
        type: 'string',
        demandOption: true
      })
      .option('type', {
        alias: 't',
        describe: 'Entry type',
        type: 'string',
        choices: ['conversation', 'code', 'document', 'task', 'other'],
        default: 'other'
      })
      .option('tags', {
        describe: 'Tags (comma-separated)',
        type: 'string'
      })
      .option('metadata', {
        alias: 'm',
        describe: 'Custom metadata as JSON string',
        type: 'string'
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      // Build metadata
      const metadata: any = {
        type: argv.type,
        source: 'cli',
        timestamp: new Date().toISOString()
      };

      if (argv.tags && argv.tags.trim()) {
        metadata.tags = argv.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }

      // Parse custom metadata if provided
      if (argv.metadata) {
        try {
          const customMetadata = JSON.parse(argv.metadata);
          // Merge custom metadata, preserving required fields
          Object.assign(metadata, customMetadata);
        } catch (error) {
          throw new Error(`Invalid metadata JSON: ${(error as Error).message}`);
        }
      }

      // For CLI, we don't have an embedding provider by default
      // Use a zero vector as placeholder (will be updated later if needed)
      const embedding = Array<number>(1536).fill(0);

      const entry = await manager.add(argv.content, embedding, metadata);

      printSuccess('\nMemory entry added successfully\n');
      console.log(`${chalk.bold('ID:')} ${chalk.white(entry.id)}`);
      console.log(`${chalk.bold('Type:')} ${chalk.magenta(entry.metadata.type)}`);
      const content = entry.content.length > 100 ? `${entry.content.substring(0, 100)}...` : entry.content;
      console.log(`${chalk.bold('Content:')} ${chalk.white(content)}`);
      if (entry.metadata.tags && entry.metadata.tags.length > 0) {
        console.log(`${chalk.bold('Tags:')} ${chalk.yellow(entry.metadata.tags.join(', '))}`);
      }
      console.log();

      await manager.close();
    } catch (error) {
      printError(error, { verbose: false, showCode: true, showSuggestions: true, colors: true });
      process.exit(1);
    }
  }
};

/**
 * Memory delete command
 */
export const deleteCommand: CommandModule = {
  command: 'delete <id>',
  describe: 'Delete a memory entry by ID',
  builder: (yargs) => {
    return yargs
      .positional('id', {
        describe: 'Entry ID to delete',
        type: 'number',
        demandOption: true
      })
      .option('confirm', {
        alias: 'y',
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        default: false
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      // Get entry to show details
      const entry = await manager.get(argv.id);
      if (!entry) {
        console.error(chalk.red(`\n✗ Entry not found: ${argv.id}\n`));
        process.exit(1);
      }

      // Show entry details
      console.log(chalk.bold('\n🗑️  Entry to delete:\n'));
      console.log(`${chalk.bold('ID:')} ${chalk.white(entry.id)}`);
      console.log(`${chalk.bold('Type:')} ${chalk.magenta(entry.metadata.type)}`);
      const content = entry.content.length > 100 ? `${entry.content.substring(0, 100)}...` : entry.content;
      console.log(`${chalk.bold('Content:')} ${chalk.white(content)}`);

      // Confirm deletion (unless --confirm flag is used)
      if (!argv.confirm) {
        const { createInterface } = await import('readline');
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow('\nAre you sure you want to delete this entry? (y/N): '), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('\nDeletion cancelled.\n'));
          await manager.close();
          return;
        }
      }

      await manager.delete(argv.id);
      printSuccess('\nMemory entry deleted successfully\n');

      await manager.close();
    } catch (error) {
      printError(error, { verbose: false, showCode: true, showSuggestions: true, colors: true });
      process.exit(1);
    }
  }
};

/**
 * Memory list command
 */
export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List all memory entries',
  builder: (yargs) => {
    return (yargs as any).option('type', {
        describe: 'Filter by entry type',
        type: 'string',
        choices: ['conversation', 'code', 'document', 'task', 'other']
      })
      .option('tags', {
        describe: 'Filter by tags (comma-separated)',
        type: 'string'
      })
      .option('limit', {
        alias: 'l',
        describe: 'Maximum number of entries',
        type: 'number',
        default: 50
      })
      .option('offset', {
        describe: 'Number of entries to skip',
        type: 'number',
        default: 0
      })
      .option('order-by', {
        describe: 'Sort by field',
        type: 'string',
        choices: ['created', 'accessed', 'count'],
        default: 'created'
      })
      .option('order', {
        describe: 'Sort direction',
        type: 'string',
        choices: ['asc', 'desc'],
        default: 'desc'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      const options: any = {
        limit: argv.limit,
        offset: argv.offset,
        orderBy: argv.orderBy,
        order: argv.order
      };

      if (argv.type) {
        options.type = argv.type;
      }

      if (argv.tags && argv.tags.trim()) {
        options.tags = argv.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }

      const entries = await manager.getAll(options);

      if (argv.output === 'json') {
        console.log(JSON.stringify(entries, null, 2));
      } else {
        if (entries.length === 0) {
          console.log(chalk.yellow('\n⚠ No entries found.'));
        } else {
          console.log(chalk.bold(`\n📚 Found ${entries.length} entries:\n`));

          const table = new Table({
            head: [
              chalk.cyan('ID'),
              chalk.cyan('Type'),
              chalk.cyan('Content'),
              chalk.cyan('Tags'),
              chalk.cyan('Created'),
              chalk.cyan('Accessed')
            ],
            colWidths: [6, 12, 50, 20, 20, 10],
            wordWrap: true
          });

          for (const entry of entries) {
            const content = entry.content.length > 47
              ? `${entry.content.substring(0, 47)}...`
              : entry.content;

            const tags = entry.metadata.tags && entry.metadata.tags.length > 0
              ? entry.metadata.tags.join(', ')
              : chalk.gray('-');

            const created = new Date(entry.createdAt).toLocaleString();
            const accessCount = `${entry.accessCount || 0}x`;

            table.push([
              chalk.white(entry.id.toString()),
              chalk.magenta(entry.metadata.type),
              chalk.white(content),
              chalk.yellow(tags),
              chalk.gray(created),
              chalk.blue(accessCount)
            ]);
          }

          console.log(table.toString());

          // Show pagination info
          if (entries.length === argv.limit) {
            console.log(chalk.gray(`\n💡 Showing ${argv.limit} entries. Use --offset to see more.\n`));
          }
        }
      }

      await manager.close();
    } catch (error) {
      printError(error, { verbose: false, showCode: true, showSuggestions: true, colors: true });
      process.exit(1);
    }
  }
};

/**
 * Memory stats command
 */
export const statsCommand: CommandModule = {
  command: 'stats',
  describe: 'Show memory statistics',
  builder: (yargs) => {
    return (yargs as any).option('output', {
        alias: 'o',
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);
      const stats = await manager.getStats();

      if (argv.output === 'json') {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('\nMemory Statistics:');
        console.log(`- Total entries: ${stats.totalEntries}`);
        console.log(`- Database size: ${(stats.dbSize / 1024).toFixed(2)} KB`);
        console.log(`- Index size: ${(stats.indexSize / 1024).toFixed(2)} KB`);
        console.log(`- Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      }

      await manager.close();
    } catch (error) {
      console.error('Stats failed:', (error as Error).message);
      process.exit(1);
    }
  }
};

/**
 * Memory clear command
 */
export const clearCommand: CommandModule = {
  command: 'clear',
  describe: 'Clear memory entries',
  builder: (yargs) => {
    return yargs
      .option('all', {
        describe: 'Clear all entries',
        type: 'boolean',
        default: false
      })
      .option('type', {
        describe: 'Clear specific entry type',
        type: 'string',
        choices: ['conversation', 'code', 'document', 'task', 'other']
      })
      .option('older-than', {
        describe: 'Clear entries older than N days',
        type: 'number'
      })
      .option('confirm', {
        alias: 'y',
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        default: false
      })
      .option('db', {
        describe: 'Database path',
        type: 'string'
      })
      .check((argv) => {
        if (!argv.all && !argv.type && !argv.olderThan) {
          throw new Error('Must specify --all, --type, or --older-than');
        }
        return true;
      });
  },
  handler: async (argv: any) => {
    try {
      const manager = await getMemoryManager(argv.db);

      // Get stats before clearing
      const statsBefore = await manager.getStats();

      // Confirm deletion
      if (!argv.confirm) {
        console.log(`\nThis will delete entries from the memory database.`);
        console.log(`Current total: ${statsBefore.totalEntries} entries`);

        if (argv.all) {
          console.log('Action: Delete ALL entries');
        } else if (argv.type) {
          console.log(`Action: Delete entries of type "${argv.type}"`);
        } else if (argv.olderThan) {
          console.log(`Action: Delete entries older than ${argv.olderThan} days`);
        }

        console.log('\nPress Ctrl+C to cancel, or use --confirm to skip this prompt');
        process.exit(0);
      }

      // Execute clear operation
      if (argv.all) {
        await manager.clear();
        console.log('\n✓ All entries cleared');
      } else if (argv.olderThan) {
        const deleted = await manager.cleanup(argv.olderThan);
        console.log(`\n✓ Deleted ${deleted} entries older than ${argv.olderThan} days`);
      } else {
        // Type-specific deletion (not implemented in current MemoryManager)
        console.error('Type-specific deletion not yet implemented');
        process.exit(1);
      }

      const statsAfter = await manager.getStats();
      console.log(`Remaining entries: ${statsAfter.totalEntries}`);

      await manager.close();
    } catch (error) {
      console.error('Clear failed:', (error as Error).message);
      process.exit(1);
    }
  }
};

/**
 * Main memory command
 */
export const memoryCommand: CommandModule = {
  command: 'memory <command>',
  describe: 'Memory management commands',
  builder: (yargs) => {
    return yargs
      .command(searchCommand)
      .command(listCommand)
      .command(addCommand)
      .command(deleteCommand)
      .command(exportCommand)
      .command(importCommand)
      .command(statsCommand)
      .command(clearCommand)
      .demandCommand(1, 'You must provide a memory command');
  },
  handler: () => {
    // Will be handled by sub-commands
  }
};
