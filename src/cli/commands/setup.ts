/**
  * Setup Command - Set up AutomatosX project
 */

import type { CommandModule } from 'yargs';
import { mkdir, writeFile, readFile, access, readdir, copyFile, rm, stat } from 'fs/promises';
import { resolve, join } from 'path';
import { constants } from 'fs';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../types/config.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { logger } from '../../shared/logging/logger.js';
import { printError } from '../../shared/errors/error-formatter.js';
import { PromptHelper } from '../../shared/helpers/prompt-helper.js';
import { getPackageRoot } from '../../shared/helpers/package-root.js';
import { ClaudeCodeSetupHelper } from '../../integrations/claude-code/setup-helper.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { TeamManager } from '../../core/team-manager.js';
import { ProviderDetector } from '../../core/provider-detector.js';

interface SetupOptions {
  force?: boolean;
  path?: string;
  claudeCode?: boolean;  // DEPRECATED: v13.0.0 - MCP discovery replaces manifest generation
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
      .option('claude-code', {
        describe: '[DEPRECATED] Legacy manifest generation - MCP discovery is now automatic',
        type: 'boolean',
        default: false,
        hidden: true  // Hide from help since it's deprecated
      });
  },

  handler: async (argv) => {
    const projectDir = resolve(argv.path || '.');
    const automatosxDir = join(projectDir, '.automatosx');
    const configPath = join(projectDir, 'ax.config.json'); // v9.2.0: Renamed from automatosx.config.json

    // Get version from package.json dynamically
    const packageRoot = getPackageRoot();
    let version = '11.2.6'; // fallback
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
        console.log(chalk.gray('     - Codex CLI'));
        console.log(chalk.gray('     - GLM (SDK-first, requires ZAI_API_KEY)'));
        console.log(chalk.gray('     - Grok (SDK-first, requires XAI_API_KEY)'));
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

      // Copy workflow templates (v11.0.0+)
      console.log(chalk.cyan('🔄 Installing workflow templates...'));
      const workflowCount = await copyWorkflowTemplates(automatosxDir, packageRoot);
      console.log(chalk.green(`   ✓ ${workflowCount} workflow templates installed`));

      // Copy iterate mode patterns and templates (v11.4.0+)
      console.log(chalk.cyan('🔁 Installing iterate mode configuration...'));
      await copyIterateConfig(automatosxDir, packageRoot);
      console.log(chalk.green('   ✓ Iterate mode patterns and templates installed'));

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

      // v13.0.0: ax-cli MCP integration removed (deprecated)
      // GLM and Grok now use SDK-first execution via MCP client mode

      // Setup Gemini CLI integration (ONLY if detected)
      // Note: This creates project-local .gemini/mcp-servers.json for MCP integration
      let geminiMcpStatus: GeminiMCPStatus = 'skipped';
      if (providers['gemini-cli']) {
        console.log(chalk.cyan('🔌 Setting up Gemini CLI integration...'));
        const geminiDir = join(projectDir, '.gemini');
        const geminiDirExistedBefore = await checkExists(geminiDir);
        geminiMcpStatus = await setupGeminiIntegration(projectDir, packageRoot);
        // Only add to rollback if we created it (not if it pre-existed)
        if (!geminiDirExistedBefore) {
          createdResources.push(geminiDir);
        }
        // Report status accurately based on what actually happened
        if (geminiMcpStatus === 'configured') {
          console.log(chalk.green('   ✓ Gemini CLI MCP integration configured'));
        } else if (geminiMcpStatus === 'skipped') {
          console.log(chalk.yellow('   ⚠ Gemini CLI MCP skipped (MCP server not found)'));
          console.log(chalk.gray('     CLI integration still works via subprocess'));
        } else {
          console.log(chalk.yellow('   ⚠ Gemini CLI MCP configuration failed'));
          console.log(chalk.gray('     CLI integration still works via subprocess'));
        }
      }

      // Create workspace directories for organized file management
      console.log(chalk.cyan('📂 Creating workspace directories...'));
      await createWorkspaceDirectories(projectDir);
      console.log(chalk.green('   ✓ Workspace directories created'));

      // Initialize git repository (required by Codex CLI, useful for all projects)
      const gitDir = join(projectDir, '.git');
      const isGitRepo = await checkExists(gitDir);
      if (!isGitRepo) {
        console.log(chalk.cyan('🔧 Initializing git repository...'));
        const gitInitSuccess = await initializeGitRepository(projectDir);
        // Only print success if git init actually succeeded
        // (failures/skips print their own messages inside initializeGitRepository)
        if (gitInitSuccess) {
          console.log(chalk.green('   ✓ Git repository initialized'));
        }
      }

      // NOTE: Codex CLI MCP integration REMOVED in v11.2.5
      //
      // Previous behavior (v10.3.2-v11.2.3): Created .codex/mcp-servers.json unconditionally
      // This was removed because:
      // 1. Codex MCP support is experimental (STDIO works, HTTP/SSE incomplete)
      // 2. AutomatosX uses CLI wrappers for provider connections, NOT MCP
      // 3. MCP introduces security complexity without clear benefit
      //
      // The CLI integration works reliably via:
      //   ax run <agent> "task" → spawns `codex` subprocess → returns result
      //
      // To manually enable Codex MCP, users can add to ~/.codex/config.toml:
      //   [mcp_servers.automatosx]
      //   command = "automatosx-mcp"

      // NOTE: Global MCP configuration REMOVED in v11.2.4
      //
      // Previous behavior (v11.2.0-v11.2.3): ax setup configured MCP in global user configs
      // (~/.gemini/settings.json, ~/.codex/config.toml, claude mcp add)
      //
      // This was removed because:
      // 1. AutomatosX uses CLI wrappers for provider connections, NOT MCP
      // 2. Global MCP caused AutomatosX MCP server to boot in EVERY project (6+ second delay)
      // 3. MCP integration is an optional feature, not core functionality
      //
      // Project-local Gemini MCP config (.gemini/mcp-servers.json) is still created
      // when Gemini CLI is detected.
      //
      // To manually enable global MCP, users can run:
      //   claude mcp add --transport stdio automatosx -- automatosx-mcp
      //   # Or add to ~/.gemini/settings.json / ~/.codex/config.toml manually

      // Create .gitignore entry
      console.log(chalk.cyan('📝 Updating .gitignore...'));
      await updateGitignore(projectDir);
      console.log(chalk.green('   ✓ .gitignore updated'));

      // Claude Code integration setup (DEPRECATED - v13.0.0)
      // MCP discovery via .mcp.json replaces manifest generation
      let claudeCodeSetupSucceeded = false;
      if (argv.claudeCode) {
        console.log(chalk.yellow('\n⚠️  --claude-code flag is DEPRECATED (v13.0.0)'));
        console.log(chalk.gray('   MCP discovery is now automatic via .mcp.json'));
        console.log(chalk.gray('   Claude Code will discover agents via get_capabilities MCP tool\n'));

        // Still run legacy setup for backwards compatibility, but warn
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
          console.log(chalk.green('   ✓ Legacy Claude Code manifests generated'));
          console.log(chalk.gray('     Note: These will be removed in v14.0.0'));
        } catch (error) {
          console.log(chalk.yellow(`   ⚠ Legacy setup failed: ${error instanceof Error ? error.message : String(error)}`));
          console.log(chalk.gray('     This is fine - MCP discovery will work without manifests'));
        }
      }

      // Create .mcp.json for MCP discovery (v13.0.0 - replaces manifests)
      console.log(chalk.cyan('🔌 Creating MCP server configuration...'));
      await createMcpConfig(projectDir);
      console.log(chalk.green('   ✓ .mcp.json created for MCP discovery'));

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

      // v13.0.0: MCP-first integration replaces legacy manifest generation
      console.log(chalk.cyan('MCP Integration (v13.0.0):'));
      console.log(chalk.gray('  • .mcp.json created for automatic MCP server discovery'));
      console.log(chalk.gray('  • Claude Code/Gemini CLI will auto-connect to AutomatosX'));
      console.log(chalk.gray('  • Use get_capabilities tool to discover agents dynamically'));
      console.log(chalk.gray('  • No manual registration required\n'));

      if (claudeCodeSetupSucceeded) {
        console.log(chalk.yellow('Legacy Claude Code Manifests (deprecated):'));
        console.log(chalk.gray('  • Slash commands: /agent-<name> (will be removed in v14.0.0)'));
        console.log(chalk.gray('  • Prefer using MCP tools instead\n'));
      }

      // v11.0.0: Updated workflow templates messaging
      console.log(chalk.cyan('Workflow Templates (v11.0.0):'));
      console.log(chalk.gray('  • 4 workflow templates installed in .automatosx/workflows/'));
      console.log(chalk.gray('  • Use with --workflow flag for multi-step tasks:'));
      console.log(chalk.gray('    ax run backend "implement auth" --workflow auth-flow'));
      console.log(chalk.gray('    ax run backend "create API" --workflow api-flow'));
      console.log(chalk.gray('  • Available: auth-flow, feature-flow, api-flow, refactor-flow\n'));

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

      // GLM and Grok SDK-first providers are always available
      if (providers['glm'] || providers['grok']) {
        console.log(chalk.cyan('SDK-First Providers:'));
        if (providers['glm']) {
          console.log(chalk.gray('  • GLM (Zhipu AI) - API key: GLM_API_KEY'));
        }
        if (providers['grok']) {
          console.log(chalk.gray('  • Grok (xAI) - API key: XAI_API_KEY'));
        }
        console.log(chalk.gray('  • Use: ax run <agent> "your task" --engine glm|grok\n'));
      }

      if (providers['codex']) {
        console.log(chalk.cyan('Codex CLI Integration:'));
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
        counts: { teams: teamCount, agents: agentCount, abilities: abilityCount, templates: templateCount, workflows: workflowCount }
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
    join(baseDir, 'logs'),
    join(baseDir, 'workflows'),      // v11.0.0: Workflow templates directory
    join(baseDir, 'iterate'),        // v11.4.0: Iterate mode patterns and templates
    join(baseDir, 'state')           // v11.3.0: Mode state persistence
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
    'examples/workflows',
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
    exampleDir: 'workflows',
    targetDir: 'templates',
    extension: '.yaml',
    resourceName: 'template'
  });
}

