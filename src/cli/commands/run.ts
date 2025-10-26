/**
 * Run Command - Execute an agent with a specific task
 */

import type { CommandModule } from 'yargs';
import { ContextManager } from '../../agents/context-manager.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { AbilitiesManager } from '../../agents/abilities-manager.js';
import { AgentExecutor } from '../../agents/executor.js';
import type { Stage } from '../../types/agent.js';
import { AgentNotFoundError } from '../../types/agent.js';
import { StageExecutionController } from '../../core/stage-execution-controller.js';
import type { ExecutionMode } from '../../types/stage-execution.js';
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
import chalk from 'chalk';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import boxen from 'boxen';
import type { ExecutionResult } from '../../agents/executor.js';
import { formatOutput, formatForSave } from '../../utils/output-formatter.js';

interface RunOptions {
  provider?: string;
  model?: string;
  memory?: boolean;
  saveMemory?: boolean;
  verbose?: boolean;
  format?: 'text' | 'json' | 'markdown';
  save?: string;
  timeout?: number;
  session?: string;
  // v5.3.0: Interactive stage execution
  interactive?: boolean;
  resumable?: boolean;
  autoContinue?: boolean;
  streaming?: boolean;
  hybrid?: boolean;
  // v5.6.0: Parallel execution
  parallel?: boolean;
  showDependencyGraph?: boolean;
  showTimeline?: boolean;
}

