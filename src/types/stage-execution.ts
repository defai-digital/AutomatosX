/**
 * Stage-Based Execution Types (v5.3.0)
 *
 * Type definitions for interactive stage-based workflow execution with
 * checkpoints, streaming, and user interaction support.
 */

import type { AgentProfile, Stage } from './agent.js';
import type { MemoryEntry } from './memory.js';
import type { Provider } from './provider.js';
import type { OrchestrationMetadata } from './orchestration.js';
import type { Session } from './orchestration.js';

/**
 * Execution Mode Configuration
 *
 * Controls how stage execution behaves:
 * - interactive: Prompt user between stages
 * - streaming: Show real-time progress
 * - resumable: Save checkpoints for resume
 * - autoConfirm: Skip user prompts (CI mode)
 */
export interface ExecutionMode {
  /** Prompt user between stages for confirmation */
  interactive: boolean;
  /** Show real-time progress updates */
  streaming: boolean;
  /** Save checkpoints for resume capability */
  resumable: boolean;
  /** Auto-continue without user prompts */
  autoConfirm: boolean;
}

/**
 * Stage Status Enumeration
 *
 * Tracks current state of a stage in the execution lifecycle.
 */
export enum StageStatus {
  /** Stage is queued for execution */
  QUEUED = 'queued',
  /** Stage is currently executing */
  RUNNING = 'running',
  /** Stage completed, waiting for user confirmation */
  CHECKPOINT = 'checkpoint',
  /** Stage completed successfully */
  COMPLETED = 'completed',
  /** Stage execution failed */
  ERROR = 'error',
  /** Stage execution timed out */
  TIMEOUT = 'timeout',
  /** Stage was skipped by user */
  SKIPPED = 'skipped',
}

/**
 * Enhanced Stage Definition
 *
 * Extends base Stage interface with v5.3 checkpoint and streaming features.
 */
export interface EnhancedStage extends Stage {
  /** Stage index in workflow (0-based) */
  index: number;

  // v5.3: Checkpoint features
  /** Pause for user confirmation after this stage */
  checkpoint: boolean;
  /** Human-readable time estimate (e.g., "5-7 min") */
  estimatedTime?: string;
  /** Stage-specific timeout in milliseconds */
  timeout?: number;

  // v5.3: Retry configuration
  /** Maximum retry attempts (default: 1) */
  maxRetries?: number;
  /** Delay before retry in milliseconds */
  retryDelay?: number;

  // v5.3: Validation
  /** Optional output validation function */
  validateOutput?: (output: string) => boolean | Promise<boolean>;

  // Ability selection strategy (from abilitySelection phase)
  /** Which abilities to load for this stage */
  abilitySelection?: 'required' | 'optional' | 'all';
}

/**
 * Stage Execution Result
 *
 * Result of executing a single stage.
 */
export interface StageResult {
  /** Stage name identifier */
  stageName: string;
  /** Stage index (0-based) */
  stageIndex: number;
  /** Current stage status */
  status: StageStatus;
  /** Stage output/result */
  output: string;
  /** Paths to generated artifacts */
  artifacts: string[];
  /** Execution duration in milliseconds */
  duration: number;
  /** Number of tokens used */
  tokensUsed: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Error information (if status === ERROR) */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  /** Number of retry attempts made */
  retries?: number;
}

/**
 * Stage Execution Context
 *
 * Complete context passed through stage execution.
 */
export interface StageContext {
  // Run metadata
  /** Unique run identifier */
  runId: string;
  /** Agent profile being executed */
  agent: AgentProfile;
  /** Original task description */
  task: string;

  // Stage tracking
  /** Current stage index (0-based) */
  currentStageIndex: number;
  /** Total number of stages */
  totalStages: number;

  // Accumulated context from previous stages
  /** Outputs from all previous stages */
  previousOutputs: string[];
  /** Shared data between stages */
  accumulatedData: Record<string, unknown>;

  // Execution mode
  /** Execution mode configuration */
  mode: ExecutionMode;

  // Standard execution context (integration with existing system)
  /** Memory entries for context */
  memory: MemoryEntry[];
  /** Project root directory */
  projectDir: string;
  /** Current working directory */
  workingDir: string;
  /** Agent workspace directory */
  agentWorkspace: string;
  /** Provider to use for execution */
  provider: Provider;
  /** Loaded abilities content */
  abilities: string;
  /** Orchestration metadata (multi-agent delegation) */
  orchestration?: OrchestrationMetadata;
  /** Multi-agent session (if part of session) */
  session?: Session;

  // Options
  /** Execution options */
  options: StageExecutionOptions;

  // Control
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Stage Execution Options
 *
 * Options for controlling stage execution behavior.
 */
export interface StageExecutionOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Show execution plan before starting */
  showPlan?: boolean;
  /** Suppress non-essential output */
  quiet?: boolean;
}

/**
 * Complete Stage Execution Result
 *
 * Final result returned from StageExecutionController.execute()
 */
export interface StageExecutionResult {
  /** Unique run identifier */
  runId: string;
  /** Agent name */
  agent: string;
  /** Original task */
  task: string;
  /** Overall success status */
  success: boolean;
  /** Results from all stages */
  stages: StageResult[];
  /** Total execution duration (ms) */
  totalDuration: number;
  /** Total tokens consumed */
  totalTokens: number;
  /** Index of failed stage (if any) */
  failedStageIndex?: number;
  /** Path to checkpoint data (if saved) */
  checkpointPath?: string;
}

