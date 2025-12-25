/**
 * Iterate Controller
 *
 * State machine for iterate mode - handles intent classification
 * and determines actions (CONTINUE, PAUSE, STOP, RETRY).
 *
 * Invariants:
 * - INV-ITR-003: Intent classification drives action decisions
 */

import { randomUUID } from 'node:crypto';
import {
  type IterateIntent,
  type IterateAction,
  type IterateState,
  type IterateStartRequest,
  type IterateHandleResponse,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TIME_MS,
} from '@defai.digital/contracts';
import type { IIterateController } from './types.js';
import { BudgetTracker } from './budget.js';
import { SafetyGuard } from './safety.js';

// ============================================================================
// Auto-Response Templates
// ============================================================================

/**
 * Auto-responses for CONTINUE action
 */
const AUTO_RESPONSES: Record<IterateIntent, string> = {
  continue: 'Continue.',
  question: '', // Should not auto-respond
  blocked: '', // Should not auto-respond
  complete: '', // Should not auto-respond
  error: '', // Should not auto-respond
};

// ============================================================================
// Iterate Controller Implementation
// ============================================================================

/**
 * Main controller for iterate mode
 */
export class IterateController implements IIterateController {
  private budgetTracker: BudgetTracker;
  private safetyGuard: SafetyGuard;

  constructor() {
    this.budgetTracker = new BudgetTracker();
    this.safetyGuard = new SafetyGuard();
  }

  /**
   * Start a new iterate session
   */
  start(request: IterateStartRequest): IterateState {
    const sessionId = request.sessionId ?? randomUUID();
    const now = new Date().toISOString();

    // Initialize budget tracker
    this.budgetTracker = new BudgetTracker(request.budget);
    this.budgetTracker.start();

    // Initialize safety guard
    if (request.safety) {
      this.safetyGuard = new SafetyGuard(request.safety);
    }

    return {
      sessionId,
      taskId: randomUUID(),
      budget: {
        maxIterations: request.budget?.maxIterations ?? DEFAULT_MAX_ITERATIONS,
        maxTimeMs: request.budget?.maxTimeMs ?? DEFAULT_MAX_TIME_MS,
        maxTokens: request.budget?.maxTokens,
      },
      consumed: {
        iterations: 0,
        timeMs: 0,
        tokens: 0,
      },
      iteration: 0,
      startedAt: now,
      lastActivityAt: now,
      status: 'running',
      consecutiveErrors: 0,
      history: [],
    };
  }

  /**
   * Handle a response from the LLM
   */
  handleResponse(
    state: IterateState,
    intent: IterateIntent,
    content?: string
  ): IterateHandleResponse {
    const now = new Date().toISOString();

    // Record iteration in budget tracker
    this.budgetTracker.recordIteration();

    // Check budget first
    const budgetStatus = this.budgetTracker.check();
    if (budgetStatus.exceeded) {
      return this.createResponse(state, intent, {
        type: 'STOP',
        reason: budgetStatus.reason ?? 'Budget exceeded',
        requiresInput: false,
      }, 'budget_exceeded', now, content);
    }

    // Check safety if content provided
    if (content) {
      const safetyResult = this.safetyGuard.checkContent(content);
      if (!safetyResult.safe) {
        return this.createResponse(state, intent, {
          type: 'PAUSE',
          reason: safetyResult.reason ?? 'Safety check failed',
          requiresInput: true,
          suggestedInput: 'Review the dangerous pattern and confirm to proceed.',
        }, 'paused', now, content);
      }
    }

    // Check consecutive errors
    if (intent === 'error') {
      const newErrorCount = state.consecutiveErrors + 1;
      const errorResult = this.safetyGuard.checkErrors(newErrorCount);
      if (!errorResult.safe) {
        return this.createResponse(state, intent, {
          type: 'PAUSE',
          reason: errorResult.reason ?? 'Too many consecutive errors',
          requiresInput: true,
          suggestedInput: 'Review the errors and decide how to proceed.',
        }, 'paused', now, content, newErrorCount);
      }
    }

    // Map intent to action
    const action = this.mapIntentToAction(intent);

    // Determine new status
    let newStatus: IterateState['status'] = state.status;
    if (action.type === 'STOP') {
      newStatus = intent === 'complete' ? 'completed' : 'failed';
    } else if (action.type === 'PAUSE') {
      newStatus = 'paused';
    } else {
      newStatus = 'running';
    }

    // Reset error count on non-error intent
    const consecutiveErrors = intent === 'error' ? state.consecutiveErrors + 1 : 0;

    return this.createResponse(state, intent, action, newStatus, now, content, consecutiveErrors);
  }

  /**
   * Get auto-response for CONTINUE action
   */
  getAutoResponse(intent: IterateIntent): string {
    return AUTO_RESPONSES[intent] ?? 'Continue.';
  }

  /**
   * Map intent to action
   */
  private mapIntentToAction(intent: IterateIntent): IterateAction {
    switch (intent) {
      case 'continue':
        return {
          type: 'CONTINUE',
          reason: 'Task in progress',
          requiresInput: false,
        };

      case 'question':
        return {
          type: 'PAUSE',
          reason: 'User decision needed',
          requiresInput: true,
          suggestedInput: 'Please provide your decision.',
        };

      case 'blocked':
        return {
          type: 'PAUSE',
          reason: 'External input needed',
          requiresInput: true,
          suggestedInput: 'Please provide the required input.',
        };

      case 'complete':
        return {
          type: 'STOP',
          reason: 'Task completed successfully',
          requiresInput: false,
        };

      case 'error':
        return {
          type: 'PAUSE',
          reason: 'Error occurred',
          requiresInput: true,
          suggestedInput: 'Please review the error and decide how to proceed.',
        };

      default:
        // Unknown intent - pause for safety
        return {
          type: 'PAUSE',
          reason: 'Unknown intent - pausing for safety',
          requiresInput: true,
        };
    }
  }

  /**
   * Create response with updated state
   */
  private createResponse(
    state: IterateState,
    intent: IterateIntent,
    action: IterateAction,
    newStatus: IterateState['status'],
    now: string,
    content?: string,
    consecutiveErrors?: number
  ): IterateHandleResponse {
    const consumed = this.budgetTracker.getConsumed();

    const newState: IterateState = {
      ...state,
      iteration: state.iteration + 1,
      consumed,
      lastActivityAt: now,
      status: newStatus,
      lastIntent: intent,
      lastAction: action,
      consecutiveErrors: consecutiveErrors ?? (intent === 'error' ? state.consecutiveErrors + 1 : 0),
      history: [
        ...(state.history ?? []),
        {
          iteration: state.iteration + 1,
          intent,
          action: action.type,
          timestamp: now,
        },
      ],
    };

    return {
      action,
      newState,
      content,
      autoResponse: action.type === 'CONTINUE' ? this.getAutoResponse(intent) : undefined,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates an iterate controller
 */
export function createIterateController(): IIterateController {
  return new IterateController();
}
