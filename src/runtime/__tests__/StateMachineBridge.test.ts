/**
 * Tests for StateMachineBridge
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  StateMachineBridge,
  createStateMachine,
  WorkflowOrchestrator,
  type MachineState,
  type MachineEvent,
} from '../StateMachineBridge.js'

describe('StateMachineBridge', () => {
  let machine: StateMachineBridge

  beforeEach(() => {
    machine = createStateMachine('task-123', 'backend')
  })

  describe('initialization', () => {
    it('should create machine in idle state', () => {
      expect(machine.getCurrentState()).toBe('idle')
    })

    it('should initialize with correct context', () => {
      const context = machine.getContext()
      expect(context.taskId).toBe('task-123')
      expect(context.agentName).toBe('backend')
      expect(context.data).toEqual({})
      expect(context.history).toEqual([])
    })

    it('should set creation timestamp', () => {
      const stateMachine = machine.toStateMachine()
      expect(stateMachine.createdAt).toBeGreaterThan(0)
      expect(stateMachine.updatedAt).toBeGreaterThan(0)
    })
  })

  describe('state transitions', () => {
    it('should transition from idle to planning', () => {
      const result = machine.transition('start', 'planning')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.machine.currentState).toBe('planning')
      }
      expect(machine.getCurrentState()).toBe('planning')
    })

    it('should transition from planning to executing', () => {
      machine.transition('start', 'planning')
      const result = machine.transition('plan', 'executing')

      expect(result.success).toBe(true)
      expect(machine.getCurrentState()).toBe('executing')
    })

    it('should transition from executing to paused', () => {
      machine.transition('start', 'planning')
      machine.transition('plan', 'executing')
      const result = machine.transition('pause', 'paused')

      expect(result.success).toBe(true)
      expect(machine.getCurrentState()).toBe('paused')
    })

    it('should transition from paused to executing (resume)', () => {
      machine.transition('start', 'planning')
      machine.transition('plan', 'executing')
      machine.transition('pause', 'paused')
      const result = machine.transition('resume', 'executing')

      expect(result.success).toBe(true)
      expect(machine.getCurrentState()).toBe('executing')
    })

    it('should transition from executing to completed', () => {
      machine.transition('start', 'planning')
      machine.transition('plan', 'executing')
      const result = machine.transition('complete', 'completed')

      expect(result.success).toBe(true)
      expect(machine.getCurrentState()).toBe('completed')
    })

    it('should allow fail transition from any state', () => {
      machine.transition('start', 'planning')
      const result = machine.transition('fail', 'failed')

      expect(result.success).toBe(true)
      expect(machine.getCurrentState()).toBe('failed')
    })

    it('should reject invalid transitions', () => {
      const result = machine.transition('plan', 'executing')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid transition')
      }
      expect(machine.getCurrentState()).toBe('idle') // State should not change
    })

    it('should track state history', () => {
      machine.transition('start', 'planning')
      machine.transition('plan', 'executing')
      machine.transition('pause', 'paused')

      const history = machine.getHistory()
      expect(history).toEqual(['idle', 'planning', 'executing'])
    })
  })

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(machine.canTransition('start', 'planning')).toBe(true)
    })

    it('should return false for invalid transitions', () => {
      expect(machine.canTransition('plan', 'executing')).toBe(false)
    })

    it('should allow fail from any state', () => {
      expect(machine.canTransition('fail', 'failed')).toBe(true)

      machine.transition('start', 'planning')
      expect(machine.canTransition('fail', 'failed')).toBe(true)
    })
  })

  describe('context management', () => {
    it('should set context data', () => {
      machine.setContextData('taskType', 'api-implementation')
      expect(machine.getContextData('taskType')).toBe('api-implementation')
    })

    it('should get undefined for missing data', () => {
      expect(machine.getContextData('nonexistent')).toBeUndefined()
    })

    it('should update multiple context values', () => {
      machine.setContextData('key1', 'value1')
      machine.setContextData('key2', 'value2')

      expect(machine.getContextData('key1')).toBe('value1')
      expect(machine.getContextData('key2')).toBe('value2')
    })

    it('should get full context', () => {
      machine.setContextData('key1', 'value1')
      const context = machine.getContext()

      expect(context.taskId).toBe('task-123')
      expect(context.agentName).toBe('backend')
      expect(context.data).toEqual({ key1: 'value1' })
    })
  })

  describe('checkpoints', () => {
    it('should create checkpoint', () => {
      machine.transition('start', 'planning')
      machine.setContextData('progress', '50')

      const checkpoint = machine.createCheckpoint()

      expect(checkpoint.state).toBe('planning')
      expect(checkpoint.context.data.progress).toBe('50')
      expect(checkpoint.timestamp).toBeGreaterThan(0)
    })

    it('should restore from checkpoint', () => {
      machine.transition('start', 'planning')
      machine.setContextData('progress', '50')
      const checkpoint = machine.createCheckpoint()

      // Modify state
      machine.transition('plan', 'executing')
      machine.setContextData('progress', '75')

      // Restore
      machine.restoreFromCheckpoint(checkpoint)

      expect(machine.getCurrentState()).toBe('planning')
      expect(machine.getContextData('progress')).toBe('50')
    })

    it('should preserve checkpoint data', () => {
      machine.transition('start', 'planning')
      const checkpoint1 = machine.createCheckpoint()

      machine.transition('plan', 'executing')
      const checkpoint2 = machine.createCheckpoint()

      expect(checkpoint1.state).toBe('planning')
      expect(checkpoint2.state).toBe('executing')
    })
  })

  describe('terminal states', () => {
    it('should identify completed as terminal', () => {
      machine.transition('start', 'planning')
      machine.transition('plan', 'executing')
      machine.transition('complete', 'completed')

      expect(machine.isTerminal()).toBe(true)
    })

    it('should identify failed as terminal', () => {
      machine.transition('fail', 'failed')

      expect(machine.isTerminal()).toBe(true)
    })

    it('should identify non-terminal states', () => {
      expect(machine.isTerminal()).toBe(false)

      machine.transition('start', 'planning')
      expect(machine.isTerminal()).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset to idle state', () => {
      machine.transition('start', 'planning')
      machine.setContextData('key', 'value')

      machine.reset()

      expect(machine.getCurrentState()).toBe('idle')
      expect(machine.getContextData('key')).toBeUndefined()
      expect(machine.getHistory()).toEqual([])
    })
  })
})

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator()
  })

  describe('workflow management', () => {
    it('should create workflow', () => {
      const machine = orchestrator.createWorkflow('task-1', 'backend')

      expect(machine).toBeDefined()
      expect(machine.getCurrentState()).toBe('idle')
    })

    it('should get workflow by ID', () => {
      orchestrator.createWorkflow('task-1', 'backend')
      const machine = orchestrator.getWorkflow('task-1')

      expect(machine).toBeDefined()
      expect(machine?.getContext().taskId).toBe('task-1')
    })

    it('should return undefined for non-existent workflow', () => {
      const machine = orchestrator.getWorkflow('non-existent')

      expect(machine).toBeUndefined()
    })

    it('should delete workflow', () => {
      orchestrator.createWorkflow('task-1', 'backend')
      const deleted = orchestrator.deleteWorkflow('task-1')

      expect(deleted).toBe(true)
      expect(orchestrator.getWorkflow('task-1')).toBeUndefined()
    })

    it('should get all workflows', () => {
      orchestrator.createWorkflow('task-1', 'backend')
      orchestrator.createWorkflow('task-2', 'frontend')
      orchestrator.createWorkflow('task-3', 'devops')

      const workflows = orchestrator.getAllWorkflows()

      expect(workflows).toHaveLength(3)
    })
  })

  describe('workflow filtering', () => {
    beforeEach(() => {
      const machine1 = orchestrator.createWorkflow('task-1', 'backend')
      machine1.transition('start', 'planning')
      machine1.transition('plan', 'executing')

      const machine2 = orchestrator.createWorkflow('task-2', 'frontend')
      machine2.transition('start', 'planning')
      machine2.transition('plan', 'executing')
      machine2.transition('complete', 'completed')

      const machine3 = orchestrator.createWorkflow('task-3', 'devops')
      machine3.transition('fail', 'failed')
    })

    it('should get active workflows', () => {
      const active = orchestrator.getActiveWorkflows()

      expect(active).toHaveLength(1)
      expect(active[0].getContext().taskId).toBe('task-1')
    })

    it('should get completed workflows', () => {
      const completed = orchestrator.getCompletedWorkflows()

      expect(completed).toHaveLength(1)
      expect(completed[0].getContext().taskId).toBe('task-2')
    })

    it('should get failed workflows', () => {
      const failed = orchestrator.getFailedWorkflows()

      expect(failed).toHaveLength(1)
      expect(failed[0].getContext().taskId).toBe('task-3')
    })
  })

  describe('bulk checkpoints', () => {
    beforeEach(() => {
      const machine1 = orchestrator.createWorkflow('task-1', 'backend')
      machine1.transition('start', 'planning')

      const machine2 = orchestrator.createWorkflow('task-2', 'frontend')
      machine2.transition('start', 'planning')
      machine2.transition('plan', 'executing')
    })

    it('should create checkpoints for all workflows', () => {
      const checkpoints = orchestrator.createCheckpointAll()

      expect(checkpoints.size).toBe(2)
      expect(checkpoints.get('task-1')?.state).toBe('planning')
      expect(checkpoints.get('task-2')?.state).toBe('executing')
    })

    it('should restore all workflows from checkpoints', () => {
      const checkpoints = orchestrator.createCheckpointAll()

      // Modify workflows
      orchestrator.getWorkflow('task-1')?.transition('plan', 'executing')
      orchestrator.getWorkflow('task-2')?.transition('complete', 'completed')

      // Restore
      orchestrator.restoreFromCheckpoints(checkpoints)

      expect(orchestrator.getWorkflow('task-1')?.getCurrentState()).toBe('planning')
      expect(orchestrator.getWorkflow('task-2')?.getCurrentState()).toBe('executing')
    })
  })
})
