/**
 * Auto-Initialization Middleware
 *
 * Automatically initializes AutomatosX if needed before command execution.
 * Provides seamless UX by eliminating manual setup requirement.
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  InitializationChecker,
  getStalenessThreshold,
  isAutoInitDisabled
} from '../../shared/process/initialization.js';
import { logger } from '../../shared/logging/logger.js';
import type { SetupTimestamp } from '../../shared/process/initialization.js';
import { getVersion } from '../../shared/helpers/version.js';

/**
 * Commands that should NOT trigger auto-initialization
 */
const SKIP_AUTO_INIT_COMMANDS = [
  'setup',
  'init',
  'help',
  'version',
  '--help',
  '--version',
  '-h',
  '-v'
];

/**
 * Check if command should skip auto-initialization
 */
function shouldSkipAutoInit(command: string | undefined, argv: any): boolean {
  // Skip if command is in skip list
  if (command && SKIP_AUTO_INIT_COMMANDS.includes(command)) {
    return true;
  }

  // Skip if help or version flags are present
  if (argv.help || argv.version) {
    return true;
  }

  // Skip if disabled via environment or config
  if (isAutoInitDisabled()) {
    logger.debug('Auto-initialization disabled (environment/config)');
    return true;
  }

  return false;
}

/**
 * Run setup command silently
 */
async function runSetupSilently(projectDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get the ax command path
    const axCommand = process.argv[0] || 'node'; // node path
    const axScript = process.argv[1] || 'ax'; // ax script path

    // Run setup command
    const child = spawn(axCommand, [axScript, 'setup', '--skip-spec-kit'], {
      cwd: projectDir,
      env: {
        ...process.env,
        AX_AUTO_INIT_MODE: 'true', // Signal to setup command
        AX_SKIP_AUTO_INIT: 'true'  // Prevent recursive auto-init
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    child.on('error', (error: Error) => {
      reject(new Error(`Failed to run setup: ${error.message}`));
    });

    child.on('exit', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Setup failed with code ${code}\n${errorOutput}`));
      }
    });
  });
}

/**
 * Write setup timestamp
 */
async function writeSetupTimestamp(projectDir: string, setupType: 'auto' | 'manual'): Promise<void> {
  const automatosxDir = join(projectDir, '.automatosx');
  const timestampPath = join(automatosxDir, '.setup-timestamp');

  const timestamp: SetupTimestamp = {
    version: getVersion(),
    setupTime: new Date().toISOString(),
    setupType,
    components: ['agents', 'memory', 'sessions', 'logs', 'templates']
  };

  try {
    // Ensure directory exists
    await mkdir(automatosxDir, { recursive: true });

    // Write timestamp
    await writeFile(timestampPath, JSON.stringify(timestamp, null, 2), 'utf-8');

    logger.debug('Setup timestamp written', { setupType, version: timestamp.version });
  } catch (error) {
    logger.warn('Failed to write setup timestamp', { error });
  }
}

/**
 * Auto-initialization middleware
 *
 * Call this before executing any command to ensure AutomatosX is initialized.
 *
 * @param command - Command being executed
 * @param argv - Command arguments
 * @param projectDir - Project directory
 */
export async function ensureInitialized(
  command: string | undefined,
  argv: any,
  projectDir: string = process.cwd()
): Promise<void> {
  // Skip if command doesn't need auto-init
  if (shouldSkipAutoInit(command, argv)) {
    return;
  }

  // Check initialization status
  const stalenessThreshold = getStalenessThreshold();
  const checker = new InitializationChecker(projectDir, stalenessThreshold);

  try {
    const status = await checker.checkStatus();

    if (!status.needsSetup) {
      // Already initialized and fresh
      logger.debug('AutomatosX is initialized and up-to-date');
      return;
    }

    // Needs setup or refresh
    const isFirstTime = !status.isInitialized;

    if (isFirstTime) {
      // First-time initialization
      console.log(chalk.yellow('\n⚠️  AutomatosX needs initialization'));
      console.log(chalk.blue('   Running first-time setup...\n'));

      await runSetupSilently(projectDir);
      await writeSetupTimestamp(projectDir, 'auto');

      console.log(chalk.green('✓ Initialization complete!\n'));
    } else if (status.isStale) {
      // Refresh stale initialization
      console.log(chalk.yellow('\n⚠️  AutomatosX initialization is stale'));

      const ageStr = InitializationChecker.formatAge(status.age);
      console.log(chalk.blue(`   Last setup: ${ageStr}`));
      console.log(chalk.blue('   Refreshing configuration...\n'));

      await runSetupSilently(projectDir);
      await writeSetupTimestamp(projectDir, 'auto');

      console.log(chalk.green('✓ Refresh complete!\n'));
    } else if (status.missingComponents.length > 0) {
      // Partial initialization (corrupted)
      console.log(chalk.yellow('\n⚠️  AutomatosX setup is incomplete'));
      console.log(chalk.blue(`   Missing: ${status.missingComponents.join(', ')}`));
      console.log(chalk.blue('   Repairing setup...\n'));

      await runSetupSilently(projectDir);
      await writeSetupTimestamp(projectDir, 'auto');

      console.log(chalk.green('✓ Repair complete!\n'));
    }
  } catch (error) {
    // Auto-init failed - provide helpful error message
    console.error(chalk.red('\n✗ Auto-initialization failed\n'));
    console.error(chalk.yellow('Please run setup manually:'));
    console.error(chalk.white('  ax setup\n'));

    logger.error('Auto-initialization failed', { error });

    // Don't block command execution - let user try anyway
    // They'll get more specific errors from the command itself
  }
}

/**
 * Quick check if initialization is needed (fast, for performance-critical paths)
 */
export async function needsInitialization(projectDir: string = process.cwd()): Promise<boolean> {
  const checker = new InitializationChecker(projectDir, getStalenessThreshold());
  return checker.needsInitialization();
}
