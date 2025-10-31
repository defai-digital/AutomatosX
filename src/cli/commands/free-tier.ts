/**
 * Free Tier CLI Command
 *
 * Manage and monitor free tier usage across providers.
 *
 * @module cli/commands/free-tier
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { getFreeTierManager } from '@/core/free-tier/free-tier-manager.js';
import { logger } from '@/utils/logger.js';

interface FreeTierOptions {
  provider?: string;
  days?: number;
  json?: boolean;
}

export const freeTierCommand: CommandModule = {
  command: 'free-tier <command>',
  describe: 'Manage free tier usage',

  builder: (yargs) => {
    return yargs
      .command({
        command: 'status [provider]',
        describe: 'Show free tier quota status',
        builder: (yargs) => {
          return yargs
            .positional('provider', {
              type: 'string',
              describe: 'Provider name (optional, shows all if omitted)'
            })
            .option('json', {
              type: 'boolean',
              default: false,
              describe: 'Output as JSON'
            });
        },
        handler: async (argv) => {
          await handleStatus(argv as any);
        }
      })
      .command({
        command: 'history <provider>',
        describe: 'Show free tier usage history',
        builder: (yargs) => {
          return yargs
            .positional('provider', {
              type: 'string',
              describe: 'Provider name',
              demandOption: true
            })
            .option('days', {
              type: 'number',
              default: 7,
              describe: 'Number of days to show'
            })
            .option('json', {
              type: 'boolean',
              default: false,
              describe: 'Output as JSON'
            });
        },
        handler: async (argv) => {
          await handleHistory(argv as any);
        }
      })
      .command({
        command: 'summary',
        describe: 'Show free tier summary statistics',
        builder: (yargs) => {
          return yargs.option('json', {
            type: 'boolean',
            default: false,
            describe: 'Output as JSON'
          });
        },
        handler: async (argv) => {
          await handleSummary(argv as FreeTierOptions);
        }
      })
      .demandCommand(1, 'You must provide a valid subcommand')
      .help();
  },

  handler: () => {}
};

/**
 * Handle 'ax free-tier status' command
 */
async function handleStatus(argv: FreeTierOptions): Promise<void> {
  const manager = getFreeTierManager();
  const providers = argv.provider
    ? [argv.provider]
    : manager.getProvidersWithFreeTier();

  if (providers.length === 0) {
    console.log(chalk.yellow('\n⚠️  No providers with free tier found\n'));
    return;
  }

  const quotas = providers.map(p => ({
    provider: p,
    quota: manager.getQuota(p)
  }));

  if (argv.json) {
    console.log(JSON.stringify(quotas, null, 2));
    return;
  }

  console.log(chalk.cyan('\n🎁 Free Tier Status\n'));

  for (const { provider, quota } of quotas) {
    const status = quota.available
      ? chalk.green('● AVAILABLE')
      : chalk.red('● EXHAUSTED');

    console.log(`${status} ${chalk.bold(provider)}`);

    if (quota.requestsLimit > 0) {
      const requestsBar = createProgressBar(
        quota.requestsRemaining,
        quota.requestsLimit,
        30
      );
      console.log(
        chalk.gray(`  Requests: ${requestsBar} ${quota.requestsRemaining}/${quota.requestsLimit}`)
      );
    }

    if (quota.tokensLimit > 0) {
      const tokensBar = createProgressBar(
        quota.tokensRemaining,
        quota.tokensLimit,
        30
      );
      const tokensK = Math.round(quota.tokensRemaining / 1000);
      const limitK = Math.round(quota.tokensLimit / 1000);
      console.log(
        chalk.gray(`  Tokens:   ${tokensBar} ${tokensK}K/${limitK}K`)
      );
    }

    console.log(
      chalk.gray(`  Usage:    ${quota.percentUsed.toFixed(1)}%`)
    );
    console.log(
      chalk.gray(`  Resets:   ${quota.resetsAt.toLocaleString()}`)
    );

    if (!quota.available) {
      const timeUntilReset = quota.resetsAt.getTime() - Date.now();
      const hoursUntilReset = Math.ceil(timeUntilReset / (1000 * 60 * 60));
      console.log(
        chalk.yellow(`  ⚠️  Quota exhausted - resets in ${hoursUntilReset}h`)
      );
    }

    console.log();
  }

  if (!argv.provider) {
    console.log(chalk.gray('Tip: Use --provider <name> to see specific provider details\n'));
  }
}

