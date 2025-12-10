/**
 * Agent Create Command - Create agent from template
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { load as loadYaml } from 'js-yaml';
import chalk from 'chalk';
import { TemplateEngine, type TemplateVariables } from '../../../agents/template-engine.js';
import { PromptHelper } from '../../../shared/helpers/prompt-helper.js';
import { getPackageRoot } from '../../../shared/helpers/package-root.js';
import {
  listAvailableTemplates,
  listAvailableTeams,
  isValidAgentName,
  checkDisplayNameConflict,
  suggestValidAgentName
} from './helpers.js';

interface CreateOptions {
  agent: string;
  template?: string;
  displayName?: string;
  role?: string;
  description?: string;
  team?: string;
  interactive?: boolean;
}

/**
 * Agent template YAML structure
 */
interface AgentTemplateYaml {
  name?: string;
  role?: string;
  description?: string;
  team?: string;
  display_name?: string;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const createCommand: CommandModule<{}, CreateOptions> = {
  command: 'create <agent>',
  describe: 'Create a new agent from template',

  builder: (yargs) => {
    return yargs
      .positional('agent', {
        describe: 'Agent name (lowercase letters, numbers, and hyphens)',
        type: 'string',
        demandOption: true
      })
      .option('template', {
        describe: 'Template to use (run "ax agent templates" to see available)',
        type: 'string',
        alias: 't'
      })
      .option('display-name', {
        describe: 'Agent display name (friendly name)',
        type: 'string',
        alias: 'd'
      })
      .option('role', {
        describe: 'Agent role',
        type: 'string',
        alias: 'r'
      })
      .option('description', {
        describe: 'Agent description',
        type: 'string'
      })
      .option('team', {
        describe: 'Team name',
        type: 'string'
      })
      .option('interactive', {
        describe: 'Interactive mode (prompt for missing values)',
        type: 'boolean',
        alias: 'i',
        default: false
      });
  },

  handler: async (argv) => {
    try {
      const projectDir = process.cwd();
      const agentsDir = join(projectDir, '.automatosx', 'agents');
      const agentFile = join(agentsDir, `${argv.agent}.yaml`);

      // 1. Validate agent name format
      const nameValidation = isValidAgentName(argv.agent);
      if (!nameValidation.valid) {
        console.log(chalk.red.bold(`\n✗ Invalid agent name: ${argv.agent}\n`));
        console.log(chalk.red(nameValidation.error));
        const suggestion = suggestValidAgentName(argv.agent);
        if (suggestion !== argv.agent) {
          console.log(chalk.yellow(`\n💡 Suggested name: ${suggestion}`));
        }
        console.log(chalk.gray('\nAgent names must:'));
        console.log(chalk.gray('  • Start with a lowercase letter'));
        console.log(chalk.gray('  • Contain only lowercase letters, numbers, and hyphens'));
        console.log(chalk.gray('  • Be 2-50 characters long'));
        console.log(chalk.gray('  • Not contain consecutive hyphens\n'));
        process.exit(1);
      }

      // 2. Check if agent already exists
      if (existsSync(agentFile)) {
        console.log(chalk.red.bold(`\n✗ Agent already exists: ${argv.agent}\n`));
        console.log(chalk.gray('Use a different name or remove the existing agent first.\n'));
        process.exit(1);
      }

      // Ensure agents directory exists
      await mkdir(agentsDir, { recursive: true });

      // 3. Get template name
      let templateName = argv.template;
      if (!templateName) {
        if (argv.interactive) {
          // Interactive mode: ask user to select
          templateName = await askTemplate();
        } else {
          // Non-interactive mode: use default
          templateName = 'basic-agent';
          console.log(chalk.gray(`Using default template: ${templateName}`));
        }
      }

      // 4. Load template
      const templatePath = findTemplate(templateName);
      const templateContent = await readFile(templatePath, 'utf-8');
      const templateYaml = loadYaml(templateContent) as AgentTemplateYaml;

      // 5. Collect variables (keep undefined if not provided to allow template defaults)
      const variables: TemplateVariables = {
        AGENT_NAME: argv.agent,
        DISPLAY_NAME: argv.displayName || argv.agent,
        ROLE: argv.role,
        DESCRIPTION: argv.description,
        TEAM: argv.team
      };

      // 6. Handle missing values
      if (argv.interactive) {
        // Interactive mode: ask for missing values
        if (!variables.DISPLAY_NAME) {
          variables.DISPLAY_NAME = await ask('Display Name', argv.agent);
        }

        if (!variables.ROLE && typeof templateYaml.role === 'string' && templateYaml.role.includes('{{')) {
          variables.ROLE = await ask('Role', extractDefault(templateYaml.role) || 'AI Assistant');
        }

        if (!variables.DESCRIPTION && typeof templateYaml.description === 'string' && templateYaml.description.includes('{{')) {
          variables.DESCRIPTION = await ask(
            'Description',
            extractDefault(templateYaml.description) || 'A helpful AI assistant'
          );
        }

        if (!variables.TEAM && typeof templateYaml.team === 'string' && templateYaml.team.includes('{{')) {
          variables.TEAM = await askTeam(extractDefault(templateYaml.team) || 'core');
        }
      } else {
        // Non-interactive mode: only set required DISPLAY_NAME
        // Let template engine handle other defaults from template
        if (!variables.DISPLAY_NAME) {
          variables.DISPLAY_NAME = argv.agent;
        }
      }

      // 7. Check displayName conflicts
      if (variables.DISPLAY_NAME) {
        const conflict = await checkDisplayNameConflict(variables.DISPLAY_NAME);
        if (conflict) {
          console.log(chalk.red.bold(`\n✗ DisplayName conflict: "${variables.DISPLAY_NAME}" is already used by agent "${conflict}"\n`));
          console.log(chalk.gray('Please choose a different displayName.\n'));
          process.exit(1);
        }
      }

      // 8. Render template
      const engine = new TemplateEngine();
      const rendered = engine.render(templateContent, variables);

      // 9. Write agent file
      await writeFile(agentFile, rendered, 'utf-8');

      // 10. Success message
      console.log(chalk.green.bold(`\n✓ Agent '${argv.agent}' created successfully\n`));
      console.log(chalk.white(`Display Name: ${chalk.cyan(variables.DISPLAY_NAME)}`));
      console.log(chalk.white(`Team:         ${chalk.cyan(variables.TEAM || 'core')}`));
      console.log(chalk.white(`Template:     ${chalk.gray(templateName)}`));
      console.log(chalk.white(`File:         ${chalk.gray(agentFile)}`));
      console.log();
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  • View details: ax agent show ' + argv.agent));
      console.log(chalk.gray('  • Run agent:    ax run ' + argv.agent + ' "your task"'));
      console.log(chalk.gray('  • Edit file:    Open ' + agentFile + ' in your editor'));
      console.log();

    } catch (error) {
      console.error(chalk.red.bold('\n✗ Error creating agent\n'));
      console.error(chalk.red((error as Error).message));
      if ((error as Error).stack) {
        console.error(chalk.gray((error as Error).stack));
      }
      process.exit(1);
    }
  }
};

/**
 * Find template file
 */
function findTemplate(name: string): string {
  // Check project templates first
  const projectTemplate = join(process.cwd(), '.automatosx', 'templates', `${name}.yaml`);
  if (existsSync(projectTemplate)) {
    return projectTemplate;
  }

  // Check default templates
  // Use getPackageRoot() to reliably find examples in both dev and bundled mode
  const packageRoot = getPackageRoot();
  const defaultTemplate = join(packageRoot, 'examples/workflows', `${name}.yaml`);
  if (existsSync(defaultTemplate)) {
    return defaultTemplate;
  }

  throw new Error(`Template not found: ${name}\nRun "ax agent templates" to see available templates.`);
}

/**
 * Ask for template selection
 */
async function askTemplate(): Promise<string> {
  const templates = await listAvailableTemplates();

  if (templates.length === 0) {
    throw new Error('No templates available. Please run "ax init" first.');
  }

  console.log(chalk.blue.bold('\n📋 Available Templates:\n'));
  templates.forEach((template, index) => {
    const desc = template.description || 'Custom template';
    console.log(chalk.white(`  ${index + 1}. ${template.name.padEnd(20)} - ${desc}`));
  });
  console.log();

  const answer = await ask(`Select template (1-${templates.length})`, '1');
  const index = parseInt(answer, 10) - 1;

  // FIXED (v6.5.11): Validate parseInt result to prevent NaN array access
  if (isNaN(index) || index < 0 || index >= templates.length) {
    console.log(chalk.yellow('\n⚠ Invalid selection, using first template'));
    return templates[0]!.name;
  }

  return templates[index]?.name ?? templates[0]!.name;
}

/**
 * Ask for team selection
 */
async function askTeam(defaultValue: string): Promise<string> {
  const teams = await listAvailableTeams();

  if (teams.length === 0) {
    throw new Error('No teams available. Please run "ax init" first.');
  }

  console.log(chalk.blue.bold('\n👥 Available Teams:\n'));
  teams.forEach((team, index) => {
    const desc = team.description || team.displayName;
    console.log(chalk.white(`  ${index + 1}. ${team.name.padEnd(12)} - ${desc}`));
  });
  console.log();

  const defaultIndex = teams.findIndex(t => t.name === defaultValue) + 1;
  const answer = await ask(`Select team (1-${teams.length})`, defaultIndex > 0 ? defaultIndex.toString() : '1');
  const index = parseInt(answer, 10) - 1;

  // FIXED (v6.5.11): Validate parseInt result to prevent NaN array access
  if (isNaN(index) || index < 0 || index >= teams.length) {
    console.log(chalk.yellow('\n⚠ Invalid selection, using default team'));
    return defaultValue || teams[0]?.name || 'core';
  }

  return teams[index]?.name ?? defaultValue ?? 'core';
}

/**
 * Extract default value from template variable
 */
function extractDefault(value: string): string | undefined {
  if (!value || !value.includes('default:')) return undefined;

  const match = value.match(/default:\s*([^}]+)/);
  return match?.[1]?.trim();
}

/**
 * Ask user for input
 * v9.0.2: Refactored to use PromptHelper for automatic cleanup
 */
async function ask(question: string, defaultValue?: string): Promise<string> {
  const prompt = new PromptHelper();
  try {
    const displayPrompt = defaultValue
      ? `${question} [${chalk.gray(defaultValue)}]: `
      : `${question}: `;

    const answer = await prompt.question(displayPrompt);
    return answer.trim() || defaultValue || '';
  } finally {
    prompt.close();
  }
}