export const runCommand: CommandModule<Record<string, unknown>, RunOptions> = {
  command: 'run <agent> <task>',
  describe: 'Run an agent with a specific task',

  builder: (yargs) => {
    return yargs
      .positional('agent', {
        describe: 'Agent name',
        type: 'string',
        demandOption: true
      })
      .positional('task', {
        describe: 'Task to execute',
        type: 'string',
        demandOption: true
      })
      .option('provider', {
        describe: 'Override provider (claude, gemini, openai)',
        type: 'string'
      })
      .option('model', {
        describe: 'Override model',
        type: 'string'
      })
      .option('memory', {
        describe: 'Inject memory',
        type: 'boolean'
        // v5.6.24: No default here - use config.cli.run.defaultMemory instead
      })
      .option('save-memory', {
        describe: 'Save result to memory',
        type: 'boolean'
        // v5.6.24: No default here - use config.cli.run.defaultSaveMemory instead
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        choices: ['text', 'json', 'markdown'],
        default: 'text'
      })
      .option('save', {
        describe: 'Save result to file',
        type: 'string'
      })
      .option('timeout', {
        describe: 'Execution timeout in seconds',
        type: 'number'
      })
      .option('session', {
        describe: 'Join existing multi-agent session',
        type: 'string'
      })
      .option('interactive', {
        alias: 'i',
        describe: 'Enable interactive checkpoint mode',
        type: 'boolean'
      })
      .option('resumable', {
        describe: 'Enable checkpoint save for resume',
        type: 'boolean'
      })
      .option('auto-continue', {
        describe: 'Auto-confirm all checkpoints (CI mode)',
        type: 'boolean'
      })
      .option('streaming', {
        describe: 'Enable real-time progress (Phase 2)',
        type: 'boolean',
        default: true
      })
      .option('hybrid', {
        describe: 'Enable both interactive and streaming (shortcut for --interactive --streaming)',
        type: 'boolean',
        default: false
      })
      .option('parallel', {
        describe: 'Enable parallel execution of independent agent delegations (v5.6.0+)',
        type: 'boolean',
        default: true
      })
      .option('show-dependency-graph', {
        describe: 'Show agent dependency graph before execution (requires --parallel)',
        type: 'boolean',
        default: true
      })
      .option('show-timeline', {
        describe: 'Show execution timeline after completion (requires --parallel)',
        type: 'boolean',
        default: true
      })
  },

  handler: async (argv) => {
    // Validate inputs
    if (!argv.agent || typeof argv.agent !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Agent name is required\n'));
      process.exit(1);
    }

    if (!argv.task || typeof argv.task !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Task is required\n'));
      process.exit(1);
    }

    console.log(chalk.blue.bold(`\n🤖 AutomatosX - Running ${argv.agent}\n`));

    // Declare resources in outer scope for cleanup
    // v5.6.24: Use LazyMemoryManager for deferred initialization
    let memoryManager: LazyMemoryManager | undefined;
    let router: Router | undefined;
    let contextManager: ContextManager | undefined;
    let context: any;
    let resolvedAgentName: string = argv.agent as string; // Default to input, will be resolved later

    try {
      // 1. Detect project root directory
      // Use detectProjectRoot to properly resolve project root even from subdirectories
      const projectDir = await detectProjectRoot(process.cwd());

      // 2. Load configuration from project root
      const config = await loadConfig(projectDir);

      // v5.6.24: Apply config defaults if CLI flags not specified
      if (argv.memory === undefined) {
        argv.memory = config.cli?.run?.defaultMemory ?? false;
      }
      if (argv.saveMemory === undefined) {
        argv.saveMemory = config.cli?.run?.defaultSaveMemory ?? false;
      }

      // v5.6.24: Log memory decision for debugging
      const memoryEnabled = argv.memory || argv.saveMemory;
      const memorySource = argv.memory === undefined ? 'config default' : 'CLI flag';

      logger.info('🔧 Memory configuration', {
        'argv.memory': argv.memory,
        'argv.saveMemory': argv.saveMemory,
        'config.defaultMemory': config.cli?.run?.defaultMemory,
        'source': memorySource,
        'decision': memoryEnabled ? 'ENABLE' : 'DISABLE',
        'willCreateLazyManager': memoryEnabled
      });

      if (argv.verbose) {
        console.log(chalk.gray(`Project: ${projectDir}`));
        console.log(chalk.gray(`Working directory: ${process.cwd()}`));
        console.log();
      }

      // 3. Initialize components
      // v4.10.0+: Initialize TeamManager for team-based configuration
      const teamManager = new TeamManager(
        join(projectDir, '.automatosx', 'teams')
      );

      const profileLoader = new ProfileLoader(
        join(projectDir, '.automatosx', 'agents'),
        undefined, // fallbackProfilesDir (uses default)
        teamManager
      );

      // Resolve agent name early (supports displayName → actual name)
      // This ensures consistency across session, memory, and all operations
      try {
        resolvedAgentName = await profileLoader.resolveAgentName(argv.agent as string);

        if (argv.verbose) {
          if (resolvedAgentName !== argv.agent) {
            console.log(chalk.gray(`Resolved agent: ${argv.agent} → ${resolvedAgentName}`));
          }
        }
      } catch (error) {
        // Agent not found - show helpful suggestions
        console.error(chalk.red.bold(`\n❌ Agent not found: ${argv.agent}\n`));

        // Try to suggest similar agents
        try {
          const suggestions = await profileLoader.findSimilarAgents(argv.agent as string, 3);
          const closeSuggestions = suggestions.filter(s => s.distance <= 3);

          if (closeSuggestions.length > 0) {
            console.log(chalk.yellow('💡 Did you mean:\n'));
            closeSuggestions.forEach((s, i) => {
              const displayInfo = s.displayName ? `${s.displayName} (${s.name})` : s.name;
              const roleInfo = s.role ? ` - ${s.role}` : '';
              console.log(chalk.cyan(`  ${i + 1}. ${displayInfo}${roleInfo}`));
            });
            console.log();
          } else {
            console.log(chalk.gray('Run "ax agent list" to see available agents.\n'));
          }
        } catch {
          console.log(chalk.gray('Run "ax agent list" to see available agents.\n'));
        }

        process.exit(1);
      }

      const abilitiesManager = new AbilitiesManager(
        join(projectDir, '.automatosx', 'abilities')
      );

      // Initialize memory manager (v4.11.0: No embedding provider required)
      // v5.6.24: Use LazyMemoryManager for deferred initialization (-328ms startup time!)
      //
      // LazyMemoryManager delays expensive database initialization until first use.
      // This reduces CLI startup from 355ms to ~27ms (-92%).
      //
      // Initialize if either --memory (inject) or --save-memory (save) is enabled
      try {
        if (argv.memory || argv.saveMemory) {
          // v5.6.24: Lazy initialization - no await needed!
          // Database setup happens on first search() or add() call
          memoryManager = new LazyMemoryManager({
            dbPath: join(projectDir, '.automatosx', 'memory', 'memory.db')
          });

          if (argv.verbose) {
            console.log(chalk.green('✓ Memory system ready (lazy initialization)\n'));
          }
        }
      } catch (error) {
        // Graceful fallback if memory initialization fails
        const errMsg = error instanceof Error ? error.message : String(error);
        if (argv.verbose) {
          console.log(chalk.yellow(`⚠ Memory features disabled: ${errMsg}\n`));
        }
        argv.memory = false;
        argv.saveMemory = false;
      }

      // v5.2: agentWorkspace path kept for PathResolver compatibility (directory not created)
      const pathResolver = new PathResolver({
        projectDir,
        workingDir: process.cwd(),
        agentWorkspace: join(projectDir, '.automatosx', 'workspaces')
      });

      // 4. Initialize providers from config
      // Phase 2 (v5.6.2): Pass enhanced detection parameters to providers
      const providers = [];

      if (config.providers['claude-code']?.enabled) {
        const claudeConfig = config.providers['claude-code'];
        providers.push(new ClaudeProvider({
          name: 'claude-code',
          enabled: true,
          priority: claudeConfig.priority,
          timeout: claudeConfig.timeout,
          command: claudeConfig.command,
          // Phase 2: Enhanced CLI detection parameters
          customPath: claudeConfig.customPath,
          versionArg: claudeConfig.versionArg,
          minVersion: claudeConfig.minVersion
        }));
      }

      if (config.providers['gemini-cli']?.enabled) {
        const geminiConfig = config.providers['gemini-cli'];
        providers.push(new GeminiProvider({
          name: 'gemini-cli',
          enabled: true,
          priority: geminiConfig.priority,
          timeout: geminiConfig.timeout,
          command: geminiConfig.command,
          // Phase 2: Enhanced CLI detection parameters
          customPath: geminiConfig.customPath,
          versionArg: geminiConfig.versionArg,
          minVersion: geminiConfig.minVersion
        }));
      }

      if (config.providers['openai']?.enabled) {
        const openaiConfig = config.providers['openai'];
        providers.push(new OpenAIProvider({
          name: 'openai',
          enabled: true,
          priority: openaiConfig.priority,
          timeout: openaiConfig.timeout,
          command: openaiConfig.command,
          // Phase 2: Enhanced CLI detection parameters
          customPath: openaiConfig.customPath,
          versionArg: openaiConfig.versionArg,
          minVersion: openaiConfig.minVersion
        }));
      }

      // Phase 2 (v5.6.2): Enable background health checks if configured
      // Phase 2.1 (v5.7.0): Use router.healthCheckInterval from config, with provider-level overrides
      const providerHealthCheckIntervals = providers
        .map(p => config.providers[p.name]?.healthCheck?.interval)
        .filter((interval): interval is number => interval !== undefined && interval > 0);

      const minProviderHealthCheckInterval = providerHealthCheckIntervals.length > 0
        ? Math.min(...providerHealthCheckIntervals)
        : undefined;

      // Priority: provider-level min interval > router config > undefined (disabled)
      const healthCheckInterval = minProviderHealthCheckInterval ?? config.router?.healthCheckInterval;

      router = new Router({
        providers,
        fallbackEnabled: true,
        healthCheckInterval,
        providerCooldownMs: config.router?.providerCooldownMs
      });

      // 5. Initialize orchestration managers
      // v4.7.8+: Always initialize for delegation support (all agents can delegate)
      let sessionManager: SessionManager | undefined;
      let workspaceManager: WorkspaceManager | undefined;

      // Initialize SessionManager
      sessionManager = new SessionManager({
        persistencePath: join(projectDir, '.automatosx', 'sessions', 'sessions.json')
      });
      await sessionManager.initialize();

      // Initialize WorkspaceManager
      // v5.2: WorkspaceManager uses lazy initialization (no need to call initialize)
      workspaceManager = new WorkspaceManager(projectDir);

      // If session ID provided, verify and join it
      if (argv.session) {
        // Verify session exists
        const session = await sessionManager.getSession(argv.session);
        if (!session) {
          console.log(chalk.red.bold(`\n✗ Session not found: ${argv.session}\n`));
          process.exit(1);
        }

        // Add this agent to the session (use resolved name for consistency)
        await sessionManager.addAgent(argv.session, resolvedAgentName);

        if (argv.verbose) {
          console.log(chalk.cyan(`\n🔗 Joined session: ${argv.session}`));
          console.log(chalk.gray(`Session task: ${session.task}`));
          console.log(chalk.gray(`Agents in session: ${session.agents.join(', ')}\n`));
        }
      }

      // 6. Create context manager
      contextManager = new ContextManager({
        profileLoader,
        abilitiesManager,
        memoryManager: memoryManager || null,
        router,
        pathResolver,
        sessionManager,
        workspaceManager
      });

      // 7. Create execution context
      if (argv.verbose) {
        console.log(chalk.gray('Creating execution context...'));
        console.log();
      }

      try {
        context = await contextManager.createContext(
          resolvedAgentName,
          argv.task as string,
          {
            provider: argv.provider,
            model: argv.model,
            skipMemory: !argv.memory,
            sessionId: argv.session
          }
        );
      } catch (error) {
        // Handle agent not found error with suggestions
        if (error instanceof AgentNotFoundError) {
          const agentName = resolvedAgentName;
          console.log(chalk.red.bold(`\n❌ Agent not found: ${agentName}\n`));

          // Find similar agents (loads profiles silently from cache or disk)
          const suggestions = await profileLoader.findSimilarAgents(agentName, 3);

          if (suggestions.length > 0) {
            // Filter to only very similar agents (distance <= 3)
            const closeSuggestions = suggestions.filter(s => s.distance <= 3);

            if (closeSuggestions.length > 0) {
              console.log(chalk.yellow('💡 Did you mean:\n'));
              closeSuggestions.forEach((s, i) => {
                const displayInfo = s.displayName ? `${s.displayName} (${s.name})` : s.name;
                const roleInfo = s.role ? ` - ${s.role}` : '';
                console.log(chalk.cyan(`  ${i + 1}. ${displayInfo}${roleInfo}`));
              });

              console.log(chalk.gray('\nTo use one of these agents:'));
              console.log(chalk.gray(`  automatosx run ${closeSuggestions[0]!.name} "${argv.task}"`));
              console.log();
            } else {
              // No close matches, show all available agents
              console.log(chalk.yellow('💡 Available agents:\n'));
              const allAgents = await profileLoader.listProfiles();
              allAgents.slice(0, 10).forEach(name => {
                console.log(chalk.cyan(`  • ${name}`));
              });
              if (allAgents.length > 10) {
                console.log(chalk.gray(`  ... and ${allAgents.length - 10} more`));
              }
              console.log(chalk.gray('\nRun "automatosx list agents" to see all agents\n'));
            }
          }

          process.exit(1);
        }
        // Re-throw other errors
        throw error;
      }

      // 8. Detect if agent has multi-stage workflow
      const hasStages = context.agent.stages && context.agent.stages.length > 0;

      if (hasStages) {
        const stages = context.agent.stages;

        // v5.7.0: Always use StageExecutionController for multi-stage agents
        // Legacy StageExecutor and AdvancedStageExecutor have been removed
        if (argv.verbose) {
          console.log(chalk.cyan(`\n📋 Multi-stage execution (${context.agent.stages.length} stages)\n`));
        }

        // Get stage configuration
        const stageConfig = config.execution?.stages;
        const checkpointPath = stageConfig?.checkpointPath || join(projectDir, '.automatosx', 'checkpoints');
        const cleanupAfterDays = stageConfig?.cleanupAfterDays || 7;

        // Enable real-time provider output if verbose or streaming mode (v5.6.5)
        if (argv.verbose || argv.streaming || argv.hybrid) {
          process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT = 'true';
        }

        // Create StageExecutionController
        const agentExecutor = new AgentExecutor({
          sessionManager,
          workspaceManager,
          contextManager,
          profileLoader
        });

        const stageExecutionConfig = {
          checkpointPath,
          autoSaveCheckpoint: argv.resumable ?? stageConfig?.autoSaveCheckpoint ?? false,
          cleanupAfterDays,
          defaultStageTimeout: argv.timeout ? argv.timeout * 1000 : (stageConfig?.defaultTimeout || 1500000),
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

        // Build execution mode
        const executionMode: ExecutionMode = {
          interactive: argv.hybrid ? true : (argv.interactive ?? false),
          streaming: argv.hybrid ? true : (argv.streaming ?? false),
          resumable: argv.resumable ?? stageConfig?.autoSaveCheckpoint ?? false,
          autoConfirm: argv.autoContinue ?? stageConfig?.prompts?.autoConfirm ?? false
        };

        // Execute with controller
        const result = await controller.execute(
          context.agent,
          argv.task as string,
          executionMode,
          { showPlan: true, verbose: argv.verbose }
        );

        // Display result
        console.log(chalk.green('\n✅ Execution completed successfully'));
        if (result.checkpointPath) {
          console.log(chalk.gray(`Checkpoint saved: ${result.runId}`));
          console.log(chalk.gray(`Resume with: ax resume ${result.runId}`));
        }

        // Save to memory if requested
        if (argv.saveMemory && memoryManager) {
          try {
            const metadata = {
              type: 'conversation' as const,
              source: 'agent-execution',
              agentId: resolvedAgentName,
              tags: ['agent-execution', resolvedAgentName, 'stage-execution'],
              provider: context.provider.name,
              timestamp: new Date().toISOString()
            };

            const embedding = null;
            const content = `Agent: ${resolvedAgentName}\nTask: ${argv.task}\n\nResult: ${result.stages.map(s => s.output).join('\n\n')}`;
            await memoryManager.add(content, embedding, metadata);

            if (argv.verbose) {
              console.log(chalk.green('✓ Conversation saved to memory'));
            }
          } catch (error) {
            if (argv.verbose) {
              console.log(chalk.yellow(`⚠ Failed to save to memory: ${(error as Error).message}`));
            }
          }
        }

      } else {
        // Enable real-time provider output if verbose or streaming mode (v5.6.5)
        if (argv.verbose || argv.streaming) {
          process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT = 'true';
        }

        // Use regular AgentExecutor for single-stage execution
        // Configure with orchestration support if managers are available
        const executor = new AgentExecutor({
          sessionManager,
          workspaceManager,
          contextManager,
          profileLoader
        });
        let result: ExecutionResult;

        if (argv.timeout) {
          const timeoutMs = argv.timeout * 1000;
          const controller = new AbortController();

          const timeoutId = setTimeout(() => {
            controller.abort();
          }, timeoutMs);

          try {
            result = await executor.execute(context, {
              verbose: argv.verbose,
              showProgress: !argv.verbose,
              signal: controller.signal,
              parallelEnabled: Boolean(argv.parallel),
              maxConcurrentDelegations: config.execution?.maxConcurrentAgents,
              continueDelegationsOnFailure: true,
              showDependencyGraph: Boolean(argv.showDependencyGraph),
              showTimeline: Boolean(argv.showTimeline)
            });
          } finally{
            clearTimeout(timeoutId);
          }

          // Check if execution was aborted
          if (controller.signal.aborted) {
            throw new Error(`Execution timeout after ${argv.timeout} seconds`);
          }
        } else {
          result = await executor.execute(context, {
            verbose: argv.verbose,
            showProgress: !argv.verbose,
            parallelEnabled: Boolean(argv.parallel),
            maxConcurrentDelegations: config.execution?.maxConcurrentAgents,
            continueDelegationsOnFailure: true,
            showDependencyGraph: Boolean(argv.showDependencyGraph),
            showTimeline: Boolean(argv.showTimeline)
          });
        }

        // 9. Format and display result
        const formattedOutput = formatOutput(result, argv.format || 'text', argv.verbose || false);
        console.log(formattedOutput);

        // 10. Save result to file
        if (argv.save) {
          try {
            const savePath = argv.save;
            const saveDir = join(savePath, '..');
            await mkdir(saveDir, { recursive: true });

            const outputData = formatForSave(result, argv.format || 'text', {
              agent: resolvedAgentName,
              task: argv.task
            });

            writeFileSync(savePath, outputData, 'utf-8');
            console.log(chalk.green(`\n✅ Result saved to: ${savePath}\n`));
          } catch (error) {
            console.log(chalk.yellow(`⚠ Failed to save result: ${(error as Error).message}\n`));
          }
        }

        // 11. Save result to memory
        if (argv.saveMemory && memoryManager) {
          try {
            const metadata = {
              type: 'conversation' as const,
              source: 'agent-execution',
              agentId: resolvedAgentName,
              tags: ['agent-execution', resolvedAgentName],
              provider: context.provider.name,
              timestamp: new Date().toISOString()
            };

            // FTS5 doesn't need real embeddings - use null
            const embedding = null;

            // Build content from execution result
            const content = `Agent: ${resolvedAgentName}\nTask: ${argv.task}\n\nResponse: ${result.response.content}`;

            // Save to memory
            await memoryManager.add(content, embedding, metadata);

            if (argv.verbose) {
              console.log(chalk.green('✓ Conversation saved to memory'));
            }
          } catch (error) {
            // Don't fail the command if memory save fails
            if (argv.verbose) {
              console.log(chalk.yellow(`⚠ Failed to save to memory: ${(error as Error).message}`));
            }
          }
        }
      }

      // 12. Cleanup resources
      await contextManager.cleanup(context);

      // Clean up memory manager (close database connections)
      if (memoryManager) {
        await memoryManager.close();
      }

      // Clean up router (stop health checks)
      if (router) {
        router.destroy();
      }

      // Ensure event loop completes all pending operations
      await new Promise(resolve => setImmediate(resolve));

      console.log(chalk.green.bold('✅ Complete\n'));

      // Graceful shutdown: cleanup all child processes before exit
      // Fixes: Background tasks hanging when run via Claude Code
      const { processManager } = await import('../../utils/process-manager.js');
      await processManager.shutdown(3000); // 3 second timeout

      // Close stdio streams to signal completion
      if (process.stdout.writable) {
        process.stdout.end();
      }
      if (process.stderr.writable) {
        process.stderr.end();
      }

      // Explicitly exit process to prevent hanging
      // (Required for integration tests and clean process termination)
      process.exit(0);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const executor = new AgentExecutor();

      // Display error with helpful suggestions
      executor.displayError(err, resolvedAgentName, { verbose: argv.verbose });

      // Log error
      logger.error('Agent execution failed', {
        error: err.message,
        agent: resolvedAgentName,
        task: argv.task,
        provider: argv.provider,
        stack: err.stack
      });

      // Cleanup resources even on error
      try {
        if (memoryManager) {
          await memoryManager.close();
        }
        if (router) {
          router.destroy();
        }
        // Clean up context (workspace, temp files)
        if (contextManager && context) {
          await contextManager.cleanup(context).catch(cleanupErr => {
            const errMsg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
            logger.debug('Context cleanup error', { error: errMsg });
          });
        }
        // Ensure event loop completes all pending operations
        await new Promise(resolve => setImmediate(resolve));

        // Graceful shutdown: cleanup all child processes before exit
        const { processManager } = await import('../../utils/process-manager.js');
        await processManager.shutdown(3000); // 3 second timeout

        // Close stdio streams
        if (process.stdout.writable) {
          process.stdout.end();
        }
        if (process.stderr.writable) {
          process.stderr.end();
        }
      } catch (cleanupError) {
        const errMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        logger.debug('Cleanup error ignored', { error: errMsg });
      }

      process.exit(1);
    }
  }
};
