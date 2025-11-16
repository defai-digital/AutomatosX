/**
 * Run Command - Execute an agent with a task
 * Restores v7.6.1 agent execution for v8.x
 */

import { Command } from 'commander';
import { AgentExecutor } from '../../agents/AgentExecutor.js';
import { SessionManager } from '../../core/SessionManager.js';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
import chalk from 'chalk';

interface RunOptions {
  provider?: string;
  model?: string;
  memory?: boolean;
  verbose?: boolean;
  stream?: boolean;
  timeout?: number;
  save?: string;
  session?: string;
}

/**
 * Handler for run command
 */
async function runHandler(
  agent: string,
  task: string,
  options: RunOptions
): Promise<void> {
  try {
    console.log(chalk.blue.bold(`\n🤖 AutomatosX - Running ${agent}\n`));

    if (options.verbose) {
      console.log(chalk.gray(`Agent: ${agent}`));
      console.log(chalk.gray(`Task: ${task}`));
      console.log(chalk.gray(`Working directory: ${process.cwd()}\n`));
    }

    // Initialize executor
    const executor = new AgentExecutor(process.cwd());

    // Execute the agent
    const startTime = Date.now();
    const result = await executor.execute({
      agent,
      task,
      context: {
        memory: options.memory,
        session: options.session,  // BUG FIX #9: Pass session to context
        verbose: options.verbose
      },
      verbose: options.verbose,
      stream: options.stream
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      throw result.error || new Error('Agent execution failed');
    }

    // Display result
    console.log(chalk.green.bold('\n✓ Agent execution completed\n'));

    if (options.verbose) {
      console.log(chalk.gray(`Duration: ${duration}ms`));
      console.log(chalk.gray(`Abilities loaded: ${result.metadata.abilities}`));
      console.log(chalk.gray(`Provider: ${result.metadata.provider || 'default'}\n`));
    }

    // Display response
    console.log(chalk.white('Response:\n'));
    console.log(result.response);
    console.log();

    // Save to session history if requested
    if (options.session && result.response) {
      try {
        const sessionManager = new SessionManager(process.cwd());
        await sessionManager.addToHistory(options.session, {
          agent,
          task,
          result: result.response,
          duration,
          provider: result.metadata.provider || 'default',
          model: options.model,
        });
        console.log(chalk.gray(`✓ Added to session: ${options.session}\n`));
      } catch (error) {
        console.log(chalk.yellow(`⚠ Could not add to session: ${error instanceof Error ? error.message : error}\n`));
      }
    }

    // Save to file if requested
    if (options.save && result.response) {
      const { writeFile } = await import('fs/promises');
      await writeFile(options.save, result.response, 'utf-8');
      console.log(chalk.green(`✓ Saved to: ${options.save}\n`));
    }

  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

/**
 * Create run command
 */
export function createRunCommand(): Command {
  return new Command('run')
    .description('Execute an agent with a task')
    .argument('<agent>', 'Agent name (e.g., backend, frontend, coder)')
    .argument('<task>', 'Task description for the agent to execute')
    .option('--provider <provider>', 'Override provider (claude, gemini, openai)')
    .option('--model <model>', 'Override model')
    .option('--memory', 'Inject relevant memory into context', false)
    .option('-v, --verbose', 'Verbose output with execution details', false)
    // BUG FIX #22: Changed default to false for proper boolean flag behavior
    // Users can enable with --stream, disable with --no-stream (Commander.js convention)
    .option('--stream', 'Enable streaming output', false)
    .option('--timeout <seconds>', 'Execution timeout in seconds', parseInt)
    .option('--save <file>', 'Save response to file')
    .option('--session <id>', 'Add execution to session history')
    .action(runHandler);
}
