/**
 * Doctor command - System health check and diagnostics
 *
 * Checks:
 * - Node.js version
 * - Provider CLI availability (claude, gemini, codex, qwen, ax-glm, ax-grok)
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
 * All provider CLIs to check
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
    id: 'qwen',
    name: 'Qwen',
    command: 'qwen',
    installHint: 'pip install qwen-cli',
  },
  {
    id: 'glm',
    name: 'GLM',
    command: 'ax-glm',
    installHint: 'npm install -g ax-glm',
  },
  {
    id: 'grok',
    name: 'Grok',
    command: 'ax-grok',
    installHint: 'npm install -g ax-grok',
  },
];

/**
 * Minimum required Node.js version
 */
const MIN_NODE_VERSION = 18;

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Status icons
 */
const ICONS = {
  pass: `${COLORS.green}\u2713${COLORS.reset}`,
  fail: `${COLORS.red}\u2717${COLORS.reset}`,
  warn: `${COLORS.yellow}\u26A0${COLORS.reset}`,
};

/**
 * Checks if a command is available on PATH
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';
    await execAsync(`${whichCommand} ${command}`);
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
    const { stdout } = await execAsync(`${command} --version 2>&1`);
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
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execAsync(`${whichCommand} ${command}`);
    return stdout.trim().split('\n')[0];
  } catch {
    return undefined;
  }
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

/**
 * Checks a single provider CLI
 * Exported for use by other commands like 'setup'
 */
export async function checkProviderCLI(provider: ProviderCheck): Promise<CheckResult> {
  const available = await isCommandAvailable(provider.command);

  if (!available) {
    return {
      name: `${provider.name} CLI (${provider.command})`,
      status: 'fail',
      message: 'not installed',
      fix: provider.installHint,
    };
  }

  const version = await getCommandVersion(provider.command);
  const path = await getCommandPath(provider.command);

  const result: CheckResult = {
    name: `${provider.name} CLI (${provider.command})`,
    status: 'pass',
    message: version !== undefined ? `v${version}` : 'installed',
  };

  if (path !== undefined) {
    result.details = path;
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
    ? PROVIDER_CHECKS.filter((p) => p.id === specificProvider)
    : PROVIDER_CHECKS;

  const results = await Promise.all(
    providers.map((provider) => checkProviderCLI(provider))
  );

  return results;
}

/**
 * Checks .automatosx directory
 */
async function checkAutomatosxDir(): Promise<CheckResult> {
  const dir = join(homedir(), '.automatosx');

  try {
    const stats = await stat(dir);
    if (stats.isDirectory()) {
      return {
        name: '.automatosx directory',
        status: 'pass',
        message: 'exists',
        details: dir,
      };
    }
    return {
      name: '.automatosx directory',
      status: 'fail',
      message: 'not a directory',
      fix: `rm ${dir} && mkdir -p ${dir}`,
    };
  } catch {
    return {
      name: '.automatosx directory',
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
  const icon = ICONS[result.status];
  let line = `  ${icon} ${result.name}: ${result.message}`;

  if (verbose && result.details !== undefined) {
    line += `${COLORS.dim} (${result.details})${COLORS.reset}`;
  }

  return line;
}

/**
 * Formats fix suggestions
 */
function formatFixes(results: CheckResult[]): string[] {
  const fixes = results
    .filter((r): r is CheckResult & { fix: string } => r.status === 'fail' && r.fix !== undefined)
    .map((r) => `  ${COLORS.dim}\u2022${COLORS.reset} ${r.name}: ${COLORS.cyan}${r.fix}${COLORS.reset}`);

  return fixes;
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

  // Provider CLIs
  if (!isJson) {
    output.push('');
    output.push(`${COLORS.bold}Provider CLIs${COLORS.reset}`);
  }

  const providerResults = await checkAllProviders(specificProvider);
  allResults.push(...providerResults);
  if (!isJson) {
    for (const result of providerResults) {
      output.push(formatCheckResult(result, verbose));
    }
  }

  // File System (only if not checking specific provider)
  if (specificProvider === undefined) {
    if (!isJson) {
      output.push('');
      output.push(`${COLORS.bold}File System${COLORS.reset}`);
    }

    const dirCheck = await checkAutomatosxDir();
    allResults.push(dirCheck);
    if (!isJson) {
      output.push(formatCheckResult(dirCheck, verbose));
    }

    const writeCheck = await checkWritePermissions();
    allResults.push(writeCheck);
    if (!isJson) {
      output.push(formatCheckResult(writeCheck, verbose));
    }
  }

  // Summary
  const passed = allResults.filter((r) => r.status === 'pass').length;
  const failed = allResults.filter((r) => r.status === 'fail').length;
  const warned = allResults.filter((r) => r.status === 'warn').length;

  if (!isJson) {
    output.push('');
    output.push('\u2500'.repeat(50));

    let summary = `Summary: ${COLORS.green}${String(passed)} passed${COLORS.reset}`;
    if (failed > 0) {
      summary += `, ${COLORS.red}${String(failed)} failed${COLORS.reset}`;
    }
    if (warned > 0) {
      summary += `, ${COLORS.yellow}${String(warned)} warnings${COLORS.reset}`;
    }
    output.push(summary);

    // Fix suggestions
    const fixes = formatFixes(allResults);
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
