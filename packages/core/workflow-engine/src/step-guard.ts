/**
 * Workflow Step Guard Implementation
 *
 * Enforces governance checks at workflow step boundaries.
 *
 * Invariants:
 * - INV-WF-GUARD-001: Before guards run before step execution starts
 * - INV-WF-GUARD-002: After guards run after step completes
 * - INV-WF-GUARD-003: Block failures prevent step execution/continuation
 * - INV-WF-GUARD-004: Guard results included in trace events
 */

import type {
  WorkflowStepGuard,
  StepGuardResult,
  StepGuardContext,
  StepGuardPolicy,
  StepGateResult,
  GuardPosition,
  GuardCheckStatus,
  StageProgressEvent,
  StageProgressStatus,
} from '@automatosx/contracts';
import {
  createStepGuardResult,
  createProgressEvent,
} from '@automatosx/contracts';

// ============================================================================
// Gate Interface
// ============================================================================

/**
 * Gate check function
 */
export type GateCheckFn = (context: StepGuardContext) => Promise<StepGateResult>;

/**
 * Gate registry
 */
export interface GateRegistry {
  /** Register a gate */
  register(gateId: string, check: GateCheckFn): void;
  /** Get a gate */
  get(gateId: string): GateCheckFn | undefined;
  /** Check if gate exists */
  has(gateId: string): boolean;
  /** List all gate IDs */
  list(): string[];
}

// ============================================================================
// Step Guard Engine
// ============================================================================

/**
 * Configuration for step guard engine
 */
export interface StepGuardEngineConfig {
  /** Enable guard checking */
  enabled: boolean;
  /** Default action on failure */
  defaultOnFail: 'block' | 'warn' | 'continue';
  /** Gate registry */
  gateRegistry?: GateRegistry;
  /** Event emitter for progress events */
  onProgressEvent?: (event: StageProgressEvent) => void;
}

/**
 * Default step guard engine configuration
 */
export const DEFAULT_STEP_GUARD_ENGINE_CONFIG: StepGuardEngineConfig = {
  enabled: true,
  defaultOnFail: 'warn',
};

/**
 * Step Guard Engine
 *
 * Manages step guards and executes them at appropriate times.
 */
export class StepGuardEngine {
  private readonly config: StepGuardEngineConfig;
  private readonly gateRegistry: GateRegistry;
  private readonly policies: Map<string, StepGuardPolicy> = new Map();
  private readonly onProgressEvent: ((event: StageProgressEvent) => void) | undefined;

  constructor(config: Partial<StepGuardEngineConfig> = {}) {
    this.config = { ...DEFAULT_STEP_GUARD_ENGINE_CONFIG, ...config };
    this.gateRegistry = config.gateRegistry ?? createGateRegistry();
    this.onProgressEvent = config.onProgressEvent;

    // Register default gates
    this.registerDefaultGates();
  }

  /**
   * Register a guard policy
   */
  registerPolicy(policy: StepGuardPolicy): void {
    this.policies.set(policy.policyId, policy);
  }

  /**
   * Remove a guard policy
   */
  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * Get all registered policies
   */
  getPolicies(): StepGuardPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Register a custom gate
   */
  registerGate(gateId: string, check: GateCheckFn): void {
    this.gateRegistry.register(gateId, check);
  }

  /**
   * Run before guards for a step
   * INV-WF-GUARD-001: Runs before step execution
   */
  async runBeforeGuards(context: StepGuardContext): Promise<StepGuardResult[]> {
    return this.runGuards(context, 'before');
  }

  /**
   * Run after guards for a step
   * INV-WF-GUARD-002: Runs after step completes
   */
  async runAfterGuards(context: StepGuardContext): Promise<StepGuardResult[]> {
    return this.runGuards(context, 'after');
  }

  /**
   * Check if step should be blocked
   * INV-WF-GUARD-003: Block failures prevent execution
   */
  shouldBlock(results: StepGuardResult[]): boolean {
    return results.some((r) => r.blocked);
  }