/**
 * Copy workflow templates to user's .automatosx directory (v11.0.0)
 *
 * Workflow templates enable multi-step task execution with --workflow flag.
 * Templates are YAML files that configure iterate mode with predefined settings.
 */
async function copyWorkflowTemplates(baseDir: string, packageRoot: string): Promise<number> {
  const examplesDir = join(packageRoot, 'examples/workflows');
  const targetDir = join(baseDir, 'workflows');

  try {
    const files = await readdir(examplesDir);
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        await copyFile(join(examplesDir, file), join(targetDir, file));
        count++;
      }
    }

    // If no example workflows exist, create default templates
    if (count === 0) {
      await createDefaultWorkflowTemplates(targetDir);
      count = 4; // 4 default templates
    }

    return count;
  } catch {
    // Examples directory doesn't exist, create default templates
    await createDefaultWorkflowTemplates(targetDir);
    return 4;
  }
}

/**
 * Copy iterate mode patterns and templates to user's .automatosx directory (v11.4.0)
 *
 * Iterate mode enables autonomous multi-iteration execution with --iterate flag.
 * - patterns.yaml: Classification patterns for response types
 * - templates.yaml: Auto-response templates for confirmations
 */
async function copyIterateConfig(baseDir: string, packageRoot: string): Promise<void> {
  const iterateDir = join(baseDir, 'iterate');

  // Try to copy from examples/iterate if it exists
  const examplesIterateDir = join(packageRoot, 'examples/iterate');

  try {
    if (await checkExists(examplesIterateDir)) {
      const files = await readdir(examplesIterateDir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          await copyFile(join(examplesIterateDir, file), join(iterateDir, file));
        }
      }
      return;
    }
  } catch {
    // Fall through to create default files
  }

  // Create default iterate configuration files
  await createDefaultIterateConfig(iterateDir);
}

