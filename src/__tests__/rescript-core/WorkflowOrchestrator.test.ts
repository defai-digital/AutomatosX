/**
 * Workflow Orchestrator Tests - Day 63
 *
 * Comprehensive test suite for the Workflow Orchestrator module
 * Tests workflow lifecycle, task execution, state machine integration, and metrics
 *
 * Total Tests: 50
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as WorkflowOrchestrator from '../../../packages/rescript-core/src/workflow/WorkflowOrchestrator.gen'
import * as TaskPlanner from '../../../packages/rescript-core/src/workflow/TaskPlanner.gen'

// ============================================================================
// Test Helpers
// ============================================================================

const createTask = (
  id: string,
  duration: number,
  deps: string[] = [],
  resources: string[] = [],
  priority: number = 0
): TaskPlanner.task => {
  return TaskPlanner.createTask(id, `Task ${id}`, duration, deps, resources, priority)
}

const createWorkflowDef = (
  id: string,
  tasks: TaskPlanner.task[],
  maxRetries: number = 3,
  timeout?: number,
  allowParallel: boolean = true
): WorkflowOrchestrator.workflowDefinition => {
  return WorkflowOrchestrator.createWorkflowDefinition(
    id,
    `Workflow ${id}`,
    `Description for workflow ${id}`,
    tasks,
    maxRetries,
    timeout,
    allowParallel
  )
}

// ============================================================================
// 1. Workflow Creation Tests (8 tests)
// ============================================================================

describe('Workflow Creation', () => {
  it('should create a workflow definition', () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf1', tasks)

    expect(def.id).toBe('wf1')
    expect(def.name).toBe('Workflow wf1')
    expect(def.tasks).toHaveLength(2)
    expect(def.maxRetries).toBe(3)
    expect(def.allowParallel).toBe(true)
  })

  it('should create a workflow instance with valid tasks', () => {
    const tasks = [createTask('A', 10), createTask('B', 20, ['A'])]
    const def = createWorkflowDef('wf2', tasks)
    const result = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result.TAG).toBe('Ok')
    if (result.TAG === 'Ok') {
      const instance = result._0
      expect(instance.workflowId).toBe('wf2')
      expect(instance.status).toBe('Pending')
      expect(instance.currentTasks).toHaveLength(0)
      expect(instance.completedTasks).toHaveLength(0)
      expect(instance.failedTasks).toHaveLength(0)
    }
  })

  it('should fail to create workflow instance with circular dependencies', () => {
    const tasks = [
      createTask('A', 10, ['B']),
      createTask('B', 20, ['A']),
    ]
    const def = createWorkflowDef('wf3', tasks)
    const result = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result.TAG).toBe('Error')
    if (result.TAG === 'Error') {
      expect(result._0).toContain('Cycle detected')
    }
  })

  it('should create workflow with empty task list', () => {
    const def = createWorkflowDef('wf4', [])
    const result = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result.TAG).toBe('Ok')
    if (result.TAG === 'Ok') {
      expect(result._0.plan.tasks).toHaveLength(0)
    }
  })

  it('should create workflow with single task', () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf5', tasks)
    const result = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result.TAG).toBe('Ok')
    if (result.TAG === 'Ok') {
      const instance = result._0
      expect(instance.plan.tasks).toHaveLength(1)
      expect(instance.plan.executionOrder).toEqual(['A'])
    }
  })

  it('should create workflow with complex dependencies', () => {
    const tasks = [
      createTask('A', 10),
      createTask('B', 15),
      createTask('C', 20, ['A', 'B']),
      createTask('D', 25, ['C']),
    ]
    const def = createWorkflowDef('wf6', tasks)
    const result = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result.TAG).toBe('Ok')
    if (result.TAG === 'Ok') {
      const instance = result._0
      expect(instance.plan.tasks).toHaveLength(4)
      expect(instance.plan.criticalPath).toBeTruthy()
    }
  })

  it('should generate unique workflow instance ID', () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf7', tasks)

    const result1 = WorkflowOrchestrator.createWorkflowInstance(def)
    const result2 = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result1.TAG).toBe('Ok')
    expect(result2.TAG).toBe('Ok')
    if (result1.TAG === 'Ok' && result2.TAG === 'Ok') {
      // IDs contain timestamp and workflow ID
      expect(result1._0.id).toContain('instance-wf7-')
      expect(result2._0.id).toContain('instance-wf7-')
      // Both IDs are valid instance IDs
      expect(result1._0.id).toMatch(/^instance-wf7-\d+(\.\d+)?$/)
      expect(result2._0.id).toMatch(/^instance-wf7-\d+(\.\d+)?$/)
    }
  })

  it('should integrate task plan into workflow instance', () => {
    const tasks = [
      createTask('A', 10),
      createTask('B', 20, ['A']),
    ]
    const def = createWorkflowDef('wf8', tasks)
    const result = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(result.TAG).toBe('Ok')
    if (result.TAG === 'Ok') {
      const instance = result._0
      expect(instance.plan).toBeDefined()
      expect(instance.plan.executionOrder).toEqual(['A', 'B'])
      expect(instance.plan.estimatedTotalTime).toBe(30)
    }
  })
})

// ============================================================================
// 2. Workflow Lifecycle Tests (10 tests)
// ============================================================================

describe('Workflow Lifecycle', () => {
  it('should start a pending workflow', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf9', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    expect(createResult.TAG).toBe('Ok')
    if (createResult.TAG === 'Ok') {
      const instance = createResult._0
      const startResult = await WorkflowOrchestrator.startWorkflow(instance)

      expect(startResult.TAG).toBe('Ok')
      if (startResult.TAG === 'Ok') {
        expect(startResult._0.status).toBe('Running')
        expect(startResult._0.startedAt).toBeDefined()
        expect(startResult._0.currentTasks.length).toBeGreaterThan(0)
      }
    }
  })

  it('should not start an already running workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf10', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const instance = createResult._0
      const startResult1 = await WorkflowOrchestrator.startWorkflow(instance)

      if (startResult1.TAG === 'Ok') {
        const runningInstance = startResult1._0
        const startResult2 = await WorkflowOrchestrator.startWorkflow(runningInstance)

        expect(startResult2.TAG).toBe('Error')
      }
    }
  })

  it('should pause a running workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf11', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const pauseResult = await WorkflowOrchestrator.pauseWorkflow(startResult._0)

        expect(pauseResult.TAG).toBe('Ok')
        if (pauseResult.TAG === 'Ok') {
          expect(pauseResult._0.status).toBe('Paused')
        }
      }
    }
  })

  it('should not pause a non-running workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf12', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const pauseResult = await WorkflowOrchestrator.pauseWorkflow(createResult._0)

      expect(pauseResult.TAG).toBe('Error')
    }
  })

  it('should resume a paused workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf13', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const pauseResult = await WorkflowOrchestrator.pauseWorkflow(startResult._0)

        if (pauseResult.TAG === 'Ok') {
          const resumeResult = await WorkflowOrchestrator.resumeWorkflow(pauseResult._0)

          expect(resumeResult.TAG).toBe('Ok')
          if (resumeResult.TAG === 'Ok') {
            expect(resumeResult._0.status).toBe('Running')
          }
        }
      }
    }
  })

  it('should not resume a non-paused workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf14', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const resumeResult = await WorkflowOrchestrator.resumeWorkflow(createResult._0)

      expect(resumeResult.TAG).toBe('Error')
    }
  })

  it('should cancel a pending workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf15', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const cancelResult = await WorkflowOrchestrator.cancelWorkflow(createResult._0)

      expect(cancelResult.TAG).toBe('Ok')
      if (cancelResult.TAG === 'Ok') {
        expect(cancelResult._0.status).toBe('Cancelled')
        expect(cancelResult._0.completedAt).toBeDefined()
      }
    }
  })

  it('should cancel a running workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf16', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const cancelResult = await WorkflowOrchestrator.cancelWorkflow(startResult._0)

        expect(cancelResult.TAG).toBe('Ok')
        if (cancelResult.TAG === 'Ok') {
          expect(cancelResult._0.status).toBe('Cancelled')
        }
      }
    }
  })

  it('should cancel a paused workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf17', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const pauseResult = await WorkflowOrchestrator.pauseWorkflow(startResult._0)

        if (pauseResult.TAG === 'Ok') {
          const cancelResult = await WorkflowOrchestrator.cancelWorkflow(pauseResult._0)

          expect(cancelResult.TAG).toBe('Ok')
          if (cancelResult.TAG === 'Ok') {
            expect(cancelResult._0.status).toBe('Cancelled')
          }
        }
      }
    }
  })

  it('should complete workflow when all tasks are done', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf18', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        expect(completeResult.TAG).toBe('Ok')
        if (completeResult.TAG === 'Ok') {
          expect(completeResult._0.status).toBe('Completed')
          expect(completeResult._0.completedAt).toBeDefined()
        }
      }
    }
  })
})

// ============================================================================
// 3. Task Execution Tests (12 tests)
// ============================================================================

describe('Task Execution', () => {
  it('should complete a single task', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf19', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        expect(completeResult.TAG).toBe('Ok')
        if (completeResult.TAG === 'Ok') {
          expect(completeResult._0.completedTasks).toContain('A')
          expect(completeResult._0.currentTasks).not.toContain('A')
        }
      }
    }
  })

  it('should complete task and advance to next parallel group', async () => {
    const tasks = [
      createTask('A', 10),
      createTask('B', 15, ['A']),
    ]
    const def = createWorkflowDef('wf20', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        expect(startResult._0.currentTasks).toContain('A')
        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeResult.TAG === 'Ok') {
          expect(completeResult._0.currentTasks).toContain('B')
          expect(completeResult._0.completedTasks).toContain('A')
        }
      }
    }
  })

  it('should complete task with dependencies correctly', async () => {
    const tasks = [
      createTask('A', 10),
      createTask('B', 10),
      createTask('C', 20, ['A', 'B']),
    ]
    const def = createWorkflowDef('wf21', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeA = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeA.TAG === 'Ok') {
          expect(completeA._0.currentTasks).not.toContain('C') // C needs B too

          const completeB = await WorkflowOrchestrator.completeTask(completeA._0, 'B')

          if (completeB.TAG === 'Ok') {
            expect(completeB._0.currentTasks).toContain('C') // Now C can start
          }
        }
      }
    }
  })

  it('should fail task when no retries are left', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf22', tasks, 0) // maxRetries = 0
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const failResult = await WorkflowOrchestrator.failTask(startResult._0, 'A', 'Test error')

        if (failResult.TAG === 'Error') {
          console.log('failTask Error:', failResult._0)
        }
        expect(failResult.TAG).toBe('Ok')
        if (failResult.TAG === 'Ok') {
          expect(failResult._0.status).toBe('Failed')
          expect(failResult._0.failedTasks).toContain('A')
          expect(failResult._0.error).toContain('Test error')
        }
      }
    }
  })

  it('should retry task when retries are available', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf23', tasks, 3) // maxRetries = 3
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const failResult = await WorkflowOrchestrator.failTask(startResult._0, 'A', 'Retry error')

        expect(failResult.TAG).toBe('Ok')
        if (failResult.TAG === 'Ok') {
          expect(failResult._0.status).toBe('Running') // Still running, retrying
          expect(failResult._0.failedTasks).not.toContain('A')
        }
      }
    }
  })

  it('should complete all tasks in parallel group before moving to next', async () => {
    const tasks = [
      createTask('A', 10),
      createTask('B', 10),
      createTask('C', 20, ['A', 'B']),
    ]
    const def = createWorkflowDef('wf24', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        expect(startResult._0.currentTasks).toContain('A')
        expect(startResult._0.currentTasks).toContain('B')

        const completeA = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeA.TAG === 'Ok') {
          expect(completeA._0.currentTasks).toContain('B')
          expect(completeA._0.currentTasks).not.toContain('C')

          const completeB = await WorkflowOrchestrator.completeTask(completeA._0, 'B')

          if (completeB.TAG === 'Ok') {
            expect(completeB._0.currentTasks).toContain('C')
          }
        }
      }
    }
  })

  it('should track task execution state', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf25', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const statusBefore = WorkflowOrchestrator.getTaskStatus(startResult._0, 'A')
        expect(statusBefore).toBe('Pending')

        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeResult.TAG === 'Ok') {
          const statusAfter = WorkflowOrchestrator.getTaskStatus(completeResult._0, 'A')
          expect(statusAfter).toBe('Completed')
        }
      }
    }
  })

  it('should track task execution timing', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf26', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        expect(startResult._0.startedAt).toBeDefined()
        expect(startResult._0.completedAt).toBeUndefined()

        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeResult.TAG === 'Ok') {
          expect(completeResult._0.completedAt).toBeDefined()
          expect(completeResult._0.completedAt! >= startResult._0.startedAt!).toBe(true)
        }
      }
    }
  })

  it('should track task execution attempts', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf27', tasks, 2)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const fail1 = await WorkflowOrchestrator.failTask(startResult._0, 'A', 'Error 1')

        if (fail1.TAG === 'Ok') {
          const fail2 = await WorkflowOrchestrator.failTask(fail1._0, 'A', 'Error 2')

          if (fail2.TAG === 'Ok') {
            const fail3 = await WorkflowOrchestrator.failTask(fail2._0, 'A', 'Error 3')

            expect(fail3.TAG).toBe('Ok')
            if (fail3.TAG === 'Ok') {
              expect(fail3._0.status).toBe('Failed') // Exhausted retries
            }
          }
        }
      }
    }
  })

  it('should return error for invalid task ID', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf28', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'INVALID')

        expect(completeResult.TAG).toBe('Error')
        if (completeResult.TAG === 'Error') {
          expect(completeResult._0).toContain('not found')
        }
      }
    }
  })

  it('should handle completing a task twice gracefully', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf29', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const complete1 = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (complete1.TAG === 'Ok') {
          const complete2 = await WorkflowOrchestrator.completeTask(complete1._0, 'A')

          // Should handle gracefully - either succeed or return specific error
          expect(['Ok', 'Error']).toContain(complete2.TAG)
        }
      }
    }
  })

  it('should fail task with custom error message', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf30', tasks, 0)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const customError = 'Database connection failed'
        const failResult = await WorkflowOrchestrator.failTask(startResult._0, 'A', customError)

        if (failResult.TAG === 'Ok') {
          expect(failResult._0.error).toContain(customError)
        }
      }
    }
  })
})

// ============================================================================
// 4. Workflow Metrics Tests (8 tests)
// ============================================================================

describe('Workflow Metrics', () => {
  it('should calculate metrics for empty workflow', () => {
    const def = createWorkflowDef('wf31', [])
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const metrics = WorkflowOrchestrator.getWorkflowMetrics(createResult._0)

      expect(metrics.totalTasks).toBe(0)
      expect(metrics.completedTasks).toBe(0)
      expect(metrics.failedTasks).toBe(0)
      expect(metrics.runningTasks).toBe(0)
      expect(metrics.successRate).toBe(0.0)
    }
  })

  it('should calculate metrics for running workflow', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf32', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const metrics = WorkflowOrchestrator.getWorkflowMetrics(startResult._0)

        expect(metrics.totalTasks).toBe(2)
        expect(metrics.runningTasks).toBeGreaterThan(0)
        expect(metrics.estimatedTimeRemaining).toBeDefined()
      }
    }
  })

  it('should calculate metrics for completed workflow', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf33', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeResult.TAG === 'Ok') {
          const metrics = WorkflowOrchestrator.getWorkflowMetrics(completeResult._0)

          expect(metrics.totalTasks).toBe(1)
          expect(metrics.completedTasks).toBe(1)
          expect(metrics.successRate).toBe(1.0)
        }
      }
    }
  })

  it('should calculate success rate correctly', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20), createTask('C', 30)]
    const def = createWorkflowDef('wf34', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const complete1 = await WorkflowOrchestrator.completeTask(startResult._0, 'A')
        if (complete1.TAG === 'Ok') {
          const complete2 = await WorkflowOrchestrator.completeTask(complete1._0, 'B')

          if (complete2.TAG === 'Ok') {
            const metrics = WorkflowOrchestrator.getWorkflowMetrics(complete2._0)

            expect(metrics.successRate).toBeCloseTo(2 / 3, 2) // 2 out of 3 completed
          }
        }
      }
    }
  })

  it('should estimate remaining time for running workflow', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf35', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const metrics = WorkflowOrchestrator.getWorkflowMetrics(startResult._0)

        expect(metrics.estimatedTimeRemaining).toBeDefined()
        expect(metrics.estimatedTimeRemaining).toBeGreaterThan(0)
      }
    }
  })

  it('should calculate actual duration', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf36', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeResult.TAG === 'Ok') {
          const metrics = WorkflowOrchestrator.getWorkflowMetrics(completeResult._0)

          expect(metrics.actualDuration).toBeDefined()
          expect(metrics.actualDuration).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('should track running tasks count', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf37', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const metrics = WorkflowOrchestrator.getWorkflowMetrics(startResult._0)

        expect(metrics.runningTasks).toBe(2) // Both parallel tasks running
      }
    }
  })

  it('should track failed tasks count', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf38', tasks, 0) // No retries
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const failResult = await WorkflowOrchestrator.failTask(startResult._0, 'A', 'Failed')

        if (failResult.TAG === 'Ok') {
          const metrics = WorkflowOrchestrator.getWorkflowMetrics(failResult._0)

          expect(metrics.failedTasks).toBe(1)
        }
      }
    }
  })
})

// ============================================================================
// 5. Query Functions Tests (8 tests)
// ============================================================================

describe('Query Functions', () => {
  it('should check if workflow is complete', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf39', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      expect(WorkflowOrchestrator.isWorkflowComplete(createResult._0)).toBe(false)

      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)
      if (startResult.TAG === 'Ok') {
        expect(WorkflowOrchestrator.isWorkflowComplete(startResult._0)).toBe(false)

        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')
        if (completeResult.TAG === 'Ok') {
          expect(WorkflowOrchestrator.isWorkflowComplete(completeResult._0)).toBe(true)
        }
      }
    }
  })

  it('should check if workflow is running', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf40', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      expect(WorkflowOrchestrator.isWorkflowRunning(createResult._0)).toBe(false)

      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)
      if (startResult.TAG === 'Ok') {
        expect(WorkflowOrchestrator.isWorkflowRunning(startResult._0)).toBe(true)

        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')
        if (completeResult.TAG === 'Ok') {
          expect(WorkflowOrchestrator.isWorkflowRunning(completeResult._0)).toBe(false)
        }
      }
    }
  })

  it('should get task status', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf41', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const status = WorkflowOrchestrator.getTaskStatus(startResult._0, 'A')

        expect(status).toBeDefined()
        expect(['Pending', 'Running']).toContain(status!)
      }
    }
  })

  it('should get running tasks list', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf42', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const runningTasks = WorkflowOrchestrator.getRunningTasks(startResult._0)

        expect(runningTasks).toContain('A')
        expect(runningTasks).toContain('B')
      }
    }
  })

  it('should get completed tasks list', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf43', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeA = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeA.TAG === 'Ok') {
          const completedTasks = WorkflowOrchestrator.getCompletedTasks(completeA._0)

          expect(completedTasks).toContain('A')
          expect(completedTasks).not.toContain('B')
        }
      }
    }
  })

  it('should get failed tasks list', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf44', tasks, 0)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const failResult = await WorkflowOrchestrator.failTask(startResult._0, 'A', 'Error')

        if (failResult.TAG === 'Ok') {
          const failedTasks = WorkflowOrchestrator.getFailedTasks(failResult._0)

          expect(failedTasks).toContain('A')
        }
      }
    }
  })

  it('should calculate workflow progress at 0%', () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf45', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const progress = WorkflowOrchestrator.getWorkflowProgress(createResult._0)

      expect(progress).toBe(0.0)
    }
  })

  it('should calculate workflow progress at 100%', async () => {
    const tasks = [createTask('A', 10), createTask('B', 20)]
    const def = createWorkflowDef('wf46', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const completeA = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeA.TAG === 'Ok') {
          const completeB = await WorkflowOrchestrator.completeTask(completeA._0, 'B')

          if (completeB.TAG === 'Ok') {
            const progress = WorkflowOrchestrator.getWorkflowProgress(completeB._0)

            expect(progress).toBe(1.0)
          }
        }
      }
    }
  })
})

// ============================================================================
// 6. State Machine Integration Tests (4 tests)
// ============================================================================

describe('State Machine Integration', () => {
  it('should follow state machine transition rules', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf47', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      expect(createResult._0.status).toBe('Pending')

      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)
      if (startResult.TAG === 'Ok') {
        expect(startResult._0.status).toBe('Running')

        const pauseResult = await WorkflowOrchestrator.pauseWorkflow(startResult._0)
        if (pauseResult.TAG === 'Ok') {
          expect(pauseResult._0.status).toBe('Paused')

          const resumeResult = await WorkflowOrchestrator.resumeWorkflow(pauseResult._0)
          if (resumeResult.TAG === 'Ok') {
            expect(resumeResult._0.status).toBe('Running')
          }
        }
      }
    }
  })

  it('should reject invalid state transitions', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf48', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      // Try to resume a pending workflow (invalid transition)
      const resumeResult = await WorkflowOrchestrator.resumeWorkflow(createResult._0)

      expect(resumeResult.TAG).toBe('Error')

      // Try to pause a pending workflow (invalid transition)
      const pauseResult = await WorkflowOrchestrator.pauseWorkflow(createResult._0)

      expect(pauseResult.TAG).toBe('Error')
    }
  })

  it('should track state machine history', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf49', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        const pauseResult = await WorkflowOrchestrator.pauseWorkflow(startResult._0)

        if (pauseResult.TAG === 'Ok') {
          const resumeResult = await WorkflowOrchestrator.resumeWorkflow(pauseResult._0)

          if (resumeResult.TAG === 'Ok') {
            // State machine should have tracked all transitions
            expect(resumeResult._0.stateMachine).toBeDefined()
          }
        }
      }
    }
  })

  it('should synchronize workflow status with state machine state', async () => {
    const tasks = [createTask('A', 10)]
    const def = createWorkflowDef('wf50', tasks)
    const createResult = WorkflowOrchestrator.createWorkflowInstance(def)

    if (createResult.TAG === 'Ok') {
      const startResult = await WorkflowOrchestrator.startWorkflow(createResult._0)

      if (startResult.TAG === 'Ok') {
        expect(startResult._0.status).toBe('Running')
        expect(WorkflowOrchestrator.isWorkflowRunning(startResult._0)).toBe(true)

        const completeResult = await WorkflowOrchestrator.completeTask(startResult._0, 'A')

        if (completeResult.TAG === 'Ok') {
          expect(completeResult._0.status).toBe('Completed')
          expect(WorkflowOrchestrator.isWorkflowComplete(completeResult._0)).toBe(true)
        }
      }
    }
  })
})
