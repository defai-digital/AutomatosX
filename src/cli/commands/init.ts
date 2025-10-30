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
  specKit?: boolean;
  skipSpecKit?: boolean;
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
      })
      .option('spec-kit', {
        describe: 'Automatically initialize GitHub Spec-Kit for spec-driven development',
        type: 'boolean'
      })
      .option('skip-spec-kit', {
        describe: 'Skip Spec-Kit initialization (useful for CI/CD)',
        type: 'boolean'
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
      // Fix: Use USERPROFILE on Windows to avoid Git Bash path mismatch
      const homeDir = process.platform === 'win32'
        ? process.env.USERPROFILE
        : process.env.HOME;

      if (homeDir) {
        // Fix: Case-insensitive comparison on Windows
        const isSameDir = process.platform === 'win32'
          ? resolve(projectDir).toLowerCase() === resolve(homeDir).toLowerCase()
          : resolve(projectDir) === resolve(homeDir);

        if (isSameDir) {
          console.log(chalk.red('\n❌ Error: Cannot initialize AutomatosX in home directory'));

          // Fix: Platform-aware error message
          const homeDirDisplay = process.platform === 'win32'
            ? '%USERPROFILE%'
            : '~/';
          console.log(chalk.yellow(`\n⚠️  AutomatosX must be initialized in a project directory, not in ${homeDirDisplay}`));

          console.log(chalk.cyan('\n📋 Please follow these steps:\n'));
          console.log(chalk.white('   1. Create a project directory:'));
          console.log(chalk.gray('      mkdir my-project'));
          console.log(chalk.gray('      cd my-project\n'));

          console.log(chalk.white('   2. Initialize AutomatosX:'));
          console.log(chalk.gray('      ax init\n'));

          console.log(chalk.white('   3. Start using AutomatosX:'));
          console.log(chalk.gray('      ax list agents'));
          console.log(chalk.gray('      ax run <agent-name> "your task"\n'));

          // Fix: Platform-specific examples
          if (process.platform === 'win32') {
            console.log(chalk.dim('   Example (Windows):'));
            console.log(chalk.dim('      mkdir %USERPROFILE%\\projects\\my-ai-project'));
            console.log(chalk.dim('      cd %USERPROFILE%\\projects\\my-ai-project'));
            console.log(chalk.dim('      ax init\n'));
          } else {
            console.log(chalk.dim('   Example:'));
            console.log(chalk.dim('      mkdir ~/projects/my-ai-project'));
            console.log(chalk.dim('      cd ~/projects/my-ai-project'));
            console.log(chalk.dim('      ax init\n'));
          }

          process.exit(1);
        }
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
      const claudeDir = join(projectDir, '.claude');
      const claudeDirExistedBefore = await checkExists(claudeDir);
      await setupClaudeIntegration(projectDir, packageRoot);
      // Only add to rollback if we created it (not if it pre-existed)
      if (!claudeDirExistedBefore) {
        createdResources.push(claudeDir);
      }
      console.log(chalk.green('   ✓ Claude Code integration configured'));

      // Setup project CLAUDE.md with AutomatosX integration guide
      console.log(chalk.cyan('📖 Setting up CLAUDE.md with AutomatosX integration...'));
      await setupProjectClaudeMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ CLAUDE.md configured'));

      // Setup Gemini CLI integration
      console.log(chalk.cyan('🔌 Setting up Gemini CLI integration...'));
      const geminiDir = join(projectDir, '.gemini');
      const geminiDirExistedBefore = await checkExists(geminiDir);
      await setupGeminiIntegration(projectDir, packageRoot);
      // Only add to rollback if we created it (not if it pre-existed)
      if (!geminiDirExistedBefore) {
        createdResources.push(geminiDir);
      }
      console.log(chalk.green('   ✓ Gemini CLI integration configured'));

      // Setup project GEMINI.md with AutomatosX integration guide
      console.log(chalk.cyan('📖 Setting up GEMINI.md with AutomatosX integration...'));
      await setupProjectGeminiMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ GEMINI.md configured'));

      // Setup project CODEX.md with AutomatosX integration guide
      console.log(chalk.cyan('📖 Setting up CODEX.md with AutomatosX integration...'));
      await setupProjectCodexMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ CODEX.md configured'));

      // Create workspace directories for organized file management
      console.log(chalk.cyan('📂 Creating workspace directories...'));
      await createWorkspaceDirectories(projectDir);
      console.log(chalk.green('   ✓ Workspace directories created'));

      // Initialize git repository if needed (for Codex CLI compatibility)
      console.log(chalk.cyan('🔧 Initializing git repository...'));
      await initializeGitRepository(projectDir);
      console.log(chalk.green('   ✓ Git repository initialized'));

      // Create .gitignore entry
      console.log(chalk.cyan('📝 Updating .gitignore...'));
      await updateGitignore(projectDir);
      console.log(chalk.green('   ✓ .gitignore updated'));

      // Initialize Spec-Kit (optional, interactive or via flags)
      const specKitInitialized = await maybeInitializeSpecKit(projectDir, argv);

      // Success message
      console.log(chalk.green.bold('\n✅ AutomatosX initialized successfully!\n'));
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Review automatosx.config.json'));
      console.log(chalk.gray('  2. List agents: automatosx list agents'));
      console.log(chalk.gray('  3. Run an agent: automatosx run backend "Hello!"\n'));

      if (specKitInitialized) {
        console.log(chalk.cyan('Spec-Driven Development:'));
        console.log(chalk.gray('  • Spec files created in .specify/'));
        console.log(chalk.gray('  • Use agents to work with specs:'));
        console.log(chalk.gray('    ax run product "Write spec for feature X"'));
        console.log(chalk.gray('    ax run tony "Create technical plan"'));
        console.log(chalk.gray('    ax run backend "Implement according to spec"\n'));
      } else {
        console.log(chalk.cyan('Spec-Driven Development (optional):'));
        console.log(chalk.gray('  • Initialize with: ax init --spec-kit\n'));
      }
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
      console.log(chalk.cyan('Gemini CLI Integration:'));
      console.log(chalk.gray('  • Use /ax command in Gemini CLI'));
      console.log(chalk.gray('  • Example: /ax backend, create a REST API'));
      console.log(chalk.gray('  • Custom commands available in .gemini/commands/\n'));
      console.log(chalk.cyan('OpenAI Codex Provider:'));
      console.log(chalk.gray('  • Configured as AI provider (priority 1)'));
      console.log(chalk.gray('  • Use terminal: ax run <agent> "task"'));
      console.log(chalk.gray('  • Git repository initialized for Codex compatibility'));
      console.log(chalk.gray('  • See examples/codex/ for integration details\n'));

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

/**
 * Maybe initialize GitHub Spec-Kit for spec-driven development
 *
 * This function handles the optional initialization of Spec-Kit based on:
 * 1. --spec-kit flag: automatically initialize
 * 2. --skip-spec-kit flag: skip initialization
 * 3. Interactive prompt (if TTY): ask user
 * 4. Non-interactive: skip by default
 *
 * @param projectDir - Project directory path
 * @param argv - Command line arguments
 * @returns Promise<boolean> - true if Spec-Kit was initialized, false otherwise
 */
async function maybeInitializeSpecKit(
  projectDir: string,
  argv: InitOptions
): Promise<boolean> {
  const specifyDir = join(projectDir, '.specify');

  // Skip if .specify/ already exists
  const specifyExists = await checkExists(specifyDir);
  if (specifyExists) {
    logger.info('Spec-Kit directory already exists, skipping initialization', {
      path: specifyDir
    });
    return true; // Consider it "initialized"
  }

  // Skip if --skip-spec-kit flag is set
  if (argv.skipSpecKit) {
    logger.info('Skipping Spec-Kit initialization (--skip-spec-kit flag)');
    return false;
  }

  // Auto-initialize if --spec-kit flag is set
  if (argv.specKit) {
    console.log(chalk.cyan('\n📋 Initializing GitHub Spec-Kit...'));
    return await initializeSpecKit(projectDir);
  }

  // Interactive prompt if running in TTY
  if (process.stdout.isTTY && process.stdin.isTTY) {
    console.log(chalk.cyan('\n📋 GitHub Spec-Kit Integration'));
    console.log(chalk.gray('   Spec-Kit enables spec-driven development workflows.'));
    console.log(chalk.gray('   It creates .specify/ directory with spec.md, plan.md, and tasks.md'));
    console.log(chalk.gray('   for structured planning and task management.\n'));

    try {
      const readline = await import('readline/promises');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await rl.question(
        chalk.cyan('   Initialize Spec-Kit now? (y/N): ')
      );
      rl.close();

      const shouldInit = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

      if (shouldInit) {
        console.log(chalk.cyan('\n   Initializing Spec-Kit...'));
        return await initializeSpecKit(projectDir);
      } else {
        logger.info('User declined Spec-Kit initialization');
        return false;
      }
    } catch (error) {
      // Error in interactive prompt, skip initialization
      logger.warn('Failed to prompt for Spec-Kit initialization', {
        error: (error as Error).message
      });
      return false;
    }
  }

  // Non-interactive mode: skip by default
  logger.info('Non-interactive mode, skipping Spec-Kit initialization');
  return false;
}

/**
 * Initialize Spec-Kit in the project directory
 *
 * Creates .specify/ directory with template files for spec-driven development
 *
 * @param projectDir - Project directory path
 * @returns Promise<boolean> - true if initialization succeeded, false otherwise
 */
async function initializeSpecKit(projectDir: string): Promise<boolean> {
  try {
    const specifyDir = join(projectDir, '.specify');

    // Create .specify directory
    await mkdir(specifyDir, { recursive: true });

    // Create spec.md template
    const specTemplate = `# Project Specification

## Overview
<!-- Brief description of what this project does -->

## Goals
<!-- List the main goals and objectives -->

## Requirements
<!-- Detailed requirements -->

### Functional Requirements
<!-- What the system should do -->

### Non-Functional Requirements
<!-- Performance, security, scalability, etc. -->

## Success Criteria
<!-- How do we measure success? -->

## Out of Scope
<!-- What this project explicitly does NOT include -->
`;

    // Create plan.md template
    const planTemplate = `# Technical Plan

## Architecture
<!-- High-level architecture diagram or description -->

## Technology Stack
<!-- Languages, frameworks, libraries, tools -->

## Implementation Approach
<!-- Step-by-step approach to implementation -->

## Data Model
<!-- Database schema, data structures -->

## API Design
<!-- API endpoints, interfaces -->

## Security Considerations
<!-- Authentication, authorization, data protection -->

## Testing Strategy
<!-- Unit tests, integration tests, E2E tests -->

## Deployment Plan
<!-- How will this be deployed? -->

## Risks and Mitigations
<!-- Potential risks and how to handle them -->
`;

    // Create tasks.md template
    const tasksTemplate = `# Tasks

<!-- Task format: - [ ] id:task-id ops:"command" dep:dependency-id -->
<!-- Example: -->
<!-- - [ ] id:setup:env ops:"ax run devops 'Setup development environment'" -->
<!-- - [ ] id:impl:api ops:"ax run backend 'Implement REST API'" dep:setup:env -->
<!-- - [ ] id:test:api ops:"ax run quality 'Write API tests'" dep:impl:api -->

## Phase 1: Setup
- [ ] id:setup:env ops:"ax run devops 'Setup development environment'"
- [ ] id:setup:db ops:"ax run backend 'Setup database schema'" dep:setup:env

## Phase 2: Implementation
- [ ] id:impl:core ops:"ax run backend 'Implement core functionality'" dep:setup:db

## Phase 3: Testing
- [ ] id:test:unit ops:"ax run quality 'Write unit tests'" dep:impl:core
- [ ] id:test:integration ops:"ax run quality 'Write integration tests'" dep:impl:core

## Phase 4: Documentation
- [ ] id:docs:api ops:"ax run writer 'Write API documentation'" dep:impl:core
`;

    // Write template files
    await writeFile(join(specifyDir, 'spec.md'), specTemplate, 'utf8');
    await writeFile(join(specifyDir, 'plan.md'), planTemplate, 'utf8');
    await writeFile(join(specifyDir, 'tasks.md'), tasksTemplate, 'utf8');

    console.log(chalk.green('   ✓ Spec-Kit initialized successfully'));
    console.log(chalk.gray('      Files created: .specify/spec.md, plan.md, tasks.md'));
    logger.info('Spec-Kit initialized successfully', {
      projectDir,
      specifyDir
    });
    return true;

  } catch (error) {
    // Non-critical error - log warning but don't fail the init
    const errorMessage = (error as Error).message;
    console.log(chalk.yellow('   ⚠️  Failed to initialize Spec-Kit'));
    console.log(chalk.gray(`      ${errorMessage}\n`));

    logger.warn('Spec-Kit initialization failed (non-critical)', {
      error: errorMessage,
      projectDir
    });

    return false;
  }
}

/**
 * Setup Gemini CLI integration files
 */
async function setupGeminiIntegration(projectDir: string, packageRoot: string): Promise<void> {
  const examplesBaseDir = join(packageRoot, 'examples/gemini');

  // Create .gemini directory structure
  const geminiDir = join(projectDir, '.gemini');
  const commandsDir = join(geminiDir, 'commands');

  await mkdir(commandsDir, { recursive: true });

  // Copy slash commands (.toml files)
  const commandsSourceDir = join(examplesBaseDir, 'commands');
  const commandFiles = await readdir(commandsSourceDir);
  for (const file of commandFiles) {
    if (file.endsWith('.toml')) {
      await copyFile(join(commandsSourceDir, file), join(commandsDir, file));
    }
  }
}

/**
 * Setup project GEMINI.md with AutomatosX integration guide
 *
 * This function creates or updates the project's GEMINI.md file to include
 * AutomatosX integration instructions, helping Gemini CLI users understand how to
 * work with AutomatosX agents in this project.
 */
async function setupProjectGeminiMd(
  projectDir: string,
  packageRoot: string,
  force: boolean
): Promise<void> {
  const geminiMdPath = join(projectDir, 'GEMINI.md');
  const templatePath = join(packageRoot, 'examples/gemini/GEMINI_INTEGRATION.md');

  try {
    // Read the template
    const { readFile } = await import('fs/promises');
    const template = await readFile(templatePath, 'utf-8');

    const exists = await checkExists(geminiMdPath);

    if (!exists) {
      // Create new GEMINI.md with AutomatosX integration
      const content = [
        '# GEMINI.md',
        '',
        'This file provides guidance to Gemini CLI users when working with code in this repository.',
        '',
        '---',
        '',
        template
      ].join('\n');

      await writeFile(geminiMdPath, content, 'utf-8');
      logger.info('Created GEMINI.md with AutomatosX integration', { path: geminiMdPath });
    } else {
      // Update existing GEMINI.md
      const existingContent = await readFile(geminiMdPath, 'utf-8');

      // Check if AutomatosX integration already exists
      if (existingContent.includes('# AutomatosX Integration')) {
        if (!force) {
          logger.info('GEMINI.md already contains AutomatosX integration', { path: geminiMdPath });
          return;
        }
        // Force mode: replace existing AutomatosX section
        const updatedContent = replaceAutomatosXSection(existingContent, template);
        await writeFile(geminiMdPath, updatedContent, 'utf-8');
        logger.info('Updated AutomatosX integration in GEMINI.md', { path: geminiMdPath });
      } else {
        // Append AutomatosX integration to existing content
        const updatedContent = [
          existingContent.trimEnd(),
          '',
          '---',
          '',
          template
        ].join('\n');

        await writeFile(geminiMdPath, updatedContent, 'utf-8');
        logger.info('Added AutomatosX integration to existing GEMINI.md', { path: geminiMdPath });
      }
    }
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup GEMINI.md', {
      error: (error as Error).message,
      path: geminiMdPath
    });
  }
}

/**
 * Setup project CODEX.md with AutomatosX integration guide
 *
 * This function creates or updates the project's CODEX.md file to include
 * AutomatosX integration instructions, helping OpenAI Codex CLI users understand
 * how to work with AutomatosX agents in this project.
 */
async function setupProjectCodexMd(
  projectDir: string,
  packageRoot: string,
  force: boolean
): Promise<void> {
  const codexMdPath = join(projectDir, 'CODEX.md');
  const templatePath = join(packageRoot, 'examples/codex/CODEX_INTEGRATION.md');

  try {
    // Read the template
    const { readFile } = await import('fs/promises');
    const template = await readFile(templatePath, 'utf-8');

    const exists = await checkExists(codexMdPath);

    if (!exists) {
      // Create new CODEX.md with AutomatosX integration
      const content = [
        '# CODEX.md',
        '',
        'This file provides guidance to OpenAI Codex CLI users when working with code in this repository.',
        '',
        '---',
        '',
        template
      ].join('\n');

      await writeFile(codexMdPath, content, 'utf-8');
      logger.info('Created CODEX.md with AutomatosX integration', { path: codexMdPath });
    } else {
      // Update existing CODEX.md
      const existingContent = await readFile(codexMdPath, 'utf-8');

      // Check if AutomatosX integration already exists
      if (existingContent.includes('# AutomatosX Integration')) {
        if (!force) {
          logger.info('CODEX.md already contains AutomatosX integration', { path: codexMdPath });
          return;
        }
        // Force mode: replace existing AutomatosX section
        const updatedContent = replaceAutomatosXSection(existingContent, template);
        await writeFile(codexMdPath, updatedContent, 'utf-8');
        logger.info('Updated AutomatosX integration in CODEX.md', { path: codexMdPath });
      } else {
        // Append AutomatosX integration to existing content
        const updatedContent = [
          existingContent.trimEnd(),
          '',
          '---',
          '',
          template
        ].join('\n');

        await writeFile(codexMdPath, updatedContent, 'utf-8');
        logger.info('Added AutomatosX integration to existing CODEX.md', { path: codexMdPath });
      }
    }
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup CODEX.md', {
      error: (error as Error).message,
      path: codexMdPath
    });
  }
}

