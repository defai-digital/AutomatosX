/**
 * Integration Mode Wizard - Intelligent mode selection for OpenAI provider
 *
 * Helps users choose between CLI and SDK integration modes based on:
 * - Environment detection (firewall, API key)
 * - User preferences
 * - Performance requirements
 * - Security constraints
 *
 * v6.0.7: Phase 2 - Smart integration mode selection
 */

import { logger } from '../shared/logging/logger.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import type { IntegrationMode } from '../types/config.js';
import { TIMEOUTS } from '../core/validation-limits.js';

export interface EnvironmentDetection {
  hasCodexCLI: boolean;
  hasAPIKey: boolean;
  canReachAPI: boolean;
  isBehindFirewall: boolean;
  confidence: 'low' | 'medium' | 'high';
  recommendedMode: IntegrationMode;
  reasoning: string[];
}

export interface ModeSelectionOptions {
  skipPrompt?: boolean;
  autoDetect?: boolean;
  verbose?: boolean;
}

/**
 * Detect environment and recommend integration mode
 */
export async function detectEnvironment(): Promise<EnvironmentDetection> {
  const checks = {
    hasCodexCLI: await checkCodexCLI(),
    hasAPIKey: checkAPIKey(),
    canReachAPI: await checkAPIConnectivity(),
    isBehindFirewall: false
  };

  // Infer firewall if API key exists but can't reach API
  checks.isBehindFirewall = checks.hasAPIKey && !checks.canReachAPI;

  const reasoning: string[] = [];
  let recommendedMode: IntegrationMode = 'cli'; // Default
  let confidence: 'low' | 'medium' | 'high' = 'medium';

  // Decision logic with reasoning
  if (checks.isBehindFirewall) {
    recommendedMode = 'cli';
    confidence = 'high';
    reasoning.push('🔒 Behind firewall detected - CLI mode required');
    reasoning.push('   API connectivity blocked, CLI subprocess will work');
  } else if (!checks.hasCodexCLI && checks.hasAPIKey) {
    recommendedMode = 'sdk';
    confidence = 'high';
    reasoning.push('🚀 Codex CLI not installed but API key available');
    reasoning.push('   SDK mode will be faster and easier to setup');
  } else if (checks.hasCodexCLI && !checks.hasAPIKey) {
    recommendedMode = 'cli';
    confidence = 'high';
    reasoning.push('🖥️  Codex CLI installed, no API key found');
    reasoning.push('   CLI mode will use codex authentication');
  } else if (checks.hasCodexCLI && checks.hasAPIKey && checks.canReachAPI) {
    recommendedMode = 'sdk';
    confidence = 'medium';
    reasoning.push('⚡ Both modes available - SDK recommended for performance');
    reasoning.push('   ~100ms faster per request, native integration');
  } else if (!checks.hasCodexCLI && !checks.hasAPIKey) {
    recommendedMode = 'cli';
    confidence = 'low';
    reasoning.push('⚠️  Neither CLI nor API key detected');
    reasoning.push('   CLI mode selected as default, requires setup');
  }

  return {
    ...checks,
    confidence,
    recommendedMode,
    reasoning
  };
}

/**
 * Check if Codex CLI is installed
 */
async function checkCodexCLI(): Promise<boolean> {
  try {
    execSync('codex --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: TIMEOUTS.QUICK_COMMAND
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if OPENAI_API_KEY is set
 */
function checkAPIKey(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
}

/**
 * Check if can reach OpenAI API
 */
async function checkAPIConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok || response.status === 401; // 401 means we reached API
  } catch {
    return false;
  }
}

/**
 * Show integration mode wizard
 */
export async function showModeWizard(
  currentMode?: IntegrationMode,
  options: ModeSelectionOptions = {}
): Promise<IntegrationMode> {
  const env = await detectEnvironment();

  // If auto-detect requested, return recommendation
  if (options.autoDetect) {
    if (options.verbose) {
      console.log(chalk.bold('\n🔍 Auto-detecting integration mode...\n'));
      env.reasoning.forEach(line => console.log(chalk.dim(line)));
      console.log(chalk.green(`\n✓ Selected: ${env.recommendedMode} mode\n`));
    }
    return env.recommendedMode;
  }

  // Show current environment status
  console.log(chalk.bold('\n🔍 OpenAI Integration Mode Selection\n'));
  console.log('Environment detected:');
  console.log(chalk.dim('━'.repeat(50)));
  console.log(`Codex CLI: ${env.hasCodexCLI ? chalk.green('✓ Installed') : chalk.red('✗ Not found')}`);
  console.log(`API Key: ${env.hasAPIKey ? chalk.green('✓ Configured') : chalk.yellow('⚠ Not set')}`);
  console.log(`API Access: ${env.canReachAPI ? chalk.green('✓ Available') : chalk.red('✗ Blocked')}`);

  if (env.isBehindFirewall) {
    console.log(chalk.yellow('\n⚠️  Firewall detected - API connectivity blocked'));
  }

  console.log(chalk.dim('━'.repeat(50)));

  // Show recommendation
  console.log(`\n${getModeEmoji(env.confidence)} Recommendation: ${chalk.bold(env.recommendedMode.toUpperCase())} mode`);
  env.reasoning.forEach(line => console.log(chalk.dim(line)));

  // If skip prompt, use recommendation
  if (options.skipPrompt) {
    console.log(chalk.green(`\n✓ Using ${env.recommendedMode} mode\n`));
    return env.recommendedMode;
  }

  // Interactive prompt
  console.log('');
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Which integration mode do you want to use?',
      default: env.recommendedMode,
      choices: [
        {
          name: `${chalk.bold('CLI Mode')} (Recommended for most users)
  ${chalk.dim('→ Uses codex CLI subprocess')}
  ${chalk.dim('→ Works behind corporate firewalls')}
  ${chalk.dim('→ No API key needed if logged in to codex')}
  ${chalk.dim('→ Slightly slower (~100ms overhead per request)')}`,
          value: 'cli',
          short: 'CLI Mode'
        },
        {
          name: `${chalk.bold('SDK Mode')} (Advanced - requires API access)
  ${chalk.dim('→ Direct API calls via OpenAI SDK')}
  ${chalk.dim('→ Faster (~100ms saved per request)')}
  ${chalk.dim('→ Requires OPENAI_API_KEY environment variable')}
  ${chalk.dim('→ May not work behind corporate firewalls')}`,
          value: 'sdk',
          short: 'SDK Mode'
        },
        {
          name: `${chalk.bold('Auto')} (Let AutomatosX decide)
  ${chalk.dim('→ Automatically selects best mode based on environment')}
  ${chalk.dim('→ Adapts to firewall/API changes')}
  ${chalk.dim('→ Recommended if environment changes frequently')}`,
          value: 'auto',
          short: 'Auto Mode'
        }
      ]
    }
  ]);

  // Show what was selected
  console.log(chalk.green(`\n✓ ${getModeDescription(answer.mode)}\n`));

  return answer.mode;
}

