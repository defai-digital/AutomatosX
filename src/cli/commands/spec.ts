/**
 * Spec Command - Spec-driven development CLI
 *
 * Main command for interacting with .specify/ directory:
 * - ax spec run - Execute tasks
 * - ax spec status - Show status
 * - ax spec validate - Validate spec files
 * - ax spec graph - Display dependency graph
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import { SpecRegistry } from '../../core/spec/SpecRegistry.js';
import { SpecExecutor } from '../../core/spec/SpecExecutor.js';
import { SessionManager } from '../../core/session-manager.js';
import { detectProjectRoot } from '../../core/path-resolver.js';
import { loadConfig } from '../../core/config.js';
import { logger } from '../../utils/logger.js';
import { SpecError, SpecErrorCode } from '../../types/spec.js';
import type {
  SpecExecutorOptions,
  TaskFilter
} from '../../types/spec.js';

interface SpecOptions {
  // Subcommand
  subcommand?: string;

  // Run options
  task?: string;
  'dry-run'?: boolean;
  parallel?: boolean;
  resume?: boolean;

  // Status options
  pending?: boolean;
  completed?: boolean;
  json?: boolean;

  // Validate options
  strict?: boolean;
  fix?: boolean;

  // Graph options
  dot?: boolean;
  mermaid?: boolean;
  'critical-path'?: boolean;
}

export const specCommand: CommandModule<Record<string, unknown>, SpecOptions> = {
  command: 'spec <subcommand>',
  describe: 'Spec-driven development commands',

  builder: (yargs) => {
    return yargs
      .positional('subcommand', {
        describe: 'Subcommand (run, status, validate, graph)',
        type: 'string',
        choices: ['run', 'status', 'validate', 'graph'],
        demandOption: true
      })
      // Run options
      .option('task', {
        describe: 'Specific task ID to run',
        type: 'string'
      })
      .option('dry-run', {
        describe: 'Show execution plan without running',
        type: 'boolean',
        default: false
      })
      .option('parallel', {
        describe: 'Enable parallel execution',
        type: 'boolean',
        default: false
      })
      .option('resume', {
        describe: 'Resume from last checkpoint',
        type: 'boolean',
        default: false
      })
      // Status options
      .option('pending', {
        describe: 'Show only pending tasks',
        type: 'boolean',
        default: false
      })
      .option('completed', {
        describe: 'Show only completed tasks',
        type: 'boolean',
        default: false
      })
      .option('json', {
        describe: 'JSON output',
        type: 'boolean',
        default: false
      })
      // Validate options
      .option('strict', {
        describe: 'Strict validation mode',
        type: 'boolean',
        default: false
      })
      .option('fix', {
        describe: 'Auto-fix common issues',
        type: 'boolean',
        default: false
      })
      // Graph options
      .option('dot', {
        describe: 'Export DOT format',
        type: 'boolean',
        default: false
      })
      .option('mermaid', {
        describe: 'Export Mermaid format',
        type: 'boolean',
        default: false
      })
      .option('critical-path', {
        describe: 'Highlight critical path',
        type: 'boolean',
        default: false
      })
      .example('$0 spec run', 'Execute all pending tasks')
      .example('$0 spec run --task auth:impl', 'Run specific task')
      .example('$0 spec status', 'Show task status')
      .example('$0 spec validate', 'Validate spec files')
      .example('$0 spec graph', 'Display dependency graph');
  },

  handler: async (argv) => {
    try {
      const workspacePath = detectProjectRoot();
      const config = await loadConfig(workspacePath);

      switch (argv.subcommand) {
        case 'run':
          await handleRun(workspacePath, argv, config);
          break;
        case 'status':
          await handleStatus(workspacePath, argv);
          break;
        case 'validate':
          await handleValidate(workspacePath, argv);
          break;
        case 'graph':
          await handleGraph(workspacePath, argv);
          break;
        default:
          console.error(chalk.red(`Unknown subcommand: ${argv.subcommand}`));
          process.exit(1);
      }
    } catch (error) {
      if (error instanceof SpecError) {
        console.error(chalk.red(`✗ ${error.message}`));
        if (error.details) {
          console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
        }
      } else {
        console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  }
};

/**
 * Handle 'ax spec run' command
 */
