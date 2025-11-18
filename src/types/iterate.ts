/**
 * Iterate Mode Type Definitions
 *
 * Autonomous execution mode that auto-responds to AI confirmation prompts
 * while maintaining safety controls and allowing intervention for genuine questions.
 *
 * @module types/iterate
 * @since v6.4.0
 */

import type { ExecutionResponse } from './provider.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Strictness level for response classification
 *
 * - paranoid: Pause on any uncertainty, require user confirmation for most actions
 * - balanced: Auto-respond to clear confirmations, pause for questions (default)
 * - permissive: Auto-respond aggressively, only pause for explicit questions
 */
export type ClassifierStrictness = 'paranoid' | 'balanced' | 'permissive';

/**
 * Risk tolerance for dangerous operation detection
 */
export type RiskTolerance = 'paranoid' | 'balanced' | 'permissive';

/**
 * Risk level classification
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Telemetry level for iterate mode logging
 */
export type TelemetryLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * Classifier configuration
 */
export interface ClassifierConfig {
  /** Strictness level for classification */
  strictness: ClassifierStrictness;

  /** Path to pattern library YAML file */
  patternLibraryPath: string;

  /** Enable semantic scoring fallback (ML-based) */
  enableSemanticScoring: boolean;

  /** Confidence threshold for semantic scoring (0-1) */
  semanticScoringThreshold: number;

  /** Number of messages to include in context window */
  contextWindowMessages: number;
}

/**
 * Dangerous operation configuration
 */
export interface DangerousOperationsConfig {
  /** File deletion operations */
  fileDelete: RiskLevel;

  /** Git force operations (push --force, rebase, etc.) */
  gitForce: RiskLevel;

  /** Write operations outside workspace */
  writeOutsideWorkspace: RiskLevel;

  /** Secrets detected in code */
  secretsInCode: RiskLevel;

  /** Shell command execution */
  shellCommands: RiskLevel;

  /** Package installation (npm install, etc.) */
  packageInstall: RiskLevel;
}

/**
 * Safety controls configuration
 */
export interface SafetyConfig {
  /** Enable dangerous operation guard */
  enableDangerousOperationGuard: boolean;

  /** Risk tolerance level */
  riskTolerance: RiskTolerance;

  /** Dangerous operation risk levels */
  dangerousOperations: DangerousOperationsConfig;

  /** Enable time tracking and limits */
  enableTimeTracking: boolean;

  /** Enable iteration tracking and limits */
  enableIterationTracking: boolean;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Logging level */
  level: TelemetryLevel;

  /** Log all auto-responses */
  logAutoResponses: boolean;

  /** Log all classifications */
  logClassifications: boolean;

  /** Log safety checks */
  logSafetyChecks: boolean;

  /** Emit metrics for analytics */
  emitMetrics: boolean;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Warn at these time percentages (e.g., [75, 90, 95]) */
  warnAtTimePercent: number[];

  /** Pause iterate mode when genuine question detected */
  pauseOnGenuineQuestion: boolean;

  /** Pause iterate mode when high-risk operation detected */
  pauseOnHighRiskOperation: boolean;
}

/**
 * Default configuration for iterate mode
 */
export interface IterateDefaults {
  /** Maximum duration in minutes (default: 120) */
  maxDurationMinutes: number;

  /** Maximum iterations per stage (default: 50) */
  maxIterationsPerStage: number;

  /** Maximum iterations per run (default: 200) */
  maxIterationsPerRun: number;

  /** Maximum auto-responses per stage (default: 30) */
  maxAutoResponsesPerStage: number;

  /**
   * Maximum total tokens per run (default: 1,000,000)
   * More reliable than cost limits as token counts don't change
   * @since v8.6.0
   */
  maxTotalTokens?: number;

  /**
   * Maximum tokens per single iteration (default: 100,000)
   * Prevents any single API call from consuming entire budget
   * @since v8.6.0
   */
  maxTokensPerIteration?: number;

  /**
   * Warning thresholds for token usage as percentages (default: [75, 90])
   * Emits warnings when token usage reaches these thresholds
   * @since v8.6.0
   */
  warnAtTokenPercent?: number[];

  /** Auto-confirm checkpoints in stage execution (default: true) */
  autoConfirmCheckpoints: boolean;
}

/**
 * Complete iterate mode configuration
 */
export interface IterateConfig {
  /** Enable iterate mode globally */
  enabled: boolean;

  /** Default values */
  defaults: IterateDefaults;

  /** Classifier configuration */
  classifier: ClassifierConfig;

  /** Safety controls */
  safety: SafetyConfig;

  /** Telemetry configuration */
  telemetry: TelemetryConfig;

