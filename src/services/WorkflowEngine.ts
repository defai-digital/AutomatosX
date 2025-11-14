/**
 * WorkflowEngine.ts
 *
 * Orchestrate workflow execution with state machine management
 * Phase 4 Week 2: Workflow Engine & Orchestration
 */

import { WorkflowDAO } from '../database/dao/WorkflowDAO.js';
import { WorkflowParser } from './WorkflowParser.js';
import { CheckpointService } from './CheckpointService.js';
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
// Phase 5: Performance optimization imports
import { WorkflowOptimizer, OptimizationStrategy } from '../optimization/WorkflowOptimizer.js';
import { WorkflowCache } from '../cache/WorkflowCache.js';

/**
 * Step execution result
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
 * Workflow execution summary
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
 * WorkflowEngine - Orchestrate workflow execution
 */
export class WorkflowEngine {
  private dao: WorkflowDAO;
  private parser: WorkflowParser;
  private checkpointService: CheckpointService;
  private db: Database.Database;
  // Phase 5: Performance optimization
  private optimizer: WorkflowOptimizer;
  private cache: WorkflowCache;

  constructor(db?: Database.Database, cache?: WorkflowCache) {
    this.db = db || getDatabase();
    this.dao = new WorkflowDAO(this.db);
    this.parser = new WorkflowParser();
    this.checkpointService = new CheckpointService(this.db);
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
   * Execute a workflow from definition
   */
  async executeWorkflow(
    workflowDef: WorkflowDefinition,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowResult> {
    // Validate workflow
    const validation = this.parser.validate(workflowDef);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }

    // Get or create workflow in database
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

    // Create execution
    const execution = this.dao.createExecution({
      workflowId: workflow.id,
      context: options.context,
      triggeredBy: options.triggeredBy,
      priority: options.priority ?? 0,
      parentExecutionId: options.parentExecutionId,
    });

    // Log start event
    this.dao.logEvent({
      executionId: execution.id,
      eventType: 'workflow_started',
      eventData: {
        workflowName: workflowDef.name,
        triggeredBy: options.triggeredBy,
      },
    });

    // Build dependency graph
    const graph = this.parser.buildDependencyGraph(workflowDef);

    // Execute workflow
    try {
      const result = await this.runWorkflow(execution.id, workflowDef, graph, options.context || {});
      return result;
    } catch (error) {
      // Log error and update execution
      this.dao.updateExecutionState(execution.id, 'failed', error instanceof Error ? error.message : String(error));
      this.dao.logEvent({
        executionId: execution.id,
        eventType: 'workflow_failed',
        eventData: {
          error: error instanceof Error ? error.message : String(error),
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
   * Resume workflow execution from checkpoint
   */
  async resumeWorkflow(checkpointId: string): Promise<WorkflowResult> {
    // Restore checkpoint
    const restored = await this.checkpointService.restoreCheckpoint(checkpointId);

    // Get execution
    const execution = this.dao.getExecutionById(restored.checkpoint.executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${restored.checkpoint.executionId}`);
    }

    // Get workflow
    const workflow = this.dao.getWorkflowById(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    // Parse workflow definition
    const workflowDef = parseWorkflowDefinition(workflow.definition);

    // Build dependency graph
    const graph = this.parser.buildDependencyGraph(workflowDef);

    // Update execution state
    this.dao.updateExecutionState(execution.id, 'executing');
    this.dao.incrementResumeCount(execution.id);

    // Log resume event
    this.dao.logEvent({
      executionId: execution.id,
      eventType: 'workflow_resumed',
      eventData: {
        checkpointId,
        completedSteps: restored.completedSteps.length,
        pendingSteps: restored.pendingSteps.length,
      },
    });

    // Continue execution from where we left off
    return this.runWorkflow(
      execution.id,
      workflowDef,
      graph,
      restored.context,
      restored.completedSteps
    );
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(executionId: string): Promise<void> {
    // Get execution
    const execution = this.dao.getExecutionById(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Check if execution can be paused
    if (isTerminalState(execution.state)) {
      throw new Error(`Cannot pause execution in terminal state: ${execution.state}`);
    }

    // Update state
    this.dao.updateExecutionState(executionId, 'paused');

    // Log pause event
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
    // Get execution
    const execution = this.dao.getExecutionById(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Check if execution can be cancelled
    if (isTerminalState(execution.state)) {
      throw new Error(`Cannot cancel execution in terminal state: ${execution.state}`);
    }

    // Update state
    this.dao.updateExecutionState(executionId, 'cancelled');

    // Log cancel event
    this.dao.logEvent({
      executionId,
      eventType: 'workflow_cancelled',
      eventData: {},
    });
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<WorkflowExecutionSummary> {
    const execution = this.dao.getExecutionById(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const workflow = this.dao.getWorkflowById(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    const stepExecutions = this.dao.listStepExecutions(executionId);
    const stepsCompleted = stepExecutions.filter(s => s.state === 'completed').length;
    const stepsFailed = stepExecutions.filter(s => s.state === 'failed').length;

    const workflowDef = parseWorkflowDefinition(workflow.definition);

    return {
      executionId: execution.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      state: execution.state,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: execution.durationMs,
      stepsCompleted,
      stepsFailed,
      stepsTotal: workflowDef.steps.length,
      error: execution.error,
    };
  }

  /**
   * Internal: Run workflow execution
   */
  private async runWorkflow(
    executionId: string,
    workflowDef: WorkflowDefinition,
    graph: DependencyGraph,
    context: WorkflowContext,
    completedSteps: string[] = []
  ): Promise<WorkflowResult> {
    // Update execution state to executing
    this.dao.updateExecutionState(executionId, 'executing');

    const stepResults: Record<string, unknown> = {};
    const failedSteps: string[] = [];

    // Execute steps level by level (enables parallel execution within levels)
    for (const level of graph.levels) {
      // Filter out already completed steps
      const stepsToExecute = level.filter(stepKey => !completedSteps.includes(stepKey));

      if (stepsToExecute.length === 0) {
        continue; // Skip this level if all steps are already completed
      }

      // Get step definitions
      const steps = stepsToExecute.map(stepKey =>
        workflowDef.steps.find(s => s.key === stepKey)!
      );

      // Execute steps in parallel (within this level)
      const results = await Promise.allSettled(
        steps.map(step => this.executeStep(executionId, step, context, stepResults))
      );

      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const step = steps[i];

        if (result.status === 'fulfilled') {
          const stepResult = result.value;
          stepResults[step.key] = stepResult.result;
          completedSteps.push(step.key);
        } else {
          // Step failed
          failedSteps.push(step.key);

          // If step is not optional, fail the workflow
          if (!step.optional) {
            this.dao.updateExecutionState(executionId, 'failed', result.reason);
            this.dao.logEvent({
              executionId,
              eventType: 'workflow_failed',
              eventData: {
                failedStep: step.key,
                error: result.reason,
              },
            });

            throw new Error(`Workflow failed at step "${step.key}": ${result.reason}`);
          }
        }
      }

      // Create checkpoint after each level
      await this.checkpointService.createAutomaticCheckpoint(
        executionId,
        'executing',
        { ...context, ...stepResults },
        completedSteps,
        graph.topologicalOrder.filter(key => !completedSteps.includes(key))
      );
    }

    // All steps completed successfully
    this.dao.updateExecutionState(executionId, 'completed');
    this.dao.updateExecutionContext(executionId, { ...context, ...stepResults });

    this.dao.logEvent({
      executionId,
      eventType: 'workflow_completed',
      eventData: {
        stepsCompleted: completedSteps.length,
        stepsFailed: failedSteps.length,
      },
    });

    const execution = this.dao.getExecutionById(executionId)!;
    const workflow = this.dao.getWorkflowById(execution.workflowId)!;

    return {
      executionId: execution.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      state: execution.state,
      context: { ...context, ...stepResults },
      stepResults,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
    };
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    executionId: string,
    step: WorkflowDefinition['steps'][0],
    context: WorkflowContext,
    stepResults: Record<string, unknown>
  ): Promise<StepResult> {
    const startTime = Date.now();

    // Create step execution record
    const stepExecution = this.dao.createStepExecution({
      executionId,
      stepId: randomUUID(), // TODO: Link to actual step_id from workflow_steps table
      state: 'pending',
      agentUsed: step.agent,
    });

    // Update to running
    this.dao.updateStepExecutionState(stepExecution.id, 'running');

    // Log step start event
    this.dao.logEvent({
      executionId,
      eventType: 'step_started',
      eventData: {
        stepKey: step.key,
        agent: step.agent,
      },
    });

    try {
      // Render prompt with context
      const prompt = this.parser.renderPrompt(step.prompt, { ...context, ...stepResults });

      // TODO: Route to appropriate agent/provider
      // For now, simulate step execution
      const result = await this.simulateStepExecution(step, prompt);

      // Update step execution to completed
      this.dao.updateStepExecutionState(stepExecution.id, 'completed', result);

      // Log step completion event
      this.dao.logEvent({
        executionId,
        eventType: 'step_completed',
        eventData: {
          stepKey: step.key,
          duration: Date.now() - startTime,
        },
      });

      return {
        stepKey: step.key,
        success: true,
        result,
        duration: Date.now() - startTime,
        retries: 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update step execution to failed
      this.dao.updateStepExecutionState(stepExecution.id, 'failed', undefined, errorMessage);

      // Log step failure event
      this.dao.logEvent({
        executionId,
        eventType: 'step_failed',
        eventData: {
          stepKey: step.key,
          error: errorMessage,
          duration: Date.now() - startTime,
        },
      });

      throw error;
    }
  }

  /**
   * Simulate step execution (placeholder for actual agent routing)
   */
  private async simulateStepExecution(
    step: WorkflowDefinition['steps'][0],
    prompt: string
  ): Promise<unknown> {
    // TODO: Replace with actual agent routing and provider calls
    // For now, return a simulated result
    return {
      stepKey: step.key,
      agent: step.agent,
      prompt,
      result: `Simulated result for step "${step.key}"`,
      timestamp: Date.now(),
    };
  }
}
