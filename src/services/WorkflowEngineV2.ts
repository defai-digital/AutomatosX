/**
 * WorkflowEngineV2.ts
 *
 * Next-generation workflow orchestration using ReScript state machine
 * Day 2: ReScript Integration - Deterministic state transitions
 *
 * Key Improvements over V1:
 * - Formal state machine with type-safe transitions (ReScript)
 * - Deterministic execution with checkpoint/resume support
 * - Agent integration via WorkflowAgentBridge
 * - Comprehensive error handling with Result types
 */

import { WorkflowDAO } from '../database/dao/WorkflowDAO.js';
import { WorkflowParser } from './WorkflowParser.js';
import { CheckpointServiceV2 } from './CheckpointServiceV2.js';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowState,
  WorkflowContext,
  WorkflowResult,
  WorkflowExecutionOptions,
  DependencyGraph,
  parseWorkflowDefinition,
  isTerminalState,
} from '../types/schemas/workflow.schema.js';
import { getDatabase } from '../database/connection.js';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { WorkflowOptimizer, OptimizationStrategy } from '../optimization/WorkflowOptimizer.js';
import { WorkflowCache } from '../cache/WorkflowCache.js';
import { WorkflowStateMachineBridge, type StepState, type TransitionResult } from '../bridge/WorkflowStateMachineBridge.js';
import { WorkflowAgentBridge } from '../bridge/WorkflowAgentBridge.js';

/**
 * Step execution result (compatible with V1)
 */
export interface StepResult {
  stepKey: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  retries: number;
}

/**
 * Workflow execution summary (compatible with V1)
 */
export interface WorkflowExecutionSummary {
  executionId: string;
  workflowId: string;
  workflowName: string;
  state: WorkflowState;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  stepsCompleted: number;
  stepsFailed: number;
  stepsTotal: number;
  error?: string;
}

/**
 * WorkflowEngineV2 - Next-generation workflow orchestrator
 *
 * Uses ReScript state machine for deterministic execution.
 * Maintains backward compatibility with V1 API.
 */
export class WorkflowEngineV2 {
  private dao: WorkflowDAO;
  private parser: WorkflowParser;
  private checkpointService: CheckpointServiceV2;
  private agentBridge: WorkflowAgentBridge;
  private db: Database.Database;
  private optimizer: WorkflowOptimizer;
  private cache: WorkflowCache;

  constructor(db?: Database.Database, cache?: WorkflowCache, agentBridge?: WorkflowAgentBridge) {
    this.db = db || getDatabase();
    this.dao = new WorkflowDAO(this.db);
    this.parser = new WorkflowParser();
    this.checkpointService = new CheckpointServiceV2(this.db);
    this.agentBridge = agentBridge || new WorkflowAgentBridge(this.db);
    this.optimizer = new WorkflowOptimizer();
    this.cache = cache || new WorkflowCache();
  }

  /**
   * Get cache instance (for external access)
   */
  getCache(): WorkflowCache {
    return this.cache;
  }

