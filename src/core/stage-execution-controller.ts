/**
 * Stage Execution Controller (v5.3.0)
 *
 * Orchestrates stage-based execution with checkpoints, streaming, and user interaction.
 * Manages stage lifecycle, checkpoint persistence, and integration with AgentExecutor.
 */

import { randomUUID } from 'crypto';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import type { AgentExecutor, ExecutionOptions, ExecutionResult } from '../agents/executor.js';
import type { ContextManager } from '../agents/context-manager.js';
import type { ProfileLoader } from '../agents/profile-loader.js';
import type { AgentProfile, Stage } from '../types/agent.js';
import type { ExecutionContext } from '../types/agent.js';
import type {
  ExecutionMode,
  EnhancedStage,
  StageResult,
  StageContext,
  StageExecutionResult,
  StageExecutionOptions,
  StageExecutionConfig,
  StageHooks,
  CheckpointData,
  StageStates,
  StageStatus,
  CheckpointAction,
} from '../types/stage-execution.js';
import { CheckpointManager } from './session/checkpoint.js';
import { PromptManager, createCLIPromptManager } from './prompt-manager.js';
import { ProgressChannel } from './progress-channel.js';
import { ProgressRenderer } from '../cli/renderers/progress-renderer.js';
import { logger } from '../shared/logging/logger.js';
import { sleep } from '../shared/utils/safe-timers.js';
import type { IMemoryManager } from '../types/memory.js';

/**
 * Stage Execution Controller
 *
 * High-level orchestrator for stage-based execution.
 * Coordinates:
 * - Stage lifecycle management
 * - Checkpoint persistence
 * - User interaction
 * - Progress tracking
 * - Hook execution
 */
export class StageExecutionController {
  // Dependencies
  private readonly agentExecutor: AgentExecutor;
  private readonly checkpointManager: CheckpointManager;
  private readonly contextManager: ContextManager;
  private readonly profileLoader: ProfileLoader;
  private promptManager: PromptManager | null = null;
  private readonly memoryManager: IMemoryManager | null = null;

  // Configuration
  private readonly config: StageExecutionConfig;
  private readonly hooks: StageHooks;

  // State
  private currentRunId: string | null = null;
  private spinner: Ora | null = null;

  // Progress (v5.3.0)
  private progressChannel: ProgressChannel | null = null;
  private progressRenderer: ProgressRenderer | null = null;

  /**
   * Create StageExecutionController
   *
   * @param agentExecutor - Agent executor for provider execution
   * @param contextManager - Context manager for building execution contexts
   * @param profileLoader - Profile loader for loading agent profiles
   * @param config - Stage execution configuration
   * @param hooks - Optional lifecycle hooks
   * @param memoryManager - Optional memory manager for stage result persistence
   */
  constructor(
    agentExecutor: AgentExecutor,
    contextManager: ContextManager,
    profileLoader: ProfileLoader,
    config: StageExecutionConfig,
    hooks?: StageHooks,
    memoryManager?: IMemoryManager | null
  ) {
    this.agentExecutor = agentExecutor;
    this.contextManager = contextManager;
    this.profileLoader = profileLoader;
    this.config = config;
    this.hooks = hooks || {};
    this.memoryManager = memoryManager || null;

    this.checkpointManager = new CheckpointManager(
      config.checkpointPath,
      config.cleanupAfterDays
    );
  }

