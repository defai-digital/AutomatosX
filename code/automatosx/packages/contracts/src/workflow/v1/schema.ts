import { z } from 'zod';
import { DEFAULT_BACKOFF_CAP_MS, RETRY_DELAY_DEFAULT } from '../../constants.js';

const DEFAULT_RETRY_ON = [
  'timeout',
  'rate_limit',
  'server_error',
  'network_error',
] as Array<'timeout' | 'rate_limit' | 'server_error' | 'network_error'>;

export const DEFAULT_RETRY_POLICY = {
  maxAttempts: 1,
  backoffMs: 1_000,
  backoffMultiplier: 2,
  retryOn: [...DEFAULT_RETRY_ON],
};

export const SchemaReferenceSchema = z.object({
  $ref: z.string().min(1),
});

export type SchemaReference = z.infer<typeof SchemaReferenceSchema>;

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(DEFAULT_RETRY_POLICY.maxAttempts),
  backoffMs: z.number().int().min(100).max(DEFAULT_BACKOFF_CAP_MS).default(DEFAULT_RETRY_POLICY.backoffMs),
  backoffMultiplier: z.number().min(1).max(5).default(DEFAULT_RETRY_POLICY.backoffMultiplier),
  retryOn: z.array(z.enum(['timeout', 'rate_limit', 'server_error', 'network_error'])).optional(),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export const StepTypeSchema = z.enum([
  'prompt',
  'tool',
  'conditional',
  'loop',
  'parallel',
  'discuss',
  'delegate',
]);

export type StepType = z.infer<typeof StepTypeSchema>;

export const WorkflowStepSchema = z.object({
  stepId: z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/),
  type: StepTypeSchema,
  name: z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  inputSchema: SchemaReferenceSchema.optional(),
  outputSchema: SchemaReferenceSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
  timeout: z.number().int().min(RETRY_DELAY_DEFAULT).max(3_600_000).optional(),
  config: z.record(z.unknown()).optional(),
  dependencies: z.array(z.string().max(64)).optional(),
  tool: z.string().max(128).optional(),
  noCache: z.boolean().optional(),
}).strict();

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  workflowId: z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  category: z.string().max(64).optional(),
  tags: z.array(z.string().max(64)).optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export type Workflow = z.infer<typeof WorkflowSchema>;

export function validateWorkflow(data: unknown): Workflow {
  return WorkflowSchema.parse(data);
}

export function safeValidateWorkflow(data: unknown) {
  return WorkflowSchema.safeParse(data);
}
