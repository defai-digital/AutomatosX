/**
 * Doctor Command - Pre-flight health checks and diagnostics
 *
 * Validates system setup and provides actionable fixes for common issues:
 * - Provider CLI installation and authentication
 * - Network connectivity
 * - Configuration validity
 * - File system permissions
 * - Memory system health (SQLite, FTS5)
 * - Session system checks
 * - MCP server validation
 * - Agent profile validation
 * - System dependencies
 *
 * v6.0.7: Initial implementation for improved UX
 * v11.0.2: Comprehensive diagnostics
 * v12.0.0: Removed ax-cli (deprecated), added native GLM/Grok providers
 */

import type { CommandModule } from 'yargs';
import { execSync } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { access, constants, readFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../core/config/loader.js';
import { PathResolver } from '../../shared/validation/path-resolver.js';
import { logger } from '../../shared/logging/logger.js';
import { printError } from '../../shared/errors/error-formatter.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { ClaudeCodeSetupHelper } from '../../integrations/claude-code/setup-helper.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { TeamManager } from '../../core/team-manager.js';
import { ProviderDetector } from '../../core/provider-detector.js';
import { join } from 'path';

interface DoctorOptions {
  provider?: string;
  verbose?: boolean;
  fix?: boolean;
  claudeCode?: boolean;
  codex?: boolean;
  axCli?: boolean;
  glm?: boolean;
  grok?: boolean;
  memory?: boolean;
  full?: boolean;
}

interface CheckResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  fix?: string;
  details?: string;
  warning?: boolean; // For non-critical issues
}

export const doctorCommand: CommandModule<Record<string, unknown>, DoctorOptions> = {
  command: 'doctor [provider]',
  describe: 'Run diagnostic checks and validate system setup',

  builder: (yargs) => {
    return yargs
      .positional('provider', {
        describe: 'Check specific provider (openai, gemini, claude, glm, grok) or all if omitted',
        type: 'string',
        choices: ['openai', 'gemini', 'claude', 'glm', 'grok']
      })
      .option('verbose', {
        describe: 'Show detailed diagnostic information',
        type: 'boolean',
        alias: 'v',
        default: false
      })
      .option('fix', {
        describe: 'Attempt to auto-fix issues where possible',
        type: 'boolean',
        default: false
      })
      .option('claude-code', {
        describe: 'Run Claude Code integration diagnostics',
        type: 'boolean',
        default: false
      })
      .option('codex', {
        describe: 'Run Codex CLI MCP integration diagnostics',
        type: 'boolean',
        default: false
      })
      // v12.0.0: Removed ax-cli option (deprecated)
      .option('glm', {
        describe: 'Run GLM provider diagnostics',
        type: 'boolean',
        default: false
      })
      .option('grok', {
        describe: 'Run Grok/xAI provider diagnostics',
        type: 'boolean',
        default: false
      })
      .option('memory', {
        describe: 'Run memory system health checks',
        type: 'boolean',
        default: false
      })
      .option('full', {
        describe: 'Run all comprehensive diagnostics',
        type: 'boolean',
        default: false
      })
      .example('ax doctor', 'Run all diagnostic checks')
      .example('ax doctor openai', 'Check only OpenAI provider')
      .example('ax doctor --verbose', 'Show detailed diagnostics')
      .example('ax doctor --fix', 'Auto-fix issues where possible')
      .example('ax doctor --claude-code', 'Check Claude Code integration')
      .example('ax doctor --codex', 'Check Codex MCP configuration')
      .example('ax doctor --glm', 'Check GLM provider')
      .example('ax doctor --grok', 'Check Grok/xAI provider')
      .example('ax doctor --memory', 'Check memory system health')
      .example('ax doctor --full', 'Run all comprehensive diagnostics');
  },

  handler: async (argv) => {
    try {
      const verbose = argv.verbose ?? false;
      const runFull = argv.full ?? false;

      // If --claude-code flag is set, run Claude Code diagnostics only
      if (argv.claudeCode) {
        await runClaudeCodeDiagnostics(verbose);
        return;
      }

      // If --codex flag is set, run Codex MCP diagnostics only
      if (argv.codex) {
        await runCodexDiagnostics(verbose);
        return;
      }

      // v12.0.0: Removed ax-cli diagnostics (deprecated)

      // If --glm flag is set, run GLM provider diagnostics only
      if (argv.glm) {
        await runGLMDiagnostics(verbose);
        return;
      }

      // If --grok flag is set, run Grok provider diagnostics only
      if (argv.grok) {
        await runGrokDiagnostics(verbose);
        return;
      }

      // If --memory flag is set, run memory diagnostics only
      if (argv.memory) {
        await runMemoryDiagnostics(verbose);
        return;
      }

      console.log(chalk.bold('\n🏥 AutomatosX Health Check\n'));

      const workingDir = process.cwd();
      const pathResolver = new PathResolver({
        projectDir: workingDir,
        workingDir,
        agentWorkspace: ''
      });

      const results: CheckResult[] = [];

      // Check Node.js version
      console.log(chalk.bold('⚙️  System Requirements'));
      results.push(...await checkNodeVersion(verbose));

      // Check system dependencies (ripgrep, git)
      if (runFull) {
        results.push(...await checkSystemDependencies(verbose));
      }

      // Load and validate configuration
      let config: AutomatosXConfig | null = null;
      console.log(chalk.bold('\n📋 Configuration'));
      try {
        const detectedProjectDir = await pathResolver.detectProjectRoot();
        config = await loadConfig(detectedProjectDir);
        results.push({
          name: 'Configuration',
          category: 'Setup',
          passed: true,
          message: 'Loaded successfully',
          details: verbose ? `Version: ${config.version}` : undefined
        });
        displayCheck(results[results.length - 1]!);

        // Validate configuration schema (--full mode)
        if (runFull) {
          results.push(...await checkConfigValidation(config, verbose));
        }
      } catch (error) {
        results.push({
          name: 'Configuration',
          category: 'Setup',
          passed: false,
          message: 'Configuration not found or invalid',
          fix: 'Run: ax setup',
          details: (error as Error).message
        });
        displayCheck(results[results.length - 1]!);
      }

      // Detect all installed AI providers
      console.log(chalk.bold('\n🔍 AI Provider Detection'));
      const detector = new ProviderDetector();
      const detectedProviders = await detector.detectAllWithInfo();

      // Display detection results
      for (const providerInfo of detectedProviders) {
        const spinner = ora();
        if (providerInfo.detected) {
          const versionStr = providerInfo.version ? ` (${providerInfo.version})` : '';
          spinner.succeed(chalk.green(`${ProviderDetector.formatProviderName(providerInfo.name)}: Installed${versionStr}`));
        } else {
          spinner.info(chalk.gray(`${ProviderDetector.formatProviderName(providerInfo.name)}: Not installed`));
        }
      }

      const foundProviders = detectedProviders.filter(p => p.detected);
      const notFoundProviders = detectedProviders.filter(p => !p.detected);

      console.log('');
      if (foundProviders.length > 0) {
        console.log(chalk.green(`✓ Detected ${foundProviders.length} AI provider(s)`));
      }
      if (notFoundProviders.length > 0) {
        console.log(chalk.gray(`  ${notFoundProviders.length} provider(s) not installed`));
      }

      // Check specific provider if requested
      if (argv.provider) {
        const providerMap: Record<string, string> = {
          'openai': 'codex',
          'gemini': 'gemini-cli',
          'claude': 'claude-code'
        };

        const providerKey = providerMap[argv.provider];
        const provider = detectedProviders.find(p => p.name === providerKey);

        if (provider && provider.detected) {
          console.log(chalk.bold(`\n${getProviderEmoji(argv.provider)} ${capitalize(argv.provider)} Provider Details`));

          if (argv.provider === 'openai') {
            results.push(...await checkOpenAIProvider(verbose));
          } else if (argv.provider === 'gemini') {
            results.push(...await checkGeminiProvider(verbose));
          } else if (argv.provider === 'claude') {
            results.push(...await checkClaudeProvider(verbose));
          }
        } else {
          console.log(chalk.yellow(`\n⚠️  ${capitalize(argv.provider)} CLI not found`));
          results.push({
            name: `${capitalize(argv.provider)} CLI`,
            category: 'Provider',
            passed: false,
            message: 'Not installed',
            fix: getProviderInstallCommand(argv.provider)
          });
        }
      }

      // Check file system
      console.log(chalk.bold('\n📁 File System'));
      results.push(...await checkFileSystem(workingDir, verbose));

      // Memory system checks (--full mode)
      if (runFull) {
        console.log(chalk.bold('\n💾 Memory System'));
        results.push(...await checkMemorySystem(workingDir, verbose));
      }

      // Session system checks (--full mode)
      if (runFull) {
        console.log(chalk.bold('\n📂 Session System'));
        results.push(...await checkSessionSystem(workingDir, verbose));
      }

      // Agent profile validation (--full mode)
      if (runFull) {
        console.log(chalk.bold('\n🤖 Agent Profiles'));
        results.push(...await checkAgentProfiles(workingDir, verbose));
      }

      // Network connectivity check (--full mode)
      if (runFull) {
        console.log(chalk.bold('\n🌐 Network Connectivity'));
        results.push(...await checkNetworkConnectivity(verbose));
      }

      // Disk space check (--full mode)
      if (runFull) {
        console.log(chalk.bold('\n💿 Disk Space'));
        results.push(...await checkDiskSpace(workingDir, verbose));
      }

      // Print summary
      printSummary(results, verbose);

      // Suggest fixes
      const failedChecks = results.filter(r => !r.passed);
      if (failedChecks.length > 0) {
        console.log(chalk.bold.yellow('\n💡 Suggested Fixes:\n'));
        failedChecks.forEach((check, i) => {
          if (check.fix) {
            console.log(chalk.yellow(`${i + 1}. ${check.name}:`));
            console.log(chalk.white(`   ${check.fix}\n`));
          }
        });

        // Exit with error code
        process.exit(1);
      } else {
        console.log(chalk.bold.green('\n✅ All checks passed! Your system is ready.\n'));
      }

    } catch (error) {
      printError(error as Error);
      process.exit(1);
    }
  }
};

