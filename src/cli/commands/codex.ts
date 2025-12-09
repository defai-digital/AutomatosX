/**
 * Codex CLI Command
 *
 * Manages AGENTS.md files and Codex integration.
 *
 * Commands:
 * - agents-md generate: Generate AGENTS.md
 * - agents-md validate: Validate AGENTS.md
 * - agents-md show: Display AGENTS.md
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import { generateAgentsMd, validateAgentsMd } from '../../integrations/openai-codex/agents-md-generator.js';

// ========== Types ==========

interface CodexAgentsMdGenerateArgs {
  force?: boolean;
  output?: string;
}

interface CodexAgentsMdValidateArgs {
  file?: string;
}

interface CodexAgentsMdShowArgs {
  file?: string;
}

// ========== AGENTS.md Generate Subcommand ==========

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const agentsMdGenerateCommand: CommandModule<{}, CodexAgentsMdGenerateArgs> = {
  command: 'generate',
  describe: 'Generate AGENTS.md file for project',

  builder: (yargs: Argv) => {
    return yargs
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Overwrite existing AGENTS.md',
        default: false
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output directory',
        default: process.cwd()
      })
      .example('$0 codex agents-md generate', 'Generate AGENTS.md in current directory')
      .example('$0 codex agents-md generate --force', 'Regenerate AGENTS.md (overwrite)');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.cyan.bold('\n📝 Generating AGENTS.md...\n'));

      const filePath = await generateAgentsMd({
        projectRoot: argv.output || process.cwd(),
        force: argv.force
      });

      console.log(chalk.green('✅ AGENTS.md generated successfully'));
      console.log(chalk.gray(`   Location: ${filePath}\n`));
    } catch (error) {
      logger.error('Failed to generate AGENTS.md', { error });
      console.error(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
      process.exit(1);
    }
  }
};

// ========== AGENTS.md Validate Subcommand ==========

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const agentsMdValidateCommand: CommandModule<{}, CodexAgentsMdValidateArgs> = {
  command: 'validate',
  describe: 'Validate existing AGENTS.md file',

  builder: (yargs: Argv) => {
    return yargs
      .option('file', {
        alias: 'f',
        type: 'string',
        description: 'Path to AGENTS.md',
        default: join(process.cwd(), 'AGENTS.md')
      })
      .example('$0 codex agents-md validate', 'Validate AGENTS.md in current directory')
      .example('$0 codex agents-md validate --file /path/to/AGENTS.md', 'Validate specific file');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.cyan.bold('\n🔍 Validating AGENTS.md...\n'));

      const result = await validateAgentsMd(argv.file || join(process.cwd(), 'AGENTS.md'));

      if (result.valid) {
        console.log(chalk.green('✅ AGENTS.md is valid\n'));
      } else {
        console.log(chalk.red('❌ AGENTS.md has errors:\n'));
        result.errors.forEach(error => {
          console.log(chalk.red(`   - ${error}`));
        });
        console.log();
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('⚠️  Warnings:\n'));
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`   - ${warning}`));
        });
        console.log();
      }

      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      logger.error('Failed to validate AGENTS.md', { error });
      console.error(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
      process.exit(1);
    }
  }
};

// ========== AGENTS.md Show Subcommand ==========

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const agentsMdShowCommand: CommandModule<{}, CodexAgentsMdShowArgs> = {
  command: 'show',
  describe: 'Display AGENTS.md content',

  builder: (yargs: Argv) => {
    return yargs
      .option('file', {
        alias: 'f',
        type: 'string',
        description: 'Path to AGENTS.md',
        default: join(process.cwd(), 'AGENTS.md')
      })
      .example('$0 codex agents-md show', 'Show AGENTS.md from current directory');
  },

  handler: async (argv) => {
    try {
      const filePath = argv.file || join(process.cwd(), 'AGENTS.md');
      const content = await readFile(filePath, 'utf-8');

      console.log(chalk.cyan.bold('\n📄 AGENTS.md\n'));
      console.log(content);
      console.log();
    } catch (error) {
      logger.error('Failed to read AGENTS.md', { error });
      console.error(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
      process.exit(1);
    }
  }
};

// ========== AGENTS.md Parent Command ==========

const agentsMdCommand: CommandModule = {
  command: 'agents-md <command>',
  describe: 'Manage AGENTS.md files for AI assistant integration',

  builder: (yargs: Argv) => {
    return yargs
      .command(agentsMdGenerateCommand)
      .command(agentsMdValidateCommand)
      .command(agentsMdShowCommand)
      .demandCommand(1, 'Please specify a subcommand')
      .example('$0 codex agents-md generate', 'Generate AGENTS.md')
      .example('$0 codex agents-md validate', 'Validate AGENTS.md')
      .example('$0 codex agents-md show', 'Show AGENTS.md content')
      .help();
  },

  handler: () => {
    // Handled by subcommands
  }
};

// ========== Main Codex Command ==========

export const codexCommand: CommandModule = {
  command: 'codex <command>',
  describe: 'Codex CLI integration commands',

  builder: (yargs: Argv) => {
    return yargs
      .command(agentsMdCommand)
      .demandCommand(1, 'Please specify a subcommand')
      .example('$0 codex agents-md generate', 'Generate AGENTS.md')
      .help();
  },

  handler: () => {
    // Handled by subcommands
  }
};
