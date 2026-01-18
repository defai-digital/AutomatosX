/**
 * Agent Domain Contracts v1
 *
 * Zod schemas for agent profiles, orchestration, and events.
 */

import { z } from 'zod';

// ============================================================================
// Supporting Schemas
// ============================================================================

/**
 * Agent personality traits
 */
export const AgentPersonalitySchema = z.object({
  traits: z.array(z.string().max(100)).max(10).optional(),
  catchphrase: z.string().max(200).optional(),
  communicationStyle: z.string().max(200).optional(),
  decisionMaking: z.string().max(200).optional(),
});

export type AgentPersonality = z.infer<typeof AgentPersonalitySchema>;

/**
 * Ability selection configuration
 */
export const AbilitySelectionSchema = z.object({
  core: z.array(z.string().max(100)).max(50).optional(),
  taskBased: z.record(z.string(), z.array(z.string())).optional(),
  loadAll: z.boolean().optional(),
});

export type AbilitySelection = z.infer<typeof AbilitySelectionSchema>;

/**
 * Redirect rule for agent selection
 */
export const RedirectRuleSchema = z.object({
  phrase: z.string().max(500),
  suggest: z.string().max(100),
});

export type RedirectRule = z.infer<typeof RedirectRuleSchema>;

/**
 * Agent category for routing classification
 *
 * Categories help CLI understand agent roles:
 * - orchestrator: Delegates to others (CEO, CTO, architecture)
 * - implementer: Executes tasks directly (backend, frontend, devops)
 * - reviewer: Reviews/audits work (reviewer, security, quality)
 * - specialist: Domain expert (blockchain, ml-engineer, quantum)
 * - generalist: Fallback agent (standard)
 */
export const AgentCategorySchema = z.enum([
  'orchestrator',
  'implementer',
  'reviewer',
  'specialist',
  'generalist',
]);

export type AgentCategory = z.infer<typeof AgentCategorySchema>;

/**
 * Selection metadata for agent routing
 *
 * Invariants:
 * - INV-AGT-SEL-005: exampleTasks boost confidence when matched
 * - INV-AGT-SEL-006: notForTasks reduce confidence when matched
 */
export const SelectionMetadataSchema = z.object({
  primaryIntents: z.array(z.string().max(100)).max(20).optional(),
  secondarySignals: z.array(z.string().max(100)).max(20).optional(),
  negativeIntents: z.array(z.string().max(100)).max(20).optional(),
  redirectWhen: z.array(RedirectRuleSchema).max(10).optional(),
  keywords: z.array(z.string().max(50)).max(50).optional(),
  antiKeywords: z.array(z.string().max(50)).max(50).optional(),
  // NEW: Explicit task examples for better matching
  exampleTasks: z.array(z.string().max(200)).max(10).optional()
    .describe('Example tasks this agent handles well'),
  notForTasks: z.array(z.string().max(200)).max(10).optional()
    .describe('Tasks this agent should NOT handle'),
  // NEW: Agent category for grouping
  agentCategory: AgentCategorySchema.optional()
    .describe('Agent classification for routing'),
});

export type SelectionMetadata = z.infer<typeof SelectionMetadataSchema>;

/**
 * Provider affinity configuration for multi-model discussions
 *
 * Invariants:
 * - INV-AGT-AFF-001: Preferred providers are prioritized in discussions
 * - INV-AGT-AFF-002: Default synthesizer is used for consensus when not specified
 */
export const ProviderAffinitySchema = z.object({
  /** Preferred providers for this agent's discussions (ordered by preference) */
  preferred: z.array(z.string().max(50)).max(6).optional(),

  /** Provider to use for synthesis/consensus */
  defaultSynthesizer: z.string().max(50).optional(),

  /** Providers to exclude from discussions */
  excluded: z.array(z.string().max(50)).max(6).optional(),

  /** Override provider for specific task types */
  taskOverrides: z.record(z.string(), z.string().max(50)).optional(),

  /** Provider-specific temperature overrides */
  temperatureOverrides: z.record(z.string(), z.number().min(0).max(2)).optional(),
});

export type ProviderAffinity = z.infer<typeof ProviderAffinitySchema>;

/**
 * Orchestration configuration
 */
export const OrchestrationConfigSchema = z.object({
  maxDelegationDepth: z.number().int().min(0).max(10).optional(),
  canReadWorkspaces: z.array(z.string().max(100)).max(20).optional(),
  canWriteToShared: z.boolean().optional(),
  delegationTimeout: z.number().int().min(1000).max(600000).optional(),
});

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