/**
 * Check Node.js version (v10.1.0+)
 */
async function checkNodeVersion(verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    const nodeVersion = process.version; // e.g., "v24.0.0"
    const versionParts = nodeVersion.slice(1).split('.');
    const parsedMajor = parseInt(versionParts[0] || '0', 10);
    const majorVersion = isNaN(parsedMajor) ? 0 : parsedMajor;

    const isSupported = majorVersion >= 24;

    results.push({
      name: 'Node.js Version',
      category: 'System',
      passed: isSupported,
      message: isSupported
        ? `${nodeVersion} (supported)`
        : `${nodeVersion} (requires Node.js 24+)`,
      fix: isSupported ? undefined : 'Install Node.js 24 or later from: https://nodejs.org',
      details: verbose ? `Detected: ${nodeVersion}, Required: >=24.0.0` : undefined
    });

    displayCheck(results[0]!);

    // Warning for unsupported versions, but allow execution
    if (!isSupported) {
      console.log(chalk.yellow('   ⚠️  Warning: AutomatosX supports Node.js 24+'));
      console.log(chalk.yellow('   ⚠️  Execution will continue, but issues may occur\n'));
    }

  } catch (error) {
    results.push({
      name: 'Node.js Version',
      category: 'System',
      passed: false,
      message: 'Could not detect Node.js version',
      fix: 'Ensure Node.js is properly installed',
      details: verbose ? (error as Error).message : undefined
    });

    displayCheck(results[0]!);
  }

  return results;
}

/**
 * Get provider installation command
 */
function getProviderInstallCommand(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'npm install -g @openai/codex-cli\n   OR: brew install --cask codex';
    case 'gemini':
      return 'Follow installation guide at: https://ai.google.dev/gemini-api/docs/cli';
    case 'claude':
      return 'Install from: https://claude.com/code\n   OR: npm install -g @anthropic-ai/claude-cli';
    default:
      return 'Check provider documentation for installation instructions';
  }
}

/**
 * Check Codex CLI provider
 */
async function checkOpenAIProvider(verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: CLI Installation
  const cliCheck = await checkCommand('codex', '--version');
  results.push({
    name: 'CLI Installation',
    category: 'OpenAI',
    passed: cliCheck.success,
    message: cliCheck.success
      ? `Installed: ${cliCheck.output?.trim() || 'version unknown'}`
      : 'Codex CLI not found',
    fix: cliCheck.success ? undefined : 'npm install -g @openai/codex-cli\n   OR: brew install --cask codex',
    details: verbose ? cliCheck.error : undefined
  });

  // Check 2: Authentication (only if CLI is installed)
  if (cliCheck.success) {
    const authCheck = await checkOpenAIAuth();
    results.push({
      name: 'Authentication',
      category: 'OpenAI',
      passed: authCheck.success,
      message: authCheck.message,
      fix: authCheck.success ? undefined : authCheck.fix,
      details: verbose ? authCheck.details : undefined
    });
  }

  // Note: v8.2.0+ uses pure CLI mode - no API connectivity check needed

  // Display results
  results.forEach(r => displayCheck(r));

  return results;
}

/**
 * Generic CLI provider check - used by Gemini and Claude
 */
interface CliProviderConfig {
  name: string;
  command: string;
  category: string;
  installFix: string;
  helpDetails: string;
}

