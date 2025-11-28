import { z } from 'zod';

/**
 * Session schemas for AutomatosX
 * @module @ax/schemas/session
 */

/**
 * A task within a session
 */
declare const SessionTaskSchema: z.ZodObject<{
    /** Unique task identifier */
    id: z.ZodString;
    /** Task description */
    description: z.ZodString;
    /** Agent assigned to this task */
    agentId: z.ZodString;
    /** Current status */
    status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
    /** Task result/output */
    result: z.ZodOptional<z.ZodString>;
    /** Error if failed */
    error: z.ZodOptional<z.ZodString>;
    /** Start timestamp */
    startedAt: z.ZodOptional<z.ZodDate>;
    /** Completion timestamp */
    completedAt: z.ZodOptional<z.ZodDate>;
    /** Duration in milliseconds */
    duration: z.ZodOptional<z.ZodNumber>;
    /** Parent task ID (for subtasks) */
    parentTaskId: z.ZodOptional<z.ZodString>;
    /** Delegated from agent */
    delegatedFrom: z.ZodOptional<z.ZodString>;
    /** Task metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    agentId: string;
    id: string;
    description: string;
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    duration?: number | undefined;
    result?: string | undefined;
    startedAt?: Date | undefined;
    completedAt?: Date | undefined;
    parentTaskId?: string | undefined;
    delegatedFrom?: string | undefined;
}, {
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    agentId: string;
    id: string;
    description: string;
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    duration?: number | undefined;
    result?: string | undefined;
    startedAt?: Date | undefined;
    completedAt?: Date | undefined;
    parentTaskId?: string | undefined;
    delegatedFrom?: string | undefined;
}>;
type SessionTask = z.infer<typeof SessionTaskSchema>;
/**
 * Session state
 */
declare const SessionState: z.ZodEnum<["active", "paused", "completed", "failed", "cancelled"]>;
type SessionState = z.infer<typeof SessionState>;
/**
 * Multi-agent session
 */
declare const SessionSchema: z.ZodObject<{
    /** Unique session identifier */
    id: z.ZodBranded<z.ZodString, "SessionId">;
    /** Session name/title */
    name: z.ZodString;
    /** Session description */
    description: z.ZodOptional<z.ZodString>;
    /** Current state */
    state: z.ZodDefault<z.ZodEnum<["active", "paused", "completed", "failed", "cancelled"]>>;
    /** Agents participating in this session */
    agents: z.ZodArray<z.ZodString, "many">;
    /** Tasks in this session */
    tasks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Unique task identifier */
        id: z.ZodString;
        /** Task description */
        description: z.ZodString;
        /** Agent assigned to this task */
        agentId: z.ZodString;
        /** Current status */
        status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
        /** Task result/output */
        result: z.ZodOptional<z.ZodString>;
        /** Error if failed */
        error: z.ZodOptional<z.ZodString>;
        /** Start timestamp */
        startedAt: z.ZodOptional<z.ZodDate>;
        /** Completion timestamp */
        completedAt: z.ZodOptional<z.ZodDate>;
        /** Duration in milliseconds */
        duration: z.ZodOptional<z.ZodNumber>;
        /** Parent task ID (for subtasks) */
        parentTaskId: z.ZodOptional<z.ZodString>;
        /** Delegated from agent */
        delegatedFrom: z.ZodOptional<z.ZodString>;
        /** Task metadata */
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "running" | "completed" | "failed" | "cancelled";
        agentId: string;
        id: string;
        description: string;
        error?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        result?: string | undefined;
        startedAt?: Date | undefined;
        completedAt?: Date | undefined;
        parentTaskId?: string | undefined;
        delegatedFrom?: string | undefined;
    }, {
        status: "pending" | "running" | "completed" | "failed" | "cancelled";
        agentId: string;
        id: string;
        description: string;
        error?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        result?: string | undefined;
        startedAt?: Date | undefined;
        completedAt?: Date | undefined;
        parentTaskId?: string | undefined;
        delegatedFrom?: string | undefined;
    }>, "many">>;
    /** Creation timestamp */
    createdAt: z.ZodDate;
    /** Last update timestamp */
    updatedAt: z.ZodDate;
    /** Completion timestamp */
    completedAt: z.ZodOptional<z.ZodDate>;
    /** Total duration in milliseconds */
    duration: z.ZodOptional<z.ZodNumber>;
    /** Session goal/objective */
    goal: z.ZodOptional<z.ZodString>;
    /** Session tags */
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Session metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    tags: string[];
    id: string & z.BRAND<"SessionId">;
    createdAt: Date;
    agents: string[];
    name: string;
    updatedAt: Date;
    state: "completed" | "failed" | "cancelled" | "active" | "paused";
    tasks: {
        status: "pending" | "running" | "completed" | "failed" | "cancelled";
        agentId: string;
        id: string;
        description: string;
        error?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        result?: string | undefined;
        startedAt?: Date | undefined;
        completedAt?: Date | undefined;
        parentTaskId?: string | undefined;
        delegatedFrom?: string | undefined;
    }[];
    metadata?: Record<string, unknown> | undefined;
    duration?: number | undefined;
    description?: string | undefined;
    completedAt?: Date | undefined;
    goal?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    agents: string[];
    name: string;
    updatedAt: Date;
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
    duration?: number | undefined;
    description?: string | undefined;
    completedAt?: Date | undefined;
    state?: "completed" | "failed" | "cancelled" | "active" | "paused" | undefined;
    tasks?: {
        status: "pending" | "running" | "completed" | "failed" | "cancelled";
        agentId: string;
        id: string;
        description: string;
        error?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        result?: string | undefined;
        startedAt?: Date | undefined;
        completedAt?: Date | undefined;
        parentTaskId?: string | undefined;
        delegatedFrom?: string | undefined;
    }[] | undefined;
    goal?: string | undefined;
}>;
type Session = z.infer<typeof SessionSchema>;
/**
 * Execution checkpoint for resume capability
 */
