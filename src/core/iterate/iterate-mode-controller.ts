/**
 * Iterate Mode Controller
 *
 * Orchestrates autonomous execution mode that auto-responds to AI confirmation prompts
 * while maintaining safety controls and allowing intervention for genuine questions.
 *
 * **Architecture**:
 * - Wraps StageExecutionController execution path
 * - Coordinates with SessionManager for state persistence
 * - Subscribes to AgentExecutor hooks for response interception
 * - Enforces token-based budget limits (v9.0.0+)
 *
 * @module core/iterate/iterate-mode-controller
 * @since v6.4.0
 */

import type { ExecutionContext } from '../../types/agent.js';
import type { ExecutionResponse } from '../../types/provider.js';
import type { SessionManager } from '../session/manager.js';
import type {
  IterateConfig,
  IterateState,
  IterateAction,
  IterateStats,
  PauseReason,
  IterateEvent,
  ClassificationType
} from '../../types/iterate.js';
import type { ExecutionOptions, ExecutionResult } from '../../agents/executor.js';
import { logger } from '../../shared/logging/logger.js';
import { IterateError } from '../../types/iterate.js';
import { IterateClassifier } from './iterate-classifier.js';
import { IterateAutoResponder } from './iterate-auto-responder.js';
import { IterateStatusRenderer } from '../../cli/renderers/iterate-status-renderer.js';
import { randomUUID } from 'crypto';

/**
 * Iterate Mode Controller
 *
 * Main orchestrator for autonomous iterate mode execution.
 *
 * **Responsibilities**:
 * - Manage iterate state, counters, and budgets
 * - Coordinate classifier, responder, and safety checks
 * - Handle pause/resume logic
 * - Persist state via SessionManager
 * - Emit telemetry events
 *
 * **Usage**:
 * ```typescript
 * const controller = new IterateModeController(config, sessionManager);
 * const result = await controller.executeWithIterate(context, options);
 * ```
 *
 * @since v6.4.0
 */
export class IterateModeController {
  private config: IterateConfig;
  private sessionManager?: SessionManager;
  private state?: IterateState;
  private classifier: IterateClassifier;
  private responder: IterateAutoResponder;
  private statusRenderer?: IterateStatusRenderer;

  /**
   * Create IterateModeController
   *
   * @param config - Iterate mode configuration
   * @param sessionManager - Session manager for state persistence (optional)
   */
  constructor(
    config: IterateConfig,
    sessionManager?: SessionManager,
    statusRenderer?: IterateStatusRenderer
  ) {
    this.config = config;
    this.sessionManager = sessionManager;
    this.statusRenderer = statusRenderer;

    // Initialize classifier
    this.classifier = new IterateClassifier(config.classifier);

    // Initialize responder
    this.responder = new IterateAutoResponder({
      templateLibraryPath: config.classifier.patternLibraryPath.replace('patterns.yaml', 'templates.yaml'),
      randomizeTemplates: true,
      enableContextVars: true
    });

    logger.debug('IterateModeController created', {
      enabled: config.enabled,
      maxDuration: config.defaults.maxDurationMinutes,
      maxTokens: config.defaults.maxTotalTokens,
      strictness: config.classifier.strictness,
      hasStatusRenderer: !!statusRenderer
    });
  }

