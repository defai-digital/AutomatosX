/**
 * Autonomous Loop Contracts v1
 *
 * Schemas for governed write-test-fix cycles with guard gate integration.
 *
 * This enables autonomous development workflows where agents can iterate
 * through planning, writing, testing, and fixing code while respecting
 * governance policies and breakpoints.
 */

import { z } from 'zod';
import {
  TIMEOUT_WORKFLOW_MAX,
  TIMEOUT_WORKFLOW_STEP,
} from '../../constants.js';

// ============================================================================
// Phase & Status Enums
// ============================================================================

/**
 * Phases of the autonomous loop
 *
 * - plan: Analyze requirements and plan implementation
 * - write: Generate or modify code
 * - test: Execute tests to verify changes
 * - fix: Attempt to fix failing tests
 * - verify: Final verification before completion
 * - complete: Loop finished successfully
 */
export const AutonomousLoopPhaseSchema = z.enum([
  'plan',
  'write',
  'test',
  'fix',
  'verify',
  'complete',
]);
export type AutonomousLoopPhase = z.infer<typeof AutonomousLoopPhaseSchema>;

/**
 * Status of the autonomous loop
 *
 * - running: Loop is actively executing
 * - paused: Loop is paused at a breakpoint
 * - completed: Loop finished successfully
 * - failed: Loop failed after max retries
 * - blocked: Loop blocked by guard gate
 * - cancelled: Loop was cancelled by user
 */
export const AutonomousLoopStatusSchema = z.enum([
  'running',
  'paused',
  'completed',
  'failed',
  'blocked',
  'cancelled',
]);
export type AutonomousLoopStatus = z.infer<typeof AutonomousLoopStatusSchema>;

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Configuration for autonomous loop execution
 *
 * Invariants:
 * - INV-ALO-001: Guard gates run after EVERY write phase
 * - INV-ALO-002: Test phase required before verify (when requireTestPass=true)
 * - INV-ALO-003: Fix attempts bounded by maxFixAttempts
 * - INV-ALO-004: Breakpoints pause for user review
 */
export const AutonomousLoopConfigSchema = z.object({
  /**
   * Maximum iterations through the loop
   */
  maxIterations: z.number().int().min(1).max(50).default(10),

  /**
   * Maximum fix attempts per iteration
   * INV-ALO-003: Bounded fix attempts
   */
  maxFixAttempts: z.number().int().min(1).max(10).default(3),

  /**
   * Guard policy to enforce
   * INV-ALO-001: Guards run after write
   */
  guardPolicy: z.string().max(100).optional(),

  /**
   * Whether tests must pass before verify phase
   * INV-ALO-002: Test requirement
   */
  requireTestPass: z.boolean().default(true),

  /**
   * Phases that pause for user review
   * INV-ALO-004: Breakpoint behavior
   */
  breakpoints: z.array(AutonomousLoopPhaseSchema).default(['write']),

  /**
   * Test command to run
   */
  testCommand: z.string().max(500).default('pnpm test'),

  /**
   * Timeout for test execution in milliseconds
   */
  testTimeout: z.number().int().min(5000).max(TIMEOUT_WORKFLOW_MAX).default(300000),

  /**
   * Timeout per phase in milliseconds
   */
  phaseTimeout: z.number().int().min(5000).max(TIMEOUT_WORKFLOW_MAX).default(TIMEOUT_WORKFLOW_STEP),

  /**
   * Whether to auto-commit successful changes
   */
  autoCommit: z.boolean().default(false),

  /**
   * Commit message template (uses {{phase}}, {{iteration}})
   */
  commitMessageTemplate: z.string().max(200).default('chore: autonomous loop {{phase}} (iteration {{iteration}})'),

  /**
   * Working directory for execution
   */
  workingDirectory: z.string().max(500).optional(),

  /**
   * Agent ID to use for code generation
   */
  agentId: z.string().max(50).optional(),

  /**
   * Provider to use for LLM calls
   */
  provider: z.string().max(50).optional(),
});

export type AutonomousLoopConfig = z.infer<typeof AutonomousLoopConfigSchema>;

// ============================================================================
// Guard Result Schemas
// ============================================================================

