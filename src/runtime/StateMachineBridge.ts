/**
 * TypeScript bridge for ReScript StateMachineV2
 *
 * Sprint 3 Day 24: Provides TypeScript interface to ReScript state machine
 */

// Import ReScript compiled module
// Note: This will be available after ReScript compilation
// For now, we'll define the interface and mock for testing

/**
 * State machine states
 */
export type MachineState = 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed'

/**
 * State machine events
 */
export type MachineEvent = 'start' | 'plan' | 'execute' | 'pause' | 'resume' | 'complete' | 'fail'

/**
 * State machine context
 */
export interface MachineContext {
  taskId: string
  agentName: string
  data: Record<string, string>
  history: MachineState[]
}

/**
 * State machine checkpoint
 */
export interface MachineCheckpoint {
  state: MachineState
  context: MachineContext
  timestamp: number
}

/**
 * State machine interface
 */
export interface StateMachine {
  currentState: MachineState
  context: MachineContext
  createdAt: number
  updatedAt: number
}

/**
 * Transition result
 */
export type TransitionResult =
  | { success: true; machine: StateMachine }
  | { success: false; error: string }

/**
 * ReScript state machine bridge
 *
 * Provides a TypeScript-friendly interface to the ReScript state machine implementation.
 */
export class StateMachineBridge {
  private machine: any // ReScript machine instance

  constructor(taskId: string, agentName: string) {
    // This will call the compiled ReScript code
    // For now, we create a mock implementation
    this.machine = this.createMockMachine(taskId, agentName)
  }

  /**
   * Get current state
   */
  getCurrentState(): MachineState {
    // In production, this would call the ReScript function:
    // return StateMachineV2.getCurrentState(this.machine)
    return this.machine.currentState as MachineState
  }

  /**
   * Transition to a new state
   */
  transition(event: MachineEvent, targetState: MachineState): TransitionResult {
    // In production, this would call the ReScript function:
    // const result = StateMachineV2.transition(this.machine, event, targetState)

    if (!this.canTransition(event, targetState)) {
      return {
        success: false,
        error: `Invalid transition: ${this.getCurrentState()} -[${event}]-> ${targetState}`,
      }
    }

    // Update machine state
    this.machine.context.history.push(this.machine.currentState)
    this.machine.currentState = targetState
    this.machine.updatedAt = Date.now()

    return {
      success: true,
      machine: this.toStateMachine(),
    }
  }

  /**
   * Check if transition is valid
   */
  canTransition(event: MachineEvent, targetState: MachineState): boolean {
    // In production, this would call the ReScript function:
    // return StateMachineV2.canTransition(this.machine, event, targetState)

    const currentState = this.getCurrentState()

    // Valid transitions
    const validTransitions: Record<string, Record<string, MachineState>> = {
      idle: { start: 'planning' },
      planning: { plan: 'executing' },
      executing: { pause: 'paused', complete: 'completed', fail: 'failed' },
      paused: { resume: 'executing', fail: 'failed' },
    }

    // Can fail from any state
    if (event === 'fail' && targetState === 'failed') {
      return true
    }

    const allowedTransitions = validTransitions[currentState]
    return allowedTransitions?.[event] === targetState
  }

  /**
   * Set context data
   */
  setContextData(key: string, value: string): void {
    // In production, this would call the ReScript function:
    // this.machine = StateMachineV2.setContextData(this.machine, key, value)

    this.machine.context.data[key] = value
    this.machine.updatedAt = Date.now()
  }

  /**
   * Get context data
   */
  getContextData(key: string): string | undefined {
    // In production, this would call the ReScript function:
    // return StateMachineV2.getContextData(this.machine, key)

    return this.machine.context.data[key]
  }

  /**
   * Get full context
   */
  getContext(): MachineContext {
    return {
      taskId: this.machine.context.taskId,
      agentName: this.machine.context.agentName,
      data: { ...this.machine.context.data },
      history: [...this.machine.context.history],
    }
  }

