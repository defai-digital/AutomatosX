/**
 * agents.types.ts
 *
 * Type definitions for Agent System
 * Phase 7: Agent System Implementation
 */
import { z } from 'zod';
/**
 * Zod schemas for validation
 */
export const TaskSchema = z.object({
    id: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
    assignedAgent: z.string().optional(),
    context: z.record(z.unknown()).optional(),
    dependencies: z.array(z.string()).optional(),
    createdAt: z.number(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
});
export const AgentMetadataSchema = z.object({
    type: z.string(),
    name: z.string(),
    description: z.string(),
    capabilities: z.array(z.object({
        name: z.string(),
        description: z.string(),
        keywords: z.array(z.string()),
    })),
    specializations: z.array(z.string()),
    requiredContext: z.array(z.string()).optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
});
export const TaskResultSchema = z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    message: z.string().optional(),
    artifacts: z
        .array(z.object({
        type: z.enum(['file', 'code', 'document', 'diagram', 'data']),
        name: z.string(),
        path: z.string().optional(),
        content: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
    }))
        .optional(),
    metadata: z.record(z.unknown()).optional(),
});
