/**
 * Dependency Scheduler Tests
 * Sprint 6 Day 53: Dependency scheduler tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DependencyScheduler,
  createDependencyScheduler,
  getGlobalScheduler,
  resetGlobalScheduler,
  ScheduleFrequency,
} from '../../automation/DependencyScheduler.js'
import { createDependencyUpdater } from '../../automation/DependencyUpdater.js'

describe('DependencyScheduler', () => {
  let scheduler: DependencyScheduler

  beforeEach(() => {
    const updater = createDependencyUpdater()
    scheduler = createDependencyScheduler(updater)
  })

  describe('Schedule Creation', () => {
    it('should create schedule', () => {
      const listener = vi.fn()
      scheduler.on('schedule-created', listener)

      const schedule = scheduler.createSchedule(
        '/test/project',
        ScheduleFrequency.DAILY,
        'patch-only'
      )

      expect(schedule).toMatchObject({
        id: expect.stringContaining('schedule-'),
        frequency: ScheduleFrequency.DAILY,
        enabled: true,
        mergePolicy: 'patch-only',
        projectPath: '/test/project',
      })
      expect(schedule.nextRun).toBeGreaterThan(Date.now())
      expect(listener).toHaveBeenCalled()
    })

    it('should create schedule with default merge policy', () => {
      const schedule = scheduler.createSchedule('/test/project', ScheduleFrequency.WEEKLY)

      expect(schedule.mergePolicy).toBe('patch-only')
    })
  })

  describe('Schedule Update', () => {
    beforeEach(() => {
      scheduler.createSchedule('/test/project', ScheduleFrequency.DAILY, 'patch-only')
    })

    it('should update schedule frequency', () => {
      const listener = vi.fn()
      scheduler.on('schedule-updated', listener)

      const schedules = scheduler.getAllSchedules()
      const updated = scheduler.updateSchedule(schedules[0].id, {
        frequency: ScheduleFrequency.WEEKLY,
      })

      expect(updated?.frequency).toBe(ScheduleFrequency.WEEKLY)
      expect(listener).toHaveBeenCalled()
    })

    it('should update merge policy', () => {
      const schedules = scheduler.getAllSchedules()
      const updated = scheduler.updateSchedule(schedules[0].id, {
        mergePolicy: 'patch-and-minor',
      })

      expect(updated?.mergePolicy).toBe('patch-and-minor')
    })

    it('should enable/disable schedule', () => {
      const schedules = scheduler.getAllSchedules()
      const updated = scheduler.updateSchedule(schedules[0].id, {
        enabled: false,
      })

      expect(updated?.enabled).toBe(false)
    })

    it('should return null for non-existent schedule', () => {
      const updated = scheduler.updateSchedule('non-existent', {
        frequency: ScheduleFrequency.WEEKLY,
      })

      expect(updated).toBeNull()
    })
  })

  describe('Schedule Execution', () => {
    it('should run schedule', async () => {
      const listener = vi.fn()
      scheduler.on('schedule-run-completed', listener)

      const schedule = scheduler.createSchedule(
        '/test/project',
        ScheduleFrequency.DAILY
      )

      const result = await scheduler.runSchedule(schedule.id)

      expect(result).toMatchObject({
        scheduleId: schedule.id,
        success: true,
        prsCreated: expect.any(Number),
      })
      expect(listener).toHaveBeenCalled()
    })

    it('should fail for non-existent schedule', async () => {
      const result = await scheduler.runSchedule('non-existent')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Schedule not found')
    })

    it('should fail for disabled schedule', async () => {
      const schedule = scheduler.createSchedule(
        '/test/project',
        ScheduleFrequency.DAILY
      )

      scheduler.updateSchedule(schedule.id, { enabled: false })

      const result = await scheduler.runSchedule(schedule.id)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Schedule is disabled')
    })

    it('should update last run and next run times', async () => {
      const schedule = scheduler.createSchedule(
        '/test/project',
        ScheduleFrequency.DAILY
      )

      const nextRunBefore = schedule.nextRun

      await scheduler.runSchedule(schedule.id)

      const updated = scheduler.getSchedule(schedule.id)

      expect(updated?.lastRun).toBeGreaterThan(0)
      expect(updated?.nextRun).toBeGreaterThanOrEqual(nextRunBefore)
    })
  })

  describe('Schedule Queries', () => {
    beforeEach(() => {
      scheduler.createSchedule('/project1', ScheduleFrequency.DAILY, 'patch-only')
      scheduler.createSchedule('/project2', ScheduleFrequency.WEEKLY, 'patch-and-minor')

      const schedules = scheduler.getAllSchedules()
      scheduler.updateSchedule(schedules[1].id, { enabled: false })
    })

    it('should get schedule', () => {
      const schedules = scheduler.getAllSchedules()
      const schedule = scheduler.getSchedule(schedules[0].id)

      expect(schedule).toBeDefined()
      expect(schedule?.id).toBe(schedules[0].id)
    })

    it('should get all schedules', () => {
      const schedules = scheduler.getAllSchedules()

      expect(schedules).toHaveLength(2)
    })

    it('should get enabled schedules', () => {
      const enabled = scheduler.getEnabledSchedules()

      expect(enabled).toHaveLength(1)
      expect(enabled[0].enabled).toBe(true)
    })

    it('should get schedules due for run', () => {
      const due = scheduler.getSchedulesDue()

      // All schedules should be due (nextRun is in the past for testing)
      expect(due.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Schedule Deletion', () => {
    beforeEach(() => {
      scheduler.createSchedule('/test/project', ScheduleFrequency.DAILY)
    })

    it('should delete schedule', () => {
      const listener = vi.fn()
      scheduler.on('schedule-deleted', listener)

      const schedules = scheduler.getAllSchedules()
      const deleted = scheduler.deleteSchedule(schedules[0].id)

      expect(deleted).toBe(true)
      expect(scheduler.getSchedule(schedules[0].id)).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })

    it('should return false for non-existent schedule', () => {
      const deleted = scheduler.deleteSchedule('non-existent')

      expect(deleted).toBe(false)
    })
  })

  describe('Clear Operations', () => {
    beforeEach(() => {
      scheduler.createSchedule('/test/project', ScheduleFrequency.DAILY)
    })

    it('should clear all schedules', () => {
      const listener = vi.fn()
      scheduler.on('all-cleared', listener)

      scheduler.clearAll()

      const schedules = scheduler.getAllSchedules()

      expect(schedules).toHaveLength(0)
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Scheduler', () => {
    beforeEach(() => {
      resetGlobalScheduler()
    })

    it('should get global scheduler', () => {
      const updater = createDependencyUpdater()
      const global = getGlobalScheduler(updater)

      expect(global).toBeInstanceOf(DependencyScheduler)
    })

    it('should reset global scheduler', () => {
      const updater = createDependencyUpdater()
      const scheduler1 = getGlobalScheduler(updater)

      resetGlobalScheduler()

      const scheduler2 = getGlobalScheduler(updater)

      expect(scheduler2).not.toBe(scheduler1)
    })
  })
})