  /**
   * Create checkpoint for resumable runs
   */
  createCheckpoint(): MachineCheckpoint {
    // In production, this would call the ReScript function:
    // return StateMachineV2.createCheckpoint(this.machine)

    return {
      state: this.getCurrentState(),
      context: this.getContext(),
      timestamp: Date.now(),
    }
  }

  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(checkpoint: MachineCheckpoint): void {
    // In production, this would call the ReScript function:
    // this.machine = StateMachineV2.restoreFromCheckpoint(this.machine, checkpoint)

    this.machine.currentState = checkpoint.state
    this.machine.context = checkpoint.context
    this.machine.updatedAt = Date.now()
  }

  /**
   * Get state machine representation
   */
  toStateMachine(): StateMachine {
    return {
      currentState: this.getCurrentState(),
      context: this.getContext(),
      createdAt: this.machine.createdAt,
      updatedAt: this.machine.updatedAt,
    }
  }

  /**
   * Get state history
   */
  getHistory(): MachineState[] {
    return [...this.machine.context.history]
  }

  /**
   * Check if machine is in terminal state
   */
  isTerminal(): boolean {
    const state = this.getCurrentState()
    return state === 'completed' || state === 'failed'
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.machine.currentState = 'idle'
    this.machine.context.data = {}
    this.machine.context.history = []
    this.machine.updatedAt = Date.now()
  }

  // Private helper methods

  private createMockMachine(taskId: string, agentName: string): any {
    return {
      currentState: 'idle',
      context: {
        taskId,
        agentName,
        data: {},
        history: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }
}

/**
 * Factory function to create state machine
 */
export function createStateMachine(taskId: string, agentName: string): StateMachineBridge {
  return new StateMachineBridge(taskId, agentName)
}

/**
 * Workflow orchestrator using state machine
 */
export class WorkflowOrchestrator {
  private machines: Map<string, StateMachineBridge>

  constructor() {
    this.machines = new Map()
  }

  /**
   * Create new workflow
   */
  createWorkflow(taskId: string, agentName: string): StateMachineBridge {
    const machine = createStateMachine(taskId, agentName)
    this.machines.set(taskId, machine)
    return machine
  }

  /**
   * Get workflow by task ID
   */
  getWorkflow(taskId: string): StateMachineBridge | undefined {
    return this.machines.get(taskId)
  }

  /**
   * Delete workflow
   */
  deleteWorkflow(taskId: string): boolean {
    return this.machines.delete(taskId)
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): StateMachineBridge[] {
    return Array.from(this.machines.values())
  }

  /**
   * Get active workflows (not in terminal state)
   */
  getActiveWorkflows(): StateMachineBridge[] {
    return this.getAllWorkflows().filter(machine => !machine.isTerminal())
  }

  /**
   * Get completed workflows
   */
  getCompletedWorkflows(): StateMachineBridge[] {
    return this.getAllWorkflows().filter(
      machine => machine.getCurrentState() === 'completed'
    )
  }

  /**
   * Get failed workflows
   */
  getFailedWorkflows(): StateMachineBridge[] {
    return this.getAllWorkflows().filter(
      machine => machine.getCurrentState() === 'failed'
    )
  }

  /**
   * Create checkpoint for all workflows
   */
  createCheckpointAll(): Map<string, MachineCheckpoint> {
    const checkpoints = new Map<string, MachineCheckpoint>()

    for (const [taskId, machine] of this.machines.entries()) {
      checkpoints.set(taskId, machine.createCheckpoint())
    }

    return checkpoints
  }

  /**
   * Restore all workflows from checkpoints
   */
  restoreFromCheckpoints(checkpoints: Map<string, MachineCheckpoint>): void {
    for (const [taskId, checkpoint] of checkpoints.entries()) {
      const machine = this.machines.get(taskId)
      if (machine) {
        machine.restoreFromCheckpoint(checkpoint)
      }
    }
  }
}