async function checkCliProvider(config: CliProviderConfig, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const cliCheck = await checkCommand(config.command, '--version');
  results.push({
    name: 'CLI Installation',
    category: config.category,
    passed: cliCheck.success,
    message: cliCheck.success
      ? `Installed: ${cliCheck.output?.trim() || 'version unknown'}`
      : `${config.name} CLI not found`,
    fix: cliCheck.success ? undefined : config.installFix,
    details: verbose ? cliCheck.error : undefined
  });

  if (cliCheck.success) {
    const helpCheck = await checkCommand(config.command, '--help');
    results.push({
      name: 'CLI Ready',
      category: config.category,
      passed: helpCheck.success,
      message: helpCheck.success ? 'CLI is functional' : 'CLI not responding',
      fix: helpCheck.success ? undefined : `Check ${config.name} CLI installation`,
      details: verbose ? (helpCheck.success ? config.helpDetails : helpCheck.error) : undefined
    });
  }

  results.forEach(r => displayCheck(r));
  return results;
}

/**
 * Check Gemini provider
 */
async function checkGeminiProvider(verbose: boolean): Promise<CheckResult[]> {
  return checkCliProvider({
    name: 'Gemini',
    command: 'gemini',
    category: 'Gemini',
    installFix: 'Follow installation guide at: https://ai.google.dev/gemini-api/docs/cli',
    helpDetails: 'Gemini CLI uses API keys from environment or config'
  }, verbose);
}

/**
 * Check Claude provider
 */
async function checkClaudeProvider(verbose: boolean): Promise<CheckResult[]> {
  return checkCliProvider({
    name: 'Claude',
    command: 'claude',
    category: 'Claude',
    installFix: 'npm install -g @anthropic-ai/claude-cli',
    helpDetails: 'Claude Code CLI authenticated via desktop app'
  }, verbose);
}

/**
 * Check file system setup
 */
async function checkFileSystem(workingDir: string, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check .automatosx directory
  const automatosxDir = `${workingDir}/.automatosx`;
  const automatosxExists = existsSync(automatosxDir);

  results.push({
    name: '.automatosx Directory',
    category: 'FileSystem',
    passed: automatosxExists,
    message: automatosxExists ? 'Exists' : 'Not found',
    fix: automatosxExists ? undefined : 'Run: ax init',
    details: verbose ? `Path: ${automatosxDir}` : undefined
  });

  // Check memory directory
  if (automatosxExists) {
    const memoryDir = `${automatosxDir}/memory`;
    const memoryExists = existsSync(memoryDir);

    results.push({
      name: 'Memory Directory',
      category: 'FileSystem',
      passed: memoryExists,
      message: memoryExists ? 'Exists' : 'Not found',
      fix: memoryExists ? undefined : 'Run: ax init',
      details: verbose ? `Path: ${memoryDir}` : undefined
    });
  }

  // Check write permissions
  try {
    await access(workingDir, constants.W_OK);
    results.push({
      name: 'Write Permissions',
      category: 'FileSystem',
      passed: true,
      message: 'Working directory is writable',
      details: verbose ? `Path: ${workingDir}` : undefined
    });
  } catch {
    results.push({
      name: 'Write Permissions',
      category: 'FileSystem',
      passed: false,
      message: 'Working directory is not writable',
      fix: 'Check directory permissions: ls -la',
      details: verbose ? `Path: ${workingDir}` : undefined
    });
  }

  results.forEach(r => displayCheck(r));
  return results;
}

/**
 * Check if command exists and works
 */
