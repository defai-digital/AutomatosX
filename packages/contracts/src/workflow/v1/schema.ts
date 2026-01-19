import { z } from 'zod';
import {
  RETRY_MAX_LIMIT,
  RETRY_DELAY_DEFAULT,
  RETRY_BACKOFF_CAP,
  TIMEOUT_SESSION,
} from '../../constants.js';

/**
 * Schema reference for input/output validation
 */
export const SchemaReferenceSchema = z.object({
  $ref: z.string().min(1),
});

export type SchemaReference = z.infer<typeof SchemaReferenceSchema>;

/**
 * Retry policy for step execution
 */
export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(RETRY_MAX_LIMIT).default(1),
  backoffMs: z.number().int().min(100).max(RETRY_BACKOFF_CAP).default(RETRY_DELAY_DEFAULT),
  backoffMultiplier: z.number().min(1).max(5).default(2),
  retryOn: z
    .array(z.enum(['timeout', 'rate_limit', 'server_error', 'network_error']))
    .optional(),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Step types supported in workflows
 */
export const StepTypeSchema = z.enum([
  'prompt',
  'tool',
  'conditional',
  'loop',
  'parallel',
  'discuss', // Multi-model discussion step
  'delegate', // Delegate to another agent
]);

export type StepType = z.infer<typeof StepTypeSchema>;

/**
 * Individual workflow step
 * INV-WF-003: Schema strictness rejects unknown fields
 */
export const WorkflowStepSchema = z.object({
  stepId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/),
  type: StepTypeSchema,
  name: z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  inputSchema: SchemaReferenceSchema.optional(),
  outputSchema: SchemaReferenceSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
  timeout: z.number().int().min(RETRY_DELAY_DEFAULT).max(TIMEOUT_SESSION).optional(),
  config: z.record(z.unknown()).optional(),
  /** Step IDs this step depends on */
  dependencies: z.array(z.string().max(64)).optional(),
  /** Tool name for tool-type steps */
  tool: z.string().max(128).optional(),
}).strict();

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * Complete workflow definition
 * INV-WF-003: Schema strictness rejects unknown fields
 */
export const WorkflowSchema = z.object({
  workflowId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  category: z.string().max(64).optional(),
  tags: z.array(z.string().max(64)).optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export type Workflow = z.infer<typeof WorkflowSchema>;

/**
 * Validates a workflow definition
 */
export function validateWorkflow(data: unknown): Workflow {
  return WorkflowSchema.parse(data);
}

/**
 * Safely validates a workflow definition, returning result or error
 */
export function safeValidateWorkflow(
  data: unknown
): z.SafeParseReturnType<unknown, Workflow> {
  return WorkflowSchema.safeParse(data);
}

// ============================================================================
// Default Constants
// Exported for use by implementation code to avoid hardcoding
// ============================================================================

/**
 * Default retry policy values
 * These match the defaults in RetryPolicySchema
 */
export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  maxAttempts: 1,
  backoffMs: RETRY_DELAY_DEFAULT,
  backoffMultiplier: 2,
  retryOn: ['timeout', 'rate_limit', 'server_error', 'network_error'],
};

/**
 * Maximum backoff cap in milliseconds
 * Prevents exponential backoff from growing unbounded
 */
export const DEFAULT_BACKOFF_CAP_MS = RETRY_BACKOFF_CAP;