/**
 * Result of a guard gate check
 */
export const GuardGateResultSchema = z.object({
  /**
   * Gate identifier
   */
  gateId: z.string(),

  /**
   * Whether the gate passed
   */
  passed: z.boolean(),

  /**
   * Severity if failed
   */
  severity: z.enum(['error', 'warning', 'info']).optional(),

  /**
   * Message explaining result
   */
  message: z.string().optional(),

  /**
   * Detailed violations if any
   */
  violations: z.array(z.object({
    path: z.string().optional(),
    rule: z.string().optional(),
    message: z.string(),
  })).optional(),
});

export type GuardGateResult = z.infer<typeof GuardGateResultSchema>;

/**
 * Result of guard policy check
 */
export const GuardCheckResultSchema = z.object({
  /**
   * Policy that was checked
   */
  policyId: z.string(),

  /**
   * Whether all gates passed
   */
  passed: z.boolean(),

  /**
   * Whether execution is blocked
   */
  blocked: z.boolean(),

  /**
   * Individual gate results
   */
  gateResults: z.array(GuardGateResultSchema),

  /**
   * Summary message
   */
  summary: z.string().optional(),

  /**
   * Check timestamp
   */
  checkedAt: z.string().datetime(),
});

export type GuardCheckResult = z.infer<typeof GuardCheckResultSchema>;

// ============================================================================
// State Schemas
// ============================================================================

/**
 * Test execution result
 */
export const TestResultSchema = z.object({
  /**
   * Whether all tests passed
   */
  passed: z.boolean(),

  /**
   * Total test count
   */
  totalTests: z.number().int().min(0),

  /**
   * Passed test count
   */
  passedTests: z.number().int().min(0),

  /**
   * Failed test count
   */
  failedTests: z.number().int().min(0),

  /**
   * Skipped test count
   */
  skippedTests: z.number().int().min(0).default(0),

  /**
   * Error output if failed
   */
  errorOutput: z.string().max(50000).optional(),

  /**
   * Test duration in milliseconds
   */
  durationMs: z.number().int().min(0),

  /**
   * Failed test names
   */
  failedTestNames: z.array(z.string()).optional(),
});

export type TestResult = z.infer<typeof TestResultSchema>;

/**
 * Iteration record in the loop
 */
export const LoopIterationSchema = z.object({
  /**
   * Iteration number (1-indexed)
   */
  iteration: z.number().int().min(1),

  /**
   * Phase that completed
   */
  phase: AutonomousLoopPhaseSchema,

  /**
   * Whether phase succeeded
   */
  success: z.boolean(),

  /**
   * Files changed in this iteration
   */
  changedFiles: z.array(z.string()).default([]),

  /**
   * Test result if test phase
   */
  testResult: TestResultSchema.optional(),

  /**
   * Guard result if write phase
   */
  guardResult: GuardCheckResultSchema.optional(),

  /**
   * Fix attempts made
   */
  fixAttempts: z.number().int().min(0).default(0),

  /**
   * Error message if failed
   */
  error: z.string().optional(),

  /**
   * Duration in milliseconds
   */
  durationMs: z.number().int().min(0),

  /**
   * Start timestamp
   */
  startedAt: z.string().datetime(),

  /**
   * End timestamp
   */
  completedAt: z.string().datetime().optional(),
});

export type LoopIteration = z.infer<typeof LoopIterationSchema>;

/**
 * State of an autonomous loop
 *
 * Invariants:
 * - INV-ALO-005: Changed files tracked for guard radius checks
 */
