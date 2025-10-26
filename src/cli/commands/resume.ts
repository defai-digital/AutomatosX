/**
 * Resume Command - Resume execution from a saved checkpoint (v5.3.0)
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { join } from 'path';
import { StageExecutionController } from '../../core/stage-execution-controller.js';
import { CheckpointManager } from '../../core/checkpoint-manager.js';
import { ContextManager } from '../../agents/context-manager.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { AbilitiesManager } from '../../agents/abilities-manager.js';
import { AgentExecutor } from '../../agents/executor.js';
import { LazyMemoryManager } from '../../core/lazy-memory-manager.js';
import { Router } from '../../core/router.js';
import { PathResolver, detectProjectRoot } from '../../core/path-resolver.js';
import { SessionManager } from '../../core/session-manager.js';
import { WorkspaceManager } from '../../core/workspace-manager.js';
import { TeamManager } from '../../core/team-manager.js';
import { ClaudeProvider } from '../../providers/claude-provider.js';
import { GeminiProvider } from '../../providers/gemini-provider.js';
import { OpenAIProvider } from '../../providers/openai-provider.js';
import { loadConfig } from '../../core/config.js';
import { logger } from '../../utils/logger.js';
import type { ExecutionMode } from '../../types/stage-execution.js';

interface ResumeOptions {
  interactive?: boolean;
  streaming?: boolean;
  verbose?: boolean;
  autoContinue?: boolean;
  hybrid?: boolean;
}

export const resumeCommand: CommandModule<Record<string, unknown>, ResumeOptions> = {
  command: 'resume <run-id>',
  describe: 'Resume execution from a saved checkpoint',

  builder: (yargs) => {
    return yargs
      .positional('run-id', {
        describe: 'Checkpoint run ID',
        type: 'string',
        demandOption: true
      })
      .option('interactive', {
        alias: 'i',
        describe: 'Resume in interactive mode',
        type: 'boolean'
      })
      .option('streaming', {
        alias: 's',
        describe: 'Resume in streaming mode (overrides checkpoint value)',
        type: 'boolean'
        // No default - inherit from checkpoint if not specified
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      })
      .option('auto-continue', {
        describe: 'Auto-continue remaining stages',
        type: 'boolean',
        default: false
      })
      .option('hybrid', {
        describe: 'Enable both interactive and streaming (shortcut for --interactive --streaming)',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    // Validate runId
    if (!argv['run-id'] || typeof argv['run-id'] !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Run ID is required\n'));
      process.exit(1);
    }

    const runId = argv['run-id'] as string;

    console.log(chalk.blue.bold(`\n🔄 AutomatosX - Resuming ${runId.substring(0, 8)}...\n`));

    // Declare resources for cleanup
    let memoryManager: LazyMemoryManager | undefined;
    let router: Router | undefined;
    let contextManager: ContextManager | undefined;

    try {
      // 1. Detect project root directory
      const projectDir = await detectProjectRoot(process.cwd());

      // 2. Load configuration
      const config = await loadConfig(projectDir);

      if (argv.verbose) {
        console.log(chalk.gray(`Project: ${projectDir}`));
        console.log(chalk.gray(`Working directory: ${process.cwd()}`));
        console.log();
      }

      // 3. Initialize CheckpointManager
      const stageConfig = config.execution?.stages;
      const checkpointPath = stageConfig?.checkpointPath || join(projectDir, '.automatosx', 'checkpoints');
      const cleanupAfterDays = stageConfig?.cleanupAfterDays || 7;

      const checkpointManager = new CheckpointManager(checkpointPath, cleanupAfterDays);

      // 4. Load checkpoint
      const checkpoint = await checkpointManager.loadCheckpoint(runId);

      // Display resume summary
      console.log(chalk.cyan('📂 Checkpoint Found\n'));
      console.log(chalk.gray(`  Run ID: ${checkpoint.runId}`));
      console.log(chalk.gray(`  Agent: ${checkpoint.agent}`));
      console.log(chalk.gray(`  Task: ${checkpoint.task}`));
      console.log(chalk.gray(`  Progress: ${checkpoint.lastCompletedStageIndex + 1}/${checkpoint.stages.length} stages complete`));
      console.log(chalk.gray(`  Created: ${new Date(checkpoint.createdAt).toLocaleString()}`));
      console.log();

      // 5. Initialize components
      const teamManager = new TeamManager(
        join(projectDir, '.automatosx', 'teams')
      );

      const profileLoader = new ProfileLoader(
        join(projectDir, '.automatosx', 'agents'),
        undefined,
        teamManager
      );

      const abilitiesManager = new AbilitiesManager(
        join(projectDir, '.automatosx', 'abilities')
      );

      // Initialize memory manager if needed
      // v5.6.24: Use LazyMemoryManager for deferred initialization
      try {
        memoryManager = new LazyMemoryManager({
          dbPath: join(projectDir, '.automatosx', 'memory', 'memory.db')
        });

        if (argv.verbose) {
          console.log(chalk.green('✓ Memory system ready (lazy initialization)\n'));
        }
      } catch (error) {
        if (argv.verbose) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.log(chalk.yellow(`⚠ Memory features disabled: ${errMsg}\n`));
        }
      }

      const pathResolver = new PathResolver({
        projectDir,
        workingDir: process.cwd(),
        agentWorkspace: join(projectDir, '.automatosx', 'workspaces')
      });

      // 6. Initialize providers
      const providers = [];

      if (config.providers['claude-code']?.enabled) {
        providers.push(new ClaudeProvider({
          name: 'claude-code',
          enabled: true,
          priority: config.providers['claude-code'].priority,
          timeout: config.providers['claude-code'].timeout,
          command: config.providers['claude-code'].command
        }));
      }

      if (config.providers['gemini-cli']?.enabled) {
        providers.push(new GeminiProvider({
          name: 'gemini-cli',
          enabled: true,
          priority: config.providers['gemini-cli'].priority,
          timeout: config.providers['gemini-cli'].timeout,
          command: config.providers['gemini-cli'].command
        }));
      }

      if (config.providers['openai']?.enabled) {
        providers.push(new OpenAIProvider({
          name: 'openai',
          enabled: true,
          priority: config.providers['openai'].priority,
          timeout: config.providers['openai'].timeout,
          command: config.providers['openai'].command
        }));
      }

      // v5.7.0: Include router configuration for health checks
      const providerHealthCheckIntervals = providers
        .map(p => config.providers[p.name]?.healthCheck?.interval)
        .filter((interval): interval is number => interval !== undefined && interval > 0);

      const minProviderHealthCheckInterval = providerHealthCheckIntervals.length > 0
        ? Math.min(...providerHealthCheckIntervals)
        : undefined;

      const healthCheckInterval = minProviderHealthCheckInterval ?? config.router?.healthCheckInterval;

      router = new Router({
        providers,
        fallbackEnabled: true,
        healthCheckInterval,
        providerCooldownMs: config.router?.providerCooldownMs
      });

      // 7. Initialize orchestration managers
      const sessionManager = new SessionManager({
        persistencePath: join(projectDir, '.automatosx', 'sessions', 'sessions.json')
      });
      await sessionManager.initialize();

      const workspaceManager = new WorkspaceManager(projectDir);

      // 8. Create context manager
      contextManager = new ContextManager({
        profileLoader,
        abilitiesManager,
        memoryManager: memoryManager || null,
        router,
        pathResolver,
        sessionManager,
        workspaceManager
      });

      // 9. Create StageExecutionController
      const agentExecutor = new AgentExecutor({
        sessionManager,
        workspaceManager,
        contextManager,
        profileLoader
      });

      const stageExecutionConfig = {
        checkpointPath,
        autoSaveCheckpoint: stageConfig?.autoSaveCheckpoint ?? true,
        cleanupAfterDays,
        defaultStageTimeout: stageConfig?.defaultTimeout || 1500000,
        userDecisionTimeout: stageConfig?.prompts?.timeout || 60000,
        defaultMaxRetries: stageConfig?.retry?.defaultMaxRetries || 1,
        defaultRetryDelay: stageConfig?.retry?.defaultRetryDelay || 1000,
        progressUpdateInterval: stageConfig?.progress?.updateInterval || 1000,
        syntheticProgress: stageConfig?.progress?.syntheticProgress !== false,
        promptTimeout: stageConfig?.prompts?.timeout || 60000,
        autoConfirm: argv.autoContinue ?? stageConfig?.prompts?.autoConfirm ?? false
      };

      const controller = new StageExecutionController(
        agentExecutor,
        contextManager,
        profileLoader,
        stageExecutionConfig,
        undefined, // hooks
        memoryManager // memoryManager for stage result persistence
      );

      // 10. Determine execution mode (use checkpoint mode or override)
      const mode: ExecutionMode = {
        interactive: argv.hybrid ? true : (argv.interactive ?? checkpoint.mode.interactive),
        // Streaming: user flag > checkpoint value > default true (v5.6.5+)
        streaming: argv.hybrid ? true : (argv.streaming ?? checkpoint.mode.streaming ?? true),
        resumable: true,
        autoConfirm: argv.autoContinue ?? checkpoint.mode.autoConfirm ?? stageConfig?.prompts?.autoConfirm ?? false
      };

      // 11. Resume execution
      const result = await controller.resume(
        runId,
        mode,
        {
          verbose: argv.verbose
        }
      );

      // 12. Display result
      if (result.success) {
        console.log(chalk.green('\n✅ Execution completed successfully!'));
      } else {
        console.error(chalk.red('\n❌ Execution failed.'));

        // Cleanup resources
        if (memoryManager) {
          await memoryManager.close();
        }
        if (router) {
          router.destroy();
        }

        process.exit(1);
      }

      // 13. Cleanup resources
      if (memoryManager) {
        await memoryManager.close();
      }
      if (router) {
        router.destroy();
      }

      // Ensure event loop completes
      await new Promise(resolve => setImmediate(resolve));

      console.log(chalk.green.bold('✅ Complete\n'));
      process.exit(0);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Failed to resume: ${err.message}\n`));

      // Log error
      logger.error('Resume failed', {
        error: err.message,
        runId,
        stack: err.stack
      });

      // Cleanup resources
      try {
        if (memoryManager) {
          await memoryManager.close();
        }
        if (router) {
          router.destroy();
        }
        await new Promise(resolve => setImmediate(resolve));
      } catch (cleanupError) {
        const errMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        logger.debug('Cleanup error ignored', { error: errMsg });
      }

      process.exit(1);
    }
  }
};
