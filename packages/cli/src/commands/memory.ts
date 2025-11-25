/**
 * Memory Commands
 *
 * Commands for managing the memory system.
 *
 * Usage:
 *   ax memory search <query>  - Search memories
 *   ax memory list            - List recent memories
 *   ax memory stats           - Show memory statistics
 *   ax memory export          - Export memories to JSON
 *   ax memory import <file>   - Import memories from JSON
 *   ax memory clear           - Clear memories
 *
 * @module @ax/cli/commands/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { readFile, writeFile } from 'node:fs/promises';
import { getContext } from '../utils/context.js';
import * as output from '../utils/output.js';
import * as spinner from '../utils/spinner.js';

// =============================================================================
// Types
// =============================================================================

interface MemorySearchArgs {
  query: string;
  limit?: number;
  agent?: string;
  json?: boolean;
}

interface MemoryListArgs {
  limit?: number;
  agent?: string;
  json?: boolean;
}

interface MemoryExportArgs {
  output?: string;
  agent?: string;
}

interface MemoryImportArgs {
  file: string;
  merge?: boolean;
}

interface MemoryClearArgs {
  agent?: string;
  before?: string;
  force?: boolean;
}

// =============================================================================
// Memory Search Command
// =============================================================================

const searchCommand: CommandModule<object, MemorySearchArgs> = {
  command: 'search <query>',
  describe: 'Search memories by keyword',

  builder: (yargs) =>
    yargs
      .positional('query', {
        describe: 'Search query',
        type: 'string',
        demandOption: true,
      })
      .option('limit', {
        alias: 'l',
        describe: 'Maximum results',
        type: 'number',
        default: 10,
      })
      .option('agent', {
        alias: 'a',
        describe: 'Filter by agent ID',
        type: 'string',
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<MemorySearchArgs>) => {
    try {
      const { query, limit, agent, json } = argv;

      if (!json) {
        spinner.start(`Searching for "${query}"...`);
      }

      const ctx = await getContext();
      const results = await ctx.memoryManager.search(query, {
        limit,
        agentId: agent,
      });

      if (json) {
        output.json(results);
      } else {
        spinner.succeed(`Found ${results.length} results`);

        if (results.length === 0) {
          output.newline();
          output.info('No memories found matching your query');
          return;
        }

        output.newline();
        for (const result of results) {
          output.divider();
          output.keyValue('ID', result.id);
          output.keyValue('Agent', result.agentId);
          output.keyValue('Session', result.sessionId);
          output.keyValue('Score', result.score?.toFixed(3) ?? '-');
          output.keyValue('Created', output.formatRelativeTime(new Date(result.createdAt)));
          output.newline();
          console.log(result.content.slice(0, 300) + (result.content.length > 300 ? '...' : ''));
        }
        output.divider();
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Search failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Memory List Command
// =============================================================================

const listCommand: CommandModule<object, MemoryListArgs> = {
  command: 'list',
  describe: 'List recent memories',

  builder: (yargs) =>
    yargs
      .option('limit', {
        alias: 'l',
        describe: 'Maximum results',
        type: 'number',
        default: 20,
      })
      .option('agent', {
        alias: 'a',
        describe: 'Filter by agent ID',
        type: 'string',
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<MemoryListArgs>) => {
    try {
      const { limit, agent, json } = argv;

      if (!json) {
        spinner.start('Loading memories...');
      }

      const ctx = await getContext();
      const memories = await ctx.memoryManager.list({
        limit,
        agentId: agent,
      });

      if (json) {
        output.json(memories);
      } else {
        spinner.succeed(`Loaded ${memories.length} memories`);
        output.newline();

        const rows = memories.map((m) => [
          m.id.slice(0, 8),
          m.agentId,
          m.type,
          m.content.slice(0, 40) + (m.content.length > 40 ? '...' : ''),
          output.formatRelativeTime(new Date(m.createdAt)),
        ]);

        output.simpleTable(['ID', 'Agent', 'Type', 'Content', 'Created'], rows);
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to list memories', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Memory Stats Command
// =============================================================================

const statsCommand: CommandModule = {
  command: 'stats',
  describe: 'Show memory statistics',

  builder: (yargs) =>
    yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false,
    }),

  handler: async (argv) => {
    try {
      const json = argv.json as boolean;

      if (!json) {
        spinner.start('Calculating statistics...');
      }

      const ctx = await getContext();
      const stats = await ctx.memoryManager.getStats();

      if (json) {
        output.json(stats);
      } else {
        spinner.succeed('Memory Statistics');

        output.newline();
        output.section('Overview');
        output.keyValue('Total Memories', stats.totalEntries.toLocaleString());
        output.keyValue('Database Size', output.formatBytes(stats.databaseSize));
        output.keyValue('Unique Agents', stats.uniqueAgents);
        output.keyValue('Unique Sessions', stats.uniqueSessions);

        output.newline();
        output.section('By Type');
        for (const [type, count] of Object.entries(stats.byType)) {
          output.keyValue(type, count.toLocaleString());
        }

        if (stats.oldestEntry && stats.newestEntry) {
          output.newline();
          output.section('Time Range');
          output.keyValue('Oldest', new Date(stats.oldestEntry).toLocaleDateString());
          output.keyValue('Newest', new Date(stats.newestEntry).toLocaleDateString());
        }
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to get stats', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Memory Export Command
// =============================================================================

const exportCommand: CommandModule<object, MemoryExportArgs> = {
  command: 'export',
  describe: 'Export memories to JSON',

  builder: (yargs) =>
    yargs
      .option('output', {
        alias: 'o',
        describe: 'Output file path',
        type: 'string',
      })
      .option('agent', {
        alias: 'a',
        describe: 'Export only memories for this agent',
        type: 'string',
      }),

  handler: async (argv: ArgumentsCamelCase<MemoryExportArgs>) => {
    try {
      const { output: outputPath, agent } = argv;

      spinner.start('Exporting memories...');

      const ctx = await getContext();
      const memories = await ctx.memoryManager.export({ agentId: agent });

      const data = JSON.stringify(memories, null, 2);

      if (outputPath) {
        await writeFile(outputPath, data, 'utf-8');
        spinner.succeed(`Exported ${memories.length} memories to ${outputPath}`);
      } else {
        spinner.stop();
        console.log(data);
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Export failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Memory Import Command
// =============================================================================

const importCommand: CommandModule<object, MemoryImportArgs> = {
  command: 'import <file>',
  describe: 'Import memories from JSON file',

  builder: (yargs) =>
    yargs
      .positional('file', {
        describe: 'JSON file to import',
        type: 'string',
        demandOption: true,
      })
      .option('merge', {
        alias: 'm',
        describe: 'Merge with existing memories (skip duplicates)',
        type: 'boolean',
        default: true,
      }),

  handler: async (argv: ArgumentsCamelCase<MemoryImportArgs>) => {
    try {
      const { file, merge } = argv;

      spinner.start(`Importing from ${file}...`);

      const data = await readFile(file, 'utf-8');
      const memories = JSON.parse(data);

      if (!Array.isArray(memories)) {
        throw new Error('Invalid format: expected an array of memories');
      }

      const ctx = await getContext();
      const result = await ctx.memoryManager.import(memories, { merge });

      spinner.succeed(`Imported ${result.imported} memories (${result.skipped} skipped)`);
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Import failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Memory Clear Command
// =============================================================================

const clearCommand: CommandModule<object, MemoryClearArgs> = {
  command: 'clear',
  describe: 'Clear memories',

  builder: (yargs) =>
    yargs
      .option('agent', {
        alias: 'a',
        describe: 'Clear only memories for this agent',
        type: 'string',
      })
      .option('before', {
        alias: 'b',
        describe: 'Clear memories before this date (YYYY-MM-DD)',
        type: 'string',
      })
      .option('force', {
        alias: 'f',
        describe: 'Skip confirmation',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<MemoryClearArgs>) => {
    try {
      const { agent, before, force } = argv;

      if (!force) {
        output.warning('This will permanently delete memories.');
        output.info('Use --force to skip this confirmation.');
        process.exit(0);
      }

      spinner.start('Clearing memories...');

      const ctx = await getContext();
      const count = await ctx.memoryManager.clear({
        agentId: agent,
        before: before ? new Date(before) : undefined,
      });

      spinner.succeed(`Cleared ${count} memories`);
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Clear failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Main Memory Command
// =============================================================================

export const memoryCommand: CommandModule = {
  command: 'memory',
  describe: 'Manage memory system',

  builder: (yargs) =>
    yargs
      .command(searchCommand)
      .command(listCommand)
      .command(statsCommand)
      .command(exportCommand)
      .command(importCommand)
      .command(clearCommand)
      .demandCommand(1, 'Please specify a subcommand'),

  handler: () => {
    // This won't be called since we demand a subcommand
  },
};
