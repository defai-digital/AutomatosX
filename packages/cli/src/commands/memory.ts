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
  limit: number;
  agent: string | undefined;
  json: boolean;
}

interface MemoryListArgs {
  limit: number;
  agent: string | undefined;
  json: boolean;
}

interface MemoryExportArgs {
  output: string | undefined;
  agent: string | undefined;
}

interface MemoryImportArgs {
  file: string;
  merge: boolean;
}

interface MemoryClearArgs {
  agent: string | undefined;
  before: string | undefined;
  force: boolean;
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
      const results = ctx.memoryManager.search({
        query,
        limit,
        offset: 0,
        sortBy: 'relevance',
        sortDirection: 'desc',
        includeContent: true,
        highlight: false,
        filter: agent ? { agentId: agent } : undefined,
      });

      if (json) {
        output.json(results);
      } else {
        spinner.succeed(`Found ${results.entries.length} results`);

        if (results.entries.length === 0) {
          output.newline();
          output.info('No memories found matching your query');
          return;
        }

        output.newline();
        for (const entry of results.entries) {
          output.divider();
          output.keyValue('ID', String(entry.id));
          output.keyValue('Type', entry.metadata.type);
          output.keyValue('Agent', entry.metadata.agentId ?? '-');
          output.keyValue('Session', entry.metadata.sessionId ?? '-');
          output.keyValue('Created', output.formatRelativeTime(new Date(entry.createdAt)));
          output.newline();
          console.log(entry.content.slice(0, 300) + (entry.content.length > 300 ? '...' : ''));
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
      // Use search with wildcard to list recent memories
      const results = ctx.memoryManager.search({
        query: '*',
        limit,
        offset: 0,
        sortBy: 'created',
        sortDirection: 'desc',
        includeContent: true,
        highlight: false,
        filter: agent ? { agentId: agent } : undefined,
      });

      if (json) {
        output.json(results.entries);
      } else {
        spinner.succeed(`Loaded ${results.entries.length} memories`);
        output.newline();

        const rows = results.entries.map((m) => [
          String(m.id).slice(0, 8),
          m.metadata.agentId ?? '-',
          m.metadata.type,
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

interface MemoryStatsArgs {
  json: boolean;
}

const statsCommand: CommandModule<object, MemoryStatsArgs> = {
  command: 'stats',
  describe: 'Show memory statistics',

  builder: (yargs) =>
    yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false,
    }),

  handler: async (argv: ArgumentsCamelCase<MemoryStatsArgs>) => {
    try {
      const { json } = argv;

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
        output.keyValue('Database Size', output.formatBytes(stats.databaseSizeBytes));
        output.keyValue('Average Content Length', Math.round(stats.avgContentLength).toLocaleString() + ' chars');
        output.keyValue('Total Access Count', stats.totalAccessCount.toLocaleString());

        output.newline();
        output.section('By Type');
        for (const [type, count] of Object.entries(stats.entriesByType)) {
          if (count) {
            output.keyValue(type, count.toLocaleString());
          }
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
      // Use search with high limit to export
      const results = ctx.memoryManager.search({
        query: '*',
        limit: 100,  // Max allowed by schema
        offset: 0,
        sortBy: 'created',
        sortDirection: 'desc',
        includeContent: true,
        highlight: false,
        filter: agent ? { agentId: agent } : undefined,
      });

      const data = JSON.stringify(results.entries, null, 2);

      if (outputPath) {
        await writeFile(outputPath, data, 'utf-8');
        spinner.succeed(`Exported ${results.entries.length} memories to ${outputPath}`);
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
      const { file } = argv;

      spinner.start(`Importing from ${file}...`);

      const data = await readFile(file, 'utf-8');
      let memories: Array<{
        content: string;
        metadata: {
          type: 'task' | 'code' | 'conversation' | 'document' | 'decision';
          source: string;
          tags: string[];
          agentId?: string;
          sessionId?: string;
          importance?: number;
        };
      }>;
      try {
        memories = JSON.parse(data);
      } catch (parseError) {
        const parseMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Invalid JSON in file "${file}": ${parseMessage}`);
      }

      if (!Array.isArray(memories)) {
        throw new Error('Invalid format: expected an array of memories');
      }

      const ctx = await getContext();
      // Use addBatch to import
      const inputs = memories.map(m => ({
        content: m.content,
        metadata: {
          ...m.metadata,
          type: m.metadata.type ?? 'document',
          source: m.metadata.source ?? 'import',
          tags: m.metadata.tags ?? [],
        },
      }));
      const ids = ctx.memoryManager.addBatch(inputs);

      spinner.succeed(`Imported ${ids.length} memories`);
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

interface MemoryClearArgsWithAll extends MemoryClearArgs {
  all: boolean;
}

const clearCommand: CommandModule<object, MemoryClearArgsWithAll> = {
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
      .option('all', {
        describe: 'Clear all memories',
        type: 'boolean',
        default: false,
      })
      .option('force', {
        alias: 'f',
        describe: 'Skip confirmation',
        type: 'boolean',
        default: false,
      })
      .check((argv) => {
        // Require at least one of: --agent, --before, or --all
        if (!argv.agent && !argv.before && !argv.all) {
          throw new Error('Must specify at least one of: --agent, --before, or --all');
        }
        return true;
      }),

  handler: async (argv: ArgumentsCamelCase<MemoryClearArgsWithAll>) => {
    try {
      const { agent, before, all, force } = argv;

      // Build description of what will be cleared
      const descriptions: string[] = [];
      if (all) {
        descriptions.push('ALL memories');
      } else {
        if (agent) {
          descriptions.push(`memories for agent "${agent}"`);
        }
        if (before) {
          descriptions.push(`memories before ${before}`);
        }
      }

      if (!force) {
        output.warning(`This will permanently delete ${descriptions.join(' and ')}.`);
        output.info('Use --force to skip this confirmation.');
        process.exit(1); // Exit with error code since operation was not performed
      }

      spinner.start(`Clearing ${descriptions.join(' and ')}...`);

      const ctx = await getContext();

      // Parse before date if provided (strict YYYY-MM-DD format validation)
      let beforeDate: Date | undefined;
      if (before) {
        // Validate strict YYYY-MM-DD format to prevent partial dates like "2024" or "2024-01"
        if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
          throw new Error(`Invalid date format: "${before}". Use YYYY-MM-DD (e.g., 2024-01-15).`);
        }
        beforeDate = new Date(before);
        if (isNaN(beforeDate.getTime())) {
          throw new Error(`Invalid date: "${before}". Use a valid YYYY-MM-DD date.`);
        }
      }

      // Use the new clear method - build options object conditionally
      const clearOptions: Parameters<typeof ctx.memoryManager.clear>[0] = {};
      if (beforeDate) {
        clearOptions.before = beforeDate;
      }
      if (agent) {
        clearOptions.agent = agent;
      }
      if (all) {
        clearOptions.all = all;
      }

      const result = ctx.memoryManager.clear(clearOptions);

      spinner.succeed(`Cleared ${result.deleted} memories`);

      // Suggest vacuum for large deletions
      if (result.deleted > 100) {
        output.info('Tip: Run a database maintenance task periodically to reclaim disk space.');
      }
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