  /**
   * Execute agent with stage-based workflow
   *
   * @param agent - Agent profile to execute
   * @param task - Task description
   * @param mode - Execution mode
   * @param options - Execution options
   * @returns Stage execution result
   */
  async execute(
    agent: AgentProfile,
    task: string,
    mode: ExecutionMode,
    options: StageExecutionOptions = {}
  ): Promise<StageExecutionResult> {
    // Generate unique run ID
    const runId = randomUUID();
    this.currentRunId = runId;

    // Check if agent has stages configured
    if (!agent.stages || agent.stages.length === 0) {
      throw new Error(
        `Agent "${agent.name}" has no stages configured. Stage-based execution requires stages to be defined in agent profile.`
      );
    }

    // Enhance stages with index and defaults
    const enhancedStages = this.enhanceStages(agent.stages);

    // Validate stage graph
    this.validateStages(enhancedStages);

    // Initialize prompt manager for interactive mode
    if (mode.interactive) {
      this.promptManager = createCLIPromptManager({
        timeout: this.config.userDecisionTimeout,
        locale: 'en', // TODO(v5.8.0): Make configurable via config.locale (i18n support)
      });
    }

    // Initialize progress channel if streaming enabled (v5.3.0)
    if (mode.streaming) {
      this.progressChannel = new ProgressChannel({
        throttleMs: this.config.progressUpdateInterval || 100
      });

      // Setup progress renderer
      this.progressRenderer = new ProgressRenderer({
        quiet: options.quiet
      });

      this.progressChannel.subscribe((event) => {
        this.progressRenderer?.handleEvent(event);
      });

      this.progressRenderer.start();
    }

    // Display execution plan
    if (options.showPlan !== false) {
      this.displayPlan(enhancedStages, agent, task);
    }

    // Ask user to confirm start (interactive mode)
    if (mode.interactive && this.promptManager) {
      // ✅ Check auto-confirm
      if (!mode.autoConfirm) {
        const confirmStart = await this.promptManager.confirmStageStart(
          enhancedStages[0]?.name || 'first stage'
        );
        if (!confirmStart) {
          throw new Error('Execution cancelled by user');
        }
      }
    }

    // Initialize stage states
    const stageStates: StageStates[] = enhancedStages.map((stage) => ({
      ...stage,
      status: 'queued' as StageStatus,
      retries: 0,
    }));

    // Build stage context
    const stageContext: StageContext = {
      runId,
      agent,
      task,
      currentStageIndex: 0,
      totalStages: enhancedStages.length,
      previousOutputs: [],
      accumulatedData: {},
      mode,
      memory: [],
      projectDir: process.cwd(),
      workingDir: process.cwd(),
      agentWorkspace: '', // Will be set by context manager
      provider: agent.provider as any, // Will be resolved by context manager
      abilities: '',
      options,
    };

    // Execute stages
    const results: StageResult[] = [];
    let failedStageIndex: number | undefined;
    const startTime = Date.now();

    try {
      for (let i = 0; i < stageStates.length; i++) {
        const stageState = stageStates[i];
        if (!stageState) continue;

        // Update context
        stageContext.currentStageIndex = i;

        // Execute stage
        try {
          stageState.status = 'running' as StageStatus;

          // Emit stage start event (v5.3.0)
          this.progressChannel?.emit({
            type: 'stage-start',
            timestamp: new Date(),
            stageIndex: i,
            stageName: stageState.name
          });

          const result = await this.executeStage(stageState, stageContext);
          results.push(result);
          stageState.result = result;

          // Emit stage complete event (v5.3.0)
          if (result.status === 'completed') {
            this.progressChannel?.emit({
              type: 'stage-complete',
              timestamp: new Date(),
              stageIndex: i,
              stageName: stageState.name
            });
          } else if (result.status === 'error') {
            this.progressChannel?.emit({
              type: 'stage-error',
              timestamp: new Date(),
              stageIndex: i,
              stageName: stageState.name,
              message: result.error?.message
            });
          }

          // Update stage status based on result
          if (result.status === 'error') {
            stageState.status = 'error' as StageStatus;
            failedStageIndex = i;

            // Handle error - ask user for action (interactive mode)
            if (mode.interactive && this.promptManager) {
              const action = await this.promptManager.promptRetryAction(
                stageState.name,
                result.error?.message || 'Unknown error'
              );

              if (action.action === 'retry') {
                // ✅ Remove failed result before retry
                results.pop();
                stageState.result = undefined;
                // Retry stage
                stageState.retries++;
                i--; // Retry this stage
                continue;
              } else if (action.action === 'skip') {
                // ✅ Remove failed result before adding skipped result
                results.pop();
                // Skip stage - add skipped result
                const skippedResult: StageResult = {
                  stageName: stageState.name,
                  stageIndex: i,
                  status: 'skipped' as StageStatus,
                  output: '',
                  artifacts: [],
                  duration: 0,
                  tokensUsed: 0,
                  timestamp: new Date().toISOString(),
                  retries: stageState.retries,
                };
                results.push(skippedResult);
                stageState.result = skippedResult;
                stageState.status = 'skipped' as StageStatus;
                continue;
              } else {
                // Abort
                break;
              }
            } else {
              // Non-interactive: fail immediately
              break;
            }
          } else if (result.status === 'skipped') {
            stageState.status = 'skipped' as StageStatus;
          } else {
            stageState.status = 'completed' as StageStatus;
          }

          // Save checkpoint (if configured)
          if (mode.resumable && this.config.autoSaveCheckpoint) {
            await this.saveCheckpoint(stageContext, stageStates, i);
          }

          // Handle checkpoint (interactive mode)
          if (
            stageState.checkpoint &&
            mode.interactive &&
            this.promptManager &&
            i < stageStates.length - 1
          ) {
            const nextStage = stageStates[i + 1];
            const action = await this.handleCheckpoint(
              stageState,
              nextStage,
              result,
              stageContext
            );

            if (action.action === 'abort') {
              break;
            } else if (action.action === 'skip') {
              if (nextStage) {
                nextStage.status = 'skipped' as StageStatus;
              }
              i++; // Skip next stage
            } else if (action.action === 'modify' && nextStage) {
              // Modify next stage
              nextStage.description += `\n\nUser modifications:\n${action.modifications}`;
            }
          }

          // Update accumulated context
          stageContext.previousOutputs.push(result.output);
        } catch (error) {
          // Stage execution error
          logger.error(`Stage ${stageState.name} failed:`, { error });

          const errorResult: StageResult = {
            stageName: stageState.name,
            stageIndex: i,
            status: 'error' as StageStatus,
            output: '',
            artifacts: [],
            duration: 0,
            tokensUsed: 0,
            timestamp: new Date().toISOString(),
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            retries: stageState.retries,
          };

          results.push(errorResult);
          stageState.result = errorResult;
          stageState.status = 'error' as StageStatus;
          failedStageIndex = i;

          // Handle error
          if (mode.interactive && this.promptManager) {
            const action = await this.promptManager.promptRetryAction(
              stageState.name,
              error instanceof Error ? error.message : String(error)
            );

            if (action.action === 'retry') {
              // ✅ Remove failed result before retry
              results.pop();
              stageState.result = undefined;
              stageState.retries++;
              i--;
              continue;
            } else if (action.action === 'skip') {
              // ✅ Remove failed result before adding skipped result
              results.pop();
              // Add skipped result
              const skippedResult: StageResult = {
                stageName: stageState.name,
                stageIndex: i,
                status: 'skipped' as StageStatus,
                output: '',
                artifacts: [],
                duration: 0,
                tokensUsed: 0,
                timestamp: new Date().toISOString(),
                retries: stageState.retries,
              };
              results.push(skippedResult);
              stageState.result = skippedResult;
              stageState.status = 'skipped' as StageStatus;
              continue;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }
    } finally {
      // Cleanup
      if (this.promptManager) {
        this.promptManager.close();
        this.promptManager = null;
      }
      if (this.spinner) {
        this.spinner.stop();
        this.spinner = null;
      }

      // Cleanup progress channel (v5.3.0)
      if (this.progressRenderer) {
        this.progressRenderer.stop();
        this.progressRenderer = null;
      }
      if (this.progressChannel) {
        this.progressChannel.clear();
        this.progressChannel = null;
      }
    }

    // Calculate totals
    const totalDuration = Date.now() - startTime;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const success =
      results.length > 0 &&
      results.every((r) => r.status === 'completed' || r.status === 'skipped');

    // Display summary
    if (!options.quiet) {
      this.displaySummary(results, totalDuration, success);
    }

    // Save final checkpoint
    let checkpointPath: string | undefined;
    if (mode.resumable && this.config.autoSaveCheckpoint) {
      // Calculate the actual last completed stage index
      // Find the last stage that was successfully completed (not skipped, not error)
      let lastCompletedIndex = -1; // -1 means no stages completed yet
      for (let i = stageStates.length - 1; i >= 0; i--) {
        const stage = stageStates[i];
        if (stage && stage.status === 'completed') {
          lastCompletedIndex = i;
          break;
        }
      }

      checkpointPath = await this.saveCheckpoint(
        stageContext,
        stageStates,
        lastCompletedIndex
      );
    }

    return {
      runId,
      agent: agent.name,
      task,
      success,
      stages: results,
      totalDuration,
      totalTokens,
      failedStageIndex,
      checkpointPath,
    };
  }

  /**
   * Resume execution from checkpoint
   *
   * @param runId - Run identifier
   * @param mode - Execution mode (optional override)
   * @param options - Execution options
   * @returns Stage execution result
   */
  async resume(
    runId: string,
    mode?: ExecutionMode,
    options: StageExecutionOptions = {}
  ): Promise<StageExecutionResult> {
    // Load checkpoint
    const checkpoint = await this.checkpointManager.loadCheckpoint(runId);

    // Load agent profile
    const agent = await this.profileLoader.loadProfile(checkpoint.agent);

    // Use checkpoint mode or override
    const executionMode = mode || checkpoint.mode;

    // Display resume info
    console.log(chalk.blue(`\n📂 Resuming run: ${runId}`));
    console.log(chalk.gray(`Agent: ${checkpoint.agent}`));
    console.log(chalk.gray(`Task: ${checkpoint.task}`));
    console.log(
      chalk.gray(
        `Progress: ${checkpoint.lastCompletedStageIndex + 1}/${checkpoint.stages.length} stages completed`
      )
    );

    // Confirm resume (interactive mode)
    if (executionMode.interactive) {
      // ✅ Check auto-confirm
      if (!executionMode.autoConfirm) {
        const promptManager = createCLIPromptManager({
          timeout: this.config.userDecisionTimeout,
          locale: 'en',
        });

        const nextStage = checkpoint.stages[checkpoint.lastCompletedStageIndex + 1];
        const confirmResume = await promptManager.confirmResume(
          runId,
          nextStage?.name || 'unknown'
        );
        promptManager.close();

        if (!confirmResume) {
          throw new Error('Resume cancelled by user');
        }
      }
    }

    // ✅ Use original runId (not generate new one)
    this.currentRunId = runId;

    // ✅ Restore stage states from checkpoint
    const stageStates: StageStates[] = checkpoint.stages;

    // ✅ Calculate starting index (next incomplete stage)
    const startIndex = checkpoint.lastCompletedStageIndex + 1;

    // Initialize prompt manager for interactive mode
    if (executionMode.interactive) {
      this.promptManager = createCLIPromptManager({
        timeout: this.config.userDecisionTimeout,
        locale: 'en',
      });
    }

    // Initialize progress channel if streaming enabled (v5.3.0)
    if (executionMode.streaming) {
      this.progressChannel = new ProgressChannel({
        throttleMs: this.config.progressUpdateInterval || 100
      });

      // Setup progress renderer
      this.progressRenderer = new ProgressRenderer({
        quiet: options.quiet
      });

      this.progressChannel.subscribe((event) => {
        this.progressRenderer?.handleEvent(event);
      });

      this.progressRenderer.start();
    }

    // ✅ Reconstruct stage context with checkpoint data
    const stageContext: StageContext = {
      runId, // Use original runId
      agent,
      task: checkpoint.task,
      currentStageIndex: startIndex,
      totalStages: checkpoint.stages.length,
      previousOutputs: checkpoint.previousOutputs, // ✅ Restore previous outputs
      accumulatedData: checkpoint.sharedData, // ✅ Restore shared data
      mode: executionMode,
      memory: [],
      projectDir: process.cwd(),
      workingDir: process.cwd(),
      agentWorkspace: '',
      provider: agent.provider as any,
      abilities: '',
      options,
    };

    // ✅ Extract only completed/skipped results from checkpoint
    // We exclude error results because we'll retry those stages
    const results: StageResult[] = stageStates
      .filter((s) => s.result !== undefined && (s.status === 'completed' || s.status === 'skipped'))
      .map((s) => s.result!);

    let failedStageIndex: number | undefined;
    const resumeStartTime = Date.now();

    try {
      // ✅ Resume from startIndex (not from beginning)
      for (let i = startIndex; i < stageStates.length; i++) {
        const stageState = stageStates[i];
        if (!stageState) continue;

        // Update context
        stageContext.currentStageIndex = i;

        // Execute stage
        try {
          stageState.status = 'running' as StageStatus;

          // Emit stage start event (v5.3.0)
          this.progressChannel?.emit({
            type: 'stage-start',
            timestamp: new Date(),
            stageIndex: i,
            stageName: stageState.name
          });

          const result = await this.executeStage(stageState, stageContext);
          results.push(result);
          stageState.result = result;

          // Emit stage complete event (v5.3.0)
          if (result.status === 'completed') {
            this.progressChannel?.emit({
              type: 'stage-complete',
              timestamp: new Date(),
              stageIndex: i,
              stageName: stageState.name
            });
          } else if (result.status === 'error') {
            this.progressChannel?.emit({
              type: 'stage-error',
              timestamp: new Date(),
              stageIndex: i,
              stageName: stageState.name,
              message: result.error?.message
            });
          }

          // Update stage status based on result
          if (result.status === 'error') {
            stageState.status = 'error' as StageStatus;
            failedStageIndex = i;

            // Handle error - ask user for action (interactive mode)
            if (executionMode.interactive && this.promptManager) {
              const action = await this.promptManager.promptRetryAction(
                stageState.name,
                result.error?.message || 'Unknown error'
              );

              if (action.action === 'retry') {
                // ✅ Remove failed result before retry
                results.pop();
                stageState.result = undefined;
                // Retry stage
                stageState.retries++;
                i--; // Retry this stage
                continue;
              } else if (action.action === 'skip') {
                // ✅ Remove failed result before adding skipped result
                results.pop();
                // Skip stage - add skipped result
                const skippedResult: StageResult = {
                  stageName: stageState.name,
                  stageIndex: i,
                  status: 'skipped' as StageStatus,
                  output: '',
                  artifacts: [],
                  duration: 0,
                  tokensUsed: 0,
                  timestamp: new Date().toISOString(),
                  retries: stageState.retries,
                };
                results.push(skippedResult);
                stageState.result = skippedResult;
                stageState.status = 'skipped' as StageStatus;
                continue;
              } else {
                // Abort
                break;
              }
            } else {
              // Non-interactive: fail immediately
              break;
            }
          } else if (result.status === 'skipped') {
            stageState.status = 'skipped' as StageStatus;
          } else {
            stageState.status = 'completed' as StageStatus;
          }

          // Save checkpoint (if configured)
          if (executionMode.resumable && this.config.autoSaveCheckpoint) {
            await this.saveCheckpoint(stageContext, stageStates, i);
          }

          // Handle checkpoint (interactive mode)
          if (
            stageState.checkpoint &&
            executionMode.interactive &&
            this.promptManager &&
            i < stageStates.length - 1
          ) {
            const nextStage = stageStates[i + 1];
            const action = await this.handleCheckpoint(
              stageState,
              nextStage,
              result,
              stageContext
            );

            if (action.action === 'abort') {
              break;
            } else if (action.action === 'skip') {
              if (nextStage) {
                nextStage.status = 'skipped' as StageStatus;
              }
              i++; // Skip next stage
            } else if (action.action === 'modify' && nextStage) {
              // Modify next stage
              nextStage.description += `\n\nUser modifications:\n${action.modifications}`;
            }
          }

          // Update accumulated context
          stageContext.previousOutputs.push(result.output);
        } catch (error) {
          // Stage execution error
          logger.error(`Stage ${stageState.name} failed:`, { error });

          const errorResult: StageResult = {
            stageName: stageState.name,
            stageIndex: i,
            status: 'error' as StageStatus,
            output: '',
            artifacts: [],
            duration: 0,
            tokensUsed: 0,
            timestamp: new Date().toISOString(),
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            retries: stageState.retries,
          };

          results.push(errorResult);
          stageState.result = errorResult;
          stageState.status = 'error' as StageStatus;
          failedStageIndex = i;

          // Handle error
          if (executionMode.interactive && this.promptManager) {
            const action = await this.promptManager.promptRetryAction(
              stageState.name,
              error instanceof Error ? error.message : String(error)
            );

            if (action.action === 'retry') {
              // ✅ Remove failed result before retry
              results.pop();
              stageState.result = undefined;
              stageState.retries++;
              i--;
              continue;
            } else if (action.action === 'skip') {
              // ✅ Remove failed result before adding skipped result
              results.pop();
              // Add skipped result
              const skippedResult: StageResult = {
                stageName: stageState.name,
                stageIndex: i,
                status: 'skipped' as StageStatus,
                output: '',
                artifacts: [],
                duration: 0,
                tokensUsed: 0,
                timestamp: new Date().toISOString(),
                retries: stageState.retries,
              };
              results.push(skippedResult);
              stageState.result = skippedResult;
              stageState.status = 'skipped' as StageStatus;
              continue;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }
    } finally {
      // Cleanup
      if (this.promptManager) {
        this.promptManager.close();
        this.promptManager = null;
      }
      if (this.spinner) {
        this.spinner.stop();
        this.spinner = null;
      }
      // Cleanup streaming resources (v5.3.0)
      if (this.progressRenderer) {
        this.progressRenderer.stop();
        this.progressRenderer = null;
      }
      if (this.progressChannel) {
        this.progressChannel.clear();
        this.progressChannel = null;
      }
    }

    // Calculate totals
    const totalDuration = Date.now() - resumeStartTime;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const success =
      results.length > 0 &&
      results.every((r) => r.status === 'completed' || r.status === 'skipped');

    // Display summary
    if (!options.quiet) {
      this.displaySummary(results, totalDuration, success);
    }

    // Save final checkpoint
    let checkpointPath: string | undefined;
    if (executionMode.resumable && this.config.autoSaveCheckpoint) {
      // Calculate the actual last completed stage index
      // Find the last stage that was successfully completed (not skipped, not error)
      let lastCompletedIndex = -1; // -1 means no stages completed yet
      for (let i = stageStates.length - 1; i >= 0; i--) {
        const stage = stageStates[i];
        if (stage && stage.status === 'completed') {
          lastCompletedIndex = i;
          break;
        }
      }

      checkpointPath = await this.saveCheckpoint(
        stageContext,
        stageStates,
        lastCompletedIndex
      );
    }

    return {
      runId, // ✅ Return original runId
      agent: agent.name,
      task: checkpoint.task,
      success,
      stages: results,
      totalDuration,
      totalTokens,
      failedStageIndex,
      checkpointPath,
    };
  }

  /**
   * Execute a single stage
   *
   * @param stage - Stage to execute
   * @param context - Stage context
   * @returns Stage result
   */
  private async executeStage(
    stage: EnhancedStage,
    context: StageContext
  ): Promise<StageResult> {
    const startTime = Date.now();

    // Call beforeStage hook
    if (this.hooks.beforeStage) {
      const shouldContinue = await this.hooks.beforeStage(stage, context);
      if (shouldContinue === false) {
        return {
          stageName: stage.name,
          stageIndex: stage.index,
          status: 'skipped' as StageStatus,
          output: '',
          artifacts: [],
          duration: 0,
          tokensUsed: 0,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Display stage start
    this.displayStageStart(stage, context.currentStageIndex + 1, context.totalStages);

    // Build execution context for this stage
    const executionContext = await this.buildStageExecutionContext(stage, context);

    // ✅ Sync StageContext with real data from ExecutionContext
    context.provider = executionContext.provider;
    context.memory = executionContext.memory;
    context.projectDir = executionContext.projectDir;
    context.workingDir = executionContext.workingDir;
    context.agentWorkspace = executionContext.agentWorkspace;
    context.abilities = executionContext.abilities;

    // ✅ Get stage-specific configuration
    const stageConfig = this.getStageConfig(stage);

    // ✅ Implement retry logic with exponential backoff
    let executionResult: ExecutionResult | null = null;
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= stageConfig.maxRetries; attempt++) {
      try {
        // Apply exponential backoff delay for retries
        if (attempt > 0) {
          const delay = stageConfig.retryDelay * Math.pow(2, attempt - 1);

          if (!context.mode.interactive) {
            // ✅ Non-interactive: Automatic retry with backoff
            console.log(
              chalk.yellow(
                `\n⚠️  Retrying stage "${stage.name}" (attempt ${attempt + 1}/${stageConfig.maxRetries + 1})...`
              )
            );
            console.log(chalk.gray(`   Waiting ${delay}ms before retry...`));
            await sleep(delay);
          } else {
            // Interactive: Ask user (this is handled elsewhere in the flow)
            // Just apply delay if user chose retry
            await sleep(delay);
          }
        }

        const executionOptions: ExecutionOptions = {
          verbose: context.options.verbose,
          showProgress: !context.mode.streaming, // Disable ora spinner if streaming
          timeout: stageConfig.timeout, // ✅ Use stage-specific timeout
          signal: context.signal,
          // ✅ Pass streaming options if enabled
          streaming: context.mode.streaming ? {
            enabled: true,
            onToken: (token) => {
              // Forward tokens to progress channel
              this.progressChannel?.emit({
                type: 'token-stream',
                timestamp: new Date(),
                stageIndex: stage.index,
                stageName: stage.name,
                token
              });
            },
            onProgress: (progress) => {
              // Forward progress to progress channel
              this.progressChannel?.emit({
                type: 'stage-progress',
                timestamp: new Date(),
                stageIndex: stage.index,
                stageName: stage.name,
                progress
              });
            }
          } : undefined,
        };

        executionResult = await this.agentExecutor.execute(
          executionContext,
          executionOptions
        );

        // ✅ Success: Exit retry loop
        retryCount = attempt;
        break;
      } catch (error) {
        lastError = error as Error;
        retryCount = attempt;

        // If this was the last attempt, throw the error
        if (attempt >= stageConfig.maxRetries) {
          const duration = Date.now() - startTime;

          const result: StageResult = {
            stageName: stage.name,
            stageIndex: stage.index,
            status: 'error' as StageStatus,
            output: '',
            artifacts: [],
            duration,
            tokensUsed: 0,
            timestamp: new Date().toISOString(),
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            retries: retryCount,
          };

          // Call onError hook
          if (this.hooks.onError) {
            await this.hooks.onError(stage, error as Error, context);
          }

          return result;
        }

        // Still have retries left, continue loop
      }
    }

    // Should never reach here, but just in case
    if (!executionResult) {
      const duration = Date.now() - startTime;
      return {
        stageName: stage.name,
        stageIndex: stage.index,
        status: 'error' as StageStatus,
        output: '',
        artifacts: [],
        duration,
        tokensUsed: 0,
        timestamp: new Date().toISOString(),
        error: {
          message: lastError?.message || 'Unknown error',
          stack: lastError?.stack,
        },
        retries: retryCount,
      };
    }

    const duration = Date.now() - startTime;

    // Build stage result
    const result: StageResult = {
      stageName: stage.name,
      stageIndex: stage.index,
      status: 'completed' as StageStatus,
      output: executionResult.response.content,
      artifacts: [], // TODO(v5.7.0): Collect artifacts from workspace (files created, modified during execution)
      duration,
      tokensUsed: executionResult.response.tokensUsed?.total || 0,
      timestamp: new Date().toISOString(),
      retries: retryCount, // ✅ Include retry count
    };

    // Display stage completion
    this.displayStageComplete(stage, result);

    // Call afterStage hook
    if (this.hooks.afterStage) {
      await this.hooks.afterStage(stage, result, context);
    }

    // Save to memory if configured (v5.3.0)
    await this.saveStageToMemory(context.agent.name, stage, result);

    return result;
  }

  /**
   * Handle checkpoint after stage completion
   *
   * @param stage - Completed stage
   * @param nextStage - Next stage (if any)
   * @param result - Stage result
   * @param context - Stage context
   * @returns Checkpoint action from user
   */
  private async handleCheckpoint(
    stage: EnhancedStage,
    nextStage: EnhancedStage | undefined,
    result: StageResult,
    context: StageContext
  ): Promise<CheckpointAction> {
    if (!this.promptManager) {
      return { action: 'continue' };
    }

    // ✅ Check auto-confirm
    if (context.mode.autoConfirm) {
      return { action: 'continue' };
    }

    // Display checkpoint
    console.log(chalk.green(`\n✓ Stage "${stage.name}" completed\n`));

    // Ask user for action
    const action = await this.promptManager.promptCheckpointAction(
      stage.name,
      nextStage?.name
    );

    // Call onContinue hook
    if (action.action === 'continue' && nextStage && this.hooks.onContinue) {
      await this.hooks.onContinue(nextStage, context);
    }

    // Call onSkip hook
    if (action.action === 'skip' && this.hooks.onSkip && nextStage) {
      await this.hooks.onSkip(nextStage, context);
    }

    return action;
  }

  /**
   * Save checkpoint to disk
   *
   * @param context - Stage context
   * @param stageStates - Current stage states
   * @param lastCompletedIndex - Index of last completed stage
   * @returns Path to saved checkpoint
   */
  private async saveCheckpoint(
    context: StageContext,
    stageStates: StageStates[],
    lastCompletedIndex: number
  ): Promise<string> {
    const checkpoint: CheckpointData = {
      schemaVersion: '1.0.0',
      checksum: '', // Will be calculated by CheckpointManager
      runId: context.runId,
      agent: context.agent.name,
      task: context.task,
      mode: context.mode,
      stages: stageStates,
      lastCompletedStageIndex: lastCompletedIndex,
      previousOutputs: context.previousOutputs,
      sharedData: context.accumulatedData as Record<string, unknown>,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const checkpointPath = await this.checkpointManager.saveCheckpoint(checkpoint);

    // Call onCheckpoint hook
    if (this.hooks.onCheckpoint) {
      await this.hooks.onCheckpoint(checkpoint, context);
    }

    if (!context.options.quiet) {
      console.log(chalk.gray(`💾 Checkpoint saved: ${context.runId}`));
    }

    return checkpointPath;
  }

  /**
   * Build execution context for a stage
   *
   * @param stage - Stage to execute
   * @param context - Stage context
   * @returns Execution context
   */
  private async buildStageExecutionContext(
    stage: EnhancedStage,
    context: StageContext
  ): Promise<ExecutionContext> {
    // Build stage-specific task prompt
    const stageTask = this.buildStageTask(stage, context);

    // Build context using ContextManager
    // Note: ContextManager will handle provider selection, ability loading, etc.
    const executionContext = await this.contextManager.createContext(
      context.agent.name,
      stageTask,
      {
        sessionId: context.session?.id,
        sharedData: context.accumulatedData,
      }
    );

    return executionContext;
  }

  /**
   * Get stage-specific configuration
   *
   * @param stage - Stage to get config for
   * @returns Stage configuration with fallbacks
   */
  private getStageConfig(stage: EnhancedStage): {
    checkpoint: boolean;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  } {
    return {
      checkpoint: stage.checkpoint ?? true,
      timeout: stage.timeout ?? this.config.defaultStageTimeout,
      maxRetries: stage.maxRetries ?? this.config.defaultMaxRetries,
      retryDelay: stage.retryDelay ?? this.config.defaultRetryDelay,
    };
  }

  /**
   * Build stage-specific task prompt
   *
   * @param stage - Stage to execute
   * @param context - Stage context
   * @returns Stage task prompt
   * v11.2.8: Refactored to use array.join() for better string building performance
   */
  private buildStageTask(stage: EnhancedStage, context: StageContext): string {
    const parts: string[] = [
      `# Stage: ${stage.name}\n`,
      `## Stage Description\n${stage.description}\n`,
      `## Original Task\n${context.task}\n`
    ];

    if (context.previousOutputs.length > 0) {
      parts.push(`## Previous Stage Outputs\n`);
      parts.push(...context.previousOutputs.map((output, index) =>
        `### Stage ${index + 1} Output\n${output}\n`
      ));
    }

    if (stage.key_questions && stage.key_questions.length > 0) {
      parts.push(`## Key Questions to Address`);
      parts.push(...stage.key_questions.map(q => `- ${q}`));
      parts.push('');
    }

    if (stage.outputs && stage.outputs.length > 0) {
      parts.push(`## Expected Outputs`);
      parts.push(...stage.outputs.map(o => `- ${o}`));
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Enhance stages with index and defaults
   *
   * @param stages - Raw stages from agent profile
   * @returns Enhanced stages
   */
  private enhanceStages(stages: Stage[]): EnhancedStage[] {
    return stages.map((stage, index) => ({
      ...stage,
      index,
      // Respect stage-level settings, use execution mode flags as defaults only
      checkpoint: stage.checkpoint ?? true, // Default: checkpoint after each stage
      streaming: stage.streaming ?? false,
      // Preserve stage-defined timeout, fallback to config default
      timeout: stage.timeout ?? this.config.defaultStageTimeout,
      // Use stage-defined maxRetries, fallback to config default
      maxRetries: stage.maxRetries ?? this.config.defaultMaxRetries,
      // Preserve retryDelay if defined
      retryDelay: stage.retryDelay ?? this.config.defaultRetryDelay,
    }));
  }

  /**
   * Validate stage graph
   *
   * @param stages - Stages to validate
   * @throws Error if validation fails
   */
  private validateStages(stages: EnhancedStage[]): void {
    if (stages.length === 0) {
      throw new Error('No stages defined');
    }

    // Validate stage names are unique
    const names = new Set<string>();
    for (const stage of stages) {
      if (names.has(stage.name)) {
        throw new Error(`Duplicate stage name: ${stage.name}`);
      }
      names.add(stage.name);
    }

    // Dependencies and cycles are validated by DependencyGraphBuilder.detectCycles()
    // when parallel execution is enabled (see parallel-agent-executor.ts)
  }

  /**
   * Display execution plan
   *
   * @param stages - Stages to display
   * @param agent - Agent profile
   * @param task - Task description
   */
  private displayPlan(
    stages: EnhancedStage[],
    agent: AgentProfile,
    task: string
  ): void {
    console.log(chalk.blue(`\n📋 Execution Plan`));
    console.log(chalk.gray(`Agent: ${agent.displayName || agent.name}`));
    console.log(chalk.gray(`Task: ${task}`));
    console.log(chalk.gray(`Total Stages: ${stages.length}\n`));

    stages.forEach((stage, index) => {
      const number = chalk.cyan(`${index + 1}.`);
      const name = chalk.white(stage.name);
      const time = stage.estimatedTime
        ? chalk.gray(` (${stage.estimatedTime})`)
        : '';
      console.log(`${number} ${name}${time}`);
      console.log(chalk.gray(`   ${stage.description}`));
    });

    console.log();
  }

  /**
   * Display stage start
   *
   * @param stage - Stage starting
   * @param current - Current stage number (1-based)
   * @param total - Total stages
   */
  private displayStageStart(stage: EnhancedStage, current: number, total: number): void {
    const prefix = chalk.blue(`[${current}/${total}]`);
    const name = chalk.white(stage.name);
    console.log(`\n${prefix} ${name}`);

    // Only show spinner if not in streaming mode (progress renderer handles it)
    if (!this.progressRenderer) {
      this.spinner = ora({
        text: stage.description,
        color: 'cyan',
      }).start();
    }
  }

  /**
   * Display stage completion
   *
   * @param stage - Completed stage
   * @param result - Stage result
   */
  private displayStageComplete(stage: EnhancedStage, result: StageResult): void {
    if (this.spinner) {
      this.spinner.succeed(
        `${stage.name} completed (${(result.duration / 1000).toFixed(1)}s, ${result.tokensUsed} tokens)`
      );
      this.spinner = null;
    }
  }

  /**
   * Display execution summary
   *
   * @param results - All stage results
   * @param totalDuration - Total execution time
   * @param success - Overall success status
   */
  private displaySummary(
    results: StageResult[],
    totalDuration: number,
    success: boolean
  ): void {
    console.log(
      chalk.blue(
        `\n${'='.repeat(60)}\n${success ? '✅ ' : '❌ '}Execution Summary\n${'='.repeat(60)}`
      )
    );

    const completed = results.filter((r) => r.status === 'completed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'error').length;

    console.log(chalk.white(`Stages Completed: ${completed}/${results.length}`));
    if (skipped > 0) {
      console.log(chalk.yellow(`Stages Skipped: ${skipped}`));
    }
    if (failed > 0) {
      console.log(chalk.red(`Stages Failed: ${failed}`));
    }

    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    console.log(chalk.white(`Total Duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.white(`Total Tokens: ${totalTokens}`));

    console.log(chalk.blue(`${'='.repeat(60)}\n`));
  }

  /**
   * Save stage result to memory (v5.3.0)
   *
   * Persists stage outputs to memory when stage.saveToMemory is true.
   * Uses FTS5 full-text search (no embedding required).
   *
   * @param agentName - Agent name for metadata
   * @param stage - Stage configuration
   * @param result - Stage execution result
   */
  private async saveStageToMemory(
    agentName: string,
    stage: EnhancedStage,
    result: StageResult
  ): Promise<void> {
    // Skip if no memory manager configured
    if (!this.memoryManager) {
      return;
    }

    // Skip if stage doesn't opt into memory persistence
    if (!stage.saveToMemory) {
      return;
    }

    // Skip if stage failed or was skipped
    if (result.status !== 'completed') {
      return;
    }

    try {
      const memoryContent = `[${agentName}] Stage: ${stage.name}\n\n${result.output}`;

      // v5.3.0: Save directly without embedding (uses FTS5)
      await this.memoryManager.add(memoryContent, null, {
        type: 'task',
        source: agentName,
        agentId: agentName,
        stage: stage.name,
        stageIndex: result.stageIndex,
        timestamp: new Date().toISOString(),
        tokensUsed: result.tokensUsed,
        duration: result.duration
      });

      logger.info('Stage result saved to memory', {
        agent: agentName,
        stage: stage.name,
        stageIndex: result.stageIndex
      });
    } catch (error) {
      logger.error('Failed to save stage result to memory', {
        agent: agentName,
        stage: stage.name,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - memory persistence is optional and shouldn't fail the stage
    }
  }
}
