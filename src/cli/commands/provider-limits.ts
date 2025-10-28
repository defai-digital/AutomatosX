/**
 * Provider Limits Command (v5.7.0)
 *
 * Show current provider limit status
 * Command: ax provider limits [--json]
 */

import type { CommandModule } from 'yargs';
import { getProviderLimitManager } from '../../core/provider-limit-manager.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';

interface ProviderLimitsOptions {
  json?: boolean;
}

/**
 * Format duration string (e.g., "2h 30m", "45m", "< 1m")
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return '< 1m';
}

export const providerLimitsCommand: CommandModule<Record<string, unknown>, ProviderLimitsOptions> = {
  command: 'provider-limits',
  aliases: ['pl', 'limits'],
  describe: 'Show current provider limit status',

  builder: (yargs) => {
    return yargs
      .option('json', {
        describe: 'Output in JSON format',
        type: 'boolean',
        default: false
      })
      .example('$0 provider-limits', 'Show provider limits')
      .example('$0 provider-limits --json', 'Show limits in JSON format');
  },

  handler: async (argv) => {
    try {
      const limitManager = getProviderLimitManager();
      await limitManager.initialize();

      const states = limitManager.getAllStates();
      const manualOverride = limitManager.getManualOverride();
      const now = Date.now();

      if (argv.json) {
        // JSON output
        const output = {
          limits: Array.from(states.entries()).map(([name, state]) => ({
            provider: name,
            status: state.status,
            window: state.window,
            detectedAtMs: state.detectedAtMs,
            resetAtMs: state.resetAtMs,
            remainingMs: state.resetAtMs - now,
            reason: state.reason,
            manualHold: state.manualHold
          })),
          manualOverride: manualOverride || null,
          timestamp: Date.now()
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Human-readable output
        console.log();
        console.log(chalk.bold('📊 Provider Limits Status'));
        console.log();

        if (states.size === 0) {
          console.log(chalk.green('  ✅ No limits detected. All providers available.'));
        } else {
          for (const [name, state] of states.entries()) {
            const resetDate = new Date(state.resetAtMs);
            const remainingMs = state.resetAtMs - now;
            const remainingStr = formatDuration(remainingMs);

            console.log(chalk.yellow(`  ⚠️  ${name}:`));
            console.log(`     Status: ${state.status}`);
            console.log(`     Window: ${state.window}`);
            console.log(`     Resets: ${resetDate.toLocaleString()} (${remainingStr})`);
            if (state.reason) {
              console.log(`     Reason: ${state.reason}`);
            }
            console.log();
          }
        }

        if (manualOverride) {
          console.log(chalk.cyan(`  🔧 Manual Override: ${manualOverride.provider}`));
          if (manualOverride.expiresAtMs) {
            const expiresDate = new Date(manualOverride.expiresAtMs);
            const expiresIn = formatDuration(manualOverride.expiresAtMs - now);
            console.log(`     Expires: ${expiresDate.toLocaleString()} (${expiresIn})`);
          } else {
            console.log(`     Expires: Never`);
          }
          console.log();
        }

        console.log(chalk.gray('  Use "ax status" for detailed provider information.'));
        console.log();
      }
    } catch (error) {
      logger.error('Failed to get provider limits', {
        error: (error as Error).message
      });
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  }
};
