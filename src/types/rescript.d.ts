/**
 * TypeScript Type Definitions for ReScript Core Modules
 *
 * These types provide type-safe interop between TypeScript and ReScript.
 * ReScript compiles to JavaScript with specific conventions:
 * - Variant types use TAG and _0 properties
 * - Records are plain JavaScript objects
 * - Options are undefined | T
 *
 * @module @automatosx/rescript-core
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * ReScript Option type
 * Maps to: option<'a> in ReScript
 */
export type Option<T> = T | undefined;

/**
 * ReScript Result type
 * Maps to: result<'ok, 'error> in ReScript
 */
export type Result<T, E> =
  | { TAG: 'Ok'; _0: T }
  | { TAG: 'Error'; _0: E };

/**
 * Generic event with metadata
 */
export interface Event<TData = unknown> {
  id: string;
  timestamp: number;
  data: TData;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// State Machine Types
// ============================================================================

/**
 * State machine state types
 * Maps to: state in StateMachine.res
 */
export type State =
  | 'Idle'
  | { TAG: 'Running'; _0: RunningData }
  | { TAG: 'Paused'; _0: PausedData }
  | { TAG: 'Completed'; _0: CompletedData }
  | { TAG: 'Failed'; _0: string };

/**
 * State machine event types
 * Maps to: event in StateMachine.res
 */
export type StateMachineEvent =
  | 'Start'
  | 'Pause'
  | 'Resume'
  | { TAG: 'Complete'; _0: unknown }
  | { TAG: 'Fail'; _0: string };

/**
 * Data associated with Running state
 */
export interface RunningData {
  startedAt?: number;
  progress?: number;
  [key: string]: unknown;
}

/**
 * Data associated with Paused state
 */
export interface PausedData {
  pausedAt?: number;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Data associated with Completed state
 */
export interface CompletedData {
  completedAt?: number;
  result?: unknown;
  [key: string]: unknown;
}

/**
 * State transition definition
 */
export interface Transition<TState = State, TEvent = StateMachineEvent> {
  from: TState;
  event: TEvent;
  to: TState;
  guard?: Option<(state: TState) => boolean>;
  action?: Option<() => void>;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  maxHistorySize: number;
  enableLogging: boolean;
  strict: boolean;
}

/**
 * State machine instance
 */
export interface StateMachine<TState = State, TEvent = StateMachineEvent> {
  currentState: TState;
  transitions: Transition<TState, TEvent>[];
  history: TState[];
  config: StateMachineConfig;
}

/**
 * State machine module exports
 * From: packages/rescript-core/src/state/StateMachine.bs.js
 */
export declare module StateMachineModule {
  /**
   * Create a new state machine
   */
  export function create<TState = State, TEvent = StateMachineEvent>(
    initialState: TState,
    transitions: Transition<TState, TEvent>[],
    config?: StateMachineConfig
  ): StateMachine<TState, TEvent>;

  /**
   * Create an event
   */
  export function createEvent<TData = unknown>(
    id: string,
    data: TData,
    metadata?: Record<string, unknown>
  ): Event<TData>;

  /**
   * Transition state machine to new state
   */
  export function transition<TState = State, TEvent = StateMachineEvent>(
    machine: StateMachine<TState, TEvent>,
    event: TEvent
  ): Result<TState, string>;

  /**
   * Find valid transition for event
   */
  export function findTransition<TState = State, TEvent = StateMachineEvent>(
    machine: StateMachine<TState, TEvent>,
    event: TEvent
  ): Option<Transition<TState, TEvent>>;

  /**
   * Check if two states are equal
   */
  export function statesEqual(s1: State, s2: State): boolean;

  /**
   * Get data from state (if it has data)
   */
  export function getStateData(state: State): Option<unknown>;

  /**
   * Check transition guard
   */
  export function checkGuard(
    guard: Option<(state: unknown) => boolean>,
    state: State
  ): Result<void, string>;

  /**
   * Execute transition action
   */
  export function executeAction(
    action: Option<() => void>,
    state: State
  ): Result<void, string>;

  /**
   * Get state machine current state name
   */
  export function getStateName(state: State): string;

  /**
   * Check if state machine is in terminal state
   */
  export function isTerminal(state: State): boolean;

