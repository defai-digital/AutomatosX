/**
 * Agent Show Command - Show agent details
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import { ProfileLoader } from '../../../agents/profile-loader.js';
import { TeamManager } from '../../../core/team-manager.js';
import { join } from 'path';
import chalk from 'chalk';

interface ShowOptions {
  agent: string;
}

export const showCommand: CommandModule<{}, ShowOptions> = {
  command: 'show <agent>',
  describe: 'Show agent details',

  builder: (yargs) => {
    return yargs
      .positional('agent', {
        describe: 'Agent name',
        type: 'string',
        demandOption: true
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
      const resolvedName = await profileLoader.resolveAgentName(argv.agent);

      // Load profile using resolved name
      const profile = await profileLoader.loadProfile(resolvedName);

      console.log(chalk.blue.bold(`\n🤖 Agent: ${profile.name}\n`));

      // Basic info
      if (profile.displayName) {
        console.log(chalk.white(`Display Name: ${chalk.cyan(profile.displayName)}`));
      }
      if (profile.team) {
        console.log(chalk.white(`Team:         ${chalk.cyan(profile.team)}`));
      }
      if (profile.role) {
        console.log(chalk.white(`Role:         ${chalk.gray(profile.role)}`));
      }
      if (profile.description) {
        console.log(chalk.white(`Description:  ${chalk.gray(profile.description)}`));
      }

      console.log();

      // Abilities
      if (profile.abilities && profile.abilities.length > 0) {
        console.log(chalk.cyan.bold('Abilities:'));
        profile.abilities.forEach(ability => {
          console.log(chalk.white(`  • ${ability}`));
        });
        console.log();
      }

      // Configuration
      console.log(chalk.cyan.bold('Configuration:'));
      if (profile.provider) {
        console.log(chalk.white(`  Provider:    ${profile.provider}`));
      }
      if (profile.model) {
        console.log(chalk.white(`  Model:       ${profile.model}`));
      }
      if (profile.temperature !== undefined) {
        console.log(chalk.white(`  Temperature: ${profile.temperature}`));
      }
      if (profile.maxTokens !== undefined) {
        console.log(chalk.white(`  Max Tokens:  ${profile.maxTokens}`));
      }
      console.log();

      // Orchestration
      if (profile.orchestration) {
        console.log(chalk.cyan.bold('Orchestration:'));

        const orch = profile.orchestration;

        if (orch.maxDelegationDepth !== undefined) {
          console.log(chalk.white(`  Max Delegation Depth: ${orch.maxDelegationDepth}`));
        }

        // v5.2: Workspace permission fields removed
        // All agents now have equal access to automatosx/PRD and automatosx/tmp

        console.log();
      }

      // File location
      const filePath = join(agentsDir, `${argv.agent}.yaml`);
      console.log(chalk.gray(`File: ${filePath}`));
      console.log();

    } catch (error) {
      console.error(chalk.red.bold(`\n✗ Agent not found: ${argv.agent}\n`));
      console.error(chalk.red((error as Error).message));

      // Try to suggest similar agents
      try {
        const projectDir = process.cwd();
        const agentsDir = join(projectDir, '.automatosx', 'agents');
        const teamsDir = join(projectDir, '.automatosx', 'teams');
        const teamManager = new TeamManager(teamsDir);
        const profileLoader = new ProfileLoader(agentsDir, undefined, teamManager);

        const suggestions = await profileLoader.findSimilarAgents(argv.agent, 3);
        const closeSuggestions = suggestions.filter(s => s.distance <= 3);

        if (closeSuggestions.length > 0) {
          console.log(chalk.yellow('\n💡 Did you mean:\n'));
          closeSuggestions.forEach((s, i) => {
            const displayInfo = s.displayName ? `${s.displayName} (${s.name})` : s.name;
            const roleInfo = s.role ? ` - ${s.role}` : '';
            console.log(chalk.cyan(`  ${i + 1}. ${displayInfo}${roleInfo}`));
          });
          console.log();
        } else {
          console.log(chalk.gray('\nRun "ax agent list" to see available agents.\n'));
        }
      } catch {
        console.log(chalk.gray('\nRun "ax agent list" to see available agents.\n'));
      }

      process.exit(1);
    }
  }
};
