/**
 * Runs Command - Manage checkpoint runs (v5.3.0)
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { join } from 'path';
import { promises as fs } from 'fs';
import { CheckpointManager } from '../../core/session/checkpoint.js';
import { detectProjectRoot } from '../../shared/validation/path-resolver.js';
import { loadConfig } from '../../core/config/loader.js';
import { logger } from '../../shared/logging/logger.js';
import type { ExecutionMode } from '../../types/stage-execution.js';
import { withPrompt } from '../../shared/helpers/prompt-helper.js';

// ============================================================================
// List Runs Command
// ============================================================================

interface ListRunsOptions {
  status?: string;
  agent?: string;
  limit?: number;
}

const listRunsCommand: CommandModule<Record<string, unknown>, ListRunsOptions> = {
  command: 'list',
  describe: 'List all checkpoint runs',

  builder: (yargs) => {
    return yargs
      .option('status', {
        describe: 'Filter by status',
        type: 'string',
        choices: ['running', 'paused', 'completed', 'failed', 'aborted']
      })
      .option('agent', {
        describe: 'Filter by agent',
        type: 'string'
      })
      .option('limit', {
        describe: 'Limit number of results',
        type: 'number',
        default: 20
      });
  },

  handler: async (argv) => {
    try {
      // Detect project root
      const projectDir = await detectProjectRoot(process.cwd());
      const config = await loadConfig(projectDir);

      // Initialize CheckpointManager
      const stageConfig = config.execution?.stages;
      const checkpointPath = stageConfig?.checkpointPath || join(projectDir, '.automatosx', 'checkpoints');
      const cleanupAfterDays = stageConfig?.cleanupAfterDays || 7;

      const checkpointManager = new CheckpointManager(checkpointPath, cleanupAfterDays);

      // List all checkpoints
      let runs = await checkpointManager.listCheckpoints();

      // Apply filters
      if (argv.status) {
        runs = runs.filter(r => r.status === argv.status);
      }
      if (argv.agent) {
        runs = runs.filter(r => r.agent === argv.agent);
      }

      // Limit results
      runs = runs.slice(0, argv.limit);

      // Display results
      console.log(chalk.cyan('\n📋 Checkpoint Runs\n'));

      if (runs.length === 0) {
        console.log('  No checkpoints found.');
        return;
      }

      // Display as table
      console.log(chalk.gray('  Run ID       Agent          Mode          Progress   Status      Updated'));
      console.log(chalk.gray('  ──────────   ────────────   ───────────   ────────   ─────────   ──────────────────'));

      for (const run of runs) {
        const runIdShort = run.runId.substring(0, 8);
        const agentName = run.agent.padEnd(14, ' ').substring(0, 14);
        const mode = formatMode(run.mode).padEnd(13, ' ').substring(0, 13);
        const progress = `${run.completedStages}/${run.totalStages}`.padEnd(10, ' ').substring(0, 10);
        const status = formatStatus(run.status).padEnd(11, ' ').substring(0, 11);
        const updated = new Date(run.updatedAt).toLocaleString();

        console.log(`  ${runIdShort}   ${agentName}   ${mode}   ${progress}   ${status}   ${updated}`);
      }

      console.log();

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Failed to list runs: ${err.message}\n`));
      logger.error('List runs failed', { error: err.message, stack: err.stack });
      process.exit(1);
    }
  }
};

// ============================================================================
// Show Run Command
// ============================================================================

interface ShowRunOptions {
  runId: string;
  'run-id': string;
  stages?: boolean;
  artifacts?: boolean;
}

const showRunCommand: CommandModule<Record<string, unknown>, ShowRunOptions> = {
  command: 'show <run-id>',
  describe: 'Show detailed checkpoint information',

  builder: (yargs: any) => {
    return yargs
      .positional('run-id', {
        describe: 'Checkpoint run ID',
        type: 'string',
        demandOption: true
      })
      .option('stages', {
        describe: 'Show stage details',
        type: 'boolean',
        default: true
      })
      .option('artifacts', {
        describe: 'List artifact files',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    if (!argv['run-id'] || typeof argv['run-id'] !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Run ID is required\n'));
      process.exit(1);
    }

    const runId = argv['run-id'];

    try {
      // Detect project root
      const projectDir = await detectProjectRoot(process.cwd());
      const config = await loadConfig(projectDir);

      // Initialize CheckpointManager
      const stageConfig = config.execution?.stages;
      const checkpointPath = stageConfig?.checkpointPath || join(projectDir, '.automatosx', 'checkpoints');
      const cleanupAfterDays = stageConfig?.cleanupAfterDays || 7;

      const checkpointManager = new CheckpointManager(checkpointPath, cleanupAfterDays);

      // Load checkpoint
      const checkpoint = await checkpointManager.loadCheckpoint(runId);

      // Display run metadata
      console.log(chalk.cyan('\n📂 Checkpoint Details\n'));
      console.log(`  Run ID: ${chalk.bold(checkpoint.runId)}`);
      console.log(`  Agent: ${checkpoint.agent}`);
      console.log(`  Task: ${checkpoint.task}`);
      console.log(`  Mode: ${formatMode(checkpoint.mode)}`);
      console.log(`  Progress: ${checkpoint.lastCompletedStageIndex + 1}/${checkpoint.stages.length} stages`);
      console.log(`  Created: ${new Date(checkpoint.createdAt).toLocaleString()}`);
      console.log(`  Updated: ${new Date(checkpoint.updatedAt).toLocaleString()}`);

      // Display stage details
      if (argv.stages && checkpoint.stages.length > 0) {
        console.log(chalk.cyan('\n📊 Stage Execution History\n'));

        for (const stage of checkpoint.stages) {
          const status = formatStageStatus(stage.status);
          const duration = stage.result?.duration
            ? `${(stage.result.duration / 1000).toFixed(1)}s`
            : '-';

          console.log(`  ${stage.index + 1}. ${chalk.bold(stage.name)}`);
          console.log(`     Status: ${status}`);
          console.log(`     Duration: ${duration}`);
          console.log(`     Retries: ${stage.retries || 0}`);

          if (stage.result?.error) {
            console.log(chalk.red(`     Error: ${stage.result.error.message}`));
          }

          console.log();
        }
      }

      // List artifacts
      if (argv.artifacts) {
        const artifactsPath = join(
          checkpointPath,
          runId,
          'artifacts'
        );

        try {
          const artifactFiles = await fs.readdir(artifactsPath);

          if (artifactFiles.length > 0) {
            console.log(chalk.cyan('\n📁 Artifacts\n'));
            for (const file of artifactFiles) {
              const stats = await fs.stat(join(artifactsPath, file));
              const size = (stats.size / 1024).toFixed(1);
              console.log(`  ${file} (${size} KB)`);
            }
            console.log();
          } else {
            console.log(chalk.gray('\nNo artifacts found.\n'));
          }
        } catch (error) {
          console.log(chalk.gray('\nNo artifacts found.\n'));
        }
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Failed to load checkpoint: ${err.message}\n`));
      logger.error('Show run failed', { error: err.message, runId, stack: err.stack });
      process.exit(1);
    }
  }
};

// ============================================================================
// Delete Run Command
// ============================================================================

interface DeleteRunOptions {
  runId: string;
  'run-id': string;
  force?: boolean;
}

const deleteRunCommand: CommandModule<Record<string, unknown>, DeleteRunOptions> = {
  command: 'delete <run-id>',
  describe: 'Delete a checkpoint run',

  builder: (yargs: any) => {
    return yargs
      .positional('run-id', {
        describe: 'Checkpoint run ID',
        type: 'string',
        demandOption: true
      })
      .option('force', {
        alias: 'f',
        describe: 'Skip confirmation',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    if (!argv['run-id'] || typeof argv['run-id'] !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Run ID is required\n'));
      process.exit(1);
    }

    const runId = argv['run-id'];

    try {
      // Detect project root
      const projectDir = await detectProjectRoot(process.cwd());
      const config = await loadConfig(projectDir);

      // Initialize CheckpointManager
      const stageConfig = config.execution?.stages;
      const checkpointPath = stageConfig?.checkpointPath || join(projectDir, '.automatosx', 'checkpoints');
      const cleanupAfterDays = stageConfig?.cleanupAfterDays || 7;

      const checkpointManager = new CheckpointManager(checkpointPath, cleanupAfterDays);

      // Load checkpoint for confirmation
      const checkpoint = await checkpointManager.loadCheckpoint(runId);

      // Confirm deletion (unless --force)
      // v12.8.5: Refactored to use withPrompt() for automatic cleanup
      if (!argv.force) {
        console.log(chalk.yellow('\n⚠️  Warning: This action cannot be undone.\n'));
        console.log(`  Run ID: ${runId}`);
        console.log(`  Agent: ${checkpoint.agent}`);
        console.log(`  Task: ${checkpoint.task}`);
        console.log();

        const confirmed = await withPrompt(async (prompt) => {
          const answer = await prompt.question(chalk.yellow('Delete this checkpoint? (yes/no): '));
          return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        });

        if (!confirmed) {
          console.log('\nCancelled.');
          return;
        }
      }

      // Delete checkpoint
      await checkpointManager.deleteCheckpoint(runId);
      console.log(chalk.green(`\n✅ Checkpoint deleted: ${runId}\n`));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Failed to delete checkpoint: ${err.message}\n`));
      logger.error('Delete run failed', { error: err.message, runId, stack: err.stack });
      process.exit(1);
    }
  }
};

// ============================================================================
// Main Runs Command
// ============================================================================

export const runsCommand: CommandModule = {
  command: 'runs <command>',
  describe: 'Manage checkpoint runs',

  builder: (yargs) => {
    return yargs
      .command(listRunsCommand)
      .command(showRunCommand)
      .command(deleteRunCommand)
      .demandCommand(1, 'You need to specify a subcommand (list, show, delete)');
  },

  handler: () => {
    // Parent command, no direct handler
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatMode(mode: ExecutionMode): string {
  if (mode.interactive && mode.streaming) return chalk.cyan('Hybrid');
  if (mode.interactive) return chalk.blue('Interactive');
  if (mode.streaming) return chalk.magenta('Streaming');
  return chalk.gray('Standard');
}

function formatStatus(status: string): string {
  switch (status) {
    case 'running': return chalk.yellow('Running');
    case 'paused': return chalk.blue('Paused');
    case 'completed': return chalk.green('Completed');
    case 'failed': return chalk.red('Failed');
    case 'aborted': return chalk.gray('Aborted');
    default: return status;
  }
}

function formatStageStatus(status: string): string {
  switch (status) {
    case 'queued': return chalk.gray('Queued');
    case 'running': return chalk.yellow('Running');
    case 'checkpoint': return chalk.blue('Checkpoint');
    case 'completed': return chalk.green('Completed');
    case 'error': return chalk.red('Error');
    case 'timeout': return chalk.red('Timeout');
    case 'skipped': return chalk.gray('Skipped');
    default: return status;
  }
}