async function checkCommand(
  command: string,
  args: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const output = execSync(`${command} ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Check OpenAI authentication (v8.2.0+: Pure CLI mode only)
 */
async function checkOpenAIAuth(): Promise<{
  success: boolean;
  message: string;
  fix?: string;
  details?: string;
}> {
  // v8.2.0+: Pure CLI orchestration - we only use CLI, not API keys
  // Just check if codex login status works
  // NOTE: codex outputs to stderr, so we need to capture both stdout and stderr
  try {
    const output = execSync('codex login status 2>&1', {
      encoding: 'utf-8',
      timeout: 10000
    });

    const statusText = output.toLowerCase();

    // Check if logged in
    if (statusText.includes('logged in') || statusText.includes('authenticated')) {
      return {
        success: true,
        message: 'Authenticated via CLI',
        details: output.trim()
      };
    }

    return {
      success: false,
      message: 'Not authenticated',
      fix: 'Run: codex login',
      details: output.trim()
    };
  } catch (error) {
    const errorMsg = (error as Error).message.toLowerCase();

    if (errorMsg.includes('not logged in') || errorMsg.includes('not authenticated')) {
      return {
        success: false,
        message: 'Not authenticated',
        fix: 'Run: codex login',
        details: 'codex login status: not logged in'
      };
    }

    // Command failed but not due to auth
    return {
      success: false,
      message: 'Cannot verify authentication',
      fix: 'Run: codex login',
      details: errorMsg
    };
  }
}


/**
 * Display a single check result
 */
function displayCheck(result: CheckResult): void {
  const spinner = ora();

  if (result.passed) {
    spinner.succeed(chalk.green(`${result.name}: ${result.message}`));
  } else {
    spinner.fail(chalk.red(`${result.name}: ${result.message}`));
  }

  if (result.details && result.details.length > 0) {
    console.log(chalk.dim(`  └─ ${result.details}`));
  }
}

/**
 * Print summary of all checks
 */
function printSummary(results: CheckResult[], verbose: boolean): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.green(`✓ Passed: ${passed}/${total}`));

  if (failed > 0) {
    console.log(chalk.red(`✗ Failed: ${failed}/${total}`));
  }

  if (verbose) {
    console.log('\nDetailed Results:');

    const byCategory = results.reduce((acc, r) => {
      if (!acc[r.category]) {
        acc[r.category] = [];
      }
      acc[r.category]!.push(r);
      return acc;
    }, {} as Record<string, CheckResult[]>);

    Object.entries(byCategory).forEach(([category, checks]) => {
      console.log(chalk.bold(`\n${category}:`));
      checks.forEach(check => {
        const icon = check.passed ? '✓' : '✗';
        const color = check.passed ? chalk.green : chalk.red;
        console.log(color(`  ${icon} ${check.name}: ${check.message}`));
      });
    });
  }
}

/**
 * Get emoji for provider
 */
function getProviderEmoji(provider: string): string {
  switch (provider) {
    case 'openai': return '🤖';
    case 'gemini': return '✨';
    case 'claude': return '🧠';
    default: return '🔧';
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Run Claude Code integration diagnostics
 */
async function runClaudeCodeDiagnostics(verbose: boolean): Promise<void> {
  console.log(chalk.bold('\n🔍 Claude Code Integration Diagnostics\n'));

  const workingDir = process.cwd();
  const automatosxDir = join(workingDir, '.automatosx');

  // Check if .automatosx exists
  if (!existsSync(automatosxDir)) {
    console.log(chalk.red('✗ .automatosx directory not found'));
    console.log(chalk.yellow('\n💡 Setup Required:\n'));
    console.log(chalk.white('   Run: ax setup'));
    process.exit(1);
  }

  // Initialize ProfileLoader and TeamManager
  const teamManager = new TeamManager(join(automatosxDir, 'teams'));
  const profileLoader = new ProfileLoader(
    join(automatosxDir, 'agents'),
    undefined,
    teamManager
  );

  // Create setup helper
  const setupHelper = new ClaudeCodeSetupHelper({
    projectDir: workingDir,
    profileLoader
  });

  // Run diagnostics
  const diagnostics = await setupHelper.runDiagnostics();

  // Display results
  const checks: Array<{ name: string; passed: boolean; message: string; fix?: string }> = [];

  // Claude Code CLI
  checks.push({
    name: 'Claude Code CLI',
    passed: diagnostics.claudeCodeInstalled,
    message: diagnostics.claudeCodeInstalled
      ? `Installed (${diagnostics.claudeCodeVersion})`
      : 'Not found',
    fix: diagnostics.claudeCodeInstalled ? undefined : 'Install from: https://code.claude.com'
  });

  // MCP Server
  checks.push({
    name: 'MCP Server Binary',
    passed: diagnostics.mcpServerAvailable,
    message: diagnostics.mcpServerAvailable ? 'Available (automatosx-mcp)' : 'Not found',
    fix: diagnostics.mcpServerAvailable ? undefined : 'Run: npm install'
  });

  // MCP Registration
  checks.push({
    name: 'MCP Registration',
    passed: diagnostics.mcpServerRegistered,
    message: diagnostics.mcpServerRegistered ? 'Registered with Claude Code' : 'Not registered',
    fix: diagnostics.mcpServerRegistered ? undefined : 'Run: ax setup --claude-code'
  });

  // Manifests
  checks.push({
    name: 'Manifests',
    passed: diagnostics.manifestsGenerated,
    message: diagnostics.manifestsGenerated ? 'Generated (20 files)' : 'Not generated',
    fix: diagnostics.manifestsGenerated ? undefined : 'Run: npm run generate:claude-manifests'
  });

  // Manifest Validation
  if (diagnostics.manifestsGenerated) {
    checks.push({
      name: 'Manifest Validation',
      passed: diagnostics.manifestsValid,
      message: diagnostics.manifestsValid ? 'Valid' : 'Invalid',
      fix: diagnostics.manifestsValid ? undefined : 'Run: npm run generate:claude-manifests'
    });
  }

  // Display checks
  checks.forEach(check => {
    const spinner = ora();
    if (check.passed) {
      spinner.succeed(chalk.green(`${check.name}: ${check.message}`));
    } else {
      spinner.fail(chalk.red(`${check.name}: ${check.message}`));
    }
  });

  // Display errors and warnings
  if (diagnostics.errors.length > 0) {
    console.log(chalk.bold.red('\n❌ Errors:\n'));
    diagnostics.errors.forEach((error, i) => {
      console.log(chalk.red(`${i + 1}. ${error}`));
    });
  }

  if (diagnostics.warnings.length > 0 && verbose) {
    console.log(chalk.bold.yellow('\n⚠️  Warnings:\n'));
    diagnostics.warnings.forEach((warning, i) => {
      console.log(chalk.yellow(`${i + 1}. ${warning}`));
    });
  }

  // Summary
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.green(`✓ Passed: ${passedCount}/${totalCount}`));

  if (passedCount < totalCount) {
    console.log(chalk.red(`✗ Failed: ${totalCount - passedCount}/${totalCount}`));

    // Suggest fixes
    const failedChecks = checks.filter(c => !c.passed && c.fix);
    if (failedChecks.length > 0) {
      console.log(chalk.bold.yellow('\n💡 Suggested Fixes:\n'));
      failedChecks.forEach((check, i) => {
        console.log(chalk.yellow(`${i + 1}. ${check.name}:`));
        console.log(chalk.white(`   ${check.fix}\n`));
      });
    }

    process.exit(1);
  } else {
    console.log(chalk.bold.green('\n✅ All checks passed! Claude Code integration is ready.\n'));

    // Show next steps
    console.log(chalk.cyan('Next Steps:'));
    console.log(chalk.gray('  1. Restart Claude Code to activate integration'));
    console.log(chalk.gray('  2. Use slash commands: /agent-backend, /agent-frontend, etc.'));
    console.log(chalk.gray('  3. Use skill: /automatosx for orchestration\n'));
  }
}

/**
 * Run Codex CLI integration diagnostics
 *
 * NOTE: MCP integration is disabled in v10.3.2+
 * AutomatosX uses CLI mode (subprocess) for Codex integration.
 */
async function runCodexDiagnostics(verbose: boolean): Promise<void> {
  console.log(chalk.bold('\n🔍 Codex CLI Integration Diagnostics\n'));

  const workingDir = process.cwd();
  const automatosxDir = join(workingDir, '.automatosx');

  const checks: Array<{ name: string; passed: boolean; message: string; fix?: string; details?: string }> = [];

  // Check 1: Codex CLI Installation
  const codexCheck = await checkCommand('codex', '--version');
  checks.push({
    name: 'Codex CLI',
    passed: codexCheck.success,
    message: codexCheck.success
      ? `Installed (${codexCheck.output?.trim() || 'version unknown'})`
      : 'Not found',
    fix: codexCheck.success ? undefined : 'npm install -g @openai/codex-cli',
    details: verbose && !codexCheck.success ? codexCheck.error : undefined
  });

  // Check 2: Codex CLI authentication
  if (codexCheck.success) {
    const authCheck = await checkOpenAIAuth();
    checks.push({
      name: 'Codex Authentication',
      passed: authCheck.success,
      message: authCheck.message,
      fix: authCheck.success ? undefined : authCheck.fix,
      details: verbose ? authCheck.details : undefined
    });
  }

  // Check 3: .automatosx directory
  const automatosxExists = existsSync(automatosxDir);
  checks.push({
    name: 'AutomatosX Setup',
    passed: automatosxExists,
    message: automatosxExists ? 'Initialized (.automatosx/)' : 'Not initialized',
    fix: automatosxExists ? undefined : 'Run: ax setup'
  });

  // Check 4: OpenAI provider configured in ax.config.json
  let providerConfigured = false;
  const configPath = join(workingDir, 'ax.config.json');
  if (existsSync(configPath)) {
    try {
      const { readFile } = await import('fs/promises');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      providerConfigured = config?.providers?.openai?.enabled === true;
    } catch {
      // Ignore parse errors
    }
  }

  checks.push({
    name: 'Provider Configuration',
    passed: providerConfigured,
    message: providerConfigured ? 'OpenAI provider enabled in ax.config.json' : 'OpenAI provider not configured',
    fix: providerConfigured ? undefined : 'Run: ax setup',
    details: verbose ? 'CLI mode uses `codex` subprocess for execution' : undefined
  });

  // Check 5: Test CLI execution (simple version check)
  let cliWorks = false;
  if (codexCheck.success) {
    try {
      const { execSync } = await import('child_process');
      const output = execSync('codex --help 2>&1', { encoding: 'utf-8', timeout: 5000 });
      cliWorks = output.includes('codex') || output.includes('Usage');
    } catch {
      cliWorks = false;
    }
  }

  checks.push({
    name: 'CLI Execution',
    passed: cliWorks,
    message: cliWorks ? 'CLI responds correctly' : 'CLI not responding',
    fix: cliWorks ? undefined : 'Check Codex CLI installation: codex --help',
    details: verbose && cliWorks ? 'Integration uses: ax run <agent> "task" → codex subprocess' : undefined
  });

  // Display results
  checks.forEach(check => {
    const spinner = ora();
    if (check.passed) {
      spinner.succeed(chalk.green(`${check.name}: ${check.message}`));
    } else {
      spinner.fail(chalk.red(`${check.name}: ${check.message}`));
    }
    if (check.details) {
      console.log(chalk.dim(`  └─ ${check.details}`));
    }
  });

  // Summary
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.green(`✓ Passed: ${passedCount}/${totalCount}`));

  if (passedCount < totalCount) {
    console.log(chalk.red(`✗ Failed: ${totalCount - passedCount}/${totalCount}`));

    // Suggest fixes
    const failedChecks = checks.filter(c => !c.passed && c.fix);
    if (failedChecks.length > 0) {
      console.log(chalk.bold.yellow('\n💡 Suggested Fixes:\n'));
      failedChecks.forEach((check, i) => {
        console.log(chalk.yellow(`${i + 1}. ${check.name}:`));
        console.log(chalk.white(`   ${check.fix}\n`));
      });
    }

    process.exit(1);
  } else {
    console.log(chalk.bold.green('\n✅ All checks passed! Codex CLI integration is ready.\n'));

    // Show usage
    console.log(chalk.cyan('Usage:'));
    console.log(chalk.gray('  ax run backend "implement feature"     # Uses Codex as provider'));
    console.log(chalk.gray('  ax run quality "review code"           # Codex executes the task'));
    console.log(chalk.gray('  AUTOMATOSX_PROVIDER=openai ax run ...  # Force Codex provider\n'));

    console.log(chalk.cyan('Note:'));
    console.log(chalk.gray('  MCP integration is disabled (v10.3.2+). Using CLI mode instead.'));
    console.log(chalk.gray('  This is simpler and more reliable for production use.\n'));
  }
}

/**
 * Check system dependencies (ripgrep, git)
 */
async function checkSystemDependencies(verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check ripgrep
  const rgCheck = await checkCommand('rg', '--version');
  results.push({
    name: 'ripgrep',
    category: 'Dependencies',
    passed: rgCheck.success,
    message: rgCheck.success
      ? `Installed (${rgCheck.output?.split('\n')[0]?.trim() || 'version unknown'})`
      : 'Not found (optional)',
    fix: rgCheck.success ? undefined : 'Install ripgrep for faster file search: brew install ripgrep',
    details: verbose ? 'Used for fast file content searching' : undefined,
    warning: true // Not a critical failure
  });
  displayCheck(results[results.length - 1]!);

  // Check git
  const gitCheck = await checkCommand('git', '--version');
  results.push({
    name: 'git',
    category: 'Dependencies',
    passed: gitCheck.success,
    message: gitCheck.success
      ? `Installed (${gitCheck.output?.trim() || 'version unknown'})`
      : 'Not found',
    fix: gitCheck.success ? undefined : 'Install git: https://git-scm.com/downloads',
    details: verbose ? 'Required for version control operations' : undefined
  });
  displayCheck(results[results.length - 1]!);

  return results;
}

/**
 * Validate configuration schema
 */
async function checkConfigValidation(config: AutomatosXConfig, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check providers configuration
  const enabledProviders = Object.entries(config.providers || {})
    .filter(([_, cfg]) => cfg.enabled)
    .map(([name]) => name);

  results.push({
    name: 'Provider Configuration',
    category: 'Configuration',
    passed: enabledProviders.length > 0,
    message: enabledProviders.length > 0
      ? `${enabledProviders.length} provider(s) enabled`
      : 'No providers enabled',
    fix: enabledProviders.length > 0 ? undefined : 'Enable at least one provider in ax.config.json',
    details: verbose ? `Enabled: ${enabledProviders.join(', ') || 'none'}` : undefined
  });
  displayCheck(results[results.length - 1]!);

  // Check execution settings
  const defaultTimeout = config.execution?.defaultTimeout ?? 0;
  const hasValidTimeout = defaultTimeout > 0;
  results.push({
    name: 'Execution Settings',
    category: 'Configuration',
    passed: hasValidTimeout,
    message: hasValidTimeout
      ? `Timeout: ${Math.round(defaultTimeout / 60000)}min`
      : 'Invalid timeout configuration',
    fix: hasValidTimeout ? undefined : 'Set valid defaultTimeout in ax.config.json',
    details: verbose ? `Concurrency: ${config.execution?.concurrency?.maxConcurrentAgents ?? 4}` : undefined
  });
  displayCheck(results[results.length - 1]!);

  // Check memory settings
  const maxEntries = config.memory?.maxEntries ?? 0;
  const hasValidMemory = maxEntries > 0;
  results.push({
    name: 'Memory Settings',
    category: 'Configuration',
    passed: hasValidMemory,
    message: hasValidMemory
      ? `Max entries: ${maxEntries.toLocaleString()}`
      : 'Invalid memory configuration',
    fix: hasValidMemory ? undefined : 'Set valid memory settings in ax.config.json',
    details: verbose ? `Path: ${config.memory?.persistPath ?? '.automatosx/memory'}` : undefined
  });
  displayCheck(results[results.length - 1]!);

  return results;
}

/**
 * Check memory system health
 */
async function checkMemorySystem(workingDir: string, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const memoryDir = join(workingDir, '.automatosx', 'memory');
  const dbPath = join(memoryDir, 'memories.db');

  // Check memory database exists
  const dbExists = existsSync(dbPath);
  results.push({
    name: 'Memory Database',
    category: 'Memory',
    passed: dbExists,
    message: dbExists ? 'SQLite database exists' : 'Database not found',
    fix: dbExists ? undefined : 'Run: ax memory add "test" to initialize',
    details: verbose ? `Path: ${dbPath}` : undefined
  });
  displayCheck(results[results.length - 1]!);

  if (dbExists) {
    // Check database size
    try {
      const stats = statSync(dbPath);
      const sizeKB = Math.round(stats.size / 1024);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      results.push({
        name: 'Database Size',
        category: 'Memory',
        passed: true,
        message: sizeKB > 1024 ? `${sizeMB} MB` : `${sizeKB} KB`,
        details: verbose ? `Last modified: ${stats.mtime.toISOString()}` : undefined
      });
      displayCheck(results[results.length - 1]!);
    } catch (error) {
      results.push({
        name: 'Database Size',
        category: 'Memory',
        passed: false,
        message: 'Cannot read database stats',
        details: verbose ? (error as Error).message : undefined
      });
      displayCheck(results[results.length - 1]!);
    }

    // Check FTS5 and database integrity (using sqlite3 CLI if available)
    // Note: Escape path to prevent command injection from paths with special characters
    const escapedDbPath = `"${dbPath.replace(/"/g, '\\"')}"`;
    const sqliteCheck = await checkCommand('sqlite3', escapedDbPath + ' "PRAGMA integrity_check;" 2>&1');
    if (sqliteCheck.success) {
      const integrityOk = sqliteCheck.output?.includes('ok');
      results.push({
        name: 'Database Integrity',
        category: 'Memory',
        passed: integrityOk ?? false,
        message: integrityOk ? 'PRAGMA integrity_check: ok' : 'Integrity check failed',
        fix: integrityOk ? undefined : 'Database may be corrupted. Backup and recreate.',
        details: verbose ? sqliteCheck.output?.trim() : undefined
      });
      displayCheck(results[results.length - 1]!);
    }
  }

  return results;
}

