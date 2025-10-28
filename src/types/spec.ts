/**
 * Spec-Kit Integration Types
 * Phase 2: Deep Integration
 *
 * @module types/spec
 */

/**
 * Spec metadata
 */
export interface SpecMetadata {
  /** Unique identifier (hash of workspace path + spec version) */
  id: string;

  /** Spec version (from spec.md or auto-generated) */
  version: string;

  /** Content checksum for cache invalidation */
  checksum: string;

  /** Workspace directory path */
  workspacePath: string;

  /** Spec file paths */
  files: {
    spec: string;      // spec.md path
    plan: string;      // plan.md path
    tasks: string;     // tasks.md path
  };

  /** Tags for categorization */
  tags: string[];

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parsed task from tasks.md
 */
export interface SpecTask {
  /** Task ID (e.g., "auth:setup") */
  id: string;

  /** Task title/description */
  title: string;

  /** Detailed description (optional) */
  description?: string;

  /** Execution command (e.g., "ax run backend 'Create auth module'") */
  ops: string;

  /** Dependency task IDs */
  deps: string[];

  /** Task status */
  status: TaskStatus;

  /** Suggested agent (parsed from ops) */
  assigneeHint?: string;

  /** Labels/tags */
  labels: string[];

  /** Line number in tasks.md (for error reporting) */
  line?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task status enum
 */
export type TaskStatus =
  | 'pending'       // Not started
  | 'in_progress'   // Currently executing
  | 'completed'     // Successfully completed
  | 'failed'        // Failed with error
  | 'skipped';      // Skipped due to dependency failure

/**
 * Spec run state (execution session)
 */
export interface SpecRunState {
  /** Spec ID */
  specId: string;

  /** Session ID (from SessionManager) */
  sessionId: string;

  /** Workspace path */
  workspacePath: string;

  /** Task execution states */
  tasks: Map<string, TaskExecutionState>;

  /** Run metadata */
  metadata: {
    /** Total tasks */
    totalTasks: number;

    /** Completed tasks */
    completedTasks: number;

    /** Failed tasks */
    failedTasks: number;

    /** Parallel execution enabled */
    parallel: boolean;

    /** Continue on error */
    continueOnError: boolean;
  };

  /** Timestamps */
  startedAt: Date;
  completedAt?: Date;

  /** Overall status */
  status: RunStatus;
}

/**
 * Run status enum
 */
export type RunStatus =
  | 'running'       // Actively executing
  | 'completed'     // All tasks completed
  | 'failed'        // Failed (and not continuing)
  | 'paused';       // Paused/checkpointed

/**
 * Task execution state
 */
export interface TaskExecutionState {
  /** Task ID */
  taskId: string;

  /** Execution status */
  status: TaskStatus;

  /** Timestamps */
  startedAt?: Date;
  completedAt?: Date;

  /** Execution output */
  output?: string;

  /** Error message (if failed) */
  error?: string;

  /** Retry count */
  retryCount: number;

  /** Agent that executed the task */
  executedBy?: string;
}

/**
 * Spec validation result
 */
export interface SpecValidationResult {
  /** Overall validation status */
  valid: boolean;

  /** Validation errors (block execution) */
  errors: ValidationIssue[];

  /** Validation warnings (don't block) */
  warnings: ValidationIssue[];

  /** Informational messages */
  info: ValidationIssue[];
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Error code (for categorization) */
  code: string;

  /** Human-readable message */
  message: string;

  /** File where issue was found */
  file?: string;

  /** Line number */
  line?: number;

  /** Column number */
  column?: number;

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Spec context for agent prompts
 * Injected into agent execution context
 */
export interface SpecContext {
  /** Spec metadata (lightweight, always included) */
  metadata: SpecMetadata;

  /** Relevant sections (lazy-loaded on demand) */
  relevantSections?: {
    /** Relevant spec.md content */
    spec?: string;

    /** Relevant plan.md content */
    plan?: string;

    /** Relevant tasks */
    tasks?: SpecTask[];
  };

  /** Current task being executed */
  currentTask?: SpecTask;

  /** Tasks that current task depends on */
  dependencies?: SpecTask[];

  /** Tasks that depend on current task */
  dependents?: SpecTask[];
}

/**
 * Spec graph (DAG) representation
 */
export interface SpecGraph {
  /** All tasks indexed by ID */
  tasks: Map<string, SpecTask>;

