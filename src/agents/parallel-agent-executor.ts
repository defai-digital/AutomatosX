/**
 * Parallel Agent Executor
 *
 * Executes agents in parallel based on dependency graph analysis.
 * Supports partial failure handling and graceful cancellation.
 */

import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { logger } from '../shared/logging/logger.js';
import type { AgentProfile, ExecutionContext } from '../types/agent.js';
import type { DelegationResult } from '../types/orchestration.js';
import { DependencyGraphBuilder, type DependencyGraph, type AgentNode } from './dependency-graph.js';
import { ExecutionPlanner, type ExecutionPlan } from './execution-planner.js';
import { AgentExecutor } from './executor.js';

export interface TimelineEntry {
  agentName: string;
  displayName?: string;  // Human-friendly name (e.g., "Bob", "Eric")
  startTime: number;
  endTime: number;
  duration: number;
  level: number;
  status: 'completed' | 'failed' | 'skipped' | 'cancelled';
  error?: string;
}

export interface ParallelExecutionResult {
  success: boolean;
  completedAgents: string[];
  failedAgents: string[];
  skippedAgents: string[];
  timeline: TimelineEntry[];
  totalDuration: number;
  graph?: DependencyGraph;
  plan?: ExecutionPlan;
}

export interface ParallelExecutionOptions {
  continueOnFailure?: boolean;
  maxConcurrentAgents?: number;  // DEPRECATED: use concurrency
  concurrency?: import('../types/config.js').ConcurrencyConfig;  // v5.6.18: Advanced concurrency control
  signal?: AbortSignal;
  timeout?: number;
}

export class ParallelAgentExecutor {
  private graphBuilder: DependencyGraphBuilder;
  private planner: ExecutionPlanner;
  private agentExecutor: AgentExecutor;
  private abortController?: AbortController;

  constructor() {
    this.graphBuilder = new DependencyGraphBuilder();
    this.planner = new ExecutionPlanner();
    this.agentExecutor = new AgentExecutor();
  }

  /**
   * Execute agents in parallel based on dependency graph
   */
  async execute(
    agents: AgentProfile[],
    context: ExecutionContext,
    options: ParallelExecutionOptions = {}
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const timeline: TimelineEntry[] = [];

    // Build dependency graph
    logger.info('Building dependency graph', { agentCount: agents.length });
    const graph = this.graphBuilder.buildGraph(agents);

    // Detect cycles
    try {
      this.graphBuilder.detectCycles(graph);
    } catch (error) {
      logger.error('Circular dependency detected', { error: (error as Error).message });
      throw error;
    }

    // Create execution plan
    // v5.6.18: Pass concurrency config if available, fallback to legacy maxConcurrentAgents
    const plan = this.planner.createExecutionPlan(graph, {
      concurrency: options.concurrency,
      maxConcurrentAgents: options.maxConcurrentAgents
    });

    logger.info('Execution plan created', {
      levels: plan.levels.length,
      totalAgents: plan.totalAgents,
      maxConcurrency: plan.maxConcurrency
    });

    // Setup cancellation
    let abortHandler: (() => void) | undefined;
    if (options.signal) {
      this.abortController = new AbortController();
      abortHandler = () => {
        logger.warn('Execution cancellation requested');
        this.abortController?.abort();
      };
      options.signal.addEventListener('abort', abortHandler);
    }

    // Execute level by level
    const results = new Map<string, any>();
    const continueOnFailure = options.continueOnFailure ?? true;

    try {
      for (const level of plan.levels) {
        logger.info('Executing level', {
          level: level.level,
          agents: level.agents.length,
          mode: level.executionMode
        });

        // Check for cancellation
        if (this.abortController?.signal.aborted) {
          logger.warn('Execution cancelled', { level: level.level });
          this.markRemainingAsCancelled(graph, level.level, timeline);
          break;
        }

        // Execute batches for this level
        for (const batch of level.parallelBatches) {
          // Check for cancellation before each batch
          if (this.abortController?.signal.aborted) {
            this.markBatchAsCancelled(batch, graph, timeline, startTime);
            break;
          }

          if (level.executionMode === 'parallel') {
            // Execute batch in parallel
            await this.executeBatchParallel(batch, graph, context, options, results, timeline, startTime);
          } else {
            // Execute batch sequentially
            await this.executeBatchSequential(batch, graph, context, options, results, timeline, startTime);
          }

          // Check if we should stop due to failures
          if (!continueOnFailure && this.hasFailures(batch, graph)) {
            logger.warn('Stopping execution due to failures', {
              continueOnFailure,
              level: level.level
            });
            this.markRemainingAsSkipped(graph, level.level + 1, timeline);
            break;
          }
        }

        // Stop if we encountered failures and should not continue
        if (!continueOnFailure && this.hasLevelFailures(level.agents, graph)) {
          break;
        }
      }
    } catch (error) {
      logger.error('Execution failed', { error: (error as Error).message });
      throw error;
    } finally {
      // Cleanup: Remove abort signal listener
      if (abortHandler && options.signal) {
        options.signal.removeEventListener('abort', abortHandler);
      }
    }

    const totalDuration = Date.now() - startTime;

    // Build result
    const result = this.buildResult(graph, timeline, totalDuration);
    result.graph = graph;
    result.plan = plan;

    logger.info('Parallel execution completed', {
      success: result.success,
      completed: result.completedAgents.length,
      failed: result.failedAgents.length,
      skipped: result.skippedAgents.length,
      duration: totalDuration
    });

    return result;
  }

