/**
 * Workflow Templates Contract V1 - Schema Definitions
 *
 * Defines reusable workflow template schemas for different categories:
 * - ML lifecycle workflows
 * - Product development workflows
 * - Infrastructure workflows
 * - Leadership/strategic workflows
 */

import { z } from 'zod';
import { TIMEOUT_AGENT_STEP_DEFAULT, TIMEOUT_AGENT_STEP_MAX } from '../../constants.js';

/**
 * Workflow template categories
 */
export const WorkflowCategorySchema = z.enum([
  'ml-lifecycle', // Machine learning workflows
  'product-development', // Product management workflows
  'engineering', // Software engineering workflows
  'infrastructure', // DevOps/infrastructure workflows
  'leadership', // Strategic planning workflows
  'quality', // QA and testing workflows
  'security', // Security audit workflows
  'research', // Technology research workflows
]);

/**
 * Workflow step configuration for templates
 */
export const TemplateStepConfigSchema = z.object({
  agent: z.string().min(1).max(50),
  task: z.string().min(1).max(5000),
  tools: z.array(z.string()).max(10).optional(),
  outputs: z.array(z.string()).max(20).optional(),
});

/**
 * Workflow template step
 */
export const WorkflowTemplateStepSchema = z.object({
  stepId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .max(64),
  name: z.string().max(128),
  type: z.enum(['prompt', 'tool', 'conditional', 'parallel']),
  timeout: z.number().int().min(1000).max(TIMEOUT_AGENT_STEP_MAX).default(TIMEOUT_AGENT_STEP_DEFAULT),
  config: TemplateStepConfigSchema,
  retryPolicy: z
    .object({
      maxAttempts: z.number().int().min(1).max(5).default(2),
      backoffMs: z.number().int().min(1000).max(30000).default(2000),
    })
    .optional(),
});

/**
 * Workflow template metadata
 */
export const WorkflowTemplateMetadataSchema = z.object({
  requiredAbilities: z.array(z.string()).max(20),
  requiredAgents: z.array(z.string()).max(10).optional(),
  estimatedDuration: z.number().int().min(60).max(86400), // seconds
  complexity: z.enum(['low', 'medium', 'high']),
  schedule: z.string().max(100).optional(), // cron expression
});

/**
 * Workflow template storage configuration
 */
export const WorkflowTemplateStorageSchema = z.object({
  namespace: z.string().max(100),
  ttl: z.number().int().min(3600).max(31536000).optional(), // seconds, 1hr to 1yr
});

/**
 * Complete workflow template definition
 */
export const WorkflowTemplateSchema = z.object({
  workflowId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .max(64),
  name: z.string().max(128),
  description: z.string().max(512),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: WorkflowCategorySchema,
  tags: z.array(z.string().max(50)).max(20),
  metadata: WorkflowTemplateMetadataSchema,
  steps: z.array(WorkflowTemplateStepSchema).min(1).max(50),
  storage: WorkflowTemplateStorageSchema.optional(),
});

/**
 * Workflow template registry entry
 */
export const WorkflowTemplateRegistryEntrySchema = z.object({
  template: WorkflowTemplateSchema,
  registeredAt: z.string().datetime(),
  registeredBy: z.string().max(100),
  enabled: z.boolean().default(true),
  deprecatedAt: z.string().datetime().optional(),
  deprecationReason: z.string().max(500).optional(),
});

/**
 * Workflow template execution request
 */
export const WorkflowTemplateExecutionRequestSchema = z.object({
  templateId: z.string().max(64),
  sessionId: z.string().uuid().optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
  overrides: z
    .object({
      timeout: z.number().int().min(1000).max(3600000).optional(),
      retryPolicy: z
        .object({
          maxAttempts: z.number().int().min(1).max(5),
          backoffMs: z.number().int().min(1000).max(30000),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Workflow template execution result
 */
export const WorkflowTemplateExecutionResultSchema = z.object({
  templateId: z.string().max(64),
  executionId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  stepResults: z.array(
    z.object({
      stepId: z.string().max(64),
      status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
      output: z.unknown().optional(),
      error: z.string().max(2000).optional(),
      duration: z.number().int().min(0).optional(),
    })
  ),
  outputs: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(2000).optional(),
});

// Type exports
export type WorkflowCategory = z.infer<typeof WorkflowCategorySchema>;
export type TemplateStepConfig = z.infer<typeof TemplateStepConfigSchema>;
export type WorkflowTemplateStep = z.infer<typeof WorkflowTemplateStepSchema>;
export type WorkflowTemplateMetadata = z.infer<typeof WorkflowTemplateMetadataSchema>;
export type WorkflowTemplateStorage = z.infer<typeof WorkflowTemplateStorageSchema>;
export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;
export type WorkflowTemplateRegistryEntry = z.infer<typeof WorkflowTemplateRegistryEntrySchema>;
export type WorkflowTemplateExecutionRequest = z.infer<
  typeof WorkflowTemplateExecutionRequestSchema
>;
export type WorkflowTemplateExecutionResult = z.infer<typeof WorkflowTemplateExecutionResultSchema>;

// Validation helpers
export const validateWorkflowTemplate = (data: unknown): WorkflowTemplate => {
  return WorkflowTemplateSchema.parse(data);
};

export const safeValidateWorkflowTemplate = (
  data: unknown
): { success: true; data: WorkflowTemplate } | { success: false; error: z.ZodError } => {
  const result = WorkflowTemplateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const validateWorkflowTemplateExecutionRequest = (
  data: unknown
): WorkflowTemplateExecutionRequest => {
  return WorkflowTemplateExecutionRequestSchema.parse(data);
};

// Factory functions
export const createWorkflowTemplate = (
  params: Omit<WorkflowTemplate, 'version'> & { version?: string }
): WorkflowTemplate => {
  return WorkflowTemplateSchema.parse({
    ...params,
    version: params.version ?? '1.0.0',
  });
};

// Error codes
export const WorkflowTemplateErrorCodes = {
  TEMPLATE_NOT_FOUND: 'WORKFLOW_TEMPLATE_NOT_FOUND',
  TEMPLATE_ALREADY_EXISTS: 'WORKFLOW_TEMPLATE_ALREADY_EXISTS',
  TEMPLATE_DEPRECATED: 'WORKFLOW_TEMPLATE_DEPRECATED',
  INVALID_TEMPLATE_SCHEMA: 'INVALID_WORKFLOW_TEMPLATE_SCHEMA',
  AGENT_NOT_FOUND: 'WORKFLOW_TEMPLATE_AGENT_NOT_FOUND',
  TOOL_NOT_AVAILABLE: 'WORKFLOW_TEMPLATE_TOOL_NOT_AVAILABLE',
  STEP_TIMEOUT: 'WORKFLOW_TEMPLATE_STEP_TIMEOUT',
  EXECUTION_FAILED: 'WORKFLOW_TEMPLATE_EXECUTION_FAILED',
} as const;

export type WorkflowTemplateErrorCode =
  (typeof WorkflowTemplateErrorCodes)[keyof typeof WorkflowTemplateErrorCodes];