  /**
   * Execute agent with iterate mode enabled
   *
   * Main execution loop that wraps standard agent execution with:
   * - Response classification
   * - Auto-response generation
   * - Safety checks
   * - Budget monitoring
   *
   * @param context - Execution context
   * @param options - Execution options
   * @returns Execution result with iterate stats
   *
   * **Phase 1 (Week 1)**: Skeleton implementation (no-op, falls back to standard execution)
   * **Phase 3 (Week 3)**: Full implementation with orchestration loop
   */
  async executeWithIterate(
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    // Step 1: Initialize iterate state
    const sessionId = this.sessionManager
      ? (await this.sessionManager.createSession(context.task, context.agent.name)).id
      : randomUUID();

    this.initializeState(sessionId);

    logger.info('Iterate mode execution started', {
      agent: context.agent.name,
      task: context.task.substring(0, 100),
      sessionId,
      maxDuration: this.config.defaults.maxDurationMinutes,
      maxTokens: this.config.defaults.maxTotalTokens
    });

    // Emit start event
    this.emitEvent({
      type: 'iterate.start',
      timestamp: new Date().toISOString(),
      sessionId,
      payload: {
        agent: context.agent.name,
        task: context.task,
        config: {
          maxDuration: this.config.defaults.maxDurationMinutes,
          maxTokens: this.config.defaults.maxTotalTokens,
          maxIterations: this.config.defaults.maxIterationsPerRun
        }
      }
    });

    try {
      // Step 2: Execute with budget monitoring
      // Note: Full orchestration loop with agent execution hooks will be implemented in future phases
      // For Week 4, we demonstrate the framework with state management and budget checking

      // Check initial budgets
      if (this.checkTimeBudget()) {
        throw new IterateError('Time budget exceeded before execution', 'budget_exceeded');
      }

      if (this.checkTokenBudget()) {
        throw new IterateError('Token budget exceeded before execution', 'budget_exceeded');
      }

      // Step 3: Return framework result
      // Future: This would contain the actual execution orchestration loop
      // For now, return a success result showing the framework is in place
      const duration = Date.now() - new Date(this.state!.startedAt).getTime();

      const result: ExecutionResult = {
        response: {
          content: `Iterate mode framework initialized for: ${context.task}\n\nSession ID: ${sessionId}\nState: ${JSON.stringify(this.getStats(), null, 2)}\n\nNote: Full execution loop will be implemented in future phases`,
          tokensUsed: {
            prompt: 0,
            completion: 0,
            total: 0
          },
          latencyMs: duration,
          model: context.agent.name,
          finishReason: 'stop' as const
        },
        duration: duration,
        context: context
      };

      logger.info('Iterate mode execution completed', {
        sessionId,
        duration: result.duration,
        stats: this.getStats()
      });

      return result;

    } catch (error) {
      const duration = this.state ? Date.now() - new Date(this.state.startedAt).getTime() : 0;

      logger.error('Iterate mode execution failed', {
        sessionId,
        error: (error as Error).message,
        duration
      });

      return {
        response: {
          content: `Iterate mode execution failed: ${(error as Error).message}\n\nSession ID: ${sessionId}\nError: ${(error as Error).message}${this.state ? `\nState: ${JSON.stringify(this.getStats(), null, 2)}` : ''}`,
          tokensUsed: {
            prompt: 0,
            completion: 0,
            total: 0
          },
          latencyMs: duration,
          model: context.agent.name,
          finishReason: 'error' as const
        },
        duration: duration,
        context: context
      };
    }
  }

