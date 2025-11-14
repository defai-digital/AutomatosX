/**
 * Dependency Scheduler
 * Sprint 6 Day 53: Scheduling and merge policies for dependency updates
 */

import { EventEmitter } from 'events'
import { DependencyUpdater, type MergePolicy, type UpdatePR } from './DependencyUpdater.js'

/**
 * Schedule frequency
 */
export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Update schedule
 */
export interface UpdateSchedule {
  id: string
  frequency: ScheduleFrequency
  enabled: boolean
  lastRun?: number
  nextRun: number
  mergePolicy: MergePolicy
  projectPath: string
}

/**
 * Schedule run result
 */
export interface ScheduleRunResult {
  scheduleId: string
  success: boolean
  prsCreated: number
  errors?: string[]
}

/**
 * Dependency scheduler
 */
export class DependencyScheduler extends EventEmitter {
  private schedules = new Map<string, UpdateSchedule>()
  private scheduleCounter = 0

  constructor(private updater: DependencyUpdater) {
    super()
  }

  /**
   * Create schedule
   */
  createSchedule(
    projectPath: string,
    frequency: ScheduleFrequency,
    mergePolicy: MergePolicy = 'patch-only'
  ): UpdateSchedule {
    const scheduleId = `schedule-${++this.scheduleCounter}`

    const schedule: UpdateSchedule = {
      id: scheduleId,
      frequency,
      enabled: true,
      nextRun: this.calculateNextRun(frequency),
      mergePolicy,
      projectPath,
    }

    this.schedules.set(scheduleId, schedule)

    this.emit('schedule-created', {
      scheduleId,
      frequency,
      mergePolicy,
    })

    return schedule
  }

  /**
   * Update schedule
   */
  updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<UpdateSchedule, 'frequency' | 'mergePolicy' | 'enabled'>>
  ): UpdateSchedule | null {
    const schedule = this.schedules.get(scheduleId)
    if (!schedule) return null

    if (updates.frequency !== undefined) {
      schedule.frequency = updates.frequency
      schedule.nextRun = this.calculateNextRun(updates.frequency)
    }

    if (updates.mergePolicy !== undefined) {
      schedule.mergePolicy = updates.mergePolicy
    }

    if (updates.enabled !== undefined) {
      schedule.enabled = updates.enabled
    }

    this.emit('schedule-updated', { scheduleId, updates })

    return schedule
  }

  /**
   * Run schedule
   */
  async runSchedule(scheduleId: string): Promise<ScheduleRunResult> {
    const schedule = this.schedules.get(scheduleId)

    if (!schedule) {
      return {
        scheduleId,
        success: false,
        prsCreated: 0,
        errors: ['Schedule not found'],
      }
    }

    if (!schedule.enabled) {
      return {
        scheduleId,
        success: false,
        prsCreated: 0,
        errors: ['Schedule is disabled'],
      }
    }

    try {
      // Check for outdated dependencies
      const checkResult = await this.updater.checkOutdated(schedule.projectPath)

      // Update schedule run time
      schedule.lastRun = Date.now()
      schedule.nextRun = this.calculateNextRun(schedule.frequency, schedule.lastRun)

      // If no outdated dependencies, return success
      if (checkResult.outdated.length === 0) {
        this.emit('schedule-run-completed', {
          scheduleId,
          prsCreated: 0,
        })

        return {
          scheduleId,
          success: true,
          prsCreated: 0,
        }
      }

      // Group updates by merge policy
      const autoMergeUpdates = checkResult.outdated.filter((dep) =>
        DependencyUpdater.shouldAutoMerge(
          { dependency: dep, updateTo: dep.latest },
          schedule.mergePolicy
        )
      )

      const manualReviewUpdates = checkResult.outdated.filter(
        (dep) =>
          !DependencyUpdater.shouldAutoMerge(
            { dependency: dep, updateTo: dep.latest },
            schedule.mergePolicy
          )
      )

      let prsCreated = 0

      // Create PR for auto-merge updates
      if (autoMergeUpdates.length > 0) {
        await this.updater.createUpdatePR(
          autoMergeUpdates.map((dep) => ({
            dependency: dep,
            updateTo: dep.latest,
          })),
          {
            title: `chore(deps): auto-merge ${autoMergeUpdates.length} dependency updates`,
            runTests: true,
          }
        )
        prsCreated++
      }

      // Create PR for manual review updates
      if (manualReviewUpdates.length > 0) {
        await this.updater.createUpdatePR(
          manualReviewUpdates.map((dep) => ({
            dependency: dep,
            updateTo: dep.latest,
          })),
          {
            title: `chore(deps): ${manualReviewUpdates.length} dependency updates (manual review required)`,
            runTests: true,
          }
        )
        prsCreated++
      }

      this.emit('schedule-run-completed', {
        scheduleId,
        prsCreated,
      })

      return {
        scheduleId,
        success: true,
        prsCreated,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        scheduleId,
        success: false,
        prsCreated: 0,
        errors: [errorMessage],
      }
    }
  }

  /**
   * Get schedule
   */
  getSchedule(scheduleId: string): UpdateSchedule | undefined {
    return this.schedules.get(scheduleId)
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): UpdateSchedule[] {
    return Array.from(this.schedules.values())
  }

  /**
   * Get enabled schedules
   */
  getEnabledSchedules(): UpdateSchedule[] {
    return Array.from(this.schedules.values()).filter((s) => s.enabled)
  }

  /**
   * Get schedules due for run
   */
  getSchedulesDue(): UpdateSchedule[] {
    const now = Date.now()
    return Array.from(this.schedules.values()).filter(
      (s) => s.enabled && s.nextRun <= now
    )
  }

  /**
   * Delete schedule
   */
  deleteSchedule(scheduleId: string): boolean {
    const deleted = this.schedules.delete(scheduleId)

    if (deleted) {
      this.emit('schedule-deleted', { scheduleId })
    }

    return deleted
  }

  /**
   * Clear all schedules
   */
  clearAll(): void {
    this.schedules.clear()
    this.scheduleCounter = 0
    this.emit('all-cleared')
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(frequency: ScheduleFrequency, fromTime: number = Date.now()): number {
    const now = fromTime

    switch (frequency) {
      case ScheduleFrequency.DAILY:
        return now + 86400000 // 24 hours

      case ScheduleFrequency.WEEKLY:
        return now + 604800000 // 7 days

      case ScheduleFrequency.MONTHLY:
        return now + 2592000000 // 30 days

      default:
        return now + 86400000
    }
  }
}

/**
 * Create dependency scheduler
 */
export function createDependencyScheduler(updater: DependencyUpdater): DependencyScheduler {
  return new DependencyScheduler(updater)
}

/**
 * Global scheduler instance
 */
let globalScheduler: DependencyScheduler | null = null

/**
 * Get global scheduler
 */
export function getGlobalScheduler(updater: DependencyUpdater): DependencyScheduler {
  if (!globalScheduler) {
    globalScheduler = createDependencyScheduler(updater)
  }
  return globalScheduler
}

/**
 * Reset global scheduler
 */
export function resetGlobalScheduler(): void {
  globalScheduler = null
}
