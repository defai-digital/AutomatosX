/**
 * Doctor command - System health check and diagnostics
 *
 * Checks:
 * - Node.js version
 * - Provider CLI availability (claude, gemini, codex, ax-grok, opencode, local-llm)
 * - File system permissions
 * - Configuration validity
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CommandResult, CLIOptions } from '../types.js';
import { DATA_DIR_NAME, TIMEOUT_HEALTH_CHECK } from '@defai.digital/contracts';
import { COLORS } from '../utils/terminal.js';

const execAsync = promisify(exec);

/**
 * Result of a single diagnostic check
 */
export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
  details?: string;
}

/**
 * Provider CLI configuration for doctor checks
 */
export interface ProviderCheck {
  id: string;
  name: string;
  command: string;
  installHint: string;
}

/**
 * AI provider CLIs to check
 */
export const PROVIDER_CHECKS: readonly ProviderCheck[] = [
  {
    id: 'claude',
    name: 'Claude',
    command: 'claude',
    installHint: 'npm install -g @anthropic-ai/claude-code',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    command: 'gemini',
    installHint: 'npm install -g @anthropic-ai/gemini-cli',
  },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    installHint: 'npm install -g @openai/codex',
  },
  {
    id: 'grok',
    name: 'Grok',
    command: 'ax-grok',
    installHint: 'npm install -g ax-grok',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    installHint: 'npm install -g opencode',
  },
  {
    id: 'local-llm',
    name: 'Local LLM',
    command: 'ax-cli',
    installHint: 'npm install -g @defai.digital/ax-cli',
  },
];

/**
 * IDE integrations to check (not providers, but MCP-enabled IDEs)
 */
export const IDE_CHECKS: readonly ProviderCheck[] = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    command: 'antigravity',
    installHint: 'Install from https://antigravity.google',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    command: 'cursor',
    installHint: 'Install from https://cursor.com',
  },
];

/**
 * Minimum required Node.js version
 */
const MIN_NODE_VERSION = 18;

/**
 * Status messages for provider/IDE checks
 */
const STATUS_MESSAGES = {
  notDetected: 'not detected',
  notInstalled: 'not installed',
  installed: 'installed',
  noCredentials: 'no credentials',
} as const;

/**
 * Platform-specific command lookup utilities
 */
const PLATFORM_COMMANDS = {
  which: 'which',
  where: 'where',
} as const;

/**
 * Version flag for CLI commands
 */
const VERSION_FLAG = '--version';

/** Timeout for credential checks - use standard health check timeout */
const CREDENTIAL_CHECK_TIMEOUT = TIMEOUT_HEALTH_CHECK;

/**
 * Doctor-specific status icons
 */
const DOCTOR_ICONS = {
  pass: `${COLORS.green}\u2713${COLORS.reset}`,
  fail: `${COLORS.red}\u2717${COLORS.reset}`,
  warn: `${COLORS.yellow}\u26A0${COLORS.reset}`,
};

/**
 * Gets the platform-specific command lookup utility
 */
function getWhichCommand(): string {
  return process.platform === 'win32' ? PLATFORM_COMMANDS.where : PLATFORM_COMMANDS.which;
}

/**
 * Checks if a command is available on PATH
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(`${getWhichCommand()} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of a CLI command
 */
async function getCommandVersion(command: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`${command} ${VERSION_FLAG} 2>&1`);
    const versionMatch = /(\d+\.\d+\.\d+)/.exec(stdout);
    return versionMatch?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Gets the path to a command
 */
async function getCommandPath(command: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`${getWhichCommand()} ${command}`);
    return stdout.trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

/**
 * Checks if opencode has credentials configured
 * Returns number of credentials or -1 if check failed
 */
async function checkOpencodeCredentials(): Promise<number> {
  try {
    const { stdout } = await execAsync('opencode auth list 2>&1', { timeout: CREDENTIAL_CHECK_TIMEOUT });
    // Parse output like "0 credentials" or "2 credentials"
    const match = /(\d+)\s*credentials?/i.exec(stdout);
    if (match?.[1] !== undefined) {
      return parseInt(match[1], 10);
    }
    return -1;
  } catch {
    return -1;
  }
}

// ============================================================================
// GUI App Detection
// ============================================================================

/** Common application directories by platform */
const APP_DIRECTORIES = {
  darwin: {
    system: '/Applications',
    user: join(homedir(), 'Applications'),
  },
  win32: {
    programs: join(homedir(), 'AppData', 'Local', 'Programs'),
  },
  linux: {
    system: '/usr/share',
    user: join(homedir(), '.local', 'share'),
  },
} as const;

/** Common config directories */
const CONFIG_DIRECTORIES = {
  gemini: join(homedir(), '.gemini'),
} as const;