  /** Notification configuration */
  notifications: NotificationConfig;
}

// ============================================================================
// Classification Types
// ============================================================================

/**
 * Classification categories for AI responses
 */
export type ClassificationType =
  | 'confirmation_prompt'    // "Continue?", "Proceed?", "Would you like me to..."
  | 'status_update'          // "Completed step 3/5", "Running tests..."
  | 'genuine_question'       // "Which database: PostgreSQL or MySQL?"
  | 'blocking_request'       // "What should the API endpoint be?"
  | 'error_signal'           // "Tests failed", "Build error"
  | 'completion_signal'      // "Implementation complete", "All tests passing"
  | 'rate_limit_or_context'; // "Context limit approaching", "Rate limited"

/**
 * Classification method used
 */
export type ClassificationMethod =
  | 'pattern_library'    // Fast regex/keyword matching
  | 'contextual_rules'   // Conversation history analysis
  | 'provider_markers'   // Native AI annotations (e.g., Claude <THOUGHT>)
  | 'semantic_scoring'   // ML-based classification (fallback)
  | 'cache';             // Cached result (v8.6.0+)

/**
 * Classification result
 */
export interface Classification {
  /** Classification category */
  type: ClassificationType;

  /** Confidence score (0-1) */
  confidence: number;

  /** Classification method used */
  method: ClassificationMethod;

  /** Human-readable reason for classification */
  reason: string;

  /** Additional context (e.g., matched pattern, keywords) */
  context?: Record<string, any>;

  /** Timestamp of classification */
  timestamp: string;
}

/**
 * Context for classification (conversation history, metadata)
 */
export interface ClassificationContext {
  /** Current message to classify */
  message: string;

  /** Recent conversation history (sliding window) */
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  /** Current stage ID (if in stage execution) */
  stageId?: string;

  /** Provider name */
  provider: string;

  /** Token count for current response */
  tokenCount?: number;

  /** Tool calls in recent messages */
  recentToolCalls?: string[];

  /** TODO list changes detected */
  todoListChanges?: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * Action type to take based on classification
 */
export type IterateActionType =
  | 'continue'      // Auto-respond and continue execution
  | 'pause'         // Pause for user input
  | 'stop'          // Stop iterate mode
  | 'retry'         // Retry with different provider
  | 'no_op';        // No action needed (status update)

/**
 * Reason for pausing iterate mode
 */
export type PauseReason =
  | 'genuine_question'       // Genuine question detected
  | 'blocking_request'       // Needs data/clarification
  | 'high_risk_operation'    // Dangerous operation detected
  | 'time_limit_exceeded'    // Max duration reached
  | 'token_limit_exceeded'   // Max tokens reached (v8.6.0+)
  | 'iteration_limit_exceeded' // Max iterations reached
  | 'error_recovery_needed'  // Error requires user intervention
  | 'user_interrupt';        // User pressed Ctrl+C or Ctrl+Z

/**
 * Action to take based on classification
 */
export interface IterateAction {
  /** Action type */
  type: IterateActionType;

  /** Reason for action */
  reason: string;

  /** Auto-response template (if type is 'continue') */
  response?: string;

  /** Pause reason (if type is 'pause') */
  pauseReason?: PauseReason;

  /** Additional context for user */
  context?: string;

  /** Metadata for logging/telemetry */
  metadata?: Record<string, any>;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Runtime state for iterate mode
 */
export interface IterateState {
  /** Iterate mode enabled for this session */
  enabled: boolean;

  /** Session ID */
  sessionId: string;

  /** Start timestamp */
  startedAt: string;

  /** Total iterations across all stages */
  totalIterations: number;

  /** Iterations in current stage */
  currentStageIterations: number;

  /** Total auto-responses sent */
  totalAutoResponses: number;

  /** Auto-responses in current stage */
  currentStageAutoResponses: number;

  /**
   * Total tokens used across all iterations
   * @since v8.6.0
   */
  totalTokens: number;

  /**
   * Tokens used in current stage
   * @since v8.6.0
   */
  currentStageTokens: number;

  /** Classification history (recent N classifications) */
  classificationHistory: Classification[];

  /** Current pause reason (if paused) */
  pauseReason?: PauseReason;

  /** Pause context (if paused) */
  pauseContext?: string;

  /** Last warning threshold reached */
  lastWarningThreshold?: {
    type: 'time' | 'iterations' | 'tokens';
    percent: number;
    timestamp: string;
  };

  /** Metadata for tracking */
  metadata: Record<string, any>;
}

/**
 * Statistics for iterate mode execution
 */
export interface IterateStats {
  /** Total duration in milliseconds */
  durationMs: number;

  /** Total iterations */
  totalIterations: number;

