/**
 * Session MCP Tool Contracts
 *
 * Zod schemas for session tool inputs and outputs.
 */

import { z } from 'zod';

// ============================================================================
// session_create Tool
// ============================================================================

/**
 * Input schema for session_create tool
 */
export const SessionCreateInputSchema = z.object({
  initiator: z.string().min(1).max(50),
  task: z.string().min(1).max(5000),
  workspace: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SessionCreateInput = z.infer<typeof SessionCreateInputSchema>;

/**
 * Output schema for session_create tool
 */
export const SessionCreateOutputSchema = z.object({
  sessionId: z.string().uuid(),
  initiator: z.string(),
  task: z.string(),
  status: z.literal('active'),
  createdAt: z.string().datetime(),
  workspace: z.string().optional(),
});

export type SessionCreateOutput = z.infer<typeof SessionCreateOutputSchema>;

// ============================================================================
// session_status Tool
// ============================================================================

/**
 * Input schema for session_status tool
 */
export const SessionStatusInputSchema = z.object({
  sessionId: z.string().uuid(),
});

export type SessionStatusInput = z.infer<typeof SessionStatusInputSchema>;

/**
 * Participant in session status output
 */
export const SessionParticipantSummarySchema = z.object({
  agentId: z.string(),
  role: z.string(),
  joinedAt: z.string().datetime(),
  taskCount: z.number().int().min(0),
});

export type SessionParticipantSummary = z.infer<typeof SessionParticipantSummarySchema>;

/**
 * Output schema for session_status tool
 */
export const SessionStatusOutputSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['active', 'completed', 'failed']),
  initiator: z.string(),
  task: z.string(),
  participants: z.array(SessionParticipantSummarySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type SessionStatusOutput = z.infer<typeof SessionStatusOutputSchema>;

// ============================================================================
// session_complete Tool
// ============================================================================

/**
 * Input schema for session_complete tool
 */
export const SessionCompleteInputSchema = z.object({
  sessionId: z.string().uuid(),
  summary: z.string().max(5000).optional(),
});

export type SessionCompleteInput = z.infer<typeof SessionCompleteInputSchema>;

/**
 * Output schema for session_complete tool
 */
export const SessionCompleteOutputSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('completed'),
  completedAt: z.string().datetime(),
  summary: z.string().optional(),
});

export type SessionCompleteOutput = z.infer<typeof SessionCompleteOutputSchema>;

// ============================================================================
// session_list Tool
// ============================================================================

/**
 * Input schema for session_list tool
 */
export const SessionListInputSchema = z.object({
  status: z.enum(['active', 'completed', 'failed']).optional(),
  initiator: z.string().max(50).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type SessionListInput = z.infer<typeof SessionListInputSchema>;

/**
 * Session summary in list output
 */
export const SessionSummarySchema = z.object({
  sessionId: z.string().uuid(),
  initiator: z.string(),
  task: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  participantCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/**
 * Output schema for session_list tool
 */
export const SessionListOutputSchema = z.object({
  sessions: z.array(SessionSummarySchema),
  total: z.number().int().min(0),
});

export type SessionListOutput = z.infer<typeof SessionListOutputSchema>;

// ============================================================================
// session_join Tool
// ============================================================================

/**
 * Input schema for session_join tool
 */
export const SessionJoinInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
  role: z.enum(['collaborator', 'delegate']).optional(),
});

export type SessionJoinInput = z.infer<typeof SessionJoinInputSchema>;

/**
 * Output schema for session_join tool
 */
export const SessionJoinOutputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string(),
  role: z.string(),
  joinedAt: z.string().datetime(),
  participantCount: z.number().int().min(1),
});

export type SessionJoinOutput = z.infer<typeof SessionJoinOutputSchema>;

// ============================================================================
// session_leave Tool
// ============================================================================

/**
 * Input schema for session_leave tool
 */
export const SessionLeaveInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
});

export type SessionLeaveInput = z.infer<typeof SessionLeaveInputSchema>;

/**
 * Output schema for session_leave tool
 */
export const SessionLeaveOutputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string(),
  leftAt: z.string().datetime(),
  remainingParticipants: z.number().int().min(0),
});

export type SessionLeaveOutput = z.infer<typeof SessionLeaveOutputSchema>;

// ============================================================================
// session_fail Tool
// ============================================================================

/**
 * Session failure error details
 */
export const SessionFailureErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  taskId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type SessionFailureError = z.infer<typeof SessionFailureErrorSchema>;

/**
 * Input schema for session_fail tool
 */
export const SessionFailInputSchema = z.object({
  sessionId: z.string().uuid(),
  error: SessionFailureErrorSchema,
});

export type SessionFailInput = z.infer<typeof SessionFailInputSchema>;

