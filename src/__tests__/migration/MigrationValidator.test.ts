/**
 * Migration Validator Tests
 * Sprint 6 Day 55: Migration validation tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MigrationValidator,
  createMigrationValidator,
  getGlobalMigrationValidator,
  resetGlobalMigrationValidator,
  CompatibilityLevel,
  IssueSeverity,
  type V1Config,
} from '../../migration/MigrationValidator.js'

describe('MigrationValidator', () => {
  let validator: MigrationValidator

  beforeEach(() => {
    validator = createMigrationValidator()
  })

  describe('V1 Config Validation', () => {
    it('should validate fully compatible v1 config', () => {
      const listener = vi.fn()
      validator.on('validation-completed', listener)

      const config: V1Config = {
        version: '1.5.0',
        plugins: ['modern-plugin'],
        settings: { theme: 'dark' },
        workflows: [{ name: 'build', steps: ['compile', 'test'] }],
      }

      const result = validator.validateV1Config(config)

      expect(result.compatible).toBe(true)
      expect(result.compatibilityLevel).toBe(CompatibilityLevel.FULLY_COMPATIBLE)
      expect(result.errors).toBe(0)
      expect(listener).toHaveBeenCalled()
    })

    it('should detect incompatible version', () => {
      const config: V1Config = {
        version: '1.0.0', // Too old
        plugins: [],
        settings: {},
      }

      const result = validator.validateV1Config(config)

      expect(result.compatible).toBe(false)
      expect(result.errors).toBeGreaterThan(0)
      expect(result.issues.some((i) => i.category === 'version')).toBe(true)
    })

    it('should detect incompatible plugins', () => {
      const config: V1Config = {
        version: '1.5.0',
        plugins: ['legacy-plugin'], // Known incompatible
      }

      const result = validator.validateV1Config(config)

      expect(result.compatible).toBe(false)
      expect(result.issues.some((i) => i.category === 'plugin')).toBe(true)
      expect(result.issues.some((i) => i.severity === IssueSeverity.ERROR)).toBe(true)
    })

    it('should detect deprecated settings', () => {
      const config: V1Config = {
        version: '1.5.0',
        settings: {
          oldFormat: true, // Deprecated
          legacyMode: true, // Deprecated
        },
      }

      const result = validator.validateV1Config(config)

      expect(result.warnings).toBeGreaterThanOrEqual(2)
      expect(result.issues.filter((i) => i.category === 'settings').length).toBeGreaterThanOrEqual(2)
    })

    it('should detect deprecated workflow steps', () => {
      const config: V1Config = {
        version: '1.5.0',
        workflows: [{ name: 'old-workflow', steps: ['legacy-step'] }],
      }

      const result = validator.validateV1Config(config)

      expect(result.warnings).toBeGreaterThan(0)
      expect(result.issues.some((i) => i.category === 'workflow')).toBe(true)
    })

    it('should identify auto-fixable issues', () => {
      const config: V1Config = {
        version: '1.5.0',
        plugins: ['old-plugin'], // Auto-fixable
        settings: { oldFormat: true }, // Auto-fixable
      }

      const result = validator.validateV1Config(config)

      expect(result.autoFixableCount).toBeGreaterThan(0)
      expect(result.issues.every((i) => i.autoFixable)).toBe(true)
    })

    it('should estimate migration time based on issues', () => {
      const config: V1Config = {
        version: '1.5.0',
        plugins: ['legacy-plugin'], // Error
        settings: { oldFormat: true }, // Warning
      }

      const result = validator.validateV1Config(config)

      expect(result.estimatedMigrationTime).toBeGreaterThan(10) // Base time + issue time
    })

    it('should cache validation results', () => {
      const config: V1Config = {
        version: '1.5.0',
        plugins: ['test-plugin'],
      }

      const result1 = validator.validateV1Config(config)
      const result2 = validator.validateV1Config(config)

      expect(result1).toBe(result2) // Same object reference
    })
  })

  describe('Migration Plan Creation', () => {
    it('should create migration plan', () => {
      const listener = vi.fn()
      validator.on('plan-created', listener)

      const plan = validator.createMigrationPlan('1.5.0', '2.0.0')

      expect(plan).toMatchObject({
        id: expect.stringContaining('plan-'),
        sourceVersion: '1.5.0',
        targetVersion: '2.0.0',
        steps: expect.any(Array),
        estimatedDuration: expect.any(Number),
        requiresBackup: true,
        requiresDowntime: false,
        rollbackSupported: true,
      })
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(listener).toHaveBeenCalled()
    })

    it('should include all migration steps', () => {
      const plan = validator.createMigrationPlan('1.5.0')

      const stepTitles = plan.steps.map((s) => s.title)

      expect(stepTitles).toContain('Backup v1 configuration')
      expect(stepTitles).toContain('Validate compatibility')
      expect(stepTitles).toContain('Migrate configuration')
      expect(stepTitles).toContain('Migrate plugins')
      expect(stepTitles).toContain('Verify migration')
    })

    it('should mark automated steps', () => {
      const plan = validator.createMigrationPlan('1.5.0')

      const automatedSteps = plan.steps.filter((s) => s.automated)

      expect(automatedSteps.length).toBeGreaterThan(0)
    })

    it('should calculate total estimated duration', () => {
      const plan = validator.createMigrationPlan('1.5.0')

      const manualCalculation = plan.steps.reduce((sum, step) => sum + step.estimatedDuration, 0)

      expect(plan.estimatedDuration).toBe(Math.ceil(manualCalculation / 60))
    })
  })

  describe('Migration Plan Execution', () => {
    it('should execute migration plan successfully', async () => {
      const startListener = vi.fn()
      const completeListener = vi.fn()

      validator.on('migration-started', startListener)
      validator.on('migration-completed', completeListener)

      const plan = validator.createMigrationPlan('1.5.0')

      const result = await validator.executeMigrationPlan(plan.id)

      expect(result.success).toBe(true)
      expect(result.planId).toBe(plan.id)
      expect(result.stepsCompleted).toBe(plan.steps.length)
      expect(result.stepsTotal).toBe(plan.steps.length)
      expect(result.duration).toBeGreaterThan(0)
      expect(startListener).toHaveBeenCalled()
      expect(completeListener).toHaveBeenCalled()
    })

    it('should fail for non-existent plan', async () => {
      const result = await validator.executeMigrationPlan('non-existent')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Plan not found')
    })

    it('should emit step events during execution', async () => {
      const stepStartedListener = vi.fn()
      const stepCompletedListener = vi.fn()

      validator.on('step-started', stepStartedListener)
      validator.on('step-completed', stepCompletedListener)

      const plan = validator.createMigrationPlan('1.5.0')

      await validator.executeMigrationPlan(plan.id)

      expect(stepStartedListener).toHaveBeenCalled()
      expect(stepCompletedListener).toHaveBeenCalled()
      expect(stepStartedListener).toHaveBeenCalledTimes(plan.steps.length)
      expect(stepCompletedListener).toHaveBeenCalledTimes(plan.steps.length)
    })
  })

  describe('Plan Queries', () => {
    beforeEach(() => {
      validator.createMigrationPlan('1.5.0', '2.0.0')
      validator.createMigrationPlan('1.6.0', '2.0.0')
    })

    it('should get plan by ID', () => {
      const plans = validator.getAllPlans()
      const plan = validator.getPlan(plans[0].id)

      expect(plan).toBeDefined()
      expect(plan?.id).toBe(plans[0].id)
    })

    it('should return undefined for non-existent plan', () => {
      const plan = validator.getPlan('non-existent')

      expect(plan).toBeUndefined()
    })

    it('should get all plans', () => {
      const allPlans = validator.getAllPlans()

      expect(allPlans).toHaveLength(2)
    })
  })

  describe('Compatibility Levels', () => {
    it('should classify as FULLY_COMPATIBLE with no issues', () => {
      const config: V1Config = {
        version: '1.5.0',
        plugins: [],
        settings: {},
      }

      const result = validator.validateV1Config(config)

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.FULLY_COMPATIBLE)
    })

    it('should classify as MOSTLY_COMPATIBLE with many warnings', () => {
      const config: V1Config = {
        version: '1.5.0',
        settings: {
          oldFormat: true,
          legacyMode: true,
        },
        workflows: [
          { name: 'wf1', steps: ['legacy-step'] },
          { name: 'wf2', steps: ['legacy-step'] },
          { name: 'wf3', steps: ['legacy-step'] },
          { name: 'wf4', steps: ['legacy-step'] },
        ],
      }

      const result = validator.validateV1Config(config)

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.MOSTLY_COMPATIBLE)
    })

    it('should classify as BREAKING_CHANGES with some errors', () => {
      const config: V1Config = {
        version: '1.5.0',
        plugins: ['legacy-plugin'],
      }

      const result = validator.validateV1Config(config)

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BREAKING_CHANGES)
    })

    it('should classify as INCOMPATIBLE with many errors', () => {
      const config: V1Config = {
        version: '1.0.0', // Error
        plugins: ['legacy-plugin', 'deprecated-tool'], // 2 errors
      }

      const result = validator.validateV1Config(config)

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.INCOMPATIBLE)
    })
  })

  describe('Clear Operations', () => {
    beforeEach(() => {
      validator.createMigrationPlan('1.5.0')
      validator.validateV1Config({ version: '1.5.0' })
    })

    it('should clear all plans and cache', () => {
      const listener = vi.fn()
      validator.on('all-cleared', listener)

      validator.clearAll()

      const allPlans = validator.getAllPlans()

      expect(allPlans).toHaveLength(0)
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Migration Validator', () => {
    beforeEach(() => {
      resetGlobalMigrationValidator()
    })

    it('should get global migration validator', () => {
      const global = getGlobalMigrationValidator()

      expect(global).toBeInstanceOf(MigrationValidator)
    })

    it('should return same instance', () => {
      const validator1 = getGlobalMigrationValidator()
      const validator2 = getGlobalMigrationValidator()

      expect(validator1).toBe(validator2)
    })

    it('should reset global migration validator', () => {
      const validator1 = getGlobalMigrationValidator()

      resetGlobalMigrationValidator()

      const validator2 = getGlobalMigrationValidator()

      expect(validator2).not.toBe(validator1)
    })
  })
})