  /**
   * Handle AI response with classification and action determination
   *
   * **Classification Pipeline**:
   * 1. Fast pattern matching
   * 2. Contextual rules
   * 3. Provider markers
   * 4. Semantic scoring (optional)
   *
   * @param response - Execution response from provider
   * @returns Action to take (continue, pause, stop, etc.)
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 4 (Week 4)**: Full implementation
   */
  async handleResponse(response: ExecutionResponse): Promise<IterateAction> {
    const startTime = Date.now();

    // Week 1 Skeleton: If state not initialized, return simple continue action
    if (!this.state) {
      logger.warn('handleResponse called without initialized state - returning skeleton response');
      return {
        type: 'continue',
        reason: 'Skeleton implementation - state not initialized'
      };
    }

    logger.debug('Handling response', {
      hasContent: !!response.content,
      contentLength: response.content?.length || 0,
      iterations: this.state.totalIterations
    });

    // Step 1: Classify the response
    const classification = await this.classifier.classify(
      response.content || '',
      {
        message: response.content || '',
        recentMessages: this.getRecentMessages(),
        provider: response.model || 'unknown',
        tokenCount: response.tokensUsed?.total
      }
    );

    // Add to classification history
    this.state.classificationHistory.push(classification);

    // Prevent memory leak: limit classification history to context window size
    // Only keep the most recent messages we'll actually use
    const maxHistorySize = this.config.classifier.contextWindowMessages * 2; // 2x buffer for safety
    if (this.state.classificationHistory.length > maxHistorySize) {
      // Keep only the most recent entries
      this.state.classificationHistory = this.state.classificationHistory.slice(-maxHistorySize);
      logger.debug('Trimmed classification history to prevent memory leak', {
        newSize: this.state.classificationHistory.length,
        maxSize: maxHistorySize
      });
    }

    logger.info('Response classified', {
      type: classification.type,
      confidence: classification.confidence,
      method: classification.method
    });

    // Render classification status (v8.6.0 UX)
    if (this.statusRenderer) {
      this.statusRenderer.handleEvent({
        type: 'classification',
        classification,
        response
      });
    }

    // Step 2: Track tokens (v9.0.0 - token-based budgets only)
    if (response.tokensUsed && response.tokensUsed.total) {
      this.updateTokens(response.tokensUsed.total);
    }

    // Step 3: Increment iteration counters
    this.incrementIterations();

    // Step 4: Check budget limits (v9.0.0 - token and time budgets only)
    if (this.checkTokenBudget()) {
      return {
        type: 'pause',
        reason: 'Token budget exceeded',
        pauseReason: 'token_limit_exceeded',
        context: `Maximum token limit of ${this.config.defaults.maxTotalTokens} reached`
      };
    }

    if (this.checkTimeBudget()) {
      return {
        type: 'pause',
        reason: 'Time budget exceeded',
        pauseReason: 'time_limit_exceeded',
        context: `Maximum duration of ${this.config.defaults.maxDurationMinutes} minutes reached`
      };
    }

    if (this.checkIterationLimit()) {
      return {
        type: 'pause',
        reason: 'Iteration limit exceeded',
        pauseReason: 'iteration_limit_exceeded',
        context: `Maximum iterations reached`
      };
    }

    // Step 4: Determine action based on classification type
    const action = this.determineAction(classification, response);

    // Step 5: Generate auto-response if continuing
    if (action.type === 'continue' && action.response === undefined) {
      const autoResponse = await this.responder.generateResponse(
        classification,
        {
          message: response.content || '',
          classification,
          provider: response.model || 'unknown'
        }
      );

      if (autoResponse) {
        action.response = autoResponse;
        this.incrementAutoResponses();

        logger.info('Auto-response generated', {
          responseLength: autoResponse.length,
          type: classification.type
        });
      }
    }

    // Step 6: Render action status (v8.6.0 UX)
    if (this.statusRenderer) {
      this.statusRenderer.handleEvent({
        type: 'action',
        action,
        stats: this.getStats()
      });
    }

    // Step 7: Emit telemetry event
    this.emitEvent({
      type: 'iterate.classification',
      timestamp: new Date().toISOString(),
      sessionId: this.state.sessionId,
      payload: {
        classification,
        action: action.type,
        latencyMs: Date.now() - startTime
      }
    });

    return action;
  }