interface GUIAppConfig {
  appPaths: {
    darwin: string[];
    win32: string[];
    linux: string[];
  };
  fallbackConfigDir?: string;
}

const GUI_APP_CONFIGS: Record<string, GUIAppConfig> = {
  antigravity: {
    appPaths: {
      darwin: [
        join(APP_DIRECTORIES.darwin.system, 'Antigravity.app'),
        join(APP_DIRECTORIES.darwin.system, 'Google Antigravity.app'),
        join(APP_DIRECTORIES.darwin.user, 'Antigravity.app'),
        join(APP_DIRECTORIES.darwin.user, 'Google Antigravity.app'),
      ],
      win32: [
        join(APP_DIRECTORIES.win32.programs, 'Antigravity', 'Antigravity.exe'),
        join(APP_DIRECTORIES.win32.programs, 'Google Antigravity', 'Antigravity.exe'),
      ],
      linux: [
        join(APP_DIRECTORIES.linux.system, 'antigravity'),
        join(APP_DIRECTORIES.linux.user, 'antigravity'),
      ],
    },
    fallbackConfigDir: join(CONFIG_DIRECTORIES.gemini, 'antigravity'),
  },
  cursor: {
    appPaths: {
      darwin: [
        join(APP_DIRECTORIES.darwin.system, 'Cursor.app'),
        join(APP_DIRECTORIES.darwin.user, 'Cursor.app'),
      ],
      win32: [
        join(APP_DIRECTORIES.win32.programs, 'Cursor', 'Cursor.exe'),
      ],
      linux: [
        join(APP_DIRECTORIES.linux.system, 'cursor'),
        join(APP_DIRECTORIES.linux.user, 'cursor'),
      ],
    },
  },
};

/**
 * Checks a single path for existence, returns path if found
 */
async function checkPathExists(pathToCheck: string): Promise<string | null> {
  try {
    await stat(pathToCheck);
    return pathToCheck;
  } catch {
    return null;
  }
}

/**
 * Checks if a GUI app is installed by looking for app paths or config directory
 * Uses parallel checking with early termination for better performance
 */
async function checkGUIAppInstalled(appId: string): Promise<{ installed: boolean; path?: string }> {
  const config = GUI_APP_CONFIGS[appId];
  if (!config) {
    return { installed: false };
  }

  // Get paths for current platform
  const platform = process.platform as 'darwin' | 'win32' | 'linux';
  const appPaths = config.appPaths[platform] ?? config.appPaths.linux;

  // Include fallback config directory in paths to check
  const allPaths = config.fallbackConfigDir
    ? [...appPaths, config.fallbackConfigDir]
    : appPaths;

  // Check all paths in parallel - first found wins
  const results = await Promise.all(allPaths.map(checkPathExists));

  // Find first successful result (maintains priority order)
  const foundPath = results.find((result): result is string => result !== null);

  if (foundPath) {
    return { installed: true, path: foundPath };
  }

  return { installed: false };
}

/**
 * Checks Node.js version
 */
function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0] ?? '0', 10);

  if (major >= MIN_NODE_VERSION) {
    return {
      name: 'Node.js version',
      status: 'pass',
      message: version,
    };
  }

  return {
    name: 'Node.js version',
    status: 'fail',
    message: `${version} (requires ${String(MIN_NODE_VERSION)}+)`,
    fix: `Install Node.js ${String(MIN_NODE_VERSION)}+ from https://nodejs.org`,
  };
}

/** IDs of GUI apps (derived from IDE_CHECKS) */
const GUI_APP_IDS = new Set(IDE_CHECKS.map(ide => ide.id));

/**
 * Checks a single provider CLI or GUI app
 * Exported for use by other commands like 'setup'
 */