  /**
   * Execute a workflow from definition using ReScript state machine
   *
   * State transition flow:
   * Idle -> Parsing -> Validating -> Executing -> Completed/Failed/Cancelled
   */
  async executeWorkflow(
    workflowDef: WorkflowDefinition,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowResult> {
    // 1. Validate workflow definition
    const validation = this.parser.validate(workflowDef);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }

    // 2. Get or create workflow in database
    let workflow = this.dao.getWorkflowByName(workflowDef.name);
    if (!workflow) {
      workflow = this.dao.createWorkflow({
        name: workflowDef.name,
        description: workflowDef.description,
        definition: workflowDef,
        author: workflowDef.author,
        tags: workflowDef.tags,
      });
    }

    // 3. Create execution record
    const execution = this.dao.createExecution({
      workflowId: workflow.id,
      context: options.context,
      triggeredBy: options.triggeredBy,
      priority: options.priority ?? 0,
      parentExecutionId: options.parentExecutionId,
    });

    // 4. Log start event
    this.dao.logEvent({
      executionId: execution.id,
      eventType: 'workflow_started',
      eventData: {
        workflowName: workflowDef.name,
        triggeredBy: options.triggeredBy,
      },
    });

    // 5. Create ReScript state machine
    const stepIds = workflowDef.steps.map(s => s.key);
    const machine = WorkflowStateMachineBridge.create(
      execution.id,
      workflowDef.name,
      stepIds
    );

    // 6. Execute workflow with state machine
    try {
      const result = await this.runWorkflowWithStateMachine(
        machine,
        execution.id,
        workflowDef,
        options.context || {}
      );

      // Update execution state
      this.dao.updateExecutionState(execution.id, 'completed');
      this.dao.logEvent({
        executionId: execution.id,
        eventType: 'workflow_completed',
        eventData: {
          state: result.state,
          durationMs: result.durationMs,
        },
      });

      return result;
    } catch (error) {
      // Cleanup: Invalidate any checkpoints created during failed execution
      try {
        await this.checkpointService.invalidateCheckpointsForExecution(execution.id);
      } catch (cleanupError) {
        // Log cleanup error but don't mask original error
        console.error('Failed to invalidate checkpoints during error cleanup:', cleanupError);
      }

      // Log error and update execution
      this.dao.updateExecutionState(execution.id, 'failed', error instanceof Error ? error.message : String(error));
      this.dao.logEvent({
        executionId: execution.id,
        eventType: 'workflow_failed',
        eventData: {
          error: error instanceof Error ? error.message : String(error),
          cleanupCompleted: true,
        },
      });

      throw error;
    }
  }

