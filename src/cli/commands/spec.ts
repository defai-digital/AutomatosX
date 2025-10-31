/**
 * Spec Command - Spec-driven development CLI
 *
 * Main command for interacting with .specify/ directory:
 * - ax spec create - Create spec from natural language (v5.8.3)
 * - ax spec run - Execute tasks
 * - ax spec status - Show status
 * - ax spec validate - Validate spec files
 * - ax spec graph - Display dependency graph
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { spawn } from 'child_process';
import { SpecRegistry } from '../../core/spec/SpecRegistry.js';
import { SpecExecutor } from '../../core/spec/SpecExecutor.js';
import { SpecGenerator } from '../../core/spec/SpecGenerator.js';
import { SpecProgressRenderer } from '../renderers/spec-progress-renderer.js';
import { SessionManager } from '../../core/session-manager.js';
import { detectProjectRoot } from '../../core/path-resolver.js';
import { loadConfig } from '../../core/config.js';
import { Router } from '../../core/router.js';
import { ClaudeProvider } from '../../providers/claude-provider.js';
import { GeminiProvider } from '../../providers/gemini-provider.js';
import { OpenAIProvider } from '../../providers/openai-provider.js';
import { logger } from '../../utils/logger.js';
import { SpecError, SpecErrorCode } from '../../types/spec.js';
import type {
  SpecExecutorOptions,
  TaskFilter,
  SpecTask
} from '../../types/spec.js';
import readline from 'readline';
import { handleSpecInit } from './spec/init.js';
import { handleSpecExplain } from './spec/explain.js';

interface SpecOptions {
  // Subcommand
  subcommand?: string;

  // Create options (v5.8.3)
  description?: string;
  execute?: boolean;

  // Run options
  task?: string;
  'dry-run'?: boolean;
  parallel?: boolean;
  resume?: boolean;
  'no-streaming'?: boolean; // Phase 2B: Disable progress streaming (v5.11.0)

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

  // Init options (Phase 1)
  template?: string;
  output?: string;
  interactive?: boolean;

  // Explain options (Phase 1)
  file?: string;
  format?: 'markdown' | 'text' | 'json';
  sections?: string;

  // Phase 3 (v5.12.0): Internal config for direct execution
  _internalConfig?: any;
}

export const specCommand: CommandModule<Record<string, unknown>, SpecOptions> = {
  command: 'spec <subcommand>',
  describe: 'Spec-driven development commands',

  builder: (yargs) => {
    return yargs
      .positional('subcommand', {
        describe: 'Subcommand (init, create, run, status, validate, graph, explain)',
        type: 'string',
        choices: ['init', 'create', 'run', 'status', 'validate', 'graph', 'explain'],
        demandOption: true
      })
      // Create options (v5.8.3)
      .option('description', {
        describe: 'Task description in natural language (for create subcommand)',
        type: 'string'
      })
      .option('execute', {
        describe: 'Execute spec immediately after creation',
        type: 'boolean',
        default: false
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
      .option('no-streaming', {
        describe: 'Disable real-time progress streaming',
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
      // Init options (Phase 1)
      .option('template', {
        describe: 'Template name (minimal, enterprise, government)',
        type: 'string'
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string'
      })
      .option('interactive', {
        describe: 'Interactive mode (prompt for inputs)',
        type: 'boolean',
        default: true
      })
      // Explain options (Phase 1)
      .option('file', {
        describe: 'Spec file to explain',
        type: 'string'
      })
      .option('format', {
        describe: 'Output format (markdown, text, json)',
        type: 'string',
        choices: ['markdown', 'text', 'json'],
        default: 'markdown'
      })
      .option('sections', {
        describe: 'Sections to include (comma-separated)',
        type: 'string'
      })
      .example('$0 spec init', 'Initialize new spec interactively')
      .example('$0 spec init --template enterprise --output my-workflow.ax.yaml', 'Create from template')
      .example('$0 spec explain my-workflow.ax.yaml', 'Explain spec file')
      .example('$0 spec create "Build auth with DB, API, JWT, tests"', 'Create spec from natural language')
      .example('$0 spec create "Build auth" --execute', 'Create and execute immediately')
      .example('$0 spec run', 'Execute all pending tasks')
      .example('$0 spec run --task auth:impl', 'Run specific task')
      .example('$0 spec status', 'Show task status')
      .example('$0 spec validate', 'Validate spec files')
      .example('$0 spec graph', 'Display dependency graph');
  },

  handler: async (argv) => {
    try {
      const workspacePath = await detectProjectRoot(process.cwd());
      const config = await loadConfig(workspacePath);

      switch (argv.subcommand) {
        case 'init':
          await handleSpecInit(workspacePath, {
            template: argv.template,
            output: argv.output,
            interactive: argv.interactive
          });
          break;
        case 'create':
          await handleCreate(workspacePath, argv, config);
          break;
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
        case 'explain':
          if (!argv.file && argv._.length > 1) {
            // Support: ax spec explain my-workflow.ax.yaml
            argv.file = String(argv._[1]);
          }
          if (!argv.file) {
            console.error(chalk.red('✗ Error: --file option required for explain subcommand'));
            console.error(chalk.gray('Usage: ax spec explain <file> [--format markdown|text|json]'));
            process.exit(1);
          }
          await handleSpecExplain(workspacePath, {
            file: argv.file,
            format: argv.format as 'markdown' | 'text' | 'json',
            sections: argv.sections?.split(',').map(s => s.trim())
          });
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
 * Handle 'ax spec create' command (v5.8.3)
 */
