/**
 * Workflow MCP Tool Contracts
 *
 * Zod schemas for workflow tool inputs and outputs.
 */

import { z } from 'zod';

// ============================================================================
// workflow_run Tool
// ============================================================================

export const WorkflowRunInputSchema = z.object({
  workflowId: z.string().min(1).max(200),
  input: z.record(z.unknown()).optional(),
});

export type WorkflowRunInput = z.infer<typeof WorkflowRunInputSchema>;

export const WorkflowRunOutputSchema = z.object({
  success: z.boolean(),
  workflowId: z.string(),
  stepsCompleted: z.array(z.string()),
  output: z.unknown().optional(),
});

export type WorkflowRunOutput = z.infer<typeof WorkflowRunOutputSchema>;

// ============================================================================
// workflow_list Tool
// ============================================================================

export const WorkflowListInputSchema = z.object({
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export type WorkflowListInput = z.infer<typeof WorkflowListInputSchema>;

export const WorkflowListOutputSchema = z.object({
  workflows: z.array(z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    status: z.string(),
    stepCount: z.number().int().min(0),
  })),
});

export type WorkflowListOutput = z.infer<typeof WorkflowListOutputSchema>;

// ============================================================================
// workflow_describe Tool
// ============================================================================

export const WorkflowDescribeInputSchema = z.object({
  workflowId: z.string().min(1).max(200),
});

export type WorkflowDescribeInput = z.infer<typeof WorkflowDescribeInputSchema>;

export const WorkflowDescribeOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  status: z.string(),
  steps: z.array(z.object({
    stepId: z.string(),
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
  })),
  inputSchema: z.unknown().optional(),
});

export type WorkflowDescribeOutput = z.infer<typeof WorkflowDescribeOutputSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateWorkflowRunInput(data: unknown): WorkflowRunInput {
  return WorkflowRunInputSchema.parse(data);
}

export function validateWorkflowListInput(data: unknown): WorkflowListInput {
  return WorkflowListInputSchema.parse(data);
}

export function validateWorkflowDescribeInput(data: unknown): WorkflowDescribeInput {
  return WorkflowDescribeInputSchema.parse(data);
}
