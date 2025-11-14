/**
 * Onboarding Manager Tests
 * Sprint 6 Day 57: Onboarding system tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OnboardingManager,
  createOnboardingManager,
  getGlobalOnboardingManager,
  resetGlobalOnboardingManager,
  type OnboardingFlow,
} from '../../onboarding/OnboardingManager.js'

describe('OnboardingManager', () => {
  let manager: OnboardingManager

  beforeEach(() => {
    manager = createOnboardingManager()
  })

  describe('Built-in Flows', () => {
    it('should have quick start flow', () => {
      const flow = manager.getFlow('quick-start')

      expect(flow).toBeDefined()
      expect(flow?.name).toBe('Quick Start Guide')
      expect(flow?.steps.length).toBeGreaterThan(0)
    })

    it('should have advanced search flow', () => {
      const flow = manager.getFlow('advanced-search')

      expect(flow).toBeDefined()
      expect(flow?.name).toBe('Advanced Search Techniques')
      expect(flow?.targetAudience).toBe('Intermediate users')
    })

    it('should have plugin development flow', () => {
      const flow = manager.getFlow('plugin-development')

      expect(flow).toBeDefined()
      expect(flow?.name).toBe('Plugin Development Guide')
      expect(flow?.steps.length).toBeGreaterThan(0)
    })

    it('should have at least 3 built-in flows', () => {
      const allFlows = manager.getAllFlows()

      expect(allFlows.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Flow Registration', () => {
    it('should register custom flow', () => {
      const listener = vi.fn()
      manager.on('flow-registered', listener)

      const customFlow: OnboardingFlow = {
        id: 'custom-flow',
        name: 'Custom Flow',
        description: 'Test flow',
        targetAudience: 'Test users',
        estimatedDuration: 10,
        steps: [
          {
            id: 'step-1',
            title: 'Step 1',
            description: 'Test step',
            instructions: ['Do this'],
            estimatedDuration: 60,
          },
        ],
      }

      manager.registerFlow(customFlow)

      const retrieved = manager.getFlow('custom-flow')

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Custom Flow')
      expect(listener).toHaveBeenCalled()
    })

    it('should calculate total duration from steps', () => {
      const flow: OnboardingFlow = {
        id: 'test-flow',
        name: 'Test',
        description: 'Test',
        targetAudience: 'Test',
        estimatedDuration: 0, // Will be calculated
        steps: [
          {
            id: 's1',
            title: 'S1',
            description: 'Test',
            instructions: [],
            estimatedDuration: 60,
          },
          {
            id: 's2',
            title: 'S2',
            description: 'Test',
            instructions: [],
            estimatedDuration: 120,
          },
        ],
      }

      manager.registerFlow(flow)

      const retrieved = manager.getFlow('test-flow')

      expect(retrieved?.estimatedDuration).toBe(3) // (60 + 120) / 60 = 3 minutes
    })
  })

  describe('Flow Queries', () => {
    it('should get all flows', () => {
      const allFlows = manager.getAllFlows()

      expect(allFlows.length).toBeGreaterThan(0)
      expect(allFlows.some((f) => f.id === 'quick-start')).toBe(true)
    })

    it('should get flows by audience', () => {
      const newUserFlows = manager.getFlowsByAudience('New users')

      expect(newUserFlows.length).toBeGreaterThan(0)
      expect(newUserFlows.every((f) => f.targetAudience === 'New users')).toBe(true)
    })

    it('should return empty array for non-existent audience', () => {
      const flows = manager.getFlowsByAudience('Non-existent audience')

      expect(flows).toHaveLength(0)
    })
  })

  describe('Flow Progress', () => {
    it('should start flow and create progress', () => {
      const listener = vi.fn()
      manager.on('flow-started', listener)

      const progress = manager.startFlow('quick-start')

      expect(progress.flowId).toBe('quick-start')
      expect(progress.currentStep).toBe(0)
      expect(progress.completedSteps).toHaveLength(0)
      expect(progress.completed).toBe(false)
      expect(listener).toHaveBeenCalled()
    })

    it('should throw error for non-existent flow', () => {
      expect(() => manager.startFlow('non-existent')).toThrow('Flow not found')
    })

    it('should get progress', () => {
      manager.startFlow('quick-start')

      const progress = manager.getProgress('quick-start')

      expect(progress).toBeDefined()
      expect(progress?.flowId).toBe('quick-start')
    })

    it('should return undefined for non-existent progress', () => {
      const progress = manager.getProgress('non-existent')

      expect(progress).toBeUndefined()
    })
  })

  describe('Step Completion', () => {
    beforeEach(() => {
      manager.startFlow('quick-start')
    })

    it('should complete current step', async () => {
      const listener = vi.fn()
      manager.on('step-completed', listener)

      const success = await manager.completeStep('quick-start')

      expect(success).toBe(true)

      const progress = manager.getProgress('quick-start')

      expect(progress?.currentStep).toBe(1)
      expect(progress?.completedSteps.length).toBe(1)
      expect(listener).toHaveBeenCalled()
    })

    it('should emit flow-completed when all steps done', async () => {
      const listener = vi.fn()
      manager.on('flow-completed', listener)

      const flow = manager.getFlow('quick-start')
      const stepCount = flow?.steps.length || 0

      for (let i = 0; i < stepCount; i++) {
        await manager.completeStep('quick-start')
      }

      expect(listener).toHaveBeenCalled()

      const progress = manager.getProgress('quick-start')

      expect(progress?.completed).toBe(true)
    })

    it('should fail for non-existent flow', async () => {
      const success = await manager.completeStep('non-existent')

      expect(success).toBe(false)
    })
  })

  describe('Step Validation', () => {
    it('should validate step before completing', async () => {
      const listener = vi.fn()
      manager.on('step-validation-failed', listener)

      // Create flow with validation
      const flow: OnboardingFlow = {
        id: 'validated-flow',
        name: 'Validated',
        description: 'Test',
        targetAudience: 'Test',
        estimatedDuration: 1,
        steps: [
          {
            id: 'step-1',
            title: 'Test',
            description: 'Test',
            instructions: [],
            validation: async () => false, // Always fail
            estimatedDuration: 60,
          },
        ],
      }

      manager.registerFlow(flow)
      manager.startFlow('validated-flow')

      const success = await manager.completeStep('validated-flow')

      expect(success).toBe(false)
      expect(listener).toHaveBeenCalled()

      const progress = manager.getProgress('validated-flow')

      expect(progress?.completedSteps.length).toBe(0)
    })

    it('should complete step with passing validation', async () => {
      const flow: OnboardingFlow = {
        id: 'valid-flow',
        name: 'Valid',
        description: 'Test',
        targetAudience: 'Test',
        estimatedDuration: 1,
        steps: [
          {
            id: 'step-1',
            title: 'Test',
            description: 'Test',
            instructions: [],
            validation: async () => true, // Always pass
            estimatedDuration: 60,
          },
        ],
      }

      manager.registerFlow(flow)
      manager.startFlow('valid-flow')

      const success = await manager.completeStep('valid-flow')

      expect(success).toBe(true)

      const progress = manager.getProgress('valid-flow')

      expect(progress?.completedSteps.length).toBe(1)
    })
  })

  describe('Step Skipping', () => {
    it('should skip optional step', () => {
      const listener = vi.fn()
      manager.on('step-skipped', listener)

      // Create flow with optional step
      const flow: OnboardingFlow = {
        id: 'optional-flow',
        name: 'Optional',
        description: 'Test',
        targetAudience: 'Test',
        estimatedDuration: 1,
        steps: [
          {
            id: 'step-1',
            title: 'Test',
            description: 'Test',
            instructions: [],
            optional: true,
            estimatedDuration: 60,
          },
        ],
      }

      manager.registerFlow(flow)
      manager.startFlow('optional-flow')

      const success = manager.skipStep('optional-flow')

      expect(success).toBe(true)
      expect(listener).toHaveBeenCalled()

      const progress = manager.getProgress('optional-flow')

      expect(progress?.skippedSteps.length).toBe(1)
    })

    it('should not skip required step', () => {
      const listener = vi.fn()
      manager.on('step-skip-denied', listener)

      manager.startFlow('quick-start')

      const success = manager.skipStep('quick-start')

      expect(success).toBe(false)
      expect(listener).toHaveBeenCalled()

      const progress = manager.getProgress('quick-start')

      expect(progress?.skippedSteps.length).toBe(0)
    })

    it('should fail for non-existent flow', () => {
      const success = manager.skipStep('non-existent')

      expect(success).toBe(false)
    })
  })

  describe('Current Step', () => {
    it('should get current step', () => {
      manager.startFlow('quick-start')

      const currentStep = manager.getCurrentStep('quick-start')

      expect(currentStep).toBeDefined()
      expect(currentStep?.id).toBe('welcome')
    })

    it('should return undefined for non-existent flow', () => {
      const currentStep = manager.getCurrentStep('non-existent')

      expect(currentStep).toBeUndefined()
    })

    it('should update current step after completion', async () => {
      manager.startFlow('quick-start')

      const firstStep = manager.getCurrentStep('quick-start')

      await manager.completeStep('quick-start')

      const secondStep = manager.getCurrentStep('quick-start')

      expect(secondStep?.id).not.toBe(firstStep?.id)
    })
  })

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      const stats = manager.getStats()

      expect(stats.totalFlows).toBeGreaterThan(0)
      expect(stats.completedFlows).toBe(0)
      expect(stats.inProgressFlows).toBe(0)
      expect(stats.totalStepsCompleted).toBe(0)
    })

    it('should track in-progress flows', () => {
      manager.startFlow('quick-start')

      const stats = manager.getStats()

      expect(stats.inProgressFlows).toBe(1)
    })

    it('should track completed flows', async () => {
      const flow: OnboardingFlow = {
        id: 'short-flow',
        name: 'Short',
        description: 'Test',
        targetAudience: 'Test',
        estimatedDuration: 1,
        steps: [
          {
            id: 'step-1',
            title: 'Test',
            description: 'Test',
            instructions: [],
            estimatedDuration: 60,
          },
        ],
      }

      manager.registerFlow(flow)
      manager.startFlow('short-flow')
      await manager.completeStep('short-flow')

      const stats = manager.getStats()

      expect(stats.completedFlows).toBe(1)
    })

    it('should calculate average completion time', async () => {
      const flow: OnboardingFlow = {
        id: 'timed-flow',
        name: 'Timed',
        description: 'Test',
        targetAudience: 'Test',
        estimatedDuration: 1,
        steps: [
          {
            id: 'step-1',
            title: 'Test',
            description: 'Test',
            instructions: [],
            estimatedDuration: 60,
          },
        ],
      }

      manager.registerFlow(flow)
      manager.startFlow('timed-flow')
      await manager.completeStep('timed-flow')

      const stats = manager.getStats()

      expect(stats.averageCompletionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Progress Management', () => {
    it('should reset flow progress', () => {
      const listener = vi.fn()
      manager.on('progress-reset', listener)

      manager.startFlow('quick-start')

      manager.resetProgress('quick-start')

      const progress = manager.getProgress('quick-start')

      expect(progress).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })

    it('should clear all progress', () => {
      const listener = vi.fn()
      manager.on('all-progress-cleared', listener)

      manager.startFlow('quick-start')
      manager.startFlow('advanced-search')

      manager.clearAllProgress()

      expect(manager.getProgress('quick-start')).toBeUndefined()
      expect(manager.getProgress('advanced-search')).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Onboarding Manager', () => {
    beforeEach(() => {
      resetGlobalOnboardingManager()
    })

    it('should get global onboarding manager', () => {
      const global = getGlobalOnboardingManager()

      expect(global).toBeInstanceOf(OnboardingManager)
    })

    it('should return same instance', () => {
      const manager1 = getGlobalOnboardingManager()
      const manager2 = getGlobalOnboardingManager()

      expect(manager1).toBe(manager2)
    })

    it('should reset global manager', () => {
      const manager1 = getGlobalOnboardingManager()

      resetGlobalOnboardingManager()

      const manager2 = getGlobalOnboardingManager()

      expect(manager2).not.toBe(manager1)
    })
  })
})
