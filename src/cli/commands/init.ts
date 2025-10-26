/**
 * Init Command - Initialize AutomatosX project
 */

import type { CommandModule } from 'yargs';
import { mkdir, writeFile, access, readdir, copyFile, rm, stat } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { constants, existsSync } from 'fs';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../types/config.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';

// Get the directory of this file for locating examples
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get package root using filesystem checks instead of string matching
 * This is more reliable and works with any directory structure
 */
function getPackageRoot(): string {
  let current = __dirname;
  const root = '/';

  while (current !== root) {
    // Check if package.json exists at this level
    if (existsSync(join(current, 'package.json'))) {
      return current;
    }
    current = dirname(current);
  }

  throw new Error('Could not find package root (no package.json found)');
}

interface InitOptions {
  force?: boolean;
  path?: string;
}

export const initCommand: CommandModule<Record<string, unknown>, InitOptions> = {
  command: 'init [path]',
  describe: 'Initialize AutomatosX in current or specified directory',

  builder: (yargs) => {
    return yargs
      .positional('path', {
        describe: 'Project directory (defaults to current directory)',
        type: 'string',
        default: '.'
      })
      .option('force', {
        alias: 'f',
        describe: 'Force initialization even if .automatosx already exists',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    const projectDir = resolve(argv.path || '.');
    const automatosxDir = join(projectDir, '.automatosx');
    const configPath = join(projectDir, 'automatosx.config.json');

    // Get version from package.json dynamically
    const packageRoot = getPackageRoot();
    let version = '5.1.2'; // fallback
    try {
      const packageJson = JSON.parse(
        await import('fs/promises').then(fs => fs.readFile(join(packageRoot, 'package.json'), 'utf-8'))
      );
      version = packageJson.version;
    } catch {
      // Use fallback version
    }

    console.log(chalk.blue.bold(`\n🤖 AutomatosX v${version} - Project Initialization\n`));

    // Track created resources for rollback
    const createdResources: string[] = [];
    let shouldRollback = false;

    try {
      // Prevent global installation (home directory)
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (homeDir && resolve(projectDir) === resolve(homeDir)) {
        console.log(chalk.red('\n❌ Error: Cannot initialize AutomatosX in home directory'));
        console.log(chalk.yellow('\n⚠️  AutomatosX must be initialized in a project directory, not in ~/'));

        console.log(chalk.cyan('\n📋 Please follow these steps:\n'));
        console.log(chalk.white('   1. Create a project directory:'));
        console.log(chalk.gray('      mkdir my-project'));
        console.log(chalk.gray('      cd my-project\n'));

        console.log(chalk.white('   2. Initialize AutomatosX:'));
        console.log(chalk.gray('      ax init\n'));

        console.log(chalk.white('   3. Start using AutomatosX:'));
        console.log(chalk.gray('      ax list agents'));
        console.log(chalk.gray('      ax run <agent-name> "your task"\n'));

        console.log(chalk.dim('   Example:'));
        console.log(chalk.dim('      mkdir ~/projects/my-ai-project'));
        console.log(chalk.dim('      cd ~/projects/my-ai-project'));
        console.log(chalk.dim('      ax init\n'));

        process.exit(1);
      }

      // Pre-flight validation
      console.log(chalk.cyan('🔍 Validating environment...'));
      await validateEnvironment(packageRoot);
      console.log(chalk.green('   ✓ Environment validation passed'));

      // Check if already initialized
      const exists = await checkExists(automatosxDir);
      if (exists && !argv.force) {
        console.log(chalk.yellow('⚠️  AutomatosX is already initialized in this directory'));
        console.log(chalk.gray(`   ${automatosxDir}`));
        console.log(chalk.gray('\n   Use --force to reinitialize\n'));
        process.exit(1);
      }

      if (exists && argv.force) {
        console.log(chalk.yellow('⚠️  Reinitializing (--force flag detected)'));
      }

      // Create directory structure
      console.log(chalk.cyan('📁 Creating directory structure...'));
      await createDirectoryStructure(automatosxDir);
      createdResources.push(automatosxDir);
      console.log(chalk.green('   ✓ Directories created'));

      // Copy example teams (NEW - Fix P0-1)
      console.log(chalk.cyan('👥 Installing team configurations...'));
      const teamCount = await copyExampleTeams(automatosxDir, packageRoot);
      console.log(chalk.green(`   ✓ ${teamCount} team configurations installed`));

      // Copy example agents
      console.log(chalk.cyan('🤖 Installing example agents...'));
      const agentCount = await copyExampleAgents(automatosxDir, packageRoot);
      console.log(chalk.green(`   ✓ ${agentCount} example agents installed`));

      // Copy example abilities
      console.log(chalk.cyan('⚡ Installing example abilities...'));
      const abilityCount = await copyExampleAbilities(automatosxDir, packageRoot);
      console.log(chalk.green(`   ✓ ${abilityCount} example abilities installed`));

      // Copy agent templates (v5.0+)
      console.log(chalk.cyan('📋 Installing agent templates...'));
      const templateCount = await copyExampleTemplates(automatosxDir, packageRoot);
      console.log(chalk.green(`   ✓ ${templateCount} agent templates installed`));

      // Create default config
      console.log(chalk.cyan('⚙️  Generating configuration...'));
      await createDefaultConfig(configPath, argv.force ?? false, version);
      createdResources.push(configPath);
      console.log(chalk.green('   ✓ Configuration created'));

      // Setup Claude Code integration
      console.log(chalk.cyan('🔌 Setting up Claude Code integration...'));
      await setupClaudeIntegration(projectDir, packageRoot);
      createdResources.push(join(projectDir, '.claude'));
      console.log(chalk.green('   ✓ Claude Code integration configured'));

      // Setup project CLAUDE.md with AutomatosX integration guide
      console.log(chalk.cyan('📖 Setting up CLAUDE.md with AutomatosX integration...'));
      await setupProjectClaudeMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ CLAUDE.md configured'));

      // Initialize git repository if needed (for Codex CLI compatibility)
      console.log(chalk.cyan('🔧 Initializing git repository...'));
      await initializeGitRepository(projectDir);
      console.log(chalk.green('   ✓ Git repository initialized'));

      // Create .gitignore entry
      console.log(chalk.cyan('📝 Updating .gitignore...'));
      await updateGitignore(projectDir);
      console.log(chalk.green('   ✓ .gitignore updated'));

      // Success message
      console.log(chalk.green.bold('\n✅ AutomatosX initialized successfully!\n'));
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Review automatosx.config.json'));
      console.log(chalk.gray('  2. List agents: automatosx list agents'));
      console.log(chalk.gray('  3. Run an agent: automatosx run backend "Hello!"\n'));
      console.log(chalk.cyan('Available example agents (19 total):'));
      console.log(chalk.gray('  • aerospace-scientist  - Astrid (Aerospace Mission Scientist)'));
      console.log(chalk.gray('  • backend             - Bob (Senior Backend Engineer)'));
      console.log(chalk.gray('  • ceo                 - Eric (Chief Executive Officer)'));
      console.log(chalk.gray('  • creative-marketer   - Candy (Creative Marketing Strategist)'));
      console.log(chalk.gray('  • cto                 - Tony (Chief Technology Officer)'));
      console.log(chalk.gray('  • data                - Daisy (Data Engineer)'));
      console.log(chalk.gray('  • data-scientist      - Dana (Data Scientist)'));
      console.log(chalk.gray('  • design              - Debbee (UX/UI Designer)'));
      console.log(chalk.gray('  • devops              - Oliver (DevOps Engineer)'));
      console.log(chalk.gray('  • frontend            - Frank (Senior Frontend Developer)'));
      console.log(chalk.gray('  • fullstack           - Felix (Fullstack Engineer)'));
      console.log(chalk.gray('  • mobile              - Maya (Mobile Engineer)'));
      console.log(chalk.gray('  • product             - Paris (Product Manager)'));
      console.log(chalk.gray('  • quality             - Queenie (QA Engineer)'));
      console.log(chalk.gray('  • quantum-engineer    - Quinn (Quantum Systems Engineer)'));
      console.log(chalk.gray('  • researcher          - Rodman (Researcher)'));
      console.log(chalk.gray('  • security            - Steve (Security Engineer)'));
      console.log(chalk.gray('  • stan                - Peter (Best Practices Expert)'));
      console.log(chalk.gray('  • writer              - Wendy (Technical Writer)\n'));
      console.log(chalk.cyan('Claude Code Integration:'));
      console.log(chalk.gray('  • Use /ax-agent command in Claude Code'));
      console.log(chalk.gray('  • Example: /ax-agent backend, create a REST API'));
      console.log(chalk.gray('  • MCP tools available in .claude/mcp/\n'));

      logger.info('AutomatosX initialized', {
        projectDir,
        automatosxDir,
        counts: { teams: teamCount, agents: agentCount, abilities: abilityCount, templates: templateCount }
      });

    } catch (error) {
      shouldRollback = true;

      // Rollback mechanism (Fix P0-2)
      if (createdResources.length > 0 && !argv.force) {
        console.log(chalk.yellow('\n⚠️  Initialization failed. Rolling back changes...'));
        await rollbackCreatedResources(createdResources);
        console.log(chalk.green('   ✓ Rollback completed'));
      }

      printError(error, {
        verbose: false,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      logger.error('Initialization failed', {
        error: (error as Error).message,
        rolledBack: shouldRollback && createdResources.length > 0
      });
      process.exit(1);
    }
  }
};

/**
 * Check if path exists
 */
async function checkExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create AutomatosX directory structure
 */
async function createDirectoryStructure(baseDir: string): Promise<void> {
  const dirs = [
    baseDir,
    join(baseDir, 'agents'),
    join(baseDir, 'teams'),
    join(baseDir, 'abilities'),
    join(baseDir, 'templates'),      // v5.0: Agent templates
    join(baseDir, 'memory'),
    join(baseDir, 'memory/exports'), // v5.1: MCP memory export directory
    join(baseDir, 'sessions'),       // v5.1: Session persistence
    // v5.2: Removed 'workspaces' - automatosx/PRD and automatosx/tmp created on-demand
    join(baseDir, 'logs')
  ];

  // v5.6.0: Use 0o755 permissions (rwxr-xr-x) for cross-platform compatibility
  // - Owner: read, write, execute
  // - Group/Others: read, execute
  // - Safe on Unix/Linux/macOS, ignored on Windows (uses ACL instead)
  // - Prevents "permission denied" errors in multi-user/provider scenarios
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true, mode: 0o755 });
  }
}

/**
 * Validate environment before initialization (Fix P2-7)
 */
async function validateEnvironment(packageRoot: string): Promise<void> {
  const requiredDirs = [
    'examples/agents',
    'examples/abilities',
    'examples/templates',
    'examples/teams'
  ];

  const errors: string[] = [];

  for (const dir of requiredDirs) {
    const fullPath = join(packageRoot, dir);
    try {
      await stat(fullPath);
    } catch {
      errors.push(`Missing required directory: ${dir}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}\n\n` +
      'This usually means the package is corrupted. Try reinstalling:\n' +
      '  npm uninstall -g @defai.digital/automatosx\n' +
      '  npm install -g @defai.digital/automatosx'
    );
  }
}

/**
 * Rollback created resources on failure (Fix P0-2)
 */
async function rollbackCreatedResources(resources: string[]): Promise<void> {
  for (const resource of resources.reverse()) {
    try {
      await rm(resource, { recursive: true, force: true });
      logger.info('Rolled back resource', { resource });
    } catch (error) {
      logger.warn('Failed to rollback resource', {
        resource,
        error: (error as Error).message
      });
    }
  }
}

/**
 * Copy example teams to user's .automatosx directory (Fix P0-1)
 */
async function copyExampleTeams(baseDir: string, packageRoot: string): Promise<number> {
  const examplesDir = join(packageRoot, 'examples/teams');
  const targetDir = join(baseDir, 'teams');

  const files = await readdir(examplesDir);
  let count = 0;

  for (const file of files) {
    if (file.endsWith('.yaml')) {
      await copyFile(join(examplesDir, file), join(targetDir, file));
      count++;
    }
  }

  if (count === 0) {
    throw new Error(`No team configuration files found in ${examplesDir}`);
  }

  return count;
}

/**
 * Copy example agents to user's .automatosx directory (Fix P0-3: Fatal errors)
 */
async function copyExampleAgents(baseDir: string, packageRoot: string): Promise<number> {
  const examplesDir = join(packageRoot, 'examples/agents');
  const targetDir = join(baseDir, 'agents');

  const files = await readdir(examplesDir);
  let count = 0;

  for (const file of files) {
    if (file.endsWith('.yaml')) {
      await copyFile(join(examplesDir, file), join(targetDir, file));
      count++;
    }
  }

  if (count === 0) {
    throw new Error(`No agent files found in ${examplesDir}`);
  }

  return count;
}

/**
 * Copy example abilities to user's .automatosx directory (Fix P0-3: Fatal errors)
 */
async function copyExampleAbilities(baseDir: string, packageRoot: string): Promise<number> {
  const examplesDir = join(packageRoot, 'examples/abilities');
  const targetDir = join(baseDir, 'abilities');

  const files = await readdir(examplesDir);
  let count = 0;

  for (const file of files) {
    if (file.endsWith('.md')) {
      await copyFile(join(examplesDir, file), join(targetDir, file));
      count++;
    }
  }

  if (count === 0) {
    throw new Error(`No ability files found in ${examplesDir}`);
  }

  return count;
}

/**
 * Copy agent templates to user's .automatosx directory (Fix P0-3: Fatal errors)
 */
async function copyExampleTemplates(baseDir: string, packageRoot: string): Promise<number> {
  const examplesDir = join(packageRoot, 'examples/templates');
  const targetDir = join(baseDir, 'templates');

  const files = await readdir(examplesDir);
  let count = 0;

  for (const file of files) {
    if (file.endsWith('.yaml')) {
      await copyFile(join(examplesDir, file), join(targetDir, file));
      count++;
    }
  }

  if (count === 0) {
    throw new Error(`No template files found in ${examplesDir}`);
  }

  return count;
}

/**
 * Create default configuration file
 */
async function createDefaultConfig(
  configPath: string,
  force: boolean,
  version: string
): Promise<void> {
  const exists = await checkExists(configPath);

  if (exists && !force) {
    return; // Don't overwrite existing config unless forced
  }

  const config = {
    ...DEFAULT_CONFIG,
    // Add metadata
    // Note: $schema removed because schema directory is not copied to user projects
    // Users should rely on IDE JSON Schema plugins that fetch from npm package
    version
  };

  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content, 'utf-8');
}

/**
 * Setup Claude Code integration files
 */
async function setupClaudeIntegration(projectDir: string, packageRoot: string): Promise<void> {
  const examplesBaseDir = join(packageRoot, 'examples/claude');

  // Create .claude directory structure
  const claudeDir = join(projectDir, '.claude');
  const commandsDir = join(claudeDir, 'commands');
  const mcpDir = join(claudeDir, 'mcp');

  await mkdir(commandsDir, { recursive: true });
  await mkdir(mcpDir, { recursive: true });

  // Copy slash command
  const commandsSourceDir = join(examplesBaseDir, 'commands');
  const commandFiles = await readdir(commandsSourceDir);
  for (const file of commandFiles) {
    if (file.endsWith('.md')) {
      await copyFile(join(commandsSourceDir, file), join(commandsDir, file));
    }
  }

  // Copy MCP configuration
  const mcpSourceDir = join(examplesBaseDir, 'mcp');
  const mcpFiles = await readdir(mcpSourceDir);
  for (const file of mcpFiles) {
    if (file.endsWith('.json')) {
      await copyFile(join(mcpSourceDir, file), join(mcpDir, file));
    }
  }
}

/**
 * Initialize git repository if needed (for Codex CLI compatibility)
 *
 * Codex CLI requires the project to be in a git repository.
 * This function checks if the directory is already a git repo and initializes if needed.
 */
async function initializeGitRepository(projectDir: string): Promise<void> {
  const gitDir = join(projectDir, '.git');

  try {
    // Check if already a git repository
    const isGitRepo = await checkExists(gitDir);

    if (isGitRepo) {
      logger.info('Git repository already exists, skipping initialization');
      return;
    }

    // Try to initialize git repository
    const { spawn } = await import('child_process');

    await new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['init'], {
        cwd: projectDir,
        stdio: 'pipe',
        shell: true // Required for Windows .cmd/.bat files
      });

      let stderr = '';

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`git init failed with code ${code}: ${stderr}`));
        } else {
          logger.info('Git repository initialized successfully');
          resolve();
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      try {
        child.stdin?.write('');
        child.stdin?.end();
      } catch (error) {
        child.kill('SIGTERM');
        reject(
          new Error(
            `Failed to write to git init stdin: ${(error as Error).message}`,
          ),
        );
        return;
      }
    });

  } catch (error) {
    // Git initialization failed - this is non-critical
    // Show warning but don't block initialization
    const errorMessage = (error as Error).message;

    if (errorMessage.includes('ENOENT') || errorMessage.includes('spawn git')) {
      console.log(chalk.yellow('   ⚠️  Git is not installed - skipping repository initialization'));
      console.log(chalk.gray('      Note: Codex CLI requires git. Install git to use Codex provider.'));
      logger.warn('Git not found, skipping repository initialization', {
        error: errorMessage
      });
    } else {
      console.log(chalk.yellow('   ⚠️  Failed to initialize git repository'));
      console.log(chalk.gray(`      ${errorMessage}`));
      logger.warn('Git initialization failed', {
        error: errorMessage
      });
    }
  }
}