  /** Adjacency list (task ID -> dependent task IDs) */
  adjacencyList: Map<string, string[]>;

  /** Reverse adjacency list (task ID -> dependency task IDs) */
  reverseAdjacencyList: Map<string, string[]>;

  /** In-degree of each task (number of dependencies) */
  inDegree: Map<string, number>;

  /** Topologically sorted task IDs */
  sortedTaskIds: string[];

  /** Graph metadata */
  metadata: {
    /** Total tasks */
    taskCount: number;

    /** Maximum dependency depth */
    maxDepth: number;

    /** Has cyclic dependencies */
    hasCycles: boolean;

    /** Cycle paths (if any) */
    cycles?: string[][];
  };
}

/**
 * Spec loader options
 */
export interface SpecLoaderOptions {
  /** Workspace path */
  workspacePath: string;

  /** Spec directory path (default: .specify) */
  specDir?: string;

  /** Enable file watching */
  watch?: boolean;

  /** Parse options */
  parseOptions?: {
    /** Enable strict parsing */
    strict?: boolean;

    /** Maximum file size (bytes) */
    maxFileSize?: number;
  };
}

/**
 * Spec validator options
 */
export interface SpecValidatorOptions {
  /** Validation mode */
  mode?: 'strict' | 'permissive';

  /** Validate task dependencies */
  validateDependencies?: boolean;

  /** Validate task ops commands */
  validateOps?: boolean;

  /** Custom validation rules */
  customRules?: ValidationRule[];
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  /** Rule name */
  name: string;

  /** Rule description */
  description: string;

  /** Validation function */
  validate: (spec: ParsedSpec) => ValidationIssue[];
}

/**
 * Parsed spec (internal representation)
 */
export interface ParsedSpec {
  /** Metadata */
  metadata: SpecMetadata;

  /** Raw content */
  content: {
    /** spec.md content */
    spec: string;

    /** plan.md content */
    plan: string;

    /** tasks.md content */
    tasks: string;
  };

  /** Parsed tasks */
  tasks: SpecTask[];

  /** Parsed graph */
  graph?: SpecGraph;
}

/**
 * Spec cache entry
 */
export interface SpecCacheEntry {
  /** Spec metadata */
  metadata: SpecMetadata;

  /** Parsed spec */
  spec: ParsedSpec;

  /** Last access timestamp */
  lastAccessedAt: Date;

  /** Access count */
  accessCount: number;
}

/**
 * Spec executor options
 */
export interface SpecExecutorOptions {
  /** Session ID */
  sessionId: string;

  /** Enable parallel execution */
  parallel?: boolean;

  /** Continue on task failure */
  continueOnError?: boolean;

  /** Maximum concurrent tasks (if parallel) */
  maxConcurrent?: number;

  /** Checkpoint interval (tasks) */
  checkpointInterval?: number;

  /** Dry run mode (don't actually execute) */
  dryRun?: boolean;

  /** Task filter */
  taskFilter?: TaskFilter;
}

/**
 * Spec execution result
 */
export interface SpecExecutionResult {
  /** Spec ID */
  specId: string;

  /** Session ID */
  sessionId: string;

  /** Total tasks executed */
  totalTasks: number;

  /** Completed tasks */
  completedTasks: number;

  /** Failed tasks */
  failedTasks: number;

  /** Skipped tasks */
  skippedTasks: number;

  /** Execution duration (ms) */
  duration: number;

  /** Task results */
  taskResults: TaskExecutionResult[];

  /** Run state */
  runState: SpecRunState;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /** Task ID */
  taskId: string;

  /** Execution status */
  status: TaskStatus;

  /** Task output */
  output?: string;

  /** Error message (if failed) */
  error?: string;

  /** Execution duration (ms) */
  duration: number;

  /** Tokens used */
  tokensUsed?: number;

  /** Agent that executed the task */
  executedBy?: string;

  /** Retry count */
  retryCount: number;
}

/**
 * Task filter for selective execution
 */
export interface TaskFilter {
  /** Filter by task IDs */
  taskIds?: string[];

  /** Filter by labels */
  labels?: string[];

  /** Filter by agent hint */
  agentHint?: string;

  /** Filter by status */
  status?: TaskStatus[];

  /** Custom filter function */
  customFilter?: (task: SpecTask) => boolean;
}

/**
 * Spec registry factory options
 */
export interface SpecRegistryOptions {
  /** Workspace path */
  workspacePath: string;

