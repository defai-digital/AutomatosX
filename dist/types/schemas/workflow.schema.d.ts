import { z } from 'zod';
export declare const WorkflowStateSchema: z.ZodEnum<["idle", "parsing", "validating", "building_graph", "scheduling", "executing", "awaiting_completion", "creating_checkpoint", "restoring_checkpoint", "aggregating_results", "completed", "failed", "paused", "cancelled"]>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
export declare const RetryPolicySchema: z.ZodObject<{
    maxRetries: z.ZodDefault<z.ZodNumber>;
    retryDelayMs: z.ZodDefault<z.ZodNumber>;
    retryBackoffMultiplier: z.ZodDefault<z.ZodNumber>;
    retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    maxRetries: number;
    retryDelayMs: number;
    retryBackoffMultiplier: number;
    retryableErrors?: string[] | undefined;
}, {
    maxRetries?: number | undefined;
    retryDelayMs?: number | undefined;
    retryBackoffMultiplier?: number | undefined;
    retryableErrors?: string[] | undefined;
}>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export declare const WorkflowStepSchema: z.ZodObject<{
    key: z.ZodString;
    agent: z.ZodString;
    prompt: z.ZodString;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    parallel: z.ZodDefault<z.ZodBoolean>;
    optional: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    retryPolicy: z.ZodOptional<z.ZodObject<{
        maxRetries: z.ZodDefault<z.ZodNumber>;
        retryDelayMs: z.ZodDefault<z.ZodNumber>;
        retryBackoffMultiplier: z.ZodDefault<z.ZodNumber>;
        retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        retryDelayMs: number;
        retryBackoffMultiplier: number;
        retryableErrors?: string[] | undefined;
    }, {
        maxRetries?: number | undefined;
        retryDelayMs?: number | undefined;
        retryBackoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
    }>>;
    outputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    key: string;
    parallel: boolean;
    dependencies: string[];
    agent: string;
    prompt: string;
    optional: boolean;
    timeoutMs?: number | undefined;
    retryPolicy?: {
        maxRetries: number;
        retryDelayMs: number;
        retryBackoffMultiplier: number;
        retryableErrors?: string[] | undefined;
    } | undefined;
    outputSchema?: Record<string, unknown> | undefined;
}, {
    key: string;
    agent: string;
    prompt: string;
    parallel?: boolean | undefined;
    dependencies?: string[] | undefined;
    optional?: boolean | undefined;
    timeoutMs?: number | undefined;
    retryPolicy?: {
        maxRetries?: number | undefined;
        retryDelayMs?: number | undefined;
        retryBackoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
    } | undefined;
    outputSchema?: Record<string, unknown> | undefined;
}>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export declare const WorkflowConfigSchema: z.ZodObject<{
    timeout: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    checkpointInterval: z.ZodOptional<z.ZodNumber>;
    parallelism: z.ZodDefault<z.ZodNumber>;
    continueOnError: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxRetries: number;
    parallelism: number;
    continueOnError: boolean;
    timeout?: number | undefined;
    checkpointInterval?: number | undefined;
}, {
    timeout?: number | undefined;
    maxRetries?: number | undefined;
    parallelism?: number | undefined;
    checkpointInterval?: number | undefined;
    continueOnError?: boolean | undefined;
}>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export declare const WorkflowDefinitionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    version: z.ZodDefault<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        agent: z.ZodString;
        prompt: z.ZodString;
        dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        parallel: z.ZodDefault<z.ZodBoolean>;
        optional: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        retryPolicy: z.ZodOptional<z.ZodObject<{
            maxRetries: z.ZodDefault<z.ZodNumber>;
            retryDelayMs: z.ZodDefault<z.ZodNumber>;
            retryBackoffMultiplier: z.ZodDefault<z.ZodNumber>;
            retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            maxRetries: number;
            retryDelayMs: number;
            retryBackoffMultiplier: number;
            retryableErrors?: string[] | undefined;
        }, {
            maxRetries?: number | undefined;
            retryDelayMs?: number | undefined;
            retryBackoffMultiplier?: number | undefined;
            retryableErrors?: string[] | undefined;
        }>>;
        outputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        parallel: boolean;
        dependencies: string[];
        agent: string;
        prompt: string;
        optional: boolean;
        timeoutMs?: number | undefined;
        retryPolicy?: {
            maxRetries: number;
            retryDelayMs: number;
            retryBackoffMultiplier: number;
            retryableErrors?: string[] | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | undefined;
    }, {
        key: string;
        agent: string;
        prompt: string;
        parallel?: boolean | undefined;
        dependencies?: string[] | undefined;
        optional?: boolean | undefined;
        timeoutMs?: number | undefined;
        retryPolicy?: {
            maxRetries?: number | undefined;
            retryDelayMs?: number | undefined;
            retryBackoffMultiplier?: number | undefined;
            retryableErrors?: string[] | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | undefined;
    }>, "many">;
    config: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        maxRetries: z.ZodDefault<z.ZodNumber>;
        checkpointInterval: z.ZodOptional<z.ZodNumber>;
        parallelism: z.ZodDefault<z.ZodNumber>;
        continueOnError: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        parallelism: number;
        continueOnError: boolean;
        timeout?: number | undefined;
        checkpointInterval?: number | undefined;
    }, {
        timeout?: number | undefined;
        maxRetries?: number | undefined;
        parallelism?: number | undefined;
        checkpointInterval?: number | undefined;
        continueOnError?: boolean | undefined;
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    author: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    steps: {
        key: string;
        parallel: boolean;
        dependencies: string[];
        agent: string;
        prompt: string;
        optional: boolean;
        timeoutMs?: number | undefined;
        retryPolicy?: {
            maxRetries: number;
            retryDelayMs: number;
            retryBackoffMultiplier: number;
            retryableErrors?: string[] | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | undefined;
    }[];
    version: string;
    description?: string | undefined;
    config?: {
        maxRetries: number;
        parallelism: number;
        continueOnError: boolean;
        timeout?: number | undefined;
        checkpointInterval?: number | undefined;
    } | undefined;
    tags?: string[] | undefined;
    author?: string | undefined;
}, {
    name: string;
    steps: {
        key: string;
        agent: string;
        prompt: string;
        parallel?: boolean | undefined;
        dependencies?: string[] | undefined;
        optional?: boolean | undefined;
        timeoutMs?: number | undefined;
        retryPolicy?: {
            maxRetries?: number | undefined;
            retryDelayMs?: number | undefined;
            retryBackoffMultiplier?: number | undefined;
            retryableErrors?: string[] | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | undefined;
    }[];
    version?: string | undefined;
    description?: string | undefined;
    config?: {
        timeout?: number | undefined;
        maxRetries?: number | undefined;
        parallelism?: number | undefined;
        checkpointInterval?: number | undefined;
        continueOnError?: boolean | undefined;
    } | undefined;
    tags?: string[] | undefined;
    author?: string | undefined;
}>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export declare const WorkflowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    definition: z.ZodString;
    version: z.ZodString;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    author: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodNumber>;
    totalExecutions: z.ZodDefault<z.ZodNumber>;
    successfulExecutions: z.ZodDefault<z.ZodNumber>;
    failedExecutions: z.ZodDefault<z.ZodNumber>;
    avgDurationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    definition: string;
    id: string;
    version: string;
    createdAt: number;
    updatedAt: number;
    totalExecutions: number;
    isActive: number;
    successfulExecutions: number;
    failedExecutions: number;
    description?: string | undefined;
    tags?: string | undefined;
    author?: string | undefined;
    avgDurationMs?: number | undefined;
}, {
    name: string;
    definition: string;
    id: string;
    version: string;
    createdAt: number;
    updatedAt: number;
    description?: string | undefined;
    totalExecutions?: number | undefined;
    tags?: string | undefined;
    author?: string | undefined;
    isActive?: number | undefined;
    successfulExecutions?: number | undefined;
    failedExecutions?: number | undefined;
    avgDurationMs?: number | undefined;
}>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export declare const WorkflowContextSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;
export declare const WorkflowExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    workflowId: z.ZodString;
    state: z.ZodEnum<["idle", "parsing", "validating", "building_graph", "scheduling", "executing", "awaiting_completion", "creating_checkpoint", "restoring_checkpoint", "aggregating_results", "completed", "failed", "paused", "cancelled"]>;
    context: z.ZodString;
    createdAt: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
    pausedAt: z.ZodOptional<z.ZodNumber>;
    cancelledAt: z.ZodOptional<z.ZodNumber>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    errorStepId: z.ZodOptional<z.ZodString>;
    lastCheckpointId: z.ZodOptional<z.ZodString>;
    resumeCount: z.ZodDefault<z.ZodNumber>;
    triggeredBy: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodNumber>;
    parentExecutionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    priority: number;
    context: string;
    createdAt: number;
    state: "completed" | "failed" | "cancelled" | "idle" | "paused" | "validating" | "parsing" | "building_graph" | "scheduling" | "executing" | "awaiting_completion" | "creating_checkpoint" | "restoring_checkpoint" | "aggregating_results";
    workflowId: string;
    resumeCount: number;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    error?: string | undefined;
    pausedAt?: number | undefined;
    cancelledAt?: number | undefined;
    durationMs?: number | undefined;
    errorStepId?: string | undefined;
    lastCheckpointId?: string | undefined;
    triggeredBy?: string | undefined;
    parentExecutionId?: string | undefined;
}, {
    id: string;
    context: string;
    createdAt: number;
    state: "completed" | "failed" | "cancelled" | "idle" | "paused" | "validating" | "parsing" | "building_graph" | "scheduling" | "executing" | "awaiting_completion" | "creating_checkpoint" | "restoring_checkpoint" | "aggregating_results";
    workflowId: string;
    priority?: number | undefined;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    error?: string | undefined;
    pausedAt?: number | undefined;
    cancelledAt?: number | undefined;
    durationMs?: number | undefined;
    errorStepId?: string | undefined;
    lastCheckpointId?: string | undefined;
    resumeCount?: number | undefined;
    triggeredBy?: string | undefined;
    parentExecutionId?: string | undefined;
}>;
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export declare const StepExecutionStateSchema: z.ZodEnum<["pending", "running", "completed", "failed", "skipped", "cancelled"]>;
export type StepExecutionState = z.infer<typeof StepExecutionStateSchema>;
export declare const WorkflowStepExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    executionId: z.ZodString;
    stepId: z.ZodString;
    state: z.ZodEnum<["pending", "running", "completed", "failed", "skipped", "cancelled"]>;
    result: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    retryCount: z.ZodDefault<z.ZodNumber>;
    previousErrors: z.ZodOptional<z.ZodString>;
    agentUsed: z.ZodOptional<z.ZodString>;
    providerUsed: z.ZodOptional<z.ZodString>;
    modelUsed: z.ZodOptional<z.ZodString>;
    tokensUsed: z.ZodOptional<z.ZodNumber>;
    cost: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    state: "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";
    executionId: string;
    stepId: string;
    retryCount: number;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    error?: string | undefined;
    cost?: number | undefined;
    durationMs?: number | undefined;
    result?: string | undefined;
    previousErrors?: string | undefined;
    agentUsed?: string | undefined;
    providerUsed?: string | undefined;
    modelUsed?: string | undefined;
    tokensUsed?: number | undefined;
}, {
    id: string;
    state: "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";
    executionId: string;
    stepId: string;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    error?: string | undefined;
    cost?: number | undefined;
    durationMs?: number | undefined;
    result?: string | undefined;
    retryCount?: number | undefined;
    previousErrors?: string | undefined;
    agentUsed?: string | undefined;
    providerUsed?: string | undefined;
    modelUsed?: string | undefined;
    tokensUsed?: number | undefined;
}>;
export type WorkflowStepExecution = z.infer<typeof WorkflowStepExecutionSchema>;
export declare const WorkflowCheckpointSchema: z.ZodObject<{
    id: z.ZodString;
    executionId: z.ZodString;
    state: z.ZodEnum<["idle", "parsing", "validating", "building_graph", "scheduling", "executing", "awaiting_completion", "creating_checkpoint", "restoring_checkpoint", "aggregating_results", "completed", "failed", "paused", "cancelled"]>;
    context: z.ZodString;
    completedSteps: z.ZodString;
    pendingSteps: z.ZodString;
    createdAt: z.ZodNumber;
    createdBy: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    context: string;
    createdAt: number;
    state: "completed" | "failed" | "cancelled" | "idle" | "paused" | "validating" | "parsing" | "building_graph" | "scheduling" | "executing" | "awaiting_completion" | "creating_checkpoint" | "restoring_checkpoint" | "aggregating_results";
    executionId: string;
    completedSteps: string;
    pendingSteps: string;
    label?: string | undefined;
    createdBy?: string | undefined;
    sizeBytes?: number | undefined;
}, {
    id: string;
    context: string;
    createdAt: number;
    state: "completed" | "failed" | "cancelled" | "idle" | "paused" | "validating" | "parsing" | "building_graph" | "scheduling" | "executing" | "awaiting_completion" | "creating_checkpoint" | "restoring_checkpoint" | "aggregating_results";
    executionId: string;
    completedSteps: string;
    pendingSteps: string;
    label?: string | undefined;
    createdBy?: string | undefined;
    sizeBytes?: number | undefined;
}>;
export type WorkflowCheckpoint = z.infer<typeof WorkflowCheckpointSchema>;
export declare const WorkflowEventTypeSchema: z.ZodEnum<["workflow_created", "workflow_started", "workflow_paused", "workflow_resumed", "workflow_completed", "workflow_failed", "workflow_cancelled", "step_started", "step_completed", "step_failed", "step_retried", "step_skipped", "state_transition", "checkpoint_created", "checkpoint_restored", "error_occurred"]>;
export type WorkflowEventType = z.infer<typeof WorkflowEventTypeSchema>;
export declare const WorkflowEventSchema: z.ZodObject<{
    id: z.ZodString;
    executionId: z.ZodString;
    eventType: z.ZodEnum<["workflow_created", "workflow_started", "workflow_paused", "workflow_resumed", "workflow_completed", "workflow_failed", "workflow_cancelled", "step_started", "step_completed", "step_failed", "step_retried", "step_skipped", "state_transition", "checkpoint_created", "checkpoint_restored", "error_occurred"]>;
    eventData: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    executionId: string;
    timestamp: number;
    eventType: "workflow_created" | "workflow_started" | "workflow_paused" | "workflow_resumed" | "workflow_completed" | "workflow_failed" | "workflow_cancelled" | "step_started" | "step_completed" | "step_failed" | "step_retried" | "step_skipped" | "state_transition" | "checkpoint_created" | "checkpoint_restored" | "error_occurred";
    eventData?: string | undefined;
}, {
    id: string;
    executionId: string;
    timestamp: number;
    eventType: "workflow_created" | "workflow_started" | "workflow_paused" | "workflow_resumed" | "workflow_completed" | "workflow_failed" | "workflow_cancelled" | "step_started" | "step_completed" | "step_failed" | "step_retried" | "step_skipped" | "state_transition" | "checkpoint_created" | "checkpoint_restored" | "error_occurred";
    eventData?: string | undefined;
}>;
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;
export declare const DependencyNodeSchema: z.ZodObject<{
    stepKey: z.ZodString;
    dependencies: z.ZodArray<z.ZodString, "many">;
    dependents: z.ZodArray<z.ZodString, "many">;
    level: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    dependencies: string[];
    level: number;
    stepKey: string;
    dependents: string[];
}, {
    dependencies: string[];
    level: number;
    stepKey: string;
    dependents: string[];
}>;
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;
export declare const DependencyGraphSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        stepKey: z.ZodString;
        dependencies: z.ZodArray<z.ZodString, "many">;
        dependents: z.ZodArray<z.ZodString, "many">;
        level: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        dependencies: string[];
        level: number;
        stepKey: string;
        dependents: string[];
    }, {
        dependencies: string[];
        level: number;
        stepKey: string;
        dependents: string[];
    }>, "many">;
    hasCycle: z.ZodBoolean;
    topologicalOrder: z.ZodArray<z.ZodString, "many">;
    levels: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
}, "strip", z.ZodTypeAny, {
    nodes: {
        dependencies: string[];
        level: number;
        stepKey: string;
        dependents: string[];
    }[];
    hasCycle: boolean;
    topologicalOrder: string[];
    levels: string[][];
}, {
    nodes: {
        dependencies: string[];
        level: number;
        stepKey: string;
        dependents: string[];
    }[];
    hasCycle: boolean;
    topologicalOrder: string[];
    levels: string[][];
}>;
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;
export declare const WorkflowResultSchema: z.ZodObject<{
    executionId: z.ZodString;
    workflowId: z.ZodString;
    workflowName: z.ZodString;
    state: z.ZodEnum<["idle", "parsing", "validating", "building_graph", "scheduling", "executing", "awaiting_completion", "creating_checkpoint", "restoring_checkpoint", "aggregating_results", "completed", "failed", "paused", "cancelled"]>;
    context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    stepResults: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    context: Record<string, unknown>;
    state: "completed" | "failed" | "cancelled" | "idle" | "paused" | "validating" | "parsing" | "building_graph" | "scheduling" | "executing" | "awaiting_completion" | "creating_checkpoint" | "restoring_checkpoint" | "aggregating_results";
    executionId: string;
    workflowId: string;
    workflowName: string;
    stepResults: Record<string, unknown>;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    error?: string | undefined;
    durationMs?: number | undefined;
}, {
    context: Record<string, unknown>;
    state: "completed" | "failed" | "cancelled" | "idle" | "paused" | "validating" | "parsing" | "building_graph" | "scheduling" | "executing" | "awaiting_completion" | "creating_checkpoint" | "restoring_checkpoint" | "aggregating_results";
    executionId: string;
    workflowId: string;
    workflowName: string;
    stepResults: Record<string, unknown>;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    error?: string | undefined;
    durationMs?: number | undefined;
}>;
export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;
export declare const WorkflowExecutionOptionsSchema: z.ZodObject<{
    triggeredBy: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    parentExecutionId: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    resumeFromCheckpoint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    priority?: number | undefined;
    context?: Record<string, unknown> | undefined;
    triggeredBy?: string | undefined;
    parentExecutionId?: string | undefined;
    resumeFromCheckpoint?: string | undefined;
}, {
    priority?: number | undefined;
    context?: Record<string, unknown> | undefined;
    triggeredBy?: string | undefined;
    parentExecutionId?: string | undefined;
    resumeFromCheckpoint?: string | undefined;
}>;
export type WorkflowExecutionOptions = z.infer<typeof WorkflowExecutionOptionsSchema>;
export declare const StepScheduleSchema: z.ZodObject<{
    levels: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    totalSteps: z.ZodNumber;
    maxParallelism: z.ZodNumber;
    estimatedDurationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    levels: string[][];
    totalSteps: number;
    maxParallelism: number;
    estimatedDurationMs?: number | undefined;
}, {
    levels: string[][];
    totalSteps: number;
    maxParallelism: number;
    estimatedDurationMs?: number | undefined;
}>;
export type StepSchedule = z.infer<typeof StepScheduleSchema>;
export declare const WorkflowStatsSchema: z.ZodObject<{
    workflowId: z.ZodString;
    workflowName: z.ZodString;
    version: z.ZodString;
    totalExecutions: z.ZodNumber;
    successfulExecutions: z.ZodNumber;
    failedExecutions: z.ZodNumber;
    successRatePercent: z.ZodNumber;
    avgDurationMs: z.ZodOptional<z.ZodNumber>;
    activeExecutions: z.ZodNumber;
    lastExecutionAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    version: string;
    workflowId: string;
    workflowName: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRatePercent: number;
    activeExecutions: number;
    avgDurationMs?: number | undefined;
    lastExecutionAt?: number | undefined;
}, {
    version: string;
    workflowId: string;
    workflowName: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRatePercent: number;
    activeExecutions: number;
    avgDurationMs?: number | undefined;
    lastExecutionAt?: number | undefined;
}>;
export type WorkflowStats = z.infer<typeof WorkflowStatsSchema>;
/**
 * Parse and validate a workflow definition from JSON string
 */
export declare function parseWorkflowDefinition(jsonString: string): WorkflowDefinition;
/**
 * Parse and validate workflow context from JSON string
 */
export declare function parseWorkflowContext(jsonString: string): WorkflowContext;
/**
 * Validate a workflow definition object
 */
export declare function validateWorkflowDefinition(definition: unknown): WorkflowDefinition;
/**
 * Validate workflow execution options
 */
export declare function validateExecutionOptions(options: unknown): WorkflowExecutionOptions;
/**
 * Check if a workflow state is terminal
 */
export declare function isTerminalState(state: WorkflowState): boolean;
/**
 * Check if a workflow can be resumed
 */
export declare function canResumeFromState(state: WorkflowState): boolean;
/**
 * Check if a step execution state is terminal
 */
export declare function isStepTerminalState(state: StepExecutionState): boolean;
//# sourceMappingURL=workflow.schema.d.ts.map