  /**
   * Execute workflow from file
   */
  async executeWorkflowFromFile(
    filePath: string,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowResult> {
    const workflowDef = await this.parser.parseFile(filePath);
    return this.executeWorkflow(workflowDef, options);
  }

  /**
   * Resume workflow execution from checkpoint using ReScript state machine
   */
  async resumeWorkflow(checkpointId: string): Promise<WorkflowResult> {
    // 1. Restore checkpoint (includes ReScript state machine state)
    const restored = await this.checkpointService.restoreCheckpoint(checkpointId);

    // 2. Get execution
    const execution = this.dao.getExecutionById(restored.checkpoint.executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${restored.checkpoint.executionId}`);
    }

    // 3. Get workflow
    const workflow = this.dao.getWorkflowById(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    // 4. Parse workflow definition
    const workflowDef = parseWorkflowDefinition(workflow.definition);

    // 5. Restore ReScript state machine from checkpoint
    const machine = restored.machine;

    // 6. Update execution state
    this.dao.updateExecutionState(execution.id, 'executing');
    this.dao.incrementResumeCount(execution.id);

    // 7. Log resume event
    this.dao.logEvent({
      executionId: execution.id,
      eventType: 'workflow_resumed',
      eventData: {
        checkpointId,
        completedSteps: machine.getCompletedSteps().length,
        pendingSteps: machine.getPendingSteps().length,
      },
    });

    // 8. Continue execution from where we left off
    try {
      const result = await this.runWorkflowWithStateMachine(
        machine,
        execution.id,
        workflowDef,
        restored.context
      );

      this.dao.updateExecutionState(execution.id, 'completed');
      return result;
    } catch (error) {
      this.dao.updateExecutionState(execution.id, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.dao.getExecutionById(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (isTerminalState(execution.state)) {
      throw new Error(`Cannot pause execution in terminal state: ${execution.state}`);
    }

    this.dao.updateExecutionState(executionId, 'paused');
    this.dao.logEvent({
      executionId,
      eventType: 'workflow_paused',
      eventData: {},
    });
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    const execution = this.dao.getExecutionById(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (isTerminalState(execution.state)) {
      throw new Error(`Cannot cancel execution in terminal state: ${execution.state}`);
    }

    this.dao.updateExecutionState(executionId, 'cancelled');
    this.dao.logEvent({
      executionId,
      eventType: 'workflow_cancelled',
      eventData: {},
    });
  }

  /**
   * Core workflow execution logic using ReScript state machine
   *
   * Manages state transitions through the workflow lifecycle:
   * 1. Idle -> Start -> Parsing
   * 2. Parsing -> Parse -> Validating
   * 3. Validating -> Validate -> Executing
   * 4. Executing -> Execute steps -> Completed/Failed
   *
   * Creates checkpoints after each level for resumability.
   */
  private async runWorkflowWithStateMachine(
    initialMachine: WorkflowStateMachineBridge,
    executionId: string,
    workflowDef: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    let machine = initialMachine;
    const startTime = Date.now();

    // Transition: Idle -> Start -> Parsing
    const startResult = machine.transition('start');
    if (!startResult.success) {
      throw new Error(`Failed to start workflow: ${startResult.error}`);
    }
    machine = startResult.machine!;

    // Transition: Parsing -> Parse -> Validating
    const parseResult = machine.transition('parse');
    if (!parseResult.success) {
      throw new Error(`Failed to parse workflow: ${parseResult.error}`);
    }
    machine = parseResult.machine!;

    // Transition: Validating -> Validate -> Executing
    const validateResult = machine.transition('validate');
    if (!validateResult.success) {
      throw new Error(`Failed to validate workflow: ${validateResult.error}`);
    }
    machine = validateResult.machine!;

    // Build dependency graph for level-by-level execution
    const graph = this.parser.buildDependencyGraph(workflowDef);

    // Execute steps level-by-level with state machine tracking
    machine = await this.executeStepsWithStateMachine(
      machine,
      executionId,
      workflowDef,
      graph,
      context
    );

    // Transition to terminal state: Executing -> Complete -> Completed
    const completeResult = machine.transition('complete');
    if (!completeResult.success) {
      throw new Error(`Failed to complete workflow: ${completeResult.error}`);
    }
    machine = completeResult.machine!;

    // Build final result
    const endTime = Date.now();
    const machineContext = machine.getContext();
    const completedSteps = machine.getCompletedSteps();
    const failedSteps = machine.getFailedSteps();

    return {
      executionId,
      workflowId: executionId,
      workflowName: workflowDef.name,
      state: 'completed' as WorkflowState,
      context: machineContext.variables,
      stepResults: Object.fromEntries(
        completedSteps.map(step => [step.id, {
          success: step.status === 'completed',
          result: step.result,
          error: step.error,
          duration: step.completedAt && step.startedAt ? step.completedAt - step.startedAt : 0,
          retries: 0, // TODO: Track retries in ReScript state machine
        }])
      ),
      startedAt: machineContext.startedAt,
      completedAt: machineContext.completedAt,
      durationMs: endTime - startTime,
    };
  }

  /**
   * Execute workflow steps level-by-level with state machine tracking
   *
   * Each level contains steps that can run in parallel (no dependencies between them).
   * Creates checkpoint after each level for resumability.
   */
  private async executeStepsWithStateMachine(
    machine: WorkflowStateMachineBridge,
    executionId: string,
    workflowDef: WorkflowDefinition,
    graph: DependencyGraph,
    context: WorkflowContext
  ): Promise<WorkflowStateMachineBridge> {
    let current = machine;
    const stepResults: Record<string, unknown> = {};

    // Build step lookup map for O(1) access instead of O(n) find()
    const stepMap = new Map(workflowDef.steps.map(s => [s.key, s]));

    // Execute each level in sequence
    for (const level of graph.levels) {
      // Get completed steps to skip
      const completedSteps = current.getCompletedSteps();
      const completedIds = new Set(completedSteps.map(s => s.id));

      const stepsToExecute = level.filter(stepKey => !completedIds.has(stepKey));

      if (stepsToExecute.length === 0) {
        continue; // All steps in this level already completed
      }

      // Get step definitions using O(1) map lookup
      const steps = stepsToExecute.map(stepKey => stepMap.get(stepKey)!).filter(Boolean);

      // Execute steps in parallel
      const results = await Promise.allSettled(
        steps.map(step => this.executeStepWithAgent(step, context, stepResults, current))
      );

      // Process results and update state machine
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const step = steps[i];

        if (result.status === 'fulfilled') {
          const stepResult = result.value;

          // Validate step result structure before using
          if (!stepResult || typeof stepResult !== 'object') {
            throw new Error(`Step ${step.key} returned invalid result: ${JSON.stringify(stepResult)}`);
          }

          // Check if step actually succeeded
          if (stepResult.success === false) {
            // Step execution completed but with failure status
            current = current.updateStep(step.key, (s) => ({
              ...s,
              status: 'failed',
              error: stepResult.error || 'Step returned success=false',
              completedAt: Date.now(),
            }));

            // Check if we should continue on error
            if (!(step as any).continueOnError) {
              throw new Error(`Step ${step.key} failed: ${stepResult.error || 'Unknown error'}`);
            }

            continue; // Skip to next step
          }

          // Step succeeded - store result
          stepResults[step.key] = stepResult.result;

          // Update step state in machine: pending -> running -> completed
          current = current.updateStep(step.key, (s) => ({
            ...s,
            status: 'completed',
            result: stepResult.result as Record<string, string>,
            completedAt: Date.now(),
          }));
        } else {
          // Promise rejected - step failed
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);

          current = current.updateStep(step.key, (s) => ({
            ...s,
            status: 'failed',
            error,
            completedAt: Date.now(),
          }));

          // Check if we should continue on error (optional property)
          if (!(step as any).continueOnError) {
            throw new Error(`Step ${step.key} failed: ${error}`);
          }
        }
      }

      // Create checkpoint after level completion
      await this.checkpointService.createCheckpoint(executionId, current, context);
    }

    return current;
  }

  /**
   * Execute a single step using WorkflowAgentBridge
   *
   * Routes the step to appropriate agent based on step type and @agent directive.
   * Falls back to simulated execution if no agent can handle the step.
   */
  private async executeStepWithAgent(
    step: any,
    context: WorkflowContext,
    stepResults: Record<string, unknown>,
    machine: WorkflowStateMachineBridge
  ): Promise<StepResult> {
    const startTime = Date.now();

    // Mark step as running in machine
    const updatedMachine = machine.updateStep(step.key, (s) => ({
      ...s,
      status: 'running',
      startedAt: Date.now(),
    }));

    try {
      // Try to execute with agent
      const result = await this.agentBridge.executeStep(step, {
        ...context,
        stepResults, // Pass previous step results
      });

      return {
        stepKey: step.key,
        success: true,
        result: result.output,
        duration: Date.now() - startTime,
        retries: 0,
      };
    } catch (error) {
      // Fixed: Implement retry logic with exponential backoff
      const maxRetries = step.retries || 0;
      let lastError = error;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Exponential backoff: 2^attempt * 100ms (100ms, 200ms, 400ms, 800ms, ...)
        const backoffMs = Math.min(Math.pow(2, attempt) * 100, 5000); // Cap at 5 seconds
        await new Promise(resolve => setTimeout(resolve, backoffMs));

        try {
          const result = await this.agentBridge.executeStep(step, {
            ...context,
            stepResults,
          });

          return {
            stepKey: step.key,
            success: true,
            result: result.output,
            duration: Date.now() - startTime,
            retries: attempt,
          };
        } catch (retryError) {
          lastError = retryError;
          // Continue to next retry
        }
      }

      // All retries exhausted
      return {
        stepKey: step.key,
        success: false,
        error: lastError instanceof Error ? lastError.message : String(lastError),
        duration: Date.now() - startTime,
        retries: maxRetries,
      };
    }
  }

  /**
   * Get workflow execution summary
   */
  getExecutionSummary(executionId: string): WorkflowExecutionSummary | null {
    const execution = this.dao.getExecutionById(executionId);
    if (!execution) {
      return null;
    }

    const workflow = this.dao.getWorkflowById(execution.workflowId);
    if (!workflow) {
      return null;
    }

    const workflowDef = parseWorkflowDefinition(workflow.definition);

    return {
      executionId: execution.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      state: execution.state,
      startedAt: execution.startedAt ?? undefined,
      completedAt: execution.completedAt ?? undefined,
      duration: execution.durationMs ?? undefined,
      stepsCompleted: 0, // TODO: Query from step results
      stepsFailed: 0, // TODO: Query from step results
      stepsTotal: workflowDef.steps.length,
      error: execution.error ?? undefined,
    };
  }

  /**
   * List all workflow executions
   */
  listExecutions(limit: number = 100, offset: number = 0): WorkflowExecution[] {
    // DAO listActiveExecutions doesn't support pagination yet
    // For now, just return active executions (TODO: add pagination to DAO)
    return this.dao.listActiveExecutions();
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | null {
    return this.dao.getExecutionById(executionId);
  }
}
