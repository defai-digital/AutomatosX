import { z } from 'zod';
export declare const MemoryStateSchema: z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>;
export type MemoryState = z.infer<typeof MemoryStateSchema>;
export declare const MemoryEventSchema: z.ZodEnum<["create_conversation", "add_message", "search_messages", "archive_conversation", "delete_conversation", "restore_conversation"]>;
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;
export declare const MessageRoleSchema: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export declare const MessageSchema: z.ZodObject<{
    id: z.ZodString;
    conversationId: z.ZodString;
    role: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
    content: z.ZodString;
    tokens: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    role: "function" | "system" | "user" | "assistant" | "tool";
    conversationId: string;
    metadata?: Record<string, unknown> | undefined;
    tokens?: number | undefined;
}, {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    role: "function" | "system" | "user" | "assistant" | "tool";
    conversationId: string;
    metadata?: Record<string, unknown> | undefined;
    tokens?: number | undefined;
}>;
export type Message = z.infer<typeof MessageSchema>;
export declare const CreateMessageSchema: z.ZodObject<{
    conversationId: z.ZodString;
    role: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
    content: z.ZodString;
    tokens: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    role: "function" | "system" | "user" | "assistant" | "tool";
    conversationId: string;
    metadata?: Record<string, unknown> | undefined;
    tokens?: number | undefined;
}, {
    content: string;
    role: "function" | "system" | "user" | "assistant" | "tool";
    conversationId: string;
    metadata?: Record<string, unknown> | undefined;
    tokens?: number | undefined;
}>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export declare const ConversationSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    state: z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>;
    messageCount: z.ZodNumber;
    totalTokens: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    archivedAt: z.ZodOptional<z.ZodNumber>;
    deletedAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    totalTokens: number;
    agentId: string;
    state: "idle" | "active" | "searching" | "archived" | "deleted";
    messageCount: number;
    metadata?: Record<string, unknown> | undefined;
    userId?: string | undefined;
    archivedAt?: number | undefined;
    deletedAt?: number | undefined;
}, {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    totalTokens: number;
    agentId: string;
    state: "idle" | "active" | "searching" | "archived" | "deleted";
    messageCount: number;
    metadata?: Record<string, unknown> | undefined;
    userId?: string | undefined;
    archivedAt?: number | undefined;
    deletedAt?: number | undefined;
}>;
export type Conversation = z.infer<typeof ConversationSchema>;
export declare const CreateConversationSchema: z.ZodObject<{
    agentId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    agentId: string;
    metadata?: Record<string, unknown> | undefined;
    userId?: string | undefined;
}, {
    title: string;
    agentId: string;
    metadata?: Record<string, unknown> | undefined;
    userId?: string | undefined;
}>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
export declare const UpdateConversationSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    state?: "idle" | "active" | "searching" | "archived" | "deleted" | undefined;
}, {
    id: string;
    title?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    state?: "idle" | "active" | "searching" | "archived" | "deleted" | undefined;
}>;
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;
export declare const ConversationWithMessagesSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    state: z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>;
    messageCount: z.ZodNumber;
    totalTokens: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    archivedAt: z.ZodOptional<z.ZodNumber>;
    deletedAt: z.ZodOptional<z.ZodNumber>;
} & {
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
        content: z.ZodString;
        tokens: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }, {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }[];
    totalTokens: number;
    agentId: string;
    state: "idle" | "active" | "searching" | "archived" | "deleted";
    messageCount: number;
    metadata?: Record<string, unknown> | undefined;
    userId?: string | undefined;
    archivedAt?: number | undefined;
    deletedAt?: number | undefined;
}, {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }[];
    totalTokens: number;
    agentId: string;
    state: "idle" | "active" | "searching" | "archived" | "deleted";
    messageCount: number;
    metadata?: Record<string, unknown> | undefined;
    userId?: string | undefined;
    archivedAt?: number | undefined;
    deletedAt?: number | undefined;
}>;
export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;
export declare const AgentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    expertise: z.ZodArray<z.ZodString, "many">;
    capabilities: z.ZodArray<z.ZodString, "many">;
    allowedTools: z.ZodArray<z.ZodString, "many">;
    maxConcurrentTasks: z.ZodDefault<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    createdAt: number;
    capabilities: string[];
    updatedAt: number;
    expertise: string[];
    allowedTools: string[];
    maxConcurrentTasks: number;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    name: string;
    id: string;
    createdAt: number;
    capabilities: string[];
    updatedAt: number;
    expertise: string[];
    allowedTools: string[];
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    maxConcurrentTasks?: number | undefined;
}>;
export type Agent = z.infer<typeof AgentSchema>;
export declare const CreateAgentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    expertise: z.ZodArray<z.ZodString, "many">;
    capabilities: z.ZodArray<z.ZodString, "many">;
    allowedTools: z.ZodArray<z.ZodString, "many">;
    maxConcurrentTasks: z.ZodDefault<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    capabilities: string[];
    expertise: string[];
    allowedTools: string[];
    maxConcurrentTasks: number;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    name: string;
    id: string;
    capabilities: string[];
    expertise: string[];
    allowedTools: string[];
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    maxConcurrentTasks?: number | undefined;
}>;
export type CreateAgent = z.infer<typeof CreateAgentSchema>;
export declare const AgentStateSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    conversationId: z.ZodString;
    state: z.ZodEnum<["idle", "planning", "validating_task", "selecting_tools", "executing_tools", "processing_results", "delegating", "awaiting_delegation", "completing", "completed", "failed", "paused"]>;
    currentTask: z.ZodOptional<z.ZodString>;
    taskQueue: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: number;
    updatedAt: number;
    conversationId: string;
    agentId: string;
    state: "completed" | "failed" | "idle" | "planning" | "validating_task" | "selecting_tools" | "executing_tools" | "processing_results" | "delegating" | "awaiting_delegation" | "completing" | "paused";
    taskQueue: string[];
    metadata?: Record<string, unknown> | undefined;
    currentTask?: string | undefined;
}, {
    id: string;
    createdAt: number;
    updatedAt: number;
    conversationId: string;
    agentId: string;
    state: "completed" | "failed" | "idle" | "planning" | "validating_task" | "selecting_tools" | "executing_tools" | "processing_results" | "delegating" | "awaiting_delegation" | "completing" | "paused";
    metadata?: Record<string, unknown> | undefined;
    currentTask?: string | undefined;
    taskQueue?: string[] | undefined;
}>;
export type AgentState = z.infer<typeof AgentStateSchema>;
export declare const WorkflowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    definition: z.ZodString;
    status: z.ZodEnum<["pending", "running", "paused", "completed", "failed", "cancelled"]>;
    executionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    definition: string;
    id: string;
    status: "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
    createdAt: number;
    updatedAt: number;
    description?: string | undefined;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    executionId?: string | undefined;
}, {
    name: string;
    definition: string;
    id: string;
    status: "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
    createdAt: number;
    updatedAt: number;
    description?: string | undefined;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    executionId?: string | undefined;
}>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export declare const CreateWorkflowSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    definition: z.ZodString;
    executionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    definition: string;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    executionId?: string | undefined;
}, {
    name: string;
    definition: string;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    executionId?: string | undefined;
}>;
export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;
export declare const MemorySearchOptionsSchema: z.ZodObject<{
    query: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["user", "assistant", "system", "function", "tool"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["relevance", "createdAt", "updatedAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    skipCount: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    offset: number;
    includeArchived: boolean;
    includeDeleted: boolean;
    sortBy: "createdAt" | "updatedAt" | "relevance";
    sortOrder: "asc" | "desc";
    skipCount: boolean;
    role?: "function" | "system" | "user" | "assistant" | "tool" | undefined;
    conversationId?: string | undefined;
    agentId?: string | undefined;
    userId?: string | undefined;
}, {
    query: string;
    role?: "function" | "system" | "user" | "assistant" | "tool" | undefined;
    conversationId?: string | undefined;
    agentId?: string | undefined;
    userId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    includeArchived?: boolean | undefined;
    includeDeleted?: boolean | undefined;
    sortBy?: "createdAt" | "updatedAt" | "relevance" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    skipCount?: boolean | undefined;
}>;
export type MemorySearchOptions = z.infer<typeof MemorySearchOptionsSchema>;
export declare const MemorySearchResultSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
        content: z.ZodString;
        tokens: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }, {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }>, "many">;
    conversations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        state: z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>;
        messageCount: z.ZodNumber;
        totalTokens: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        archivedAt: z.ZodOptional<z.ZodNumber>;
        deletedAt: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }, {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }>, "many">;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    messages: {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }[];
    limit: number;
    offset: number;
    conversations: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }[];
    total: number;
    hasMore: boolean;
}, {
    messages: {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }[];
    limit: number;
    offset: number;
    conversations: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }[];
    total: number;
    hasMore: boolean;
}>;
export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;
export declare const MemoryStatsSchema: z.ZodObject<{
    totalConversations: z.ZodNumber;
    activeConversations: z.ZodNumber;
    archivedConversations: z.ZodNumber;
    deletedConversations: z.ZodNumber;
    totalMessages: z.ZodNumber;
    totalTokens: z.ZodNumber;
    averageMessagesPerConversation: z.ZodNumber;
    averageTokensPerMessage: z.ZodNumber;
    oldestConversation: z.ZodOptional<z.ZodNumber>;
    newestConversation: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    totalTokens: number;
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    deletedConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    averageTokensPerMessage: number;
    oldestConversation?: number | undefined;
    newestConversation?: number | undefined;
}, {
    totalTokens: number;
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    deletedConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    averageTokensPerMessage: number;
    oldestConversation?: number | undefined;
    newestConversation?: number | undefined;
}>;
export type MemoryStats = z.infer<typeof MemoryStatsSchema>;
export declare const MemoryExportOptionsSchema: z.ZodObject<{
    conversationId: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodNumber>;
    endDate: z.ZodOptional<z.ZodNumber>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
    format: z.ZodDefault<z.ZodEnum<["json", "csv", "markdown"]>>;
}, "strip", z.ZodTypeAny, {
    includeArchived: boolean;
    includeDeleted: boolean;
    format: "json" | "markdown" | "csv";
    conversationId?: string | undefined;
    agentId?: string | undefined;
    userId?: string | undefined;
    startDate?: number | undefined;
    endDate?: number | undefined;
}, {
    conversationId?: string | undefined;
    agentId?: string | undefined;
    userId?: string | undefined;
    includeArchived?: boolean | undefined;
    includeDeleted?: boolean | undefined;
    startDate?: number | undefined;
    endDate?: number | undefined;
    format?: "json" | "markdown" | "csv" | undefined;
}>;
export type MemoryExportOptions = z.infer<typeof MemoryExportOptionsSchema>;
export declare const MemoryExportSchema: z.ZodObject<{
    conversations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        state: z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>;
        messageCount: z.ZodNumber;
        totalTokens: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        archivedAt: z.ZodOptional<z.ZodNumber>;
        deletedAt: z.ZodOptional<z.ZodNumber>;
    } & {
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            conversationId: z.ZodString;
            role: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
            content: z.ZodString;
            tokens: z.ZodOptional<z.ZodNumber>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            createdAt: z.ZodNumber;
            updatedAt: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            content: string;
            createdAt: number;
            updatedAt: number;
            role: "function" | "system" | "user" | "assistant" | "tool";
            conversationId: string;
            metadata?: Record<string, unknown> | undefined;
            tokens?: number | undefined;
        }, {
            id: string;
            content: string;
            createdAt: number;
            updatedAt: number;
            role: "function" | "system" | "user" | "assistant" | "tool";
            conversationId: string;
            metadata?: Record<string, unknown> | undefined;
            tokens?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        messages: {
            id: string;
            content: string;
            createdAt: number;
            updatedAt: number;
            role: "function" | "system" | "user" | "assistant" | "tool";
            conversationId: string;
            metadata?: Record<string, unknown> | undefined;
            tokens?: number | undefined;
        }[];
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }, {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        messages: {
            id: string;
            content: string;
            createdAt: number;
            updatedAt: number;
            role: "function" | "system" | "user" | "assistant" | "tool";
            conversationId: string;
            metadata?: Record<string, unknown> | undefined;
            tokens?: number | undefined;
        }[];
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }>, "many">;
    exportedAt: z.ZodNumber;
    exportOptions: z.ZodObject<{
        conversationId: z.ZodOptional<z.ZodString>;
        agentId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodNumber>;
        endDate: z.ZodOptional<z.ZodNumber>;
        includeArchived: z.ZodDefault<z.ZodBoolean>;
        includeDeleted: z.ZodDefault<z.ZodBoolean>;
        format: z.ZodDefault<z.ZodEnum<["json", "csv", "markdown"]>>;
    }, "strip", z.ZodTypeAny, {
        includeArchived: boolean;
        includeDeleted: boolean;
        format: "json" | "markdown" | "csv";
        conversationId?: string | undefined;
        agentId?: string | undefined;
        userId?: string | undefined;
        startDate?: number | undefined;
        endDate?: number | undefined;
    }, {
        conversationId?: string | undefined;
        agentId?: string | undefined;
        userId?: string | undefined;
        includeArchived?: boolean | undefined;
        includeDeleted?: boolean | undefined;
        startDate?: number | undefined;
        endDate?: number | undefined;
        format?: "json" | "markdown" | "csv" | undefined;
    }>;
    stats: z.ZodObject<{
        totalConversations: z.ZodNumber;
        activeConversations: z.ZodNumber;
        archivedConversations: z.ZodNumber;
        deletedConversations: z.ZodNumber;
        totalMessages: z.ZodNumber;
        totalTokens: z.ZodNumber;
        averageMessagesPerConversation: z.ZodNumber;
        averageTokensPerMessage: z.ZodNumber;
        oldestConversation: z.ZodOptional<z.ZodNumber>;
        newestConversation: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        totalTokens: number;
        totalConversations: number;
        activeConversations: number;
        archivedConversations: number;
        deletedConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        averageTokensPerMessage: number;
        oldestConversation?: number | undefined;
        newestConversation?: number | undefined;
    }, {
        totalTokens: number;
        totalConversations: number;
        activeConversations: number;
        archivedConversations: number;
        deletedConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        averageTokensPerMessage: number;
        oldestConversation?: number | undefined;
        newestConversation?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    conversations: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        messages: {
            id: string;
            content: string;
            createdAt: number;
            updatedAt: number;
            role: "function" | "system" | "user" | "assistant" | "tool";
            conversationId: string;
            metadata?: Record<string, unknown> | undefined;
            tokens?: number | undefined;
        }[];
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }[];
    exportedAt: number;
    exportOptions: {
        includeArchived: boolean;
        includeDeleted: boolean;
        format: "json" | "markdown" | "csv";
        conversationId?: string | undefined;
        agentId?: string | undefined;
        userId?: string | undefined;
        startDate?: number | undefined;
        endDate?: number | undefined;
    };
    stats: {
        totalTokens: number;
        totalConversations: number;
        activeConversations: number;
        archivedConversations: number;
        deletedConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        averageTokensPerMessage: number;
        oldestConversation?: number | undefined;
        newestConversation?: number | undefined;
    };
}, {
    conversations: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        messages: {
            id: string;
            content: string;
            createdAt: number;
            updatedAt: number;
            role: "function" | "system" | "user" | "assistant" | "tool";
            conversationId: string;
            metadata?: Record<string, unknown> | undefined;
            tokens?: number | undefined;
        }[];
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }[];
    exportedAt: number;
    exportOptions: {
        conversationId?: string | undefined;
        agentId?: string | undefined;
        userId?: string | undefined;
        includeArchived?: boolean | undefined;
        includeDeleted?: boolean | undefined;
        startDate?: number | undefined;
        endDate?: number | undefined;
        format?: "json" | "markdown" | "csv" | undefined;
    };
    stats: {
        totalTokens: number;
        totalConversations: number;
        activeConversations: number;
        archivedConversations: number;
        deletedConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        averageTokensPerMessage: number;
        oldestConversation?: number | undefined;
        newestConversation?: number | undefined;
    };
}>;
export type MemoryExport = z.infer<typeof MemoryExportSchema>;
export declare const ConversationListOptionsSchema: z.ZodObject<{
    agentId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "updatedAt", "messageCount"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    includeArchived: boolean;
    includeDeleted: boolean;
    sortBy: "createdAt" | "updatedAt" | "messageCount";
    sortOrder: "asc" | "desc";
    agentId?: string | undefined;
    userId?: string | undefined;
    state?: "idle" | "active" | "searching" | "archived" | "deleted" | undefined;
}, {
    agentId?: string | undefined;
    userId?: string | undefined;
    state?: "idle" | "active" | "searching" | "archived" | "deleted" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    includeArchived?: boolean | undefined;
    includeDeleted?: boolean | undefined;
    sortBy?: "createdAt" | "updatedAt" | "messageCount" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type ConversationListOptions = z.infer<typeof ConversationListOptionsSchema>;
export declare const ConversationListResultSchema: z.ZodObject<{
    conversations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        state: z.ZodEnum<["idle", "active", "searching", "archived", "deleted"]>;
        messageCount: z.ZodNumber;
        totalTokens: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        archivedAt: z.ZodOptional<z.ZodNumber>;
        deletedAt: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }, {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }>, "many">;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    conversations: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }[];
    total: number;
    hasMore: boolean;
}, {
    limit: number;
    offset: number;
    conversations: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        totalTokens: number;
        agentId: string;
        state: "idle" | "active" | "searching" | "archived" | "deleted";
        messageCount: number;
        metadata?: Record<string, unknown> | undefined;
        userId?: string | undefined;
        archivedAt?: number | undefined;
        deletedAt?: number | undefined;
    }[];
    total: number;
    hasMore: boolean;
}>;
export type ConversationListResult = z.infer<typeof ConversationListResultSchema>;
export declare const MessageListOptionsSchema: z.ZodObject<{
    conversationId: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["user", "assistant", "system", "function", "tool"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "updatedAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
    limit: number;
    offset: number;
    sortBy: "createdAt" | "updatedAt";
    sortOrder: "asc" | "desc";
    role?: "function" | "system" | "user" | "assistant" | "tool" | undefined;
}, {
    conversationId: string;
    role?: "function" | "system" | "user" | "assistant" | "tool" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    sortBy?: "createdAt" | "updatedAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type MessageListOptions = z.infer<typeof MessageListOptionsSchema>;
export declare const MessageListResultSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<["user", "assistant", "system", "function", "tool"]>;
        content: z.ZodString;
        tokens: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }, {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }>, "many">;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    messages: {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }[];
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
}, {
    messages: {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        role: "function" | "system" | "user" | "assistant" | "tool";
        conversationId: string;
        metadata?: Record<string, unknown> | undefined;
        tokens?: number | undefined;
    }[];
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
}>;
export type MessageListResult = z.infer<typeof MessageListResultSchema>;
export declare function validateConversation(data: unknown): Conversation;
export declare function validateMessage(data: unknown): Message;
export declare function validateAgent(data: unknown): Agent;
export declare function validateMemorySearchOptions(data: unknown): MemorySearchOptions;
export declare function validateConversationListOptions(data: unknown): ConversationListOptions;
export declare function validateMessageListOptions(data: unknown): MessageListOptions;
//# sourceMappingURL=memory.schema.d.ts.map