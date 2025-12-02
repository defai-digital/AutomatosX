/**
 * Feature Flags CLI Command
 *
 * Manage feature flags for gradual rollout and experimentation.
 *
 * @module cli/commands/flags
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { flagManager } from '@/core/feature-flags/flags.js';
import { logger } from '@/utils/logger.js';

interface FlagsListOptions {
  json?: boolean;
}

interface FlagsRolloutOptions {
  flag: string;
  percentage: number;
  skipValidation?: boolean;
}

interface FlagsKillOptions {
  flag: string;
  reason: string;
}

export const flagsCommand: CommandModule = {
  command: 'flags <command>',
  describe: 'Manage feature flags',

  builder: (yargs) => {
    return yargs
      .command({
        command: 'list',
        describe: 'List all feature flags',
        builder: (yargs) => {
          return yargs.option('json', {
            type: 'boolean',
            default: false,
            describe: 'Output as JSON'
          });
        },
        handler: async (argv) => {
          await handleList(argv as FlagsListOptions);
        }
      })
      .command({
        command: 'rollout <flag> <percentage>',
        describe: 'Increase flag rollout percentage',
        builder: (yargs) => {
          return yargs
            .positional('flag', {
              type: 'string',
              describe: 'Feature flag name',
              demandOption: true
            })
            .positional('percentage', {
              type: 'number',
              describe: 'Target rollout percentage (0-100)',
              demandOption: true
            })
            .option('skip-validation', {
              type: 'boolean',
              default: false,
              describe: 'Skip metrics validation'
            });
        },
        handler: async (argv) => {
          await handleRollout(argv as any);
        }
      })
      .command({
        command: 'kill <flag> <reason>',
        describe: 'Emergency kill switch for a flag',
        builder: (yargs) => {
          return yargs
            .positional('flag', {
              type: 'string',
              describe: 'Feature flag name',
              demandOption: true
            })
            .positional('reason', {
              type: 'string',
              describe: 'Reason for kill switch',
              demandOption: true
            });
        },
        handler: async (argv) => {
          await handleKill(argv as any);
        }
      })
      .demandCommand(1, 'You must provide a valid subcommand')
      .help();
  },

  handler: () => {}
};

/**
 * Handle 'ax flags list' command
 */
async function handleList(argv: FlagsListOptions): Promise<void> {
  const flags = flagManager.getAllFlags();

  if (argv.json) {
    console.log(JSON.stringify(flags, null, 2));
    process.exit(0);
    return;
  }

  console.log(chalk.cyan('\n🚩 Feature Flags\n'));

  if (flags.length === 0) {
    console.log(chalk.gray('No feature flags defined.'));
    return;
  }

  for (const flag of flags) {
    const status = flag.killSwitch?.enabled
      ? chalk.red('KILLED')
      : flag.rolloutPercentage !== undefined
        ? chalk.yellow(`${flag.rolloutPercentage}%`)
        : flag.enabled
          ? chalk.green('ENABLED')
          : chalk.gray('DISABLED');

    console.log(`${status} ${chalk.bold(flag.name)}`);
    console.log(`  ${chalk.gray(flag.description)}`);

    if (flag.rolloutPercentage !== undefined) {
      console.log(`  ${chalk.gray(`Rollout: ${flag.rolloutPercentage}%`)}`);
    }

    if (flag.killSwitch?.enabled) {
      console.log(`  ${chalk.red(`⚠️  KILLED: ${flag.killSwitch.reason}`)}`);
      console.log(`  ${chalk.gray(`By: ${flag.killSwitch.by} at ${new Date(flag.killSwitch.timestamp).toLocaleString()}`)}`);
    }

    if (flag.metadata) {
      console.log(`  ${chalk.gray(`Owner: ${flag.metadata.owner}`)}`);
      if (flag.metadata.expectedImpact) {
        console.log(`  ${chalk.gray(`Impact: ${flag.metadata.expectedImpact}`)}`);
      }
    }

    console.log();
  }
}

/**
 * Handle 'ax flags rollout' command
 */
async function handleRollout(argv: FlagsRolloutOptions): Promise<void> {
  const flagName = argv.flag;
  const percentage = argv.percentage;

  if (percentage < 0 || percentage > 100) {
    console.error(chalk.red('\n✗ Percentage must be between 0 and 100\n'));
    process.exit(1);
  }

  console.log(chalk.cyan(`\nIncreasing rollout: ${flagName} → ${percentage}%\n`));

  if (argv.skipValidation) {
    console.log(chalk.yellow('⚠️  Validation skipped (--skip-validation flag)\n'));
  }

  try {
    await flagManager.increaseRollout(flagName, percentage, {
      validationRequired: !argv.skipValidation,
      minimumDuration: 3600000 // 1 hour
    });

    console.log(chalk.green(`✓ Rollout increased to ${percentage}%\n`));

    const flag = flagManager.getFlag(flagName);
    if (flag?.metadata?.expectedImpact) {
      console.log(chalk.gray(`Expected impact: ${flag.metadata.expectedImpact}`));
    }

    console.log(chalk.gray('\nMonitor with:'));
    console.log(chalk.white(`  ax analytics monitor ${flagName}`));
    console.log(chalk.white(`  ax providers trace --follow\n`));

    if (percentage < 100) {
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.white(`  1. Monitor for 24 hours`));
      console.log(chalk.white(`  2. Validate metrics: ax flags validate ${flagName}`));
      console.log(chalk.white(`  3. If good, increase further: ax flags rollout ${flagName} ${Math.min(percentage * 2, 100)}\n`));
    } else {
      console.log(chalk.green.bold('🎉 Full rollout complete!\n'));
      console.log(chalk.gray('Monitor for 7 days, then consider making permanent.'));
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to increase rollout:\n'));
    console.error(chalk.red((error as Error).message));
    console.error();
    process.exit(1);
  }
}

/**
 * Handle 'ax flags kill' command
 */
async function handleKill(argv: FlagsKillOptions): Promise<void> {
  const flagName = argv.flag;
  const reason = argv.reason;

  console.log(chalk.red.bold('\n⚠️  ACTIVATING KILL SWITCH\n'));
  console.log(`Flag: ${flagName}`);
  console.log(`Reason: ${reason}\n`);

  // Confirm action
  console.log(chalk.yellow('This will immediately disable the feature for ALL users.'));
  console.log(chalk.gray('Press Ctrl+C to cancel, or wait 5 seconds to confirm...\n'));

  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    await flagManager.killSwitch(flagName, reason);

    console.log(chalk.red('✓ Kill switch activated'));
    console.log(chalk.gray('All traffic reverted to old behavior\n'));

    logger.error('Kill switch activated', { flag: flagName, reason });
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to activate kill switch:\n'));
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