async function handleCreate(
  workspacePath: string,
  argv: SpecOptions,
  config: any
): Promise<void> {
  console.log(chalk.blue.bold('\n🎨 Spec-Kit: Create from Natural Language\n'));

  // Get description from argv or prompt
  let description = argv.description;

  if (!description) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (query: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(query, (answer) => {
          resolve(answer);
        });
      });
    };

    try {
      description = await question(
        chalk.cyan('Describe your project (e.g., "Build authentication with database, API, JWT, audit, and tests"): ')
      );
      rl.close();
    } catch (error) {
      rl.close();
      console.error(chalk.red('✗ Failed to read input'));
      process.exit(1);
    }
  }

  if (!description || description.trim().length === 0) {
    console.error(chalk.red('✗ Description is required'));
    process.exit(1);
  }

  // Create provider and generator
  const spinner = ora('Analyzing task complexity...').start();

  try {
    // Use Claude provider for spec generation (highest priority)
    const claudeConfig = config.providers['claude-code'];
    if (!claudeConfig) {
      spinner.fail('Claude provider not configured');
      console.error(chalk.red('✗ Claude provider is required for spec generation'));
      process.exit(1);
    }
    // Convert config.ProviderConfig to provider.ProviderConfig by adding name
    const claudeProviderConfig: import('../../types/provider.js').ProviderConfig = {
      ...claudeConfig,
      name: 'claude-code',
      command: claudeConfig.command || 'claude'
    };
    const provider = new ClaudeProvider(claudeProviderConfig);
    const generator = new SpecGenerator(provider);

    // Analyze complexity
    const complexity = generator.analyzeComplexity(description);
    spinner.succeed('Task analyzed');

    console.log(chalk.gray('\n📊 Complexity Analysis:'));
    console.log(chalk.gray(`  Score: ${complexity.score}/10`));
    complexity.indicators.forEach((indicator) => {
      console.log(chalk.gray(`  • ${indicator}`));
    });

    // Generate spec
    spinner.start('Generating spec files with AI...');
    const spec = await generator.generate(description, workspacePath);
    spinner.succeed('Spec files generated');

    // Display summary
    console.log(chalk.green('\n✓ Spec created successfully!\n'));
    console.log(chalk.cyan('📁 Files:'));
    console.log(chalk.gray(`  • .specify/spec.md - Project specification`));
    console.log(chalk.gray(`  • .specify/plan.md - Technical plan`));
    console.log(chalk.gray(`  • .specify/tasks.md - ${spec.tasks.length} tasks with dependencies\n`));

    console.log(chalk.cyan('📋 Tasks Overview:'));
    const tasksByPhase = new Map<string, number>();
    for (const task of spec.tasks) {
      const prefix = task.id.split(':')[0] || 'default';
      tasksByPhase.set(prefix, (tasksByPhase.get(prefix) || 0) + 1);
    }
    for (const [phase, count] of tasksByPhase) {
      console.log(chalk.gray(`  • ${phase}: ${count} task${count > 1 ? 's' : ''}`));
    }

    console.log(chalk.cyan('\n🤖 Agents:'));
    const agents = new Set(spec.tasks.map(t => t.agent));
    agents.forEach(agent => {
      const count = spec.tasks.filter(t => t.agent === agent).length;
      console.log(chalk.gray(`  • ${agent}: ${count} task${count > 1 ? 's' : ''}`));
    });

    // Execute if --execute flag is set
    if (argv.execute) {
      console.log(chalk.cyan('\n▶️  Executing spec immediately...\n'));

      // Phase 3: Direct execution in same process (no subprocess!)
      await handleRun(workspacePath, {
        ...argv,
        parallel: true,
        // Pass internal context for reuse
        _internalConfig: config // Reuse config
      }, config);

      return;
    } else {
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(chalk.gray('  1. Review generated files in .specify/'));
      console.log(chalk.gray('  2. Validate: ax spec validate'));
      console.log(chalk.gray('  3. Execute: ax spec run --parallel\n'));
    }
  } catch (error) {
    spinner.fail('Failed to generate spec');
    throw error;
  }
}

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
    const registry = new SpecRegistry({
      workspacePath,
      enableCache: true,
      cacheSize: 100,
      enableWatch: false,
      validationOptions: {
        mode: 'strict',
        validateDependencies: true,
        validateOps: true
      }
    });
    const spec = await registry.load();

    spinner.succeed('Spec loaded');

    // Display execution plan
    console.log(chalk.cyan('\n📋 Spec Execution Plan'));
    console.log(chalk.gray(`  Workspace: ${workspacePath}`));
    console.log(chalk.gray(`  Spec ID: ${spec.metadata.id}`));

    const pendingTasks = spec.tasks.filter((t: SpecTask) => t.status === 'pending');
    const completedTasks = spec.tasks.filter((t: SpecTask) => t.status === 'completed');

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
        if (!task) continue;
        console.log(chalk.cyan(`[${i + 1}/${pendingTasks.length}]`), task.id);
        console.log(chalk.gray(`  ${task.title}`));
        console.log(chalk.gray(`  Command: ${task.ops}\n`));
      }

      return;
    }

    // Initialize session manager
    const sessionManager = new SessionManager({
      persistencePath: join(workspacePath, '.automatosx/sessions'),
      maxSessions: config.orchestration?.session?.maxSessions || 100
    });

    // Create session for this spec execution
    const session = await sessionManager.createSession(
      `Spec execution: ${spec.metadata.id}`,
      'spec-cli'
    );

    // Build task filter
    const taskFilter: TaskFilter | undefined = argv.task
      ? { taskIds: [argv.task] }
      : { status: ['pending'] };

    // Create executor
    const executorOptions: SpecExecutorOptions = {
      sessionId: session.id,
      parallel: argv.parallel ?? false,
      continueOnError: true,
      dryRun: false,
      taskFilter
    };

    const executor = new SpecExecutor(spec, executorOptions, sessionManager);

    // Phase 2B: Create progress renderer if streaming is enabled (v5.11.0)
    let renderer: SpecProgressRenderer | undefined;
    if (!argv['no-streaming']) {
      renderer = new SpecProgressRenderer(executor);
    } else {
      // Legacy mode: show starting message
      console.log(chalk.cyan('🚀 Starting execution...\n'));
    }

    // Execute
    const result = await executor.execute();

    // Phase 2B: Cleanup renderer (v5.11.0)
    if (renderer) {
      renderer.stop();
    }

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
    const registry = new SpecRegistry({
      workspacePath,
      enableCache: true,
      cacheSize: 100,
      enableWatch: false,
      validationOptions: {
        mode: 'strict',
        validateDependencies: true,
        validateOps: true
      }
    });
    const spec = await registry.load();

    spinner.succeed('Spec loaded');

    if (argv.json) {
      // JSON output
      const data = {
        specId: spec.metadata.id,
        version: spec.metadata.version,
        totalTasks: spec.tasks.length,
        completedTasks: spec.tasks.filter((t: SpecTask) => t.status === 'completed').length,
        pendingTasks: spec.tasks.filter((t: SpecTask) => t.status === 'pending').length,
        tasks: spec.tasks.map((t: SpecTask) => ({
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
      const completedTasks = spec.tasks.filter((t: SpecTask) => t.status === 'completed');
      const pendingTasks = spec.tasks.filter((t: SpecTask) => t.status === 'pending');

      console.log(chalk.cyan(`\n📊 Spec Status`));
      console.log(chalk.gray(`  Version: ${spec.metadata.version}`));
      console.log(chalk.gray(`  Workspace: ${workspacePath}`));
      // v6.2.10: Bug fix #37 - Prevent division by zero when spec has no tasks
      const progressPercent = spec.tasks.length > 0
        ? ((completedTasks.length / spec.tasks.length) * 100).toFixed(1)
        : '0.0';
      console.log(
        chalk.gray(
          `  Progress: ${completedTasks.length}/${spec.tasks.length} tasks (${progressPercent}%)\n`
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
    const registry = new SpecRegistry({
      workspacePath,
      enableCache: true,
      cacheSize: 100,
      enableWatch: false,
      validationOptions: {
        mode: 'strict',
        validateDependencies: true,
        validateOps: true
      }
    });
    const spec = await registry.load();
    const validation = await registry.validate();

    spinner.succeed('Validation completed');

    console.log(chalk.cyan('\n✅ Spec Validation Results\n'));

    // Display issues
    const allIssues = [...validation.errors, ...validation.warnings];

    if (validation.valid) {
      console.log(chalk.green('  All checks passed!\n'));
    } else {
      console.log(chalk.red(`  ${allIssues.length} issue(s) found:\n`));

      for (const issue of allIssues) {
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

    if (!validation.valid && argv.strict) {
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
    const registry = new SpecRegistry({
      workspacePath,
      enableCache: true,
      cacheSize: 100,
      enableWatch: false,
      validationOptions: {
        mode: 'strict',
        validateDependencies: true,
        validateOps: true
      }
    });
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
        const task = spec.tasks.find((t: SpecTask) => t.id === taskId);
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
