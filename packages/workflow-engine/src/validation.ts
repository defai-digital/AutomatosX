import { WorkflowSchema, type Workflow } from '@defai.digital/contracts';
import type { PreparedWorkflow, StepResult } from './types.js';
import { WorkflowErrorCodes } from './types.js';

export class WorkflowValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

export function validateWorkflow(data: unknown): Workflow {
  const result = WorkflowSchema.safeParse(data);

  if (!result.success) {
    throw new WorkflowValidationError(
      WorkflowErrorCodes.VALIDATION_ERROR,
      `Workflow validation failed: ${result.error.message}`,
      { errors: result.error.errors },
    );
  }

  const workflow = result.data;
  const stepIds = new Set<string>();
  for (const step of workflow.steps) {
    if (stepIds.has(step.stepId)) {
      throw new WorkflowValidationError(
        WorkflowErrorCodes.DUPLICATE_STEP_ID,
        `Duplicate step ID found: ${step.stepId}`,
        { stepId: step.stepId },
      );
    }
    stepIds.add(step.stepId);
  }

  return workflow;
}

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

export function prepareWorkflow(data: unknown): PreparedWorkflow {
  const workflow = validateWorkflow(data);
  const stepIds = new Set(workflow.steps.map((step) => step.stepId));
  const frozenWorkflow = deepFreeze(structuredClone(workflow));

  return {
    workflow: frozenWorkflow,
    stepIds,
  };
}

export function deepFreezeStepResult(result: StepResult): Readonly<StepResult> {
  return deepFreeze(structuredClone(result));
}
