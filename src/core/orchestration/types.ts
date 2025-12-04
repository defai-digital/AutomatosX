/**
 * Orchestration Types
 *
 * Core type definitions for the embedded instructions system.
 * Provides types for instruction injection, workflow modes, and context management.
 *
 * @since v11.3.0
 */

import { z } from 'zod';

// ============================================================================
// Instruction Types
// ============================================================================

/**
 * Types of embedded instructions
 */
export type InstructionType = 'task' | 'memory' | 'session' | 'delegation' | 'mode';

/**
 * Instruction priority levels
 * - critical: Always included, never truncated (e.g., security warnings)
 * - high: Included unless at token limit (e.g., current task reminders)
 * - normal: Standard instructions (e.g., memory context)
 * - low: Only included if budget allows (e.g., suggestions)
 */
export type InstructionPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * An embedded instruction to be injected into tool results
 */
export interface EmbeddedInstruction {
  /** Type of instruction */
  type: InstructionType;
  /** Priority level */
  priority: InstructionPriority;
  /** The instruction content */
  content: string;
  /** Source identifier */
  source: 'automatosx';
  /** Number of turns after which this instruction expires (optional) */
  expiresAfter?: number;
  /** Timestamp when the instruction was created */
  createdAt: number;
  /** Unique identifier for the instruction */
  id?: string;
}

/**
 * Zod schema for EmbeddedInstruction validation
 */
export const EmbeddedInstructionSchema = z.object({
  type: z.enum(['task', 'memory', 'session', 'delegation', 'mode']),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  content: z.string().min(1).max(5000),
  source: z.literal('automatosx'),
  expiresAfter: z.number().int().positive().optional(),
  createdAt: z.number(),
  id: z.string().optional()
});

// ============================================================================
// Todo Types
// ============================================================================

/**
 * Status of a todo item
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

/**
 * A single todo item
 */