async function handleRun(
  workspacePath: string,
  argv: SpecOptions,
  config: any
): Promise<void> {
  const spinner = ora('Loading spec...').start();

  try {
    // Load spec
    const registry = await SpecRegistry.forWorkspace(workspacePath);
    const spec = await registry.load();

    spinner.succeed('Spec loaded');

    // Display execution plan
    console.log(chalk.cyan('\n📋 Spec Execution Plan'));
    console.log(chalk.gray(`  Workspace: ${workspacePath}`));
    console.log(chalk.gray(`  Spec ID: ${spec.metadata.id}`));

    const pendingTasks = spec.tasks.filter(t => t.status === 'pending');
    const completedTasks = spec.tasks.filter(t => t.status === 'completed');

    console.log(
      chalk.gray(
        `  Total Tasks: ${spec.tasks.length} | Pending: ${pendingTasks.length} | Completed: ${completedTasks.length}\n`
      )
    );

    // Dry run mode
    if (argv['dry-run']) {
      console.log(chalk.yellow('⚠️  DRY RUN MODE - No tasks will be executed\n'));

      for (let i = 0; i < pendingTasks.length; i++) {
        const task = pendingTasks[i];
        console.log(chalk.cyan(`[${i + 1}/${pendingTasks.length}]`), task.id);
        console.log(chalk.gray(`  ${task.title}`));
        console.log(chalk.gray(`  Command: ${task.ops}\n`));
      }

      return;
    }

    // Initialize session manager
    const sessionManager = new SessionManager(config, workspacePath);

    // Build task filter
    const taskFilter: TaskFilter | undefined = argv.task
      ? { taskIds: [argv.task] }
      : { status: ['pending'] };

    // Create executor
    const executorOptions: SpecExecutorOptions = {
      sessionId: sessionManager.getCurrentSessionId() || 'default',
      parallel: argv.parallel ?? false,
      continueOnError: true,
      dryRun: false,
      taskFilter
    };

    const executor = new SpecExecutor(spec, executorOptions, sessionManager);

    // Execute
    console.log(chalk.cyan('🚀 Starting execution...\n'));
    const result = await executor.execute();

    // Display results
    console.log(chalk.green('\n✅ Execution completed\n'));
    console.log(chalk.cyan('Results:'));
    console.log(chalk.gray(`  Total: ${result.totalTasks}`));
    console.log(chalk.green(`  Completed: ${result.completedTasks}`));
    console.log(chalk.red(`  Failed: ${result.failedTasks}`));
    console.log(chalk.yellow(`  Skipped: ${result.skippedTasks}`));
    console.log(chalk.gray(`  Duration: ${(result.duration / 1000).toFixed(2)}s\n`));

    // Cleanup
    await executor.cleanup();
    await registry.destroy();

  } catch (error) {
    spinner.fail('Failed to execute spec');
    throw error;
  }
}

/**
 * Handle 'ax spec status' command
 */
async function handleStatus(
  workspacePath: string,
  argv: SpecOptions
): Promise<void> {
  const spinner = ora('Loading spec...').start();

  try {
    const registry = await SpecRegistry.forWorkspace(workspacePath);
    const spec = await registry.load();

    spinner.succeed('Spec loaded');

    if (argv.json) {
      // JSON output
      const data = {
        specId: spec.metadata.id,
        version: spec.metadata.version,
        totalTasks: spec.tasks.length,
        completedTasks: spec.tasks.filter(t => t.status === 'completed').length,
        pendingTasks: spec.tasks.filter(t => t.status === 'pending').length,
        tasks: spec.tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          deps: t.deps,
          assigneeHint: t.assigneeHint,
          labels: t.labels
        }))
      };
      console.log(JSON.stringify(data, null, 2));
    } else {
      // Human-readable output
      const completedTasks = spec.tasks.filter(t => t.status === 'completed');
      const pendingTasks = spec.tasks.filter(t => t.status === 'pending');

      console.log(chalk.cyan(`\n📊 Spec Status`));
      console.log(chalk.gray(`  Version: ${spec.metadata.version}`));
      console.log(chalk.gray(`  Workspace: ${workspacePath}`));
      console.log(
        chalk.gray(
          `  Progress: ${completedTasks.length}/${spec.tasks.length} tasks (${((completedTasks.length / spec.tasks.length) * 100).toFixed(1)}%)\n`
        )
      );

      // Show completed tasks
      if (completedTasks.length > 0 && !argv.pending) {
        console.log(chalk.green(`✅ Completed (${completedTasks.length})`));
        for (const task of completedTasks) {
          console.log(chalk.gray(`  • ${task.id} - ${task.title}`));
        }
        console.log('');
      }

      // Show pending tasks
      if (pendingTasks.length > 0 && !argv.completed) {
        console.log(chalk.yellow(`⏳ Pending (${pendingTasks.length})`));
        for (const task of pendingTasks) {
          const depsStr = task.deps.length > 0 ? ` (blocked by: ${task.deps.join(', ')})` : '';
          console.log(chalk.gray(`  • ${task.id} - ${task.title}${depsStr}`));
        }
        console.log('');
      }
    }

    await registry.destroy();

  } catch (error) {
    spinner.fail('Failed to load spec');
    throw error;
  }
}

