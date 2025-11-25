// src/session.ts
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

// src/session.ts
var SessionTaskSchema = z2.object({
  /** Unique task identifier */
  id: z2.string().uuid(),
  /** Task description */
  description: z2.string().min(1),
  /** Agent assigned to this task */
  agentId: z2.string(),
  /** Current status */
  status: TaskStatus,
  /** Task result/output */
  result: z2.string().optional(),
  /** Error if failed */
  error: z2.string().optional(),
  /** Start timestamp */
  startedAt: z2.date().optional(),
  /** Completion timestamp */
  completedAt: z2.date().optional(),
  /** Duration in milliseconds */
  duration: DurationMs.optional(),
  /** Parent task ID (for subtasks) */
  parentTaskId: z2.string().uuid().optional(),
  /** Delegated from agent */
  delegatedFrom: z2.string().optional(),
  /** Task metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var SessionState = z2.enum(["active", "paused", "completed", "failed", "cancelled"]);
var SessionSchema = z2.object({
  /** Unique session identifier */
  id: SessionId,
  /** Session name/title */
  name: z2.string().min(1).max(200),
  /** Session description */
  description: z2.string().max(1e3).optional(),
  /** Current state */
  state: SessionState.default("active"),
  /** Agents participating in this session */
  agents: z2.array(z2.string()).min(1),
  /** Tasks in this session */
  tasks: z2.array(SessionTaskSchema).default([]),
  /** Creation timestamp */
  createdAt: z2.date(),
  /** Last update timestamp */
  updatedAt: z2.date(),
  /** Completion timestamp */
  completedAt: z2.date().optional(),
  /** Total duration in milliseconds */
  duration: DurationMs.optional(),
  /** Session goal/objective */
  goal: z2.string().optional(),
  /** Session tags */
  tags: z2.array(z2.string()).default([]),
  /** Session metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var CheckpointSchema = z2.object({
  /** Unique checkpoint identifier */
  id: CheckpointId,
  /** Session ID this checkpoint belongs to */
  sessionId: SessionId,
  /** Checkpoint name */
  name: z2.string().default("auto"),
  /** Checkpoint creation timestamp */
  createdAt: z2.date(),
  /** Session state at checkpoint */
  sessionState: SessionSchema,
  /** Current task index */
  currentTaskIndex: z2.number().int().nonnegative(),
  /** Completed task IDs */
  completedTaskIds: z2.array(z2.string().uuid()).default([]),
  /** Execution context snapshot */
  contextSnapshot: z2.record(z2.string(), z2.unknown()).optional(),
  /** Memory entries created since session start */
  memoryEntryIds: z2.array(z2.number().int().positive()).default([]),
  /** Is this an auto-save checkpoint */
  isAutoSave: z2.boolean().default(true),
  /** Checkpoint metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var CreateSessionInputSchema = z2.object({
  /** Session name */
  name: z2.string().min(1).max(200),
  /** Session description */
  description: z2.string().max(1e3).optional(),
  /** Initial agents */
  agents: z2.array(z2.string()).min(1),
  /** Session goal */
  goal: z2.string().optional(),
  /** Initial tasks */
  tasks: z2.array(z2.object({
    description: z2.string().min(1),
    agentId: z2.string()
  })).optional(),
  /** Session tags */
  tags: z2.array(z2.string()).optional(),
  /** Session metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var AddTaskInputSchema = z2.object({
  /** Session ID */
  sessionId: SessionId,
  /** Task description */
  description: z2.string().min(1),
  /** Agent to assign */
  agentId: z2.string(),
  /** Parent task ID */
  parentTaskId: z2.string().uuid().optional(),
  /** Task metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var UpdateTaskInputSchema = z2.object({
  /** Session ID */
  sessionId: SessionId,
  /** Task ID */
  taskId: z2.string().uuid(),
  /** New status */
  status: TaskStatus,
  /** Result if completed */
  result: z2.string().optional(),
  /** Error if failed */
  error: z2.string().optional()
});
var SessionSummarySchema = z2.object({
  /** Session ID */
  id: SessionId,
  /** Session name */
  name: z2.string(),
  /** Current state */
  state: SessionState,
  /** Number of agents */
  agentCount: z2.number().int().nonnegative(),
  /** Total tasks */
  totalTasks: z2.number().int().nonnegative(),
  /** Completed tasks */
  completedTasks: z2.number().int().nonnegative(),
  /** Failed tasks */
  failedTasks: z2.number().int().nonnegative(),
  /** Creation timestamp */
  createdAt: z2.date(),
  /** Last update timestamp */
  updatedAt: z2.date(),
  /** Duration so far */
  duration: DurationMs.optional()
});
function createSessionSummary(session) {
  return {
    id: session.id,
    name: session.name,
    state: session.state,
    agentCount: session.agents.length,
    totalTasks: session.tasks.length,
    completedTasks: session.tasks.filter((t) => t.status === "completed").length,
    failedTasks: session.tasks.filter((t) => t.status === "failed").length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    duration: session.duration
  };
}
var DelegationRequestSchema = z2.object({
  /** Source agent */
  fromAgent: z2.string(),
  /** Target agent */
  toAgent: z2.string(),
  /** Task to delegate */
  task: z2.string().min(1),
  /** Delegation context */
  context: z2.object({
    /** Shared data between agents */
    sharedData: z2.record(z2.string(), z2.unknown()).optional(),
    /** Requirements for the delegated task */
    requirements: z2.array(z2.string()).optional(),
    /** Expected outputs */
    expectedOutputs: z2.array(z2.string()).optional(),
    /** Session ID */
    sessionId: SessionId.optional(),
    /** Delegation chain for tracking depth */
    delegationChain: z2.array(z2.string()).default([])
  }).default({}),
  /** Delegation options */
  options: z2.object({
    /** Timeout for delegated task */
    timeout: DurationMs.optional(),
    /** Priority level */
    priority: z2.enum(["low", "normal", "high"]).default("normal"),
    /** Whether to wait for result */
    waitForResult: z2.boolean().default(true)
  }).default({})
});
var DelegationResultSchema = z2.object({
  /** Whether delegation was successful */
  success: z2.boolean(),
  /** Delegation request */
  request: DelegationRequestSchema,
  /** Result from delegated agent */
  result: z2.string().optional(),
  /** Error if failed */
  error: z2.string().optional(),
  /** Execution duration */
  duration: DurationMs,
  /** Agent that completed the task */
  completedBy: z2.string()
});
function validateSession(data) {
  return SessionSchema.parse(data);
}
function validateCheckpoint(data) {
  return CheckpointSchema.parse(data);
}
function validateCreateSessionInput(data) {
  return CreateSessionInputSchema.parse(data);
}
export {
  AddTaskInputSchema,
  CheckpointSchema,
  CreateSessionInputSchema,
  DelegationRequestSchema,
  DelegationResultSchema,
  SessionSchema,
  SessionState,
  SessionSummarySchema,
  SessionTaskSchema,
  UpdateTaskInputSchema,
  createSessionSummary,
  validateCheckpoint,
  validateCreateSessionInput,
  validateSession
};
//# sourceMappingURL=session.js.map