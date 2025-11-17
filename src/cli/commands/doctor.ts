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

interface DoctorOptions {
  provider?: string;
  verbose?: boolean;
  fix?: boolean;
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
        describe: 'Check specific provider (openai, gemini, claude, grok) or all if omitted',
        type: 'string',
        choices: ['openai', 'gemini', 'claude', 'grok']
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
      .example('ax doctor', 'Run all diagnostic checks')
      .example('ax doctor openai', 'Check only OpenAI provider')
      .example('ax doctor --verbose', 'Show detailed diagnostics')
      .example('ax doctor --fix', 'Auto-fix issues where possible');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.bold('\n🏥 AutomatosX Health Check\n'));

      const workingDir = process.cwd();
      const pathResolver = new PathResolver({
        projectDir: workingDir,
        workingDir,
        agentWorkspace: ''
      });

      const results: CheckResult[] = [];

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
          fix: 'Run: ax init',
          details: (error as Error).message
        });
      }

      // Check providers
      const providersToCheck = argv.provider
        ? [argv.provider]
        : ['openai', 'gemini', 'claude', 'grok'];

      const verbose = argv.verbose ?? false;

      for (const provider of providersToCheck) {
        // Only check if enabled in config
        if (config && !config.providers[provider as keyof typeof config.providers]?.enabled) {
          if (verbose) {
            console.log(chalk.dim(`⊘ ${provider}: Disabled in configuration (skipping)`));
          }
          continue;
        }

        console.log(chalk.bold(`\n${getProviderEmoji(provider)} ${capitalize(provider)} Provider`));

        if (provider === 'openai') {
          results.push(...await checkOpenAIProvider(verbose));
        } else if (provider === 'gemini') {
          results.push(...await checkGeminiProvider(verbose));
        } else if (provider === 'claude') {
          results.push(...await checkClaudeProvider(verbose));
        } else if (provider === 'grok') {
          results.push(...await checkGrokProvider(verbose));
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
 * Check Grok CLI provider
 */
async function checkGrokProvider(verbose: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const cliCheck = await checkCommand('grok', '--version');
  results.push({
    name: 'CLI Installation',
    category: 'Grok',
    passed: cliCheck.success,
    message: cliCheck.success
      ? `Installed: ${cliCheck.output?.trim() || 'version unknown'}`
      : 'Grok CLI not found',
    fix: cliCheck.success ? undefined : 'npm install -g @vibe-kit/grok-cli',
    details: verbose ? cliCheck.error : undefined
  });

  if (cliCheck.success) {
    // Grok CLI can use environment variables or config files - just check if help works
    const helpCheck = await checkCommand('grok', '--help');
    results.push({
      name: 'CLI Ready',
      category: 'Grok',
      passed: helpCheck.success,
      message: helpCheck.success ? 'CLI is functional' : 'CLI not responding',
      fix: helpCheck.success ? undefined : 'Check Grok CLI installation: npm install -g @vibe-kit/grok-cli',
      details: verbose ? (helpCheck.success ? 'Grok CLI uses API keys from environment (GROK_API_KEY) or config files' : helpCheck.error) : undefined
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
    case 'grok': return '🚀';
    default: return '🔧';
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
