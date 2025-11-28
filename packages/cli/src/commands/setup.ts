/**
 * Setup Command
 *
 * Initialize AutomatosX in the current project.
 *
 * Usage:
 *   ax setup              - Initialize with default settings
 *   ax setup --force      - Reinitialize even if already exists
 *
 * @module @ax/cli/commands/setup
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { access, mkdir, writeFile, readdir, readFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as output from '../utils/output.js';
import * as spinner from '../utils/spinner.js';

// =============================================================================
// Types
// =============================================================================

interface SetupArgs {
  force: boolean;
  json: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const AUTOMATOSX_DIR = '.automatosx';
const CONFIG_FILE = 'ax.config.json';

const DIRECTORIES = ['agents', 'memory', 'sessions', 'abilities', 'teams', 'templates'];

const DEFAULT_CONFIG = {
  $schema: 'https://automatosx.dev/schema/config.json',
  version: '11.0.0',
  providers: {
    default: 'ax-cli',
    fallbackOrder: ['ax-cli'],
  },
  router: {
    healthCheckInterval: 30000,
    preferMcp: true,
    routingStrategy: 'capability-first',
  },
  execution: {
    timeout: 1500000,
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
    streaming: true,
  },
  memory: {
    maxEntries: 10000,
    autoCleanup: true,
    cleanupStrategy: 'lru',
    retentionDays: 90,
  },
  agents: {
    defaultAgent: 'standard',
    maxDelegationDepth: 3,
    enableAutoSelection: true,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findPackageAgents(): Promise<string | null> {
  // Try to find the agents directory in the installed package
  // This searches common locations where the package might be installed

  const searchPaths = [
    // Development: relative to CLI source
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.automatosx', 'agents'),
    // Installed: in node_modules
    join(process.cwd(), 'node_modules', '@ax', 'cli', 'agents'),
    // Global install
    join(dirname(fileURLToPath(import.meta.url)), '..', 'agents'),
  ];

  for (const searchPath of searchPaths) {
    if (await directoryExists(searchPath)) {
      return searchPath;
    }
  }

  return null;
}

async function copyAgents(sourcePath: string, targetPath: string): Promise<number> {
  const files = await readdir(sourcePath);
  const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of yamlFiles) {
    await copyFile(join(sourcePath, file), join(targetPath, file));
  }

  return yamlFiles.length;
}

async function createMinimalAgents(targetPath: string): Promise<number> {
  // Create a minimal standard agent if we can't find the package agents
  const standardAgent = `# Standard Agent
# A general-purpose agent for handling diverse tasks

name: standard
displayName: Standard Agent
role: General Purpose Assistant
team: default
description: A versatile agent capable of handling a wide variety of tasks including research, analysis, coding assistance, and general problem-solving.

abilities:
  - general-assistance
  - research
  - analysis
  - code-review
  - documentation

personality:
  traits:
    - helpful
    - thorough
    - adaptable
  communicationStyle: technical
  decisionMaking: analytical

orchestration:
  maxDelegationDepth: 2
  canWriteToShared: true
  canDelegateTo:
    - backend
    - frontend
    - security
    - quality
  priority: 5

systemPrompt: |
  You are a Standard Agent, a versatile AI assistant capable of handling diverse tasks.

  Your capabilities include:
  - Research and analysis
  - Code review and assistance
  - Documentation writing
  - General problem-solving
  - Task coordination

  When you receive a task:
  1. Analyze what type of task it is
  2. Determine if you can handle it or should delegate
  3. Execute the task thoroughly
  4. Provide clear, actionable output

  If a task would be better handled by a specialist agent, suggest delegation.

enabled: true
version: "1.0.0"
`;

  await writeFile(join(targetPath, 'standard.yaml'), standardAgent);
  return 1;
}

// =============================================================================
// Setup Command
// =============================================================================

export const setupCommand: CommandModule<object, SetupArgs> = {
  command: 'setup',
  describe: 'Initialize AutomatosX in your project',

  builder: (yargs) =>
    yargs
      .option('force', {
        alias: 'f',
        describe: 'Overwrite existing configuration',
        type: 'boolean',
        default: false,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<SetupArgs>) => {
    const { force, json } = argv;
    const basePath = join(process.cwd(), AUTOMATOSX_DIR);

    const result = {
      success: false,
      basePath,
      configPath: join(process.cwd(), CONFIG_FILE),
      directories: [] as string[],
      agentsCopied: 0,
      messages: [] as string[],
    };

    try {
      // Check if already initialized
      const exists = await directoryExists(basePath);
      if (exists && !force) {
        if (json) {
          output.json({
            success: false,
            error: 'AutomatosX already initialized',
            suggestion: 'Use --force to reinitialize',
          });
        } else {
          output.error('AutomatosX already initialized', 'Use --force to reinitialize');
        }
        process.exit(1);
      }

      if (!json) {
        spinner.start('Setting up AutomatosX...');
      }

      // Create directories
      for (const dir of DIRECTORIES) {
        const dirPath = join(basePath, dir);
        await mkdir(dirPath, { recursive: true });
        result.directories.push(dir);

        if (!json) {
          spinner.update(`Creating ${dir} directory...`);
        }
      }

      result.messages.push(`Created ${DIRECTORIES.length} directories`);

      // Copy default agents
      if (!json) {
        spinner.update('Installing default agents...');
      }

      const agentsPath = join(basePath, 'agents');
      const sourceAgentsPath = await findPackageAgents();

      if (sourceAgentsPath) {
        result.agentsCopied = await copyAgents(sourceAgentsPath, agentsPath);
        result.messages.push(`Copied ${result.agentsCopied} agents`);
      } else {
        // Create minimal agents if we can't find the package
        result.agentsCopied = await createMinimalAgents(agentsPath);
        result.messages.push(`Created ${result.agentsCopied} minimal agent(s)`);
      }

      // Create config file
      if (!json) {
        spinner.update('Creating configuration...');
      }

      const configPath = join(process.cwd(), CONFIG_FILE);
      const configExists = await directoryExists(configPath);

      if (!configExists || force) {
        await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
        result.messages.push('Created ax.config.json');
      } else {
        result.messages.push('Config file exists, skipping');
      }

      // Create .gitignore entries suggestion
      const gitignorePath = join(process.cwd(), '.gitignore');
      const gitignoreEntries = `
# AutomatosX
.automatosx/memory/
.automatosx/sessions/
`;

      try {
        const existingGitignore = await readFile(gitignorePath, 'utf-8');
        if (!existingGitignore.includes('.automatosx/memory/')) {
          result.messages.push('Consider adding .automatosx/memory/ and .automatosx/sessions/ to .gitignore');
        }
      } catch {
        // .gitignore doesn't exist, that's fine
      }

      result.success = true;

      if (json) {
        output.json(result);
      } else {
        spinner.succeed('AutomatosX initialized successfully!');

        output.newline();
        output.section('Created Structure');
        output.keyValue('Base Path', result.basePath);
        for (const dir of result.directories) {
          output.listItem(dir);
        }

        output.newline();
        output.section('Configuration');
        output.keyValue('Config File', result.configPath);
        output.keyValue('Agents', result.agentsCopied);

        output.newline();
        output.divider();
        output.newline();
        output.info('Next Steps:');
        output.listItem('ax agent list     - See available agents');
        output.listItem('ax run backend "your task"  - Run a task');
        output.listItem('ax status         - Check system status');
        output.listItem('ax doctor         - Run diagnostics');

        if (result.agentsCopied < 5) {
          output.newline();
          output.warning('Limited agents installed. Consider copying agents from the AutomatosX repository.');
        }
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (json) {
        output.json({
          success: false,
          error: message,
        });
      } else {
        output.error('Setup failed', message);
      }

      process.exit(1);
    }
  },
};
