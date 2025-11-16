/**
 * Agent Remove Command - Remove an agent
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import * as readline from 'readline';
import { ProfileLoader } from '../../../agents/profile-loader.js';
import { TeamManager } from '../../../core/team-manager.js';

interface RemoveOptions {
  agent: string;
  confirm?: boolean;
}

export const removeCommand: CommandModule<{}, RemoveOptions> = {
  command: 'remove <agent>',
  describe: 'Remove an agent',
  aliases: ['rm', 'delete'],

  builder: (yargs) => {
    return yargs
      .positional('agent', {
        describe: 'Agent name',
        type: 'string',
        demandOption: true
      })
      .option('confirm', {
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        alias: 'y'
      });
  },

  handler: async (argv) => {
    try {
      const projectDir = process.cwd();
      const agentsDir = join(projectDir, '.automatosx', 'agents');
      const teamsDir = join(projectDir, '.automatosx', 'teams');

      // Initialize managers
      const teamManager = new TeamManager(teamsDir);
      const profileLoader = new ProfileLoader(agentsDir, undefined, teamManager);

      // Resolve agent name (supports displayName)
      let resolvedName: string;
      try {
        resolvedName = await profileLoader.resolveAgentName(argv.agent);
      } catch (error) {
        console.log(chalk.red.bold(`\n✗ Agent not found: ${argv.agent}\n`));

        // Try to suggest similar agents
        try {
          const suggestions = await profileLoader.findSimilarAgents(argv.agent, 3);
          const closeSuggestions = suggestions.filter(s => s.distance <= 3);

          if (closeSuggestions.length > 0) {
            console.log(chalk.yellow('💡 Did you mean:\n'));
            closeSuggestions.forEach((s, i) => {
              const displayInfo = s.displayName ? `${s.displayName} (${s.name})` : s.name;
              const roleInfo = s.role ? ` - ${s.role}` : '';
              console.log(chalk.cyan(`  ${i + 1}. ${displayInfo}${roleInfo}`));
            });
            console.log();
          } else {
            console.log(chalk.gray('Run "ax agent list" to see available agents.\n'));
          }
        } catch {
          console.log(chalk.gray('Run "ax agent list" to see available agents.\n'));
        }

        process.exit(1);
      }

      const agentFile = join(agentsDir, `${resolvedName}.yaml`);

      // Check if agent file exists
      if (!existsSync(agentFile)) {
        console.log(chalk.red.bold(`\n✗ Agent file not found: ${resolvedName}\n`));
        console.log(chalk.gray('Run "ax agent list" to see available agents.\n'));
        process.exit(1);
      }

      // Load profile to get display name for confirmation message
      const profile = await profileLoader.loadProfile(resolvedName);
      const displayInfo = profile.displayName ? `${profile.displayName} (${resolvedName})` : resolvedName;

      // Confirm deletion
      if (!argv.confirm) {
        const confirmed = await askConfirmation(
          `Are you sure you want to remove agent '${chalk.cyan(displayInfo)}'?`
        );

        if (!confirmed) {
          console.log(chalk.yellow('\nCancelled.\n'));
          process.exit(0);
        }
      }

      // Remove file
      await unlink(agentFile);

      console.log(chalk.green.bold(`\n✓ Agent '${displayInfo}' removed successfully\n`));
      console.log(chalk.gray(`Deleted: ${agentFile}\n`));

    } catch (error) {
      console.error(chalk.red.bold('\n✗ Error removing agent\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Ask for user confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(chalk.yellow(`\n${question} (y/N): `), answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