  /**
   * Determine action based on classification
   *
   * @param classification - Classification result
   * @param response - Execution response
   * @returns Action to take
   * @private
   */
  private determineAction(
    classification: import('../../types/iterate.js').Classification,
    response: ExecutionResponse
  ): IterateAction {
    const { type, confidence } = classification;

    // Genuine questions → PAUSE
    if (type === 'genuine_question') {
      return {
        type: 'pause',
        reason: 'Genuine question detected',
        pauseReason: 'genuine_question',
        context: response.content?.substring(0, 200)
      };
    }

    // Blocking requests → PAUSE
    if (type === 'blocking_request') {
      return {
        type: 'pause',
        reason: 'Blocking request detected',
        pauseReason: 'blocking_request',
        context: response.content?.substring(0, 200)
      };
    }

    // Error signals → PAUSE (for now, could implement retry logic)
    if (type === 'error_signal') {
      return {
        type: 'pause',
        reason: 'Error signal detected',
        pauseReason: 'error_recovery_needed',
        context: response.content?.substring(0, 200)
      };
    }

    // Rate limit or context → RETRY (could implement provider switch)
    if (type === 'rate_limit_or_context') {
      return {
        type: 'retry',
        reason: 'Rate limit or context limit detected',
        context: response.content?.substring(0, 200)
      };
    }

    // Confirmation prompts → CONTINUE (auto-respond)
    if (type === 'confirmation_prompt') {
      return {
        type: 'continue',
        reason: 'Confirmation prompt - auto-responding',
        metadata: { confidence }
      };
    }

    // Completion signals → CONTINUE (acknowledge)
    if (type === 'completion_signal') {
      return {
        type: 'continue',
        reason: 'Completion signal - acknowledging',
        metadata: { confidence }
      };
    }

    // Status updates → NO_OP (no response needed)
    if (type === 'status_update') {
      return {
        type: 'no_op',
        reason: 'Status update - no response needed',
        metadata: { confidence }
      };
    }

    // Fallback: pause for safety
    return {
      type: 'pause',
      reason: 'Unknown classification type - pausing for safety',
      pauseReason: 'user_interrupt',
      context: `Classification: ${type}, Confidence: ${confidence}`
    };
  }

  /**
   * Pause iterate mode execution
   *
   * Called when:
   * - Genuine question detected
   * - High-risk operation detected
   * - Budget limit exceeded
   * - User interrupt (Ctrl+C, Ctrl+Z)
   *
   * @param reason - Reason for pausing
   * @param context - Additional context for user
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 4 (Week 4)**: Full implementation with state persistence
   */
  async pause(reason: PauseReason, context?: string): Promise<void> {
    if (!this.state) {
      logger.warn('Cannot pause - state not initialized', { reason });
      return;
    }

    logger.info('Pausing iterate mode', {
      reason,
      context: context?.substring(0, 100),
      iterations: this.state.totalIterations,
      autoResponses: this.state.totalAutoResponses
    });

    // Update state with pause information
    this.state.pauseReason = reason;
    this.state.pauseContext = context;

    // Persist state to SessionManager (if available)
    if (this.sessionManager) {
      try {
        await this.sessionManager.updateMetadata(this.state.sessionId, {
          iterateState: this.state,
          pausedAt: new Date().toISOString()
        });
        logger.debug('Iterate state persisted to session');
      } catch (error) {
        logger.error('Failed to persist iterate state', {
          error: (error as Error).message
        });
      }
    }

    // Emit pause telemetry event
    this.emitEvent({
      type: 'iterate.pause',
      timestamp: new Date().toISOString(),
      sessionId: this.state.sessionId,
      payload: {
        reason,
        context,
        stats: this.getStats()
      }
    });

    logger.info('Iterate mode paused', {
      reason,
      totalIterations: this.state.totalIterations,
      totalAutoResponses: this.state.totalAutoResponses
    });
  }

