/**
 * Agent List Command - List all agents
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import { ProfileLoader } from '../../../agents/profile-loader.js';
import { TeamManager } from '../../../core/team-manager.js';
import { join } from 'path';
import chalk from 'chalk';

interface ListOptions {
  byTeam?: string;
}

export const listCommand: CommandModule<{}, ListOptions> = {
  command: 'list',
  describe: 'List all agents',

  builder: (yargs) => {
    return yargs
      .option('by-team', {
        describe: 'Filter agents by team',
        type: 'string',
        choices: ['core', 'engineering', 'business', 'design', 'research']
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

      // List all agents
      const agentNames = await profileLoader.listProfiles();

      if (agentNames.length === 0) {
        console.log(chalk.yellow('\n⚠ No agents found.\n'));
        console.log(chalk.gray('Run "ax agent create" to create your first agent.\n'));
        return;
      }

      console.log(chalk.blue.bold(`\n🤖 Agents (${agentNames.length} total)\n`));

      // Load all profiles
      const profiles = await Promise.all(
        agentNames.map(async name => {
          try {
            return await profileLoader.loadProfile(name);
          } catch (error) {
            return null;
          }
        })
      );

      // Group by team
      const byTeam: Record<string, typeof profiles> = {
        core: [],
        engineering: [],
        business: [],
        design: [],
        research: [],
        other: []
      };

      profiles.forEach(profile => {
        if (!profile) return;
        const team = profile.team || 'other';
        if (byTeam[team]) {
          byTeam[team]?.push(profile);
        } else {
          byTeam.other?.push(profile);
        }
      });

      // Filter by team if specified
      const teamsToShow = argv.byTeam
        ? [argv.byTeam]
        : ['core', 'engineering', 'business', 'design', 'research', 'other'];

      const teamNames: Record<string, string> = {
        core: 'Core Team',
        engineering: 'Engineering Team',
        business: 'Business Team',
        design: 'Design Team',
        research: 'Research Team',
        other: 'Other'
      };

      // Display by team
      for (const team of teamsToShow) {
        const teamAgents = byTeam[team];
        if (teamAgents && teamAgents.length > 0) {
          console.log(chalk.cyan.bold(`${teamNames[team]} (${teamAgents.length}):`));

          teamAgents.forEach(profile => {
            if (!profile) return;
            const displayName = profile.displayName ? ` (${profile.displayName})` : '';
            const role = profile.role ? chalk.gray(` - ${profile.role}`) : '';
            console.log(chalk.white(`  ${profile.name}${displayName}${role}`));
          });

          console.log();
        }
      }

      console.log(chalk.gray('Usage: ax agent show <name> for details\n'));

    } catch (error) {
      console.error(chalk.red.bold('\n✗ Error listing agents\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};