/**
 * Update .gitignore with AutomatosX entries
 */
async function updateGitignore(projectDir: string): Promise<void> {
  const gitignorePath = join(projectDir, '.gitignore');

  const automatosxEntries = [
    '',
    '# AutomatosX',
    '.automatosx/memory/',
    '.automatosx/logs/',
    'automatosx/tmp/  # v5.2: Temporary files',
    'automatosx.config.json  # Optional: remove to track config',
    ''
  ].join('\n');

  try {
    const exists = await checkExists(gitignorePath);

    if (exists) {
      // Append to existing .gitignore
      const { readFile } = await import('fs/promises');
      const content = await readFile(gitignorePath, 'utf-8');

      // Check if AutomatosX entries already exist
      if (content.includes('# AutomatosX')) {
        return; // Already exists
      }

      await writeFile(gitignorePath, content + automatosxEntries, 'utf-8');
    } else {
      // Create new .gitignore
      await writeFile(gitignorePath, automatosxEntries, 'utf-8');
    }
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to update .gitignore', { error: (error as Error).message });
  }
}

/**
 * Setup project CLAUDE.md with AutomatosX integration guide
 *
 * This function creates or updates the project's CLAUDE.md file to include
 * AutomatosX integration instructions, helping Claude Code understand how to
 * work with AutomatosX agents in this project.
 */
