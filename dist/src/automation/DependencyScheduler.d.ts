/**
 * Dependency Scheduler
 * Sprint 6 Day 53: Scheduling and merge policies for dependency updates
 */
import { EventEmitter } from 'events';
import { DependencyUpdater, type MergePolicy } from './DependencyUpdater.js';
/**
 * Schedule frequency
 */
export declare enum ScheduleFrequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly"
}
/**
 * Update schedule
 */
export interface UpdateSchedule {
    id: string;
    frequency: ScheduleFrequency;
    enabled: boolean;
    lastRun?: number;
    nextRun: number;
    mergePolicy: MergePolicy;
    projectPath: string;
}
/**
 * Schedule run result
 */
export interface ScheduleRunResult {
    scheduleId: string;
    success: boolean;
    prsCreated: number;
    errors?: string[];
}
/**
 * Dependency scheduler
 */
export declare class DependencyScheduler extends EventEmitter {
    private updater;
    private schedules;
    private scheduleCounter;
    constructor(updater: DependencyUpdater);
    /**
     * Create schedule
     */
    createSchedule(projectPath: string, frequency: ScheduleFrequency, mergePolicy?: MergePolicy): UpdateSchedule;
    /**
     * Update schedule
     */
    updateSchedule(scheduleId: string, updates: Partial<Pick<UpdateSchedule, 'frequency' | 'mergePolicy' | 'enabled'>>): UpdateSchedule | null;
    /**
     * Run schedule
     */
    runSchedule(scheduleId: string): Promise<ScheduleRunResult>;
    /**
     * Get schedule
     */
    getSchedule(scheduleId: string): UpdateSchedule | undefined;
    /**
     * Get all schedules
     */
    getAllSchedules(): UpdateSchedule[];
    /**
     * Get enabled schedules
     */
    getEnabledSchedules(): UpdateSchedule[];
    /**
     * Get schedules due for run
     */
    getSchedulesDue(): UpdateSchedule[];
    /**
     * Delete schedule
     */
    deleteSchedule(scheduleId: string): boolean;
    /**
     * Clear all schedules
     */
    clearAll(): void;
    /**
     * Calculate next run time
     */
    private calculateNextRun;
}
/**
 * Create dependency scheduler
 */
export declare function createDependencyScheduler(updater: DependencyUpdater): DependencyScheduler;
/**
 * Get global scheduler
 */
export declare function getGlobalScheduler(updater: DependencyUpdater): DependencyScheduler;
/**
 * Reset global scheduler
 */
export declare function resetGlobalScheduler(): void;
//# sourceMappingURL=DependencyScheduler.d.ts.map