/**
 * Output schema for session_fail tool
 */
export const SessionFailOutputSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('failed'),
  failedAt: z.string().datetime(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type SessionFailOutput = z.infer<typeof SessionFailOutputSchema>;

// ============================================================================
// session_close_stuck Tool
// ============================================================================

/**
 * Input schema for session_close_stuck tool
 * Closes sessions that have been active longer than maxAgeMs
 */
export const SessionCloseStuckInputSchema = z.object({
  maxAgeMs: z
    .number()
    .int()
    .min(60000) // Minimum 1 minute
    .max(604800000) // Maximum 7 days
    .optional()
    .default(86400000), // Default 24 hours
});

export type SessionCloseStuckInput = z.infer<typeof SessionCloseStuckInputSchema>;

/**
 * Output schema for session_close_stuck tool
 */
export const SessionCloseStuckOutputSchema = z.object({
  closedCount: z.number().int().min(0),
  maxAgeMs: z.number().int(),
  message: z.string(),
});

export type SessionCloseStuckOutput = z.infer<typeof SessionCloseStuckOutputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Session tool error codes
 */
export const SessionToolErrorCode = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  SESSION_INVALID_TRANSITION: 'SESSION_INVALID_TRANSITION',
  SESSION_MAX_PARTICIPANTS: 'SESSION_MAX_PARTICIPANTS',
  SESSION_AGENT_NOT_PARTICIPANT: 'SESSION_AGENT_NOT_PARTICIPANT',
  SESSION_INITIATOR_CANNOT_LEAVE: 'SESSION_INITIATOR_CANNOT_LEAVE',
} as const;

export type SessionToolErrorCode =
  (typeof SessionToolErrorCode)[keyof typeof SessionToolErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates session_create input
 */
export function validateSessionCreateInput(data: unknown): SessionCreateInput {
  return SessionCreateInputSchema.parse(data);
}

/**
 * Safely validates session_create input
 */
export function safeValidateSessionCreateInput(
  data: unknown
): { success: true; data: SessionCreateInput } | { success: false; error: z.ZodError } {
  const result = SessionCreateInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_status input
 */
export function validateSessionStatusInput(data: unknown): SessionStatusInput {
  return SessionStatusInputSchema.parse(data);
}

/**
 * Safely validates session_status input
 */
export function safeValidateSessionStatusInput(
  data: unknown
): { success: true; data: SessionStatusInput } | { success: false; error: z.ZodError } {
  const result = SessionStatusInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_complete input
 */
export function validateSessionCompleteInput(data: unknown): SessionCompleteInput {
  return SessionCompleteInputSchema.parse(data);
}

/**
 * Safely validates session_complete input
 */
export function safeValidateSessionCompleteInput(
  data: unknown
): { success: true; data: SessionCompleteInput } | { success: false; error: z.ZodError } {
  const result = SessionCompleteInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_list input
 */
export function validateSessionListInput(data: unknown): SessionListInput {
  return SessionListInputSchema.parse(data);
}

/**
 * Safely validates session_list input
 */
export function safeValidateSessionListInput(
  data: unknown
): { success: true; data: SessionListInput } | { success: false; error: z.ZodError } {
  const result = SessionListInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_join input
 */
export function validateSessionJoinInput(data: unknown): SessionJoinInput {
  return SessionJoinInputSchema.parse(data);
}

/**
 * Safely validates session_join input
 */
export function safeValidateSessionJoinInput(
  data: unknown
): { success: true; data: SessionJoinInput } | { success: false; error: z.ZodError } {
  const result = SessionJoinInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_leave input
 */
export function validateSessionLeaveInput(data: unknown): SessionLeaveInput {
  return SessionLeaveInputSchema.parse(data);
}

/**
 * Safely validates session_leave input
 */
export function safeValidateSessionLeaveInput(
  data: unknown
): { success: true; data: SessionLeaveInput } | { success: false; error: z.ZodError } {
  const result = SessionLeaveInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_fail input
 */
export function validateSessionFailInput(data: unknown): SessionFailInput {
  return SessionFailInputSchema.parse(data);
}

/**
 * Safely validates session_fail input
 */
export function safeValidateSessionFailInput(
  data: unknown
): { success: true; data: SessionFailInput } | { success: false; error: z.ZodError } {
  const result = SessionFailInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates session_close_stuck input
 */
export function validateSessionCloseStuckInput(data: unknown): SessionCloseStuckInput {
  return SessionCloseStuckInputSchema.parse(data);
}

/**
 * Safely validates session_close_stuck input
 */
export function safeValidateSessionCloseStuckInput(
  data: unknown
): { success: true; data: SessionCloseStuckInput } | { success: false; error: z.ZodError } {
  const result = SessionCloseStuckInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