  /** Enable caching */
  enableCache?: boolean;

  /** Cache size limit (entries) */
  cacheSize?: number;

  /** Enable file watching */
  enableWatch?: boolean;

  /** Validation options */
  validationOptions?: SpecValidatorOptions;
}

/**
 * Spec event types
 */
export type SpecEventType =
  | 'spec:detected'      // Spec detected in workspace
  | 'spec:loaded'        // Spec loaded and parsed
  | 'spec:validated'     // Spec validation completed
  | 'spec:changed'       // Spec files changed
  | 'spec:invalidated'   // Spec cache invalidated
  | 'task:started'       // Task execution started
  | 'task:completed'     // Task execution completed
  | 'task:failed'        // Task execution failed
  | 'task:skipped'       // Task skipped
  | 'run:started'        // Run started
  | 'run:completed'      // Run completed
  | 'run:failed'         // Run failed
  | 'run:checkpointed';  // Run checkpointed

/**
 * Spec event payload
 */
export interface SpecEvent {
  /** Event type */
  type: SpecEventType;

  /** Event timestamp */
  timestamp: Date;

  /** Workspace path */
  workspacePath: string;

  /** Spec ID (if applicable) */
  specId?: string;

  /** Task ID (if applicable) */
  taskId?: string;

  /** Run state (if applicable) */
  runState?: SpecRunState;

  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Relevance scores for context injection
 */
export interface RelevanceScores {
  /** Spec content relevance (0-1) */
  spec: number;

  /** Plan content relevance (0-1) */
  plan: number;

  /** Task relevance scores */
  tasks: Array<{
    /** Task ID */
    id: string;

    /** Relevance score (0-1) */
    score: number;
  }>;
}

/**
 * Context injection scope
 */
export interface ContextScope {
  /** Agent ID */
  agentId: string;

  /** User task/prompt */
  task: string;

  /** Workspace path */
  workspacePath: string;

  /** Session ID */
  sessionId?: string;

  /** Current task ID (if executing from spec) */
  currentTaskId?: string;
}

/**
 * Spec telemetry data
 */
export interface SpecTelemetry {
  /** Parse time (milliseconds) */
  parseTime: number;

  /** Cache hit rate (0-1) */
  cacheHitRate: number;

  /** Validation time (milliseconds) */
  validationTime: number;

  /** Graph complexity */
  graphComplexity: {
    /** Task count */
    taskCount: number;

    /** Maximum depth */
    maxDepth: number;

    /** Has cycles */
    hasCycles: boolean;
  };

  /** Context sizes */
  contextSizes: {
    /** Spec content size (bytes) */
    spec: number;

    /** Plan content size (bytes) */
    plan: number;

    /** Tasks context size (bytes) */
    tasks: number;

    /** Total injected size (bytes) */
    total: number;
  };

  /** Execution metrics */
  executionMetrics?: {
    /** Execution time (milliseconds) */
    executionTime: number;

    /** Task success rate (0-1) */
    taskSuccessRate: number;

    /** Checkpoint count */
    checkpointCount: number;

    /** Retry count */
    retryCount: number;
  };
}

/**
 * Error codes for spec operations
 */
export enum SpecErrorCode {
  // Detection errors
  SPEC_NOT_FOUND = 'SPEC_NOT_FOUND',
  INVALID_SPEC_DIR = 'INVALID_SPEC_DIR',

  // Parsing errors
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_TASK_FORMAT = 'INVALID_TASK_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CYCLIC_DEPENDENCY = 'CYCLIC_DEPENDENCY',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',
  DUPLICATE_TASK_ID = 'DUPLICATE_TASK_ID',
  INVALID_OPS_COMMAND = 'INVALID_OPS_COMMAND',

  // Execution errors
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  CHECKPOINT_FAILED = 'CHECKPOINT_FAILED',

  // Cache errors
  CACHE_INVALIDATION_FAILED = 'CACHE_INVALIDATION_FAILED',
  CACHE_SIZE_EXCEEDED = 'CACHE_SIZE_EXCEEDED',

  // State errors
  STATE_LOAD_FAILED = 'STATE_LOAD_FAILED',
  STATE_SAVE_FAILED = 'STATE_SAVE_FAILED',
  INVALID_RUN_STATE = 'INVALID_RUN_STATE',
}

/**
 * Spec error class
 */
export class SpecError extends Error {
  constructor(
    public code: SpecErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SpecError';
  }
}