  /**
   * Get state machine history
   */
  export function getHistory<TState = State>(
    machine: StateMachine<TState>
  ): TState[];
}

// ============================================================================
// Workflow Orchestrator Types
// ============================================================================

/**
 * Execution status enum
 */
export type ExecutionStatus =
  | 'Pending'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'TimedOut';

/**
 * Task execution details
 */
export interface TaskExecution {
  taskId: string;
  status: ExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
  retryCount: number;
  attempts: number;
}

/**
 * Workflow execution data
 */
export interface WorkflowExecutionData {
  instanceId: string;
  workflowId: string;
  currentTasks: string[];
  completedTasks: string[];
  failedTasks: string[];
  taskExecutions: Option<Map<string, TaskExecution>>;
}

/**
 * Workflow state (extends State with workflow-specific data)
 */
export type WorkflowState =
  | 'Idle'
  | { TAG: 'Running'; _0: WorkflowExecutionData }
  | { TAG: 'Paused'; _0: WorkflowExecutionData }
  | { TAG: 'Completed'; _0: WorkflowExecutionData }
  | { TAG: 'Failed'; _0: string };

/**
 * Workflow event
 */
export type WorkflowEvent =
  | 'Start'
  | 'Pause'
  | 'Resume'
  | { TAG: 'TaskCompleted'; _0: string }
  | { TAG: 'TaskFailed'; _0: string }
  | { TAG: 'Complete'; _0: WorkflowExecutionData }
  | { TAG: 'Fail'; _0: string };

/**
 * Workflow orchestrator module exports
 * From: packages/rescript-core/src/workflow/WorkflowOrchestrator.bs.js
 */
export declare module WorkflowOrchestratorModule {
  /**
   * Create workflow state machine transitions
   */
  export function createWorkflowTransitions(): Transition<WorkflowState, WorkflowEvent>[];

  /**
   * Convert execution status to string
   */
  export function executionStatusToString(status: ExecutionStatus): string;

  /**
   * Convert string to execution status
   */
  export function stringToExecutionStatus(str: string): Option<ExecutionStatus>;

  /**
   * Convert state to execution status
   */
  export function stateToExecutionStatus(state: WorkflowState): ExecutionStatus;

  /**
   * Get current timestamp
   */
  export function getCurrentTime(): number;

  /**
   * Create workflow instance
   */
  export function createWorkflow(
    workflowId: string,
    instanceId: string
  ): StateMachine<WorkflowState, WorkflowEvent>;

  /**
   * Start workflow execution
   */
  export function startWorkflow(
    machine: StateMachine<WorkflowState, WorkflowEvent>
  ): Result<WorkflowState, string>;

  /**
   * Complete workflow
   */
  export function completeWorkflow(
    machine: StateMachine<WorkflowState, WorkflowEvent>,
    data: WorkflowExecutionData
  ): Result<WorkflowState, string>;

  /**
   * Fail workflow
   */
  export function failWorkflow(
    machine: StateMachine<WorkflowState, WorkflowEvent>,
    error: string
  ): Result<WorkflowState, string>;
}

// ============================================================================
// Task Planner Types
// ============================================================================

/**
 * Task definition
 */
export interface Task {
  id: string;
  name: string;
  dependencies: string[];
  timeout?: number;
  retryable: boolean;
  maxRetries: number;
}

/**
 * Task execution plan
 */
export interface ExecutionPlan {
  tasks: Task[];
  order: string[];
  parallelGroups: string[][];
}

/**
 * Task planner module exports
 * From: packages/rescript-core/src/workflow/TaskPlanner.bs.js
 */
export declare module TaskPlannerModule {
  /**
   * Create execution plan from tasks
   */
  export function createExecutionPlan(tasks: Task[]): Result<ExecutionPlan, string>;

  /**
   * Validate task dependencies
   */
  export function validateDependencies(tasks: Task[]): Result<void, string>;

  /**
   * Topologically sort tasks
   */
  export function topologicalSort(tasks: Task[]): Result<string[], string>;

  /**
   * Find parallel execution groups
   */
  export function findParallelGroups(tasks: Task[]): string[][];

  /**
   * Check if task has circular dependencies
   */
  export function hasCircularDependencies(tasks: Task[]): boolean;

