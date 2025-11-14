/**
 * ratelimit.ts
 *
 * CLI commands for managing rate limits
 *
 * Phase 3 Week 2 Day 8-9: Rate Limiting CLI Commands
 */

import { Command } from 'commander';
import { ProviderRateLimiter } from '../../services/ProviderRateLimiter.js';
import chalk from 'chalk';

export function createRateLimitCommand(): Command {
  const command = new Command('ratelimit');
  command.description('Manage rate limits for AI provider requests');

  // Status command
  command
    .command('status')
    .description('Show rate limit status')
    .option('-u, --user <id>', 'Check status for specific user')
    .option('-p, --provider <name>', 'Check status for specific provider')
    .option('-i, --ip <address>', 'Check status for specific IP')
    .option('-g, --global', 'Check global rate limit status')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        if (options.user) {
          await showUserStatus(limiter, options.user, options.verbose);
        } else if (options.provider) {
          await showProviderStatus(limiter, options.provider, options.verbose);
        } else if (options.ip) {
          await showIpStatus(limiter, options.ip, options.verbose);
        } else if (options.global) {
          await showGlobalStatus(limiter, options.verbose);
        } else {
          await showAllStatus(limiter, options.verbose);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Set command
  command
    .command('set')
    .description('Set rate limit for a user')
    .requiredOption('-u, --user <id>', 'User ID')
    .requiredOption('-l, --limit <number>', 'Maximum requests', parseInt)
    .requiredOption('-w, --window <ms>', 'Time window in milliseconds', parseInt)
    .option('-b, --burst <number>', 'Burst size', parseInt, 0)
    .option('-e, --expires <timestamp>', 'Expiration timestamp', parseInt)
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        await limiter.setUserQuota(
          options.user,
          options.limit,
          options.window,
          options.burst,
          options.expires
        );

        console.log(chalk.green('✓'), `Rate limit set for user ${options.user}`);
        console.log(chalk.gray(`  Limit: ${options.limit} requests per ${options.window}ms`));
        console.log(chalk.gray(`  Burst: ${options.burst}`));
        if (options.expires) {
          console.log(chalk.gray(`  Expires: ${new Date(options.expires).toLocaleString()}`));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Reset command
  command
    .command('reset')
    .description('Reset rate limit for a key')
    .option('-u, --user <id>', 'Reset user rate limit')
    .option('-p, --provider <name>', 'Reset provider rate limit')
    .option('-i, --ip <address>', 'Reset IP rate limit')
    .option('-g, --global', 'Reset global rate limit')
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        if (options.user) {
          await limiter.reset(options.user, 'user');
          console.log(chalk.green('✓'), `Rate limit reset for user ${options.user}`);
        } else if (options.provider) {
          await limiter.reset(options.provider, 'provider');
          console.log(chalk.green('✓'), `Rate limit reset for provider ${options.provider}`);
        } else if (options.ip) {
          await limiter.reset(options.ip, 'ip');
          console.log(chalk.green('✓'), `Rate limit reset for IP ${options.ip}`);
        } else if (options.global) {
          await limiter.reset('global', 'global');
          console.log(chalk.green('✓'), 'Global rate limit reset');
        } else {
          console.error(chalk.red('Error:'), 'Please specify a target to reset');
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Remove command
  command
    .command('remove')
    .description('Remove custom user quota')
    .requiredOption('-u, --user <id>', 'User ID')
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        await limiter.removeUserQuota(options.user);
        console.log(chalk.green('✓'), `Custom quota removed for user ${options.user}`);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Config command
  command
    .command('config')
    .description('Show rate limit configurations')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        const configs = limiter.getConfigs();

        console.log(chalk.bold('\nRate Limit Configurations:\n'));

        configs.forEach(config => {
          const status = config.enabled ? chalk.green('enabled') : chalk.red('disabled');
          console.log(chalk.bold(config.name), status);
          console.log(chalk.gray(`  ${config.description}`));
          console.log(chalk.gray(`  Limit: ${config.maxRequests} requests per ${config.windowMs}ms`));
          console.log(chalk.gray(`  Burst: ${config.burstSize}`));

          if (options.verbose) {
            console.log(chalk.gray(`  ID: ${config.id}`));
            console.log(chalk.gray(`  Created: ${new Date(config.createdAt).toLocaleString()}`));
            console.log(chalk.gray(`  Updated: ${new Date(config.updatedAt).toLocaleString()}`));
          }
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Stats command
  command
    .command('stats')
    .description('Show rate limit statistics')
    .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
    .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
    .option('-t, --type <type>', 'Type filter (user|provider|ip|global)')
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        const stats = await limiter.getStatistics(options.start, options.end, options.type);

        if (stats.length === 0) {
          console.log(chalk.yellow('No statistics found'));
          return;
        }

        console.log(chalk.bold('\nRate Limit Statistics:\n'));

        stats.forEach(stat => {
          console.log(chalk.bold(stat.date), chalk.gray(`(${stat.type})`));
          console.log(chalk.gray(`  Total: ${stat.totalRequests.toLocaleString()}`));
          console.log(chalk.gray(`  Allowed: ${chalk.green(stat.allowedRequests.toLocaleString())}`));
          console.log(chalk.gray(`  Denied: ${chalk.red(stat.deniedRequests.toLocaleString())}`));
          console.log(chalk.gray(`  Unique Keys: ${stat.uniqueKeys.toLocaleString()}`));

          const approvalRate = (stat.allowedRequests / stat.totalRequests) * 100;
          console.log(chalk.gray(`  Approval Rate: ${approvalRate.toFixed(1)}%`));
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Violations command
  command
    .command('violations')
    .description('Show recent rate limit violations')
    .option('-k, --key <key>', 'Filter by key')
    .option('-t, --type <type>', 'Filter by type (user|provider|ip|global)')
    .option('-l, --limit <number>', 'Limit results', parseInt, 20)
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        const violations = await limiter.getViolations(options.key, options.type, options.limit);

        if (violations.length === 0) {
          console.log(chalk.yellow('No violations found'));
          return;
        }

        console.log(chalk.bold('\nRecent Rate Limit Violations:\n'));

        violations.forEach(violation => {
          const time = new Date(violation.violationTime).toLocaleString();
          console.log(chalk.red('✗'), chalk.bold(violation.key), chalk.gray(`(${violation.type})`));
          console.log(chalk.gray(`  Time: ${time}`));
          console.log(chalk.gray(`  Config: ${violation.configName}`));
          console.log(chalk.gray(`  Requested: ${violation.tokensRequested} tokens`));
          console.log(chalk.gray(`  Available: ${violation.tokensAvailable.toFixed(2)} tokens`));

          if (violation.metadata) {
            try {
              const metadata = JSON.parse(violation.metadata);
              console.log(chalk.gray(`  Metadata: ${JSON.stringify(metadata)}`));
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Buckets command
  command
    .command('buckets')
    .description('Show active token buckets')
    .option('-t, --type <type>', 'Filter by type (user|provider|ip|global)')
    .action(async (options) => {
      const limiter = new ProviderRateLimiter();

      try {
        const buckets = await limiter.getActiveBuckets(options.type);

        if (buckets.length === 0) {
          console.log(chalk.yellow('No active buckets found'));
          return;
        }

        console.log(chalk.bold('\nActive Token Buckets:\n'));

        buckets.forEach(bucket => {
          const fillPercentage = (bucket.tokens / bucket.maxTokens) * 100;
          const tokensPerSecond = bucket.refillRate * 1000;

          console.log(chalk.bold(bucket.key), chalk.gray(`(${bucket.type})`));
          console.log(chalk.gray(`  Tokens: ${bucket.tokens.toFixed(2)} / ${bucket.maxTokens}`));
          console.log(chalk.gray(`  Fill: ${fillPercentage.toFixed(1)}%`));
          console.log(chalk.gray(`  Refill: ${tokensPerSecond.toFixed(2)} tokens/second`));
          console.log(chalk.gray(`  Last Refill: ${new Date(bucket.lastRefill).toLocaleString()}`));
          console.log();
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Cleanup command
  command
    .command('cleanup')
    .description('Clean up expired buckets')
    .action(async () => {
      const limiter = new ProviderRateLimiter();

      try {
        const removed = await limiter.cleanup();
        console.log(chalk.green('✓'), `Removed ${removed} expired buckets`);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Show user rate limit status
 */
async function showUserStatus(
  limiter: ProviderRateLimiter,
  userId: string,
  verbose: boolean
): Promise<void> {
  const status = await limiter.getStatus(userId, 'user');

  console.log(chalk.bold(`\nUser Rate Limit: ${userId}\n`));
  console.log(chalk.gray('Status:'), status.allowed ? chalk.green('OK') : chalk.red('LIMITED'));
  console.log(chalk.gray('Remaining:'), status.remaining);
  console.log(chalk.gray('Limit:'), status.limit);
  console.log(chalk.gray('Reset:'), new Date(status.resetAt).toLocaleString());

  if (verbose) {
    const violations = await limiter.getViolations(userId, 'user', 5);
    if (violations.length > 0) {
      console.log(chalk.bold('\nRecent Violations:'));
      violations.forEach(v => {
        console.log(chalk.gray(`  ${new Date(v.violationTime).toLocaleString()}`));
      });
    }
  }
}

/**
 * Show provider rate limit status
 */
async function showProviderStatus(
  limiter: ProviderRateLimiter,
  provider: string,
  verbose: boolean
): Promise<void> {
  const status = await limiter.getStatus(provider, 'provider');

  console.log(chalk.bold(`\nProvider Rate Limit: ${provider}\n`));
  console.log(chalk.gray('Status:'), status.allowed ? chalk.green('OK') : chalk.red('LIMITED'));
  console.log(chalk.gray('Remaining:'), status.remaining);
  console.log(chalk.gray('Limit:'), status.limit);
  console.log(chalk.gray('Reset:'), new Date(status.resetAt).toLocaleString());

  if (verbose) {
    const violations = await limiter.getViolations(provider, 'provider', 5);
    if (violations.length > 0) {
      console.log(chalk.bold('\nRecent Violations:'));
      violations.forEach(v => {
        console.log(chalk.gray(`  ${new Date(v.violationTime).toLocaleString()}`));
      });
    }
  }
}

/**
 * Show IP rate limit status
 */
async function showIpStatus(
  limiter: ProviderRateLimiter,
  ip: string,
  verbose: boolean
): Promise<void> {
  const status = await limiter.getStatus(ip, 'ip');

  console.log(chalk.bold(`\nIP Rate Limit: ${ip}\n`));
  console.log(chalk.gray('Status:'), status.allowed ? chalk.green('OK') : chalk.red('LIMITED'));
  console.log(chalk.gray('Remaining:'), status.remaining);
  console.log(chalk.gray('Limit:'), status.limit);
  console.log(chalk.gray('Reset:'), new Date(status.resetAt).toLocaleString());

  if (verbose) {
    const violations = await limiter.getViolations(ip, 'ip', 5);
    if (violations.length > 0) {
      console.log(chalk.bold('\nRecent Violations:'));
      violations.forEach(v => {
        console.log(chalk.gray(`  ${new Date(v.violationTime).toLocaleString()}`));
      });
    }
  }
}

/**
 * Show global rate limit status
 */
async function showGlobalStatus(limiter: ProviderRateLimiter, verbose: boolean): Promise<void> {
  const status = await limiter.getStatus('global', 'global');

  console.log(chalk.bold('\nGlobal Rate Limit:\n'));
  console.log(chalk.gray('Status:'), status.allowed ? chalk.green('OK') : chalk.red('LIMITED'));
  console.log(chalk.gray('Remaining:'), status.remaining);
  console.log(chalk.gray('Limit:'), status.limit);
  console.log(chalk.gray('Reset:'), new Date(status.resetAt).toLocaleString());

  if (verbose) {
    const violations = await limiter.getViolations('global', 'global', 5);
    if (violations.length > 0) {
      console.log(chalk.bold('\nRecent Violations:'));
      violations.forEach(v => {
        console.log(chalk.gray(`  ${new Date(v.violationTime).toLocaleString()}`));
      });
    }
  }
}

/**
 * Show all rate limit status
 */
async function showAllStatus(limiter: ProviderRateLimiter, verbose: boolean): Promise<void> {
  console.log(chalk.bold('\nRate Limit Status:\n'));

  // Global
  const globalStatus = await limiter.getStatus('global', 'global');
  console.log(chalk.bold('Global:'));
  console.log(chalk.gray(`  Status: ${globalStatus.allowed ? chalk.green('OK') : chalk.red('LIMITED')}`));
  console.log(chalk.gray(`  Remaining: ${globalStatus.remaining} / ${globalStatus.limit}`));
  console.log();

  // Configurations
  const configs = limiter.getConfigs();
  console.log(chalk.bold('Configurations:'));
  configs.forEach(config => {
    const status = config.enabled ? chalk.green('enabled') : chalk.red('disabled');
    console.log(chalk.gray(`  ${config.name}: ${config.maxRequests}/${config.windowMs}ms`), status);
  });
  console.log();

  if (verbose) {
    // Recent violations
    const violations = await limiter.getViolations(undefined, undefined, 5);
    if (violations.length > 0) {
      console.log(chalk.bold('Recent Violations:'));
      violations.forEach(v => {
        console.log(chalk.gray(`  ${v.key} (${v.type}) - ${new Date(v.violationTime).toLocaleString()}`));
      });
      console.log();
    }

    // Active buckets
    const buckets = await limiter.getActiveBuckets();
    console.log(chalk.bold(`Active Buckets: ${buckets.length}`));
  }
}
