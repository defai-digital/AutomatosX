import { z } from 'zod';
export declare const MemoryStateSchema: z.ZodEnum<{
    idle: "idle";
    active: "active";
    searching: "searching";
    archived: "archived";
    deleted: "deleted";
}>;
export type MemoryState = z.infer<typeof MemoryStateSchema>;
export declare const MemoryEventSchema: z.ZodEnum<{
    create_conversation: "create_conversation";
    add_message: "add_message";
    search_messages: "search_messages";
    archive_conversation: "archive_conversation";
    delete_conversation: "delete_conversation";
    restore_conversation: "restore_conversation";
}>;
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;
export declare const MessageRoleSchema: z.ZodEnum<{
    function: "function";
    system: "system";
    user: "user";
    assistant: "assistant";
    tool: "tool";
}>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export declare const MessageSchema: z.ZodObject<{
    id: z.ZodString;
    conversationId: z.ZodString;
    role: z.ZodEnum<{
        function: "function";
        system: "system";
        user: "user";
        assistant: "assistant";
        tool: "tool";
    }>;
    content: z.ZodString;
    tokens: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export type Message = z.infer<typeof MessageSchema>;
export declare const CreateMessageSchema: z.ZodObject<{
    conversationId: z.ZodString;
    role: z.ZodEnum<{
        function: "function";
        system: "system";
        user: "user";
        assistant: "assistant";
        tool: "tool";
    }>;
    content: z.ZodString;
    tokens: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export declare const ConversationSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    state: z.ZodEnum<{
        idle: "idle";
        active: "active";
        searching: "searching";
        archived: "archived";
        deleted: "deleted";
    }>;
    messageCount: z.ZodNumber;
    totalTokens: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    archivedAt: z.ZodOptional<z.ZodNumber>;
    deletedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type Conversation = z.infer<typeof ConversationSchema>;
export declare const CreateConversationSchema: z.ZodObject<{
    agentId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
export declare const UpdateConversationSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodEnum<{
        idle: "idle";
        active: "active";
        searching: "searching";
        archived: "archived";
        deleted: "deleted";
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;
export declare const ConversationWithMessagesSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    state: z.ZodEnum<{
        idle: "idle";
        active: "active";
        searching: "searching";
        archived: "archived";
        deleted: "deleted";
    }>;
    messageCount: z.ZodNumber;
    totalTokens: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    archivedAt: z.ZodOptional<z.ZodNumber>;
    deletedAt: z.ZodOptional<z.ZodNumber>;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<{
            function: "function";
            system: "system";
            user: "user";
            assistant: "assistant";
            tool: "tool";
        }>;
        content: z.ZodString;
        tokens: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;
export declare const AgentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    expertise: z.ZodArray<z.ZodString>;
    capabilities: z.ZodArray<z.ZodString>;
    allowedTools: z.ZodArray<z.ZodString>;
    maxConcurrentTasks: z.ZodDefault<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export type Agent = z.infer<typeof AgentSchema>;
export declare const CreateAgentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    expertise: z.ZodArray<z.ZodString>;
    capabilities: z.ZodArray<z.ZodString>;
    allowedTools: z.ZodArray<z.ZodString>;
    maxConcurrentTasks: z.ZodDefault<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CreateAgent = z.infer<typeof CreateAgentSchema>;
export declare const AgentStateSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    conversationId: z.ZodString;
    state: z.ZodEnum<{
        paused: "paused";
        completed: "completed";
        failed: "failed";
        idle: "idle";
        planning: "planning";
        validating_task: "validating_task";
        selecting_tools: "selecting_tools";
        executing_tools: "executing_tools";
        processing_results: "processing_results";
        delegating: "delegating";
        awaiting_delegation: "awaiting_delegation";
        completing: "completing";
    }>;
    currentTask: z.ZodOptional<z.ZodString>;
    taskQueue: z.ZodDefault<z.ZodArray<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export type AgentState = z.infer<typeof AgentStateSchema>;
export declare const WorkflowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    definition: z.ZodString;
    status: z.ZodEnum<{
        running: "running";
        paused: "paused";
        pending: "pending";
        completed: "completed";
        failed: "failed";
        cancelled: "cancelled";
    }>;
    executionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export declare const CreateWorkflowSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    definition: z.ZodString;
    executionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;
export declare const MemorySearchOptionsSchema: z.ZodObject<{
    query: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<{
        function: "function";
        system: "system";
        user: "user";
        assistant: "assistant";
        tool: "tool";
    }>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        relevance: "relevance";
        createdAt: "createdAt";
        updatedAt: "updatedAt";
    }>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    skipCount: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type MemorySearchOptions = z.infer<typeof MemorySearchOptionsSchema>;
export declare const MemorySearchResultSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<{
            function: "function";
            system: "system";
            user: "user";
            assistant: "assistant";
            tool: "tool";
        }>;
        content: z.ZodString;
        tokens: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>>;
    conversations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        state: z.ZodEnum<{
            idle: "idle";
            active: "active";
            searching: "searching";
            archived: "archived";
            deleted: "deleted";
        }>;
        messageCount: z.ZodNumber;
        totalTokens: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        archivedAt: z.ZodOptional<z.ZodNumber>;
        deletedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, z.core.$strip>;
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
}, z.core.$strip>;
export type MemoryStats = z.infer<typeof MemoryStatsSchema>;
export declare const MemoryExportOptionsSchema: z.ZodObject<{
    conversationId: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodNumber>;
    endDate: z.ZodOptional<z.ZodNumber>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
    format: z.ZodDefault<z.ZodEnum<{
        json: "json";
        markdown: "markdown";
        csv: "csv";
    }>>;
}, z.core.$strip>;
export type MemoryExportOptions = z.infer<typeof MemoryExportOptionsSchema>;
export declare const MemoryExportSchema: z.ZodObject<{
    conversations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        state: z.ZodEnum<{
            idle: "idle";
            active: "active";
            searching: "searching";
            archived: "archived";
            deleted: "deleted";
        }>;
        messageCount: z.ZodNumber;
        totalTokens: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        archivedAt: z.ZodOptional<z.ZodNumber>;
        deletedAt: z.ZodOptional<z.ZodNumber>;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            conversationId: z.ZodString;
            role: z.ZodEnum<{
                function: "function";
                system: "system";
                user: "user";
                assistant: "assistant";
                tool: "tool";
            }>;
            content: z.ZodString;
            tokens: z.ZodOptional<z.ZodNumber>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            createdAt: z.ZodNumber;
            updatedAt: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    exportedAt: z.ZodNumber;
    exportOptions: z.ZodObject<{
        conversationId: z.ZodOptional<z.ZodString>;
        agentId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodNumber>;
        endDate: z.ZodOptional<z.ZodNumber>;
        includeArchived: z.ZodDefault<z.ZodBoolean>;
        includeDeleted: z.ZodDefault<z.ZodBoolean>;
        format: z.ZodDefault<z.ZodEnum<{
            json: "json";
            markdown: "markdown";
            csv: "csv";
        }>>;
    }, z.core.$strip>;
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
    }, z.core.$strip>;
}, z.core.$strip>;
export type MemoryExport = z.infer<typeof MemoryExportSchema>;
export declare const ConversationListOptionsSchema: z.ZodObject<{
    agentId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodEnum<{
        idle: "idle";
        active: "active";
        searching: "searching";
        archived: "archived";
        deleted: "deleted";
    }>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        createdAt: "createdAt";
        updatedAt: "updatedAt";
        messageCount: "messageCount";
    }>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type ConversationListOptions = z.infer<typeof ConversationListOptionsSchema>;
export declare const ConversationListResultSchema: z.ZodObject<{
    conversations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        agentId: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        state: z.ZodEnum<{
            idle: "idle";
            active: "active";
            searching: "searching";
            archived: "archived";
            deleted: "deleted";
        }>;
        messageCount: z.ZodNumber;
        totalTokens: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        archivedAt: z.ZodOptional<z.ZodNumber>;
        deletedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, z.core.$strip>;
export type ConversationListResult = z.infer<typeof ConversationListResultSchema>;
export declare const MessageListOptionsSchema: z.ZodObject<{
    conversationId: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        function: "function";
        system: "system";
        user: "user";
        assistant: "assistant";
        tool: "tool";
    }>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        createdAt: "createdAt";
        updatedAt: "updatedAt";
    }>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strip>;
export type MessageListOptions = z.infer<typeof MessageListOptionsSchema>;
export declare const MessageListResultSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        conversationId: z.ZodString;
        role: z.ZodEnum<{
            function: "function";
            system: "system";
            user: "user";
            assistant: "assistant";
            tool: "tool";
        }>;
        content: z.ZodString;
        tokens: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    hasMore: z.ZodBoolean;
}, z.core.$strip>;
export type MessageListResult = z.infer<typeof MessageListResultSchema>;
export declare function validateConversation(data: unknown): Conversation;
export declare function validateMessage(data: unknown): Message;
export declare function validateAgent(data: unknown): Agent;
export declare function validateMemorySearchOptions(data: unknown): MemorySearchOptions;
export declare function validateConversationListOptions(data: unknown): ConversationListOptions;
export declare function validateMessageListOptions(data: unknown): MessageListOptions;
//# sourceMappingURL=memory.schema.d.ts.map