/**
 * Check session system
 */
async function checkSessionSystem(workingDir: string, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const sessionDir = join(workingDir, '.automatosx', 'sessions');

  // Check session directory
  const sessionDirExists = existsSync(sessionDir);
  results.push({
    name: 'Session Directory',
    category: 'Sessions',
    passed: sessionDirExists,
    message: sessionDirExists ? 'Exists' : 'Not found (created on first use)',
    details: verbose ? `Path: ${sessionDir}` : undefined,
    warning: true
  });
  displayCheck(results[results.length - 1]!);

  if (sessionDirExists) {
    // Count session files
    try {
      const files = readdirSync(sessionDir).filter(f => f.endsWith('.json'));
      const sessionCount = files.length;
      results.push({
        name: 'Active Sessions',
        category: 'Sessions',
        passed: true,
        message: `${sessionCount} session file(s)`,
        details: verbose && sessionCount > 0 ? `Latest: ${files[files.length - 1]}` : undefined
      });
      displayCheck(results[results.length - 1]!);

      // Warn if too many sessions
      if (sessionCount > 50) {
        results.push({
          name: 'Session Cleanup',
          category: 'Sessions',
          passed: true,
          message: `${sessionCount} sessions (consider cleanup)`,
          fix: 'Run: ax session cleanup',
          warning: true
        });
        displayCheck(results[results.length - 1]!);
      }
    } catch (error) {
      results.push({
        name: 'Session Files',
        category: 'Sessions',
        passed: false,
        message: 'Cannot read session directory',
        details: verbose ? (error as Error).message : undefined
      });
      displayCheck(results[results.length - 1]!);
    }
  }

  return results;
}