/**
 * Agent retry policy for workflow steps
 */
export const AgentRetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  backoffMs: z.number().int().min(100).max(60000),
  backoffMultiplier: z.number().min(1).max(5),
  retryOn: z
    .array(z.enum(['timeout', 'rateLimit', 'serverError', 'networkError']))
    .optional(),
});

export type AgentRetryPolicy = z.infer<typeof AgentRetryPolicySchema>;

/**
 * Agent step type enumeration (includes 'delegate' and 'discuss' for multi-model)
 */
export const AgentStepTypeSchema = z.enum([
  'prompt',
  'tool',
  'conditional',
  'loop',
  'parallel',
  'delegate',
  'discuss', // Multi-model discussion step
]);

export type AgentStepType = z.infer<typeof AgentStepTypeSchema>;

/**
 * Agent workflow step schema (extended with agent-specific fields)
 */
export const AgentWorkflowStepSchema = z.object({
  stepId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: AgentStepTypeSchema,
  config: z.record(z.string(), z.unknown()).default({}),
  dependencies: z.array(z.string().max(100)).max(20).optional(),
  condition: z.string().max(500).optional(),
  parallel: z.boolean().optional(),
  retryPolicy: AgentRetryPolicySchema.optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  keyQuestions: z.array(z.string().max(500)).max(10).optional(),
  outputs: z.array(z.string().max(100)).max(20).optional(),
  streaming: z.boolean().optional(),
  saveToMemory: z.boolean().optional(),
  checkpoint: z.boolean().optional(),
});

export type AgentWorkflowStep = z.infer<typeof AgentWorkflowStepSchema>;

// ============================================================================
// Agent Profile Schema
// ============================================================================

/**
 * Base agent profile schema (without workflow validation)
 */
const AgentProfileBaseSchema = z.object({
  // Identity
  agentId: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      'Agent ID must start with letter and contain only alphanumeric, dash, underscore'
    ),
  displayName: z.string().max(100).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be SemVer format')
    .optional(),
  description: z.string().min(1).max(2000),

  // Role and Expertise
  role: z.string().max(200).optional(),
  expertise: z.array(z.string().max(100)).max(20).optional(),
  capabilities: z.array(z.string().max(100)).max(50).optional(),

  // System Prompt
  systemPrompt: z.string().max(10000).optional(),

  // Workflow Definition (uses agent-specific workflow step)
  workflow: z.array(AgentWorkflowStepSchema).max(100).optional(),

  // Personality
  personality: AgentPersonalitySchema.optional(),

  // Abilities
  abilities: AbilitySelectionSchema.optional(),

  // Thinking Patterns
  thinkingPatterns: z.array(z.string().max(500)).max(20).optional(),

  // Dependencies
  dependencies: z.array(z.string().max(50)).max(20).optional(),

  // Execution Settings
  parallel: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200000).optional(),

  // Orchestration
  orchestration: OrchestrationConfigSchema.optional(),

  // Provider Affinity (for multi-model discussions)
  providerAffinity: ProviderAffinitySchema.optional(),

  // Selection Metadata
  selectionMetadata: SelectionMetadataSchema.optional(),

  // Team and Collaboration
  team: z.string().max(100).optional(),
  collaboratesWith: z.array(z.string().max(50)).max(20).optional(),

  // Additional Metadata
  tags: z.array(z.string().max(50)).max(20).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  enabled: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Timestamps (managed by system)
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Agent profile schema - the aggregate root for agents
 *
 * Includes workflow validation:
 * - INV-AGT-WF-001: Prompt-type workflow steps must have non-empty 'prompt' in config
 * - INV-AGT-WF-002: Delegate-type workflow steps must have 'targetAgent' in config
 * - INV-AGT-WF-003: Step dependencies must reference existing step IDs
 */
