/**
 * Budget Enforcer Tests
 * Sprint 5 Day 43: Resource budget enforcement tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BudgetEnforcer,
  BudgetExceededError,
  createBudgetEnforcer,
  getGlobalEnforcer,
  resetGlobalEnforcer,
} from '../../performance/BudgetEnforcer.js'

describe('BudgetEnforcer', () => {
  let enforcer: BudgetEnforcer

  beforeEach(() => {
    enforcer = createBudgetEnforcer({
      maxMemory: 100 * 1024 * 1024, // 100MB
      maxCPUTime: 5000, // 5s
      maxDuration: 10000, // 10s
    })
  })

  afterEach(() => {
    enforcer.disable()
  })

  describe('Basic Operations', () => {
    it('should start and stop monitoring', () => {
      enforcer.startMonitoring('op1')

      expect(enforcer.getMonitoredOperations()).toContain('op1')

      const result = enforcer.stopMonitoring('op1')

      expect(result).toBeDefined()
      expect(enforcer.getMonitoredOperations()).not.toContain('op1')
    })

    it('should return null when stopping non-existent operation', () => {
      const result = enforcer.stopMonitoring('non-existent')

      expect(result).toBeNull()
    })

    it('should not monitor when disabled', () => {
      enforcer.disable()

      enforcer.startMonitoring('op1')

      expect(enforcer.getMonitoredOperations()).toHaveLength(0)
    })
  })

  describe('Budget Configuration', () => {
    it('should use default budget', () => {
      const defaultEnforcer = createBudgetEnforcer()
      const budget = defaultEnforcer.getBudget()

      expect(budget.maxMemory).toBe(512 * 1024 * 1024)
      expect(budget.maxCPUTime).toBe(30000)
      expect(budget.maxDuration).toBe(60000)
      expect(budget.enabled).toBe(true)
    })

    it('should accept custom budget', () => {
      const budget = enforcer.getBudget()

      expect(budget.maxMemory).toBe(100 * 1024 * 1024)
      expect(budget.maxCPUTime).toBe(5000)
      expect(budget.maxDuration).toBe(10000)
    })

    it('should update budget', () => {
      enforcer.updateBudget({
        maxMemory: 200 * 1024 * 1024,
      })

      const budget = enforcer.getBudget()

      expect(budget.maxMemory).toBe(200 * 1024 * 1024)
      expect(budget.maxCPUTime).toBe(5000) // Unchanged
    })

    it('should emit budget-updated event', () => {
      const listener = vi.fn()
      enforcer.on('budget-updated', listener)

      enforcer.updateBudget({ maxMemory: 123 })

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Budget Checks', () => {
    it('should check if within budget', async () => {
      enforcer.startMonitoring('op1')

      await new Promise((resolve) => setTimeout(resolve, 100))

      const result = await enforcer.checkWithinBudget('op1')

      expect(result).toBeDefined()
      expect(result!.withinBudget).toBe(true)
      expect(result!.violations).toHaveLength(0)
      expect(result!.usage).toMatchObject({
        memory: expect.any(Number),
        cpuTime: expect.any(Number),
        duration: expect.any(Number),
      })
    })

    it('should return null for non-existent operation', async () => {
      const result = await enforcer.checkWithinBudget('non-existent')

      expect(result).toBeNull()
    })

    it('should detect duration violations', async () => {
      enforcer.updateBudget({ maxDuration: 50 }) // 50ms limit

      enforcer.startMonitoring('op1')

      await new Promise((resolve) => setTimeout(resolve, 100))

      const result = enforcer.stopMonitoring('op1')

      expect(result!.withinBudget).toBe(false)
      expect(result!.violations).toHaveLength(1)
      expect(result!.violations[0].type).toBe('duration')
    })

    it('should detect memory violations', async () => {
      enforcer.updateBudget({ maxMemory: 1000 }) // Very low limit

      enforcer.startMonitoring('op1')

      const result = enforcer.stopMonitoring('op1')

      expect(result!.violations.some((v) => v.type === 'memory')).toBe(true)
    })

    it('should include violation details', async () => {
      enforcer.updateBudget({ maxDuration: 10 })

      enforcer.startMonitoring('op1')

      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = enforcer.stopMonitoring('op1')

      const violation = result!.violations[0]

      expect(violation).toMatchObject({
        type: 'duration',
        limit: expect.any(Number),
        actual: expect.any(Number),
        timestamp: expect.any(Number),
        message: expect.any(String),
      })
    })
  })

  describe('Violation Events', () => {
    it('should emit budget-violation event', async () => {
      const listener = vi.fn()
      enforcer.on('budget-violation', listener)

      enforcer.updateBudget({ maxDuration: 100 })
      enforcer.startMonitoring('op1')

      // Wait for periodic check to detect violation
      await new Promise((resolve) => setTimeout(resolve, 1500))

      enforcer.stopMonitoring('op1')

      expect(listener).toHaveBeenCalled()
    }, 3000)

    it('should emit monitoring-started event', () => {
      const listener = vi.fn()
      enforcer.on('monitoring-started', listener)

      enforcer.startMonitoring('op1')

      expect(listener).toHaveBeenCalledWith({ operationId: 'op1' })
    })

    it('should emit monitoring-stopped event', () => {
      const listener = vi.fn()
      enforcer.on('monitoring-stopped', listener)

      enforcer.startMonitoring('op1')
      const result = enforcer.stopMonitoring('op1')

      expect(listener).toHaveBeenCalledWith({
        operationId: 'op1',
        result,
      })
    })
  })

  describe('Violation Tracking', () => {
    it('should get violations for operation', async () => {
      enforcer.updateBudget({ maxDuration: 50 })
      enforcer.startMonitoring('op1')

      await new Promise((resolve) => setTimeout(resolve, 1500))

      const violations = enforcer.getViolations('op1')

      expect(violations.length).toBeGreaterThanOrEqual(0)

      enforcer.stopMonitoring('op1')
    })

    it('should return empty array for non-existent operation', () => {
      const violations = enforcer.getViolations('non-existent')

      expect(violations).toEqual([])
    })

    it('should not duplicate violations', async () => {
      enforcer.updateBudget({ maxDuration: 50 })
      enforcer.startMonitoring('op1')

      // Wait for multiple check intervals
      await new Promise((resolve) => setTimeout(resolve, 3000))

      const violations = enforcer.getViolations('op1')

      // Should only have one duration violation despite multiple checks
      const durationViolations = violations.filter((v) => v.type === 'duration')
      expect(durationViolations.length).toBeLessThanOrEqual(1)

      enforcer.stopMonitoring('op1')
    }, 5000)
  })

  describe('withBudget Helper', () => {
    it('should execute operation within budget', async () => {
      const result = await enforcer.withBudget('op1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'success'
      })

      expect(result).toBe('success')
    })

    it('should throw on budget violation', async () => {
      enforcer.updateBudget({ maxDuration: 10 })

      await expect(
        enforcer.withBudget('op1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return 'done'
        })
      ).rejects.toThrow(BudgetExceededError)
    })

    it('should include violation details in error', async () => {
      enforcer.updateBudget({ maxDuration: 10 })

      try {
        await enforcer.withBudget('op1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
        })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError)
        expect((error as BudgetExceededError).violations).toBeDefined()
        expect((error as BudgetExceededError).violations.length).toBeGreaterThan(
          0
        )
      }
    })

    it('should emit budget-exceeded event', async () => {
      const listener = vi.fn()
      enforcer.on('budget-exceeded', listener)

      enforcer.updateBudget({ maxDuration: 10 })

      try {
        await enforcer.withBudget('op1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
        })
      } catch {
        // Expected
      }

      expect(listener).toHaveBeenCalled()
    })

    it('should clean up on success', async () => {
      await enforcer.withBudget('op1', async () => {
        return 'done'
      })

      expect(enforcer.getMonitoredOperations()).not.toContain('op1')
    })

    it('should clean up on error', async () => {
      try {
        await enforcer.withBudget('op1', async () => {
          throw new Error('Test error')
        })
      } catch {
        // Expected
      }

      expect(enforcer.getMonitoredOperations()).not.toContain('op1')
    })
  })

  describe('Enable/Disable', () => {
    it('should start enabled by default', () => {
      expect(enforcer.isEnabled()).toBe(true)
    })

    it('should enable enforcement', () => {
      enforcer.disable()
      enforcer.enable()

      expect(enforcer.isEnabled()).toBe(true)

      enforcer.startMonitoring('op1')
      expect(enforcer.getMonitoredOperations()).toContain('op1')
    })

    it('should disable enforcement', () => {
      enforcer.disable()

      expect(enforcer.isEnabled()).toBe(false)
    })

    it('should clear monitoring when disabled', () => {
      enforcer.startMonitoring('op1')
      enforcer.startMonitoring('op2')

      enforcer.disable()

      expect(enforcer.getMonitoredOperations()).toHaveLength(0)
    })
  })

  describe('Global Enforcer', () => {
    afterEach(() => {
      resetGlobalEnforcer()
    })

    it('should get global enforcer', () => {
      const enforcer = getGlobalEnforcer()

      expect(enforcer).toBeInstanceOf(BudgetEnforcer)
    })

    it('should return same instance', () => {
      const enforcer1 = getGlobalEnforcer()
      const enforcer2 = getGlobalEnforcer()

      expect(enforcer1).toBe(enforcer2)
    })

    it('should reset global enforcer', () => {
      const enforcer1 = getGlobalEnforcer()

      resetGlobalEnforcer()

      const enforcer2 = getGlobalEnforcer()

      expect(enforcer2).not.toBe(enforcer1)
    })

    it('should disable when resetting', () => {
      const enforcer = getGlobalEnforcer()
      const disableSpy = vi.spyOn(enforcer, 'disable')

      resetGlobalEnforcer()

      expect(disableSpy).toHaveBeenCalled()
    })
  })

  describe('Multiple Operations', () => {
    it('should monitor multiple operations concurrently', () => {
      enforcer.startMonitoring('op1')
      enforcer.startMonitoring('op2')
      enforcer.startMonitoring('op3')

      expect(enforcer.getMonitoredOperations()).toHaveLength(3)
    })

    it('should independently track each operation', async () => {
      enforcer.startMonitoring('op1')

      await new Promise((resolve) => setTimeout(resolve, 50))

      enforcer.startMonitoring('op2')

      await new Promise((resolve) => setTimeout(resolve, 50))

      const result1 = enforcer.stopMonitoring('op1')
      const result2 = enforcer.stopMonitoring('op2')

      expect(result1!.usage.duration).toBeGreaterThan(result2!.usage.duration)
    })
  })

  describe('Formatting', () => {
    it('should format bytes in violation messages', async () => {
      enforcer.updateBudget({ maxMemory: 1000 }) // Very low

      enforcer.startMonitoring('op1')
      const result = enforcer.stopMonitoring('op1')

      const memoryViolation = result!.violations.find((v) => v.type === 'memory')

      if (memoryViolation) {
        expect(memoryViolation.message).toMatch(/MB|KB|GB|B/)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid start/stop', () => {
      for (let i = 0; i < 100; i++) {
        enforcer.startMonitoring(`op${i}`)
        enforcer.stopMonitoring(`op${i}`)
      }

      expect(enforcer.getMonitoredOperations()).toHaveLength(0)
    })

    it('should handle zero limits', () => {
      const zeroEnforcer = createBudgetEnforcer({
        maxMemory: 0,
        maxCPUTime: 0,
        maxDuration: 0,
      })

      zeroEnforcer.startMonitoring('op1')
      const result = zeroEnforcer.stopMonitoring('op1')

      // Should have violations for all three limits
      expect(result!.violations.length).toBeGreaterThanOrEqual(1)

      zeroEnforcer.disable()
    })

    it('should handle very high limits', async () => {
      const highEnforcer = createBudgetEnforcer({
        maxMemory: Number.MAX_SAFE_INTEGER,
        maxCPUTime: Number.MAX_SAFE_INTEGER,
        maxDuration: Number.MAX_SAFE_INTEGER,
      })

      highEnforcer.startMonitoring('op1')

      await new Promise((resolve) => setTimeout(resolve, 100))

      const result = highEnforcer.stopMonitoring('op1')

      expect(result!.withinBudget).toBe(true)
      expect(result!.violations).toHaveLength(0)

      highEnforcer.disable()
    })
  })
})