declare const CheckpointSchema: z.ZodObject<{
    /** Unique checkpoint identifier */
    id: z.ZodBranded<z.ZodString, "CheckpointId">;
    /** Session ID this checkpoint belongs to */
    sessionId: z.ZodBranded<z.ZodString, "SessionId">;
    /** Checkpoint name */
    name: z.ZodDefault<z.ZodString>;
    /** Checkpoint creation timestamp */
    createdAt: z.ZodDate;
    /** Session state at checkpoint */
    sessionState: z.ZodObject<{
        /** Unique session identifier */
        id: z.ZodBranded<z.ZodString, "SessionId">;
        /** Session name/title */
        name: z.ZodString;
        /** Session description */
        description: z.ZodOptional<z.ZodString>;
        /** Current state */
        state: z.ZodDefault<z.ZodEnum<["active", "paused", "completed", "failed", "cancelled"]>>;
        /** Agents participating in this session */
        agents: z.ZodArray<z.ZodString, "many">;
        /** Tasks in this session */
        tasks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            /** Unique task identifier */
            id: z.ZodString;
            /** Task description */
            description: z.ZodString;
            /** Agent assigned to this task */
            agentId: z.ZodString;
            /** Current status */
            status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
            /** Task result/output */
            result: z.ZodOptional<z.ZodString>;
            /** Error if failed */
            error: z.ZodOptional<z.ZodString>;
            /** Start timestamp */
            startedAt: z.ZodOptional<z.ZodDate>;
            /** Completion timestamp */
            completedAt: z.ZodOptional<z.ZodDate>;
            /** Duration in milliseconds */
            duration: z.ZodOptional<z.ZodNumber>;
            /** Parent task ID (for subtasks) */
            parentTaskId: z.ZodOptional<z.ZodString>;
            /** Delegated from agent */
            delegatedFrom: z.ZodOptional<z.ZodString>;
            /** Task metadata */
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            agentId: string;
            id: string;
            description: string;
            error?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
            duration?: number | undefined;
            result?: string | undefined;
            startedAt?: Date | undefined;
            completedAt?: Date | undefined;
            parentTaskId?: string | undefined;
            delegatedFrom?: string | undefined;
        }, {
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            agentId: string;
            id: string;
            description: string;
            error?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
            duration?: number | undefined;
            result?: string | undefined;
            startedAt?: Date | undefined;
            completedAt?: Date | undefined;
            parentTaskId?: string | undefined;
            delegatedFrom?: string | undefined;
        }>, "many">>;
        /** Creation timestamp */
        createdAt: z.ZodDate;
        /** Last update timestamp */
        updatedAt: z.ZodDate;
        /** Completion timestamp */
        completedAt: z.ZodOptional<z.ZodDate>;
        /** Total duration in milliseconds */
        duration: z.ZodOptional<z.ZodNumber>;
        /** Session goal/objective */
        goal: z.ZodOptional<z.ZodString>;
        /** Session tags */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Session metadata */
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        id: string & z.BRAND<"SessionId">;
        createdAt: Date;
        agents: string[];
        name: string;
        updatedAt: Date;
        state: "completed" | "failed" | "cancelled" | "active" | "paused";
        tasks: {
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            agentId: string;
            id: string;
            description: string;
            error?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
            duration?: number | undefined;
            result?: string | undefined;
            startedAt?: Date | undefined;
            completedAt?: Date | undefined;
            parentTaskId?: string | undefined;
            delegatedFrom?: string | undefined;
        }[];
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        description?: string | undefined;
        completedAt?: Date | undefined;
        goal?: string | undefined;
    }, {
        id: string;
        createdAt: Date;
        agents: string[];
        name: string;
        updatedAt: Date;
        tags?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        description?: string | undefined;
        completedAt?: Date | undefined;
        state?: "completed" | "failed" | "cancelled" | "active" | "paused" | undefined;
        tasks?: {
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            agentId: string;
            id: string;
            description: string;
            error?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
            duration?: number | undefined;
            result?: string | undefined;
            startedAt?: Date | undefined;
            completedAt?: Date | undefined;
            parentTaskId?: string | undefined;
            delegatedFrom?: string | undefined;
        }[] | undefined;
        goal?: string | undefined;
    }>;
    /** Current task index */
    currentTaskIndex: z.ZodNumber;
    /** Completed task IDs */
    completedTaskIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Execution context snapshot */
    contextSnapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Memory entries created since session start */
    memoryEntryIds: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    /** Is this an auto-save checkpoint */
    isAutoSave: z.ZodDefault<z.ZodBoolean>;
    /** Checkpoint metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    sessionId: string & z.BRAND<"SessionId">;
    id: string & z.BRAND<"CheckpointId">;
    createdAt: Date;
    name: string;
    sessionState: {
        tags: string[];
        id: string & z.BRAND<"SessionId">;
        createdAt: Date;
        agents: string[];
        name: string;
        updatedAt: Date;
        state: "completed" | "failed" | "cancelled" | "active" | "paused";
        tasks: {
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            agentId: string;
            id: string;
            description: string;
            error?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
            duration?: number | undefined;
            result?: string | undefined;
            startedAt?: Date | undefined;
            completedAt?: Date | undefined;
            parentTaskId?: string | undefined;
            delegatedFrom?: string | undefined;
        }[];
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        description?: string | undefined;
        completedAt?: Date | undefined;
        goal?: string | undefined;
    };
    currentTaskIndex: number;
    completedTaskIds: string[];
    memoryEntryIds: number[];
    isAutoSave: boolean;
    metadata?: Record<string, unknown> | undefined;
    contextSnapshot?: Record<string, unknown> | undefined;
}, {
    sessionId: string;
    id: string;
    createdAt: Date;
    sessionState: {
        id: string;
        createdAt: Date;
        agents: string[];
        name: string;
        updatedAt: Date;
        tags?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
        description?: string | undefined;
        completedAt?: Date | undefined;
        state?: "completed" | "failed" | "cancelled" | "active" | "paused" | undefined;
        tasks?: {
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            agentId: string;
            id: string;
            description: string;
            error?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
            duration?: number | undefined;
            result?: string | undefined;
            startedAt?: Date | undefined;
            completedAt?: Date | undefined;
            parentTaskId?: string | undefined;
            delegatedFrom?: string | undefined;
        }[] | undefined;
        goal?: string | undefined;
    };
    currentTaskIndex: number;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    completedTaskIds?: string[] | undefined;
    contextSnapshot?: Record<string, unknown> | undefined;
    memoryEntryIds?: number[] | undefined;
    isAutoSave?: boolean | undefined;
}>;
type Checkpoint = z.infer<typeof CheckpointSchema>;
/**
 * Input for creating a new session
 */
