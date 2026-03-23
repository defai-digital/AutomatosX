/**
 * Update Command
 *
 * Check for updates and upgrade the AutomatosX CLI to the latest version.
 *
 * Usage:
 *   ax update           Check for updates and prompt to install
 *   ax update --check   Only check (don't install)
 *   ax update --yes     Skip confirmation prompt
 */

import { exec } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';

const execAsync = promisify(exec);

const PACKAGE_NAME      = '@defai.digital/cli';
const TIMEOUT_NETWORK   = 10_000;
const TIMEOUT_INSTALL   = 120_000;
const MAX_BUFFER        = 10 * 1024 * 1024;
const SEMVER_RE         = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const require    = createRequire(join(__dirname, '../../package.json'));
const pkg        = require('../../package.json') as { version: string };
const CLI_VERSION = pkg.version;

function isValidSemver(v: string): boolean {
  return SEMVER_RE.test(v) && v.length <= 50;
}

async function getLatestVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync(`npm view ${PACKAGE_NAME} version`, { timeout: TIMEOUT_NETWORK });
    return stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function isNewer(a: string, b: string): boolean {
  const parse = (v: string): number[] | null => {
    if (!v || v === 'unknown') return null;
    const clean = (v.startsWith('v') ? v.slice(1) : v).split('-')[0] ?? v;
    const parts = clean.split('.').map(Number);
    return parts.some(isNaN) ? null : parts;
  };
  const ap = parse(a);
  const bp = parse(b);
  if (ap === null || bp === null) return false;
  const [am = 0, an_ = 0, ap_ = 0] = ap;
  const [bm = 0, bn_ = 0, bp_ = 0] = bp;
  return am !== bm ? am > bm : an_ !== bn_ ? an_ > bn_ : ap_ > bp_;
}

async function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const a = answer.toLowerCase().trim();
      resolve(a === 'y' || a === 'yes');
    });
  });
}

async function installUpdate(version: string): Promise<void> {
  if (!isValidSemver(version)) throw new Error(`Invalid version format: ${version}`);
  const { stderr } = await execAsync(`npm install -g ${PACKAGE_NAME}@${version}`, {
    maxBuffer: MAX_BUFFER,
    timeout:   TIMEOUT_INSTALL,
  });
  if (stderr && !stderr.includes('npm warn')) {
    process.stderr.write(`Update warnings: ${stderr}\n`);
  }
}

export async function updateCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (options.help) {
    return success(
      'Usage: ax update [options]\n\n' +
      'Options:\n' +
      '  --check   Only check for updates, do not install\n' +
      '  --yes     Skip confirmation prompt\n',
    );
  }

  const checkOnly   = args.includes('--check') || args.includes('-c');
  const skipConfirm = args.includes('--yes')   || args.includes('-y');

  console.log('\nAutomatosX Update Checker\n');

  try {
    const currentVersion = CLI_VERSION;
    console.log(`Current version: ${currentVersion}`);
    console.log('Checking for updates...');

    const latestVersion = await getLatestVersion();
    console.log(`Latest version:  ${latestVersion}\n`);

    if (latestVersion === 'unknown') {
      return failure('Could not check for updates. Check your network connection.', { currentVersion, latestVersion });
    }

    if (currentVersion === latestVersion) {
      return success('Already on the latest version.', { currentVersion, latestVersion, upToDate: true });
    }

    if (!isNewer(latestVersion, currentVersion)) {
      return success(
        `Your version (${currentVersion}) is newer than published (${latestVersion}).`,
        { currentVersion, latestVersion, development: true },
      );
    }

    console.log(`Update available: ${currentVersion} → ${latestVersion}`);

    if (checkOnly) {
      console.log(`\nTo install: npm install -g ${PACKAGE_NAME}@${latestVersion}`);
      console.log('Or run: ax update\n');
      return success('', { currentVersion, latestVersion, updateAvailable: true });
    }

    if (!skipConfirm) {
      const confirmed = await promptConfirm('\nInstall update? (y/N) ');
      if (!confirmed) {
        return success('Update cancelled.', { currentVersion, latestVersion, cancelled: true });
      }
    }

    console.log('\nInstalling update...\n');
    await installUpdate(latestVersion);

    console.log(`\nUpdated to ${latestVersion}. Run "ax --version" to verify.\n`);
    return success('', { currentVersion, latestVersion, updated: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Error checking for updates: ${message}`);
  }
}