/**
 * Check agent profiles
 */
async function checkAgentProfiles(workingDir: string, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const agentsDir = join(workingDir, '.automatosx', 'agents');

  // Check agents directory
  const agentsDirExists = existsSync(agentsDir);
  results.push({
    name: 'Agents Directory',
    category: 'Agents',
    passed: agentsDirExists,
    message: agentsDirExists ? 'Exists' : 'Not found',
    fix: agentsDirExists ? undefined : 'Run: ax setup',
    details: verbose ? `Path: ${agentsDir}` : undefined
  });
  displayCheck(results[results.length - 1]!);

  if (agentsDirExists) {
    // Count and validate agent profiles
    try {
      const files = readdirSync(agentsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      const agentCount = files.length;
      results.push({
        name: 'Agent Profiles',
        category: 'Agents',
        passed: agentCount > 0,
        message: `${agentCount} profile(s) found`,
        fix: agentCount > 0 ? undefined : 'Run: ax setup to create default agents',
        details: verbose ? `Profiles: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}` : undefined
      });
      displayCheck(results[results.length - 1]!);

      // Check for essential agents
      const essentialAgents = ['backend', 'frontend', 'quality', 'security'];
      const foundEssential = essentialAgents.filter(agent =>
        files.some(f => f.startsWith(agent))
      );
      results.push({
        name: 'Essential Agents',
        category: 'Agents',
        passed: foundEssential.length >= 3,
        message: `${foundEssential.length}/${essentialAgents.length} essential agents`,
        fix: foundEssential.length >= 3 ? undefined : 'Run: ax setup to create default agents',
        details: verbose ? `Found: ${foundEssential.join(', ')}` : undefined
      });
      displayCheck(results[results.length - 1]!);
    } catch (error) {
      results.push({
        name: 'Agent Profiles',
        category: 'Agents',
        passed: false,
        message: 'Cannot read agents directory',
        details: verbose ? (error as Error).message : undefined
      });
      displayCheck(results[results.length - 1]!);
    }
  }

  return results;
}

/**
 * Check a single API endpoint reachability
 */
async function checkApiEndpoint(
  name: string,
  url: string,
  verbose: boolean,
  options?: { fix?: string; warning?: boolean }
): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(timeout);

    return {
      name,
      category: 'Network',
      passed: response !== null,
      message: response ? 'Reachable' : 'Unreachable',
      fix: response ? undefined : options?.fix,
      details: verbose && response ? `Status: ${response.status}` : undefined
    };
  } catch (error) {
    return {
      name,
      category: 'Network',
      passed: false,
      message: 'Connection failed',
      fix: options?.fix,
      details: verbose ? (error as Error).message : undefined,
      warning: options?.warning
    };
  }
}

/**
 * Check network connectivity
 */
async function checkNetworkConnectivity(verbose: boolean): Promise<CheckResult[]> {
  const endpoints = [
    { name: 'Anthropic API', url: 'https://api.anthropic.com/v1/models', fix: 'Check internet connection or firewall settings' },
    { name: 'OpenAI API', url: 'https://api.openai.com/v1/models', warning: true }
  ];

  const results: CheckResult[] = [];
  for (const endpoint of endpoints) {
    const result = await checkApiEndpoint(endpoint.name, endpoint.url, verbose, {
      fix: endpoint.fix,
      warning: endpoint.warning
    });
    results.push(result);
    displayCheck(result);
  }

  return results;
}

/**
 * Check disk space
 */