export const AutonomousLoopStateSchema = z.object({
  /**
   * Unique loop identifier
   */
  loopId: z.string().uuid(),

  /**
   * Current phase
   */
  phase: AutonomousLoopPhaseSchema,

  /**
   * Current iteration number
   */
  iteration: z.number().int().min(0),

  /**
   * Current status
   */
  status: AutonomousLoopStatusSchema,

  /**
   * Task description
   */
  task: z.string().max(5000),

  /**
   * Configuration used
   */
  config: AutonomousLoopConfigSchema,

  /**
   * All changed files across iterations
   * INV-ALO-005: Tracked for guard radius
   */
  changedFiles: z.array(z.string()).default([]),

  /**
   * Iteration history
   */
  iterations: z.array(LoopIterationSchema).default([]),

  /**
   * Latest guard check result
   */
  lastGuardResult: GuardCheckResultSchema.optional(),

  /**
   * Latest test result
   */
  lastTestResult: TestResultSchema.optional(),

  /**
   * Current fix attempts in iteration
   */
  currentFixAttempts: z.number().int().min(0).default(0),

  /**
   * Pause reason if paused
   */
  pauseReason: z.string().optional(),

  /**
   * Error if failed or blocked
   */
  error: z.string().optional(),

  /**
   * Session ID for tracking
   */
  sessionId: z.string().uuid().optional(),

  /**
   * Start timestamp
   */
  startedAt: z.string().datetime(),

  /**
   * Last update timestamp
   */
  updatedAt: z.string().datetime(),

  /**
   * Completion timestamp
   */
  completedAt: z.string().datetime().optional(),
});

export type AutonomousLoopState = z.infer<typeof AutonomousLoopStateSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Request to start an autonomous loop
 */
export const StartLoopRequestSchema = z.object({
  /**
   * Task description
   */
  task: z.string().min(1).max(5000),

  /**
   * Configuration overrides
   */
  config: AutonomousLoopConfigSchema.partial().optional(),

  /**
   * Session ID for tracking
   */
  sessionId: z.string().uuid().optional(),

  /**
   * Initial context/files to work with
   */
  context: z.record(z.string(), z.unknown()).optional(),
});

export type StartLoopRequest = z.infer<typeof StartLoopRequestSchema>;

/**
 * Response from starting a loop
 */
export const StartLoopResponseSchema = z.object({
  /**
   * Loop ID
   */
  loopId: z.string().uuid(),

  /**
   * Initial state
   */
  state: AutonomousLoopStateSchema,

  /**
   * Whether loop started successfully
   */
  started: z.boolean(),

  /**
   * Message
   */
  message: z.string().optional(),
});

export type StartLoopResponse = z.infer<typeof StartLoopResponseSchema>;

/**
 * Request to continue a paused loop
 */
export const ContinueLoopRequestSchema = z.object({
  /**
   * Loop ID to continue
   */
  loopId: z.string().uuid(),

  /**
   * Whether to skip to next phase
   */
  skipToPhase: AutonomousLoopPhaseSchema.optional(),

  /**
   * User feedback/instructions
   */
  feedback: z.string().max(2000).optional(),

  /**
   * Override config for remaining iterations
   */
  configOverrides: AutonomousLoopConfigSchema.partial().optional(),
});

export type ContinueLoopRequest = z.infer<typeof ContinueLoopRequestSchema>;

/**
 * Request to abort a loop
 */
export const AbortLoopRequestSchema = z.object({
  /**
   * Loop ID to abort
   */
  loopId: z.string().uuid(),

  /**
   * Reason for aborting
   */
  reason: z.string().max(500).optional(),

  /**
   * Whether to keep changes made
   */
  keepChanges: z.boolean().default(true),
});

export type AbortLoopRequest = z.infer<typeof AbortLoopRequestSchema>;

/**
 * Loop status response
 */
export const LoopStatusResponseSchema = z.object({
  /**
   * Current state
   */
  state: AutonomousLoopStateSchema,

  /**
   * Whether loop is active
   */
  isActive: z.boolean(),

  /**
   * Whether waiting for user input
   */
  awaitingInput: z.boolean(),

  /**
   * Progress percentage (0-100)
   */
  progress: z.number().min(0).max(100),

  /**
   * Estimated remaining iterations
   */
  estimatedRemaining: z.number().int().min(0).optional(),
});