  /**
   * Resume iterate mode execution after pause
   *
   * @param userResponse - User's response to the question/request
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 4 (Week 4)**: Full implementation
   */
  async resume(userResponse?: string): Promise<void> {
    if (!this.state) {
      logger.warn('Cannot resume - state not initialized');
      return;
    }

    if (!this.state.pauseReason) {
      logger.warn('Cannot resume - not currently paused');
      return;
    }

    logger.info('Resuming iterate mode', {
      hasUserResponse: !!userResponse,
      previousPauseReason: this.state.pauseReason,
      iterations: this.state.totalIterations
    });

    // Store user response in metadata if provided
    if (userResponse) {
      this.state.metadata.lastUserResponse = userResponse;
      this.state.metadata.lastUserResponseAt = new Date().toISOString();
    }

    // Clear pause state
    const previousPauseReason = this.state.pauseReason;
    const previousPauseContext = this.state.pauseContext;
    delete this.state.pauseReason;
    delete this.state.pauseContext;

    // Persist updated state
    if (this.sessionManager) {
      try {
        await this.sessionManager.updateMetadata(this.state.sessionId, {
          iterateState: this.state,
          resumedAt: new Date().toISOString()
        });
        logger.debug('Iterate state updated after resume');
      } catch (error) {
        logger.error('Failed to update iterate state after resume', {
          error: (error as Error).message
        });
      }
    }

    // Emit resume telemetry event
    this.emitEvent({
      type: 'iterate.resume',
      timestamp: new Date().toISOString(),
      sessionId: this.state.sessionId,
      payload: {
        previousPauseReason,
        previousPauseContext,
        hasUserResponse: !!userResponse,
        stats: this.getStats()
      }
    });

    logger.info('Iterate mode resumed', {
      hadUserResponse: !!userResponse,
      totalIterations: this.state.totalIterations
    });
  }

  /**
   * Get current iterate mode statistics
   *
   * @returns Iterate stats (iterations, cost, time, etc.)
   *
   * **Phase 1 (Week 1)**: Returns placeholder stats
   * **Phase 4 (Week 4)**: Returns real stats from state
   */
  getStats(): IterateStats {
    if (!this.state) {
      // Return placeholder if state not initialized
      return {
        durationMs: 0,
        totalIterations: 0,
        totalAutoResponses: 0,
        totalUserInterventions: 0,
        totalTokens: 0, // v9.0.0
        avgTokensPerIteration: 0, // v9.0.0
        totalCost: 0, // v8.5.8 - Deprecated, always 0 (cost tracking removed)
        classificationBreakdown: {
          confirmation_prompt: 0,
          status_update: 0,
          genuine_question: 0,
          blocking_request: 0,
          error_signal: 0,
          completion_signal: 0,
          rate_limit_or_context: 0
        },
        avgClassificationLatencyMs: 0,
        safetyChecks: {
          total: 0,
          allowed: 0,
          paused: 0,
          blocked: 0
        },
        stopReason: 'completion',
        successRate: 1.0
      };
    }

    // Calculate duration
    const startTime = new Date(this.state.startedAt).getTime();
    const durationMs = Date.now() - startTime;

    // Build classification breakdown
    const breakdown: Record<ClassificationType, number> = {
      confirmation_prompt: 0,
      status_update: 0,
      genuine_question: 0,
      blocking_request: 0,
      error_signal: 0,
      completion_signal: 0,
      rate_limit_or_context: 0
    };

    for (const classification of this.state.classificationHistory) {
      breakdown[classification.type]++;
    }

    // Calculate average classification latency
    const latencies = this.state.classificationHistory
      .map(c => c.context?.latencyMs || 0)
      .filter(l => l > 0);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // User interventions = pauses for genuine questions or blocking requests
    const userInterventions = breakdown.genuine_question + breakdown.blocking_request;

    // Determine stop reason
    let stopReason: 'completion' | 'timeout' | 'token_limit' | 'user_interrupt' | 'error' = 'completion';
    if (this.state.pauseReason) {
      if (this.state.pauseReason === 'time_limit_exceeded') {
        stopReason = 'timeout';
      } else if (this.state.pauseReason === 'token_limit_exceeded') {
        stopReason = 'token_limit'; // v9.0.0
      } else if (this.state.pauseReason === 'user_interrupt') {
        stopReason = 'user_interrupt';
      } else if (this.state.pauseReason === 'error_recovery_needed') {
        stopReason = 'error';
      }
    }

    // Success rate = (total - errors) / total
    const errorCount = breakdown.error_signal;
    const successRate = this.state.totalIterations > 0
      ? (this.state.totalIterations - errorCount) / this.state.totalIterations
      : 1.0;

    // v9.0.0: Calculate average tokens per iteration
    const avgTokensPerIteration = this.state.totalIterations > 0
      ? this.state.totalTokens / this.state.totalIterations
      : 0;

    return {
      durationMs,
      totalIterations: this.state.totalIterations,
      totalAutoResponses: this.state.totalAutoResponses,
      totalUserInterventions: userInterventions,
      totalTokens: this.state.totalTokens, // v9.0.0
      avgTokensPerIteration: Math.round(avgTokensPerIteration), // v9.0.0
      totalCost: 0, // v8.5.8 - Deprecated, always 0 (cost tracking removed)
      classificationBreakdown: breakdown,
      avgClassificationLatencyMs: Math.round(avgLatency),
      safetyChecks: {
        total: 0, // TODO: Track safety checks
        allowed: 0,
        paused: 0,
        blocked: 0
      },
      stopReason,
      successRate
    };
  }