async function checkDiskSpace(workingDir: string, verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    // Use df command to check disk space
    const dfOutput = execSync(`df -k "${workingDir}" | tail -1`, {
      encoding: 'utf-8',
      timeout: 5000
    });

    const parts = dfOutput.trim().split(/\s+/);
    // df -k output format: Filesystem 1K-blocks Used Available Use% Mounted
    // parts[3] is "Available" - use fallback if missing or invalid
    const rawAvailable = parts.length > 3 ? parts[3] : '0';
    const availableKB = parseInt(rawAvailable || '0', 10);
    const safeAvailableKB = isNaN(availableKB) ? 0 : availableKB;
    const availableMB = Math.round(safeAvailableKB / 1024);
    const availableGB = (safeAvailableKB / (1024 * 1024)).toFixed(2);

    const hasEnoughSpace = availableMB > 100; // At least 100MB free

    results.push({
      name: 'Available Disk Space',
      category: 'Disk',
      passed: hasEnoughSpace,
      message: availableMB > 1024 ? `${availableGB} GB available` : `${availableMB} MB available`,
      fix: hasEnoughSpace ? undefined : 'Free up disk space (need at least 100MB)',
      details: verbose ? `Working directory: ${workingDir}` : undefined
    });
    displayCheck(results[results.length - 1]!);

    // Check .automatosx directory size
    const automatosxDir = join(workingDir, '.automatosx');
    if (existsSync(automatosxDir)) {
      try {
        const duOutput = execSync(`du -sk "${automatosxDir}" 2>/dev/null | cut -f1`, {
          encoding: 'utf-8',
          timeout: 10000
        });
        const sizeKB = parseInt(duOutput.trim(), 10);

        // FIXED (v11.2.7): Validate parseInt result to prevent NaN display
        if (!isNaN(sizeKB)) {
          const sizeMB = (sizeKB / 1024).toFixed(2);

          results.push({
            name: '.automatosx Size',
            category: 'Disk',
            passed: true,
            message: sizeKB > 1024 ? `${sizeMB} MB` : `${sizeKB} KB`,
            details: verbose ? `Includes: memory, sessions, logs, agents` : undefined
          });
          displayCheck(results[results.length - 1]!);
        }
      } catch {
        // Ignore du errors
      }
    }
  } catch (error) {
    results.push({
      name: 'Disk Space',
      category: 'Disk',
      passed: true, // Don't fail if we can't check
      message: 'Could not determine disk space',
      details: verbose ? (error as Error).message : undefined,
      warning: true
    });
    displayCheck(results[results.length - 1]!);
  }

  return results;
}

// v12.0.0: Removed runAxCliDiagnostics (ax-cli deprecated)
// GLM and Grok diagnostics are handled by runGLMDiagnostics and runGrokDiagnostics

/**
 * Run memory system diagnostics (standalone)
 */
async function runMemoryDiagnostics(verbose: boolean): Promise<void> {
  console.log(chalk.bold('\n🔍 Memory System Diagnostics\n'));

  const workingDir = process.cwd();
  const results = await checkMemorySystem(workingDir, verbose);

  // Additional detailed checks for memory-only mode
  const memoryDir = join(workingDir, '.automatosx', 'memory');
  const dbPath = join(memoryDir, 'memories.db');

  if (existsSync(dbPath)) {
    // Escape path to prevent command injection from paths with special characters
    const escapedDbPath = `"${dbPath.replace(/"/g, '\\"')}"`;

    // Try to get memory count
    const countCheck = await checkCommand('sqlite3', escapedDbPath + ' "SELECT COUNT(*) FROM memories;" 2>&1');
    if (countCheck.success && countCheck.output) {
      const count = parseInt(countCheck.output.trim(), 10);
      if (!isNaN(count)) {
        const spinner = ora();
        spinner.succeed(chalk.green(`Memory Entries: ${count.toLocaleString()} entries`));
        if (verbose) {
          console.log(chalk.dim(`  └─ SQLite FTS5 full-text search enabled`));
        }
      }
    }

    // Check FTS5 table exists
    const ftsCheck = await checkCommand('sqlite3', escapedDbPath + ' "SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'memories_fts\';" 2>&1');
    if (ftsCheck.success) {
      const hasFts = ftsCheck.output?.includes('memories_fts');
      const spinner = ora();
      if (hasFts) {
        spinner.succeed(chalk.green('FTS5 Index: Enabled'));
      } else {
        spinner.warn(chalk.yellow('FTS5 Index: Not found (search may be slower)'));
      }
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.green(`✓ Passed: ${passed}/${results.length}`));

  if (failed > 0) {
    console.log(chalk.red(`✗ Failed: ${failed}/${results.length}`));

    const failedChecks = results.filter(r => !r.passed && r.fix);
    if (failedChecks.length > 0) {
      console.log(chalk.bold.yellow('\n💡 Suggested Fixes:\n'));
      failedChecks.forEach((check, i) => {
        console.log(chalk.yellow(`${i + 1}. ${check.name}:`));
        console.log(chalk.white(`   ${check.fix}\n`));
      });
    }

    process.exit(1);
  } else {
    console.log(chalk.bold.green('\n✅ Memory system is healthy!\n'));

    console.log(chalk.cyan('Commands:'));
    console.log(chalk.gray('  ax memory search "keyword"    # Search memories'));
    console.log(chalk.gray('  ax memory list --limit 10     # List recent memories'));
    console.log(chalk.gray('  ax memory export > backup.json  # Export for backup\n'));
  }
}

/**
 * Run GLM provider diagnostics
 * v12.0.0: CLI-based GLM provider (ax-glm)
 */
async function runGLMDiagnostics(verbose: boolean): Promise<void> {
  console.log(chalk.bold('\n🔍 GLM Provider Diagnostics (ax-glm CLI)\n'));

  const checks: Array<{ name: string; passed: boolean; message: string; fix?: string; details?: string }> = [];

  // Check 1: ax-glm CLI installed
  let cliInstalled = false;
  let cliVersion = '';
  try {
    cliVersion = execSync('ax-glm --version', { encoding: 'utf8', timeout: 5000 }).trim();
    cliInstalled = true;
  } catch {
    cliInstalled = false;
  }

  checks.push({
    name: 'ax-glm CLI',
    passed: cliInstalled,
    message: cliInstalled ? `Installed (${cliVersion})` : 'Not found',
    fix: cliInstalled ? undefined : 'Install: npm install -g @defai.digital/ax-glm',
    details: verbose && cliInstalled ? `Path: ${execSync('which ax-glm', { encoding: 'utf8' }).trim()}` : undefined
  });

  // Check 2: API Key configured (ax-glm checks ZAI_API_KEY internally)
  const apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY;
  checks.push({
    name: 'API Key',
    passed: !!apiKey,
    message: apiKey ? 'Configured' : 'Not found',
    fix: apiKey ? undefined : 'Set ZAI_API_KEY environment variable (ax-glm requires this)',
    details: verbose && apiKey ? `Key prefix: ${apiKey.substring(0, 8)}...` : undefined
  });

  // Check 3: Provider enabled in config
  let providerEnabled = false;
  const configPath = join(process.cwd(), 'ax.config.json');
  if (existsSync(configPath)) {
    try {
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      providerEnabled = config?.providers?.glm?.enabled === true;
    } catch {
      // Ignore parse errors
    }
  }

  checks.push({
    name: 'Provider Configuration',
    passed: providerEnabled,
    message: providerEnabled ? 'GLM provider enabled' : 'GLM provider not configured',
    fix: providerEnabled ? undefined : 'Add glm provider to ax.config.json'
  });

  // Check 4: Test CLI execution (only if installed and API key exists)
  if (cliInstalled && apiKey) {
    try {
      // Simple test - just check if ax-glm can parse a help command quickly
      execSync('ax-glm --help', { encoding: 'utf8', timeout: 5000 });
      checks.push({
        name: 'CLI Execution',
        passed: true,
        message: 'ax-glm responds correctly'
      });
    } catch (error) {
      checks.push({
        name: 'CLI Execution',
        passed: false,
        message: 'CLI execution failed',
        fix: 'Check ax-glm installation and permissions',
        details: verbose ? (error as Error).message : undefined
      });
    }
  }

  // Display results
  checks.forEach(check => {
    const spinner = ora();
    if (check.passed) {
      spinner.succeed(chalk.green(`${check.name}: ${check.message}`));
    } else {
      spinner.fail(chalk.red(`${check.name}: ${check.message}`));
    }
    if (check.details) {
      console.log(chalk.dim(`  └─ ${check.details}`));
    }
  });

  // Summary
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.green(`✓ Passed: ${passedCount}/${totalCount}`));

  if (passedCount < totalCount) {
    console.log(chalk.red(`✗ Failed: ${totalCount - passedCount}/${totalCount}`));

    const failedChecks = checks.filter(c => !c.passed && c.fix);
    if (failedChecks.length > 0) {
      console.log(chalk.bold.yellow('\n💡 Suggested Fixes:\n'));
      failedChecks.forEach((check, i) => {
        console.log(chalk.yellow(`${i + 1}. ${check.name}:`));
        console.log(chalk.white(`   ${check.fix}\n`));
      });
    }

    process.exit(1);
  } else {
    console.log(chalk.bold.green('\n✅ All checks passed! GLM provider is ready.\n'));

    console.log(chalk.cyan('Usage:'));
    console.log(chalk.gray('  ax run backend "task" --provider glm'));
    console.log(chalk.gray(''));
    console.log(chalk.cyan('Supported Models (via --model flag):'));
    console.log(chalk.gray('  • glm-4 (flagship model, default)'));
    console.log(chalk.gray('  • glm-4-plus (enhanced)'));
    console.log(chalk.gray('  • glm-4v (vision)'));
    console.log(chalk.gray('  • glm-4-flash (fast)'));
    console.log(chalk.gray('  • glm-4-air (cost-effective)\n'));
  }
}

