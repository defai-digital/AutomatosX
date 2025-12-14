import { z } from 'zod';

/**
 * Task types that can be routed
 */
export const TaskTypeSchema = z.enum([
  'chat',
  'completion',
  'code',
  'analysis',
  'creative',
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Risk level for routing decisions
 */
export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/**
 * Supported providers
 */
export const ProviderSchema = z.enum(['anthropic', 'openai', 'google', 'local']);

export type Provider = z.infer<typeof ProviderSchema>;

/**
 * Model capabilities
 */
export const ModelCapabilitySchema = z.enum([
  'vision',
  'function_calling',
  'json_mode',
  'streaming',
]);

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

/**
 * Budget constraints
 */
export const BudgetSchema = z.object({
  maxCostUsd: z.number().min(0).optional(),
  maxTokens: z.number().int().min(1).optional(),
  maxLatencyMs: z.number().int().min(1).optional(),
});

export type Budget = z.infer<typeof BudgetSchema>;

/**
 * Model requirements
 */
export const ModelRequirementsSchema = z.object({
  minContextLength: z.number().int().min(1).optional(),
  capabilities: z.array(ModelCapabilitySchema).optional(),
  preferredProviders: z.array(z.string()).optional(),
  excludedModels: z.array(z.string()).optional(),
});

export type ModelRequirements = z.infer<typeof ModelRequirementsSchema>;

/**
 * Routing input context
 */
export const RoutingInputSchema = z.object({
  taskType: TaskTypeSchema,
  budget: BudgetSchema.optional(),
  riskLevel: RiskLevelSchema.default('medium'),
  requirements: ModelRequirementsSchema.optional(),
  context: z.record(z.unknown()).optional(),
});

export type RoutingInput = z.infer<typeof RoutingInputSchema>;

/**
 * Routing decision output
 */
export const RoutingDecisionSchema = z.object({
  selectedModel: z.string().min(1),
  provider: ProviderSchema,
  isExperimental: z.boolean().default(false),
  estimatedCostUsd: z.number().min(0).optional(),
  reasoning: z.string().min(1).max(512),
  fallbackModels: z.array(z.string()).optional(),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * Complete routing record
 */
export const RoutingRecordSchema = z.object({
  requestId: z.string().uuid(),
  input: RoutingInputSchema,
  decision: RoutingDecisionSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type RoutingRecord = z.infer<typeof RoutingRecordSchema>;

/**
 * Validates a routing input
 */
export function validateRoutingInput(data: unknown): RoutingInput {
  return RoutingInputSchema.parse(data);
}

/**
 * Validates a routing decision
 */
export function validateRoutingDecision(data: unknown): RoutingDecision {
  return RoutingDecisionSchema.parse(data);
}

/**
 * Validates a complete routing record
 */
export function validateRoutingRecord(data: unknown): RoutingRecord {
  return RoutingRecordSchema.parse(data);
}

/**
 * Safely validates a routing record
 */
export function safeValidateRoutingRecord(
  data: unknown
): z.SafeParseReturnType<unknown, RoutingRecord> {
  return RoutingRecordSchema.safeParse(data);
}
