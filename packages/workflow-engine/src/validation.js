import { WorkflowSchema } from '@defai.digital/contracts';
import { WorkflowErrorCodes } from './types.js';
export class WorkflowValidationError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'WorkflowValidationError';
    }
}
export function validateWorkflow(data) {
    const result = WorkflowSchema.safeParse(data);
    if (!result.success) {
        throw new WorkflowValidationError(WorkflowErrorCodes.VALIDATION_ERROR, `Workflow validation failed: ${result.error.message}`, { errors: result.error.errors });
    }
    const workflow = result.data;
    const stepIds = new Set();
    for (const step of workflow.steps) {
        if (stepIds.has(step.stepId)) {
            throw new WorkflowValidationError(WorkflowErrorCodes.DUPLICATE_STEP_ID, `Duplicate step ID found: ${step.stepId}`, { stepId: step.stepId });
        }
        stepIds.add(step.stepId);
    }
    return workflow;
}
function deepFreeze(obj) {
    const propNames = Reflect.ownKeys(obj);
    for (const name of propNames) {
        const value = obj[name];
        if (value !== null && typeof value === 'object') {
            deepFreeze(value);
        }
    }
    return Object.freeze(obj);
}
export function prepareWorkflow(data) {
    const workflow = validateWorkflow(data);
    const stepIds = new Set(workflow.steps.map((step) => step.stepId));
    const frozenWorkflow = deepFreeze(structuredClone(workflow));
    return {
        workflow: frozenWorkflow,
        stepIds,
    };
}
export function deepFreezeStepResult(result) {
    return deepFreeze(structuredClone(result));
}
