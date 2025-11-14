/**
 * Migration Validator
 * Sprint 6 Day 55: v1 to v2 migration validation and compatibility checking
 */

import { EventEmitter } from 'events'

/**
 * Migration compatibility level
 */
export enum CompatibilityLevel {
  FULLY_COMPATIBLE = 'fully_compatible',
  MOSTLY_COMPATIBLE = 'mostly_compatible',
  BREAKING_CHANGES = 'breaking_changes',
  INCOMPATIBLE = 'incompatible',
}

/**
 * Migration issue severity
 */
export enum IssueSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Migration issue
 */
export interface MigrationIssue {
  severity: IssueSeverity
  category: string
  message: string
  location?: string
  autoFixable: boolean
  recommendation?: string
}

/**
 * V1 configuration
 */
export interface V1Config {
  version: string
  plugins?: string[]
  settings?: Record<string, unknown>
  workflows?: Array<{ name: string; steps: string[] }>
}

/**
 * Migration validation result
 */
export interface ValidationResult {
  compatible: boolean
  compatibilityLevel: CompatibilityLevel
  issues: MigrationIssue[]
  warnings: number
  errors: number
  autoFixableCount: number
  estimatedMigrationTime: number // minutes
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  id: string
  sourceVersion: string
  targetVersion: string
  steps: MigrationStep[]
  estimatedDuration: number // minutes
  requiresBackup: boolean
  requiresDowntime: boolean
  rollbackSupported: boolean
}

/**
 * Migration step
 */
export interface MigrationStep {
  number: number
  title: string
  description: string
  automated: boolean
  command?: string
  validation?: string
  estimatedDuration: number // seconds
}

/**
 * Migration execution result
 */
export interface MigrationExecutionResult {
  success: boolean
  planId: string
  startTime: number
  endTime: number
  duration: number
  stepsCompleted: number
  stepsTotal: number
  errors?: string[]
}

/**
 * Migration Validator
 */
export class MigrationValidator extends EventEmitter {
  private plans = new Map<string, MigrationPlan>()
  private validationCache = new Map<string, ValidationResult>()
  private planCounter = 0

  /**
   * Validate v1 configuration for migration
   */
  validateV1Config(config: V1Config): ValidationResult {
    const cacheKey = JSON.stringify(config)

    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!
    }

    const issues: MigrationIssue[] = []
    let autoFixableCount = 0

    // Check version compatibility
    if (config.version && !this.isVersionSupported(config.version)) {
      issues.push({
        severity: IssueSeverity.ERROR,
        category: 'version',
        message: `Version ${config.version} is not supported for migration`,
        autoFixable: false,
        recommendation: 'Upgrade to v1.5.0 or later before migrating to v2',
      })
    }

    // Check plugins
    if (config.plugins && config.plugins.length > 0) {
      for (const plugin of config.plugins) {
        const pluginIssue = this.validatePlugin(plugin)
        if (pluginIssue) {
          issues.push(pluginIssue)
          if (pluginIssue.autoFixable) autoFixableCount++
        }
      }
    }

    // Check settings
    if (config.settings) {
      const settingsIssues = this.validateSettings(config.settings)
      issues.push(...settingsIssues)
      autoFixableCount += settingsIssues.filter((i) => i.autoFixable).length
    }

    // Check workflows
    if (config.workflows && config.workflows.length > 0) {
      for (const workflow of config.workflows) {
        const workflowIssues = this.validateWorkflow(workflow)
        issues.push(...workflowIssues)
        autoFixableCount += workflowIssues.filter((i) => i.autoFixable).length
      }
    }

    // Determine compatibility level
    const errors = issues.filter((i) => i.severity === IssueSeverity.ERROR || i.severity === IssueSeverity.CRITICAL).length
    const warnings = issues.filter((i) => i.severity === IssueSeverity.WARNING).length

    let compatibilityLevel: CompatibilityLevel
    if (errors > 0) {
      compatibilityLevel = errors >= 3 ? CompatibilityLevel.INCOMPATIBLE : CompatibilityLevel.BREAKING_CHANGES
    } else if (warnings > 5) {
      compatibilityLevel = CompatibilityLevel.MOSTLY_COMPATIBLE
    } else {
      compatibilityLevel = CompatibilityLevel.FULLY_COMPATIBLE
    }

    const result: ValidationResult = {
      compatible: errors === 0,
      compatibilityLevel,
      issues,
      warnings,
      errors,
      autoFixableCount,
      estimatedMigrationTime: this.estimateMigrationTime(issues),
    }