declare const CreateSessionInputSchema: z.ZodObject<{
    /** Session name (optional, defaults to 'Untitled Session') */
    name: z.ZodOptional<z.ZodString>;
    /** Session description */
    description: z.ZodOptional<z.ZodString>;
    /** Initial agents */
    agents: z.ZodArray<z.ZodString, "many">;
    /** Session goal */
    goal: z.ZodOptional<z.ZodString>;
    /** Initial tasks */
    tasks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        agentId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        agentId: string;
        description: string;
    }, {
        agentId: string;
        description: string;
    }>, "many">>;
    /** Session tags */
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Session metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    agents: string[];
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    description?: string | undefined;
    tasks?: {
        agentId: string;
        description: string;
    }[] | undefined;
    goal?: string | undefined;
}, {
    agents: string[];
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    description?: string | undefined;
    tasks?: {
        agentId: string;
        description: string;
    }[] | undefined;
    goal?: string | undefined;
}>;
type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;
/**
 * Input for adding a task to session
 */
declare const AddTaskInputSchema: z.ZodObject<{
    /** Session ID */
    sessionId: z.ZodBranded<z.ZodString, "SessionId">;
    /** Task description */
    description: z.ZodString;
    /** Agent to assign */
    agentId: z.ZodString;
    /** Parent task ID */
    parentTaskId: z.ZodOptional<z.ZodString>;
    /** Task metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    sessionId: string & z.BRAND<"SessionId">;
    description: string;
    metadata?: Record<string, unknown> | undefined;
    parentTaskId?: string | undefined;
}, {
    agentId: string;
    sessionId: string;
    description: string;
    metadata?: Record<string, unknown> | undefined;
    parentTaskId?: string | undefined;
}>;
type AddTaskInput = z.infer<typeof AddTaskInputSchema>;
/**
 * Input for updating task status
 */
declare const UpdateTaskInputSchema: z.ZodObject<{
    /** Session ID */
    sessionId: z.ZodBranded<z.ZodString, "SessionId">;
    /** Task ID */
    taskId: z.ZodString;
    /** New status */
    status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
    /** Result if completed */
    result: z.ZodOptional<z.ZodString>;
    /** Error if failed */
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    sessionId: string & z.BRAND<"SessionId">;
    taskId: string;
    error?: string | undefined;
    result?: string | undefined;
}, {
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    sessionId: string;
    taskId: string;
    error?: string | undefined;
    result?: string | undefined;
}>;
type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
/**
 * Session summary for listing
 */
declare const SessionSummarySchema: z.ZodObject<{
    /** Session ID */
    id: z.ZodBranded<z.ZodString, "SessionId">;
    /** Session name */
    name: z.ZodString;
    /** Current state */
    state: z.ZodEnum<["active", "paused", "completed", "failed", "cancelled"]>;
    /** Number of agents */
    agentCount: z.ZodNumber;
    /** Total tasks */
    totalTasks: z.ZodNumber;
    /** Completed tasks */
    completedTasks: z.ZodNumber;
    /** Failed tasks */
    failedTasks: z.ZodNumber;
    /** Creation timestamp */
    createdAt: z.ZodDate;
    /** Last update timestamp */
    updatedAt: z.ZodDate;
    /** Duration so far */
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string & z.BRAND<"SessionId">;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    state: "completed" | "failed" | "cancelled" | "active" | "paused";
    agentCount: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    duration?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    name: string;
    updatedAt: Date;
    state: "completed" | "failed" | "cancelled" | "active" | "paused";
    agentCount: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    duration?: number | undefined;
}>;
type SessionSummary = z.infer<typeof SessionSummarySchema>;
/**
 * Create session summary from full session
 */
declare function createSessionSummary(session: Session): SessionSummary;
/**
 * Delegation request from one agent to another
 */
declare const DelegationRequestSchema: z.ZodObject<{
    /** Source agent */
    fromAgent: z.ZodString;
    /** Target agent */
    toAgent: z.ZodString;
    /** Task to delegate */
    task: z.ZodString;
    /** Delegation context */
    context: z.ZodDefault<z.ZodObject<{
        /** Shared data between agents */
        sharedData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        /** Requirements for the delegated task */
        requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Expected outputs */
        expectedOutputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Session ID */
        sessionId: z.ZodOptional<z.ZodBranded<z.ZodString, "SessionId">>;
        /** Delegation chain for tracking depth */
        delegationChain: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        delegationChain: string[];
        sessionId?: (string & z.BRAND<"SessionId">) | undefined;
        sharedData?: Record<string, unknown> | undefined;
        requirements?: string[] | undefined;
        expectedOutputs?: string[] | undefined;
    }, {
        sessionId?: string | undefined;
        delegationChain?: string[] | undefined;
        sharedData?: Record<string, unknown> | undefined;
        requirements?: string[] | undefined;
        expectedOutputs?: string[] | undefined;
    }>>;
    /** Delegation options */
    options: z.ZodDefault<z.ZodObject<{
        /** Timeout for delegated task */
        timeout: z.ZodOptional<z.ZodNumber>;
        /** Priority level */
        priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high"]>>;
        /** Whether to wait for result */
        waitForResult: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        priority: "low" | "normal" | "high";
        waitForResult: boolean;
        timeout?: number | undefined;
    }, {
        timeout?: number | undefined;
        priority?: "low" | "normal" | "high" | undefined;
        waitForResult?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    options: {
        priority: "low" | "normal" | "high";
        waitForResult: boolean;
        timeout?: number | undefined;
    };
    task: string;
    context: {
        delegationChain: string[];
        sessionId?: (string & z.BRAND<"SessionId">) | undefined;
        sharedData?: Record<string, unknown> | undefined;
        requirements?: string[] | undefined;
        expectedOutputs?: string[] | undefined;
    };
    toAgent: string;
    fromAgent: string;
}, {
    task: string;
    toAgent: string;
    fromAgent: string;
    options?: {
        timeout?: number | undefined;
        priority?: "low" | "normal" | "high" | undefined;
        waitForResult?: boolean | undefined;
    } | undefined;
    context?: {
        sessionId?: string | undefined;
        delegationChain?: string[] | undefined;
        sharedData?: Record<string, unknown> | undefined;
        requirements?: string[] | undefined;
        expectedOutputs?: string[] | undefined;
    } | undefined;
}>;
type DelegationRequest = z.infer<typeof DelegationRequestSchema>;
/**
 * Delegation result
 */
declare const DelegationResultSchema: z.ZodObject<{
    /** Whether delegation was successful */
    success: z.ZodBoolean;
    /** Delegation request */
    request: z.ZodObject<{
        /** Source agent */
        fromAgent: z.ZodString;
        /** Target agent */
        toAgent: z.ZodString;
        /** Task to delegate */
        task: z.ZodString;
        /** Delegation context */
        context: z.ZodDefault<z.ZodObject<{
            /** Shared data between agents */
            sharedData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            /** Requirements for the delegated task */
            requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            /** Expected outputs */
            expectedOutputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            /** Session ID */
            sessionId: z.ZodOptional<z.ZodBranded<z.ZodString, "SessionId">>;
            /** Delegation chain for tracking depth */
            delegationChain: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            delegationChain: string[];
            sessionId?: (string & z.BRAND<"SessionId">) | undefined;
            sharedData?: Record<string, unknown> | undefined;
            requirements?: string[] | undefined;
            expectedOutputs?: string[] | undefined;
        }, {
            sessionId?: string | undefined;
            delegationChain?: string[] | undefined;
            sharedData?: Record<string, unknown> | undefined;
            requirements?: string[] | undefined;
            expectedOutputs?: string[] | undefined;
        }>>;
        /** Delegation options */
        options: z.ZodDefault<z.ZodObject<{
            /** Timeout for delegated task */
            timeout: z.ZodOptional<z.ZodNumber>;
            /** Priority level */
            priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high"]>>;
            /** Whether to wait for result */
            waitForResult: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            priority: "low" | "normal" | "high";
            waitForResult: boolean;
            timeout?: number | undefined;
        }, {
            timeout?: number | undefined;
            priority?: "low" | "normal" | "high" | undefined;
            waitForResult?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        options: {
            priority: "low" | "normal" | "high";
            waitForResult: boolean;
            timeout?: number | undefined;
        };
        task: string;
        context: {
            delegationChain: string[];
            sessionId?: (string & z.BRAND<"SessionId">) | undefined;
            sharedData?: Record<string, unknown> | undefined;
            requirements?: string[] | undefined;
            expectedOutputs?: string[] | undefined;
        };
        toAgent: string;
        fromAgent: string;
    }, {
        task: string;
        toAgent: string;
        fromAgent: string;
        options?: {
            timeout?: number | undefined;
            priority?: "low" | "normal" | "high" | undefined;
            waitForResult?: boolean | undefined;
        } | undefined;
        context?: {
            sessionId?: string | undefined;
            delegationChain?: string[] | undefined;
            sharedData?: Record<string, unknown> | undefined;
            requirements?: string[] | undefined;
            expectedOutputs?: string[] | undefined;
        } | undefined;
    }>;
    /** Result from delegated agent */
    result: z.ZodOptional<z.ZodString>;
    /** Error if failed */
    error: z.ZodOptional<z.ZodString>;
    /** Execution duration */
    duration: z.ZodNumber;
    /** Agent that completed the task */
    completedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    duration: number;
    request: {
        options: {
            priority: "low" | "normal" | "high";
            waitForResult: boolean;
            timeout?: number | undefined;
        };
        task: string;
        context: {
            delegationChain: string[];
            sessionId?: (string & z.BRAND<"SessionId">) | undefined;
            sharedData?: Record<string, unknown> | undefined;
            requirements?: string[] | undefined;
            expectedOutputs?: string[] | undefined;
        };
        toAgent: string;
        fromAgent: string;
    };
    completedBy: string;
    error?: string | undefined;
    result?: string | undefined;
}, {
    success: boolean;
    duration: number;
    request: {
        task: string;
        toAgent: string;
        fromAgent: string;
        options?: {
            timeout?: number | undefined;
            priority?: "low" | "normal" | "high" | undefined;
            waitForResult?: boolean | undefined;
        } | undefined;
        context?: {
            sessionId?: string | undefined;
            delegationChain?: string[] | undefined;
            sharedData?: Record<string, unknown> | undefined;
            requirements?: string[] | undefined;
            expectedOutputs?: string[] | undefined;
        } | undefined;
    };
    completedBy: string;
    error?: string | undefined;
    result?: string | undefined;
}>;
type DelegationResult = z.infer<typeof DelegationResultSchema>;
/**
 * Validate session data
 */
declare function validateSession(data: unknown): Session;
/**
 * Validate checkpoint data
 */
declare function validateCheckpoint(data: unknown): Checkpoint;
/**
 * Validate create session input
 */
declare function validateCreateSessionInput(data: unknown): CreateSessionInput;

export { type AddTaskInput, AddTaskInputSchema, type Checkpoint, CheckpointSchema, type CreateSessionInput, CreateSessionInputSchema, type DelegationRequest, DelegationRequestSchema, type DelegationResult, DelegationResultSchema, type Session, SessionSchema, SessionState, type SessionSummary, SessionSummarySchema, type SessionTask, SessionTaskSchema, type UpdateTaskInput, UpdateTaskInputSchema, createSessionSummary, validateCheckpoint, validateCreateSessionInput, validateSession };