/**
 * Run Grok/xAI provider diagnostics
 * v12.0.0: CLI-based Grok provider (ax-grok)
 */
async function runGrokDiagnostics(verbose: boolean): Promise<void> {
  console.log(chalk.bold('\n🔍 Grok Provider Diagnostics (ax-grok CLI)\n'));

  const checks: Array<{ name: string; passed: boolean; message: string; fix?: string; details?: string }> = [];

  // Check 1: ax-grok CLI installed
  let cliInstalled = false;
  let cliVersion = '';
  try {
    cliVersion = execSync('ax-grok --version', { encoding: 'utf8', timeout: 5000 }).trim();
    cliInstalled = true;
  } catch {
    cliInstalled = false;
  }

  checks.push({
    name: 'ax-grok CLI',
    passed: cliInstalled,
    message: cliInstalled ? `Installed (${cliVersion})` : 'Not found',
    fix: cliInstalled ? undefined : 'Install: npm install -g @defai.digital/ax-grok',
    details: verbose && cliInstalled ? `Path: ${execSync('which ax-grok', { encoding: 'utf8' }).trim()}` : undefined
  });

  // Check 2: API Key configured (ax-grok checks XAI_API_KEY internally)
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  checks.push({
    name: 'API Key',
    passed: !!apiKey,
    message: apiKey ? 'Configured' : 'Not found',
    fix: apiKey ? undefined : 'Set XAI_API_KEY environment variable (ax-grok requires this)',
    details: verbose && apiKey ? `Key prefix: ${apiKey.substring(0, 8)}...` : undefined
  });

  // Check 3: Provider enabled in config
  let providerEnabled = false;
  const configPath = join(process.cwd(), 'ax.config.json');
  if (existsSync(configPath)) {
    try {
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      providerEnabled = config?.providers?.grok?.enabled === true;
    } catch {
      // Ignore parse errors
    }
  }

  checks.push({
    name: 'Provider Configuration',
    passed: providerEnabled,
    message: providerEnabled ? 'Grok provider enabled' : 'Grok provider not configured',
    fix: providerEnabled ? undefined : 'Add grok provider to ax.config.json'
  });

  // Check 4: Test CLI execution (only if installed and API key exists)
  if (cliInstalled && apiKey) {
    try {
      // Simple test - just check if ax-grok can parse a help command quickly
      execSync('ax-grok --help', { encoding: 'utf8', timeout: 5000 });
      checks.push({
        name: 'CLI Execution',
        passed: true,
        message: 'ax-grok responds correctly'
      });
    } catch (error) {
      checks.push({
        name: 'CLI Execution',
        passed: false,
        message: 'CLI execution failed',
        fix: 'Check ax-grok installation and permissions',
        details: verbose ? (error as Error).message : undefined
      });
    }
  }

  // Display results
  checks.forEach(check => {
    const spinner = ora();
    if (check.passed) {
      spinner.succeed(chalk.green(`${check.name}: ${check.message}`));
    } else {
      spinner.fail(chalk.red(`${check.name}: ${check.message}`));
    }
    if (check.details) {
      console.log(chalk.dim(`  └─ ${check.details}`));
    }
  });

  // Summary
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.green(`✓ Passed: ${passedCount}/${totalCount}`));

  if (passedCount < totalCount) {
    console.log(chalk.red(`✗ Failed: ${totalCount - passedCount}/${totalCount}`));

    const failedChecks = checks.filter(c => !c.passed && c.fix);
    if (failedChecks.length > 0) {
      console.log(chalk.bold.yellow('\n💡 Suggested Fixes:\n'));
      failedChecks.forEach((check, i) => {
        console.log(chalk.yellow(`${i + 1}. ${check.name}:`));
        console.log(chalk.white(`   ${check.fix}\n`));
      });
    }

    process.exit(1);
  } else {
    console.log(chalk.bold.green('\n✅ All checks passed! Grok provider is ready.\n'));

    console.log(chalk.cyan('Usage:'));
    console.log(chalk.gray('  ax run backend "task" --provider grok'));
    console.log(chalk.gray(''));
    console.log(chalk.cyan('Supported Models (via --model flag):'));
    console.log(chalk.gray('  • grok-3 (latest flagship, default)'));
    console.log(chalk.gray('  • grok-3-mini (fast & efficient)'));
    console.log(chalk.gray('  • grok-2-vision (multimodal)'));
    console.log(chalk.gray('  • grok-2 (stable)\n'));
  }
}
