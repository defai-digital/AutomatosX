/**
 * Agent Templates Command - List available agent templates
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface TemplateInfo {
  name: string;
  team: string;
  description: string;
}

const TEMPLATE_DESCRIPTIONS: Record<string, TemplateInfo> = {
  'basic-agent': {
    name: 'basic-agent',
    team: 'core',
    description: 'Basic agent with minimal configuration'
  },
  'developer': {
    name: 'developer',
    team: 'engineering',
    description: 'Software developer (code generation, review, testing)'
  },
  'analyst': {
    name: 'analyst',
    team: 'business',
    description: 'Business analyst (requirements, user stories, strategy)'
  },
  'designer': {
    name: 'designer',
    team: 'design',
    description: 'UI/UX designer (interface design, user experience)'
  },
  'qa-specialist': {
    name: 'qa-specialist',
    team: 'core',
    description: 'QA specialist (test planning, automation, quality)'
  }
};

export const templatesCommand: CommandModule = {
  command: 'templates',
  describe: 'List available agent templates',

  handler: async () => {
    try {
      console.log(chalk.blue.bold('\n📋 Available Agent Templates\n'));

      // Check for templates in project directory first
      const projectTemplatesDir = join(process.cwd(), '.automatosx', 'templates');
      const hasProjectTemplates = existsSync(projectTemplatesDir);

      // Default templates location (package examples)
      // After bundling, __dirname is dist/, so go up 1 level to project root
      const defaultTemplatesDir = join(__dirname, '../examples/templates');
      const hasDefaultTemplates = existsSync(defaultTemplatesDir);

      if (!hasProjectTemplates && !hasDefaultTemplates) {
        console.log(chalk.yellow('⚠ No templates found.'));
        console.log(chalk.gray('\nRun "ax init" to set up default templates.\n'));
        return;
      }

      // Use project templates if available, otherwise use defaults
      const templatesDir = hasProjectTemplates ? projectTemplatesDir : defaultTemplatesDir;
      const templateSource = hasProjectTemplates ? 'Project' : 'Default';

      const files = await readdir(templatesDir);
      const templates = files
        .filter(f => f.endsWith('.yaml'))
        .map(f => f.replace('.yaml', ''));

      if (templates.length === 0) {
        console.log(chalk.yellow('⚠ No templates found.\n'));
        return;
      }

      console.log(chalk.gray(`Source: ${templateSource} (${templatesDir})\n`));

      // Group by team
      const byTeam: Record<string, TemplateInfo[]> = {
        core: [],
        engineering: [],
        business: [],
        design: []
      };

      templates.forEach(template => {
        const info = TEMPLATE_DESCRIPTIONS[template] || {
          name: template,
          team: 'core',
          description: 'Custom template'
        };
        byTeam[info.team]?.push(info);
      });

      // Display by team
      const teamNames = {
        core: 'Core Team',
        engineering: 'Engineering Team',
        business: 'Business Team',
        design: 'Design Team'
      };

      for (const [team, name] of Object.entries(teamNames)) {
        const teamTemplates = byTeam[team];
        if (teamTemplates && teamTemplates.length > 0) {
          console.log(chalk.cyan.bold(`${name}:`));
          teamTemplates.forEach(t => {
            console.log(chalk.white(`  ${t.name.padEnd(20)} - ${t.description}`));
          });
          console.log();
        }
      }

      console.log(chalk.gray('Usage: ax agent create <name> --template <template-name>\n'));

    } catch (error) {
      console.error(chalk.red.bold('\n✗ Error listing templates\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};
