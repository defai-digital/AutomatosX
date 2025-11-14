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
export type WorkflowState = 'idle' | 'parsing' | 'validating' | 'executing' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type WorkflowEvent = 'start' | 'parse' | 'validate' | 'execute' | 'pause' | 'resume' | 'complete' | 'cancel' | {
    type: 'fail';
    error: string;
};
export interface StepState {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: number;
    completedAt?: number;
    error?: string;
    result?: Record<string, string>;
}
export interface WorkflowContext {
    workflowId: string;
    workflowName: string;
    variables: Record<string, string>;
    steps: StepState[];
    currentStepIndex: number;
    history: WorkflowState[];
    error?: string;
    startedAt?: number;
    completedAt?: number;
    pausedAt?: number;
}
export interface TransitionResult {
    success: boolean;
    machine?: WorkflowStateMachineBridge;
    error?: string;
}
export interface Checkpoint {
    state: WorkflowState;
    workflowId: string;
    workflowName: string;
    currentStepIndex: string;
    variables: string;
    steps: string;
}
/**
 * WorkflowStateMachineBridge - TypeScript wrapper for ReScript state machine
 */
export declare class WorkflowStateMachineBridge {
    private machine;
    private constructor();
    /**
     * Create a new workflow state machine
     *
     * @param workflowId - Unique workflow ID
     * @param workflowName - Human-readable workflow name
     * @param steps - Array of step IDs
     * @returns New WorkflowStateMachineBridge instance
     */
    static create(workflowId: string, workflowName: string, steps: string[]): WorkflowStateMachineBridge;
    /**
     * Get current workflow state
     *
     * @returns Current state ('idle', 'parsing', etc.)
     */
    getState(): WorkflowState;
    /**
     * Get full workflow context
     *
     * @returns Workflow context with variables, steps, history
     */
    getContext(): WorkflowContext;
    /**
     * Transition to new state by triggering an event
     *
     * @param event - Event to trigger ('start', 'pause', etc.)
     * @returns Transition result with new machine or error
     */
    transition(event: WorkflowEvent): TransitionResult;
    /**
     * Check if a transition is valid without executing it
     *
     * @param event - Event to check
     * @returns true if transition is valid, false otherwise
     */
    canTransition(event: WorkflowEvent): boolean;
    /**
     * Set a workflow variable
     *
     * @param key - Variable name
     * @param value - Variable value
     * @returns New machine instance with updated variable
     */
    setVariable(key: string, value: string): WorkflowStateMachineBridge;
    /**
     * Get a workflow variable
     *
     * @param key - Variable name
     * @returns Variable value or undefined
     */
    getVariable(key: string): string | undefined;
    /**
     * Update a step's state
     *
     * @param stepId - Step ID to update
     * @param updateFn - Function that transforms the step
     * @returns New machine instance with updated step
     */
    updateStep(stepId: string, updateFn: (step: StepState) => StepState): WorkflowStateMachineBridge;
    /**
     * Get current step being executed
     *
     * @returns Current step or undefined
     */
    getCurrentStep(): StepState | undefined;
    /**
     * Get all completed steps
     *
     * @returns Array of completed steps
     */
    getCompletedSteps(): StepState[];
    /**
     * Get all failed steps
     *
     * @returns Array of failed steps
     */
    getFailedSteps(): StepState[];
    /**
     * Get all pending steps
     *
     * @returns Array of pending steps
     */
    getPendingSteps(): StepState[];
    /**
     * Serialize machine to checkpoint
     *
     * @returns Checkpoint object for persistence
     */
    serialize(): Checkpoint;
    /**
     * Deserialize checkpoint to machine
     *
     * @param checkpoint - Checkpoint object
     * @returns Machine instance or undefined if invalid
     */
    static deserialize(checkpoint: Checkpoint): WorkflowStateMachineBridge | undefined;
    /**
     * Map ReScript state to TypeScript state
     */
    private mapReScriptState;
    /**
     * Map TypeScript event to ReScript event
     */
    private mapTypeScriptEvent;
    /**
     * Get raw ReScript machine (for advanced use cases)
     */
    getRawMachine(): any;
}
//# sourceMappingURL=WorkflowStateMachineBridge.d.ts.map