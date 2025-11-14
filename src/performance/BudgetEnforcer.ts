/**
 * Budget Enforcer
 * Sprint 5 Day 43: Resource budget enforcement for memory and CPU limits
 */

import { EventEmitter } from 'events'

/**
 * Resource budget configuration
 */
export interface ResourceBudget {
  maxMemory?: number // bytes
  maxCPUTime?: number // milliseconds
  maxDuration?: number // milliseconds
  enabled?: boolean
}

/**
 * Budget violation
 */
export interface BudgetViolation {
  type: 'memory' | 'cpu' | 'duration'
  limit: number
  actual: number
  timestamp: number
  message: string
}

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  withinBudget: boolean
  violations: BudgetViolation[]
  usage: ResourceUsage
}

/**
 * Resource usage
 */
export interface ResourceUsage {
  memory: number
  cpuTime: number
  duration: number
}

/**
 * Budget enforcer for resource limits
 */
export class BudgetEnforcer extends EventEmitter {
  private budget: Required<ResourceBudget>
  private enabled: boolean
  private monitoredOperations = new Map<string, MonitoredOperation>()

  constructor(budget: ResourceBudget = {}) {
    super()
    this.budget = {
      maxMemory: budget.maxMemory ?? 512 * 1024 * 1024, // 512MB default
      maxCPUTime: budget.maxCPUTime ?? 30000, // 30s default
      maxDuration: budget.maxDuration ?? 60000, // 60s default
      enabled: budget.enabled ?? true,
    }
    this.enabled = this.budget.enabled
  }

  /**
   * Start monitoring an operation
   */
  startMonitoring(operationId: string): void {
    if (!this.enabled) return

    const operation: MonitoredOperation = {
      operationId,
      startTime: Date.now(),
      startCPU: process.cpuUsage(),
      startMemory: process.memoryUsage().heapUsed,
      violations: [],
      checkTimer: setInterval(() => {
        this.checkBudget(operationId)
      }, 1000), // Check every second
    }

    this.monitoredOperations.set(operationId, operation)
    this.emit('monitoring-started', { operationId })
  }

  /**
   * Stop monitoring an operation
   */
  stopMonitoring(operationId: string): BudgetCheckResult | null {
    if (!this.enabled) return null

    const operation = this.monitoredOperations.get(operationId)
    if (!operation) return null

    // Stop periodic checks
    clearInterval(operation.checkTimer)

    // Final check
    const result = this.performCheck(operation)

    this.monitoredOperations.delete(operationId)
    this.emit('monitoring-stopped', { operationId, result })

    return result
  }

  /**
   * Check budget for an operation
   */
  private checkBudget(operationId: string): void {
    const operation = this.monitoredOperations.get(operationId)
    if (!operation) return

    const result = this.performCheck(operation)

    if (!result.withinBudget) {
      for (const violation of result.violations) {
        // Only emit if this is a new violation
        if (!operation.violations.some((v) => v.type === violation.type)) {
          operation.violations.push(violation)
          this.emit('budget-violation', {
            operationId,
            violation,
          })
        }
      }
    }
  }

  /**
   * Perform budget check
   */
  private performCheck(operation: MonitoredOperation): BudgetCheckResult {
    const now = Date.now()
    const cpuUsage = process.cpuUsage(operation.startCPU)
    const currentMemory = process.memoryUsage().heapUsed

    const usage: ResourceUsage = {
      memory: currentMemory,
      cpuTime: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to ms
      duration: now - operation.startTime,
    }

    const violations: BudgetViolation[] = []

    // Check memory
    if (usage.memory > this.budget.maxMemory) {
      violations.push({
        type: 'memory',
        limit: this.budget.maxMemory,
        actual: usage.memory,
        timestamp: now,
        message: `Memory usage (${this.formatBytes(usage.memory)}) exceeds limit (${this.formatBytes(this.budget.maxMemory)})`,
      })
    }

    // Check CPU time
    if (usage.cpuTime > this.budget.maxCPUTime) {
      violations.push({
        type: 'cpu',
        limit: this.budget.maxCPUTime,
        actual: usage.cpuTime,
        timestamp: now,
        message: `CPU time (${usage.cpuTime.toFixed(2)}ms) exceeds limit (${this.budget.maxCPUTime}ms)`,
      })
    }

    // Check duration
    if (usage.duration > this.budget.maxDuration) {
      violations.push({
        type: 'duration',
        limit: this.budget.maxDuration,
        actual: usage.duration,
        timestamp: now,
        message: `Duration (${usage.duration}ms) exceeds limit (${this.budget.maxDuration}ms)`,
      })
    }

    return {
      withinBudget: violations.length === 0,
      violations,
      usage,
    }
  }

  /**
   * Check if operation is within budget
   */
  async checkWithinBudget(
    operationId: string
  ): Promise<BudgetCheckResult | null> {
    if (!this.enabled) return null

    const operation = this.monitoredOperations.get(operationId)
    if (!operation) return null

    return this.performCheck(operation)
  }

  /**
   * Get budget configuration
   */
  getBudget(): Required<ResourceBudget> {
    return { ...this.budget }
  }

  /**
   * Update budget
   */
  updateBudget(budget: Partial<ResourceBudget>): void {
    this.budget = {
      ...this.budget,
      ...budget,
    }

    this.emit('budget-updated', this.budget)
  }

  /**
   * Enable enforcement
   */
  enable(): void {
    this.enabled = true
  }

  /**
   * Disable enforcement
   */
  disable(): void {
    this.enabled = false

    // Stop all monitoring
    for (const operation of this.monitoredOperations.values()) {
      clearInterval(operation.checkTimer)
    }
    this.monitoredOperations.clear()
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get all violations for an operation
   */
  getViolations(operationId: string): BudgetViolation[] {
    const operation = this.monitoredOperations.get(operationId)
    return operation ? [...operation.violations] : []
  }

  /**
   * Get monitored operations
   */
  getMonitoredOperations(): string[] {
    return Array.from(this.monitoredOperations.keys())
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unitIndex = 0

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * Enforce budget for async operation
   */
  async withBudget<T>(
    operationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startMonitoring(operationId)

    try {
      const result = await operation()
      return result
    } finally {
      const checkResult = this.stopMonitoring(operationId)

      if (checkResult && !checkResult.withinBudget) {
        const error = new BudgetExceededError(
          `Operation exceeded budget: ${checkResult.violations.map((v) => v.message).join(', ')}`,
          checkResult.violations
        )
        this.emit('budget-exceeded', { operationId, error })
        throw error
      }
    }
  }
}

/**
 * Monitored operation (internal)
 */
interface MonitoredOperation {
  operationId: string
  startTime: number
  startCPU: NodeJS.CpuUsage
  startMemory: number
  violations: BudgetViolation[]
  checkTimer: NodeJS.Timeout
}

/**
 * Budget exceeded error
 */
export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public violations: BudgetViolation[]
  ) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

/**
 * Create budget enforcer
 */
export function createBudgetEnforcer(
  budget?: ResourceBudget
): BudgetEnforcer {
  return new BudgetEnforcer(budget)
}

/**
 * Global enforcer instance
 */
let globalEnforcer: BudgetEnforcer | null = null

/**
 * Get global enforcer
 */
export function getGlobalEnforcer(): BudgetEnforcer {
  if (!globalEnforcer) {
    globalEnforcer = createBudgetEnforcer()
  }
  return globalEnforcer
}

/**
 * Reset global enforcer
 */
export function resetGlobalEnforcer(): void {
  if (globalEnforcer) {
    globalEnforcer.disable()
  }
  globalEnforcer = null
}