export interface TodoItem {
  /** Unique identifier */
  id: string;
  /** Task description */
  content: string;
  /** Current status */
  status: TodoStatus;
  /** Active form of the task description (for display during execution) */
  activeForm: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for TodoItem validation
 */
export const TodoItemSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(1000),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string().min(1).max(1000),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Todo list state
 */
export interface TodoListState {
  /** All todo items */
  items: TodoItem[];
  /** Hash of the current state (for change detection) */
  stateHash: string;
  /** Timestamp of last update */
  lastUpdated: number;
}

// ============================================================================
// Workflow Mode Types
// ============================================================================

/**
 * Available workflow modes
 */
export type WorkflowMode = 'default' | 'plan' | 'iterate' | 'review';

/**
 * Configuration for a workflow mode
 */
export interface WorkflowModeConfig {
  /** Mode name */
  name: WorkflowMode;
  /** Human-readable description */
  description: string;
  /** Tools that are allowed in this mode (whitelist) */
  allowedTools?: string[];
  /** Tools that are blocked in this mode (blacklist) */
  blockedTools?: string[];
  /** System instructions for this mode */
  systemInstructions: string;
  /** Whether this mode can be nested */
  allowNesting: boolean;
}

/**
 * Zod schema for WorkflowModeConfig validation
 */
export const WorkflowModeConfigSchema = z.object({
  name: z.enum(['default', 'plan', 'iterate', 'review']),
  description: z.string(),
  allowedTools: z.array(z.string()).optional(),
  blockedTools: z.array(z.string()).optional(),
  systemInstructions: z.string(),
  allowNesting: z.boolean()
});

// ============================================================================
// Orchestration Context
// ============================================================================

/**
 * Context information for orchestration
 */
export interface OrchestrationContext {
  /** Current todo items */
  todos: TodoItem[];
  /** Currently active task description */
  currentTask?: string;
  /** Name of the current agent */
  agentName?: string;
  /** Number of conversation turns */
  turnCount: number;
  /** Current workflow mode */
  workflowMode: WorkflowMode;
  /** Session identifier (for multi-agent sessions) */
  sessionId?: string;
  /** Parent agent (if delegated) */
  parentAgent?: string;
  /** Relevant memory entries */
  memories?: MemoryEntry[];
}

/**
 * A memory entry for context injection
 */
export interface MemoryEntry {
  /** Memory content */
  content: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Agent that created the memory */
  agent?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Zod schema for OrchestrationContext validation
 */
export const OrchestrationContextSchema = z.object({
  todos: z.array(TodoItemSchema),
  currentTask: z.string().optional(),
  agentName: z.string().optional(),
  turnCount: z.number().int().nonnegative(),
  workflowMode: z.enum(['default', 'plan', 'iterate', 'review']),
  sessionId: z.string().optional(),
  parentAgent: z.string().optional(),
  memories: z.array(z.object({
    content: z.string(),
    relevance: z.number().min(0).max(1),
    agent: z.string().optional(),
    timestamp: z.number()
  })).optional()
});

// ============================================================================
// Token Budget Types
// ============================================================================

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  /** Maximum total tokens for all instructions */
  maxTotal: number;
  /** Budget per instruction type */
  perType: Record<InstructionType, number>;
  /** Reserve budget for critical instructions */
  criticalReserve: number;
}

/**
 * Default token budget configuration
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  maxTotal: 2000,
  perType: {
    task: 500,
    memory: 600,
    session: 300,
    delegation: 200,
    mode: 400
  },
  criticalReserve: 300
};

/**
 * Zod schema for TokenBudgetConfig validation
 */
export const TokenBudgetConfigSchema = z.object({
  maxTotal: z.number().int().positive().max(10000),
  perType: z.record(
    z.enum(['task', 'memory', 'session', 'delegation', 'mode']),
    z.number().int().nonnegative()
  ),
  criticalReserve: z.number().int().nonnegative()
});

// ============================================================================
// Instruction Provider Interface
// ============================================================================

/**
 * Interface for instruction providers
 */
export interface InstructionProvider {
  /** Provider name */
  readonly name: string;
  /** Get instructions based on context */
  getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]>;
  /** Check if provider should generate instructions */
  shouldGenerate(context: OrchestrationContext): boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  /** Whether embedded instructions are enabled */
  enabled: boolean;
  /** Token budget configuration */
  tokenBudget: TokenBudgetConfig;
  /** Todo integration settings */
  todoIntegration: {
    enabled: boolean;
    /** Frequency of todo reminders (every N turns) */
    reminderFrequency: number;
    /** Whether to show full or compact format */
    compactMode: boolean;
  };
  /** Memory integration settings */
  memoryIntegration: {
    enabled: boolean;
    /** Maximum number of memory entries to include */
    maxEntries: number;
    /** Minimum relevance score to include */
    minRelevance: number;
  };
  /** Session integration settings */
  sessionIntegration: {
    enabled: boolean;
    /** Whether to show collaboration status */
    showCollaboration: boolean;
  };
  /** Agent template settings */
  agentTemplates: {
    enabled: boolean;
    /** Frequency of domain reminders (every N turns) */
    reminderFrequency: number;
  };
}

/**
 * Default orchestration configuration
 */
export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  enabled: true,
  tokenBudget: DEFAULT_TOKEN_BUDGET,
  todoIntegration: {
    enabled: true,
    reminderFrequency: 3,
    compactMode: false
  },
  memoryIntegration: {
    enabled: true,
    maxEntries: 5,
    minRelevance: 0.5
  },
  sessionIntegration: {
    enabled: true,
    showCollaboration: true
  },
  agentTemplates: {
    enabled: true,
    reminderFrequency: 5
  }
};

/**
 * Zod schema for OrchestrationConfig validation
 */
export const OrchestrationConfigSchema = z.object({
  enabled: z.boolean(),
  tokenBudget: TokenBudgetConfigSchema,
  todoIntegration: z.object({
    enabled: z.boolean(),
    reminderFrequency: z.number().int().positive(),
    compactMode: z.boolean()
  }),
  memoryIntegration: z.object({
    enabled: z.boolean(),
    maxEntries: z.number().int().nonnegative(),
    minRelevance: z.number().min(0).max(1)
  }),
  sessionIntegration: z.object({
    enabled: z.boolean(),
    showCollaboration: z.boolean()
  }),
  agentTemplates: z.object({
    enabled: z.boolean(),
    reminderFrequency: z.number().int().positive()
  })
});