/**
 * Checkpoint Data
 *
 * Persisted checkpoint data for resume capability.
 */
export interface CheckpointData {
  /** Schema version for migration support */
  schemaVersion: string;
  /** Checksum for integrity validation */
  checksum: string;

  // Run identification
  /** Unique run identifier */
  runId: string;
  /** Agent name */
  agent: string;
  /** Original task */
  task: string;

  // Execution mode
  /** Execution mode used */
  mode: ExecutionMode;

  // Stage state
  /** All stages with their current state */
  stages: StageStates[];
  /** Index of last completed stage */
  lastCompletedStageIndex: number;

  // Accumulated context
  /** Outputs from completed stages */
  previousOutputs: string[];
  /** Shared data between stages */
  sharedData: Record<string, unknown>;

  // Timestamps
  /** Checkpoint creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Stage State
 *
 * Enhanced stage with execution state tracking.
 */
export interface StageStates extends EnhancedStage {
  /** Current stage status */
  status: StageStatus;
  /** Stage result (if completed) */
  result?: StageResult;
  /** Number of retry attempts */
  retries: number;
}

/**
 * Checkpoint Action
 *
 * User decision at checkpoint (interactive mode).
 */
export type CheckpointAction =
  | { action: 'continue' }
  | { action: 'modify'; modifications: string }
  | { action: 'skip' }
  | { action: 'abort' }
  | { action: 'retry' };

/**
 * Run Metadata
 *
 * Metadata stored for each stage execution run.
 */
export interface RunMetadata {
  /** Unique run identifier */
  runId: string;
  /** Agent name */
  agent: string;
  /** Agent display name */
  agentDisplayName?: string;
  /** Original task */
  task: string;
  /** Execution mode */
  mode: ExecutionMode;
  /** Total stages count */
  totalStages: number;
  /** Completed stages count */
  completedStages: number;
  /** Current status */
  status: 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  /** Run start timestamp */
  startedAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Run completion timestamp */
  completedAt?: string;
  /** Total duration (ms) */
  duration?: number;
  /** Resume eligible flag */
  resumable: boolean;
}

/**
 * Stage Execution Configuration
 *
 * Configuration for StageExecutionController.
 */
export interface StageExecutionConfig {
  // Checkpoint configuration
  /** Path to store checkpoints */
  checkpointPath: string;
  /** Auto-save checkpoints after each stage */
  autoSaveCheckpoint: boolean;
  /** Cleanup checkpoints after N days */
  cleanupAfterDays: number;

  // Timeout configuration
  /** Default timeout per stage (ms) */
  defaultStageTimeout: number;
  /** Timeout for user decisions (ms) */
  userDecisionTimeout: number;

  // Retry configuration
  /** Default max retries per stage */
  defaultMaxRetries: number;
  /** Default retry delay (ms) */
  defaultRetryDelay: number;

  // Progress configuration
  /** Progress update interval (ms) */
  progressUpdateInterval: number;
  /** Enable synthetic progress for non-streaming providers */
  syntheticProgress: boolean;

  // Prompt configuration
  /** Default prompt timeout (ms) */
  promptTimeout: number;
  /** Auto-confirm behavior */
  autoConfirm: boolean;
}

/**
 * Stage Hooks
 *
 * Hook callbacks for stage lifecycle events.
 */
export interface StageHooks {
  /**
   * Called before stage execution starts.
   * Can modify stage configuration or context.
   * Return false to skip stage.
   */
  beforeStage?: (
    stage: EnhancedStage,
    context: StageContext
  ) => Promise<boolean | void>;

  /**
   * Called after stage execution completes.
   * Can process results or trigger side effects.
   */
  afterStage?: (
    stage: EnhancedStage,
    result: StageResult,
    context: StageContext
  ) => Promise<void>;

  /**
   * Called when checkpoint is saved.
   * Can add custom checkpoint data.
   */
  onCheckpoint?: (
    checkpoint: CheckpointData,
    context: StageContext
  ) => Promise<void>;

  /**
   * Called when stage execution fails.
   * Can implement custom error handling.
   * Return true to continue, false to abort.
   */
  onError?: (
    stage: EnhancedStage,
    error: Error,
    context: StageContext
  ) => Promise<boolean>;

  /**
   * Called when user confirms to continue.
   * Can modify next stage before execution.
   */
  onContinue?: (
    nextStage: EnhancedStage,
    context: StageContext
  ) => Promise<void>;

  /**
   * Called when user skips a stage.
   */
  onSkip?: (
    stage: EnhancedStage,
    context: StageContext
  ) => Promise<void>;
}

/**
 * Prompt Configuration
 */
export interface PromptConfig {
  /** Default timeout for prompts (ms) */
  timeout: number;
  /** Default locale for prompts */
  locale: 'en' | 'zh';
}

/**
 * Prompt Response
 *
 * Response from user prompt.
 */
export interface PromptResponse<T> {
  /** User's response value */
  value: T;
  /** Whether response timed out */
  timedOut: boolean;
}
