/* TypeScript file generated from TaskPlanner.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as TaskPlannerJS from './TaskPlanner.bs.js';

export type taskId = string;

export type resourceId = string;

export type task = {
  readonly id: taskId; 
  readonly name: string; 
  readonly estimatedDuration: number; 
  readonly dependencies: taskId[]; 
  readonly requiredResources: resourceId[]; 
  readonly priority: number
};

export type taskPlan = {
  readonly tasks: task[]; 
  readonly executionOrder: taskId[]; 
  readonly parallelGroups: Array<taskId[]>; 
  readonly criticalPath: taskId[]; 
  readonly estimatedTotalTime: number
};

export const createTask: (id:taskId, name:string, estimatedDuration:number, dependencies:taskId[], requiredResources:resourceId[], priority:number) => task = TaskPlannerJS.createTask as any;

export const resolveDependencies: (tasks:task[]) => 
    { TAG: "Ok"; _0: taskId[] }
  | { TAG: "Error"; _0: string } = TaskPlannerJS.resolveDependencies as any;

export const findParallelGroups: (tasks:task[], executionOrder:taskId[]) => Array<taskId[]> = TaskPlannerJS.findParallelGroups as any;

export const findCriticalPath: (tasks:task[], executionOrder:taskId[]) => taskId[] = TaskPlannerJS.findCriticalPath as any;

export const validatePlan: (plan:taskPlan) => 
    { TAG: "Ok"; _0: void }
  | { TAG: "Error"; _0: string[] } = TaskPlannerJS.validatePlan as any;

export const optimizePlan: (plan:taskPlan) => taskPlan = TaskPlannerJS.optimizePlan as any;

export const plan: (tasks:task[]) => 
    { TAG: "Ok"; _0: taskPlan }
  | { TAG: "Error"; _0: string } = TaskPlannerJS.plan as any;

export const getTaskById: (plan:taskPlan, taskId:taskId) => (undefined | task) = TaskPlannerJS.getTaskById as any;

export const getTotalSlack: (plan:taskPlan) => number = TaskPlannerJS.getTotalSlack as any;

export const getMaxParallelism: (plan:taskPlan) => number = TaskPlannerJS.getMaxParallelism as any;

export const getPlanStatistics: (plan:taskPlan) => {
  readonly criticalPathLength: number; 
  readonly estimatedTime: number; 
  readonly maxParallelism: number; 
  readonly totalSlack: number; 
  readonly totalTasks: number
} = TaskPlannerJS.getPlanStatistics as any;