export const AgentProfileSchema = AgentProfileBaseSchema.superRefine((data, ctx) => {
  // Skip validation if no workflow
  if (!data.workflow || data.workflow.length === 0) {
    return;
  }

  const workflow = data.workflow;
  const stepIds = new Set(workflow.map((s) => s.stepId));

  for (let i = 0; i < workflow.length; i++) {
    const step = workflow[i]!;

    // INV-AGT-WF-001: Validate prompt steps have non-empty prompt
    if (step.type === 'prompt') {
      const config = step.config;
      const prompt = config.prompt;

      if (!prompt || (typeof prompt === 'string' && prompt.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Workflow step "${step.stepId}" is type "prompt" but has no "prompt" in config. Prompt steps require a non-empty prompt string.`,
          path: ['workflow', i, 'config', 'prompt'],
        });
      }
    }

    // INV-AGT-WF-002: Validate delegate steps have targetAgent
    if (step.type === 'delegate') {
      const config = step.config;
      const targetAgent = config.targetAgent;

      if (!targetAgent || (typeof targetAgent === 'string' && targetAgent.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Workflow step "${step.stepId}" is type "delegate" but has no "targetAgent" in config. Delegate steps require a target agent ID.`,
          path: ['workflow', i, 'config', 'targetAgent'],
        });
      }
    }

    // INV-AGT-WF-003: Validate dependencies reference existing steps
    if (step.dependencies && step.dependencies.length > 0) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Workflow step "${step.stepId}" depends on "${dep}" which does not exist in the workflow.`,
            path: ['workflow', i, 'dependencies'],
          });
        }
      }
    }
  }
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

// ============================================================================
// Agent Run Options
// ============================================================================

/**
 * Options for running an agent
 */
export const AgentRunOptionsSchema = z.object({
  // Memory
  memory: z.boolean().optional(),
  saveMemory: z.boolean().optional(),

  // Session
  sessionId: z.string().uuid().optional(),
  createSession: z.boolean().optional(),

  // Provider
  provider: z.string().max(50).optional(),
  model: z.string().max(100).optional(),

  // Output
  format: z.enum(['text', 'json']).optional(),
  verbose: z.boolean().optional(),
  debug: z.boolean().optional(),
  quiet: z.boolean().optional(),

  // Execution
  parallel: z.boolean().optional(),
  streaming: z.boolean().optional(),
  resumable: z.boolean().optional(),
  checkpoint: z.boolean().optional(),

  // Idempotency
  idempotencyKey: z.string().uuid().optional(),

  // Delegation context (for tracking delegation depth and chain)
  // INV-DT-001: Used to enforce max delegation depth
  // INV-DT-002: Used to prevent circular delegations
  delegationContext: z.lazy(() => z.object({
    currentDepth: z.number().int().min(0),
    maxDepth: z.number().int().min(1).max(10),
    delegationChain: z.array(z.string()),
    initiatorAgentId: z.string(),
    rootTaskId: z.string().uuid(),
    startedAt: z.string().datetime().optional(),
  })).optional(),

  // Trace hierarchy context for hierarchical tracing
  // INV-TR-020: All traces in hierarchy share rootTraceId
  // INV-TR-021: Child traces reference parentTraceId
  // INV-TR-022: Depth increases by 1 for each level
  // INV-TR-023: Session correlation
  traceHierarchy: z.object({
    parentTraceId: z.string().uuid().optional(),
    rootTraceId: z.string().uuid().optional(),
    traceDepth: z.number().int().min(0),
    sessionId: z.string().uuid().optional(),
  }).optional(),

  // Current trace ID (for child agents to reference)
  traceId: z.string().uuid().optional(),
});

export type AgentRunOptions = z.infer<typeof AgentRunOptionsSchema>;

// ============================================================================
// Agent Events
// ============================================================================

/**
 * Agent event types
 */
export const AgentEventTypeSchema = z.enum([
  'agent.registered',
  'agent.started',
  'agent.stageStarted',
  'agent.stageCompleted',
  'agent.stageFailed',
  'agent.delegated',
  'agent.delegationReturned',
  'agent.completed',
  'agent.failed',
]);

export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

/**
 * Agent error schema
 */
export const AgentErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stepId: z.string().optional(),
  retryable: z.boolean().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type AgentError = z.infer<typeof AgentErrorSchema>;

/**
 * Agent event payload variants
 */
export const AgentEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('registered'),
    profile: AgentProfileSchema,
  }),
  z.object({
    type: z.literal('started'),
    sessionId: z.string().uuid().optional(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('stageStarted'),
    stepId: z.string(),
    stageName: z.string(),
  }),
  z.object({
    type: z.literal('stageCompleted'),
    stepId: z.string(),
    output: z.unknown(),
  }),
  z.object({
    type: z.literal('stageFailed'),
    stepId: z.string(),
    error: AgentErrorSchema,
  }),
  z.object({
    type: z.literal('delegated'),
    targetAgent: z.string(),
    task: z.string(),
  }),
  z.object({
    type: z.literal('delegationReturned'),
    fromAgent: z.string(),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('completed'),
    output: z.unknown(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal('failed'),
    error: AgentErrorSchema,
  }),
]);

export type AgentEventPayload = z.infer<typeof AgentEventPayloadSchema>;

/**
 * Base event schema
 */
export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.number().int().min(1),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  spanId: z.string().optional(),
  traceId: z.string().optional(),
});

/**
 * Agent event schema
 */
export const AgentEventSchema = BaseEventSchema.extend({
  aggregateId: z.string(), // agentId
  type: AgentEventTypeSchema,
  payload: AgentEventPayloadSchema,
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

// ============================================================================
// Agent Result
// ============================================================================

/**
 * Agent execution result
 */
export const AgentResultSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  sessionId: z.string().uuid().optional(),
  output: z.unknown().optional(),
  stepResults: z
    .array(
      z.object({
        stepId: z.string(),
        success: z.boolean(),
        output: z.unknown().optional(),
        durationMs: z.number(),
        retryCount: z.number().int().min(0),
        skipped: z.boolean(),
        error: AgentErrorSchema.optional(),
      })
    )
    .optional(),
  error: AgentErrorSchema.optional(),
  totalDurationMs: z.number(),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Agent error codes
 */
export const AgentErrorCode = {
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_VALIDATION_ERROR: 'AGENT_VALIDATION_ERROR',
  AGENT_DELEGATION_DEPTH_EXCEEDED: 'AGENT_DELEGATION_DEPTH_EXCEEDED',
  AGENT_DELEGATION_TIMEOUT: 'AGENT_DELEGATION_TIMEOUT',
  AGENT_STAGE_FAILED: 'AGENT_STAGE_FAILED',
  AGENT_DEPENDENCY_FAILED: 'AGENT_DEPENDENCY_FAILED',
  AGENT_PERMISSION_DENIED: 'AGENT_PERMISSION_DENIED',
  AGENT_ALREADY_RUNNING: 'AGENT_ALREADY_RUNNING',
  AGENT_WORKFLOW_INVALID: 'AGENT_WORKFLOW_INVALID',
} as const;

export type AgentErrorCode = (typeof AgentErrorCode)[keyof typeof AgentErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates an agent profile
 */
export function validateAgentProfile(data: unknown): AgentProfile {
  return AgentProfileSchema.parse(data);
}

/**
 * Safely validates an agent profile
 */
export function safeValidateAgentProfile(
  data: unknown
): { success: true; data: AgentProfile } | { success: false; error: z.ZodError } {
  const result = AgentProfileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates agent run options
 */
export function validateAgentRunOptions(data: unknown): AgentRunOptions {
  return AgentRunOptionsSchema.parse(data);
}

// ============================================================================
// Checkpoint Contracts
// ============================================================================

/**
 * Checkpoint configuration
 *
 * Invariants:
 * - INV-CP-001: Checkpoint contains all data needed to resume
 * - INV-CP-002: Resumed execution starts from step after checkpoint
 */
export const CheckpointConfigSchema = z.object({
  /** Enable checkpointing */
  enabled: z.boolean().default(true),

  /** Checkpoint after every N steps (0 = every step) */
  intervalSteps: z.number().int().min(0).max(100).default(1),

  /** Checkpoint retention period in hours */
  retentionHours: z.number().int().min(1).max(720).default(24),

  /** Include memory snapshot in checkpoint */
  includeMemory: z.boolean().default(false),

  /** Max checkpoints to retain per agent */
  maxCheckpoints: z.number().int().min(1).max(100).default(10),
});

export type CheckpointConfig = z.infer<typeof CheckpointConfigSchema>;

/**
 * Memory snapshot item for checkpoint
 */
export const MemorySnapshotItemSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  namespace: z.string().optional(),
});

export type MemorySnapshotItem = z.infer<typeof MemorySnapshotItemSchema>;

/**
 * Checkpoint schema - persisted execution state
 */
export const CheckpointSchema = z.object({
  /** Unique checkpoint identifier */
  checkpointId: z.string().uuid(),

  /** Agent that created this checkpoint */
  agentId: z.string(),

  /** Session if applicable */
  sessionId: z.string().uuid().optional(),

  /** Workflow if applicable */
  workflowId: z.string().optional(),

  /** Current step index (0-based) */
  stepIndex: z.number().int().min(0),

  /** ID of the last completed step */
  completedStepId: z.string(),

  /** Accumulated outputs from completed steps */
  stepOutputs: z.record(z.string(), z.unknown()),

  /** Execution context at checkpoint time */
  context: z.record(z.string(), z.unknown()),

  /** Memory state snapshot (if configured) */
  memorySnapshot: z.array(MemorySnapshotItemSchema).optional(),

  /** Checkpoint creation time */
  createdAt: z.string().datetime(),

  /** Checkpoint expiration time */
  expiresAt: z.string().datetime().optional(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

/**
 * Resume context from checkpoint
 */
export const ResumeContextSchema = z.object({
  /** Step index to resume from */
  startFromStep: z.number().int().min(0),

  /** Outputs from previously completed steps */
  previousOutputs: z.record(z.string(), z.unknown()),

  /** Execution context */
  context: z.record(z.string(), z.unknown()),

  /** Memory snapshot to restore */
  memorySnapshot: z.array(MemorySnapshotItemSchema).optional(),
});

export type ResumeContext = z.infer<typeof ResumeContextSchema>;

/**
 * Checkpoint error codes
 */
export const CheckpointErrorCodes = {
  CHECKPOINT_NOT_FOUND: 'CHECKPOINT_NOT_FOUND',
  CHECKPOINT_EXPIRED: 'CHECKPOINT_EXPIRED',
  CHECKPOINT_INVALID: 'CHECKPOINT_INVALID',
  CHECKPOINT_SAVE_FAILED: 'CHECKPOINT_SAVE_FAILED',
} as const;

export type CheckpointErrorCode =
  (typeof CheckpointErrorCodes)[keyof typeof CheckpointErrorCodes];

// ============================================================================
// Delegation Contracts
// ============================================================================

/**
 * Delegation context - tracks delegation chain
 *
 * Invariants:
 * - INV-DT-001: Depth never exceeds maxDepth
 * - INV-DT-002: No circular delegations (agent can't delegate to itself or ancestors)
 */
export const DelegationContextSchema = z.object({
  /** Current depth in delegation chain */
  currentDepth: z.number().int().min(0),

  /** Maximum allowed delegation depth */
  maxDepth: z.number().int().min(1).max(10),

  /** Chain of agent IDs in delegation (oldest first) */
  delegationChain: z.array(z.string()),

  /** Original initiator agent ID */
  initiatorAgentId: z.string(),

  /** Root task ID for correlation */
  rootTaskId: z.string().uuid(),

  /** Timestamp when delegation chain started */
  startedAt: z.string().datetime().optional(),
});

export type DelegationContext = z.infer<typeof DelegationContextSchema>;

/**
 * Delegation request
 */
export const DelegationRequestSchema = z.object({
  /** Agent initiating the delegation */
  fromAgentId: z.string(),

  /** Target agent to delegate to */
  toAgentId: z.string(),

  /** Task description */
  task: z.string().max(5000),

  /** Delegation context for tracking */
  context: DelegationContextSchema,

  /** Timeout for delegated task in ms */
  timeout: z.number().int().min(1000).max(600000).optional(),

  /** Input data for delegated agent */
  input: z.unknown().optional(),
});

export type DelegationRequest = z.infer<typeof DelegationRequestSchema>;

/**
 * Delegation result
 */
export const DelegationResultSchema = z.object({
  /** Whether delegation succeeded */
  success: z.boolean(),

  /** Agent that handled the delegation */
  handledBy: z.string(),

  /** Result from delegated agent */
  result: z.unknown().optional(),

  /** Error if delegation failed */
  error: AgentErrorSchema.optional(),

  /** Duration of delegated execution */
  durationMs: z.number().int().min(0),

  /** Final delegation depth reached */
  finalDepth: z.number().int().min(0),
});

export type DelegationResult = z.infer<typeof DelegationResultSchema>;

/**
 * Delegation check result
 */
export const DelegationCheckResultSchema = z.object({
  /** Whether delegation is allowed */
  allowed: z.boolean(),

  /** Reason if not allowed */
  reason: z.string().optional(),

  /** Detailed message */
  message: z.string().optional(),
});

export type DelegationCheckResult = z.infer<typeof DelegationCheckResultSchema>;

/**
 * Delegation error codes
 */
export const DelegationErrorCodes = {
  MAX_DEPTH_EXCEEDED: 'DELEGATION_MAX_DEPTH_EXCEEDED',
  CIRCULAR_DELEGATION: 'DELEGATION_CIRCULAR',
  TARGET_NOT_FOUND: 'DELEGATION_TARGET_NOT_FOUND',
  TARGET_UNAVAILABLE: 'DELEGATION_TARGET_UNAVAILABLE',
  TIMEOUT: 'DELEGATION_TIMEOUT',
  PERMISSION_DENIED: 'DELEGATION_PERMISSION_DENIED',
} as const;

export type DelegationErrorCode =
  (typeof DelegationErrorCodes)[keyof typeof DelegationErrorCodes];

// ============================================================================
// Parallel Execution Contracts
// ============================================================================

/**
 * Parallel execution failure strategy
 */
export const ParallelFailureStrategySchema = z.enum([
  'failFast',       // Cancel remaining steps, fail immediately
  'failSafe',       // Wait for all steps, collect errors
  'continueOnError', // Continue execution, log errors
]);

export type ParallelFailureStrategy = z.infer<typeof ParallelFailureStrategySchema>;

/**
 * Parallel execution configuration
 *
 * Invariants:
 * - INV-PE-001: Independent steps execute concurrently
 * - INV-PE-002: Dependencies honored (DAG ordering)
 * - INV-PE-003: Concurrency limit respected
 */
export const ParallelExecutionConfigSchema = z.object({
  /** Enable parallel execution */
  enabled: z.boolean().default(true),

  /** Maximum concurrent steps (INV-PE-003) */
  maxConcurrency: z.number().int().min(1).max(10).default(5),

  /** Strategy when one parallel step fails */
  failureStrategy: ParallelFailureStrategySchema.default('failFast'),

  /** Timeout for entire parallel group in ms */
  groupTimeoutMs: z.number().int().min(1000).max(600000).optional(),

  /** Enable step-level checkpointing in parallel groups */
  checkpointParallel: z.boolean().default(false),
});

export type ParallelExecutionConfig = z.infer<typeof ParallelExecutionConfigSchema>;

/**
 * Parallel step result
 */
export const ParallelStepResultSchema = z.object({
  /** Step identifier */
  stepId: z.string(),

  /** Whether step succeeded */
  success: z.boolean(),

  /** Step output */
  output: z.unknown().optional(),

  /** Error message if failed */
  error: z.string().optional(),

  /** Error code if failed */
  errorCode: z.string().optional(),

  /** Step duration in ms */
  durationMs: z.number().int().min(0),

  /** Whether step was cancelled */
  cancelled: z.boolean().optional(),

  /** Retry count for this step */
  retryCount: z.number().int().min(0).optional(),
});

export type ParallelStepResult = z.infer<typeof ParallelStepResultSchema>;

/**
 * Parallel group execution result
 */
export const ParallelGroupResultSchema = z.object({
  /** Group identifier */
  groupId: z.string().uuid(),

  /** Results for each step in the group */
  stepResults: z.array(ParallelStepResultSchema),

  /** Total duration for the group in ms */
  totalDurationMs: z.number().int().min(0),

  /** Whether all steps succeeded */
  allSucceeded: z.boolean(),

  /** List of failed step IDs */
  failedSteps: z.array(z.string()),

  /** List of cancelled step IDs */
  cancelledSteps: z.array(z.string()).optional(),

  /** Number of steps executed */
  stepsExecuted: z.number().int().min(0),

  /** Number of steps skipped */
  stepsSkipped: z.number().int().min(0).optional(),
});

export type ParallelGroupResult = z.infer<typeof ParallelGroupResultSchema>;

// NOTE: ParallelExecutionErrorCodes moved to parallel-execution/v1/schema.ts
// Re-exported from there for backwards compatibility

// ============================================================================
// Validation Functions for New Contracts
// ============================================================================

/**
 * Validates checkpoint configuration
 */
export function validateCheckpointConfig(data: unknown): CheckpointConfig {
  return CheckpointConfigSchema.parse(data);
}

/**
 * Validates a checkpoint
 */
export function validateCheckpoint(data: unknown): Checkpoint {
  return CheckpointSchema.parse(data);
}

/**
 * Validates delegation context
 */
export function validateDelegationContext(data: unknown): DelegationContext {
  return DelegationContextSchema.parse(data);
}

/**
 * Validates delegation request
 */
export function validateDelegationRequest(data: unknown): DelegationRequest {
  return DelegationRequestSchema.parse(data);
}

/**
 * Validates parallel execution configuration
 */
export function validateParallelExecutionConfig(data: unknown): ParallelExecutionConfig {
  return ParallelExecutionConfigSchema.parse(data);
}

/**
 * Creates default checkpoint configuration
 */
export function createDefaultCheckpointConfig(): CheckpointConfig {
  return CheckpointConfigSchema.parse({});
}

/**
 * Creates default parallel execution configuration
 */
export function createDefaultParallelExecutionConfig(): ParallelExecutionConfig {
  return ParallelExecutionConfigSchema.parse({});
}

/**
 * Creates initial delegation context for root agent
 */
export function createRootDelegationContext(
  agentId: string,
  taskId: string,
  maxDepth = 3
): DelegationContext {
  return {
    currentDepth: 0,
    maxDepth,
    delegationChain: [agentId],
    initiatorAgentId: agentId,
    rootTaskId: taskId,
    startedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tool Executor Contracts
// ============================================================================

/**
 * Tool execution result
 *
 * Invariants:
 * - INV-TOOL-001: Tool execution must validate inputs before execution
 * - INV-TOOL-002: Tool results must be immutable after creation
 */
export const ToolExecutionResultSchema = z.object({
  /** Whether the tool execution succeeded */
  success: z.boolean(),

  /** Output from the tool (any JSON-serializable value) */
  output: z.unknown().optional(),

  /** Error message if execution failed */
  error: z.string().optional(),

  /** Error code if execution failed */
  errorCode: z.string().optional(),

  /** Whether the error is retryable */
  retryable: z.boolean().optional(),

  /** Execution duration in milliseconds */
  durationMs: z.number().int().min(0).optional(),
});

export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;

/**
 * Tool execution request
 */
export const ToolExecutionRequestSchema = z.object({
  /** Name of the tool to execute */
  toolName: z.string().min(1).max(100),

  /** Arguments to pass to the tool */
  args: z.record(z.string(), z.unknown()),

  /** Timeout in milliseconds */
  timeoutMs: z.number().int().min(1000).max(600000).optional(),

  /** Idempotency key for safe retries */
  idempotencyKey: z.string().uuid().optional(),
});

export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;

/**
 * Tool executor interface schema (for documentation/validation)
 *
 * This interface is implemented by tool execution bridges that connect
 * agent/workflow execution to actual tool handlers.
 *
 * Invariants:
 * - INV-TOOL-001: Tool execution must validate inputs before execution
 * - INV-TOOL-002: Tool results must be immutable (frozen) after creation
 * - INV-TOOL-003: Unknown tools must return error, not throw
 */
export const ToolExecutorConfigSchema = z.object({
  /** Default timeout for tool execution in ms */
  defaultTimeoutMs: z.number().int().min(1000).max(600000).default(60000),

  /** Whether to validate inputs against tool schemas */
  validateInputs: z.boolean().default(true),

  /** Whether to freeze outputs for immutability */
  freezeOutputs: z.boolean().default(true),
});

export type ToolExecutorConfig = z.infer<typeof ToolExecutorConfigSchema>;

/**
 * Tool executor error codes
 */
export const ToolExecutorErrorCodes = {
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_VALIDATION_ERROR: 'TOOL_VALIDATION_ERROR',
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',
  TOOL_TIMEOUT: 'TOOL_TIMEOUT',
  TOOL_PERMISSION_DENIED: 'TOOL_PERMISSION_DENIED',
} as const;

export type ToolExecutorErrorCode =
  (typeof ToolExecutorErrorCodes)[keyof typeof ToolExecutorErrorCodes];

/**
 * Validates tool execution result
 */
export function validateToolExecutionResult(data: unknown): ToolExecutionResult {
  return ToolExecutionResultSchema.parse(data);
}

/**
 * Validates tool execution request
 */
export function validateToolExecutionRequest(data: unknown): ToolExecutionRequest {
  return ToolExecutionRequestSchema.parse(data);
}

/**
 * Creates a successful tool execution result
 */
export function createToolExecutionSuccess(
  output: unknown,
  durationMs?: number
): ToolExecutionResult {
  return Object.freeze({
    success: true,
    output,
    durationMs,
  });
}

/**
 * Creates a failed tool execution result
 */
export function createToolExecutionFailure(
  error: string,
  errorCode: ToolExecutorErrorCode,
  retryable = false,
  durationMs?: number
): ToolExecutionResult {
  return Object.freeze({
    success: false,
    error,
    errorCode,
    retryable,
    durationMs,
  });
}

// ============================================================================
// Agent Selection Contracts (MCP Tools)
// ============================================================================

/**
 * Agent recommendation request schema
 *
 * Invariants:
 * - INV-AGT-SEL-001: Selection is deterministic (same input = same output)
 * - INV-AGT-SEL-004: Always returns at least one result (fallback to 'standard')
 */
export const AgentRecommendRequestSchema = z.object({
  /** Task description to match against agents */
  task: z.string().min(1).max(2000).describe('Task description to match'),

  /** Filter by team */
  team: z.string().max(100).optional().describe('Filter by team'),

  /** Required capabilities */
  requiredCapabilities: z.array(z.string().max(100)).max(10).optional()
    .describe('Required capabilities'),

  /** Agents to exclude from matching */
  excludeAgents: z.array(z.string().max(50)).max(20).optional()
    .describe('Agents to exclude'),

  /** Maximum number of results */
  maxResults: z.number().int().min(1).max(10).default(3)
    .describe('Max recommendations'),
});

export type AgentRecommendRequest = z.infer<typeof AgentRecommendRequestSchema>;

/**
 * Agent match result (used in alternatives)
 */
export const AgentMatchSchema = z.object({
  agentId: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

export type AgentMatch = z.infer<typeof AgentMatchSchema>;

/**
 * Agent recommendation result schema
 *
 * Invariants:
 * - INV-AGT-SEL-002: Confidence is between 0 and 1
 * - INV-AGT-SEL-003: Results sorted by confidence descending
 */
export const AgentRecommendResultSchema = z.object({
  /** Best matching agent ID */
  recommended: z.string().describe('Best matching agent ID'),

  /** Match confidence 0-1 */
  confidence: z.number().min(0).max(1).describe('Match confidence 0-1'),

  /** Why this agent was selected */
  reason: z.string().describe('Why this agent was selected'),

  /** Alternative agent matches */
  alternatives: z.array(AgentMatchSchema).describe('Alternative agent matches'),
});

export type AgentRecommendResult = z.infer<typeof AgentRecommendResultSchema>;

/**
 * Agent capabilities query request schema
 */
export const AgentCapabilitiesRequestSchema = z.object({
  /** Filter by agent category */
  category: AgentCategorySchema.optional()
    .describe('Filter by agent category'),

  /** Include disabled agents */
  includeDisabled: z.boolean().default(false)
    .describe('Include disabled agents'),
});

export type AgentCapabilitiesRequest = z.infer<typeof AgentCapabilitiesRequestSchema>;

/**
 * Agent capabilities result schema
 */
export const AgentCapabilitiesResultSchema = z.object({
  /** All unique capabilities */
  capabilities: z.array(z.string()).describe('All unique capabilities'),

  /** Capability → agent IDs mapping */
  agentsByCapability: z.record(z.string(), z.array(z.string()))
    .describe('Capability → agent IDs'),

  /** Agent ID → capabilities mapping */
  capabilitiesByAgent: z.record(z.string(), z.array(z.string()))
    .describe('Agent ID → capabilities'),

  /** Agent ID → category mapping */
  categoriesByAgent: z.record(z.string(), AgentCategorySchema).optional()
    .describe('Agent ID → category'),
});

export type AgentCapabilitiesResult = z.infer<typeof AgentCapabilitiesResultSchema>;

/**
 * Agent selection context for the selector
 */
export const AgentSelectionContextSchema = z.object({
  team: z.string().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  excludeAgents: z.array(z.string()).optional(),
});

export type AgentSelectionContext = z.infer<typeof AgentSelectionContextSchema>;

// ============================================================================
// Validation Functions for Selection Contracts
// ============================================================================

/**
 * Validates agent recommendation request
 */
export function validateAgentRecommendRequest(data: unknown): AgentRecommendRequest {
  return AgentRecommendRequestSchema.parse(data);
}

/**
 * Validates agent recommendation result
 */
export function validateAgentRecommendResult(data: unknown): AgentRecommendResult {
  return AgentRecommendResultSchema.parse(data);
}

/**
 * Validates agent capabilities request
 */
export function validateAgentCapabilitiesRequest(data: unknown): AgentCapabilitiesRequest {
  return AgentCapabilitiesRequestSchema.parse(data);
}

/**
 * Validates agent capabilities result
 */
export function validateAgentCapabilitiesResult(data: unknown): AgentCapabilitiesResult {
  return AgentCapabilitiesResultSchema.parse(data);
}
