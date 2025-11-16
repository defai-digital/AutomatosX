/**
 * Init Command - Initialize ax.md project context file
 *
 * @since v7.1.0
 */

import type { CommandModule } from 'yargs';
import { writeFile, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join, basename } from 'path';
import chalk from 'chalk';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
import {
  getTemplate,
  generateYamlTemplate,
  type TemplateContext
} from '../templates/ax-md-templates.js';

interface InitOptions {
  template?: 'minimal' | 'standard' | 'comprehensive';
  name?: string;
  description?: string;
  agents?: string[];
  yaml?: boolean;
  force?: boolean;
  analyze?: boolean; // NEW: AI-powered auto-analysis
}

export const initCommand: CommandModule<Record<string, unknown>, InitOptions> = {
  command: 'init',
  describe: 'Initialize ax.md project context file',

  builder: (yargs) => {
    return yargs
      .option('template', {
        alias: 't',
        describe: 'Template to use',
        type: 'string',
        choices: ['minimal', 'standard', 'comprehensive'],
        default: 'comprehensive'
      })
      .option('name', {
        alias: 'n',
        describe: 'Project name (defaults to directory name)',
        type: 'string'
      })
      .option('description', {
        alias: 'd',
        describe: 'Project description',
        type: 'string'
      })
      .option('agents', {
        alias: 'a',
        describe: 'Comma-separated list of agents you use',
        type: 'string',
        coerce: (arg: string) => arg.split(',').map(s => s.trim()).filter(Boolean)
      })
      .option('yaml', {
        alias: 'y',
        describe: 'Also create ax.config.yml (advanced)',
        type: 'boolean',
        default: false
      })
      .option('force', {
        alias: 'f',
        describe: 'Overwrite existing ax.md',
        type: 'boolean',
        default: false
      })
      .option('analyze', {
        describe: 'AI-powered auto-analysis of project structure (uses backend agent)',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 init', 'Create ax.md with comprehensive template (default)'],
        ['$0 init -t minimal', 'Create minimal ax.md'],
        ['$0 init -t standard', 'Create standard ax.md'],
        ['$0 init --yaml', 'Create comprehensive ax.md + ax.config.yml'],
        ['$0 init --agents backend,frontend,security', 'Specify which agents you use'],
        ['$0 init --name "My Project" --description "A cool app"', 'Custom project info'],
        ['$0 init --analyze', 'AI auto-analyzes project and generates intelligent ax.md']
      ]);
  },

  handler: async (argv) => {
    const projectDir = process.cwd();
    const axMdPath = join(projectDir, 'ax.md');
    const axConfigYmlPath = join(projectDir, 'ax.config.yml');

    try {
      console.log(chalk.blue.bold('\n🚀 AutomatosX Project Context Setup\n'));

      // Check if ax.md already exists
      const axMdExists = await access(axMdPath, constants.F_OK).then(() => true).catch(() => false);
      if (axMdExists) {
        if (!argv.force) {
          console.log(chalk.yellow('⚠️  ax.md already exists!'));
          console.log(chalk.dim('   Use --force to overwrite\n'));
          process.exit(1);
        }
        console.log(chalk.yellow('⚠️  Overwriting existing ax.md\n'));
      }

      // Handle AI-powered analysis mode
      if (argv.analyze) {
        console.log(chalk.cyan('🤖 AI-Powered Analysis Mode\n'));
        console.log(chalk.white('   Using backend agent to analyze your project...'));
        console.log(chalk.dim('   This will take 1-2 minutes\n'));

        // Dynamic import to avoid circular dependencies
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify((await import('child_process')).execFile);

        try {
          // Run backend agent to analyze project
          const analysisTask = `Analyze this project and create a comprehensive ax.md file:

1. **Auto-analyze project structure**:
   - Scan package.json for project info
   - Detect tech stack
   - List key directories and their purposes
   - Identify main entry points

2. **Create intelligent ax.md** at ${axMdPath}

Include sections:
- Project Overview (auto-detected)
- Tech Stack (from package.json)
- Directory Structure (key paths)
- How to Work with This Project (use ax agents!)
- Agent Delegation Rules
- Development Workflow
- Critical Rules
- Common Commands

Make it comprehensive but scannable, similar to the AutomatosX ax.md example.`;

          // Execute ax run backend with the analysis task
          const axCommand = process.platform === 'win32' ? 'ax.cmd' : 'ax';

          console.log(chalk.dim('   Running: ax run backend "analyze project"\n'));

          // BUG #44 FIX: Remove shell execution to prevent command injection
          const child = spawn(axCommand, ['run', 'backend', analysisTask], {
            stdio: 'inherit',
            shell: false,  // SECURITY: Prevent command injection via analysis task
            cwd: projectDir
          });

          // Wait for completion
          await new Promise<void>((resolve, reject) => {
            child.on('close', (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Agent exited with code ${code}`));
              }
            });
            child.on('error', reject);
          });

          console.log(chalk.green('\n✅ AI analysis complete!'));
          console.log(chalk.dim(`   Created: ${axMdPath}\n`));

          // Success message for analyze mode
          console.log(chalk.cyan('📝 Next Steps:\n'));
          console.log(chalk.white('   1. Review the generated ax.md'));
          console.log(chalk.white('   2. Customize as needed for your team'));
          console.log(chalk.white('   3. Commit to version control\n'));

          logger.info('ax.md generated with AI analysis', {
            mode: 'analyze',
            projectName: basename(projectDir)
          });

          return; // Exit early - agent already created the file
        } catch (error) {
          console.log(chalk.yellow('\n⚠️  AI analysis failed, falling back to template mode\n'));
          logger.warn('AI analysis failed, using template fallback', { error });
          // Continue to template mode below
        }
      }

      // Determine project name
      const projectName = argv.name || basename(projectDir);

      // Build template context
      const context: TemplateContext = {
        projectName,
        projectDescription: argv.description,
        agents: argv.agents,
        testCommand: 'npm test',
        buildCommand: 'npm run build'
      };

      // Try to detect commands from package.json
      try {
        const packageJsonPath = join(projectDir, 'package.json');
        const packageJsonExists = await access(packageJsonPath, constants.F_OK).then(() => true).catch(() => false);
        if (packageJsonExists) {
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
          if (packageJson.scripts) {
            // Detect test command
            if (packageJson.scripts.test) {
              context.testCommand = 'npm test';
            } else if (packageJson.scripts['test:unit']) {
              context.testCommand = 'npm run test:unit';
            }

            // Detect build command
            if (packageJson.scripts.build) {
              context.buildCommand = 'npm run build';
            }

            // Detect deploy command
            if (packageJson.scripts.deploy) {
              context.deployCommand = 'npm run deploy';
            } else if (packageJson.scripts['deploy:staging']) {
              context.deployCommand = 'npm run deploy:staging';
            }
          }
        }
      } catch (error) {
        // Ignore - use defaults
        logger.debug('Could not read package.json', { error });
      }

      // Generate ax.md
      const template = argv.template || 'comprehensive';
      const axMdContent = getTemplate(template, context);

      await writeFile(axMdPath, axMdContent, 'utf-8');
      console.log(chalk.green('✅ Created ax.md'));
      console.log(chalk.dim(`   Template: ${template}`));
      console.log(chalk.dim(`   Location: ${axMdPath}`));

      // Generate ax.config.yml if requested
      if (argv.yaml) {
        const axConfigYmlContent = generateYamlTemplate(context);
        await writeFile(axConfigYmlPath, axConfigYmlContent, 'utf-8');
        console.log(chalk.green('\n✅ Created ax.config.yml'));
        console.log(chalk.dim(`   Location: ${axConfigYmlPath}`));
      }

      // Success message
      console.log(chalk.cyan('\n📝 Next Steps:\n'));
      console.log(chalk.white('   1. Edit ax.md to customize for your project:'));
      console.log(chalk.gray('      vim ax.md'));
      console.log(chalk.gray('      # or open in your editor\n'));

      console.log(chalk.white('   2. Use AutomatosX agents with project context:'));
      console.log(chalk.gray('      ax run backend "implement feature"'));
      console.log(chalk.gray('      # ax automatically loads context from ax.md\n'));

      console.log(chalk.white('   3. Commit ax.md to version control:'));
      console.log(chalk.gray('      git add ax.md'));
      console.log(chalk.gray('      git commit -m "Add AutomatosX project context"\n'));

      console.log(chalk.cyan('💡 Tips:\n'));
      console.log(chalk.dim('   • ax.md teaches AutomatosX how to work with your project'));
      console.log(chalk.dim('   • Update ax.md when conventions or workflows change'));
      console.log(chalk.dim('   • Share ax.md with your team for consistent AI interactions\n'));

      logger.info('ax.md initialized successfully', {
        template,
        projectName,
        agents: context.agents,
        yamlCreated: argv.yaml
      });

    } catch (error) {
      console.log(chalk.red('\n❌ Error initializing project context\n'));
      printError(error);
      process.exit(1);
    }
  }
};
