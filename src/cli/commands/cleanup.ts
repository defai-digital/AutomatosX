/**
 * Cleanup Command - Clean up orphaned provider processes
 *
 * v6.0.7 Phase 3: Detect and kill orphaned codex/provider processes
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';

const execAsync = promisify(exec);

interface CleanupOptions {
  provider?: string;
  force?: boolean;
  verbose?: boolean;
}

interface ProcessInfo {
  pid: number;
  command: string;
  runtime: string;
  memory: string;
}

export const cleanupCommand: CommandModule<Record<string, unknown>, CleanupOptions> = {
  command: 'cleanup [provider]',
  describe: 'Clean up orphaned provider processes (v6.0.7 Phase 3)',

  builder: (yargs) => {
    return yargs
      .positional('provider', {
        describe: 'Provider to clean up (e.g., openai)',
        type: 'string',
        choices: ['openai', 'gemini', 'claude', 'all'],
        default: 'all'
      })
      .option('force', {
        alias: 'f',
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Show detailed output',
        type: 'boolean',
        default: false
      })
      .example('$0 cleanup', 'Clean up all orphaned processes')
      .example('$0 cleanup openai', 'Clean up OpenAI codex processes')
      .example('$0 cleanup --force', 'Clean up without confirmation');
  },

  handler: async (argv) => {
    try {
      const provider = argv.provider || 'all';

      console.log(chalk.bold.cyan('\n🧹 AutomatosX Process Cleanup\n'));

      if (argv.verbose) {
        logger.debug('Starting cleanup', { provider });
      }

      // Detect orphaned processes based on provider
      const processes = await detectOrphanedProcesses(provider, argv.verbose || false);

      if (processes.length === 0) {
        console.log(chalk.green('✅ No orphaned processes found!\n'));
        return;
      }

      // Display found processes
      console.log(chalk.yellow(`⚠️  Found ${processes.length} orphaned process(es):\n`));
      processes.forEach((proc, i) => {
        console.log(chalk.dim(`  ${i + 1}. PID ${chalk.cyan(proc.pid)} - ${proc.command}`));
        console.log(chalk.dim(`     Runtime: ${proc.runtime} | Memory: ${proc.memory}`));
      });
      console.log();

      // Confirm cleanup (unless --force)
      let shouldCleanup = argv.force;

      if (!shouldCleanup) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Kill these processes?',
          default: true
        }]);
        shouldCleanup = answer.confirm;
      }

      if (!shouldCleanup) {
        console.log(chalk.yellow('❌ Cleanup cancelled\n'));
        return;
      }

      // Kill processes
      console.log(chalk.dim('Killing processes...'));
      let killed = 0;
      let failed = 0;

      for (const proc of processes) {
        try {
          await killProcess(proc.pid, argv.verbose || false);
          killed++;
          if (argv.verbose) {
            console.log(chalk.green(`  ✓ Killed PID ${proc.pid}`));
          }
        } catch (error) {
          failed++;
          if (argv.verbose) {
            console.log(chalk.red(`  ✗ Failed to kill PID ${proc.pid}: ${(error as Error).message}`));
          }
        }
      }

      console.log();
      if (killed > 0) {
        console.log(chalk.green(`✅ Killed ${killed} process(es)`));

        // Estimate memory freed (rough estimate: ~50MB per process)
        const memoryFreed = Math.round(killed * 50);
        console.log(chalk.dim(`   Freed approximately ${memoryFreed}MB memory`));
      }

      if (failed > 0) {
        console.log(chalk.yellow(`⚠️  Failed to kill ${failed} process(es)`));
      }

      console.log();

      logger.info('Cleanup completed', {
        provider,
        killed,
        failed
      });

    } catch (error) {
      printError(error, {
        verbose: argv.verbose || false,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      logger.error('Cleanup command failed', { error: (error as Error).message });
      process.exit(1);
    }
  }
};

/**
 * Detect orphaned processes for a given provider
 */
async function detectOrphanedProcesses(provider: string, verbose: boolean): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];

  // Map provider to process names
  const processNames: string[] = [];

  if (provider === 'openai' || provider === 'all') {
    processNames.push('codex');
  }
  if (provider === 'gemini' || provider === 'all') {
    processNames.push('gemini');
  }
  if (provider === 'claude' || provider === 'all') {
    processNames.push('claude');
  }

  for (const processName of processNames) {
    try {
      const found = await findProcesses(processName, verbose);
      processes.push(...found);
    } catch (error) {
      if (verbose) {
        logger.debug(`No ${processName} processes found`, { error: (error as Error).message });
      }
    }
  }

  return processes;
}

/**
 * Find processes by name using ps command
 */
async function findProcesses(processName: string, verbose: boolean): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];

  try {
    // Use ps to find processes
    // Format: PID COMMAND ELAPSED RSS (memory in KB)
    const { stdout } = await execAsync(`ps -eo pid,comm,etime,rss | grep ${processName} | grep -v grep`);

    if (!stdout.trim()) {
      return processes;
    }

    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
        const pid = parseInt(parts[0], 10);
        const command = parts[1];
        const elapsed = parts[2];
        const memoryKB = parseInt(parts[3], 10);
        const memoryMB = Math.round(memoryKB / 1024);

        // Filter out very short-lived processes (< 5 seconds)
        // These are likely just starting up
        const elapsedParts = elapsed.split(/[-:]/);
        const firstPart = elapsedParts[0];
        const isLongRunning = elapsedParts.length > 2 || (firstPart && parseInt(firstPart, 10) >= 5);

        if (isLongRunning) {
          processes.push({
            pid,
            command,
            runtime: elapsed,
            memory: `${memoryMB}MB`
          });
        }
      }
    }
  } catch (error) {
    // Process not found or no matches
    if (verbose) {
      logger.debug(`No ${processName} processes found`);
    }
  }

  return processes;
}

/**
 * Kill a process by PID
 */
async function killProcess(pid: number, verbose: boolean): Promise<void> {
  try {
    // Try SIGTERM first (graceful)
    await execAsync(`kill -TERM ${pid}`);

    // Wait a moment to see if it terminates
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if still running
    try {
      await execAsync(`ps -p ${pid}`);
      // Still running, use SIGKILL (force)
      if (verbose) {
        logger.debug(`Process ${pid} didn't respond to SIGTERM, using SIGKILL`);
      }
      await execAsync(`kill -KILL ${pid}`);
    } catch {
      // Process terminated with SIGTERM
      if (verbose) {
        logger.debug(`Process ${pid} terminated gracefully`);
      }
    }
  } catch (error) {
    throw new Error(`Failed to kill process ${pid}: ${(error as Error).message}`);
  }
}