  /**
   * Execute a batch of agents in parallel
   */
  private async executeBatchParallel(
    batch: string[],
    graph: DependencyGraph,
    context: ExecutionContext,
    options: ParallelExecutionOptions,
    results: Map<string, any>,
    timeline: TimelineEntry[],
    executionStartTime: number
  ): Promise<void> {
    logger.info('Executing batch in parallel', { agents: batch });

    const promises = batch.map(async (agentName): Promise<TimelineEntry | null> => {
      const node = graph.nodes.get(agentName);
      if (!node) {
        return null;
      }

      // Check dependencies before execution
      if (!this.checkDependencies(node, results)) {
        node.status = 'skipped';
        // Return timeline entry instead of directly pushing (fixes race condition)
        const entry: TimelineEntry = {
          agentName,
          displayName: node.agent.displayName,
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          level: node.level,
          status: 'skipped',
          error: 'Dependencies not met'
        };
        return entry;
      }

      // Execute agent
      try {
        const result = await this.executeAgent(node, graph, context, options, timeline);
        results.set(agentName, result);
        return null;  // Timeline already updated in executeAgent
      } catch (error) {
        logger.error('Agent execution failed in parallel batch', {
          agent: agentName,
          error: (error as Error).message
        });
        // Mark dependents as skipped
        this.markDependentsAsSkipped(agentName, graph);
        return null;  // Timeline already updated in executeAgent error handler
      }
    });

    try {
      // Collect timeline entries from skipped agents
      const timelineEntries = await Promise.all(promises);

      // Batch update timeline (fixes race condition - single atomic operation)
      const entriesToAdd = timelineEntries.filter((entry): entry is TimelineEntry => entry !== null);
      if (entriesToAdd.length > 0) {
        timeline.push(...entriesToAdd);
      }
    } catch (error) {
      // Handle any unhandled rejections from parallel execution
      logger.error('Unhandled error in parallel batch execution', {
        batch,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Execute a batch of agents sequentially
   */
  private async executeBatchSequential(
    batch: string[],
    graph: DependencyGraph,
    context: ExecutionContext,
    options: ParallelExecutionOptions,
    results: Map<string, any>,
    timeline: TimelineEntry[],
    executionStartTime: number
  ): Promise<void> {
    logger.info('Executing batch sequentially', { agents: batch });

    for (const agentName of batch) {
      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        this.markBatchAsCancelled(batch.slice(batch.indexOf(agentName)), graph, timeline, executionStartTime);
        break;
      }

      const node = graph.nodes.get(agentName);
      if (!node) {
        continue;
      }

      // Check dependencies before execution
      if (!this.checkDependencies(node, results)) {
        node.status = 'skipped';
        timeline.push({
          agentName,
          displayName: node.agent.displayName,
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          level: node.level,
          status: 'skipped',
          error: 'Dependencies not met'
        });
        continue;
      }

      // Execute agent
      try {
        const result = await this.executeAgent(node, graph, context, options, timeline);
        results.set(agentName, result);
      } catch (error) {
        logger.error('Agent execution failed in sequential batch', {
          agent: agentName,
          error: (error as Error).message
        });
        // Mark dependents as skipped
        this.markDependentsAsSkipped(agentName, graph);
      }
    }
  }

  /**
   * Execute a single agent
   */
  private async executeAgent(
    node: AgentNode,
    graph: DependencyGraph,
    context: ExecutionContext,
    options: ParallelExecutionOptions,
    timeline: TimelineEntry[]
  ): Promise<any> {
    const startTime = Date.now();
    const agentName = node.agentName;

    logger.info('Agent execution started', { agent: agentName, level: node.level });
    node.status = 'running';

    try {
      // Get the agent profile from the node
      const agent = node.agent;

      // Create execution context for this specific agent
      const agentContext: ExecutionContext = {
        ...context,
        agent,
        task: context.task || `Execute ${agentName}`
      };

      // Execute agent through provider
      const response = await context.provider.execute({
        prompt: agentContext.task,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        signal: options.signal
      });

      // Validate response (v5.6.7 fix: prevent undefined.content errors)
      if (!response) {
        throw new Error('Provider returned undefined response');
      }

      // Create complete DelegationResult structure (Issue #5 fix)
      const endTime = Date.now();
      const result: DelegationResult = {
        delegationId: randomUUID(),
        fromAgent: context.agent.name,
        toAgent: agentName,
        task: agentContext.task,
        status: 'success',
        success: true,
        response: {
          content: response.content,
          model: response.model,
          tokensUsed: response.tokensUsed,
          latencyMs: response.latencyMs,
          finishReason: response.finishReason,
          cached: response.cached || false
        },
        duration: endTime - startTime,
        outputs: {
          files: [],  // TODO(v5.7.0): Track file creation in parallel execution (requires workspace monitoring)
          memoryIds: [],  // TODO(v5.7.0): Track memory entries created during execution
          workspacePath: context.agentWorkspace || ''
        },
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      };

      node.status = 'completed';
      node.result = result;

      timeline.push({
        agentName,
        displayName: node.agent.displayName,
        startTime,
        endTime,
        duration: endTime - startTime,
        level: node.level,
        status: 'completed'
      });

      logger.info('Agent execution completed', {
        agent: agentName,
        duration: endTime - startTime
      });

      return result;
    } catch (error) {
      const endTime = Date.now();
      node.status = 'failed';

      timeline.push({
        agentName,
        displayName: node.agent.displayName,
        startTime,
        endTime,
        duration: endTime - startTime,
        level: node.level,
        status: 'failed',
        error: (error as Error).message
      });

      logger.error('Agent execution failed', {
        agent: agentName,
        error: (error as Error).message
      });

      throw error;
    }
  }

  /**
   * Check if all dependencies have completed successfully
   */
  private checkDependencies(node: AgentNode, results: Map<string, any>): boolean {
    for (const dep of node.dependencies) {
      const depResult = results.get(dep);
      if (!depResult || !depResult.success) {
        logger.info('Agent skipped due to failed dependency', {
          agent: node.agentName,
          dependency: dep
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Mark all dependents of a failed agent as skipped
   */
  private markDependentsAsSkipped(agentName: string, graph: DependencyGraph): void {
    const dependents = graph.adjacencyList.get(agentName) || [];

    logger.info('Marking dependents as skipped', {
      agent: agentName,
      dependents: dependents.length
    });

    for (const dependent of dependents) {
      const node = graph.nodes.get(dependent);
      if (node && node.status === 'pending') {
        node.status = 'skipped';
        logger.info('Agent marked as skipped', { agent: dependent, reason: `Dependency ${agentName} failed` });
        // Recursively mark dependents
        this.markDependentsAsSkipped(dependent, graph);
      }
    }
  }

  /**
   * Mark remaining agents as cancelled
   */
  private markRemainingAsCancelled(graph: DependencyGraph, fromLevel: number, timeline: TimelineEntry[]): void {
    const now = Date.now();

    for (const node of graph.nodes.values()) {
      if (node.level >= fromLevel && node.status === 'pending') {
        node.status = 'skipped';
        timeline.push({
          agentName: node.agentName,
          displayName: node.agent.displayName,
          startTime: now,
          endTime: now,
          duration: 0,
          level: node.level,
          status: 'cancelled'
        });
      }
    }
  }

  /**
   * Mark batch as cancelled
   */
  private markBatchAsCancelled(
    batch: string[],
    graph: DependencyGraph,
    timeline: TimelineEntry[],
    executionStartTime: number
  ): void {
    const now = Date.now();

    for (const agentName of batch) {
      const node = graph.nodes.get(agentName);
      if (node && node.status === 'pending') {
        node.status = 'skipped';
        timeline.push({
          agentName,
          displayName: node.agent.displayName,
          startTime: now,
          endTime: now,
          duration: 0,
          level: node.level,
          status: 'cancelled'
        });
      }
    }
  }

  /**
   * Mark remaining agents as skipped
   */
  private markRemainingAsSkipped(graph: DependencyGraph, fromLevel: number, timeline: TimelineEntry[]): void {
    const now = Date.now();

    for (const node of graph.nodes.values()) {
      if (node.level >= fromLevel && node.status === 'pending') {
        node.status = 'skipped';
        timeline.push({
          agentName: node.agentName,
          displayName: node.agent.displayName,
          startTime: now,
          endTime: now,
          duration: 0,
          level: node.level,
          status: 'skipped',
          error: 'Previous level failed'
        });
      }
    }
  }

  /**
   * Check if batch has failures
   */
  private hasFailures(batch: string[], graph: DependencyGraph): boolean {
    return batch.some(agentName => {
      const node = graph.nodes.get(agentName);
      return node?.status === 'failed';
    });
  }

  /**
   * Check if level has failures
   */
  private hasLevelFailures(agents: string[], graph: DependencyGraph): boolean {
    return agents.some(agentName => {
      const node = graph.nodes.get(agentName);
      return node?.status === 'failed';
    });
  }

  /**
   * Build execution result
   */
  private buildResult(
    graph: DependencyGraph,
    timeline: TimelineEntry[],
    totalDuration: number
  ): ParallelExecutionResult {
    const completed: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    for (const node of graph.nodes.values()) {
      if (node.status === 'completed') {
        completed.push(node.agentName);
      } else if (node.status === 'failed') {
        failed.push(node.agentName);
      } else if (node.status === 'skipped') {
        skipped.push(node.agentName);
      }
    }

    return {
      success: failed.length === 0,
      completedAgents: completed,
      failedAgents: failed,
      skippedAgents: skipped,
      timeline,
      totalDuration
    };
  }

  /**
   * Generate execution timeline visualization
   */
  visualizeTimeline(timeline: TimelineEntry[]): string {
    let output = '\n' + chalk.cyan('⏱️  Execution Timeline\n\n');

    if (timeline.length === 0) {
      output += chalk.gray('No agents executed\n\n');
      return output;
    }

    const maxLevel = Math.max(...timeline.map(t => t.level));
    const minStartTime = Math.min(...timeline.map(t => t.startTime));
    const maxEndTime = Math.max(...timeline.map(t => t.endTime));
    const totalDuration = maxEndTime - minStartTime;

    // v6.2.9: Bug fix #36 - Prevent division by zero when all agents complete in same millisecond
    // If totalDuration is 0, all agents finished instantly - use uniform bar lengths
    const safeTotalDuration = Math.max(1, totalDuration);

    for (let level = 0; level <= maxLevel; level++) {
      const entriesAtLevel = timeline.filter(t => t.level === level);

      if (entriesAtLevel.length === 0) {
        continue;
      }

      output += chalk.gray(`Level ${level}:\n`);

      for (const entry of entriesAtLevel) {
        const barLength = Math.max(1, Math.floor((entry.duration / safeTotalDuration) * 40));
        const bar = '█'.repeat(barLength);

        let statusColor = chalk.green;
        let statusIcon = '✓';

        if (entry.status === 'failed') {
          statusColor = chalk.red;
          statusIcon = '✗';
        } else if (entry.status === 'skipped') {
          statusColor = chalk.yellow;
          statusIcon = '⊘';
        } else if (entry.status === 'cancelled') {
          statusColor = chalk.gray;
          statusIcon = '⊗';
        }

        // Display as "Name (role)" e.g., "Bob (backend)"
        const displayText = entry.displayName
          ? `${entry.displayName} (${entry.agentName})`
          : entry.agentName;
        const name = displayText.padEnd(30);
        const durationInSeconds = (entry.duration / 1000).toFixed(2);
        const duration = `${durationInSeconds}s`;

        output += `  ${statusIcon} ${name} ${statusColor(bar)} ${duration}\n`;

        if (entry.error) {
          output += chalk.red(`     └─ Error: ${entry.error}\n`);
        }
      }

      output += '\n';
    }

    const totalDurationInSeconds = (totalDuration / 1000).toFixed(2);
    output += chalk.gray(`Total Duration: ${totalDurationInSeconds}s\n\n`);

    return output;
  }
}