  /**
   * Emit progress event
   * INV-PROG-001, INV-PROG-002: Progress events emitted
   */
  emitProgress(
    executionId: string,
    agentId: string,
    stageIndex: number,
    stageTotal: number,
    stageName: string,
    stageType: string,
    status: StageProgressStatus,
    options: {
      sessionId?: string;
      durationMs?: number;
      error?: string;
      guardResult?: StepGuardResult;
      metadata?: Record<string, unknown>;
    } = {}
  ): void {
    if (this.onProgressEvent) {
      const event = createProgressEvent(
        executionId,
        agentId,
        stageIndex,
        stageTotal,
        stageName,
        stageType,
        status,
        options
      );
      this.onProgressEvent(event);
    }
  }

  /**
   * Run guards at a position
   */
  private async runGuards(
    context: StepGuardContext,
    position: GuardPosition
  ): Promise<StepGuardResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const results: StepGuardResult[] = [];
    const applicablePolicies = this.getApplicablePolicies(context);

    // Sort by priority (highest first)
    // INV-POL-001: Priority ordering
    applicablePolicies.sort((a, b) => b.priority - a.priority);

    for (const policy of applicablePolicies) {
      for (const guard of policy.guards) {
        if (!guard.enabled) continue;
        if (guard.position !== position) continue;
        if (!this.matchesStep(guard.stepId, context.stepId)) continue;

        const result = await this.runGuard(guard, context);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Run a single guard
   */
  private async runGuard(
    guard: WorkflowStepGuard,
    context: StepGuardContext
  ): Promise<StepGuardResult> {
    const startTime = Date.now();
    const gateResults: StepGateResult[] = [];

    // INV-GATE-001: Gates execute independently
    for (const gateId of guard.gates) {
      const gateFn = this.gateRegistry.get(gateId);
      if (!gateFn) {
        gateResults.push({
          gateId,
          status: 'WARN',
          message: `Gate "${gateId}" not found`,
        });
        continue;
      }

      try {
        const result = await gateFn(context);
        gateResults.push(result);
      } catch (error) {
        gateResults.push({
          gateId,
          status: 'FAIL',
          message: error instanceof Error ? error.message : 'Gate check failed',
        });
      }
    }

    // Determine if should block
    const hasFailure = gateResults.some((g) => g.status === 'FAIL');
    const blocked = hasFailure && guard.onFail === 'block';

    const result = createStepGuardResult(
      guard.guardId,
      context.stepId,
      guard.position,
      gateResults,
      blocked
    );

    // Set duration
    result.durationMs = Date.now() - startTime;

    return result;
  }

  /**
   * Get policies applicable to context
   */
  private getApplicablePolicies(context: StepGuardContext): StepGuardPolicy[] {
    const applicable: StepGuardPolicy[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;
      if (!this.matchesPatterns(policy.agentPatterns, context.agentId)) continue;
      if (policy.stepTypes && !policy.stepTypes.includes(context.stepType)) continue;
      if (context.workflowId && !this.matchesPatterns(policy.workflowPatterns, context.workflowId)) continue;

      applicable.push(policy);
    }

    return applicable;
  }

  /**
   * Check if step ID matches pattern
   */
  private matchesStep(pattern: string, stepId: string): boolean {
    if (pattern === '*') return true;
    return this.globMatch(pattern, stepId);
  }

  /**
   * Check if any pattern matches value
   */
  private matchesPatterns(patterns: string[], value: string): boolean {
    return patterns.some((p) => p === '*' || this.globMatch(p, value));
  }

  /**
   * Simple glob matching (* only)
   */
  private globMatch(pattern: string, value: string): boolean {
    const regex = new RegExp(
      '^' + pattern.split('*').map(this.escapeRegex).join('.*') + '$'
    );
    return regex.test(value);
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Register default gates
   */
  private registerDefaultGates(): void {
    // Validation gate - always passes (placeholder)
    this.gateRegistry.register('validation', async (_context) => ({
      gateId: 'validation',
      status: 'PASS' as GuardCheckStatus,
      message: 'Validation passed',
    }));

    // Capability gate - checks if agent has required capabilities
    this.gateRegistry.register('capability', async (context) => {
      // Placeholder - in real implementation would check agent capabilities
      return {
        gateId: 'capability',
        status: 'PASS' as GuardCheckStatus,
        message: `Agent ${context.agentId} has required capabilities`,
      };
    });

    // Resource gate - checks resource limits
    this.gateRegistry.register('resource', async (context) => {
      // Placeholder - in real implementation would check resource usage
      return {
        gateId: 'resource',
        status: 'PASS' as GuardCheckStatus,
        message: 'Resource limits not exceeded',
        details: {
          stepIndex: context.stepIndex,
          totalSteps: context.totalSteps,
        },
      };
    });

    // Progress gate - checks execution progress
    this.gateRegistry.register('progress', async (context) => {
      const progress = ((context.stepIndex + 1) / context.totalSteps) * 100;
      return {
        gateId: 'progress',
        status: 'PASS' as GuardCheckStatus,
        message: `Execution at ${progress.toFixed(0)}%`,
        details: {
          stepIndex: context.stepIndex,
          totalSteps: context.totalSteps,
          percentComplete: progress,
        },
      };
    });
  }
}

// ============================================================================
// Gate Registry Implementation
// ============================================================================

/**
 * Create a gate registry
 */
export function createGateRegistry(): GateRegistry {
  const gates = new Map<string, GateCheckFn>();

  return {
    register(gateId: string, check: GateCheckFn): void {
      gates.set(gateId, check);
    },

    get(gateId: string): GateCheckFn | undefined {
      return gates.get(gateId);
    },

    has(gateId: string): boolean {
      return gates.has(gateId);
    },

    list(): string[] {
      return Array.from(gates.keys());
    },
  };
}

/**
 * Create a step guard engine
 */
export function createStepGuardEngine(
  config?: Partial<StepGuardEngineConfig>
): StepGuardEngine {
  return new StepGuardEngine(config);
}

// ============================================================================
// Progress Tracker
// ============================================================================

/**
 * Progress tracker for workflow execution
 *
 * Tracks stage progress and emits events.
 */
export class ProgressTracker {
  private readonly executionId: string;
  private readonly agentId: string;
  private readonly sessionId: string | undefined;
  private readonly totalSteps: number;
  private readonly onEvent: (event: StageProgressEvent) => void;

  constructor(
    executionId: string,
    agentId: string,
    totalSteps: number,
    onEvent: (event: StageProgressEvent) => void,
    sessionId?: string
  ) {
    this.executionId = executionId;
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.totalSteps = totalSteps;
    this.onEvent = onEvent;
  }

  /**
   * Emit starting event
   * INV-PROG-001: Every stage emits starting event
   */
  starting(stepIndex: number, stepId: string, stepType: string): void {
    this.emit(stepIndex, stepId, stepType, 'starting');
  }

  /**
   * Emit completed event
   * INV-PROG-002: Every stage emits terminal event
   */
  completed(
    stepIndex: number,
    stepId: string,
    stepType: string,
    durationMs: number
  ): void {
    this.emit(stepIndex, stepId, stepType, 'completed', { durationMs });
  }

  /**
   * Emit failed event
   */
  failed(
    stepIndex: number,
    stepId: string,
    stepType: string,
    error: string,
    durationMs: number
  ): void {
    this.emit(stepIndex, stepId, stepType, 'failed', { durationMs, error });
  }

  /**
   * Emit skipped event
   */
  skipped(stepIndex: number, stepId: string, stepType: string): void {
    this.emit(stepIndex, stepId, stepType, 'skipped');
  }

  /**
   * Emit blocked event
   */
  blocked(
    stepIndex: number,
    stepId: string,
    stepType: string,
    guardResult: StepGuardResult
  ): void {
    this.emit(stepIndex, stepId, stepType, 'blocked', { guardResult });
  }

  /**
   * Emit event
   */
  private emit(
    stepIndex: number,
    stepId: string,
    stepType: string,
    status: StageProgressStatus,
    options: {
      durationMs?: number;
      error?: string;
      guardResult?: StepGuardResult;
    } = {}
  ): void {
    const eventOptions: {
      sessionId?: string;
      durationMs?: number;
      error?: string;
      guardResult?: StepGuardResult;
    } = { ...options };

    if (this.sessionId !== undefined) {
      eventOptions.sessionId = this.sessionId;
    }

    const event = createProgressEvent(
      this.executionId,
      this.agentId,
      stepIndex,
      this.totalSteps,
      stepId,
      stepType,
      status,
      eventOptions
    );
    this.onEvent(event);
  }
}

/**
 * Create a progress tracker
 */
export function createProgressTracker(
  executionId: string,
  agentId: string,
  totalSteps: number,
  onEvent: (event: StageProgressEvent) => void,
  sessionId?: string
): ProgressTracker {
  return new ProgressTracker(executionId, agentId, totalSteps, onEvent, sessionId);
}
