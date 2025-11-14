import { z } from 'zod';
export declare const WorkflowStateSchema: z.ZodEnum<{
    paused: "paused";
    completed: "completed";
    failed: "failed";
    cancelled: "cancelled";
    idle: "idle";
    parsing: "parsing";
    executing: "executing";
    validating: "validating";
    building_graph: "building_graph";
    scheduling: "scheduling";
    awaiting_completion: "awaiting_completion";
    creating_checkpoint: "creating_checkpoint";
    restoring_checkpoint: "restoring_checkpoint";
    aggregating_results: "aggregating_results";
}>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
export declare const RetryPolicySchema: z.ZodObject<{
    maxRetries: z.ZodDefault<z.ZodNumber>;
    retryDelayMs: z.ZodDefault<z.ZodNumber>;
    retryBackoffMultiplier: z.ZodDefault<z.ZodNumber>;
    retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export declare const WorkflowStepSchema: z.ZodObject<{
    key: z.ZodString;
    agent: z.ZodString;
    prompt: z.ZodString;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
    parallel: z.ZodDefault<z.ZodBoolean>;
    optional: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    retryPolicy: z.ZodOptional<z.ZodObject<{
        maxRetries: z.ZodDefault<z.ZodNumber>;
        retryDelayMs: z.ZodDefault<z.ZodNumber>;
        retryBackoffMultiplier: z.ZodDefault<z.ZodNumber>;
        retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    outputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export declare const WorkflowConfigSchema: z.ZodObject<{
    timeout: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    checkpointInterval: z.ZodOptional<z.ZodNumber>;
    parallelism: z.ZodDefault<z.ZodNumber>;
    continueOnError: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export declare const WorkflowDefinitionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    version: z.ZodDefault<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        agent: z.ZodString;
        prompt: z.ZodString;
        dependencies: z.ZodDefault<z.ZodArray<z.ZodString>>;
        parallel: z.ZodDefault<z.ZodBoolean>;
        optional: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        retryPolicy: z.ZodOptional<z.ZodObject<{
            maxRetries: z.ZodDefault<z.ZodNumber>;
            retryDelayMs: z.ZodDefault<z.ZodNumber>;
            retryBackoffMultiplier: z.ZodDefault<z.ZodNumber>;
            retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        outputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    config: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        maxRetries: z.ZodDefault<z.ZodNumber>;
        checkpointInterval: z.ZodOptional<z.ZodNumber>;
        parallelism: z.ZodDefault<z.ZodNumber>;
        continueOnError: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    author: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
}, z.core.$strip>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export declare const WorkflowContextSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;
export declare const WorkflowExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    workflowId: z.ZodString;
    state: z.ZodEnum<{
        paused: "paused";
        completed: "completed";
        failed: "failed";
        cancelled: "cancelled";
        idle: "idle";
        parsing: "parsing";
        executing: "executing";
        validating: "validating";
        building_graph: "building_graph";
        scheduling: "scheduling";
        awaiting_completion: "awaiting_completion";
        creating_checkpoint: "creating_checkpoint";
        restoring_checkpoint: "restoring_checkpoint";
        aggregating_results: "aggregating_results";
    }>;
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
}, z.core.$strip>;
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export declare const StepExecutionStateSchema: z.ZodEnum<{
    running: "running";
    pending: "pending";
    completed: "completed";
    failed: "failed";
    skipped: "skipped";
    cancelled: "cancelled";
}>;
export type StepExecutionState = z.infer<typeof StepExecutionStateSchema>;
export declare const WorkflowStepExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    executionId: z.ZodString;
    stepId: z.ZodString;
    state: z.ZodEnum<{
        running: "running";
        pending: "pending";
        completed: "completed";
        failed: "failed";
        skipped: "skipped";
        cancelled: "cancelled";
    }>;
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
}, z.core.$strip>;
export type WorkflowStepExecution = z.infer<typeof WorkflowStepExecutionSchema>;
export declare const WorkflowCheckpointSchema: z.ZodObject<{
    id: z.ZodString;
    executionId: z.ZodString;
    state: z.ZodEnum<{
        paused: "paused";
        completed: "completed";
        failed: "failed";
        cancelled: "cancelled";
        idle: "idle";
        parsing: "parsing";
        executing: "executing";
        validating: "validating";
        building_graph: "building_graph";
        scheduling: "scheduling";
        awaiting_completion: "awaiting_completion";
        creating_checkpoint: "creating_checkpoint";
        restoring_checkpoint: "restoring_checkpoint";
        aggregating_results: "aggregating_results";
    }>;
    context: z.ZodString;
    completedSteps: z.ZodString;
    pendingSteps: z.ZodString;
    createdAt: z.ZodNumber;
    createdBy: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type WorkflowCheckpoint = z.infer<typeof WorkflowCheckpointSchema>;
export declare const WorkflowEventTypeSchema: z.ZodEnum<{
    workflow_created: "workflow_created";
    workflow_started: "workflow_started";
    workflow_paused: "workflow_paused";
    workflow_resumed: "workflow_resumed";
    workflow_completed: "workflow_completed";
    workflow_failed: "workflow_failed";
    workflow_cancelled: "workflow_cancelled";
    step_started: "step_started";
    step_completed: "step_completed";
    step_failed: "step_failed";
    step_retried: "step_retried";
    step_skipped: "step_skipped";
    state_transition: "state_transition";
    checkpoint_created: "checkpoint_created";
    checkpoint_restored: "checkpoint_restored";
    error_occurred: "error_occurred";
}>;
export type WorkflowEventType = z.infer<typeof WorkflowEventTypeSchema>;
export declare const WorkflowEventSchema: z.ZodObject<{
    id: z.ZodString;
    executionId: z.ZodString;
    eventType: z.ZodEnum<{
        workflow_created: "workflow_created";
        workflow_started: "workflow_started";
        workflow_paused: "workflow_paused";
        workflow_resumed: "workflow_resumed";
        workflow_completed: "workflow_completed";
        workflow_failed: "workflow_failed";
        workflow_cancelled: "workflow_cancelled";
        step_started: "step_started";
        step_completed: "step_completed";
        step_failed: "step_failed";
        step_retried: "step_retried";
        step_skipped: "step_skipped";
        state_transition: "state_transition";
        checkpoint_created: "checkpoint_created";
        checkpoint_restored: "checkpoint_restored";
        error_occurred: "error_occurred";
    }>;
    eventData: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;
export declare const DependencyNodeSchema: z.ZodObject<{
    stepKey: z.ZodString;
    dependencies: z.ZodArray<z.ZodString>;
    dependents: z.ZodArray<z.ZodString>;
    level: z.ZodNumber;
}, z.core.$strip>;
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;
export declare const DependencyGraphSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        stepKey: z.ZodString;
        dependencies: z.ZodArray<z.ZodString>;
        dependents: z.ZodArray<z.ZodString>;
        level: z.ZodNumber;
    }, z.core.$strip>>;
    hasCycle: z.ZodBoolean;
    topologicalOrder: z.ZodArray<z.ZodString>;
    levels: z.ZodArray<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;
export declare const WorkflowResultSchema: z.ZodObject<{
    executionId: z.ZodString;
    workflowId: z.ZodString;
    workflowName: z.ZodString;
    state: z.ZodEnum<{
        paused: "paused";
        completed: "completed";
        failed: "failed";
        cancelled: "cancelled";
        idle: "idle";
        parsing: "parsing";
        executing: "executing";
        validating: "validating";
        building_graph: "building_graph";
        scheduling: "scheduling";
        awaiting_completion: "awaiting_completion";
        creating_checkpoint: "creating_checkpoint";
        restoring_checkpoint: "restoring_checkpoint";
        aggregating_results: "aggregating_results";
    }>;
    context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    stepResults: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;
export declare const WorkflowExecutionOptionsSchema: z.ZodObject<{
    triggeredBy: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    parentExecutionId: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    resumeFromCheckpoint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WorkflowExecutionOptions = z.infer<typeof WorkflowExecutionOptionsSchema>;
export declare const StepScheduleSchema: z.ZodObject<{
    levels: z.ZodArray<z.ZodArray<z.ZodString>>;
    totalSteps: z.ZodNumber;
    maxParallelism: z.ZodNumber;
    estimatedDurationMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
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
}, z.core.$strip>;
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