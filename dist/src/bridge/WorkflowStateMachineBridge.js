/**
 * WorkflowStateMachineBridge - TypeScript bridge for ReScript WorkflowStateMachine
 *
 * This bridge provides a clean TypeScript API for the ReScript workflow state machine,
 * handling type conversions and providing ergonomic error handling.
 *
 * Usage:
 * ```typescript
 * const machine = WorkflowStateMachineBridge.create(workflowId, workflowName, stepIds);
 * const result = machine.transition('start');
 * if (result.success) {
 *   console.log('New state:', result.machine.getState());
 * }
 * ```
 */
import * as WorkflowStateMachine from '../../packages/rescript-core/src/workflow/WorkflowStateMachine.bs.js';
/**
 * WorkflowStateMachineBridge - TypeScript wrapper for ReScript state machine
 */
export class WorkflowStateMachineBridge {
    machine; // ReScript machine instance
    constructor(machine) {
        this.machine = machine;
    }
    /**
     * Create a new workflow state machine
     *
     * @param workflowId - Unique workflow ID
     * @param workflowName - Human-readable workflow name
     * @param steps - Array of step IDs
     * @returns New WorkflowStateMachineBridge instance
     */
    static create(workflowId, workflowName, steps) {
        const machine = WorkflowStateMachine.make(workflowId, workflowName, steps);
        return new WorkflowStateMachineBridge(machine);
    }
    /**
     * Get current workflow state
     *
     * @returns Current state ('idle', 'parsing', etc.)
     */
    getState() {
        const state = WorkflowStateMachine.getState(this.machine);
        return this.mapReScriptState(state);
    }
    /**
     * Get full workflow context
     *
     * @returns Workflow context with variables, steps, history
     */
    getContext() {
        const ctx = WorkflowStateMachine.getContext(this.machine);
        return {
            workflowId: ctx.workflowId,
            workflowName: ctx.workflowName,
            variables: ctx.variables,
            steps: ctx.steps.map((step) => ({
                id: step.id,
                status: step.status,
                startedAt: step.startedAt?._0,
                completedAt: step.completedAt?._0,
                error: step.error?._0,
                result: step.result?._0,
            })),
            currentStepIndex: ctx.currentStepIndex,
            history: ctx.history.map((s) => this.mapReScriptState(s)),
            error: ctx.error?._0,
            startedAt: ctx.startedAt?._0,
            completedAt: ctx.completedAt?._0,
            pausedAt: ctx.pausedAt?._0,
        };
    }
    /**
     * Transition to new state by triggering an event
     *
     * @param event - Event to trigger ('start', 'pause', etc.)
     * @returns Transition result with new machine or error
     */
    transition(event) {
        const rescriptEvent = this.mapTypeScriptEvent(event);
        const result = WorkflowStateMachine.transition(this.machine, rescriptEvent);
        if (result.TAG === 0) { // Ok variant
            const newMachine = result._0;
            return {
                success: true,
                machine: new WorkflowStateMachineBridge(newMachine),
            };
        }
        else { // Error variant
            return {
                success: false,
                error: result._0,
            };
        }
    }
    /**
     * Check if a transition is valid without executing it
     *
     * @param event - Event to check
     * @returns true if transition is valid, false otherwise
     */
    canTransition(event) {
        const rescriptEvent = this.mapTypeScriptEvent(event);
        return WorkflowStateMachine.canTransition(this.machine, rescriptEvent);
    }
    /**
     * Set a workflow variable
     *
     * @param key - Variable name
     * @param value - Variable value
     * @returns New machine instance with updated variable
     */
    setVariable(key, value) {
        const newMachine = WorkflowStateMachine.setVariable(this.machine, key, value);
        return new WorkflowStateMachineBridge(newMachine);
    }
    /**
     * Get a workflow variable
     *
     * @param key - Variable name
     * @returns Variable value or undefined
     */
    getVariable(key) {
        const result = WorkflowStateMachine.getVariable(this.machine, key);
        return result?._0;
    }
    /**
     * Update a step's state
     *
     * @param stepId - Step ID to update
     * @param updateFn - Function that transforms the step
     * @returns New machine instance with updated step
     */
    updateStep(stepId, updateFn) {
        const rescriptUpdateFn = (rescriptStep) => {
            const tsStep = {
                id: rescriptStep.id,
                status: rescriptStep.status,
                startedAt: rescriptStep.startedAt?._0,
                completedAt: rescriptStep.completedAt?._0,
                error: rescriptStep.error?._0,
                result: rescriptStep.result?._0,
            };
            const updated = updateFn(tsStep);
            return {
                ...rescriptStep,
                status: updated.status,
                startedAt: updated.startedAt !== undefined ? { TAG: 0, _0: updated.startedAt } : { TAG: 1 },
                completedAt: updated.completedAt !== undefined ? { TAG: 0, _0: updated.completedAt } : { TAG: 1 },
                error: updated.error !== undefined ? { TAG: 0, _0: updated.error } : { TAG: 1 },
                result: updated.result !== undefined ? { TAG: 0, _0: updated.result } : { TAG: 1 },
            };
        };
        const newMachine = WorkflowStateMachine.updateStep(this.machine, stepId, rescriptUpdateFn);
        return new WorkflowStateMachineBridge(newMachine);
    }
    /**
     * Get current step being executed
     *
     * @returns Current step or undefined
     */
    getCurrentStep() {
        const result = WorkflowStateMachine.getCurrentStep(this.machine);
        if (!result || result.TAG === 1)
            return undefined;
        const step = result._0;
        return {
            id: step.id,
            status: step.status,
            startedAt: step.startedAt?._0,
            completedAt: step.completedAt?._0,
            error: step.error?._0,
            result: step.result?._0,
        };
    }
    /**
     * Get all completed steps
     *
     * @returns Array of completed steps
     */
    getCompletedSteps() {
        const steps = WorkflowStateMachine.getCompletedSteps(this.machine);
        return steps.map((step) => ({
            id: step.id,
            status: step.status,
            startedAt: step.startedAt?._0,
            completedAt: step.completedAt?._0,
            error: step.error?._0,
            result: step.result?._0,
        }));
    }
    /**
     * Get all failed steps
     *
     * @returns Array of failed steps
     */
    getFailedSteps() {
        const steps = WorkflowStateMachine.getFailedSteps(this.machine);
        return steps.map((step) => ({
            id: step.id,
            status: step.status,
            startedAt: step.startedAt?._0,
            completedAt: step.completedAt?._0,
            error: step.error?._0,
            result: step.result?._0,
        }));
    }
    /**
     * Get all pending steps
     *
     * @returns Array of pending steps
     */
    getPendingSteps() {
        const steps = WorkflowStateMachine.getPendingSteps(this.machine);
        return steps.map((step) => ({
            id: step.id,
            status: step.status,
            startedAt: step.startedAt?._0,
            completedAt: step.completedAt?._0,
            error: step.error?._0,
            result: step.result?._0,
        }));
    }
    /**
     * Serialize machine to checkpoint
     *
     * @returns Checkpoint object for persistence
     */
    serialize() {
        return WorkflowStateMachine.serialize(this.machine);
    }
    /**
     * Deserialize checkpoint to machine
     *
     * @param checkpoint - Checkpoint object
     * @returns Machine instance or undefined if invalid
     */
    static deserialize(checkpoint) {
        const result = WorkflowStateMachine.deserialize(checkpoint);
        if (!result || result.TAG === 1)
            return undefined;
        return new WorkflowStateMachineBridge(result._0);
    }
    /**
     * Map ReScript state to TypeScript state
     */
    mapReScriptState(state) {
        if (state === WorkflowStateMachine.stateIdle)
            return 'idle';
        if (state === WorkflowStateMachine.stateParsing)
            return 'parsing';
        if (state === WorkflowStateMachine.stateValidating)
            return 'validating';
        if (state === WorkflowStateMachine.stateExecuting)
            return 'executing';
        if (state === WorkflowStateMachine.statePaused)
            return 'paused';
        if (state === WorkflowStateMachine.stateCompleted)
            return 'completed';
        if (state === WorkflowStateMachine.stateFailed)
            return 'failed';
        if (state === WorkflowStateMachine.stateCancelled)
            return 'cancelled';
        throw new Error(`Unknown ReScript state: ${state}`);
    }
    /**
     * Map TypeScript event to ReScript event
     */
    mapTypeScriptEvent(event) {
        if (typeof event === 'string') {
            switch (event) {
                case 'start': return WorkflowStateMachine.eventStart;
                case 'parse': return WorkflowStateMachine.eventParse;
                case 'validate': return WorkflowStateMachine.eventValidate;
                case 'execute': return WorkflowStateMachine.eventExecute;
                case 'pause': return WorkflowStateMachine.eventPause;
                case 'resume': return WorkflowStateMachine.eventResume;
                case 'complete': return WorkflowStateMachine.eventComplete;
                case 'cancel': return WorkflowStateMachine.eventCancel;
                default: throw new Error(`Unknown event: ${event}`);
            }
        }
        else if (event.type === 'fail') {
            return WorkflowStateMachine.eventFail(event.error);
        }
        else {
            throw new Error(`Invalid event format: ${JSON.stringify(event)}`);
        }
    }
    /**
     * Get raw ReScript machine (for advanced use cases)
     */
    getRawMachine() {
        return this.machine;
    }
}
//# sourceMappingURL=WorkflowStateMachineBridge.js.map