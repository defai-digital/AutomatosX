/**
 * Bugfix Module Type Definitions
 *
 * Types for the autonomous bug-finding and fixing workflow.
 *
 * @module core/bugfix/types
 * @since v12.4.0
 */

/**
 * Bug severity levels
 */
export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Bug types that can be detected
 */
export type BugType =
  | 'timer_leak'           // setInterval without .unref()
  | 'missing_destroy'      // EventEmitter without destroy()
  | 'promise_timeout_leak' // setTimeout not cleared on error
  | 'event_leak'           // .on() without .off()
  | 'resource_leak'        // Generic resource leak
  | 'race_condition'       // Potential race condition
  | 'memory_leak'          // Generic memory leak pattern
  | 'uncaught_promise'     // Promise without catch
  | 'deprecated_api'       // Deprecated API usage
  | 'security_issue'       // Security vulnerability
  | 'type_error'           // TypeScript type error
  | 'test_failure'         // Failing test
  | 'custom';              // User-defined bug type

/**
 * Fix status
 */
export type FixStatus =
  | 'pending'      // Fix not yet attempted
  | 'in_progress'  // Fix being applied
  | 'applied'      // Fix applied, awaiting verification
  | 'verified'     // Fix verified (tests pass)
  | 'failed'       // Fix failed verification
  | 'skipped'      // Fix skipped (requires manual review)
  | 'rolled_back'; // Fix rolled back due to failure

/**
 * Bug finding from detection
 */
export interface BugFinding {
  /** Unique identifier for this bug */
  id: string;

  /** File path where the bug was found */
  file: string;

  /** Line number where the bug starts */
  lineStart: number;

  /** Line number where the bug ends */
  lineEnd: number;

  /** Type of bug detected */
  type: BugType;

  /** Severity level */
  severity: BugSeverity;

  /** Human-readable description */
  message: string;

  /** Surrounding code context */
  context: string;

  /** Suggested fix strategy */
  fixStrategy?: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Detection method used */
  detectionMethod: 'regex' | 'ast' | 'test' | 'pattern' | 'manual';

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Timestamp of detection */
  detectedAt: string;
}

/**
 * Fix attempt record
 */
export interface FixAttempt {
  /** Unique identifier */
  id: string;

  /** Bug ID this fix is for */
  bugId: string;

  /** Attempt number (1-based) */
  attemptNumber: number;

  /** Fix strategy used */
  strategy: string;

  /** Diff of the fix */
  diff: string;

  /** Status of this attempt */
  status: FixStatus;

  /** Verification result (if verified) */
  verificationResult?: VerificationResult;

  /** Error message (if failed) */
  error?: string;

  /** Timestamp of attempt */
  attemptedAt: string;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Overall success */
  success: boolean;

  /** TypeScript typecheck passed */
  typecheckPassed: boolean;

  /** All tests passed */
  testsPassed: boolean;

  /** No new errors introduced */
  noNewErrors: boolean;

  /** Coverage maintained (optional) */
  coverageMaintained?: boolean;

  /** Affected tests */
  affectedTests: string[];

  /** Failed tests (if any) */
  failedTests: string[];

  /** New errors introduced (if any) */
  newErrors: string[];

  /** Duration in milliseconds */
  durationMs: number;

  // v12.9.0: PRD-018 Enhanced verification

  /** ESLint verification passed */
  lintPassed?: boolean;

  /** ESLint issues found */
  lintIssues?: string[];

  /** Strict TypeScript check passed */
  strictCheckPassed?: boolean;

  /** Strict TypeScript errors */
  strictErrors?: string[];
}

/**
 * Bugfix state machine states
 */
export type BugfixState =
  | 'IDLE'        // Waiting for command
  | 'SCANNING'    // Detecting bugs (Layer 1-3)
  | 'ANALYZING'   // Classifying and prioritizing
  | 'PLANNING'    // Generating fix strategy
  | 'FIXING'      // Applying fix
  | 'VERIFYING'   // Running tests
  | 'LEARNING'    // Storing pattern to memory
  | 'ITERATING'   // Retrying after failure
  | 'COMPLETE'    // All bugs fixed or max reached
  | 'FAILED';     // Unrecoverable error

