/**
 * Workspace Command - Manage automatosx workspace (PRD/tmp)
 *
 * @since v4.7.0
 * @updated v5.2.0 - Simplified to PRD/tmp management
 */

import type { CommandModule } from 'yargs';
import { WorkspaceManager } from '../../core/workspace-manager.js';
import chalk from 'chalk';

interface WorkspaceListOptions {
  type?: 'prd' | 'tmp';
  json?: boolean;
}

interface WorkspaceStatsOptions {
  json?: boolean;
}

interface WorkspaceCleanupOptions {
  olderThan?: number;
  confirm?: boolean;
}

/**
 * Workspace List Command
 * v5.2: Lists PRD or tmp files
 */
const listCommand: CommandModule<Record<string, unknown>, WorkspaceListOptions> = {
  command: 'list',
  describe: 'List workspace files (PRD or tmp)',

  builder: (yargs) => {
    return yargs
      .option('type', {
        describe: 'Workspace type to list',
        type: 'string',
        choices: ['prd', 'tmp'],
        default: 'prd'
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    try {
      const { detectProjectRoot } = await import('../../core/path-resolver.js');
      const projectDir = await detectProjectRoot(process.cwd());
      const workspaceManager = new WorkspaceManager(projectDir);

      const files = argv.type === 'tmp'
        ? await workspaceManager.listTmp()
        : await workspaceManager.listPRD();

      if (argv.json) {
        console.log(JSON.stringify({ type: argv.type, files }, null, 2));
        process.exit(0);
      }

      console.log(chalk.blue.bold(`\n📁 ${argv.type === 'tmp' ? 'Temporary' : 'PRD'} Files\n`));

      if (files.length === 0) {
        console.log(chalk.gray('  (No files)\n'));
      } else {
        files.forEach(file => {
          console.log(chalk.gray(`  - ${file}`));
        });
        console.log(chalk.gray(`\nTotal: ${files.length} file(s)\n`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to list workspaces\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Workspace Stats Command
 * v5.2: Shows PRD/tmp statistics
 */
const statsCommand: CommandModule<Record<string, unknown>, WorkspaceStatsOptions> = {
  command: 'stats',
  describe: 'Show workspace statistics',

  builder: (yargs) => {
    return yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false
    });
  },

  handler: async (argv) => {
    try {
      const { detectProjectRoot } = await import('../../core/path-resolver.js');
      const projectDir = await detectProjectRoot(process.cwd());
      const workspaceManager = new WorkspaceManager(projectDir);

      const stats = await workspaceManager.getStats();

      if (argv.json) {
        console.log(JSON.stringify(stats, null, 2));
        process.exit(0);
      }

      console.log(chalk.blue.bold('\n📊 Workspace Statistics\n'));
      console.log(chalk.gray(`PRD files:        ${chalk.white(stats.prdFiles)}`));
      console.log(chalk.gray(`Temporary files:  ${chalk.white(stats.tmpFiles)}`));
      console.log(chalk.gray(`Total size:       ${chalk.white((stats.totalSizeBytes / 1024 / 1024).toFixed(2))} MB`));
      console.log();

      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to get workspace stats\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Workspace Cleanup Command
 * v5.2: Cleans up temporary files
 */
const cleanupCommand: CommandModule<Record<string, unknown>, WorkspaceCleanupOptions> = {
  command: 'cleanup',
  describe: 'Clean up temporary files',

  builder: (yargs) => {
    return yargs
      .option('older-than', {
        describe: 'Clean up files older than N days',
        type: 'number',
        default: 7
      })
      .option('confirm', {
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    try {
      const { detectProjectRoot } = await import('../../core/path-resolver.js');
      const projectDir = await detectProjectRoot(process.cwd());
      const workspaceManager = new WorkspaceManager(projectDir);

      if (!argv.confirm) {
        console.log(chalk.yellow(`\n⚠ This will remove temporary files older than ${argv.olderThan} days`));
        console.log(chalk.gray('Run with --confirm to proceed\n'));
        process.exit(0);
      }

      const removed = await workspaceManager.cleanupTmp(argv.olderThan);

      console.log(chalk.green.bold(`\n✓ Cleanup complete\n`));
      console.log(chalk.gray(`Removed ${removed} temporary file(s)\n`));

      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to cleanup workspaces\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Main Workspace Command
 */
export const workspaceCommand: CommandModule = {
  command: 'workspace <command>',
  describe: 'Manage agent workspaces',

  builder: (yargs) => {
    return yargs
      .command(listCommand)
      .command(statsCommand)
      .command(cleanupCommand)
      .demandCommand(1, 'You must specify a workspace command')
      .help();
  },

  handler: () => {
    // Parent command handler (not used, subcommands handle everything)
  }
};