/**
 * Get confidence emoji
 */
function getModeEmoji(confidence: 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'high': return '✓';
    case 'medium': return '📊';
    case 'low': return '⚠️';
  }
}

/**
 * Get mode description
 */
function getModeDescription(mode: IntegrationMode): string {
  switch (mode) {
    case 'cli':
      return 'CLI Mode selected - Using codex subprocess';
    case 'sdk':
      return 'SDK Mode selected - Using direct API calls';
    case 'auto':
      return 'Auto Mode selected - Will adapt based on environment';
    case 'mcp':
      return 'MCP Mode selected - Using MCP protocol (experimental)';
    default:
      return 'Unknown mode selected';
  }
}

/**
 * Check if wizard should be shown
 *
 * Show wizard if:
 * - Mode not set in config
 * - Mode is 'auto' and this is first run
 * - Mode conflicts with environment (e.g., SDK mode but behind firewall)
 */
export async function shouldShowWizard(
  currentMode?: IntegrationMode,
  isFirstRun: boolean = false
): Promise<boolean> {
  // No mode set or first run with auto mode
  if (!currentMode || (currentMode === 'auto' && isFirstRun)) {
    return true;
  }

  // Check for conflicts
  const env = await detectEnvironment();

  // SDK mode but behind firewall
  if (currentMode === 'sdk' && env.isBehindFirewall) {
    logger.warn('SDK mode configured but firewall detected', {
      currentMode,
      canReachAPI: env.canReachAPI
    });
    return true;
  }

  // CLI mode but no CLI installed and has API key
  if (currentMode === 'cli' && !env.hasCodexCLI && env.hasAPIKey && env.canReachAPI) {
    logger.info('CLI mode configured but Codex CLI not found, SDK available', {
      currentMode,
      hasCodexCLI: env.hasCodexCLI,
      hasAPIKey: env.hasAPIKey
    });
    return true;
  }

  return false;
}

/**
 * Resolve auto mode to actual mode
 *
 * BUG FIX: Properly handle 'mcp' and 'auto' modes instead of unsafe type casting.
 * Previously cast any IntegrationMode to 'cli' | 'sdk' which was incorrect
 * when recommendedMode was 'mcp' or 'auto'.
 */
export async function resolveAutoMode(): Promise<'cli' | 'sdk'> {
  const env = await detectEnvironment();

  // BUG FIX: Explicitly handle each possible mode
  switch (env.recommendedMode) {
    case 'cli':
      return 'cli';
    case 'sdk':
      return 'sdk';
    case 'mcp':
      // MCP mode falls back to CLI (subprocess-based)
      logger.debug('MCP mode recommended but resolving to CLI for auto-resolution');
      return 'cli';
    case 'auto':
    default:
      // Auto or unknown defaults to CLI (safest option)
      return 'cli';
  }
}

/**
 * Get mode with auto-resolution
 *
 * BUG FIX: Properly handle 'mcp' mode instead of unsafe type casting.
 */
export async function getModeWithAutoResolution(
  configuredMode?: IntegrationMode
): Promise<'cli' | 'sdk'> {
  if (!configuredMode || configuredMode === 'auto') {
    return await resolveAutoMode();
  }

  // BUG FIX: Handle 'mcp' mode explicitly
  if (configuredMode === 'mcp') {
    logger.debug('MCP mode configured, resolving to CLI');
    return 'cli';
  }

  return configuredMode;
}
