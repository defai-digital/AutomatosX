/**
 * TypeScript bridge for ReScript StateMachineV2
 *
 * Sprint 3 Day 24: Provides TypeScript interface to ReScript state machine
 */
/**
 * State machine states
 */
export type MachineState = 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed';
/**
 * State machine events
 */
export type MachineEvent = 'start' | 'plan' | 'execute' | 'pause' | 'resume' | 'complete' | 'fail';
/**
 * State machine context
 */
export interface MachineContext {
    taskId: string;
    agentName: string;
    data: Record<string, string>;
    history: MachineState[];
}
/**
 * State machine checkpoint
 */
export interface MachineCheckpoint {
    state: MachineState;
    context: MachineContext;
    timestamp: number;
}
/**
 * State machine interface
 */
export interface StateMachine {
    currentState: MachineState;
    context: MachineContext;
    createdAt: number;
    updatedAt: number;
}
/**
 * Transition result
 */
export type TransitionResult = {
    success: true;
    machine: StateMachine;
} | {
    success: false;
    error: string;
};
/**
 * ReScript state machine bridge
 *
 * Provides a TypeScript-friendly interface to the ReScript state machine implementation.
 */
export declare class StateMachineBridge {
    private machine;
    constructor(taskId: string, agentName: string);
    /**
     * Get current state
     */
    getCurrentState(): MachineState;
    /**
     * Transition to a new state
     */
    transition(event: MachineEvent, targetState: MachineState): TransitionResult;
    /**
     * Check if transition is valid
     */
    canTransition(event: MachineEvent, targetState: MachineState): boolean;
    /**
     * Set context data
     */
    setContextData(key: string, value: string): void;
    /**
     * Get context data
     */
    getContextData(key: string): string | undefined;
    /**
     * Get full context
     */
    getContext(): MachineContext;
    /**
     * Create checkpoint for resumable runs
     */
    createCheckpoint(): MachineCheckpoint;
    /**
     * Restore from checkpoint
     */
    restoreFromCheckpoint(checkpoint: MachineCheckpoint): void;
    /**
     * Get state machine representation
     */
    toStateMachine(): StateMachine;
    /**
     * Get state history
     */
    getHistory(): MachineState[];
    /**
     * Check if machine is in terminal state
     */
    isTerminal(): boolean;
    /**
     * Reset to initial state
     */
    reset(): void;
    private createMockMachine;
}
/**
 * Factory function to create state machine
 */
export declare function createStateMachine(taskId: string, agentName: string): StateMachineBridge;
/**
 * Workflow orchestrator using state machine
 */
export declare class WorkflowOrchestrator {
    private machines;
    constructor();
    /**
     * Create new workflow
     */
    createWorkflow(taskId: string, agentName: string): StateMachineBridge;
    /**
     * Get workflow by task ID
     */
    getWorkflow(taskId: string): StateMachineBridge | undefined;
    /**
     * Delete workflow
     */
    deleteWorkflow(taskId: string): boolean;
    /**
     * Get all workflows
     */
    getAllWorkflows(): StateMachineBridge[];
    /**
     * Get active workflows (not in terminal state)
     */
    getActiveWorkflows(): StateMachineBridge[];
    /**
     * Get completed workflows
     */
    getCompletedWorkflows(): StateMachineBridge[];
    /**
     * Get failed workflows
     */
    getFailedWorkflows(): StateMachineBridge[];
    /**
     * Create checkpoint for all workflows
     */
    createCheckpointAll(): Map<string, MachineCheckpoint>;
    /**
     * Restore all workflows from checkpoints
     */
    restoreFromCheckpoints(checkpoints: Map<string, MachineCheckpoint>): void;
}
//# sourceMappingURL=StateMachineBridge.d.ts.map