  /**
   * Get task by ID
   */
  export function getTask(tasks: Task[], id: string): Option<Task>;
}

// ============================================================================
// Retry & Fallback Types
// ============================================================================

/**
 * Retry strategy
 */
export type RetryStrategy =
  | 'Fixed'
  | 'Linear'
  | 'Exponential'
  | 'ExponentialWithJitter';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  strategy: RetryStrategy;
  jitterFactor?: number;
}

/**
 * Retry result
 */
export type RetryResult<T> =
  | { TAG: 'Success'; _0: T }
  | { TAG: 'Failed'; _0: string }
  | { TAG: 'MaxRetriesExceeded'; _0: number };

/**
 * Retry & fallback module exports
 * From: packages/rescript-core/src/retry/RetryFallback.bs.js
 */
export declare module RetryFallbackModule {
  /**
   * Execute function with retry
   */
  export function executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig
  ): Promise<RetryResult<T>>;

  /**
   * Execute function with retry and fallback
   */
  export function executeWithRetryAndFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>,
    config: RetryConfig
  ): Promise<Result<T, string>>;

  /**
   * Calculate retry delay
   */
  export function calculateDelay(
    strategy: RetryStrategy,
    attemptNumber: number,
    baseDelay: number,
    maxDelay: number,
    jitterFactor?: number
  ): number;

  /**
   * Check if error is retryable
   */
  export function isRetryableError(error: unknown): boolean;

  /**
   * Create default retry config
   */
  export function defaultRetryConfig(): RetryConfig;
}

// ============================================================================
// Rule Engine Types
// ============================================================================

/**
 * Rule condition
 */
export interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains';
  value: unknown;
}

/**
 * Rule definition
 */
export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  action: () => void;
  priority: number;
  enabled: boolean;
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  ruleId: string;
  matched: boolean;
  executed: boolean;
  error?: string;
}

/**
 * Rule engine module exports
 * From: packages/rescript-core/src/rules/RuleEngine.bs.js
 */
export declare module RuleEngineModule {
  /**
   * Evaluate rule against context
   */
  export function evaluateRule(
    rule: Rule,
    context: Record<string, unknown>
  ): RuleEvaluationResult;

  /**
   * Evaluate all rules
   */
  export function evaluateRules(
    rules: Rule[],
    context: Record<string, unknown>
  ): RuleEvaluationResult[];

  /**
   * Check if condition matches
   */
  export function matchesCondition(
    condition: RuleCondition,
    context: Record<string, unknown>
  ): boolean;

  /**
   * Sort rules by priority
   */
  export function sortByPriority(rules: Rule[]): Rule[];

  /**
   * Filter enabled rules
   */
  export function filterEnabled(rules: Rule[]): Rule[];
}

// ============================================================================
// Module Exports
// ============================================================================

/**
 * Import ReScript modules in TypeScript
 *
 * @example
 * ```typescript
 * import * as StateMachine from '../packages/rescript-core/src/state/StateMachine.bs.js';
 * import * as WorkflowOrchestrator from '../packages/rescript-core/src/workflow/WorkflowOrchestrator.bs.js';
 *
 * // Create state machine
 * const machine = StateMachine.create('Idle', transitions);
 *
 * // Transition to new state
 * const result = StateMachine.transition(machine, 'Start');
 *
 * if (result.TAG === 'Ok') {
 *   console.log('Transitioned to:', result._0);
 * } else {
 *   console.error('Transition failed:', result._0);
 * }
 * ```
 */

declare global {
  /**
   * ReScript module paths
   */
  namespace RescriptCore {
    export type StateMachine = typeof StateMachineModule;
    export type WorkflowOrchestrator = typeof WorkflowOrchestratorModule;
    export type TaskPlanner = typeof TaskPlannerModule;
    export type RetryFallback = typeof RetryFallbackModule;
    export type RuleEngine = typeof RuleEngineModule;
  }
}

// Export all types
export type {
  State,
  StateMachineEvent,
  Transition,
  StateMachineConfig,
  StateMachine,
  WorkflowState,
  WorkflowEvent,
  ExecutionStatus,
  TaskExecution,
  WorkflowExecutionData,
  Task,
  ExecutionPlan,
  RetryStrategy,
  RetryConfig,
  RetryResult,
  Rule,
  RuleCondition,
  RuleEvaluationResult,
};