/**
 * Create default iterate mode configuration files
 */
async function createDefaultIterateConfig(iterateDir: string): Promise<void> {
  const patternsYaml = `# AutomatosX Iterate Mode - Pattern Library
# Production patterns for response classification
#
# Classification Types:
# - confirmation_prompt: AI asking for permission to proceed (auto-respond YES)
# - genuine_question: AI asking for user input/decision (PAUSE)
# - status_update: AI reporting progress (NO-OP)
# - completion_signal: AI indicating task complete (acknowledge)
# - blocking_request: AI needs external input (PAUSE)
# - error_signal: AI encountered error (PAUSE for recovery)
# - rate_limit_or_context: Provider limits hit (RETRY with different provider)

version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
description: "Production pattern library for iterate mode classifier"

patterns:
  confirmation_prompt:
    - pattern: "\\\\b(should I|shall I|do you want me to|would you like me to)\\\\b.*(proceed|continue|start|begin|go ahead)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\b(ready to|prepared to)\\\\b.*(proceed|continue|start|begin|implement)"
      priority: 9
      confidence: 0.9
    - pattern: "\\\\b(continue|proceed|go ahead)\\\\s*\\\\?"
      priority: 8
      confidence: 0.85
    - pattern: "\\\\b(is that|does that|sound)\\\\s+(okay|ok|good|correct|right)\\\\s*\\\\?"
      priority: 7
      confidence: 0.8

  genuine_question:
    - pattern: "\\\\b(which|what)\\\\b.*(approach|method|option|implementation|strategy|framework|library)\\\\b.*(should|would|prefer|recommend)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\b(option [A-Z]|choice \\\\d|alternative \\\\d)\\\\b"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\bwould you prefer\\\\b"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\bcould you (clarify|explain|specify|provide)\\\\b"
      priority: 8
      confidence: 0.85

  status_update:
    - pattern: "\\\\b(working on|implementing|creating|building|setting up|configuring)\\\\b"
      priority: 10
      confidence: 0.9
    - pattern: "\\\\b(analyzing|reviewing|examining|checking|looking at)\\\\b"
      priority: 9
      confidence: 0.85
    - pattern: "\\\\bI('ll| will| am going to)\\\\b.*(now|first|next|then)\\\\b"
      priority: 8
      confidence: 0.8

  completion_signal:
    - pattern: "\\\\b(all (tasks|items|changes|updates)|everything)\\\\s+(completed|done|finished|implemented)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\bsuccessfully (completed|implemented|created|fixed|resolved)"
      priority: 9
      confidence: 0.9
    - pattern: "\\\\blet me know if (you need|there('s| is)) anything else"
      priority: 7
      confidence: 0.8

  blocking_request:
    - pattern: "\\\\b(API key|credentials|password|token|secret)\\\\s+(needed|required|missing)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\bplease (provide|enter|specify|supply)\\\\b.*(key|password|token|credential)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\b(need|require|waiting for)\\\\s+(your|user)\\\\s+(input|approval|confirmation|decision)"
      priority: 10
      confidence: 0.95

  error_signal:
    - pattern: "\\\\b(error|failed|failure|exception)\\\\s*:"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\b(cannot|can't|couldn't|unable to)\\\\s+(find|locate|access|connect|read|write)"
      priority: 9
      confidence: 0.9
    - pattern: "\\\\b(test|build|compilation)\\\\s+(failed|error)"
      priority: 9
      confidence: 0.9

  rate_limit_or_context:
    - pattern: "\\\\brate limit\\\\s*(exceeded|reached|hit)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\bcontext (window|limit)\\\\s*(exceeded|full|reached)"
      priority: 10
      confidence: 0.95
    - pattern: "\\\\btoo many requests"
      priority: 10
      confidence: 0.95
`;

  const templatesYaml = `# AutomatosX Iterate Mode - Template Library
# Production templates for auto-response generation

version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
description: "Production template library for iterate mode auto-responder"

templates:
  confirmation_prompt:
    - template: "Yes, please proceed."
      priority: 10
      provider: null
    - template: "Yes, continue with that approach."
      priority: 9
      provider: null
    - template: "Sounds good, go ahead."
      priority: 8
      provider: null
    - template: "Proceed."
      priority: 7
      provider: null
    - template: "Continue."
      priority: 7
      provider: null

  completion_signal:
    - template: "Thank you."
      priority: 10
      provider: null
    - template: "Great work."
      priority: 9
      provider: null

  status_update: []
  genuine_question: []
  blocking_request: []
  error_signal: []
  rate_limit_or_context: []
`;

  await writeFile(join(iterateDir, 'patterns.yaml'), patternsYaml, 'utf-8');
  await writeFile(join(iterateDir, 'templates.yaml'), templatesYaml, 'utf-8');

  logger.info('Created default iterate mode configuration', { iterateDir });
}

