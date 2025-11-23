/**
 * Doctor Command - Pre-flight health checks and diagnostics
 *
 * Validates system setup and provides actionable fixes for common issues:
 * - Provider CLI installation and authentication
 * - Network connectivity
 * - Configuration validity
 * - File system permissions
 *
 * v6.0.7: Initial implementation for improved UX
 */

import type { CommandModule } from 'yargs';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { access, constants } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../core/config.js';
import { PathResolver } from '../../core/path-resolver.js';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
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
}

interface CheckResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  fix?: string;
  details?: string;
}

export const doctorCommand: CommandModule<Record<string, unknown>, DoctorOptions> = {
  command: 'doctor [provider]',
  describe: 'Run diagnostic checks and validate system setup',

  builder: (yargs) => {
    return yargs
      .positional('provider', {
        describe: 'Check specific provider (openai, gemini, claude) or all if omitted',
        type: 'string',
        choices: ['openai', 'gemini', 'claude']
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
      .example('ax doctor', 'Run all diagnostic checks')
      .example('ax doctor openai', 'Check only OpenAI provider')
      .example('ax doctor --verbose', 'Show detailed diagnostics')
      .example('ax doctor --fix', 'Auto-fix issues where possible')
      .example('ax doctor --claude-code', 'Check Claude Code integration');
  },

  handler: async (argv) => {
    try {
      // If --claude-code flag is set, run Claude Code diagnostics only
      if (argv.claudeCode) {
        await runClaudeCodeDiagnostics(argv.verbose ?? false);
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

      // Check Node.js version (v10.1.0+)
      console.log(chalk.bold('⚙️  System Requirements'));
      results.push(...await checkNodeVersion(argv.verbose ?? false));

      // Load configuration
      let config: AutomatosXConfig | null = null;
      try {
        const detectedProjectDir = await pathResolver.detectProjectRoot();
        config = await loadConfig(detectedProjectDir);
      } catch (error) {
        results.push({
          name: 'Configuration',
          category: 'Setup',
          passed: false,
          message: 'Configuration not found or invalid',
          fix: 'Run: ax setup',
          details: (error as Error).message
        });
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
      const verbose = argv.verbose ?? false;

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
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0', 10);

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
 * Check OpenAI Codex provider
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
 * Check Gemini provider
 */
async function checkGeminiProvider(verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const cliCheck = await checkCommand('gemini', '--version');
  results.push({
    name: 'CLI Installation',
    category: 'Gemini',
    passed: cliCheck.success,
    message: cliCheck.success
      ? `Installed: ${cliCheck.output?.trim() || 'version unknown'}`
      : 'Gemini CLI not found',
    fix: cliCheck.success ? undefined : 'Follow installation guide at: https://ai.google.dev/gemini-api/docs/cli',
    details: verbose ? cliCheck.error : undefined
  });

  if (cliCheck.success) {
    // Gemini CLI uses API keys directly - just check if help works
    const helpCheck = await checkCommand('gemini', '--help');
    results.push({
      name: 'CLI Ready',
      category: 'Gemini',
      passed: helpCheck.success,
      message: helpCheck.success ? 'CLI is functional' : 'CLI not responding',
      fix: helpCheck.success ? undefined : 'Check Gemini CLI installation: npm install -g @google/generative-ai-cli',
      details: verbose ? (helpCheck.success ? 'Gemini CLI uses API keys from environment or config' : helpCheck.error) : undefined
    });
  }

  results.forEach(r => displayCheck(r));
  return results;
}

/**
 * Check Claude provider
 */
async function checkClaudeProvider(verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const cliCheck = await checkCommand('claude', '--version');
  results.push({
    name: 'CLI Installation',
    category: 'Claude',
    passed: cliCheck.success,
    message: cliCheck.success
      ? `Installed: ${cliCheck.output?.trim() || 'version unknown'}`
      : 'Claude CLI not found',
    fix: cliCheck.success ? undefined : 'npm install -g @anthropic-ai/claude-cli',
    details: verbose ? cliCheck.error : undefined
  });

  if (cliCheck.success) {
    // Claude Code CLI is authenticated when installed - just check if help works
    const helpCheck = await checkCommand('claude', '--help');
    results.push({
      name: 'CLI Ready',
      category: 'Claude',
      passed: helpCheck.success,
      message: helpCheck.success ? 'CLI is functional' : 'CLI not responding',
      fix: helpCheck.success ? undefined : 'Check Claude Code CLI installation',
      details: verbose ? (helpCheck.success ? 'Claude Code CLI authenticated via desktop app' : helpCheck.error) : undefined
    });
  }

  results.forEach(r => displayCheck(r));
  return results;
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
