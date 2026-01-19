/**
 * Saga Manager Implementation
 *
 * Implements the saga pattern for distributed transaction compensation.
 * Enables automatic rollback of completed steps on failure.
 *
 * Invariants:
 * - INV-SG-001: Compensations run in reverse order on failure
 * - INV-SG-002: Required compensations must succeed
 * - INV-SG-003: Saga state transitions are valid
 */

import {
  type SagaDefinition,
  type SagaState,
  type SagaStep,
  type CompensationAction,
  type SagaResult,
  type SagaStatus,
  createInitialSagaState,
  isValidSagaTransition,
  SagaErrorCodes,
  getErrorMessage,
} from '@defai.digital/contracts';

/**
 * Saga step executor function
 */
export type SagaStepExecutor<T = unknown> = (
  step: SagaStep,
  context: Record<string, unknown>
) => Promise<T>;

/**
 * Compensation executor function
 */
export type CompensationExecutor = (
  action: CompensationAction,
  context: Record<string, unknown>
) => Promise<void>;

/**
 * Saga manager for orchestrating distributed transactions
 */
export interface SagaManager {
  /** Get saga definition */
  getDefinition(): SagaDefinition;

  /** Execute the saga with given steps */
  execute(
    steps: SagaStep[],
    stepExecutor: SagaStepExecutor,
    compensationExecutor: CompensationExecutor,
    correlationId?: string
  ): Promise<SagaResult>;

  /** Get current state */
  getState(): SagaState | null;

  /** Manually trigger compensation */
  compensate(): Promise<void>;
}

/**
 * Creates a saga manager
 */
export function createSagaManager(definition: SagaDefinition): SagaManager {
  let state: SagaState | null = null;
  let compensationExec: CompensationExecutor | null = null;
  let context: Record<string, unknown> = {};

  /**
   * Update saga state with transition validation
   * INV-SG-003: State transitions are valid
   */
  function transitionTo(newStatus: SagaStatus): void {
    if (!state) return;

    if (!isValidSagaTransition(state.status, newStatus)) {
      throw new SagaError(
        SagaErrorCodes.INVALID_STATE_TRANSITION,
        `Invalid state transition from ${state.status} to ${newStatus}`
      );
    }

    state = { ...state, status: newStatus };
  }

  /**
   * Execute compensations
   * INV-SG-001: Execute in reverse order
   */
  async function executeCompensations(): Promise<void> {
    if (!state || !compensationExec) return;

    transitionTo('compensating');

    // Get compensations for completed steps in reverse order
    const completedStepIds = [...state.completedSteps].reverse();

    for (const stepId of completedStepIds) {
      const compensation = definition.compensations.find(
        (c) => c.stepId === stepId
      );

      if (!compensation) continue;

      // Already compensated
      if (state.compensatedSteps.includes(stepId)) continue;

      let retries = 0;
      let success = false;

      while (retries <= compensation.retryCount && !success) {
        try {
          await compensationExec(compensation, context);
          state.compensatedSteps.push(stepId);
          success = true;
        } catch (error) {
          retries++;
          const errorMessage = getErrorMessage(error);

          state.compensationErrors.push({
            stepId,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            retryCount: retries,
          });

          // INV-SG-002: Required compensations must succeed
          if (retries > compensation.retryCount) {
            if (compensation.required) {
              transitionTo('failed');
              throw new SagaError(
                SagaErrorCodes.REQUIRED_COMPENSATION_FAILED,
                `Required compensation for step ${stepId} failed: ${errorMessage}`
              );
            }
            // Non-required compensation failed, continue
            break;
          }
        }
      }
    }

    transitionTo('compensated');
  }

  return {
    getDefinition(): SagaDefinition {
      return { ...definition };
    },

    async execute(
      steps: SagaStep[],
      stepExecutor: SagaStepExecutor,
      compensationExecutor: CompensationExecutor,
      correlationId?: string
    ): Promise<SagaResult> {
      compensationExec = compensationExecutor;
      context = {};

      // Initialize saga state
      state = createInitialSagaState(definition.sagaId, correlationId);

      const startTime = Date.now();
      const results: unknown[] = [];

      try {
        // Execute each step
        for (const step of steps) {
          try {
            const result = await stepExecutor(step, context);
            results.push(result);

            // Record completed step
            state.completedSteps.push(step.stepId);

            // Store output in context for subsequent steps
            context[step.stepId] = result;
          } catch (error) {
            const errorMessage = getErrorMessage(error);

            state.failedStep = step.stepId;
            state.failureReason = errorMessage;

            // Execute compensations based on strategy
            if (definition.onFailure === 'compensate') {
              await executeCompensations();
            } else if (definition.onFailure === 'pause') {
              transitionTo('paused');
            }

            if (state.status !== 'compensated') {
              transitionTo('failed');
            }

            state.completedAt = new Date().toISOString();

            return {
              success: false,
              executionId: state.executionId,
              error: errorMessage,
              compensated: state.status === 'compensated',
              durationMs: Date.now() - startTime,
              finalStatus: state.status,
            };
          }
        }

        transitionTo('completed');
        state.completedAt = new Date().toISOString();

        return {
          success: true,
          executionId: state.executionId,
          results,
          durationMs: Date.now() - startTime,
          finalStatus: state.status,
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        if (state) {
          if (state.status !== 'failed') {
            state.status = 'failed';
          }
          state.failureReason = errorMessage;
          state.completedAt = new Date().toISOString();
        }

        return {
          success: false,
          executionId: state?.executionId ?? '',
          error: errorMessage,
          durationMs: Date.now() - startTime,
          finalStatus: 'failed',
        };
      }
    },

    getState(): SagaState | null {
      return state ? { ...state } : null;
    },

    async compensate(): Promise<void> {
      if (!state) {
        throw new SagaError(
          SagaErrorCodes.SAGA_NOT_FOUND,
          'No saga state to compensate'
        );
      }

      if (state.status !== 'paused' && state.status !== 'running') {
        throw new SagaError(
          SagaErrorCodes.INVALID_STATE_TRANSITION,
          `Cannot compensate saga in ${state.status} state`
        );
      }

      await executeCompensations();
    },
  };
}

/**
 * Creates a simple saga definition
 */
export function defineSaga(
  sagaId: string,
  compensations: CompensationAction[],
  options: {
    onFailure?: 'compensate' | 'pause' | 'continue';
    compensationOrder?: 'reverse' | 'parallel';
    workflowId?: string;
    description?: string;
  } = {}
): SagaDefinition {
  return {
    sagaId,
    compensations,
    onFailure: options.onFailure ?? 'compensate',
    compensationOrder: options.compensationOrder ?? 'reverse',
    workflowId: options.workflowId,
    description: options.description,
  };
}

/**
 * Saga error
 */
export class SagaError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `Saga error: ${code}`);
    this.name = 'SagaError';
  }

  static stepFailed(stepId: string, error: string): SagaError {
    return new SagaError(
      SagaErrorCodes.STEP_FAILED,
      `Saga step ${stepId} failed: ${error}`
    );
  }

  static compensationFailed(stepId: string, error: string): SagaError {
    return new SagaError(
      SagaErrorCodes.COMPENSATION_FAILED,
      `Compensation for ${stepId} failed: ${error}`
    );
  }

  static sagaNotFound(sagaId: string): SagaError {
    return new SagaError(
      SagaErrorCodes.SAGA_NOT_FOUND,
      `Saga not found: ${sagaId}`
    );
  }
}