/**
 * Create default workflow templates if examples don't exist
 */
async function createDefaultWorkflowTemplates(targetDir: string): Promise<void> {
  const authFlow = `# Authentication Implementation Workflow
# Usage: ax run backend "implement user login" --workflow auth-flow

name: auth-flow
description: Multi-step authentication implementation workflow

iterate:
  enabled: true
  timeout: 180
  maxTokens: 2000000
  strictness: balanced

steps:
  - name: design
    agent: architecture
    task: Design authentication architecture and security model
  - name: implement
    agent: backend
    task: Implement authentication logic with security best practices
  - name: security-review
    agent: security
    task: Review implementation for OWASP vulnerabilities
  - name: tests
    agent: quality
    task: Write comprehensive auth tests including edge cases

agents:
  - backend
  - security
  - quality
  - architecture
`;

  const featureFlow = `# Full Feature Implementation Workflow
# Usage: ax run backend "implement user dashboard" --workflow feature-flow

name: feature-flow
description: End-to-end feature development with design, implementation, and testing

iterate:
  enabled: true
  timeout: 240
  maxTokens: 3000000
  strictness: balanced

steps:
  - name: design
    agent: architecture
    task: Design feature architecture and data model
  - name: backend
    agent: backend
    task: Implement backend logic and APIs
  - name: frontend
    agent: frontend
    task: Implement UI components and integration
  - name: tests
    agent: quality
    task: Write unit and integration tests
  - name: review
    agent: standard
    task: Code review and final polish

agents:
  - architecture
  - backend
  - frontend
  - quality
  - standard
`;

  const apiFlow = `# API Development Workflow
# Usage: ax run backend "create REST API for products" --workflow api-flow

name: api-flow
description: RESTful API design, implementation, and documentation

iterate:
  enabled: true
  timeout: 120
  maxTokens: 1500000
  strictness: balanced

steps:
  - name: design
    agent: architecture
    task: Design API endpoints, request/response schemas, and error handling
  - name: implement
    agent: backend
    task: Implement API endpoints with validation and error handling
  - name: tests
    agent: quality
    task: Write API tests including happy path and error scenarios
  - name: docs
    agent: writer
    task: Generate API documentation

agents:
  - architecture
  - backend
  - quality
  - writer
`;

  const refactorFlow = `# Code Refactoring Workflow
# Usage: ax run backend "refactor user service" --workflow refactor-flow

name: refactor-flow
description: Safe code refactoring with analysis, implementation, and verification

iterate:
  enabled: true
  timeout: 90
  maxTokens: 1000000
  strictness: paranoid

steps:
  - name: analyze
    agent: architecture
    task: Analyze current code structure and identify refactoring opportunities
  - name: refactor
    agent: backend
    task: Implement refactoring with backward compatibility
  - name: verify
    agent: quality
    task: Verify all tests pass and no regressions
  - name: review
    agent: standard
    task: Final code review for quality and consistency

agents:
  - architecture
  - backend
  - quality
  - standard
`;

  await writeFile(join(targetDir, 'auth-flow.yaml'), authFlow, 'utf-8');
  await writeFile(join(targetDir, 'feature-flow.yaml'), featureFlow, 'utf-8');
  await writeFile(join(targetDir, 'api-flow.yaml'), apiFlow, 'utf-8');
  await writeFile(join(targetDir, 'refactor-flow.yaml'), refactorFlow, 'utf-8');
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
  const examplesBaseDir = join(packageRoot, 'examples/providers/claude');

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

// v13.0.0: setupAxCliIntegration REMOVED
// ax-cli is deprecated - use ax-glm and ax-grok providers instead
// GLM and Grok now use SDK-first execution with MCP client mode

/**
 * Initialize git repository if needed (for Codex CLI compatibility)
 *
 * Codex CLI requires the project to be in a git repository.
 * This function checks if the directory is already a git repo and initializes if needed.
 */
async function initializeGitRepository(projectDir: string): Promise<boolean> {
  const gitDir = join(projectDir, '.git');

  try {
    // Check if already a git repository
    const isGitRepo = await checkExists(gitDir);

    if (isGitRepo) {
      logger.info('Git repository already exists, skipping initialization');
      return true; // Already exists, consider it success
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

    return true; // Success

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
    return false; // Failed
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
 * Setup Gemini CLI integration files
 *
 * v10.2.0: Added MCP (Model Context Protocol) auto-configuration
 * - Creates .gemini/mcp-servers.json with AutomatosX MCP server
 * - Enables bidirectional integration (Gemini CLI ↔ AutomatosX)
 * - No manual configuration required
 */
type GeminiMCPStatus = 'configured' | 'skipped' | 'failed';

async function setupGeminiIntegration(projectDir: string, packageRoot: string): Promise<GeminiMCPStatus> {
  // Create .gemini directory structure
  const geminiDir = join(projectDir, '.gemini');
  await mkdir(geminiDir, { recursive: true });

  // Setup MCP server configuration for Gemini CLI
  const mcpStatus = await setupGeminiMCPConfig(projectDir, packageRoot);

  // Note: Gemini CLI users should use natural language to interact with AutomatosX
  // No custom slash commands needed - just talk naturally to work with ax agents
  return mcpStatus;
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
 * @returns Status of MCP configuration: 'configured' | 'skipped' | 'failed'
 */
async function setupGeminiMCPConfig(projectDir: string, packageRoot: string): Promise<GeminiMCPStatus> {
  const mcpServersPath = join(projectDir, '.gemini', 'mcp-servers.json');

  try {
    // Determine AutomatosX MCP server path
    // BUGFIX v11.2.5: Prefer LOCAL over GLOBAL to avoid version skew
    // Local installation should take precedence when both exist
    const localMcpPath = join(projectDir, 'node_modules', '@defai.digital', 'automatosx', 'dist', 'mcp', 'index.js');
    const globalMcpPath = join(packageRoot, 'dist', 'mcp', 'index.js');

    let mcpServerPath: string;
    if (await checkExists(localMcpPath)) {
      mcpServerPath = localMcpPath;
    } else if (await checkExists(globalMcpPath)) {
      mcpServerPath = globalMcpPath;
    } else {
      // Neither global nor local installation found - skip MCP setup
      logger.warn('AutomatosX MCP server not found, skipping Gemini CLI MCP configuration', {
        localPath: localMcpPath,
        globalPath: globalMcpPath
      });
      return 'skipped';
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
    return 'configured';
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to setup Gemini CLI MCP configuration', {
      error: (error as Error).message,
      path: mcpServersPath
    });
    return 'failed';
  }
}

// NOTE: setupCodexIntegration and setupCodexMCPConfig REMOVED in v11.2.5
//
// Previous behavior (v10.3.2-v11.2.3): Created .codex/mcp-servers.json unconditionally
// This was removed because:
// 1. Codex MCP support is experimental (STDIO works, HTTP/SSE incomplete)
// 2. AutomatosX uses CLI wrappers for provider connections, NOT MCP
// 3. MCP introduces security complexity without clear benefit
//
// The CLI integration works reliably via:
//   ax run <agent> "task" → spawns `codex` subprocess → returns result
//
// To manually enable Codex MCP, users can add to ~/.codex/config.toml:
//   [mcp_servers.automatosx]
//   command = "automatosx-mcp"

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

// NOTE: setupGlobalMCPConfigs function REMOVED in v11.2.4
//
// Previous behavior (v11.2.0-v11.2.3): This function configured MCP in global user configs
// (~/.gemini/settings.json, ~/.codex/config.toml, claude mcp add)
//
// This was removed because:
// 1. AutomatosX uses CLI wrappers for provider connections, NOT MCP
// 2. Global MCP caused AutomatosX MCP server to boot in EVERY project (6+ second delay)
// 3. MCP integration is an optional feature, not core functionality
//
// To manually enable global MCP, users can run:
//   claude mcp add --transport stdio automatosx -- automatosx-mcp
//   # Or add to ~/.gemini/settings.json / ~/.codex/config.toml manually

/**
 * Create .mcp.json for MCP server discovery (v13.0.0)
 *
 * This file enables AI assistants (Claude Code, Gemini CLI, etc.) to
 * automatically discover and connect to the AutomatosX MCP server.
 *
 * Benefits over legacy manifest generation:
 * - Dynamic capability discovery via get_capabilities tool
 * - No need to regenerate files when agents change
 * - Standard MCP protocol for all clients
 * - Automatic memory and session integration
 *
 * @param projectDir - Project root directory
 */
async function createMcpConfig(projectDir: string): Promise<void> {
  const mcpConfigPath = join(projectDir, '.mcp.json');

  // MCP server configuration for AutomatosX
  const mcpConfig = {
    mcpServers: {
      automatosx: {
        command: 'automatosx',
        args: ['mcp', 'server'],
        env: {
          AUTOMATOSX_PROJECT_DIR: projectDir
        }
      }
    }
  };

  try {
    // Check if .mcp.json already exists
    if (await checkExists(mcpConfigPath)) {
      // Merge with existing config
      const existingContent = await readFile(mcpConfigPath, 'utf-8');
      try {
        const existingConfig = JSON.parse(existingContent) as { mcpServers?: Record<string, unknown> };
        if (existingConfig.mcpServers) {
          existingConfig.mcpServers['automatosx'] = mcpConfig.mcpServers.automatosx;
          await writeFile(mcpConfigPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
          logger.info('Updated existing .mcp.json with AutomatosX server', { path: mcpConfigPath });
          return;
        }
      } catch {
        logger.warn('Failed to parse existing .mcp.json, will overwrite', { path: mcpConfigPath });
      }
    }

    // Create new .mcp.json
    await writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    logger.info('Created .mcp.json for MCP discovery', { path: mcpConfigPath });
  } catch (error) {
    // Log error but don't fail setup - MCP is optional enhancement
    logger.warn('Failed to create .mcp.json', {
      error: (error as Error).message,
      path: mcpConfigPath
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
