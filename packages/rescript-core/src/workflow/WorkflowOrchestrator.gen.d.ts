import type { Map_String_t as Belt_Map_String_t } from './Belt.gen';
import type { stateMachine as StateMachine_stateMachine } from '../../src/state/StateMachine.gen';
import type { taskPlan as TaskPlanner_taskPlan } from './TaskPlanner.gen';
import type { task as TaskPlanner_task } from './TaskPlanner.gen';
export type workflowId = string;
export type taskId = string;
export type workflowDefinition = {
    readonly id: workflowId;
    readonly name: string;
    readonly description: string;
    readonly tasks: TaskPlanner_task[];
    readonly maxRetries: number;
    readonly timeout: (undefined | number);
    readonly allowParallel: boolean;
};
export type executionStatus = "Pending" | "Running" | "Paused" | "Completed" | "Failed" | "Cancelled" | "TimedOut";
export type taskExecution = {
    readonly taskId: taskId;
    readonly status: executionStatus;
    readonly startTime: (undefined | number);
    readonly endTime: (undefined | number);
    readonly attempts: number;
    readonly error: (undefined | string);
};
export type workflowStateData = {
    readonly instanceId: string;
    readonly workflowId: workflowId;
    readonly currentTasks: taskId[];
    readonly completedTasks: taskId[];
    readonly failedTasks: taskId[];
    readonly taskExecutions: Belt_Map_String_t<taskExecution>;
};
export type workflowEvent = "Start" | "Pause" | "Resume" | "Complete" | "Fail" | "Cancel" | "Timeout";
export type workflowInstance = {
    readonly id: string;
    readonly workflowId: workflowId;
    readonly definition: workflowDefinition;
    readonly plan: TaskPlanner_taskPlan;
    readonly status: executionStatus;
    readonly currentTasks: taskId[];
    readonly completedTasks: taskId[];
    readonly failedTasks: taskId[];
    readonly taskExecutions: Belt_Map_String_t<taskExecution>;
    readonly stateMachine: StateMachine_stateMachine<workflowStateData, workflowEvent>;
    readonly createdAt: number;
    readonly startedAt: (undefined | number);
    readonly completedAt: (undefined | number);
    readonly error: (undefined | string);
};
export type workflowMetrics = {
    readonly totalTasks: number;
    readonly completedTasks: number;
    readonly failedTasks: number;
    readonly runningTasks: number;
    readonly successRate: number;
    readonly estimatedTimeRemaining: (undefined | number);
    readonly actualDuration: (undefined | number);
};
export type workflowEventData = {
    TAG: "WorkflowCreated";
    _0: string;
} | {
    TAG: "WorkflowStarted";
    _0: string;
} | {
    TAG: "WorkflowPaused";
    _0: string;
} | {
    TAG: "WorkflowResumed";
    _0: string;
} | {
    TAG: "WorkflowCompleted";
    _0: string;
} | {
    TAG: "WorkflowFailed";
    _0: string;
    _1: string;
} | {
    TAG: "WorkflowCancelled";
    _0: string;
} | {
    TAG: "TaskStarted";
    _0: string;
    _1: taskId;
} | {
    TAG: "TaskCompleted";
    _0: string;
    _1: taskId;
} | {
    TAG: "TaskFailed";
    _0: string;
    _1: taskId;
    _2: string;
} | {
    TAG: "TaskRetrying";
    _0: string;
    _1: taskId;
    _2: number;
};
export declare const createWorkflowDefinition: (id: workflowId, name: string, description: string, tasks: TaskPlanner_task[], maxRetries: number, timeout: (undefined | number), allowParallel: boolean) => workflowDefinition;
export declare const createWorkflowInstance: (definition: workflowDefinition) => {
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
};
export declare const startWorkflow: (instance: workflowInstance) => Promise<{
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const pauseWorkflow: (instance: workflowInstance) => Promise<{
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const resumeWorkflow: (instance: workflowInstance) => Promise<{
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const cancelWorkflow: (instance: workflowInstance) => Promise<{
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const completeTask: (instance: workflowInstance, taskId: taskId) => Promise<{
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const failTask: (instance: workflowInstance, taskId: taskId, error: string) => Promise<{
    TAG: "Ok";
    _0: workflowInstance;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const getWorkflowMetrics: (instance: workflowInstance) => workflowMetrics;
export declare const isWorkflowComplete: (instance: workflowInstance) => boolean;
export declare const isWorkflowRunning: (instance: workflowInstance) => boolean;
export declare const getTaskStatus: (instance: workflowInstance, taskId: taskId) => (undefined | executionStatus);
export declare const getRunningTasks: (instance: workflowInstance) => taskId[];
export declare const getCompletedTasks: (instance: workflowInstance) => taskId[];
export declare const getFailedTasks: (instance: workflowInstance) => taskId[];
export declare const getWorkflowProgress: (instance: workflowInstance) => number;
//# sourceMappingURL=WorkflowOrchestrator.gen.d.ts.map