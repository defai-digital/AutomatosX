/**
 * Update Command
 *
 * Check for updates and upgrade AutomatosX CLI to the latest version.
 *
 * Usage:
 *   ax update           Check for updates and prompt to install
 *   ax update --check   Only check for updates (don't install)
 *   ax update --yes     Skip confirmation and install immediately
 *
 * @module @defai.digital/cli/commands/update
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { exec, execSync, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_PROVIDER_DEFAULT,
  getErrorMessage,
} from '@defai.digital/contracts';

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

/** Timeout for network operations (npm queries, API calls) */
const TIMEOUT_NETWORK = TIMEOUT_HEALTH_CHECK * 2; // 10s

/** Timeout for npm install operations */
const TIMEOUT_INSTALL = TIMEOUT_PROVIDER_DEFAULT; // 120s

/** Max buffer size for exec output (10MB) */
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Package name for npm operations
 */
export const PACKAGE_NAME = '@defai.digital/cli';

/**
 * Strict semver regex to prevent command injection
 * Matches: 1.0.0, 1.0.0-beta.1, 1.0.0-rc.1+build.123
 */
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

/**
 * Validate version string to prevent command injection
 */
function isValidSemver(version: string): boolean {
  return SEMVER_REGEX.test(version) && version.length <= 50;
}

/**
 * Read CLI version from package.json
 */
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };
const CLI_VERSION = pkg.version;

/**
 * Get current installed version
 */
async function getCurrentVersion(): Promise<string> {
  try {
    // Try to get from npm global installation
    const { stdout } = await execAsync(
      `npm list -g ${PACKAGE_NAME} --depth=0 --json`,
      { timeout: TIMEOUT_NETWORK }
    );

    const parsed = JSON.parse(stdout) as {
      dependencies?: Record<string, { version?: string }>;
    };

    return parsed.dependencies?.[PACKAGE_NAME]?.version ?? CLI_VERSION;
  } catch {
    // Fallback to package.json version
    return CLI_VERSION;
  }
}

/**
 * Get latest version from npm registry
 */
async function getLatestVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync(`npm view ${PACKAGE_NAME} version`, {
      timeout: TIMEOUT_NETWORK,
    });
    return stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if version a is newer than version b
 */
function isNewer(a: string, b: string): boolean {
  const parseVersion = (v: string): number[] | null => {
    if (!v || v === 'unknown') return null;

    const version = v.split('-')[0] ?? v;
    const cleanVersion = version.startsWith('v') ? version.substring(1) : version;
    const parts = cleanVersion.split('.').map(Number);

    if (parts.some(isNaN)) return null;
    return parts;
  };

  const aParts = parseVersion(a);
  const bParts = parseVersion(b);

  if (!aParts || !bParts) return false;

  const [aMajor = 0, aMinor = 0, aPatch = 0] = aParts;
  const [bMajor = 0, bMinor = 0, bPatch = 0] = bParts;

  return aMajor !== bMajor
    ? aMajor > bMajor
    : aMinor !== bMinor
      ? aMinor > bMinor
      : aPatch > bPatch;
}

/**
 * Show changelog from GitHub releases
 */
async function showChangelog(to: string): Promise<string> {
  // Validate version to prevent command injection
  if (!isValidSemver(to)) {
    return `View changelog: https://github.com/defai-digital/automatosx/releases`;
  }

  try {
    const { stdout } = await execAsync(
      `curl -s https://api.github.com/repos/defai-digital/automatosx/releases/tags/v${to}`,
      { timeout: TIMEOUT_NETWORK }
    );

    const release = JSON.parse(stdout) as { body?: string };

    if (release.body) {
      const lines = release.body.split('\n').slice(0, 10);
      const formatted = lines.map((line) => {
        if (line.startsWith('#')) return `\n${line}`;
        return line.trim() ? `  ${line}` : '';
      });
      return (
        formatted.join('\n') +
        `\n\n  Full changelog: https://github.com/defai-digital/automatosx/releases/tag/v${to}`
      );
    }
    return `View changelog: https://github.com/defai-digital/automatosx/releases/tag/v${to}`;
  } catch {
    return `View changelog: https://github.com/defai-digital/automatosx/releases/tag/v${to}`;
  }
}

/**
 * Install update
 */