export async function checkProviderCLI(provider: ProviderCheck): Promise<CheckResult> {
  const isGUIApp = GUI_APP_IDS.has(provider.id);

  // For GUI apps, first try CLI if available, then check app installation
  if (isGUIApp) {
    // Try CLI command first (some GUI apps like Cursor have CLI)
    const cliAvailable = await isCommandAvailable(provider.command);
    if (cliAvailable) {
      // Parallelize version and path checks for GUI CLI
      const [versionResult, pathResult] = await Promise.allSettled([
        getCommandVersion(provider.command),
        getCommandPath(provider.command),
      ]);
      const version = versionResult.status === 'fulfilled' ? versionResult.value : undefined;
      const cmdPath = pathResult.status === 'fulfilled' ? pathResult.value : undefined;

      const result: CheckResult = {
        name: `${provider.name} (GUI)`,
        status: 'pass',
        message: version !== undefined ? `v${version}` : STATUS_MESSAGES.installed,
      };
      if (cmdPath !== undefined) {
        result.details = cmdPath;
      }
      return result;
    }

    // Fall back to checking GUI app installation
    const { installed, path: appPath } = await checkGUIAppInstalled(provider.id);
    if (!installed) {
      return {
        name: `${provider.name} (GUI)`,
        status: 'fail',
        message: STATUS_MESSAGES.notDetected,
        fix: provider.installHint,
      };
    }

    const result: CheckResult = {
      name: `${provider.name} (GUI)`,
      status: 'pass',
      message: STATUS_MESSAGES.installed,
    };
    if (appPath !== undefined) {
      result.details = appPath;
    }
    return result;
  }

  // Standard CLI provider check
  const available = await isCommandAvailable(provider.command);

  if (!available) {
    return {
      name: `${provider.name} CLI (${provider.command})`,
      status: 'fail',
      message: STATUS_MESSAGES.notInstalled,
      fix: provider.installHint,
    };
  }

  // Parallelize version and path checks using Promise.allSettled for fault tolerance
  const [versionResult, pathResult] = await Promise.allSettled([
    getCommandVersion(provider.command),
    getCommandPath(provider.command),
  ]);

  const version = versionResult.status === 'fulfilled' ? versionResult.value : undefined;
  const cmdPath = pathResult.status === 'fulfilled' ? pathResult.value : undefined;

  const result: CheckResult = {
    name: `${provider.name} CLI (${provider.command})`,
    status: 'pass',
    message: version !== undefined ? `v${version}` : STATUS_MESSAGES.installed,
  };

  if (cmdPath !== undefined) {
    result.details = cmdPath;
  }

  // Special check for opencode: verify credentials are configured
  if (provider.id === 'opencode') {
    const credentialCount = await checkOpencodeCredentials();
    if (credentialCount === 0) {
      result.status = 'warn';
      result.message = version !== undefined
        ? `v${version} (${STATUS_MESSAGES.noCredentials})`
        : `${STATUS_MESSAGES.installed} (${STATUS_MESSAGES.noCredentials})`;
      result.fix = 'Run: opencode auth login';
    }
  }

  return result;
}

/**
 * Checks all provider CLIs
 * Exported for use by other commands like 'setup'
 */
export async function checkAllProviders(
  specificProvider?: string
): Promise<CheckResult[]> {
  const providers = specificProvider !== undefined
    ? PROVIDER_CHECKS.filter((providerCheck) => providerCheck.id === specificProvider)
    : PROVIDER_CHECKS;

  const results = await Promise.all(
    providers.map((provider) => checkProviderCLI(provider))
  );

  return results;
}

/**
 * Checks all IDE integrations
 * Exported for use by other commands like 'init'
 */
export async function checkAllIDEs(): Promise<CheckResult[]> {
  const results = await Promise.all(
    IDE_CHECKS.map((ide) => checkProviderCLI(ide))
  );

  return results;
}

/**
 * Checks .automatosx directory
 */
async function checkAutomatosxDir(): Promise<CheckResult> {
  const dir = join(homedir(), DATA_DIR_NAME);

  try {
    const stats = await stat(dir);
    if (stats.isDirectory()) {
      return {
        name: `${DATA_DIR_NAME} directory`,
        status: 'pass',
        message: 'exists',
        details: dir,
      };
    }
    return {
      name: `${DATA_DIR_NAME} directory`,
      status: 'fail',
      message: 'not a directory',
      fix: `rm ${dir} && mkdir -p ${dir}`,
    };
  } catch {
    return {
      name: `${DATA_DIR_NAME} directory`,
      status: 'warn',
      message: 'does not exist (will be created on first use)',
      fix: `mkdir -p ${dir}`,
    };
  }
}

/**
 * Checks write permissions in current directory
 */
async function checkWritePermissions(): Promise<CheckResult> {
  const cwd = process.cwd();

  try {
    await access(cwd, constants.W_OK);
    return {
      name: 'Write permissions',
      status: 'pass',
      message: 'OK',
      details: cwd,
    };
  } catch {
    return {
      name: 'Write permissions',
      status: 'fail',
      message: 'no write access to current directory',
      fix: `chmod u+w ${cwd}`,
    };
  }
}

/**
 * Formats a check result for display
 */
function formatCheckResult(result: CheckResult, verbose: boolean): string {
  const icon = DOCTOR_ICONS[result.status];
  let line = `  ${icon} ${result.name}: ${result.message}`;

  if (verbose && result.details !== undefined) {
    line += `${COLORS.dim} (${result.details})${COLORS.reset}`;
  }

  return line;
}

/**
 * Summary statistics for check results
 */
interface CheckSummary {
  passed: number;
  failed: number;
  warned: number;
  fixes: string[];
}

/**
 * Computes summary statistics and collects fixes in a single pass
 * More efficient than multiple filter() calls
 */