  /** Total auto-responses */
  totalAutoResponses: number;

  /** Total user interventions */
  totalUserInterventions: number;

  /**
   * Total tokens used
   * @since v8.6.0
   */
  totalTokens: number;

  /**
   * Average tokens per iteration
   * @since v8.6.0
   */
  avgTokensPerIteration: number;

  /**
   * Total cost (USD)
   * @deprecated Since v8.3.0 - Cost tracking removed, always returns 0
   * @since v8.6.0 - Added back for backward compatibility
   */
  totalCost?: number;

  /** Classification accuracy (if ground truth available) */
  classificationAccuracy?: {
    precision: number;
    recall: number;
    f1: number;
  };

  /** Classification breakdown by type */
  classificationBreakdown: Record<ClassificationType, number>;

  /** Average classification latency in ms */
  avgClassificationLatencyMs: number;

  /** Safety checks performed */
  safetyChecks: {
    total: number;
    allowed: number;
    paused: number;
    blocked: number;
  };

  /** Stop reason */
  stopReason: 'completion' | 'timeout' | 'token_limit' | 'user_interrupt' | 'error';

  /** Success rate (0-1) */
  successRate: number;
}

// ============================================================================
// Risk Assessment Types
// ============================================================================

/**
 * Operation being assessed for risk
 */
export interface Operation {
  /** Operation type */
  type: 'shell_command' | 'file_write' | 'file_delete' | 'git_operation' | 'package_install';

  /** Operation details */
  details: string;

  /** File paths involved (if applicable) */
  paths?: string[];

  /** Command to execute (if applicable) */
  command?: string;

  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  /** Risk level */
  riskLevel: RiskLevel;

  /** Human-readable reason */
  reason: string;

  /** Should operation be allowed? */
  allowed: boolean;

  /** Should pause for user confirmation? */
  requiresConfirmation: boolean;

  /** Detailed risk factors */
  riskFactors: Array<{
    factor: string;
    severity: RiskLevel;
    description: string;
  }>;

  /** Recommended action */
  recommendation: string;
}

// ============================================================================
// Event Types (for Telemetry)
// ============================================================================

/**
 * Iterate mode event types
 */
export type IterateEventType =
  | 'iterate.start'
  | 'iterate.auto_response'
  | 'iterate.pause'
  | 'iterate.resume'
  | 'iterate.stop'
  | 'iterate.classification'
  | 'iterate.safety_check'
  | 'iterate.budget_warning'
  | 'iterate.error';

/**
 * Iterate mode event
 */
export interface IterateEvent {
  /** Event type */
  type: IterateEventType;

  /** Timestamp */
  timestamp: string;

  /** Session ID */
  sessionId: string;

  /** Event payload */
  payload: Record<string, any>;
}

// ============================================================================
// Pattern Library Types
// ============================================================================

/**
 * Pattern for classification
 */
export interface ClassificationPattern {
  /** Regex pattern */
  pattern: string;

  /** Classification type this pattern indicates */
  type: ClassificationType;

  /** Confidence score (0-1) */
  confidence: number;

  /** Pattern description */
  description?: string;

  /** Keywords to boost confidence */
  keywords?: string[];

  /** Provider-specific (null = applies to all providers) */
  provider?: string | null;
}

/**
 * Pattern library
 */
export interface PatternLibrary {
  /** Version of pattern library */
  version: string;

  /** Last updated timestamp */
  updatedAt: string;

  /** Patterns by classification type */
  patterns: Record<ClassificationType, ClassificationPattern[]>;

  /** Metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// Template Library Types
// ============================================================================

/**
 * Response template
 */
export interface ResponseTemplate {
  /** Template text (supports {{variables}}) */
  template: string;

  /** Classification type this template is for */
  type: ClassificationType;

  /** Priority (higher = more likely to be selected) */
  priority: number;

  /** Provider-specific (null = applies to all providers) */
  provider?: string | null;

  /** Template description */
  description?: string;
}

/**
 * Template library
 */
export interface TemplateLibrary {
  /** Version of template library */
  version: string;

  /** Last updated timestamp */
  updatedAt: string;

  /** Templates by classification type */
  templates: Record<ClassificationType, ResponseTemplate[]>;

  /** Metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Iterate mode error codes
 */
export type IterateErrorCode =
  | 'iterate_disabled'
  | 'invalid_config'
  | 'classification_failed'
  | 'response_generation_failed'
  | 'safety_check_failed'
  | 'budget_exceeded'
  | 'timeout'
  | 'unknown_error';

/**
 * Iterate mode error
 */
export class IterateError extends Error {
  constructor(
    message: string,
    public code: IterateErrorCode,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'IterateError';
  }
}
