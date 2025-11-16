/**
 * List Command - List agents, teams, abilities, and templates
 * Phase 3: Advanced Features - Week 3
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileLoader } from '../../agents/ProfileLoader.js';
import { TeamManager } from '../../agents/TeamManager.js';
import { AbilitiesManager } from '../../agents/AbilitiesManager.js';
import { printError } from '../../utils/error-formatter.js';
import {
  handleOutputFormat,
  showEmptyMessage,
  showSectionHeader,
  showSectionFooter,
  type OutputFormat
} from '../../utils/cli-formatters.js';
import { listFilesWithExtensions } from '../../utils/file-helpers.js';
import { join } from 'path';

interface ListOptions {
  format?: 'table' | 'json' | 'list';
}

/**
 * Agent info with error flag for failed loads
 */
type AgentInfo = {
  name: string;
  displayName?: string;
  role: string;
  description: string;
  team?: string;
  abilities: number;
};

type AgentInfoError = {
  name: string;
  error: true;
};

type AgentInfoOrError = AgentInfo | AgentInfoError;

function isAgentInfoError(info: AgentInfoOrError): info is AgentInfoError {
  return 'error' in info;
}

/**
 * List agents
 */
async function listAgents(options: ListOptions): Promise<void> {
  try {
    const loader = new ProfileLoader();
    const agentNames = await loader.listAgents();

    if (agentNames.length === 0) {
      showEmptyMessage('agents', 'ax setup');
      return;
    }

    // Handle JSON/list formats
    await handleOutputFormat(agentNames, options.format as OutputFormat, async () => {
      // Table format (default) - load agent info in parallel
      showSectionHeader('🤖 Available Agents');

      const infoPromises = agentNames.map(async (agentName): Promise<AgentInfoOrError> => {
        try {
          return await loader.getAgentInfo(agentName);
        } catch (error) {
          return { name: agentName, error: true };
        }
      });

      const agentInfos = await Promise.all(infoPromises);

      for (const info of agentInfos) {
        if (isAgentInfoError(info)) {
          console.log(chalk.red(`\n${info.name} (error loading)`));
          continue;
        }

        // Type narrowed: info is AgentInfo
        console.log(chalk.cyan(`\n${info.displayName || info.name}`));
        console.log(chalk.gray(`  Name: ${info.name}`));
        console.log(chalk.gray(`  Role: ${info.role}`));
        console.log(chalk.gray(`  Abilities: ${info.abilities}`));
        if (info.team) {
          console.log(chalk.gray(`  Team: ${info.team}`));
        }
      }

      showSectionFooter(agentNames.length, 'agents');
    });
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

/**
 * List teams
 */
async function listTeams(options: ListOptions): Promise<void> {
  try {
    const teamManager = new TeamManager();
    const teams = await teamManager.listTeams();

    if (teams.length === 0) {
      showEmptyMessage('teams', 'ax setup');
      return;
    }

    await handleOutputFormat(teams, options.format as OutputFormat, () => {
      console.log(chalk.bold('\n👥 Available Teams\n'));
      teams.forEach(team => console.log(chalk.cyan(`  - ${team}`)));
      console.log(chalk.gray(`\nTotal: ${teams.length} teams\n`));
    });
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

/**
 * List abilities
 */
async function listAbilities(options: ListOptions): Promise<void> {
  try {
    const abilitiesManager = new AbilitiesManager();
    const abilities = await abilitiesManager.listAbilities();

    if (abilities.length === 0) {
      showEmptyMessage('abilities', 'ax setup');
      return;
    }

    await handleOutputFormat(abilities, options.format as OutputFormat, () => {
      console.log(chalk.bold('\n⚡ Available Abilities\n'));
      abilities.forEach(ability => console.log(chalk.cyan(`  - ${ability}`)));
      console.log(chalk.gray(`\nTotal: ${abilities.length} abilities\n`));
    });
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

/**
 * List templates
 */
async function listTemplates(options: ListOptions): Promise<void> {
  try {
    const templatesDir = join(process.cwd(), '.automatosx', 'templates');
    const templates = await listFilesWithExtensions(templatesDir, ['yaml', 'yml']);

    if (templates.length === 0) {
      showEmptyMessage('templates', 'ax setup');
      return;
    }

    await handleOutputFormat(templates, options.format as OutputFormat, () => {
      console.log(chalk.bold('\n📋 Available Templates\n'));
      templates.forEach(template => console.log(chalk.cyan(`  - ${template}`)));
      console.log(chalk.gray(`\nTotal: ${templates.length} templates\n`));
    });
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

/**
 * Create list command
 */
export function createListCommand(): Command {
  const listCommand = new Command('list')
    .description('List agents, teams, abilities, or templates');

  listCommand
    .command('agents')
    .description('List all available agents')
    .option('-f, --format <format>', 'Output format (table, json, list)', 'table')
    .action(listAgents);

  listCommand
    .command('teams')
    .description('List all available teams')
    .option('-f, --format <format>', 'Output format (table, json, list)', 'table')
    .action(listTeams);

  listCommand
    .command('abilities')
    .description('List all available abilities')
    .option('-f, --format <format>', 'Output format (table, json, list)', 'table')
    .action(listAbilities);

  listCommand
    .command('templates')
    .description('List all available templates')
    .option('-f, --format <format>', 'Output format (table, json, list)', 'table')
    .action(listTemplates);

  return listCommand;
}
