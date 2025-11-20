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
import { createOpenAIProviderSync } from '../../providers/openai-provider-factory.js';
import { loadConfig } from '../../core/config.js';
import { logger } from '../../utils/logger.js';
import { writeAgentStatus } from '../../utils/agent-status-writer.js';
import { IterateModeController } from '../../core/iterate/iterate-mode-controller.js';
import type { ExecutionHooks } from '../../agents/executor.js';
// Note: CostTracker removed in v8.3.0 - cost tracking disabled in iterate mode
// import { CostTracker } from '../../core/cost-tracker.js';
import { IterateStatusRenderer } from '../renderers/iterate-status-renderer.js';
import { VerbosityManager, VerbosityLevel } from '../../utils/verbosity-manager.js';
import chalk from 'chalk';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import boxen from 'boxen';
import type { ExecutionResult } from '../../agents/executor.js';
import { formatOutput, formatForSave } from '../../utils/output-formatter.js';
import { existsSync } from 'fs';
import readline from 'readline';

interface RunOptions {
  provider?: string;
  model?: string;
  memory?: boolean;
  saveMemory?: boolean;
  verbose?: boolean;
  quiet?: boolean; // v8.5.8: Quiet mode flag
  verbosity?: number; // v8.5.8: Explicit verbosity level (0-2)
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
  // v5.8.3: Spec-kit integration
  noSpec?: boolean;
  // v6.0.7 Phase 3: OpenAI enhancements
  sandbox?: string;
  showCost?: boolean;
  // v6.4.0: Iterate mode (autonomous execution)
  iterate?: boolean;
  iterateTimeout?: number;
  iterateStrictness?: 'paranoid' | 'balanced' | 'permissive';
  iterateDryRun?: boolean;
  // v8.6.0: Token-based limits
  iterateMaxTokens?: number;
  iterateMaxTokensPerIteration?: number;
  iterateWarnAtTokenPercent?: number[];
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
        describe: 'Verbose output (level 2)',
        type: 'boolean',
        default: false
      })
      .option('quiet', {
        alias: 'q',
        describe: 'Quiet mode - minimal output (level 0)',
        type: 'boolean',
        default: false
      })
      .option('verbosity', {
        describe: 'Output verbosity level (0=quiet, 1=normal, 2=verbose)',
        type: 'number',
        choices: [0, 1, 2]
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
      .option('no-spec', {
        describe: 'Bypass spec-kit suggestion for complex tasks (v5.8.3+)',
        type: 'boolean',
        default: false
      })
      .option('sandbox', {
        describe: 'Sandbox mode for code execution (v6.0.7 Phase 3)',
        type: 'string',
        choices: ['none', 'workspace-read', 'workspace-write', 'full']
      })
      .option('show-cost', {
        describe: 'Display model, tokens, and cost after execution (v6.0.7 Phase 3)',
        type: 'boolean',
        default: true
      })
      .option('iterate', {
        describe: 'Enable autonomous iterate mode (auto-respond to confirmations) (v6.4.0)',
        type: 'boolean',
        default: false
      })
      .option('iterate-timeout', {
        describe: 'Max duration for iterate mode in minutes (default: 120)',
        type: 'number'
      })
      .option('iterate-max-tokens', {
        describe: 'Max total tokens for iterate mode (default: 1,000,000)',
        type: 'number'
      })
      .option('iterate-max-tokens-per-iteration', {
        describe: 'Max tokens per single iteration (default: 100,000). Prevents runaway API calls.',
        type: 'number'
      })
      .option('iterate-strictness', {
        describe: 'Classification strictness: paranoid, balanced, or permissive (default: balanced)',
        type: 'string',
        choices: ['paranoid', 'balanced', 'permissive']
      })
      .option('iterate-dry-run', {
        describe: 'Dry run: show what would be auto-responded without actually sending',
        type: 'boolean',
        default: false
      })
  },

  handler: async (argv) => {
    // v8.5.8: Initialize verbosity manager early
    // Priority: explicit --verbosity > --quiet/--verbose flags > auto-detection
    let verbosityLevel: VerbosityLevel | undefined;
    if (argv.verbosity !== undefined) {
      verbosityLevel = argv.verbosity as VerbosityLevel;
    } else if (argv.quiet) {
      verbosityLevel = VerbosityLevel.QUIET;
    } else if (argv.verbose) {
      verbosityLevel = VerbosityLevel.VERBOSE;
    }
    // If no explicit level, VerbosityManager will auto-detect
    const verbosity = VerbosityManager.getInstance(verbosityLevel);

    // Validate inputs
    if (!argv.agent || typeof argv.agent !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Agent name is required\n'));
      process.exit(1);
    }

    if (!argv.task || typeof argv.task !== 'string') {
      console.log(chalk.red.bold('\n❌ Error: Task is required\n'));
      process.exit(1);
    }

    // v5.8.3: Detect complex tasks and suggest spec-kit (unless --no-spec flag is set)
    if (!argv.noSpec) {
      // Simple complexity check without provider initialization
      // (saves time and avoids dependency issues)
      const SpecGeneratorClass = (await import('../../core/spec/SpecGenerator.js')).SpecGenerator;
      const tempGenerator = new SpecGeneratorClass(null as any); // Temporary for analysis only
      const complexity = tempGenerator.analyzeComplexity(argv.task);

      if (complexity.isComplex) {
        // FIXED (Bug #80 - Part 2): Skip spec-kit prompt entirely in iterate/auto-continue mode
        // When --iterate or --auto-continue is set, user wants autonomous execution
        // BUG #45 FIX: Also skip prompt when stdin is not a TTY (non-interactive context)
        const skipPrompt = argv.autoContinue || argv.iterate || !process.stdin.isTTY;

        if (skipPrompt) {
          // Autonomous mode or non-interactive: Skip complexity prompt entirely and continue with standard ax run
          // v8.5.8: Only show message in verbose mode to reduce noise
          if (verbosity.shouldShow('showComplexityAnalysis')) {
            const reason = !process.stdin.isTTY ? 'non-interactive mode' : 'autonomous mode';
            console.log(chalk.gray(`\n→ Complex task detected, continuing with standard ax run (${reason})...\n`));
          }
        } else {
          // Interactive mode: Show complexity analysis and prompt user
          // Show complexity analysis
          console.log(chalk.yellow.bold('\n⚠️  Complex Task Detected\n'));
          console.log(chalk.gray('This task appears to be complex and multi-step:'));
          complexity.indicators.forEach((indicator) => {
            console.log(chalk.gray(`  • ${indicator}`));
          });
          console.log(chalk.gray(`\nComplexity Score: ${complexity.score}/10\n`));

          // Show spec-kit benefits
          console.log(chalk.cyan.bold('💡 Consider using Spec-Kit for:\n'));
          console.log(chalk.gray('  ✓ Automatic dependency management'));
          console.log(chalk.gray('  ✓ Parallel execution of independent tasks'));
          console.log(chalk.gray('  ✓ Progress tracking and resume capability'));
          console.log(chalk.gray('  ✓ Better orchestration across multiple agents\n'));

          // Only create readline interface in interactive mode
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
            const answer = await question(
              chalk.cyan('Would you like to create a spec-driven workflow instead? (Y/n): ')
            );

            if (answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no') {
              // User wants spec-kit workflow
              console.log(chalk.green('\n✓ Generating spec-driven workflow...\n'));

              const projectDir = await detectProjectRoot(process.cwd());
              const tempConfig = await loadConfig(projectDir);

              // Use Claude provider for spec generation (highest priority)
              const claudeConfig = tempConfig.providers['claude-code'];
              if (!claudeConfig) {
                console.error(chalk.red('✗ Claude provider not configured'));
                rl.close(); // FIXED (Bug #91): Ensure readline closed before exit
                process.exit(1);
              }
              // Convert config.ProviderConfig to provider.ProviderConfig by adding name
              const claudeProviderConfig: import('../../types/provider.js').ProviderConfig = {
                ...claudeConfig,
                name: 'claude-code',
                command: claudeConfig.command || 'claude'
              };
              const tempProvider = new ClaudeProvider(claudeProviderConfig);
              const realGenerator = new SpecGeneratorClass(tempProvider);
              const spec = await realGenerator.generate(argv.task, projectDir);

              console.log(chalk.green('✓ Generated spec files:\n'));
              console.log(chalk.gray(`  • .specify/spec.md - Project specification`));
              console.log(chalk.gray(`  • .specify/plan.md - Technical plan`));
              console.log(chalk.gray(`  • .specify/tasks.md - ${spec.tasks.length} tasks with dependencies\n`));

              // Ask if user wants to execute now
              const executeAnswer = await question(
                chalk.cyan('Execute spec now with parallel mode? (Y/n): ')
              );

              // FIXED (Bug #91): Close readline before any process.exit() call
              rl.close();

              if (executeAnswer.toLowerCase() !== 'n' && executeAnswer.toLowerCase() !== 'no') {
                // Execute spec with parallel mode
                console.log(chalk.blue('\n🚀 Executing spec-driven workflow...\n'));
                const { spawn } = await import('child_process');

                // FIX Bug #140: Remove shell:true for security
                // No shell needed for known executable with safe arguments
                const child = spawn('ax', ['spec', 'run', '--parallel'], {
                  stdio: 'inherit',
                  shell: false, // FIXED Bug #140: Removed shell:true for security
                });

                return new Promise<void>((resolve) => {
                  child.on('close', (code) => {
                    process.exit(code || 0);
                  });
                });
              } else {
                console.log(chalk.yellow('\n💡 To execute later, run: ax spec run --parallel\n'));
                process.exit(0);
              }
            } else {
              rl.close();
              console.log(chalk.gray('\n→ Continuing with standard ax run...\n'));
            }
          } catch (error) {
            rl.close();
            console.log(chalk.gray('\n→ Continuing with standard ax run...\n'));
          } finally {
            // FIXED (Bug #91): Ensure readline is always closed, even on unexpected errors
            // This handles edge cases where the interface might still be open
            try {
              rl.close();
            } catch {
              // Interface already closed, ignore
            }
          }
        }
      }
    }

    // v8.5.8: Show banner only in normal/verbose mode
    if (verbosity.shouldShow('showBanner')) {
      console.log(chalk.blue.bold(`\n🤖 AutomatosX - Running ${argv.agent}\n`));
    }

    // v8.5.8 Phase 3: Quiet mode optimizations
    if (verbosity.isQuiet()) {
      // Disable optional features that create noise
      argv.showDependencyGraph = false;
      argv.showTimeline = false;
      argv.showCost = false;
      argv.streaming = false;
    }

    // Declare resources in outer scope for cleanup
    // v5.6.24: Use LazyMemoryManager for deferred initialization
    let memoryManager: LazyMemoryManager | undefined;
    let router: Router | undefined;
    let contextManager: ContextManager | undefined;
    let context: any;
    let resolvedAgentName: string = argv.agent as string; // Default to input, will be resolved later
    const executionStartTime = Date.now();

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

      // v8.5.8 Phase 3: Enhanced verbose output
      if (verbosity.isVerbose()) {
        console.log(chalk.gray(`Project: ${projectDir}`));
        console.log(chalk.gray(`Working directory: ${process.cwd()}`));
        console.log(chalk.gray(`Verbosity level: ${verbosity.getLevelName()}`));
        console.log(chalk.gray(`Memory enabled: ${memoryEnabled}`));
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

        // v8.5.8 Phase 3: Show resolution in verbose mode
        if (verbosity.isVerbose()) {
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

      // v11.0.0: Add GLM provider support via ax-cli
      if (config.providers['glm']?.enabled) {
        try {
          const { GlmProvider } = await import('../../providers/glm-provider.js');
          const glmConfig = config.providers['glm'] as any; // Cast to access new fields

          // Validate glmConfig exists
          if (glmConfig) {
            providers.push(new GlmProvider({
              name: 'glm',
              enabled: true,
              priority: glmConfig.priority ?? 4, // Default priority
              timeout: glmConfig.timeout ?? 120000, // Default 2 minutes
              command: glmConfig.command || 'ax-cli', // v11.0.0: ax-cli only
              // Phase 2: Enhanced CLI detection parameters
              customPath: glmConfig.customPath,
              versionArg: glmConfig.versionArg,
              minVersion: glmConfig.minVersion,
              // v11.0.0: Simplified ax-cli configuration
              axCli: glmConfig.axCli
            }));
          } else {
            logger.warn('GLM provider enabled but configuration is missing');
          }
        } catch (error) {
          logger.error('Failed to initialize GLM provider', { error });
          // Continue with other providers
        }
      }

      if (config.providers['openai']?.enabled) {
        const openaiConfig = config.providers['openai'];
        const providerConfig = {
          name: 'openai',
          enabled: true,
          priority: openaiConfig.priority,
          timeout: openaiConfig.timeout,
          command: openaiConfig.command,
          // Phase 2: Enhanced CLI detection parameters
          customPath: openaiConfig.customPath,
          versionArg: openaiConfig.versionArg,
          minVersion: openaiConfig.minVersion,
          // v5.13.0 Phase 1: SDK integration support
          integration: openaiConfig.integration,
          sdk: openaiConfig.sdk,
          connectionPool: openaiConfig.connectionPool,
          fallbackToCLI: openaiConfig.fallbackToCLI
        };

        // Check for CLI-only mode enforcement (environment variable)
        // Users with no API access can set AX_CLI_ONLY=true to force CLI mode
        const cliOnlyMode = process.env.AX_CLI_ONLY === 'true';

        // Check integration mode (v5.13.0 Phase 1)
        let integrationMode = openaiConfig.integration || 'cli';

        // Override to CLI mode if CLI-only enforcement is active
        if (cliOnlyMode && integrationMode === 'sdk') {
          logger.info('⚠️  CLI-only mode enforced (AX_CLI_ONLY=true)', {
            provider: 'openai',
            configuredMode: 'sdk',
            enforcedMode: 'cli'
          });
          integrationMode = 'cli';
        }

        // v6.0.7: Use factory to create appropriate provider based on integration mode
        const provider = createOpenAIProviderSync(providerConfig, integrationMode);

        // Log which mode is being used
        if (integrationMode === 'sdk') {
          logger.info('📦 Using OpenAI SDK integration (native, no subprocess)', {
            provider: 'openai',
            defaultModel: openaiConfig.sdk?.defaultModel || 'gpt-4o'
          });
        } else {
          logger.info('🖥️  Using OpenAI CLI integration (subprocess)', {
            provider: 'openai',
            cliOnlyMode: cliOnlyMode ? 'enforced' : 'default',
            autoResolved: integrationMode === 'auto' || !integrationMode
          });
        }

        providers.push(provider);
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
            sessionId: argv.session,
            // v6.0.7 Phase 3: Pass sandbox mode to execution
            sandbox: argv.sandbox
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

        // Display result (v8.5.8 Phase 3: suppress in quiet mode)
        if (!verbosity.isQuiet()) {
          console.log(chalk.green('\n✅ Execution completed successfully'));
          if (result.checkpointPath) {
            console.log(chalk.gray(`Checkpoint saved: ${result.runId}`));
            console.log(chalk.gray(`Resume with: ax resume ${result.runId}`));
          }
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

        // Phase 1 (v8.6.0): Create iterate mode controller if --iterate or --auto-continue flag is set
        let iterateHooks: ExecutionHooks | undefined;
        if (argv.iterate || argv.autoContinue) {
          // v8.6.0: Show deprecation warning if cost-based flag is used
          if (argv.iterateMaxCost !== undefined) {
            console.log(chalk.yellow('\n⚠️  Warning: --iterate-max-cost is deprecated and will be removed in v9.0.0'));
            console.log(chalk.yellow('    Reason: Provider pricing changes frequently, making cost estimates unreliable\n'));
            console.log(chalk.cyan('    Please use --iterate-max-tokens instead:'));
            console.log(chalk.cyan(`      ax run ${argv.agent} "${argv.task}" --iterate --iterate-max-tokens 1000000\n`));
            console.log(chalk.gray('    Learn more: https://docs.automatosx.com/migration/cost-to-tokens\n'));
          }

          // v8.6.0: Determine limits (prefer token-based over cost-based)
          const maxTokens = argv.iterateMaxTokens || 1_000_000; // 1M tokens default
          const maxTokensPerIteration = argv.iterateMaxTokensPerIteration || 100_000; // 100K per iteration
          const maxCost = argv.iterateMaxCost; // Optional for backward compat

          logger.info('Iterate mode enabled', {
            timeout: argv.iterateTimeout || 120,
            maxTokens,
            maxTokensPerIteration,
            maxCost: maxCost !== undefined ? maxCost : 'not set (using token limits)',
            strictness: argv.iterateStrictness || 'balanced',
            dryRun: argv.iterateDryRun || false
          });

          // Note: Cost tracker removed in v8.3.0
          // Cost tracking disabled in iterate mode - token limits used instead
          // const costTracker = new CostTracker({
          //   enabled: true,
          //   persistPath: join(projectDir, '.automatosx', 'costs', 'iterate-costs.db'),
          //   budgets: {
          //     daily: {
          //       limit: argv.iterateMaxCost || 5.0,
          //       warningThreshold: 0.75
          //     }
          //   },
          //   alertOnBudget: true
          // });
          // await costTracker.initialize();

          // Create status renderer for real-time UX (v8.6.0 Phase 1)
          const statusRenderer = new IterateStatusRenderer({
            quiet: !!argv.quiet,
            verbose: !!argv.verbose
          });

          // Create iterate mode controller with configuration
          // TODO (v8.6.1): Add iterate config to automatosx.config.json schema
          const iterateController = new IterateModeController(
            {
              enabled: true,
              defaults: {
                maxDurationMinutes: argv.iterateTimeout || 120,
                // v9.0.0: Token-based limits only
                maxTotalTokens: maxTokens,
                maxTokensPerIteration: maxTokensPerIteration,
                warnAtTokenPercent: [75, 90],
                maxIterationsPerRun: 200,
                maxIterationsPerStage: 50,
                maxAutoResponsesPerStage: 30,
                autoConfirmCheckpoints: true
              },
              classifier: {
                patternLibraryPath: join(projectDir, '.automatosx', 'iterate', 'patterns.yaml'),
                strictness: (argv.iterateStrictness || 'balanced') as 'paranoid' | 'balanced' | 'permissive',
                enableSemanticScoring: true,
                semanticScoringThreshold: 0.80,
                contextWindowMessages: 10
              },
              safety: {
                enableDangerousOperationGuard: true,
                riskTolerance: (argv.iterateStrictness || 'balanced') as 'paranoid' | 'balanced' | 'permissive',
                dangerousOperations: {
                  fileDelete: 'MEDIUM' as const,
                  gitForce: 'HIGH' as const,
                  writeOutsideWorkspace: 'HIGH' as const,
                  secretsInCode: 'HIGH' as const,
                  shellCommands: 'MEDIUM' as const,
                  packageInstall: 'MEDIUM' as const
                },
                enableTimeTracking: true,
                enableIterationTracking: true
              },
              telemetry: {
                level: 'info' as const,
                logAutoResponses: true,
                logClassifications: true,
                logSafetyChecks: true,
                emitMetrics: true
              },
              notifications: {
                warnAtTimePercent: [75, 90],
                pauseOnGenuineQuestion: true,
                pauseOnHighRiskOperation: true
              }
            },
            sessionManager,
            statusRenderer
          );

          // Create hook that delegates to controller
          iterateHooks = {
            onPostResponse: async (response) => {
              return await iterateController.handleResponse(response);
            }
          };

          logger.debug('Iterate mode controller created and wired');
        }

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
              showTimeline: Boolean(argv.showTimeline),
              hooks: iterateHooks, // Phase 1 (v8.6.0): Wire iterate mode
              iterateMode: Boolean(argv.iterate || argv.autoContinue)
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
            showTimeline: Boolean(argv.showTimeline),
            hooks: iterateHooks, // Phase 1 (v8.6.0): Wire iterate mode
            iterateMode: Boolean(argv.iterate || argv.autoContinue)
          });
        }

        // 9. Format and display result
        const formattedOutput = formatOutput(result, argv.format || 'text', argv.verbose || false);
        console.log(formattedOutput);

        // v6.0.7 Phase 3: Display cost information
        if (argv.showCost !== false && result.response?.tokensUsed) {
          const tokens = result.response.tokensUsed;
          const model = result.response.model || 'unknown';

          // Calculate cost based on model (pricing as of Oct 2024)
          // Prices are per 1M tokens in USD
          const pricing: Record<string, { input: number; output: number }> = {
            // OpenAI models
            'gpt-4o': { input: 2.50, output: 10.00 },
            'gpt-4o-mini': { input: 0.15, output: 0.60 },
            'gpt-4-turbo': { input: 10.00, output: 30.00 },
            'gpt-4': { input: 30.00, output: 60.00 },
            'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
            'o1-preview': { input: 15.00, output: 60.00 },
            'o1-mini': { input: 3.00, output: 12.00 },

            // Claude models (v6.1.0 Phase 3)
            'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
            'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
            'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
            'claude-default': { input: 3.00, output: 15.00 }, // Assumes Sonnet

            // Google Gemini models
            'gemini-2.0-flash-exp': { input: 0.125, output: 0.375 },
            'gemini-1.5-pro': { input: 1.25, output: 5.00 },
            'gemini-1.5-flash': { input: 0.075, output: 0.30 }
          };

          let cost = 0;
          let costDisplay = '';

          if (model && pricing[model]) {
            const inputCost = (tokens.prompt / 1_000_000) * pricing[model].input;
            const outputCost = (tokens.completion / 1_000_000) * pricing[model].output;
            cost = inputCost + outputCost;
            costDisplay = chalk.cyan(`$${cost.toFixed(4)}`);
          } else {
            costDisplay = chalk.gray('(pricing not available)');
          }

          const duration = result.response.latencyMs
            ? (result.response.latencyMs / 1000).toFixed(1) + 's'
            : 'unknown';

          console.log();
          console.log(chalk.bold('📊 Execution Summary'));
          console.log(chalk.dim('━'.repeat(50)));
          console.log(`  Model: ${chalk.cyan(model)}`);
          console.log(`  Tokens: ${chalk.cyan(tokens.total.toLocaleString())} ${chalk.dim(`(prompt: ${tokens.prompt}, completion: ${tokens.completion})`)}`);
          console.log(`  Cost: ${costDisplay}`);
          console.log(`  Duration: ${chalk.cyan(duration)}`);
          console.log(chalk.dim('━'.repeat(50)));
          console.log();
        }

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

      // v8.5.8 Phase 3: Show completion message only in normal/verbose mode
      if (!verbosity.isQuiet()) {
        const executionTime = ((Date.now() - executionStartTime) / 1000).toFixed(1);
        if (verbosity.isNormal()) {
          // Normal mode: Simple completion with timing
          console.log(chalk.green.bold(`✅ Complete`) + chalk.gray(` (${executionTime}s)\n`));
        } else if (verbosity.isVerbose()) {
          // Verbose mode: Detailed execution summary
          console.log(chalk.green.bold('\n✅ Execution Complete'));
          console.log(chalk.gray('─'.repeat(50)));
          console.log(chalk.gray(`Agent: ${resolvedAgentName}`));
          console.log(chalk.gray(`Provider: ${context?.provider?.name || 'unknown'}`));
          console.log(chalk.gray(`Execution time: ${executionTime}s`));
          if (memoryManager) {
            console.log(chalk.gray(`Memory: enabled`));
          }
          console.log(chalk.gray('─'.repeat(50)));
          console.log();
        }
      }

      // Graceful shutdown: cleanup all child processes before exit
      // Fixes: Background tasks hanging when run via Claude Code
      try {
        const { processManager } = await import('../../utils/process-manager.js');
        await processManager.shutdown(3000); // 3 second timeout
      } catch (shutdownError) {
        logger.error('Process manager shutdown failed', {
          error: shutdownError instanceof Error ? shutdownError.message : String(shutdownError)
        });
        // Continue with process exit anyway
      }

      // Close stdio streams to signal completion
      if (process.stdout.writable) {
        process.stdout.end();
      }
      if (process.stderr.writable) {
        process.stderr.end();
      }

      // Write agent completion status for background notification system (v8.5.0)
      await writeAgentStatus({
        agent: resolvedAgentName,
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        duration: Date.now() - executionStartTime,
        task: argv.task as string,
        provider: argv.provider
      });

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
        try {
          const { processManager } = await import('../../utils/process-manager.js');
          await processManager.shutdown(3000); // 3 second timeout
        } catch (shutdownError) {
          logger.error('Process manager shutdown failed', {
            error: shutdownError instanceof Error ? shutdownError.message : String(shutdownError)
          });
          // Continue with process exit anyway
        }

        // Close stdio streams
        if (process.stdout.writable) {
          process.stdout.end();
        }
        if (process.stderr.writable) {
          process.stderr.end();
        }

        // Write agent failure status for background notification system (v8.5.0)
        await writeAgentStatus({
          agent: resolvedAgentName,
          status: 'failed',
          timestamp: new Date().toISOString(),
          pid: process.pid,
          duration: Date.now() - executionStartTime,
          error: err.message,
          task: argv.task as string,
          provider: argv.provider
        });
      } catch (cleanupError) {
        const errMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        logger.debug('Cleanup error ignored', { error: errMsg });
      }

      process.exit(1);
    }
  }
};
