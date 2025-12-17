import {
  WorkflowSchema,
  type Workflow,
} from '@automatosx/contracts';
import type { PreparedWorkflow, StepResult } from './types.js';
import { WorkflowErrorCodes } from './types.js';

/**
 * Validation error for workflows
 */
export class WorkflowValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Validates a workflow definition and checks invariants
 * INV-WF-003: Schema strictness - unknown fields rejected
 * INV-WF-004: Step ID uniqueness
 */
export function validateWorkflow(data: unknown): Workflow {
  // Use strict parsing to reject unknown fields (INV-WF-003)
  const strictSchema = WorkflowSchema.strict();
  const result = strictSchema.safeParse(data);

  if (!result.success) {
    throw new WorkflowValidationError(
      WorkflowErrorCodes.VALIDATION_ERROR,
      `Workflow validation failed: ${result.error.message}`,
      { errors: result.error.errors }
    );
  }

  const workflow = result.data;

  // INV-WF-004: Check for duplicate step IDs
  const stepIds = new Set<string>();
  for (const step of workflow.steps) {
    if (stepIds.has(step.stepId)) {
      throw new WorkflowValidationError(
        WorkflowErrorCodes.DUPLICATE_STEP_ID,
        `Duplicate step ID found: ${step.stepId}`,
        { stepId: step.stepId }
      );
    }
    stepIds.add(step.stepId);
  }

  return workflow;
}

/**
 * Deep freezes an object to make it immutable
 * INV-WF-005: Workflow definitions must not be modified during execution
 */
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  const propNames = Reflect.ownKeys(obj) as (keyof T)[];

  for (const name of propNames) {
    const value = obj[name];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value as object);
    }
  }

  return Object.freeze(obj);
}

/**
 * Prepares a workflow for execution by validating and freezing it
 * INV-WF-003: Schema strictness
 * INV-WF-004: Step ID uniqueness
 * INV-WF-005: Immutable definition
 */
export function prepareWorkflow(data: unknown): PreparedWorkflow {
  const workflow = validateWorkflow(data);

  // Collect step IDs
  const stepIds = new Set(workflow.steps.map((s) => s.stepId));

  // Deep freeze the workflow (INV-WF-005)
  const frozenWorkflow = deepFreeze(structuredClone(workflow));

  return {
    workflow: frozenWorkflow,
    stepIds,
  };
}

/**
 * Deep freezes a step result to ensure immutability
 * This prevents subsequent steps from accidentally modifying previous results
 */
export function deepFreezeStepResult(result: StepResult): Readonly<StepResult> {
  return deepFreeze(structuredClone(result)) as Readonly<StepResult>;
}
