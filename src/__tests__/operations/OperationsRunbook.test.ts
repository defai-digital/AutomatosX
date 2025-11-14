/**
 * Operations Runbook Tests
 * Sprint 6 Day 53: Operations runbook tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OperationsRunbook,
  createOperationsRunbook,
  getGlobalRunbook,
  resetGlobalRunbook,
  RunbookCategory,
  type RunbookStep,
} from '../../operations/OperationsRunbook.js'

describe('OperationsRunbook', () => {
  let runbook: OperationsRunbook

  beforeEach(() => {
    runbook = createOperationsRunbook()
  })

  describe('Built-in Runbooks', () => {
    it('should have deployment runbook', () => {
      const deployment = runbook.getAllRunbooks().find((r) => r.category === RunbookCategory.DEPLOYMENT)

      expect(deployment).toBeDefined()
      expect(deployment?.title).toContain('Deploy')
    })

    it('should have incident response runbook', () => {
      const incident = runbook.getAllRunbooks().find((r) => r.category === RunbookCategory.INCIDENT_RESPONSE)

      expect(incident).toBeDefined()
      expect(incident?.title).toContain('Sandbox Escape')
    })

    it('should have backup/restore runbook', () => {
      const backup = runbook.getAllRunbooks().find((r) => r.category === RunbookCategory.BACKUP_RESTORE)

      expect(backup).toBeDefined()
      expect(backup?.title).toContain('Backup')
    })

    it('should have monitoring runbook for telemetry alerts', () => {
      const monitoring = runbook
        .getAllRunbooks()
        .find((r) => r.title.includes('Telemetry Dashboard Alerts'))

      expect(monitoring).toBeDefined()
      expect(monitoring?.category).toBe(RunbookCategory.MONITORING)
      expect(monitoring?.steps.length).toBeGreaterThan(0)
    })

    it('should have plugin moderation runbook', () => {
      const moderation = runbook
        .getAllRunbooks()
        .find((r) => r.title.includes('Plugin Moderation'))

      expect(moderation).toBeDefined()
      expect(moderation?.category).toBe(RunbookCategory.INCIDENT_RESPONSE)
      expect(moderation?.steps.length).toBeGreaterThan(0)
    })

    it('should have performance degradation runbook', () => {
      const performance = runbook
        .getAllRunbooks()
        .find((r) => r.title.includes('Performance Degradation'))

      expect(performance).toBeDefined()
      expect(performance?.category).toBe(RunbookCategory.MONITORING)
      expect(performance?.steps.length).toBeGreaterThan(0)
    })

    it('should have full system restore runbook', () => {
      const restore = runbook.getAllRunbooks().find((r) => r.title.includes('Full System Restore'))

      expect(restore).toBeDefined()
      expect(restore?.category).toBe(RunbookCategory.BACKUP_RESTORE)
      expect(restore?.prerequisites).toContain('RTO: 1 hour, RPO: 15 minutes')
    })

    it('should have at least 7 built-in runbooks', () => {
      const allRunbooks = runbook.getAllRunbooks()

      // 3 original + 4 Day 54 runbooks = 7 total
      expect(allRunbooks.length).toBeGreaterThanOrEqual(7)
    })
  })

  describe('Runbook Registration', () => {
    it('should register runbook', () => {
      const listener = vi.fn()
      runbook.on('runbook-registered', listener)

      const steps: RunbookStep[] = [
        {
          number: 1,
          title: 'Step 1',
          description: 'Do something',
          command: 'echo "test"',
        },
      ]

      const registered = runbook.registerRunbook({
        title: 'Test Runbook',
        category: RunbookCategory.MAINTENANCE,
        overview: 'Test overview',
        prerequisites: ['Test prerequisite'],
        steps,
        verification: ['Check result'],
      })

      expect(registered).toMatchObject({
        id: expect.any(String),
        title: 'Test Runbook',
        category: RunbookCategory.MAINTENANCE,
        steps,
        version: '1.0.0',
      })
      expect(listener).toHaveBeenCalled()
    })

    it('should generate ID from title', () => {
      const registered = runbook.registerRunbook({
        title: 'Test Runbook With Spaces',
        category: RunbookCategory.MAINTENANCE,
        overview: 'Test',
        prerequisites: [],
        steps: [],
        verification: [],
      })

      expect(registered.id).toBe('test-runbook-with-spaces')
    })
  })

  describe('Runbook Queries', () => {
    beforeEach(() => {
      runbook.registerRunbook({
        title: 'Maintenance Task',
        category: RunbookCategory.MAINTENANCE,
        overview: 'Test',
        prerequisites: [],
        steps: [],
        verification: [],
      })

      runbook.registerRunbook({
        title: 'Deployment Task',
        category: RunbookCategory.DEPLOYMENT,
        overview: 'Test',
        prerequisites: [],
        steps: [],
        verification: [],
      })
    })

    it('should get runbook by ID', () => {
      const retrieved = runbook.getRunbook('maintenance-task')

      expect(retrieved).toBeDefined()
      expect(retrieved?.title).toBe('Maintenance Task')
    })

    it('should return undefined for non-existent runbook', () => {
      const retrieved = runbook.getRunbook('non-existent')

      expect(retrieved).toBeUndefined()
    })

    it('should get runbooks by category', () => {
      const maintenance = runbook.getRunbooksByCategory(RunbookCategory.MAINTENANCE)

      expect(maintenance.length).toBeGreaterThan(0)
      expect(maintenance.every((r) => r.category === RunbookCategory.MAINTENANCE)).toBe(true)
    })

    it('should get all runbooks', () => {
      const all = runbook.getAllRunbooks()

      // Should include built-in runbooks + registered ones
      expect(all.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Runbook Execution', () => {
    let runbookId: string

    beforeEach(() => {
      const registered = runbook.registerRunbook({
        title: 'Test Execution',
        category: RunbookCategory.MAINTENANCE,
        overview: 'Test',
        prerequisites: [],
        steps: [
          {
            number: 1,
            title: 'Step 1',
            description: 'Do step 1',
          },
          {
            number: 2,
            title: 'Step 2',
            description: 'Do step 2',
          },
        ],
        verification: [],
      })

      runbookId = registered.id
    })

    it('should start execution', () => {
      const listener = vi.fn()
      runbook.on('execution-started', listener)

      const execution = runbook.startExecution(runbookId, 'user1')

      expect(execution).toMatchObject({
        id: expect.stringContaining('exec-'),
        runbookId,
        executedBy: 'user1',
        status: 'in_progress',
        currentStep: 0,
      })
      expect(listener).toHaveBeenCalled()
    })

    it('should throw for non-existent runbook', () => {
      expect(() => runbook.startExecution('non-existent', 'user1')).toThrow('Runbook not found')
    })

    it('should update execution', () => {
      const listener = vi.fn()
      runbook.on('execution-updated', listener)

      const execution = runbook.startExecution(runbookId, 'user1')

      const updated = runbook.updateExecution(execution.id, {
        currentStep: 1,
      })

      expect(updated?.currentStep).toBe(1)
      expect(listener).toHaveBeenCalled()
    })

    it('should complete execution', () => {
      const listener = vi.fn()
      runbook.on('execution-completed', listener)

      const execution = runbook.startExecution(runbookId, 'user1')

      const completed = runbook.completeExecution(execution.id, true)

      expect(completed?.status).toBe('completed')
      expect(completed?.endTime).toBeGreaterThan(0)
      expect(listener).toHaveBeenCalled()
    })

    it('should mark execution as failed', () => {
      const execution = runbook.startExecution(runbookId, 'user1')

      const failed = runbook.completeExecution(execution.id, false)

      expect(failed?.status).toBe('failed')
    })

    it('should get execution', () => {
      const execution = runbook.startExecution(runbookId, 'user1')

      const retrieved = runbook.getExecution(execution.id)

      expect(retrieved).toEqual(execution)
    })

    it('should get executions for runbook', () => {
      runbook.startExecution(runbookId, 'user1')
      runbook.startExecution(runbookId, 'user2')

      const executions = runbook.getExecutionsForRunbook(runbookId)

      expect(executions).toHaveLength(2)
      expect(executions.every((e) => e.runbookId === runbookId)).toBe(true)
    })
  })

  describe('Runbook Search', () => {
    beforeEach(() => {
      runbook.registerRunbook({
        title: 'Database Maintenance',
        category: RunbookCategory.MAINTENANCE,
        overview: 'Maintain database performance',
        prerequisites: [],
        steps: [
          {
            number: 1,
            title: 'Vacuum database',
            description: 'Run VACUUM command on SQLite',
          },
        ],
        verification: [],
      })
    })

    it('should search by title', () => {
      const results = runbook.searchRunbooks('database')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.title.toLowerCase().includes('database'))).toBe(true)
    })

    it('should search by overview', () => {
      const results = runbook.searchRunbooks('performance')

      expect(results.length).toBeGreaterThan(0)
    })

    it('should search by step description', () => {
      const results = runbook.searchRunbooks('vacuum')

      expect(results.length).toBeGreaterThan(0)
    })

    it('should be case-insensitive', () => {
      const results = runbook.searchRunbooks('DATABASE')

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Clear Operations', () => {
    beforeEach(() => {
      runbook.registerRunbook({
        title: 'Test Runbook',
        category: RunbookCategory.MAINTENANCE,
        overview: 'Test',
        prerequisites: [],
        steps: [],
        verification: [],
      })
    })

    it('should clear all runbooks and executions', () => {
      const listener = vi.fn()
      runbook.on('all-cleared', listener)

      runbook.clearAll()

      const allRunbooks = runbook.getAllRunbooks()

      expect(allRunbooks).toHaveLength(0)
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Runbook', () => {
    beforeEach(() => {
      resetGlobalRunbook()
    })

    it('should get global runbook', () => {
      const global = getGlobalRunbook()

      expect(global).toBeInstanceOf(OperationsRunbook)
    })

    it('should return same instance', () => {
      const runbook1 = getGlobalRunbook()
      const runbook2 = getGlobalRunbook()

      expect(runbook1).toBe(runbook2)
    })

    it('should reset global runbook', () => {
      const runbook1 = getGlobalRunbook()

      resetGlobalRunbook()

      const runbook2 = getGlobalRunbook()

      expect(runbook2).not.toBe(runbook1)
    })
  })
})