  /**
   * Emit telemetry event
   *
   * @param event - Telemetry event to emit
   * @private
   *
   * **Phase 1 (Week 1)**: Logs only
   * **Phase 4 (Week 4)**: Full telemetry with file logging
   */
  private emitEvent(event: IterateEvent): void {
    if (this.config.telemetry.emitMetrics) {
      logger.debug('Iterate event (skeleton)', {
        type: event.type,
        sessionId: event.sessionId
      });
    }

    // TODO (Week 4): Write to JSONL telemetry file
  }

  /**
   * Check if time budget exceeded
   *
   * @returns True if time budget exceeded
   * @private
   *
   * **Phase 1 (Week 1)**: Placeholder
   * **Phase 4 (Week 4)**: Real budget checking
   */
  private checkTimeBudget(): boolean {
    if (!this.state) {
      return false;
    }

    const startTime = new Date(this.state.startedAt).getTime();
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - startTime) / 1000 / 60;
    const maxMinutes = this.config.defaults.maxDurationMinutes;

    if (elapsedMinutes >= maxMinutes) {
      logger.warn('Time budget exceeded', {
        elapsedMinutes: Math.round(elapsedMinutes),
        maxMinutes
      });
      return true;
    }

    // Check warning thresholds
    const percentElapsed = (elapsedMinutes / maxMinutes) * 100;
    for (const threshold of this.config.notifications.warnAtTimePercent) {
      if (percentElapsed >= threshold && percentElapsed < threshold + 1) {
        logger.warn(`Time budget at ${threshold}% of limit`, {
          elapsedMinutes: Math.round(elapsedMinutes),
          maxMinutes,
          percentUsed: Math.round(percentElapsed)
        });
      }
    }

