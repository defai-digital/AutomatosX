export type taskId = string;
export type resourceId = string;
export type task = {
    readonly id: taskId;
    readonly name: string;
    readonly estimatedDuration: number;
    readonly dependencies: taskId[];
    readonly requiredResources: resourceId[];
    readonly priority: number;
};
export type taskPlan = {
    readonly tasks: task[];
    readonly executionOrder: taskId[];
    readonly parallelGroups: Array<taskId[]>;
    readonly criticalPath: taskId[];
    readonly estimatedTotalTime: number;
};
export declare const createTask: (id: taskId, name: string, estimatedDuration: number, dependencies: taskId[], requiredResources: resourceId[], priority: number) => task;
export declare const resolveDependencies: (tasks: task[]) => {
    TAG: "Ok";
    _0: taskId[];
} | {
    TAG: "Error";
    _0: string;
};
export declare const findParallelGroups: (tasks: task[], executionOrder: taskId[]) => Array<taskId[]>;
export declare const findCriticalPath: (tasks: task[], executionOrder: taskId[]) => taskId[];
export declare const validatePlan: (plan: taskPlan) => {
    TAG: "Ok";
    _0: void;
} | {
    TAG: "Error";
    _0: string[];
};
export declare const optimizePlan: (plan: taskPlan) => taskPlan;
export declare const plan: (tasks: task[]) => {
    TAG: "Ok";
    _0: taskPlan;
} | {
    TAG: "Error";
    _0: string;
};
export declare const getTaskById: (plan: taskPlan, taskId: taskId) => (undefined | task);
export declare const getTotalSlack: (plan: taskPlan) => number;
export declare const getMaxParallelism: (plan: taskPlan) => number;
export declare const getPlanStatistics: (plan: taskPlan) => {
    readonly criticalPathLength: number;
    readonly estimatedTime: number;
    readonly maxParallelism: number;
    readonly totalSlack: number;
    readonly totalTasks: number;
};
//# sourceMappingURL=TaskPlanner.gen.d.ts.map