function computeCheckSummary(results: CheckResult[]): CheckSummary {
  const summary: CheckSummary = { passed: 0, failed: 0, warned: 0, fixes: [] };

  for (const result of results) {
    switch (result.status) {
      case 'pass':
        summary.passed++;
        break;
      case 'fail':
        summary.failed++;
        if (result.fix !== undefined) {
          summary.fixes.push(
            `  ${COLORS.dim}\u2022${COLORS.reset} ${result.name}: ${COLORS.cyan}${result.fix}${COLORS.reset}`
          );
        }
        break;
      case 'warn':
        summary.warned++;
        break;
    }
  }

  return summary;
}

/**
 * Doctor command handler
 */
export async function doctorCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const specificProvider = args[0];
  const verbose = options.verbose;
  const isJson = options.format === 'json';

  const allResults: CheckResult[] = [];
  const output: string[] = [];

  // Header
  if (!isJson) {
    output.push('');
    output.push(`${COLORS.bold}AutomatosX Doctor${COLORS.reset}`);
    output.push('');
  }

  // System Requirements
  if (!isJson) {
    output.push(`${COLORS.bold}System Requirements${COLORS.reset}`);
  }

  const nodeCheck = checkNodeVersion();
  allResults.push(nodeCheck);
  if (!isJson) {
    output.push(formatCheckResult(nodeCheck, verbose));
  }

  // Run all independent checks in parallel for better performance
  const checkingSpecificProvider = specificProvider !== undefined;

  // Build parallel check tasks
  const parallelChecks: Promise<{ category: string; results: CheckResult[] }>[] = [
    // Provider CLIs - always run
    checkAllProviders(specificProvider).then(results => ({ category: 'providers', results })),
  ];

  // Add IDE and file system checks only when not checking specific provider
  if (!checkingSpecificProvider) {
    parallelChecks.push(
      checkAllIDEs().then(results => ({ category: 'ides', results })),
      Promise.all([checkAutomatosxDir(), checkWritePermissions()])
        .then(results => ({ category: 'filesystem', results })),
    );
  }

  // Execute all checks in parallel
  const checkResults = await Promise.all(parallelChecks);

  // Process results in order for consistent output
  const resultsMap = new Map(checkResults.map(r => [r.category, r.results]));

  // Provider CLIs
  const providerResults = resultsMap.get('providers') ?? [];
  if (!isJson) {
    output.push('');
    output.push(`${COLORS.bold}Provider CLIs${COLORS.reset}`);
  }
  allResults.push(...providerResults);
  if (!isJson) {
    for (const result of providerResults) {
      output.push(formatCheckResult(result, verbose));
    }
  }

  // IDE Integrations
  if (!checkingSpecificProvider) {
    const ideResults = resultsMap.get('ides') ?? [];
    if (!isJson) {
      output.push('');
      output.push(`${COLORS.bold}IDE Integrations${COLORS.reset}`);
    }
    allResults.push(...ideResults);
    if (!isJson) {
      for (const result of ideResults) {
        output.push(formatCheckResult(result, verbose));
      }
    }
  }

  // File System
  if (!checkingSpecificProvider) {
    const fsResults = resultsMap.get('filesystem') ?? [];
    if (!isJson) {
      output.push('');
      output.push(`${COLORS.bold}File System${COLORS.reset}`);
    }
    allResults.push(...fsResults);
    if (!isJson) {
      for (const result of fsResults) {
        output.push(formatCheckResult(result, verbose));
      }
    }
  }

  // Compute summary in single pass (more efficient than multiple filter calls)
  const { passed, failed, warned, fixes } = computeCheckSummary(allResults);

  if (!isJson) {
    output.push('');
    output.push('\u2500'.repeat(50));

    let summaryLine = `Summary: ${COLORS.green}${String(passed)} passed${COLORS.reset}`;
    if (failed > 0) {
      summaryLine += `, ${COLORS.red}${String(failed)} failed${COLORS.reset}`;
    }
    if (warned > 0) {
      summaryLine += `, ${COLORS.yellow}${String(warned)} warnings${COLORS.reset}`;
    }
    output.push(summaryLine);

    // Fix suggestions (already collected in summary computation)
    if (fixes.length > 0) {
      output.push('');
      output.push(`${COLORS.bold}Suggested Fixes:${COLORS.reset}`);
      output.push(...fixes);
    }

    output.push('');
  }

  // Determine exit code (warnings don't cause failure)
  const exitCode = failed > 0 ? 1 : 0;

  if (isJson) {
    return {
      success: exitCode === 0,
      message: undefined,
      data: {
        checks: allResults,
        summary: { passed, failed, warned },
      },
      exitCode,
    };
  }

  return {
    success: exitCode === 0,
    message: output.join('\n'),
    data: undefined,
    exitCode,
  };
}
