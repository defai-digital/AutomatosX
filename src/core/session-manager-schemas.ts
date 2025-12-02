/**
 * Session Manager Zod Schemas
 *
 * Runtime validation for session manager operations
 * v8.5.7: Phase 2 Zod refactoring
 */

import { z } from 'zod';

/**
 * Session Task Info Schema
 */
export const SessionTaskInfoSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  agent: z.string().min(1).max(100).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  duration: z.number().int().nonnegative().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed'])
}).strict();

/**
 * Session Metadata Schema
 */
export const SessionMetadataSchema = z.object({
  tasks: z.array(SessionTaskInfoSchema).optional()
  // Allow additional custom fields
}).passthrough();

/**
 * Session Schema
 */
export const SessionSchema = z.object({
  id: z.string().uuid(),
  initiator: z.string().min(1).max(100),
  task: z.string().min(1).max(5000), // 5KB max task description
  agents: z.array(z.string().min(1).max(100)).min(1).max(100), // 1-100 agents
  status: z.enum(['active', 'completed', 'failed']),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  metadata: SessionMetadataSchema.optional()
}).strict();

/**
 * Join Task Info Schema
 */
export const JoinTaskInfoSchema = z.object({
  taskId: z.string().min(1).max(200),
  taskTitle: z.string().min(1).max(500),
  agent: z.string().min(1).max(100).optional()
}).strict();

/**
 * Session Manager Config Schema
 */
export const SessionManagerConfigSchema = z.object({
  persistencePath: z.string().min(1).max(500).optional(),
  maxSessions: z.number().int().positive().max(100000).optional()
}).strict();

/**
 * Session List Options Schema
 */
export const SessionListOptionsSchema = z.object({
  status: z.enum(['active', 'completed', 'failed', 'all']).optional(),
  limit: z.number().int().positive().max(10000).optional(),
  offset: z.number().int().nonnegative().optional()
}).strict();

// Type exports for convenience
export type SessionTaskInfo = z.infer<typeof SessionTaskInfoSchema>;
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type JoinTaskInfo = z.infer<typeof JoinTaskInfoSchema>;
export type SessionManagerConfig = z.infer<typeof SessionManagerConfigSchema>;
export type SessionListOptions = z.infer<typeof SessionListOptionsSchema>;
