// src/agent.ts
import { z as z2 } from "zod";

// src/common.ts
import { z } from "zod";
var AgentId = z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, "Agent ID must be lowercase alphanumeric with hyphens").brand();
var SessionId = z.string().uuid().brand();
var MemoryId = z.number().int().positive().brand();
var CheckpointId = z.string().uuid().brand();
var ProviderType = z.enum(["claude", "gemini", "ax-cli", "openai"]);
var IntegrationMode = z.enum(["mcp", "sdk", "bash"]);
var TaskStatus = z.enum(["pending", "running", "completed", "failed", "cancelled"]);
var MemoryType = z.enum(["conversation", "code", "document", "task", "decision"]);
var LogLevel = z.enum(["debug", "info", "warn", "error", "fatal"]);
var ISODateString = z.string().datetime();
var DurationMs = z.number().int().nonnegative();
var Percentage = z.number().min(0).max(100);
var NormalizedScore = z.number().min(0).max(1);
var NonEmptyStringArray = z.array(z.string()).min(1);
var Metadata = z.record(z.string(), z.unknown());
var TokenUsage = z.object({
  input: z.number().int().nonnegative().optional(),
  output: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional()
});
var ErrorInfo = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
  cause: z.string().optional()
});

// src/agent.ts
var CommunicationStyle = z2.enum(["formal", "casual", "technical", "friendly"]);
var DecisionMaking = z2.enum(["data-driven", "intuitive", "collaborative", "analytical"]);
var PersonalitySchema = z2.object({
  /** Character traits that define the agent's behavior (1-5 traits) */
  traits: z2.array(z2.string().min(1).max(50)).min(1).max(5),
  /** Optional catchphrase or signature expression */
  catchphrase: z2.string().max(200).optional(),
  /** How the agent communicates */
  communicationStyle: CommunicationStyle.default("technical"),
  /** How the agent makes decisions */
  decisionMaking: DecisionMaking.default("data-driven")
});
var AbilitySelectionSchema = z2.object({
  /** Core abilities always loaded for this agent */
  core: z2.array(z2.string()).default([]),
  /** Task-based abilities loaded by keyword matching */
  taskBased: z2.record(z2.string(), z2.array(z2.string())).default({})
});
var OrchestrationSchema = z2.object({
  /** Maximum depth of delegation chain (0 = cannot delegate) */
  maxDelegationDepth: z2.number().int().min(0).max(3).default(0),
  /** Workspaces this agent can read from */
  canReadWorkspaces: z2.array(z2.string()).default([]),
  /** Whether agent can write to shared workspace */
  canWriteToShared: z2.boolean().default(false),
  /** Agents this agent can delegate to */
  canDelegateTo: z2.array(z2.string()).default([]),
  /** Priority level for task routing (1 = highest) */
  priority: z2.number().int().min(1).max(10).default(5)
});
var AgentProfileSchema = z2.object({
  /** Unique identifier for the agent (lowercase, alphanumeric with hyphens) */
  name: AgentId,
  /** Human-friendly display name */
  displayName: z2.string().min(1).max(50),
  /** Agent's role description */
  role: z2.string().min(1).max(100),
  /** Team affiliation */
  team: z2.string().default("default"),
  /** Detailed description of agent capabilities */
  description: z2.string().max(500).optional(),
  /** List of ability identifiers */
  abilities: z2.array(z2.string()).default([]),
  /** Smart ability selection configuration */
  abilitySelection: AbilitySelectionSchema.optional(),
  /** Agent personality configuration */
  personality: PersonalitySchema.optional(),
  /** Orchestration settings */
  orchestration: OrchestrationSchema.default({}),
  /** System prompt that defines agent behavior */
  systemPrompt: z2.string().min(10).max(5e4),
  /** Whether agent is enabled */
  enabled: z2.boolean().default(true),
  /** Agent version for tracking changes */
  version: z2.string().default("1.0.0"),
  /** Custom metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var ExecutionContextSchema = z2.object({
  /** The task to execute */
  task: z2.string().min(1),
  /** Session ID if part of a multi-agent session */
  sessionId: z2.string().uuid().optional(),
  /** Parent agent ID if delegated */
  parentAgentId: z2.string().optional(),
  /** Delegation chain for tracking depth */
  delegationChain: z2.array(z2.string()).default([]),
  /** Relevant memory entries */
  memoryContext: z2.array(z2.unknown()).default([]),
  /** Additional context data */
  context: z2.record(z2.string(), z2.unknown()).default({}),
  /** Timeout in milliseconds */
  timeout: z2.number().int().positive().default(3e5),
  /** Whether to stream output */
  stream: z2.boolean().default(false)
});
var AgentResponseSchema = z2.object({
  /** Whether execution was successful */
  success: z2.boolean(),
  /** Agent output/response */
  output: z2.string(),
  /** Agent ID that produced this response */
  agentId: z2.string(),
  /** Execution duration in milliseconds */
  duration: z2.number().int().nonnegative(),
  /** Provider used for execution */
  provider: z2.string().optional(),
  /** Token usage if available */
  tokens: TokenUsage.optional(),
  /** Delegation requests made by agent */
  delegations: z2.array(z2.object({
    toAgent: z2.string(),
    task: z2.string(),
    status: z2.enum(["pending", "completed", "failed"])
  })).default([]),
  /** Error information if failed */
  error: z2.object({
    code: z2.string(),
    message: z2.string(),
    details: z2.unknown().optional()
  }).optional(),
  /** Metadata about execution */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var AgentRegistrationSchema = z2.object({
  /** Agent profile */
  profile: AgentProfileSchema,
  /** Registration timestamp */
  registeredAt: z2.date(),
  /** Last updated timestamp */
  updatedAt: z2.date(),
  /** Source file path */
  sourcePath: z2.string().optional(),
  /** Health score (0-1) based on recent executions */
  healthScore: NormalizedScore.default(1),
  /** Total executions */
  executionCount: z2.number().int().nonnegative().default(0),
  /** Successful executions */
  successCount: z2.number().int().nonnegative().default(0)
});
function validateAgentProfile(data) {
  return AgentProfileSchema.parse(data);
}
function safeValidateAgentProfile(data) {
  return AgentProfileSchema.safeParse(data);
}
var PartialAgentProfileSchema = AgentProfileSchema.partial().extend({
  name: AgentId
  // Name is required for identification
});
export {
  AbilitySelectionSchema,
  AgentProfileSchema,
  AgentRegistrationSchema,
  AgentResponseSchema,
  CommunicationStyle,
  DecisionMaking,
  ExecutionContextSchema,
  OrchestrationSchema,
  PartialAgentProfileSchema,
  PersonalitySchema,
  safeValidateAgentProfile,
  validateAgentProfile
};
//# sourceMappingURL=agent.js.map