async function installUpdate(version: string): Promise<void> {
  // Validate version to prevent command injection
  if (!isValidSemver(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const { stderr } = await execAsync(`npm install -g ${PACKAGE_NAME}@${version}`, {
    maxBuffer: MAX_BUFFER_SIZE,
    timeout: TIMEOUT_INSTALL,
  });

  if (stderr && !stderr.includes('npm warn')) {
    console.warn('Update installation warnings:', stderr);
  }
}

/**
 * Check if ax-cli is installed
 */
function isAxCliInstalled(): boolean {
  try {
    const result = spawnSync('ax-cli', ['--version'], {
      encoding: 'utf-8',
      timeout: TIMEOUT_HEALTH_CHECK,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Update ax-cli if installed
 */
async function updateAxCli(): Promise<boolean> {
  try {
    execSync('ax-cli update -y', {
      stdio: 'inherit',
      timeout: TIMEOUT_INSTALL,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Parse update command options
 */
function parseUpdateOptions(
  args: string[],
  _options: CLIOptions
): { checkOnly: boolean; skipConfirm: boolean } {
  let checkOnly = false;
  let skipConfirm = false;

  for (const arg of args) {
    if (arg === '--check' || arg === '-c') {
      checkOnly = true;
    }
    if (arg === '--yes' || arg === '-y') {
      skipConfirm = true;
    }
  }

  return { checkOnly, skipConfirm };
}

/**
 * Handles the 'update' command
 */
export async function updateCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const { checkOnly, skipConfirm } = parseUpdateOptions(args, options);

  console.log('\nAutomatosX Update Checker\n');

  try {
    // 1. Get current version
    const currentVersion = await getCurrentVersion();
    console.log(`Current version: ${currentVersion}`);

    // 2. Check for latest version
    console.log('Checking for updates...');
    const latestVersion = await getLatestVersion();
    console.log(`Latest version:  ${latestVersion}\n`);

    // 3. Compare versions
    if (latestVersion === 'unknown') {
      return {
        success: false,
        message: 'Could not check for updates. Please check your network connection.',
        data: { currentVersion, latestVersion },
        exitCode: 1,
      };
    }

    if (currentVersion === latestVersion) {
      return {
        success: true,
        message: 'You are already running the latest version!',
        data: { currentVersion, latestVersion, upToDate: true },
        exitCode: 0,
      };
    }

    if (isNewer(latestVersion, currentVersion)) {
      console.log(`New version available: ${currentVersion} -> ${latestVersion}`);

      // 4. Show changelog
      const changelog = await showChangelog(latestVersion);
      console.log('\nWhat\'s new:');
      console.log(changelog);

      // 5. If only checking, exit here
      if (checkOnly) {
        console.log('\nTo install the update, run:');
        console.log(`  npm install -g ${PACKAGE_NAME}@${latestVersion}\n`);
        console.log('Or run: ax update\n');

        return {
          success: true,
          message: undefined,
          data: {
            currentVersion,
            latestVersion,
            updateAvailable: true,
          },
          exitCode: 0,
        };
      }

      // 6. Confirm update (unless --yes flag)
      if (!skipConfirm) {
        const confirmed = await promptConfirm('\nWould you like to update now? (y/N) ');

        if (!confirmed) {
          return {
            success: true,
            message: 'Update cancelled.',
            data: { currentVersion, latestVersion, cancelled: true },
            exitCode: 0,
          };
        }
      }

      // 7. Perform update
      console.log('\nInstalling update...\n');
      await installUpdate(latestVersion);

      console.log('\nAutomatosX updated successfully!');
      console.log(`New version: ${latestVersion}`);
      console.log('\nRun "ax --version" to verify.\n');

      // 8. Update ax-cli if installed
      if (isAxCliInstalled()) {
        console.log('Updating ax-cli...\n');
        const axUpdated = await updateAxCli();
        if (axUpdated) {
          console.log('ax-cli updated successfully!\n');
        } else {
          console.log('ax-cli update failed. You can try manually: ax-cli update -y\n');
        }
      }

      return {
        success: true,
        message: undefined,
        data: {
          currentVersion,
          latestVersion,
          updated: true,
        },
        exitCode: 0,
      };
    } else {
      // Current version is newer than published
      return {
        success: true,
        message: `Your version (${currentVersion}) is newer than published (${latestVersion})`,
        data: { currentVersion, latestVersion, development: true },
        exitCode: 0,
      };
    }
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      success: false,
      message: `Error checking for updates: ${message}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
