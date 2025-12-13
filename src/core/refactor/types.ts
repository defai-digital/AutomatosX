/**
 * Type definitions for the Autonomous Refactor Tool
 * @module core/refactor/types
 * @version 12.7.0
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Focus areas for refactoring
 */
export type RefactorType =
  | 'duplication'
  | 'readability'
  | 'performance'
  | 'hardcoded_values'
  | 'naming'
  | 'conditionals'
  | 'dead_code'
  | 'type_safety';

/**
 * Severity levels for refactoring opportunities
 */
export type RefactorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * State machine states for the refactor controller
 */
export type RefactorState =
  | 'IDLE'
  | 'COLLECTING_METRICS'
  | 'SCANNING'
  | 'ANALYZING'
  | 'PLANNING'
  | 'REFACTORING'
  | 'VERIFYING'
  | 'COMPARING_METRICS'
  | 'ITERATING'
  | 'COMPLETE'
  | 'FAILED';

/**
 * Status of a refactoring attempt
 */
export type RefactorStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'rolled_back';

/**
 * Detection method used to find the refactoring opportunity
 */
export type DetectionMethod = 'static' | 'llm' | 'hybrid';

// ============================================================================
// Detection Rules
// ============================================================================

/**
 * A detection rule for finding refactoring opportunities
 */
export interface RefactorRule {
  /** Unique identifier for the rule */
  id: string;
  /** Type of refactoring this rule detects */
  type: RefactorType;
  /** Human-readable description */
  description: string;
  /** Regex pattern to match (if pattern-based) */
  pattern?: RegExp;
  /** Patterns that indicate this is NOT an issue */
  negativePatterns?: RegExp[];
  /** Detection method */
  detector: 'regex' | 'ast' | 'typescript_analyzer' | 'call_graph' | 'control_flow' | 'token_hash' | 'semantic';
  /** Severity of findings from this rule */
  severity: RefactorSeverity;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether this can be auto-fixed without LLM */
  autoFixable: boolean;
  /** Whether this requires LLM to fix */
  requiresLLM: boolean;
  /** Suggested fix message */
  suggestion?: string;
  /** File extensions this rule applies to */
  fileExtensions?: string[];
}

// ============================================================================
// Findings
// ============================================================================

/**
 * A refactoring opportunity found by the detector
 */
export interface RefactorFinding {
  /** Unique identifier */
  id: string;
  /** File path where the issue was found */
  file: string;
  /** Starting line number (1-indexed) */
  lineStart: number;
  /** Ending line number (1-indexed) */
  lineEnd: number;
  /** Type of refactoring */
  type: RefactorType;
  /** Severity level */
  severity: RefactorSeverity;
  /** Human-readable message */
  message: string;
  /** Code context (the problematic code) */
  context: string;
  /** Suggested fix (if available) */
  suggestedFix?: string;
  /** Estimated impact on metrics */
  estimatedImpact: {
    complexity?: number;
    duplication?: number;
    readability?: number;
    linesRemoved?: number;
    /** Whether this finding is safe to auto-fix (PRD-019) */
    safeToAutoFix?: boolean;
  };
  /** Confidence score (0-1) */
  confidence: number;
  /** How this was detected */
  detectionMethod: DetectionMethod;
  /** Rule ID that detected this */
  ruleId: string;
  /** When this was detected */
  detectedAt: string;
}

/**
 * A refactoring attempt record
 */
export interface RefactorAttempt {
  /** Unique identifier */
  id: string;
  /** The finding being addressed */
  findingId: string;
  /** Current status */
  status: RefactorStatus;
  /** Start time */
  startedAt: string;
  /** End time */
  endedAt?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** The applied fix (if successful) */
  appliedFix?: string;
  /** Error message (if failed) */
  error?: string;
  /** Backup file path */
  backupPath?: string;
  /** Verification result */
  verification?: RefactorVerificationResult;
  /** Metrics before refactoring */
  metricsBefore?: Partial<RefactorMetrics>;
  /** Metrics after refactoring */
  metricsAfter?: Partial<RefactorMetrics>;
}

// ============================================================================
// Metrics
// ============================================================================

/**
 * Code metrics collected before/after refactoring
 */
export interface RefactorMetrics {
  /** Total lines of code */
  linesOfCode: number;
  /** Number of functions */
  numberOfFunctions: number;
  /** Number of classes */
  numberOfClasses: number;
  /** Average cyclomatic complexity */
  avgCyclomaticComplexity: number;
  /** Maximum cyclomatic complexity */
  maxCyclomaticComplexity: number;
  /** Average cognitive complexity */
  avgCognitiveComplexity: number;
  /** Maximum cognitive complexity */
  maxCognitiveComplexity: number;
  /** Duplicate code percentage (0-100) */
  duplicationPercentage: number;
  /** Maintainability index (0-100) */
  maintainabilityIndex: number;
  /** Maximum nesting depth */
  maxNestingDepth: number;
  /** Average nesting depth */
  avgNestingDepth: number;
  /** Number of any types (TypeScript) */
  anyTypeCount: number;
  /** Number of unused exports */
  unusedExports: number;
  /** Number of unused imports */
  unusedImports: number;
}