async function setupProjectClaudeMd(
  projectDir: string,
  packageRoot: string,
  force: boolean
): Promise<void> {
  const claudeMdPath = join(projectDir, 'CLAUDE.md');
  const templatePath = join(packageRoot, 'examples/claude/CLAUDE_INTEGRATION.md');

  try {
    // Read the template
    const { readFile } = await import('fs/promises');
    const template = await readFile(templatePath, 'utf-8');

    const exists = await checkExists(claudeMdPath);

    if (!exists) {
      // Create new CLAUDE.md with AutomatosX integration
      const content = [
        '# CLAUDE.md',
        '',
        'This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.',
        '',
        '---',
        '',
        template
      ].join('\n');

      await writeFile(claudeMdPath, content, 'utf-8');
      logger.info('Created CLAUDE.md with AutomatosX integration', { path: claudeMdPath });
    } else {
      // Update existing CLAUDE.md
      const existingContent = await readFile(claudeMdPath, 'utf-8');

      // Check if AutomatosX integration already exists
      if (existingContent.includes('# AutomatosX Integration')) {
        if (!force) {
          logger.info('CLAUDE.md already contains AutomatosX integration', { path: claudeMdPath });
          return;
        }
        // Force mode: replace existing AutomatosX section
        const updatedContent = replaceAutomatosXSection(existingContent, template);
        await writeFile(claudeMdPath, updatedContent, 'utf-8');
        logger.info('Updated AutomatosX integration in CLAUDE.md', { path: claudeMdPath });
      } else {
        // Append AutomatosX integration to existing content
        const updatedContent = [
          existingContent.trimEnd(),
          '',
          '---',
          '',
          template
        ].join('\n');

        await writeFile(claudeMdPath, updatedContent, 'utf-8');
        logger.info('Added AutomatosX integration to existing CLAUDE.md', { path: claudeMdPath });
      }
    }
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup CLAUDE.md', {
      error: (error as Error).message,
      path: claudeMdPath
    });
  }
}

/**
 * Replace existing AutomatosX section in CLAUDE.md
 *
 * Finds and replaces the AutomatosX Integration section while preserving
 * other content in the file.
 */
function replaceAutomatosXSection(content: string, newSection: string): string {
  // Find the AutomatosX Integration section
  const sectionStart = content.indexOf('# AutomatosX Integration');

  if (sectionStart === -1) {
    // Section not found, append at the end
    return [
      content.trimEnd(),
      '',
      '---',
      '',
      newSection
    ].join('\n');
  }

  // Find the next major section (starts with # at beginning of line)
  // or end of file
  const afterSection = content.substring(sectionStart + 1);
  const nextSectionMatch = afterSection.match(/\n#(?!#) /);

  let sectionEnd: number;
  if (nextSectionMatch && nextSectionMatch.index !== undefined) {
    sectionEnd = sectionStart + 1 + nextSectionMatch.index;
  } else {
    sectionEnd = content.length;
  }

  // Replace the section
  const before = content.substring(0, sectionStart);
  const after = content.substring(sectionEnd);

  return [
    before.trimEnd(),
    newSection,
    after.trimStart()
  ].join('\n\n');
}
