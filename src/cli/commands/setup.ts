/**
  * Setup Command - Set up AutomatosX project
 */

import type { CommandModule } from 'yargs';
import { mkdir, writeFile, readFile, access, readdir, copyFile, rm, stat } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { constants, existsSync } from 'fs';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../types/config.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
import { PromptHelper } from '../../utils/prompt-helper.js';
import { ClaudeCodeSetupHelper } from '../../integrations/claude-code/setup-helper.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { TeamManager } from '../../core/team-manager.js';
import { ProviderDetector } from '../../core/provider-detector.js';

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

interface SetupOptions {
  force?: boolean;
  path?: string;
  specKit?: boolean;
  skipSpecKit?: boolean;
  claudeCode?: boolean;
}

export const setupCommand: CommandModule<Record<string, unknown>, SetupOptions> = {
  command: 'setup [path]',
  describe: 'Set up AutomatosX in current or specified directory',

  builder: (yargs) => {
    return yargs
      .positional('path', {
        describe: 'Project directory (defaults to current directory)',
        type: 'string',
        default: '.'
      })
      .option('force', {
        alias: 'f',
        describe: 'Force setup even if .automatosx already exists',
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
      })
      .option('claude-code', {
        describe: 'Setup Claude Code integration (generates manifests and registers MCP server)',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    const projectDir = resolve(argv.path || '.');
    const automatosxDir = join(projectDir, '.automatosx');
    const configPath = join(projectDir, 'ax.config.json'); // v9.2.0: Renamed from automatosx.config.json

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

    console.log(chalk.blue.bold(`\n🤖 AutomatosX v${version} - Project Setup\n`));

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
          console.log(chalk.red('\n❌ Error: Cannot set up AutomatosX in home directory'));

          // Fix: Platform-aware error message
          const homeDirDisplay = process.platform === 'win32'
            ? '%USERPROFILE%'
            : '~/';
          console.log(chalk.yellow(`\n⚠️  AutomatosX must be set up in a project directory, not in ${homeDirDisplay}`));

          console.log(chalk.cyan('\n📋 Please follow these steps:\n'));
          console.log(chalk.white('   1. Create a project directory:'));
          console.log(chalk.gray('      mkdir my-project'));
          console.log(chalk.gray('      cd my-project\n'));

          console.log(chalk.white('   2. Set up AutomatosX:'));
          console.log(chalk.gray('      ax setup\n'));

          console.log(chalk.white('   3. Start using AutomatosX:'));
          console.log(chalk.gray('      ax list agents'));
          console.log(chalk.gray('      ax run <agent-name> "your task"\n'));

          // Fix: Platform-specific examples
          if (process.platform === 'win32') {
            console.log(chalk.dim('   Example (Windows):'));
            console.log(chalk.dim('      mkdir %USERPROFILE%\\projects\\my-ai-project'));
            console.log(chalk.dim('      cd %USERPROFILE%\\projects\\my-ai-project'));
            console.log(chalk.dim('      ax setup\n'));
          } else {
            console.log(chalk.dim('   Example:'));
            console.log(chalk.dim('      mkdir ~/projects/my-ai-project'));
            console.log(chalk.dim('      cd ~/projects/my-ai-project'));
            console.log(chalk.dim('      ax setup\n'));
          }

          process.exit(1);
        }
      }

      // Pre-flight validation
      console.log(chalk.cyan('🔍 Validating environment...'));
      await validateEnvironment(packageRoot);
      console.log(chalk.green('   ✓ Environment validation passed'));

      // Detect installed AI providers
      console.log(chalk.cyan('🔍 Detecting installed AI providers...'));
      const detector = new ProviderDetector();
      const providers = await detector.detectAll();
      const foundProviders = Object.entries(providers)
        .filter(([_, installed]) => installed)
        .map(([name]) => ProviderDetector.formatProviderName(name));

      if (foundProviders.length === 0) {
        console.log(chalk.yellow('   ⚠️  No AI provider CLIs detected!'));
        console.log('');
        console.log(chalk.gray('   AutomatosX works WITH existing AI assistants.'));
        console.log(chalk.gray('   Please install one of:'));
        console.log(chalk.gray('     - Claude Code'));
        console.log(chalk.gray('     - Gemini CLI'));
        console.log(chalk.gray('     - OpenAI Codex'));
        console.log(chalk.gray('     - ax-cli (optional)'));
        console.log('');
        console.log(chalk.cyan('   💡 After installing, run "ax setup" again to configure.\n'));

        // Interactive prompt to continue or exit
        if (process.stdout.isTTY && process.stdin.isTTY) {
          const prompt = new PromptHelper();
          try {
            const answer = await prompt.question(
              chalk.cyan('   Continue setup without provider integration? (y/N): ')
            );
            const shouldContinue = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

            if (!shouldContinue) {
              prompt.close();
              process.exit(0);
            }
          } finally {
            prompt.close();
          }
        } else {
          // Non-interactive mode: continue but warn
          console.log(chalk.yellow('   ⚠️  Continuing setup without provider integration\n'));
        }
      } else {
        console.log(chalk.green(`   ✓ Found: ${foundProviders.join(', ')}`));
      }

      // Check if already initialized
      const exists = await checkExists(automatosxDir);
      if (exists && !argv.force) {
        console.log(chalk.yellow('⚠️  AutomatosX is already set up in this directory'));
        console.log(chalk.gray(`   ${automatosxDir}`));
        console.log(chalk.gray('\n   Use --force to re-run setup\n'));
        process.exit(1);
      }

      if (exists && argv.force) {
        console.log(chalk.yellow('⚠️  Re-running setup (--force flag detected)'));

        // Clean up existing installation
        console.log(chalk.cyan('🧹 Cleaning up existing installation...'));
        await cleanupForceMode(projectDir);
        console.log(chalk.green('   ✓ Cleanup completed'));
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

      // Setup Claude Code integration (ONLY if detected)
      if (providers['claude-code']) {
        console.log(chalk.cyan('🔌 Setting up Claude Code integration...'));
        const claudeDir = join(projectDir, '.claude');
        const claudeDirExistedBefore = await checkExists(claudeDir);
        await setupClaudeIntegration(projectDir, packageRoot);
        // Only add to rollback if we created it (not if it pre-existed)
        if (!claudeDirExistedBefore) {
          createdResources.push(claudeDir);
        }
        console.log(chalk.green('   ✓ Claude Code integration configured'));
      }

      // Setup ax-cli MCP integration
      console.log(chalk.cyan('🔌 Setting up ax-cli MCP integration...'));
      const axCliConfigured = await setupAxCliIntegration();
      if (axCliConfigured === 'already_configured') {
        console.log(chalk.green('   ✓ ax-cli MCP already configured'));
      } else if (axCliConfigured === 'not_installed') {
        console.log(chalk.gray('   ℹ ax-cli not installed, skipping'));
      } else if (axCliConfigured === 'manual_required') {
        console.log(chalk.yellow('   ⚠ ax-cli detected - manual MCP configuration required'));
        console.log(chalk.gray('     Run: ax-cli mcp add automatosx --transport stdio --command ax --args mcp server'));
      } else {
        console.log(chalk.green('   ✓ ax-cli MCP integration configured'));
      }

      // Setup AutomatosX-Integration.md (canonical integration guide)
      console.log(chalk.cyan('📖 Setting up AutomatosX-Integration.md (canonical guide)...'));
      await setupAutomatosXIntegrationMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ AutomatosX-Integration.md configured'));

      // Setup project CLAUDE.md with AutomatosX integration guide
      console.log(chalk.cyan('📖 Setting up CLAUDE.md with AutomatosX integration...'));
      await setupProjectClaudeMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ CLAUDE.md configured'));

      // Setup Gemini CLI integration (ONLY if detected)
      if (providers['gemini-cli']) {
        console.log(chalk.cyan('🔌 Setting up Gemini CLI integration...'));
        const geminiDir = join(projectDir, '.gemini');
        const geminiDirExistedBefore = await checkExists(geminiDir);
        await setupGeminiIntegration(projectDir, packageRoot);
        // Only add to rollback if we created it (not if it pre-existed)
        if (!geminiDirExistedBefore) {
          createdResources.push(geminiDir);
        }
        console.log(chalk.green('   ✓ Gemini CLI integration configured'));
      }

      // Setup project GEMINI.md with AutomatosX integration guide
      console.log(chalk.cyan('📖 Setting up GEMINI.md with AutomatosX integration...'));
      await setupProjectGeminiMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ GEMINI.md configured'));

      // Setup project AGENTS.md with AutomatosX integration guide (AGENTS.md standard)
      console.log(chalk.cyan('📖 Setting up AGENTS.md with AutomatosX integration...'));
      await setupProjectAgentsMd(projectDir, packageRoot, argv.force ?? false);
      console.log(chalk.green('   ✓ AGENTS.md configured'));

      // Create workspace directories for organized file management
      console.log(chalk.cyan('📂 Creating workspace directories...'));
      await createWorkspaceDirectories(projectDir);
      console.log(chalk.green('   ✓ Workspace directories created'));

      // Initialize git repository if needed (for Codex CLI compatibility)
      if (providers['codex']) {
        console.log(chalk.cyan('🔌 Setting up OpenAI Codex integration...'));
        console.log(chalk.cyan('   🔧 Initializing git repository (required by Codex)...'));
        await initializeGitRepository(projectDir);
        const codexDir = join(projectDir, '.codex');
        const codexDirExistedBefore = await checkExists(codexDir);
        await setupCodexIntegration(projectDir, packageRoot);
        // Only add to rollback if we created it (not if it pre-existed)
        if (!codexDirExistedBefore) {
          createdResources.push(codexDir);
        }
        console.log(chalk.green('   ✓ OpenAI Codex integration configured'));
      } else {
        // Still initialize git for general use, but not as a "provider integration"
        const gitDir = join(projectDir, '.git');
        const isGitRepo = await checkExists(gitDir);
        if (!isGitRepo) {
          console.log(chalk.cyan('🔧 Initializing git repository...'));
          await initializeGitRepository(projectDir);
          console.log(chalk.green('   ✓ Git repository initialized'));
        }
      }

      // Create .gitignore entry
      console.log(chalk.cyan('📝 Updating .gitignore...'));
      await updateGitignore(projectDir);
      console.log(chalk.green('   ✓ .gitignore updated'));

      // Initialize Spec-Kit (optional, interactive or via flags)
      const specKitInitialized = await maybeInitializeSpecKit(projectDir, argv);

      // Claude Code integration setup (if requested)
      let claudeCodeSetupSucceeded = false;
      if (argv.claudeCode) {
        console.log(chalk.blue('\n🔧 Setting up Claude Code integration...\n'));

        try {
          const teamManager = new TeamManager(join(automatosxDir, 'teams'));
          const profileLoader = new ProfileLoader(
            join(automatosxDir, 'agents'),
            undefined,
            teamManager
          );

          const setupHelper = new ClaudeCodeSetupHelper({
            projectDir,
            profileLoader
          });

          await setupHelper.setup();
          claudeCodeSetupSucceeded = true;
          console.log(chalk.green('   ✓ Claude Code integration configured'));
        } catch (error) {
          console.log(chalk.yellow(`   ⚠ Claude Code setup failed: ${error instanceof Error ? error.message : String(error)}`));
          console.log(chalk.gray('     You can run setup later with: ax setup --claude-code'));
        }
      }

      // Success message
      console.log(chalk.green.bold('\n✅ AutomatosX set up successfully!\n'));

      // Show configured providers
      if (foundProviders.length > 0) {
        console.log(chalk.cyan(`Configured for: ${foundProviders.join(', ')}\n`));
      } else {
        console.log(chalk.yellow('⚠️  No AI providers configured\n'));
      }

      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Review ax.config.json')); // v9.2.0: Updated config filename
      console.log(chalk.gray('  2. List agents: automatosx list agents'));
      console.log(chalk.gray('  3. Run an agent: automatosx run backend "Hello!"\n'));

      if (claudeCodeSetupSucceeded) {
        console.log(chalk.cyan('Claude Code Integration:'));
        console.log(chalk.gray('  • MCP server registered with Claude Code'));
        console.log(chalk.gray('  • Auto-generated slash commands: /agent-<name>'));
        console.log(chalk.gray('  • Skill available: /automatosx'));
        console.log(chalk.gray('  • Restart Claude Code to activate integration\n'));
      } else if (argv.claudeCode) {
        // Setup was attempted but failed
        console.log(chalk.yellow('Claude Code Integration (failed):'));
        console.log(chalk.gray('  • Run diagnostics: ax doctor --claude-code'));
        console.log(chalk.gray('  • Retry setup: ax setup --claude-code\n'));
      } else {
        // Not attempted
        console.log(chalk.cyan('Claude Code Integration (optional):'));
        console.log(chalk.gray('  • Setup with: ax setup --claude-code\n'));
      }

      if (specKitInitialized) {
        console.log(chalk.cyan('Spec-Driven Development:'));
        console.log(chalk.gray('  • Spec files created in .specify/'));
        console.log(chalk.gray('  • Use agents to work with specs:'));
        console.log(chalk.gray('    ax run product "Write spec for feature X"'));
        console.log(chalk.gray('    ax run tony "Create technical plan"'));
        console.log(chalk.gray('    ax run backend "Implement according to spec"\n'));
      } else {
        console.log(chalk.cyan('Spec-Driven Development (optional):'));
        console.log(chalk.gray('  • Initialize with: ax setup --spec-kit\n'));
      }
      console.log(chalk.cyan('Iterate Mode (Autonomous Multi-Iteration):'));
      console.log(chalk.gray('  • Enable with --iterate flag for autonomous task loops'));
      console.log(chalk.gray('  • Example: ax run quality "find bugs" --iterate --iterate-max-iterations 5'));
      console.log(chalk.gray('  • Works with any agent for repeating tasks'));
      console.log(chalk.gray('  • See README for Claude Code/Gemini integration examples\n'));
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
      // Show provider-specific integration guides (only for detected providers)
      if (providers['claude-code']) {
        console.log(chalk.cyan('Claude Code Integration:'));
        console.log(chalk.gray('  • Use natural language to work with ax agents'));
        console.log(chalk.gray('  • Example: "Ask ax agent backend to create a REST API"'));
        console.log(chalk.gray('  • MCP tools available in .claude/mcp/\n'));
      }

      if (providers['gemini-cli']) {
        console.log(chalk.cyan('Gemini CLI Integration:'));
        console.log(chalk.gray('  • Use natural language to work with ax agents'));
        console.log(chalk.gray('  • Example: "Use ax agent backend to create a REST API"'));
        console.log(chalk.gray('  • No special commands needed - just ask naturally!\n'));
      }

      if (providers['ax-cli']) {
        console.log(chalk.cyan('ax-cli Integration:'));
        console.log(chalk.gray('  • Multi-provider AI CLI (GLM, xAI, OpenAI, Anthropic, Ollama)'));
        console.log(chalk.gray('  • Use: ax cli "your task"'));
        if (axCliConfigured === 'manual_required') {
          console.log(chalk.yellow('  • Manual MCP configuration required (see above)'));
        } else if (axCliConfigured === 'already_configured') {
          console.log(chalk.gray('  • AutomatosX MCP server already configured'));
        } else if (axCliConfigured === 'not_installed') {
          console.log(chalk.gray('  • ax-cli detected but MCP not configured'));
        } else {
          console.log(chalk.gray('  • AutomatosX MCP server configured for agent access'));
        }
        console.log(chalk.gray('  • See .ax-cli/README.md for configuration\n'));
      }

      if (providers['codex']) {
        console.log(chalk.cyan('OpenAI Codex Integration:'));
        console.log(chalk.gray('  • Use natural language to work with ax agents'));
        console.log(chalk.gray('  • Or use terminal: ax run <agent> "task"'));
        console.log(chalk.gray('  • Git repository initialized for Codex compatibility\n'));
      }

      // Show what's NOT configured
      const notFoundProviders = Object.entries(providers)
        .filter(([_, installed]) => !installed)
        .map(([name]) => ProviderDetector.formatProviderName(name));

      if (notFoundProviders.length > 0) {
        console.log(chalk.gray('Other AI assistants (not configured):'));
        for (const providerName of notFoundProviders) {
          console.log(chalk.gray(`  • ${providerName} - install and run "ax setup" again`));
        }
        console.log('');
      }

      logger.info('AutomatosX set up', {
        projectDir,
        automatosxDir,
        counts: { teams: teamCount, agents: agentCount, abilities: abilityCount, templates: templateCount }
      });

    } catch (error) {
      shouldRollback = true;

      // Rollback mechanism (Fix P0-2)
      if (createdResources.length > 0 && !argv.force) {
        console.log(chalk.yellow('\n⚠️  Setup failed. Rolling back changes...'));
        await rollbackCreatedResources(createdResources);
        console.log(chalk.green('   ✓ Rollback completed'));
      }

      printError(error, {
        verbose: false,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      logger.error('Setup failed', {
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
 * Validate environment before setup (Fix P2-7)
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
 * Generic helper to copy example files to user's .automatosx directory
 * Reduces duplication across copyExampleTeams, copyExampleAgents, etc.
 */
async function copyExampleFiles(
  baseDir: string,
  packageRoot: string,
  config: {
    exampleDir: string;    // 'teams', 'agents', 'abilities', 'templates'
    targetDir: string;     // 'teams', 'agents', 'abilities', 'templates'
    extension: string;     // '.yaml', '.md'
    resourceName: string;  // 'team configuration', 'agent', 'ability', 'template'
  }
): Promise<number> {
  const examplesDir = join(packageRoot, `examples/${config.exampleDir}`);
  const targetDir = join(baseDir, config.targetDir);

  const files = await readdir(examplesDir);
  let count = 0;

  for (const file of files) {
    if (file.endsWith(config.extension)) {
      await copyFile(join(examplesDir, file), join(targetDir, file));
      count++;
    }
  }

  if (count === 0) {
    throw new Error(`No ${config.resourceName} files found in ${examplesDir}`);
  }

  return count;
}

/**
 * Copy example teams to user's .automatosx directory (Fix P0-1)
 */
async function copyExampleTeams(baseDir: string, packageRoot: string): Promise<number> {
  return copyExampleFiles(baseDir, packageRoot, {
    exampleDir: 'teams',
    targetDir: 'teams',
    extension: '.yaml',
    resourceName: 'team configuration'
  });
}

/**
 * Copy example agents to user's .automatosx directory (Fix P0-3: Fatal errors)
 */
async function copyExampleAgents(baseDir: string, packageRoot: string): Promise<number> {
  return copyExampleFiles(baseDir, packageRoot, {
    exampleDir: 'agents',
    targetDir: 'agents',
    extension: '.yaml',
    resourceName: 'agent'
  });
}

/**
 * Copy example abilities to user's .automatosx directory (Fix P0-3: Fatal errors)
 */
async function copyExampleAbilities(baseDir: string, packageRoot: string): Promise<number> {
  return copyExampleFiles(baseDir, packageRoot, {
    exampleDir: 'abilities',
    targetDir: 'abilities',
    extension: '.md',
    resourceName: 'ability'
  });
}

/**
 * Copy agent templates to user's .automatosx directory (Fix P0-3: Fatal errors)
 */
async function copyExampleTemplates(baseDir: string, packageRoot: string): Promise<number> {
  return copyExampleFiles(baseDir, packageRoot, {
    exampleDir: 'templates',
    targetDir: 'templates',
    extension: '.yaml',
    resourceName: 'template'
  });
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
  const mcpDir = join(claudeDir, 'mcp');

  await mkdir(mcpDir, { recursive: true });

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
 * Setup ax-cli MCP integration
 *
 * Configures ax-cli to use AutomatosX as an MCP server, allowing ax-cli
 * to access AutomatosX agents, memory, and session management as tools.
 *
 * BUGFIX: This function was causing ax setup to hang indefinitely.
 * Now it skips ax-cli integration to avoid blocking the setup process.
 * Users can manually configure ax-cli MCP if needed:
 *   ax-cli mcp add automatosx --transport stdio --command ax --args mcp server
 *
 * @returns Status string: 'not_installed' | 'already_configured' | 'manual_required' | 'error'
 */
async function setupAxCliIntegration(): Promise<string> {
  try {
    // Check if ax-cli is installed
    const { execSync } = await import('child_process');
    try {
      execSync('ax-cli --version', { stdio: 'pipe', timeout: 2000 });
    } catch {
      // ax-cli not installed, skip configuration
      logger.info('ax-cli not installed, skipping MCP configuration');
      return 'not_installed';
    }

    // Check if AutomatosX MCP server is already configured
    try {
      const output = execSync('ax-cli mcp list', { encoding: 'utf-8', stdio: 'pipe', timeout: 2000 });
      if (output.includes('automatosx')) {
        logger.info('ax-cli MCP already configured');
        return 'already_configured';
      }
    } catch {
      // Ignore errors from mcp list
    }

    // BUGFIX: Skip automatic MCP configuration - it can hang during setup
    // Users should manually configure if they want ax-cli integration
    logger.info('ax-cli detected. Manual MCP configuration required:');
    logger.info('  Run: ax-cli mcp add automatosx --transport stdio --command ax --args mcp server');
    return 'manual_required';

    // OLD CODE (commented out to prevent hanging):
    // Add AutomatosX MCP server to ax-cli
    // Note: The test will timeout, but the server will be added successfully
    // execSync('ax-cli mcp add automatosx --transport stdio --command ax --args mcp server', {
    //   stdio: 'pipe',
    //   timeout: 5000 // 5 second timeout to avoid hanging
    // });
    // logger.info('ax-cli MCP server configured successfully');
    // return 'configured';
  } catch (error) {
    // Log errors but don't fail setup
    logger.warn('Failed to configure ax-cli MCP', { error });
    return 'error';
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
      // FIX Bug #142: Remove shell:true for security
      // Git executable doesn't require shell, works on all platforms
      const child = spawn('git', ['init'], {
        cwd: projectDir,
        stdio: 'pipe',
        shell: false // FIXED Bug #142: Removed shell:true for security
      });

      let stderr = '';

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`git init failed with code ${code}: ${stderr}`));
        } else {
          logger.info('Git repository set up successfully');
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
    'ax.config.json  # v9.2.0: Optional - remove to track config',
    'automatosx.config.json  # DEPRECATED: old config name (backward compat)',
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
 * Generic helper to setup provider integration .md files
 * Reduces duplication across setupProjectClaudeMd, setupProjectGeminiMd, etc.
 */
async function setupProjectProviderMd(
  projectDir: string,
  packageRoot: string,
  force: boolean,
  config: {
    fileName: string;        // 'CLAUDE.md', 'GEMINI.md', 'AGENTS.md'
    templatePath: string;    // 'examples/claude/CLAUDE_INTEGRATION.md'
    description: string;     // Provider-specific description
    providerName: string;    // 'CLAUDE', 'GEMINI', 'AGENTS' (for logging)
  }
): Promise<void> {
  const mdPath = join(projectDir, config.fileName);
  const templatePath = join(packageRoot, config.templatePath);

  try {
    // Read the template
    const { readFile } = await import('fs/promises');
    const template = await readFile(templatePath, 'utf-8');

    const exists = await checkExists(mdPath);

    if (!exists) {
      // Create new .md file with AutomatosX integration
      const content = [
        `# ${config.fileName.replace('.md', '.md')}`,
        '',
        config.description,
        '',
        '---',
        '',
        template
      ].join('\n');

      await writeFile(mdPath, content, 'utf-8');
      logger.info(`Created ${config.fileName} with AutomatosX integration`, { path: mdPath });
    } else {
      // Update existing .md file
      const existingContent = await readFile(mdPath, 'utf-8');

      // Check if AutomatosX integration already exists
      if (existingContent.includes('# AutomatosX Integration')) {
        if (!force) {
          logger.info(`${config.fileName} already contains AutomatosX integration`, { path: mdPath });
          return;
        }
        // Force mode: replace existing AutomatosX section
        const updatedContent = replaceAutomatosXSection(existingContent, template);
        await writeFile(mdPath, updatedContent, 'utf-8');
        logger.info(`Updated AutomatosX integration in ${config.fileName}`, { path: mdPath });
      } else {
        // Append AutomatosX integration to existing content
        const updatedContent = [
          existingContent.trimEnd(),
          '',
          '---',
          '',
          template
        ].join('\n');

        await writeFile(mdPath, updatedContent, 'utf-8');
        logger.info(`Added AutomatosX integration to existing ${config.fileName}`, { path: mdPath });
      }
    }
  } catch (error) {
    // Non-critical error, just log it
    logger.warn(`Failed to setup ${config.fileName}`, {
      error: (error as Error).message,
      path: mdPath
    });
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
  return setupProjectProviderMd(projectDir, packageRoot, force, {
    fileName: 'CLAUDE.md',
    templatePath: 'examples/claude/CLAUDE_INTEGRATION.md',
    description: 'This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.',
    providerName: 'CLAUDE'
  });
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
  argv: SetupOptions
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
  // v9.0.2: Refactored to use PromptHelper for automatic cleanup
  if (process.stdout.isTTY && process.stdin.isTTY) {
    console.log(chalk.cyan('\n📋 GitHub Spec-Kit Integration'));
    console.log(chalk.gray('   Spec-Kit enables spec-driven development workflows.'));
    console.log(chalk.gray('   It creates .specify/ directory with spec.md, plan.md, and tasks.md'));
    console.log(chalk.gray('   for structured planning and task management.\n'));

    try {
      const prompt = new PromptHelper();
      try {
        const answer = await prompt.question(
          chalk.cyan('   Initialize Spec-Kit now? (y/N): ')
        );

        const shouldInit = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

        if (shouldInit) {
          console.log(chalk.cyan('\n   Initializing Spec-Kit...'));
          return await initializeSpecKit(projectDir);
        } else {
          logger.info('User declined Spec-Kit initialization');
          return false;
        }
      } finally {
        prompt.close();
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

    console.log(chalk.green('   ✓ Spec-Kit set up successfully'));
    console.log(chalk.gray('      Files created: .specify/spec.md, plan.md, tasks.md'));
    logger.info('Spec-Kit set up successfully', {
      projectDir,
      specifyDir
    });
    return true;

  } catch (error) {
    // Non-critical error - log warning but don't fail the setup
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
 *
 * v10.2.0: Added MCP (Model Context Protocol) auto-configuration
 * - Creates .gemini/mcp-servers.json with AutomatosX MCP server
 * - Enables bidirectional integration (Gemini CLI ↔ AutomatosX)
 * - No manual configuration required
 */
async function setupGeminiIntegration(projectDir: string, packageRoot: string): Promise<void> {
  // Create .gemini directory structure
  const geminiDir = join(projectDir, '.gemini');
  await mkdir(geminiDir, { recursive: true });

  // Setup MCP server configuration for Gemini CLI
  await setupGeminiMCPConfig(projectDir, packageRoot);

  // Note: Gemini CLI users should use natural language to interact with AutomatosX
  // No custom slash commands needed - just talk naturally to work with ax agents
}

/**
 * Setup Gemini CLI MCP (Model Context Protocol) configuration
 *
 * Creates .gemini/mcp-servers.json to enable bidirectional integration:
 * - Gemini CLI can invoke AutomatosX agents via MCP protocol
 * - Eliminates subprocess spawning overhead
 * - Provides rich tool access (agents, memory, sessions)
 *
 * @param projectDir - Project root directory
 * @param packageRoot - AutomatosX package installation directory
 */
async function setupGeminiMCPConfig(projectDir: string, packageRoot: string): Promise<void> {
  const mcpServersPath = join(projectDir, '.gemini', 'mcp-servers.json');

  try {
    // Determine AutomatosX MCP server path
    // Check if running from global install vs local
    const globalMcpPath = join(packageRoot, 'dist', 'mcp', 'index.js');
    const localMcpPath = join(projectDir, 'node_modules', '@defai.digital', 'automatosx', 'dist', 'mcp', 'index.js');

    // BUGFIX: Verify both paths exist before choosing one
    let mcpServerPath: string;
    if (await checkExists(globalMcpPath)) {
      mcpServerPath = globalMcpPath;
    } else if (await checkExists(localMcpPath)) {
      mcpServerPath = localMcpPath;
    } else {
      // Neither global nor local installation found - skip MCP setup
      logger.warn('AutomatosX MCP server not found, skipping Gemini CLI MCP configuration', {
        globalPath: globalMcpPath,
        localPath: localMcpPath
      });
      return;
    }

    // Read existing MCP servers config if it exists
    let mcpConfig: Record<string, unknown> = {};
    if (await checkExists(mcpServersPath)) {
      const existingContent = await readFile(mcpServersPath, 'utf-8');
      try {
        mcpConfig = JSON.parse(existingContent) as Record<string, unknown>;
      } catch (error) {
        logger.warn('Failed to parse existing MCP config, will overwrite', {
          error: (error as Error).message
        });
      }
    }

    // Add or update AutomatosX MCP server configuration
    mcpConfig['automatosx'] = {
      command: 'node',
      args: [mcpServerPath],
      description: 'AutomatosX AI agent orchestration platform with persistent memory and multi-agent collaboration',
      env: {
        AUTOMATOSX_CONFIG_PATH: join(projectDir, 'ax.config.json'),
        AUTOMATOSX_LOG_LEVEL: 'warn' // Quiet mode for MCP integration
      }
    };

    // Write MCP configuration
    await writeFile(
      mcpServersPath,
      JSON.stringify(mcpConfig, null, 2),
      'utf-8'
    );

    logger.info('Created Gemini CLI MCP configuration', {
      path: mcpServersPath,
      mcpServerPath
    });
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup Gemini CLI MCP configuration', {
      error: (error as Error).message,
      path: mcpServersPath
    });
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
  return setupProjectProviderMd(projectDir, packageRoot, force, {
    fileName: 'GEMINI.md',
    templatePath: 'examples/gemini/GEMINI_INTEGRATION.md',
    description: 'This file provides guidance to Gemini CLI users when working with code in this repository.',
    providerName: 'GEMINI'
  });
}

/**
 * Setup OpenAI Codex CLI integration files
 *
 * v10.3.0: Added MCP (Model Context Protocol) auto-configuration
 * - Creates .codex/mcp-servers.json with AutomatosX MCP server
 * - Enables bidirectional integration (Codex CLI ↔ AutomatosX)
 * - No manual configuration required
 */
async function setupCodexIntegration(projectDir: string, packageRoot: string): Promise<void> {
  // Create .codex directory structure
  const codexDir = join(projectDir, '.codex');
  await mkdir(codexDir, { recursive: true });

  // Setup MCP server configuration for Codex CLI
  await setupCodexMCPConfig(projectDir, packageRoot);

  // Note: Codex CLI users should use natural language to interact with AutomatosX
  // No custom slash commands needed - just talk naturally to work with ax agents
}

/**
 * Setup Codex CLI MCP (Model Context Protocol) configuration
 *
 * Creates .codex/mcp-servers.json to enable bidirectional integration:
 * - Codex CLI can invoke AutomatosX agents via MCP protocol
 * - Eliminates subprocess spawning overhead
 * - Provides rich tool access (agents, memory, sessions)
 *
 * @param projectDir - Project root directory
 * @param packageRoot - AutomatosX package installation directory
 */
async function setupCodexMCPConfig(projectDir: string, packageRoot: string): Promise<void> {
  const mcpServersPath = join(projectDir, '.codex', 'mcp-servers.json');

  try {
    // Determine AutomatosX MCP server path
    // Check if running from global install vs local
    const globalMcpPath = join(packageRoot, 'dist', 'mcp', 'index.js');
    const localMcpPath = join(projectDir, 'node_modules', '@defai.digital', 'automatosx', 'dist', 'mcp', 'index.js');

    // Verify both paths exist before choosing one
    let mcpServerPath: string;
    if (await checkExists(globalMcpPath)) {
      mcpServerPath = globalMcpPath;
    } else if (await checkExists(localMcpPath)) {
      mcpServerPath = localMcpPath;
    } else {
      // Neither global nor local installation found - skip MCP setup
      logger.warn('AutomatosX MCP server not found, skipping Codex CLI MCP configuration', {
        globalPath: globalMcpPath,
        localPath: localMcpPath
      });
      return;
    }

    // Read existing MCP servers config if it exists
    let mcpConfig: Record<string, unknown> = {};
    if (await checkExists(mcpServersPath)) {
      const existingContent = await readFile(mcpServersPath, 'utf-8');
      try {
        mcpConfig = JSON.parse(existingContent) as Record<string, unknown>;
      } catch (error) {
        logger.warn('Failed to parse existing MCP config, will overwrite', {
          error: (error as Error).message
        });
      }
    }

    // Add or update AutomatosX MCP server configuration
    mcpConfig['automatosx'] = {
      command: 'node',
      args: [mcpServerPath],
      description: 'AutomatosX AI agent orchestration platform with persistent memory and multi-agent collaboration',
      env: {
        AUTOMATOSX_CONFIG_PATH: join(projectDir, 'ax.config.json'),
        AUTOMATOSX_LOG_LEVEL: 'warn' // Quiet mode for MCP integration
      }
    };

    // Write MCP configuration
    await writeFile(
      mcpServersPath,
      JSON.stringify(mcpConfig, null, 2),
      'utf-8'
    );

    logger.info('Created Codex CLI MCP configuration', {
      path: mcpServersPath,
      mcpServerPath
    });
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup Codex CLI MCP configuration', {
      error: (error as Error).message,
      path: mcpServersPath
    });
  }
}

/**
 * Setup project AGENTS.md with AutomatosX integration guide
 *
 * This function creates or updates the project's AGENTS.md file to include
 * AutomatosX integration instructions, following the open AGENTS.md standard
 * (https://agents.md) that works across all AI coding assistants.
 */
async function setupProjectAgentsMd(
  projectDir: string,
  packageRoot: string,
  force: boolean
): Promise<void> {
  const agentsMdPath = join(projectDir, 'AGENTS.md');
  const templatePath = join(packageRoot, 'examples/agents/AGENTS_INTEGRATION.md');

  try {
    // Read the template
    const { readFile } = await import('fs/promises');
    const template = await readFile(templatePath, 'utf-8');

    const exists = await checkExists(agentsMdPath);

    if (!exists) {
      // Create new AGENTS.md with AutomatosX integration
      const content = [
        '# AGENTS.md',
        '',
        'This file provides guidance to AI coding assistants when working with code in this repository.',
        'Following the open AGENTS.md standard (https://agents.md) for cross-tool compatibility.',
        '',
        '---',
        '',
        template
      ].join('\n');

      await writeFile(agentsMdPath, content, 'utf-8');
      logger.info('Created AGENTS.md with AutomatosX integration', { path: agentsMdPath });
    } else {
      // Update existing AGENTS.md
      const existingContent = await readFile(agentsMdPath, 'utf-8');

      // Check if AutomatosX integration already exists
      if (existingContent.includes('# AutomatosX Integration')) {
        if (!force) {
          logger.info('AGENTS.md already contains AutomatosX integration', { path: agentsMdPath });
          return;
        }
        // Force mode: replace existing AutomatosX section
        const updatedContent = replaceAutomatosXSection(existingContent, template);
        await writeFile(agentsMdPath, updatedContent, 'utf-8');
        logger.info('Updated AutomatosX integration in AGENTS.md', { path: agentsMdPath });
      } else {
        // Append AutomatosX integration to existing content
        const updatedContent = [
          existingContent.trimEnd(),
          '',
          '---',
          '',
          template
        ].join('\n');

        await writeFile(agentsMdPath, updatedContent, 'utf-8');
        logger.info('Added AutomatosX integration to existing AGENTS.md', { path: agentsMdPath });
      }
    }
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup AGENTS.md', {
      error: (error as Error).message,
      path: agentsMdPath
    });
  }
}

/**
 * Setup AutomatosX-Integration.md (canonical integration guide)
 *
 * This is the single source of truth for AutomatosX integration across all AI assistants.
 * All AI-specific files (CLAUDE.md, GEMINI.md, CODEX.md, AGENTS.md) reference this file.
 */
async function setupAutomatosXIntegrationMd(
  projectDir: string,
  packageRoot: string,
  force: boolean
): Promise<void> {
  const integrationMdPath = join(projectDir, 'AutomatosX-Integration.md');
  const templatePath = join(packageRoot, 'docs/AutomatosX-Integration.md'); // BUGFIX: Changed from examples/ to docs/

  try {
    const exists = await checkExists(integrationMdPath);

    if (exists && !force) {
      logger.info('AutomatosX-Integration.md already exists, skipping');
      return;
    }

    // Read template file and write to project directory
    const { readFile, writeFile } = await import('fs/promises');
    const template = await readFile(templatePath, 'utf-8');
    await writeFile(integrationMdPath, template, 'utf-8');

    logger.info('Created AutomatosX-Integration.md from template');
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup AutomatosX-Integration.md', {
      error: (error as Error).message,
      path: integrationMdPath
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

/**
 * Clean up existing installation in force mode
 *
 * Removes:
 * - .automatosx directory (complete cleanup)
 * - .claude/commands/ax-* files
 * - .gemini/commands/ax-* files
 */
async function cleanupForceMode(projectDir: string): Promise<void> {
  try {
    // Remove .automatosx directory completely
    const automatosxDir = join(projectDir, '.automatosx');
    if (await checkExists(automatosxDir)) {
      await rm(automatosxDir, { recursive: true, force: true });
      logger.info('Removed .automatosx directory', { path: automatosxDir });
    }

    // Remove .claude/commands/ax-* files
    const claudeCommandsDir = join(projectDir, '.claude', 'commands');
    if (await checkExists(claudeCommandsDir)) {
      const files = await readdir(claudeCommandsDir);
      for (const file of files) {
        if (file.startsWith('ax-') && file.endsWith('.md')) {
          const filePath = join(claudeCommandsDir, file);
          await rm(filePath, { force: true });
          logger.info('Removed Claude command file', { path: filePath });
        }
      }
    }

    // Remove .gemini/commands/ax-* files
    const geminiCommandsDir = join(projectDir, '.gemini', 'commands');
    if (await checkExists(geminiCommandsDir)) {
      const files = await readdir(geminiCommandsDir);
      for (const file of files) {
        if (file.startsWith('ax-') && file.endsWith('.toml')) {
          const filePath = join(geminiCommandsDir, file);
          await rm(filePath, { force: true });
          logger.info('Removed Gemini command file', { path: filePath });
        }
      }
    }

    logger.info('Force mode cleanup completed', { projectDir });
  } catch (error) {
    // Log warning but don't fail - cleanup is best-effort
    logger.warn('Force mode cleanup encountered errors (non-critical)', {
      error: (error as Error).message,
      projectDir
    });
  }
}