/**
 * Metric improvement record
 */
export interface MetricImprovement {
  /** Metric name */
  metric: keyof RefactorMetrics;
  /** Value before refactoring */
  before: number;
  /** Value after refactoring */
  after: number;
  /** Improvement percentage */
  improvementPercent: number;
  /** Whether this met the improvement threshold */
  meetsThreshold: boolean;
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Result of verifying a refactoring
 */
export interface RefactorVerificationResult {
  /** Overall success */
  success: boolean;
  /** TypeScript typecheck passed */
  typecheckPassed: boolean;
  /** Tests passed */
  testsPassed: boolean;
  /** No new errors introduced */
  noNewErrors: boolean;
  /** Semantic equivalence verified */
  semanticEquivalenceVerified: boolean;
  /** Metrics improved */
  metricsImproved: boolean;
  /** Overengineering guards passed */
  guardsPasssed: boolean;
  /** Affected test files */
  affectedTests: string[];
  /** Failed tests */
  failedTests: string[];
  /** New errors found */
  newErrors: string[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Guard violation messages */
  guardViolations: string[];
}

/**
 * Semantic verification strategies
 */
export interface SemanticVerificationConfig {
  /** Strategy for pure functions */
  pureFunction: {
    strategy: 'io_comparison';
    sampleInputs: 'generated' | 'from_tests';
    tolerance: number;
  };
  /** Strategy for side-effectful code */
  sideEffects: {
    strategy: 'snapshot';
    capturePoints: ('before_call' | 'after_call')[];
    compareFields: ('state' | 'outputs' | 'logs')[];
  };
  /** Strategy for API contracts */
  api: {
    strategy: 'type_signature';
    checkExports: boolean;
    checkParameters: boolean;
    checkReturnTypes: boolean;
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the refactor tool
 */
export interface RefactorConfig {
  // Focus areas
  /** Which refactoring types to focus on */
  focusAreas: RefactorType[];

  // Scope
  /** Root directory to scan */
  scope: string;
  /** Patterns to exclude */
  excludePatterns: string[];
  /** Specific files to scan (git-aware) */
  fileFilter?: string[];

  // Limits
  /** Maximum findings to process */
  maxFindings: number;
  /** Maximum changes per file */
  maxChangesPerFile: number;
  /** Maximum lines changed per file */
  maxLinesChanged: number;
  /** Maximum duration in minutes */
  maxDurationMinutes: number;
  /** Maximum iterations */
  maxIterations: number;

  // Safety
  /** Preview mode (no changes) */
  dryRun: boolean;
  /** Require tests to pass */
  requireTests: boolean;
  /** Require TypeScript typecheck to pass */
  requireTypecheck: boolean;
  /** Require metrics to improve */
  requireMetricImprovement: boolean;
  /** Minimum improvement threshold (0-1) */
  minImprovementThreshold: number;

  // Overengineering prevention
  /** Enable conservative mode */
  conservative: boolean;
  /** Prevent creating new abstractions */
  preventNewAbstractions: boolean;

  // LLM
  /** Use LLM for detection (Layer 2) */
  useLLMForDetection: boolean;
  /** Use LLM for refactoring (Layer 3) */
  useLLMForRefactoring: boolean;

  // Semantic verification
  /** Require semantic equivalence verification */
  requireSemanticVerification: boolean;

  // Thresholds
  /** Minimum confidence to report */
  minConfidence: number;
  /** Minimum severity to report */
  severityThreshold: RefactorSeverity;

  // Output
  /** Verbose logging */
  verbose: boolean;
  /** JSON output mode */
  jsonOutput: boolean;
  /** Report output path */
  reportPath?: string;
}

/**
 * Create default refactor configuration
 */
export function createDefaultRefactorConfig(
  overrides?: Partial<RefactorConfig>
): RefactorConfig {
  return {
    // Focus areas - all by default
    focusAreas: [
      'duplication',
      'readability',
      'performance',
      'hardcoded_values',
      'naming',
      'conditionals',
      'dead_code',
      'type_safety',
    ],

    // Scope
    scope: process.cwd(),
    excludePatterns: [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '*.min.js',
      '*.bundle.js',
    ],
    fileFilter: undefined,

    // Limits (conservative defaults)
    maxFindings: 50,
    maxChangesPerFile: 3,
    maxLinesChanged: 100,
    maxDurationMinutes: 30,
    maxIterations: 1,

    // Safety (strict defaults)
    dryRun: false,
    requireTests: true,
    requireTypecheck: true,
    requireMetricImprovement: true,
    minImprovementThreshold: 0.1, // 10%

    // Overengineering prevention (on by default)
    conservative: true,
    preventNewAbstractions: true,

    // LLM (on by default, can be disabled with --no-llm)
    useLLMForDetection: true,
    useLLMForRefactoring: true,

    // Semantic verification
    requireSemanticVerification: true,

    // Thresholds
    minConfidence: 0.7,
    severityThreshold: 'low',

    // Output
    verbose: false,
    jsonOutput: false,
    reportPath: undefined,

    // Apply overrides
    ...overrides,
  };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Statistics from a refactoring session
 */
export interface RefactorStats {
  /** Total opportunities found */
  opportunitiesFound: number;
  /** Successfully applied refactorings */
  refactorsApplied: number;
  /** Failed refactorings */
  refactorsFailed: number;
  /** Skipped refactorings */
  refactorsSkipped: number;
  /** Total attempts */
  totalAttempts: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Complexity reduced */
  complexityReduced: number;
  /** Duplication removed (percentage points) */
  duplicationRemoved: number;
  /** Maintainability improved (points) */
  maintainabilityImproved: number;
  /** Lines of code removed */
  linesRemoved: number;
  /** Reason for stopping */
  stopReason: string;
  /** Breakdown by type */
  opportunitiesByType: Record<RefactorType, number>;
  /** Breakdown by severity */
  opportunitiesBySeverity: Record<RefactorSeverity, number>;
  /** Iterations completed */
  iterationsCompleted: number;
}

// ============================================================================
// Result
// ============================================================================

/**
 * Result of a refactoring session
 */
export interface RefactorResult {
  /** Session identifier */
  sessionId: string;
  /** Start time */
  startedAt: string;
  /** End time */
  endedAt: string;
  /** Configuration used */
  config: RefactorConfig;
  /** All findings */
  findings: RefactorFinding[];
  /** All attempts */
  attempts: RefactorAttempt[];
  /** Metrics before refactoring */
  metricsBefore: RefactorMetrics;
  /** Metrics after refactoring */
  metricsAfter: RefactorMetrics;
  /** Metric improvements */
  improvements: MetricImprovement[];
  /** Session statistics */
  stats: RefactorStats;
  /** Final state */
  finalState: RefactorState;
}

// ============================================================================
// Controller Options
// ============================================================================

/**
 * Options for the refactor controller
 */
export interface RefactorControllerOptions {
  /** Root directory to scan */
  rootDir?: string;
  /** Configuration overrides */
  config?: Partial<RefactorConfig>;
  /** Specific files to scan */
  fileFilter?: string[];
  /** Progress callback */
  onProgress?: (state: RefactorState, message: string, data?: Record<string, unknown>) => void;
  /** Finding callback */
  onFindingFound?: (finding: RefactorFinding) => void;
  /** Refactor applied callback */
  onRefactorApplied?: (finding: RefactorFinding, attempt: RefactorAttempt) => void;
  /** Verification callback */
  onVerification?: (result: RefactorVerificationResult) => void;
}

// ============================================================================
// Ignore State
// ============================================================================

/**
 * State for tracking ignore comments
 */
export interface RefactorIgnoreState {
  /** Lines with ignore all */
  ignoreAllLines: Set<number>;
  /** Lines with type-specific ignores */
  ignoreTypeLines: Map<number, Set<RefactorType>>;
  /** Block ignore ranges */
  ignoreBlocks: Array<{ start: number; end: number }>;
}

// ============================================================================
// Overengineering Guards
// ============================================================================

/**
 * Overengineering guard configuration
 */
export interface OverengineeringGuards {
  /** Maximum new classes allowed */
  maxNewClasses: number;
  /** Maximum new interfaces allowed */
  maxNewInterfaces: number;
  /** Maximum complexity increase allowed */
  maxComplexityIncrease: number;
  /** Maximum code size increase (ratio) */
  maxCodeSizeIncrease: number;
  /** Maximum nesting depth increase */
  maxNestingIncrease: number;
  /** Minimum improvement required (0-1) */
  minImprovement: number;
}

/**
 * Default overengineering guards
 */
export const DEFAULT_OVERENGINEERING_GUARDS: OverengineeringGuards = {
  maxNewClasses: 1,
  maxNewInterfaces: 2,
  maxComplexityIncrease: 0,
  maxCodeSizeIncrease: 1.2, // 20% max increase
  maxNestingIncrease: 0,
  minImprovement: 0.1, // 10% improvement required
};