export type LoopStatusResponse = z.infer<typeof LoopStatusResponseSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const AutonomousLoopErrorCodes = {
  /** Loop not found */
  LOOP_NOT_FOUND: 'ALO_LOOP_NOT_FOUND',
  /** Loop already running */
  LOOP_ALREADY_RUNNING: 'ALO_LOOP_ALREADY_RUNNING',
  /** Loop not paused */
  LOOP_NOT_PAUSED: 'ALO_LOOP_NOT_PAUSED',
  /** Max iterations exceeded */
  MAX_ITERATIONS_EXCEEDED: 'ALO_MAX_ITERATIONS_EXCEEDED',
  /** Max fix attempts exceeded */
  MAX_FIX_ATTEMPTS_EXCEEDED: 'ALO_MAX_FIX_ATTEMPTS_EXCEEDED',
  /** Guard gate blocked */
  GUARD_BLOCKED: 'ALO_GUARD_BLOCKED',
  /** Test execution failed */
  TEST_FAILED: 'ALO_TEST_FAILED',
  /** Phase timeout */
  PHASE_TIMEOUT: 'ALO_PHASE_TIMEOUT',
  /** Invalid phase transition */
  INVALID_TRANSITION: 'ALO_INVALID_TRANSITION',
  /** Cancelled by user */
  CANCELLED: 'ALO_CANCELLED',
  /** Agent execution failed */
  AGENT_FAILED: 'ALO_AGENT_FAILED',
} as const;

export type AutonomousLoopErrorCode =
  (typeof AutonomousLoopErrorCodes)[keyof typeof AutonomousLoopErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates autonomous loop configuration
 */
export function validateAutonomousLoopConfig(data: unknown): AutonomousLoopConfig {
  return AutonomousLoopConfigSchema.parse(data);
}

/**
 * Safely validates autonomous loop configuration
 */
export function safeValidateAutonomousLoopConfig(
  data: unknown
): { success: true; data: AutonomousLoopConfig } | { success: false; error: z.ZodError } {
  const result = AutonomousLoopConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/**
 * Validates autonomous loop state
 */
export function validateAutonomousLoopState(data: unknown): AutonomousLoopState {
  return AutonomousLoopStateSchema.parse(data);
}

/**
 * Validates start loop request
 */
export function validateStartLoopRequest(data: unknown): StartLoopRequest {
  return StartLoopRequestSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates default autonomous loop configuration
 */
export function createDefaultAutonomousLoopConfig(): AutonomousLoopConfig {
  return AutonomousLoopConfigSchema.parse({});
}

/**
 * Creates initial loop state
 */
export function createInitialLoopState(
  task: string,
  config?: Partial<AutonomousLoopConfig>
): AutonomousLoopState {
  const now = new Date().toISOString();
  return AutonomousLoopStateSchema.parse({
    loopId: crypto.randomUUID(),
    phase: 'plan',
    iteration: 0,
    status: 'running',
    task,
    config: { ...createDefaultAutonomousLoopConfig(), ...config },
    changedFiles: [],
    iterations: [],
    currentFixAttempts: 0,
    startedAt: now,
    updatedAt: now,
  });
}

/**
 * Creates a loop iteration record
 */
export function createLoopIteration(
  iteration: number,
  phase: AutonomousLoopPhase,
  success: boolean,
  options?: Partial<Omit<LoopIteration, 'iteration' | 'phase' | 'success'>>
): LoopIteration {
  const now = new Date().toISOString();
  return LoopIterationSchema.parse({
    iteration,
    phase,
    success,
    changedFiles: [],
    fixAttempts: 0,
    durationMs: 0,
    startedAt: now,
    ...options,
  });
}

// ============================================================================
// Phase Transition Helpers
// ============================================================================

/**
 * Valid phase transitions
 */
export const PHASE_TRANSITIONS: Record<AutonomousLoopPhase, AutonomousLoopPhase[]> = {
  plan: ['write'],
  write: ['test', 'verify'], // verify only if requireTestPass=false
  test: ['fix', 'verify'],
  fix: ['test', 'write'], // write if need to regenerate
  verify: ['complete', 'write'], // write if verification fails
  complete: [], // terminal
};

/**
 * Checks if a phase transition is valid
 */
export function isValidPhaseTransition(
  from: AutonomousLoopPhase,
  to: AutonomousLoopPhase
): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

/**
 * Gets valid next phases from current phase
 */
export function getValidNextPhases(phase: AutonomousLoopPhase): AutonomousLoopPhase[] {
  return PHASE_TRANSITIONS[phase];
}