/**
 * Handle 'ax free-tier history' command
 */
async function handleHistory(argv: FreeTierOptions & { provider: string }): Promise<void> {
  const manager = getFreeTierManager();
  const provider = argv.provider;

  if (!manager.hasFreeTier(provider)) {
    console.error(chalk.red(`\n✗ Provider '${provider}' does not have a free tier\n`));
    const available = manager.getProvidersWithFreeTier();
    console.error(chalk.gray(`Available providers: ${available.join(', ')}\n`));
    process.exit(1);
  }

  const history = manager.getUsageHistory(provider, argv.days);

  if (argv.json) {
    console.log(JSON.stringify(history, null, 2));
    return;
  }

  console.log(chalk.cyan(`\n📊 Free Tier History: ${chalk.bold(provider)}\n`));

  if (history.length === 0) {
    console.log(chalk.gray('No usage history found\n'));
    return;
  }

  console.log(chalk.gray('Date       | Requests | Tokens'));
  console.log(chalk.gray('-----------|----------|----------'));

  for (const day of history) {
    const tokensK = Math.round(day.tokensUsed / 1000);
    console.log(
      `${day.date} | ${day.requestsUsed.toString().padStart(8)} | ${tokensK.toString().padStart(7)}K`
    );
  }

  console.log();
}

/**
 * Handle 'ax free-tier summary' command
 */
async function handleSummary(argv: FreeTierOptions): Promise<void> {
  const manager = getFreeTierManager();
  const summary = manager.getSummary();

  if (argv.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(chalk.cyan('\n📈 Free Tier Summary\n'));

  console.log(chalk.gray('Providers:'));
  console.log(`  Total: ${summary.totalProviders}`);
  console.log(`  With quota available: ${summary.providersWithQuota}`);
  console.log();

  console.log(chalk.gray('Today\'s Usage:'));
  console.log(`  Requests saved: ${summary.totalRequestsSaved}`);
  const tokensK = Math.round(summary.totalTokensSaved / 1000);
  console.log(`  Tokens saved: ${tokensK}K`);
  console.log();

  // Estimate cost savings
  // Gemini paid tier: $0.0005/request, $0.125 per 1M input tokens
  const requestCostSavings = summary.totalRequestsSaved * 0.0005;
  const tokenCostSavings = (summary.totalTokensSaved / 1000000) * 0.125;
  const totalSavings = requestCostSavings + tokenCostSavings;

  if (totalSavings > 0) {
    console.log(chalk.green('💰 Estimated Savings Today:'));
    console.log(`  From requests: $${requestCostSavings.toFixed(4)}`);
    console.log(`  From tokens: $${tokenCostSavings.toFixed(4)}`);
    console.log(chalk.bold(`  Total: $${totalSavings.toFixed(4)}\n`));

    const monthlySavings = totalSavings * 30;
    console.log(chalk.gray(`  Projected monthly: $${monthlySavings.toFixed(2)}\n`));
  }
}

/**
 * Create progress bar visualization
 */
function createProgressBar(current: number, total: number, width: number = 30): string {
  const percent = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(percent * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  // Color based on remaining quota
  if (percent > 0.5) {
    return chalk.green(bar);
  } else if (percent > 0.2) {
    return chalk.yellow(bar);
  } else {
    return chalk.red(bar);
  }
}
