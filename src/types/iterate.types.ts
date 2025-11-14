/**
 * AutomatosX v8.0.0 - Iterate Mode Type Definitions
 *
 * Type definitions for autonomous retry system with adaptive strategies
 */

/**
 * Iterate Mode configuration options
 */
export interface IterateOptions {
  /** Maximum number of iterations before giving up */
  maxIterations: number;

  /** Safety level for risk tolerance */
  safetyLevel: 'permissive' | 'normal' | 'paranoid';

  /** Total time limit in milliseconds */
  timeout?: number;

  /** Save checkpoint every N iterations */
  checkpointInterval?: number;

  /** Strategy selection mode */
  strategySelector?: 'auto' | 'conservative' | 'aggressive';

  /** Callback for each iteration */
  onIteration?: (iteration: IterationResult) => void;

  /** Maximum cost limit in USD */
  maxCost?: number;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Result of a single iteration
 */
export interface IterationResult {
  /** Iteration number (1-based) */
  iteration: number;

  /** Was this iteration successful? */
  success: boolean;

  /** Is the workflow fully completed? */
  complete: boolean;

  /** Strategy used for this iteration */
  strategy: Strategy;

  /** Error if iteration failed */
  error?: Error;

  /** Progress snapshot */
  progress: ProgressSnapshot;

  /** Duration in milliseconds */
  duration: number;

  /** Cost in USD */
  cost?: number;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Final result of iterate loop
 */
export interface IterateResult {
  /** Overall success */
  success: boolean;

  /** Number of iterations executed */
  iterations: number;

  /** Total duration in milliseconds */
  totalDuration: number;

  /** Total cost in USD */
  totalCost: number;

  /** Final strategy used */
  finalStrategy: Strategy;

  /** History of all iterations */
  history: IterationResult[];

  /** Checkpoint IDs created */
  checkpoints: string[];

  /** Reason for stopping */
  stopReason: 'success' | 'max_iterations' | 'timeout' | 'safety_violation' | 'cost_limit';
}

/**
 * Execution strategy
 */
export interface Strategy {
  /** Strategy name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Strategy configuration */
  config: StrategyConfig;

  /** Priority (higher = try first) */
  priority: number;

  /** Error types this strategy handles */
  applicableErrors: string[];
}

/**
 * Strategy configuration
 */
export interface StrategyConfig {
  /** Timeout for operations */
  timeout?: number;

  /** Retry backoff strategy */
  retryBackoff?: 'none' | 'linear' | 'exponential';

  /** Maximum parallelism */
  parallelism?: number;

  /** Use fallback providers */
  fallbackProviders?: boolean;

  /** Skip optional steps */
  skipOptionalSteps?: boolean;

  /** Use cache */
  useCache?: boolean;

  /** Custom config */
  [key: string]: unknown;
}

/**
 * Failure analysis result
 */
export interface FailureAnalysis {
  /** Error classification */
  errorType: string;

  /** Is error transient? */
  isTransient: boolean;

  /** Is error permanent? */
  isPermanent: boolean;

  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Step that failed */
  failedStep: string;

  /** Detected pattern across iterations */
  failurePattern?: string;

  /** Recommended actions */
  recommendations: string[];

  /** Confidence in analysis (0.0-1.0) */
  confidence: number;
}

/**
 * Safety evaluation result
 */
export interface SafetyEvaluation {
  /** Is operation safe to proceed? */
  safe: boolean;

  /** Reason if not safe */
  reason?: string;

  /** Risk score (0.0-1.0) */
  riskScore: number;

  /** Warnings */
  warnings: string[];

  /** Cost so far */
  costSoFar: number;

  /** Duration so far */
  durationSoFar: number;
}

/**
 * Progress snapshot
 */
export interface ProgressSnapshot {
  /** Total steps */
  totalSteps: number;

  /** Completed steps */
  completedSteps: number;

  /** Failed steps */
  failedSteps: number;

  /** Current step */
  currentStep?: string;

  /** Completion percentage (0-100) */
  completionPercent: number;

  /** Steps details */
  steps?: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    duration?: number;
    error?: string;
  }>;
}

/**
 * Iteration history entry
 */
export interface IterationHistoryEntry {
  /** Iteration number */
  iteration: number;

  /** Timestamp */
  timestamp: Date;

  /** Strategy used */
  strategy: string;

  /** Success flag */
  success: boolean;

  /** Error type */
  errorType?: string;

  /** Duration */
  duration: number;

  /** Cost */
  cost?: number;
}
