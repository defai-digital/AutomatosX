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

export type MemoryState = z.infer<typeof MemoryStateSchema>;

export const MemoryEventSchema = z.enum([
  'create_conversation',
  'add_message',
  'search_messages',
  'archive_conversation',
  'delete_conversation',
  'restore_conversation',
]);

export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

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

export type MessageRole = z.infer<typeof MessageRoleSchema>;

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

export type Message = z.infer<typeof MessageSchema>;

export const CreateMessageSchema = z.object({
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  tokens: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateMessage = z.infer<typeof CreateMessageSchema>;

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

export type Conversation = z.infer<typeof ConversationSchema>;

export const CreateConversationSchema = z.object({
  agentId: z.string(),
  userId: z.string().optional(),
  title: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateConversation = z.infer<typeof CreateConversationSchema>;

export const UpdateConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  state: MemoryStateSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;

export const ConversationWithMessagesSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema),
});

export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;

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

export type Agent = z.infer<typeof AgentSchema>;

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

export type CreateAgent = z.infer<typeof CreateAgentSchema>;

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

export type AgentState = z.infer<typeof AgentStateSchema>;

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

export type Workflow = z.infer<typeof WorkflowSchema>;

export const CreateWorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  definition: z.string(),
  executionId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;

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
  skipCount: z.boolean().default(false), // Skip COUNT query for performance
});

export type MemorySearchOptions = z.infer<typeof MemorySearchOptionsSchema>;

export const MemorySearchResultSchema = z.object({
  messages: z.array(MessageSchema),
  conversations: z.array(ConversationSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

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

export type MemoryStats = z.infer<typeof MemoryStatsSchema>;

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

export type MemoryExportOptions = z.infer<typeof MemoryExportOptionsSchema>;

export const MemoryExportSchema = z.object({
  conversations: z.array(ConversationWithMessagesSchema),
  exportedAt: z.number(),
  exportOptions: MemoryExportOptionsSchema,
  stats: MemoryStatsSchema,
});

export type MemoryExport = z.infer<typeof MemoryExportSchema>;

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

export type ConversationListOptions = z.infer<typeof ConversationListOptionsSchema>;

export const ConversationListResultSchema = z.object({
  conversations: z.array(ConversationSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type ConversationListResult = z.infer<typeof ConversationListResultSchema>;

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

export type MessageListOptions = z.infer<typeof MessageListOptionsSchema>;

export const MessageListResultSchema = z.object({
  messages: z.array(MessageSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type MessageListResult = z.infer<typeof MessageListResultSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateConversation(data: unknown): Conversation {
  return ConversationSchema.parse(data);
}

export function validateMessage(data: unknown): Message {
  return MessageSchema.parse(data);
}

export function validateAgent(data: unknown): Agent {
  return AgentSchema.parse(data);
}

export function validateMemorySearchOptions(data: unknown): MemorySearchOptions {
  return MemorySearchOptionsSchema.parse(data);
}

export function validateConversationListOptions(data: unknown): ConversationListOptions {
  return ConversationListOptionsSchema.parse(data);
}

export function validateMessageListOptions(data: unknown): MessageListOptions {
  return MessageListOptionsSchema.parse(data);
}