/**
 * Handle 'ax spec validate' command
 */
async function handleValidate(
  workspacePath: string,
  argv: SpecOptions
): Promise<void> {
  const spinner = ora('Validating spec...').start();

  try {
    const registry = await SpecRegistry.forWorkspace(workspacePath);
    const spec = await registry.load();
    const validation = await registry.validate();

    spinner.succeed('Validation completed');

    console.log(chalk.cyan('\n✅ Spec Validation Results\n'));

    // Display issues
    if (validation.isValid) {
      console.log(chalk.green('  All checks passed!\n'));
    } else {
      console.log(chalk.red(`  ${validation.issues.length} issue(s) found:\n`));

      for (const issue of validation.issues) {
        const icon = issue.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠️');
        console.log(`${icon} ${issue.message}`);
        if (issue.file) {
          console.log(chalk.gray(`    File: ${issue.file}:${issue.line}`));
        }
        if (issue.suggestion) {
          console.log(chalk.cyan(`    Suggestion: ${issue.suggestion}`));
        }
        console.log('');
      }
    }

    await registry.destroy();

    if (!validation.isValid && argv.strict) {
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Validation failed');
    throw error;
  }
}

/**
 * Handle 'ax spec graph' command
 */
async function handleGraph(
  workspacePath: string,
  argv: SpecOptions
): Promise<void> {
  const spinner = ora('Building dependency graph...').start();

  try {
    const registry = await SpecRegistry.forWorkspace(workspacePath);
    const spec = await registry.load();

    if (!spec.graph) {
      throw new SpecError(
        SpecErrorCode.EXECUTION_FAILED,
        'Dependency graph not built'
      );
    }

    spinner.succeed('Graph built');

    if (argv.dot) {
      // DOT format
      console.log('digraph G {');
      for (const [taskId, deps] of spec.graph.adjacencyList.entries()) {
        for (const depId of deps) {
          console.log(`  "${taskId}" -> "${depId}";`);
        }
      }
      console.log('}');
    } else if (argv.mermaid) {
      // Mermaid format
      console.log('graph TD');
      for (const [taskId, deps] of spec.graph.adjacencyList.entries()) {
        for (const depId of deps) {
          console.log(`  ${taskId} --> ${depId}`);
        }
      }
    } else {
      // ASCII art
      console.log(chalk.cyan('\n📊 Task Dependency Graph\n'));

      for (const taskId of spec.graph.sortedTaskIds) {
        const task = spec.tasks.find(t => t.id === taskId);
        if (!task) continue;

        const deps = spec.graph.reverseAdjacencyList.get(taskId) || [];
        const indent = '  '.repeat(deps.length);

        console.log(`${indent}${task.id}`);
        console.log(chalk.gray(`${indent}  ${task.title}`));
      }

      console.log(chalk.gray(`\nDepth: ${spec.graph.metadata.maxDepth} levels`));
      console.log(chalk.gray(`Total Tasks: ${spec.graph.metadata.taskCount}\n`));
    }

    await registry.destroy();

  } catch (error) {
    spinner.fail('Failed to build graph');
    throw error;
  }
}