/**
 * Create workspace directories for organized file management
 *
 * This function creates the standard workspace directories that AutomatosX uses
 * for organizing files:
 * - automatosx/PRD/ - Product Requirements Documents and design specs
 * - automatosx/tmp/ - Temporary files and intermediate outputs
 *
 * These directories help keep projects organized and are documented in both
 * CLAUDE.md and GEMINI.md integration guides.
 */
async function createWorkspaceDirectories(projectDir: string): Promise<void> {
  const workspaceDirs = [
    join(projectDir, 'automatosx'),
    join(projectDir, 'automatosx/PRD'),
    join(projectDir, 'automatosx/tmp')
  ];

  try {
    for (const dir of workspaceDirs) {
      await mkdir(dir, { recursive: true, mode: 0o755 });
    }

    // Create README in each workspace directory to explain its purpose
    const prdReadme = `# Product Requirements Documents

This directory contains:
- Architecture designs
- Feature specifications
- Technical requirements
- Planning documents

Created by AutomatosX for organized project documentation.
`;

    const tmpReadme = `# Temporary Files

This directory contains:
- Draft code
- Test outputs
- Temporary analysis
- Intermediate work

Files here may be auto-cleaned periodically.
Created by AutomatosX for organized scratch work.
`;

    await writeFile(join(projectDir, 'automatosx/PRD/README.md'), prdReadme, 'utf-8');
    await writeFile(join(projectDir, 'automatosx/tmp/README.md'), tmpReadme, 'utf-8');

    logger.info('Workspace directories created', {
      projectDir,
      dirs: workspaceDirs
    });
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to create workspace directories', {
      error: (error as Error).message,
      projectDir
    });
  }
}