    this.validationCache.set(cacheKey, result)

    this.emit('validation-completed', {
      compatible: result.compatible,
      compatibilityLevel: result.compatibilityLevel,
      issueCount: issues.length,
    })

    return result
  }

  /**
   * Create migration plan
   */
  createMigrationPlan(sourceVersion: string, targetVersion: string = '2.0.0'): MigrationPlan {
    const planId = `plan-${++this.planCounter}`

    const steps: MigrationStep[] = [
      {
        number: 1,
        title: 'Backup v1 configuration',
        description: 'Create backup of existing v1 configuration and data',
        automated: true,
        command: 'ax backup --version v1',
        validation: 'Verify backup file exists and is valid',
        estimatedDuration: 30,
      },
      {
        number: 2,
        title: 'Validate compatibility',
        description: 'Run compatibility check on v1 configuration',
        automated: true,
        command: 'ax migrate validate',
        validation: 'Check validation report for errors',
        estimatedDuration: 15,
      },
      {
        number: 3,
        title: 'Auto-fix compatible issues',
        description: 'Automatically fix auto-fixable compatibility issues',
        automated: true,
        command: 'ax migrate auto-fix',
        validation: 'Verify fixes applied successfully',
        estimatedDuration: 60,
      },
      {
        number: 4,
        title: 'Migrate configuration',
        description: 'Convert v1 configuration to v2 format',
        automated: true,
        command: 'ax migrate config',
        validation: 'Verify v2 config is valid',
        estimatedDuration: 30,
      },
      {
        number: 5,
        title: 'Migrate plugins',
        description: 'Update plugins to v2-compatible versions',
        automated: true,
        command: 'ax migrate plugins',
        validation: 'Check plugin compatibility',
        estimatedDuration: 120,
      },
      {
        number: 6,
        title: 'Migrate workflows',
        description: 'Convert workflows to v2 format',
        automated: true,
        command: 'ax migrate workflows',
        validation: 'Test workflow execution',
        estimatedDuration: 90,
      },
      {
        number: 7,
        title: 'Verify migration',
        description: 'Run comprehensive verification tests',
        automated: true,
        command: 'ax migrate verify',
        validation: 'All verification tests pass',
        estimatedDuration: 60,
      },
      {
        number: 8,
        title: 'Test critical workflows',
        description: 'Manually test critical workflows in v2',
        automated: false,
        validation: 'Critical workflows execute successfully',
        estimatedDuration: 180,
      },
    ]

    const totalDuration = steps.reduce((sum, step) => sum + step.estimatedDuration, 0)

    const plan: MigrationPlan = {
      id: planId,
      sourceVersion,
      targetVersion,
      steps,
      estimatedDuration: Math.ceil(totalDuration / 60), // Convert to minutes
      requiresBackup: true,
      requiresDowntime: false, // v2 can run alongside v1
      rollbackSupported: true,
    }

    this.plans.set(planId, plan)

    this.emit('plan-created', {
      planId,
      sourceVersion,
      targetVersion,
      stepsCount: steps.length,
      estimatedDuration: plan.estimatedDuration,
    })

    return plan
  }

  /**
   * Execute migration plan
   */
  async executeMigrationPlan(planId: string): Promise<MigrationExecutionResult> {
    const plan = this.plans.get(planId)

    if (!plan) {
      return {
        success: false,
        planId,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        stepsCompleted: 0,
        stepsTotal: 0,
        errors: ['Plan not found'],
      }
    }

    const startTime = Date.now()
    let stepsCompleted = 0

    this.emit('migration-started', { planId, stepsTotal: plan.steps.length })

    try {
      for (const step of plan.steps) {
        this.emit('step-started', { planId, stepNumber: step.number, title: step.title })

        // Simulate step execution
        await this.executeStep(step)

        stepsCompleted++

        this.emit('step-completed', { planId, stepNumber: step.number })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      const result: MigrationExecutionResult = {
        success: true,
        planId,
        startTime,
        endTime,
        duration,
        stepsCompleted,
        stepsTotal: plan.steps.length,
      }

      this.emit('migration-completed', {
        planId,
        duration,
        stepsCompleted: result.stepsCompleted,
      })

      return result
    } catch (error) {
      const endTime = Date.now()
      const duration = endTime - startTime

      const result: MigrationExecutionResult = {
        success: false,
        planId,
        startTime,
        endTime,
        duration,
        stepsCompleted,
        stepsTotal: plan.steps.length,
        errors: [error instanceof Error ? error.message : String(error)],
      }

      this.emit('migration-failed', {
        planId,
        stepNumber: stepsCompleted + 1,
        error: result.errors?.[0],
      })

      return result
    }
  }

  /**
   * Get migration plan
   */
  getPlan(planId: string): MigrationPlan | undefined {
    return this.plans.get(planId)
  }

  /**
   * Get all plans
   */
  getAllPlans(): MigrationPlan[] {
    return Array.from(this.plans.values())
  }

  /**
   * Clear all plans
   */
  clearAll(): void {
    this.plans.clear()
    this.validationCache.clear()
    this.planCounter = 0
    this.emit('all-cleared')
  }

  /**
   * Check if version is supported
   */
  private isVersionSupported(version: string): boolean {
    // Support v1.5.0 and later
    const parts = version.split('.')
    const major = parseInt(parts[0], 10)
    const minor = parseInt(parts[1] || '0', 10)

    return major === 1 && minor >= 5
  }

  /**
   * Validate plugin
   */
  private validatePlugin(plugin: string): MigrationIssue | null {
    // Check for known incompatible plugins
    const incompatiblePlugins = ['legacy-plugin', 'deprecated-tool']

    if (incompatiblePlugins.includes(plugin)) {
      return {
        severity: IssueSeverity.ERROR,
        category: 'plugin',
        message: `Plugin "${plugin}" is not compatible with v2`,
        location: `plugins/${plugin}`,
        autoFixable: false,
        recommendation: `Remove plugin or find v2-compatible alternative`,
      }
    }

    // Check for plugins needing updates
    if (plugin.startsWith('old-')) {
      return {
        severity: IssueSeverity.WARNING,
        category: 'plugin',
        message: `Plugin "${plugin}" may need updates for v2`,
        location: `plugins/${plugin}`,
        autoFixable: true,
        recommendation: `Update plugin to latest version`,
      }
    }

    return null
  }

  /**
   * Validate settings
   */
  private validateSettings(settings: Record<string, unknown>): MigrationIssue[] {
    const issues: MigrationIssue[] = []

    // Check for deprecated settings
    const deprecatedSettings = ['oldFormat', 'legacyMode']

    for (const deprecated of deprecatedSettings) {
      if (deprecated in settings) {
        issues.push({
          severity: IssueSeverity.WARNING,
          category: 'settings',
          message: `Setting "${deprecated}" is deprecated in v2`,
          location: `settings.${deprecated}`,
          autoFixable: true,
          recommendation: `Remove or update to v2 equivalent`,
        })
      }
    }

    return issues
  }

  /**
   * Validate workflow
   */
  private validateWorkflow(workflow: { name: string; steps: string[] }): MigrationIssue[] {
    const issues: MigrationIssue[] = []

    // Check for deprecated workflow steps
    const deprecatedSteps = ['legacy-step', 'old-command']

    for (const step of workflow.steps) {
      if (deprecatedSteps.includes(step)) {
        issues.push({
          severity: IssueSeverity.WARNING,
          category: 'workflow',
          message: `Workflow step "${step}" is deprecated in v2`,
          location: `workflows.${workflow.name}.steps`,
          autoFixable: true,
          recommendation: `Update to v2 workflow syntax`,
        })
      }
    }

    return issues
  }

  /**
   * Estimate migration time
   */
  private estimateMigrationTime(issues: MigrationIssue[]): number {
    // Base time: 10 minutes
    let time = 10

    // Add time based on issues
    const criticalIssues = issues.filter((i) => i.severity === IssueSeverity.CRITICAL).length
    const errors = issues.filter((i) => i.severity === IssueSeverity.ERROR).length
    const warnings = issues.filter((i) => i.severity === IssueSeverity.WARNING).length

    time += criticalIssues * 30 // 30 min per critical issue
    time += errors * 15 // 15 min per error
    time += warnings * 5 // 5 min per warning

    return time
  }

  /**
   * Execute migration step (simulated)
   */
  private async executeStep(step: MigrationStep): Promise<void> {
    // Simulate step execution time
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Create migration validator
 */
export function createMigrationValidator(): MigrationValidator {
  return new MigrationValidator()
}

/**
 * Global migration validator
 */
let globalValidator: MigrationValidator | null = null

/**
 * Get global migration validator
 */
export function getGlobalMigrationValidator(): MigrationValidator {
  if (!globalValidator) {
    globalValidator = createMigrationValidator()
  }
  return globalValidator
}

/**
 * Reset global migration validator
 */
export function resetGlobalMigrationValidator(): void {
  globalValidator = null
}