    return false;
  }

  /**
   * Check if token budget exceeded
   *
   * @returns True if token budget exceeded
   * @private
   * @since v8.6.0
   *
   * More reliable than cost checking as token counts don't change
   */
  private checkTokenBudget(): boolean {
    if (!this.state) return false;

    // Skip if token limits not configured (backward compatibility)
    const maxTotalTokens = this.config.defaults.maxTotalTokens;
    if (!maxTotalTokens) {
      return false; // No token limit set, don't enforce
    }

    const currentTokens = this.state.totalTokens;

    // Check if budget exceeded
    if (currentTokens >= maxTotalTokens) {
      logger.warn('Token budget exceeded', {
        currentTokens,
        maxTotalTokens,
        sessionId: this.state.sessionId
      });
      return true;
    }

    // Warning thresholds (75%, 90%)
    const percentUsed = (currentTokens / maxTotalTokens) * 100;
    const warnThresholds = this.config.defaults.warnAtTokenPercent || [75, 90];

    for (const threshold of warnThresholds) {
      if (percentUsed >= threshold && percentUsed < threshold + 1) {
        logger.warn(`Token budget at ${threshold}% of limit`, {
          currentTokens,
          maxTotalTokens,
          percentUsed: percentUsed.toFixed(1)
        });

        // Update last warning threshold
        this.state.lastWarningThreshold = {
          type: 'tokens',
          percent: threshold,
          timestamp: new Date().toISOString()
        };
      }
    }

    return false;
  }

  /**
   * Check if iteration limit exceeded
   *
   * @returns True if iteration limit exceeded
   * @private
   *
   * **Phase 1 (Week 1)**: Placeholder
   * **Phase 4 (Week 4)**: Real iteration counting
   */
  private checkIterationLimit(): boolean {
    if (!this.state) {
      return false;
    }

    // Check total iterations
    if (this.state.totalIterations >= this.config.defaults.maxIterationsPerRun) {
      logger.warn('Total iteration limit exceeded', {
        totalIterations: this.state.totalIterations,
        limit: this.config.defaults.maxIterationsPerRun
      });
      return true;
    }

    // Check current stage iterations
    if (this.state.currentStageIterations >= this.config.defaults.maxIterationsPerStage) {
      logger.warn('Stage iteration limit exceeded', {
        currentStageIterations: this.state.currentStageIterations,
        limit: this.config.defaults.maxIterationsPerStage
      });
      return true;
    }

    // Check auto-response limit
    if (this.state.currentStageAutoResponses >= this.config.defaults.maxAutoResponsesPerStage) {
      logger.warn('Auto-response limit exceeded', {
        currentStageAutoResponses: this.state.currentStageAutoResponses,
        limit: this.config.defaults.maxAutoResponsesPerStage
      });
      return true;
    }

    return false;
  }

  /**
   * Initialize iterate state
   *
   * @param sessionId - Session ID
   * @private
   */
  private initializeState(sessionId: string): void {
    this.state = {
      enabled: true,
      sessionId,
      startedAt: new Date().toISOString(),
      totalIterations: 0,
      currentStageIterations: 0,
      totalAutoResponses: 0,
      currentStageAutoResponses: 0,
      totalTokens: 0, // v9.0.0: token-based tracking only
      currentStageTokens: 0, // v9.0.0: per-stage token tracking
      classificationHistory: [],
      metadata: {}
    };

    logger.info('Iterate state initialized', {
      sessionId,
      startedAt: this.state.startedAt,
      maxTokens: this.config.defaults.maxTotalTokens
    });
  }

  /**
   * Increment iteration counters
   *
   * @private
   */
  private incrementIterations(): void {
    if (!this.state) {
      return;
    }

    this.state.totalIterations++;
    this.state.currentStageIterations++;
  }

  /**
   * Increment auto-response counters
   *
   * @private
   */
  private incrementAutoResponses(): void {
    if (!this.state) {
      return;
    }

    this.state.totalAutoResponses++;
    this.state.currentStageAutoResponses++;
  }

  /**
   * Update token counters
   *
   * @param tokens - Token count to add
   * @private
   * @since v8.6.0
   *
   * More reliable than cost tracking as token counts don't change with pricing
   */
  private updateTokens(tokens: number): void {
    if (!this.state) {
      return;
    }

    this.state.totalTokens += tokens;
    this.state.currentStageTokens += tokens;

    logger.debug('Token usage updated', {
      tokensAdded: tokens,
      totalTokens: this.state.totalTokens,
      currentStageTokens: this.state.currentStageTokens,
      maxTotalTokens: this.config.defaults.maxTotalTokens
    });
  }

  /**
   * Get recent messages from classification history
   *
   * @returns Recent messages array
   * @private
   */
  private getRecentMessages(): Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> {
    if (!this.state) {
      return [];
    }

    const limit = this.config.classifier.contextWindowMessages;
    return this.state.classificationHistory
      .slice(-limit)
      .map(c => ({
        role: 'assistant' as const,
        content: c.context?.message || '',
        timestamp: c.timestamp
      }));
  }

}