/**
 * Bugfix session configuration
 */
export interface BugfixConfig {
  /** Maximum bugs to fix per session */
  maxBugs: number;

  /** Maximum time in minutes */
  maxDurationMinutes: number;

  /** Maximum token budget */
  maxTokens: number;

  /** Maximum retries per bug */
  maxRetriesPerBug: number;

  /** Minimum confidence for auto-fix (0.0-1.0) */
  minConfidence: number;

  /** Bug types to scan for */
  bugTypes: BugType[];

  /** Severity threshold (minimum severity to fix) */
  severityThreshold: BugSeverity;

  /** Scope (directory to scan) */
  scope?: string;

  /** Exclude patterns */
  excludePatterns: string[];

  /** Dry run mode (no actual fixes) */
  dryRun: boolean;

  /** Require tests to pass */
  requireTests: boolean;

  /** Require typecheck to pass */
  requireTypecheck: boolean;

  /** Generate regression tests for fixes */
  generateTests: boolean;

  /** Verbose output */
  verbose: boolean;

  // v12.9.0: PRD-018 Enhanced verification options

  /** Run ESLint verification after fixes */
  verifyLint?: boolean;

  /** Run strict TypeScript check after fixes */
  verifyStrict?: boolean;

  /** Enable metrics tracking */
  trackMetrics?: boolean;
}

/**
 * Bugfix session statistics
 */
export interface BugfixStats {
  /** Total bugs found */
  bugsFound: number;

  /** Bugs fixed successfully */
  bugsFixed: number;

  /** Bugs that failed to fix */
  bugsFailed: number;

  /** Bugs skipped (manual review needed) */
  bugsSkipped: number;

  /** Total fix attempts */
  totalAttempts: number;

  /** Fix success rate */
  successRate: number;

  /** Total time in milliseconds */
  totalDurationMs: number;

  /** Total tokens used */
  totalTokens: number;

  /** Patterns learned */
  patternsLearned: number;

  /** Regressions introduced (should be 0) */
  regressions: number;

  /** Stop reason */
  stopReason: 'complete' | 'max_bugs' | 'max_time' | 'max_tokens' | 'error' | 'user_interrupt';

  /** Bugs by type breakdown */
  bugsByType: Record<BugType, number>;

  /** Bugs by severity breakdown */
  bugsBySeverity: Record<BugSeverity, number>;
}

/**
 * Bugfix session result
 */
export interface BugfixResult {
  /** Session ID */
  sessionId: string;

  /** Start time */
  startedAt: string;

  /** End time */
  endedAt: string;

  /** Configuration used */
  config: BugfixConfig;

  /** All bugs found */
  findings: BugFinding[];

  /** All fix attempts */
  attempts: FixAttempt[];

  /** Statistics */
  stats: BugfixStats;

  /** Final state */
  finalState: BugfixState;

  /** Error (if failed) */
  error?: string;
}

/**
 * Detection rule definition
 */
export interface DetectionRule {
  /** Rule ID */
  id: string;

  /** Bug type this rule detects */
  type: BugType;

  /** Rule name */
  name: string;

  /** Description */
  description: string;

  /** Regex pattern (for regex-based detection) */
  pattern?: string;

  /** Negative pattern (must not match) */
  negativePattern?: string;

  /** Lines to check after match */
  withinLines?: number;

  /** Default confidence */
  confidence: number;

  /** Severity */
  severity: BugSeverity;

  /** Auto-fixable? */
  autoFixable: boolean;

  /** Fix template ID */
  fixTemplate?: string;

  /** File extensions to apply to */
  fileExtensions?: string[];

  /**
   * Use AST-based detection instead of regex
   * @since v12.8.0
   */
  useAST?: boolean;
}

/**
 * Fix template definition
 */
export interface FixTemplate {
  /** Template ID */
  id: string;

  /** Template name */
  name: string;

  /** Description */
  description: string;

  /** Bug type this fixes */
  bugType: BugType;

  /** Template code (with placeholders) */
  template: string;

  /** Required imports */
  imports?: string[];

  /** Confidence when using this template */
  confidence: number;
}
