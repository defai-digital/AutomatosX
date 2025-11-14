import { z } from 'zod';
// ============================================================================
// Memory State Machine Schemas
// ============================================================================
export const MemoryStateSchema = z.enum([
    'idle',
    'active',
    'searching',
    'archived',
    'deleted',
]);
export const MemoryEventSchema = z.enum([
    'create_conversation',
    'add_message',
    'search_messages',
    'archive_conversation',
    'delete_conversation',
    'restore_conversation',
]);
// ============================================================================
// Message Schemas
// ============================================================================
export const MessageRoleSchema = z.enum([
    'user',
    'assistant',
    'system',
    'function',
    'tool',
]);
export const MessageSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    role: MessageRoleSchema,
    content: z.string(),
    tokens: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});
export const CreateMessageSchema = z.object({
    conversationId: z.string().uuid(),
    role: MessageRoleSchema,
    content: z.string(),
    tokens: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
// ============================================================================
// Conversation Schemas
// ============================================================================
export const ConversationSchema = z.object({
    id: z.string().uuid(),
    agentId: z.string(),
    userId: z.string().optional(),
    title: z.string(),
    state: MemoryStateSchema,
    messageCount: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    archivedAt: z.number().optional(),
    deletedAt: z.number().optional(),
});
export const CreateConversationSchema = z.object({
    agentId: z.string(),
    userId: z.string().optional(),
    title: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export const UpdateConversationSchema = z.object({
    id: z.string().uuid(),
    title: z.string().optional(),
    state: MemoryStateSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export const ConversationWithMessagesSchema = ConversationSchema.extend({
    messages: z.array(MessageSchema),
});
// ============================================================================
// Agent Schemas
// ============================================================================
export const AgentSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    expertise: z.array(z.string()),
    capabilities: z.array(z.string()),
    allowedTools: z.array(z.string()),
    maxConcurrentTasks: z.number().int().positive().default(5),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});
export const CreateAgentSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    expertise: z.array(z.string()),
    capabilities: z.array(z.string()),
    allowedTools: z.array(z.string()),
    maxConcurrentTasks: z.number().int().positive().default(5),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
// ============================================================================
// Agent State Schemas
// ============================================================================
export const AgentStateSchema = z.object({
    id: z.string().uuid(),
    agentId: z.string(),
    conversationId: z.string().uuid(),
    state: z.enum([
        'idle',
        'planning',
        'validating_task',
        'selecting_tools',
        'executing_tools',
        'processing_results',
        'delegating',
        'awaiting_delegation',
        'completing',
        'completed',
        'failed',
        'paused',
    ]),
    currentTask: z.string().optional(),
    taskQueue: z.array(z.string()).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});
// ============================================================================
// Workflow Schemas
// ============================================================================
export const WorkflowSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    definition: z.string(), // YAML or JSON
    status: z.enum([
        'pending',
        'running',
        'paused',
        'completed',
        'failed',
        'cancelled',
    ]),
    executionId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
});
export const CreateWorkflowSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    definition: z.string(),
    executionId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
// ============================================================================
// Memory Search Schemas
// ============================================================================
export const MemorySearchOptionsSchema = z.object({
    query: z.string(),
    conversationId: z.string().uuid().optional(),
    agentId: z.string().optional(),
    userId: z.string().optional(),
    role: MessageRoleSchema.optional(),
    limit: z.number().int().positive().max(100).default(10),
    offset: z.number().int().nonnegative().default(0),
    includeArchived: z.boolean().default(false),
    includeDeleted: z.boolean().default(false),
    sortBy: z.enum(['relevance', 'createdAt', 'updatedAt']).default('relevance'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export const MemorySearchResultSchema = z.object({
    messages: z.array(MessageSchema),
    conversations: z.array(ConversationSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
});
// ============================================================================
// Memory Stats Schemas
// ============================================================================
export const MemoryStatsSchema = z.object({
    totalConversations: z.number().int().nonnegative(),
    activeConversations: z.number().int().nonnegative(),
    archivedConversations: z.number().int().nonnegative(),
    deletedConversations: z.number().int().nonnegative(),
    totalMessages: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    averageMessagesPerConversation: z.number(),
    averageTokensPerMessage: z.number(),
    oldestConversation: z.number().optional(),
    newestConversation: z.number().optional(),
});
// ============================================================================
// Memory Export Schemas
// ============================================================================
export const MemoryExportOptionsSchema = z.object({
    conversationId: z.string().uuid().optional(),
    agentId: z.string().optional(),
    userId: z.string().optional(),
    startDate: z.number().optional(),
    endDate: z.number().optional(),
    includeArchived: z.boolean().default(false),
    includeDeleted: z.boolean().default(false),
    format: z.enum(['json', 'csv', 'markdown']).default('json'),
});
export const MemoryExportSchema = z.object({
    conversations: z.array(ConversationWithMessagesSchema),
    exportedAt: z.number(),
    exportOptions: MemoryExportOptionsSchema,
    stats: MemoryStatsSchema,
});
// ============================================================================
// Conversation List Schemas
// ============================================================================
export const ConversationListOptionsSchema = z.object({
    agentId: z.string().optional(),
    userId: z.string().optional(),
    state: MemoryStateSchema.optional(),
    limit: z.number().int().positive().max(100).default(10),
    offset: z.number().int().nonnegative().default(0),
    sortBy: z.enum(['createdAt', 'updatedAt', 'messageCount']).default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    includeArchived: z.boolean().default(false),
    includeDeleted: z.boolean().default(false),
});
export const ConversationListResultSchema = z.object({
    conversations: z.array(ConversationSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
});
// ============================================================================
// Message List Schemas
// ============================================================================
export const MessageListOptionsSchema = z.object({
    conversationId: z.string().uuid(),
    role: MessageRoleSchema.optional(),
    limit: z.number().int().positive().max(1000).default(100),
    offset: z.number().int().nonnegative().default(0),
    sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export const MessageListResultSchema = z.object({
    messages: z.array(MessageSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
});
// ============================================================================
// Validation Helper Functions
// ============================================================================
export function validateConversation(data) {
    return ConversationSchema.parse(data);
}
export function validateMessage(data) {
    return MessageSchema.parse(data);
}
export function validateAgent(data) {
    return AgentSchema.parse(data);
}
export function validateMemorySearchOptions(data) {
    return MemorySearchOptionsSchema.parse(data);
}
export function validateConversationListOptions(data) {
    return ConversationListOptionsSchema.parse(data);
}
export function validateMessageListOptions(data) {
    return MessageListOptionsSchema.parse(data);
}
