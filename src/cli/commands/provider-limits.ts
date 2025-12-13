/**
 * Provider Limits Command (v5.7.0)
 *
 * Show current provider limit status
 * Command: ax provider limits [--json]
 */

import type { CommandModule } from 'yargs';
import { getProviderLimitManager } from '../../core/provider-limit-manager.js';
import { logger } from '../../shared/logging/logger.js';
import { formatDurationHuman } from '../../shared/helpers/format-utils.js';
import chalk from 'chalk';

interface ProviderLimitsOptions {
  json?: boolean;
}

// Alias for backward compatibility
const formatDuration = formatDurationHuman;

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
      const limitManager = await getProviderLimitManager();
      await limitManager.initialize();

      // Bug #v8.4.11: Refresh expired limits before displaying
      await limitManager.refreshExpired();

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
            // Bug #v8.4.11: Clamp negative remainingMs to 0
            remainingMs: Math.max(0, state.resetAtMs - now),
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

        // Bug #v8.4.12: Don't show "all providers available" when manual override is active
        if (states.size === 0 && !manualOverride) {
          console.log(chalk.green('  ✅ No limits detected. All providers available.'));
        } else {
          for (const [name, state] of states.entries()) {
            const resetDate = new Date(state.resetAtMs);
            // Bug #v8.4.11: Clamp negative remainingMs to 0
            const remainingMs = Math.max(0, state.resetAtMs - now);
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
