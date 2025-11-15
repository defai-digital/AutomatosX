/**
 * AgentCollaborator.ts
 * Multi-agent workflow orchestration
 * Phase 7: Agent System Implementation - Day 4
 */

import { EventEmitter } from 'events';
import { AgentRegistry } from './AgentRegistry.js';
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, TaskStatus, AgentType } from '../types/agents.types.js';

export interface SubTask {
  id: string;
  description: string;
  agentType: AgentType;  // Fixed: Use AgentType enum instead of string for type safety
  dependsOn?: string[]; // IDs of tasks that must complete first
  priority: number; // Higher = more important
  status: TaskStatus;
  result?: TaskResult;
}

export interface WorkflowResult {
  success: boolean;
  subtasks: SubTask[];
  aggregatedResult: TaskResult;
  executionTime: number;
  strategy: 'sequential' | 'parallel';
}

export type WorkflowStrategy = 'sequential' | 'parallel' | 'auto';

export class AgentCollaborator extends EventEmitter {
  constructor(private registry: AgentRegistry) {
    super();
  }

  /**
   * Execute a complex task that requires multiple agents
   */
  async collaborate(
    task: Task,
    context: AgentContext,
    strategy: WorkflowStrategy = 'auto'
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    this.emit('collaboration:start', { task, strategy });

    try {
      // Decompose task into subtasks
      const subtasks = await this.decomposeTask(task, context);
      this.emit('collaboration:decomposed', { subtasks });

      // Determine execution strategy
      const executionStrategy = strategy === 'auto' ? this.determineStrategy(subtasks) : strategy;
      this.emit('collaboration:strategy', { strategy: executionStrategy });

      // Execute workflow
      const executedSubtasks = await this.executeWorkflow(subtasks, executionStrategy, context);

      // Aggregate results
      const aggregatedResult = await this.aggregateResults(executedSubtasks, context);

      const result: WorkflowResult = {
        success: true,
        subtasks: executedSubtasks,
        aggregatedResult,
        executionTime: Date.now() - startTime,
        strategy: executionStrategy,
      };

      this.emit('collaboration:complete', result);
      return result;
    } catch (error) {
      this.emit('collaboration:error', { task, error });
      throw error;
    }
  }

  /**
   * Decompose a complex task into subtasks
   */
  async decomposeTask(task: Task, context: AgentContext): Promise<SubTask[]> {
    const description = task.description.toLowerCase();
    const subtasks: SubTask[] = [];

    // Check for database/schema keywords
    if (this.containsKeywords(description, ['database', 'schema', 'table', 'sql', 'query'])) {
      subtasks.push({
        id: `subtask-${Date.now()}-db`,
        description: 'Design database schema and queries',
        agentType: 'database',
        priority: 10,
        status: 'pending' as TaskStatus,
      });
    }

    // Check for API keywords
    if (this.containsKeywords(description, ['api', 'endpoint', 'rest', 'graphql', 'route'])) {
      subtasks.push({
        id: `subtask-${Date.now()}-api`,
        description: 'Design and implement API endpoints',
        agentType: 'api',
        dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
        priority: 9,
        status: 'pending' as TaskStatus,
      });
    }

    // Check for security keywords
    if (this.containsKeywords(description, ['security', 'auth', 'authentication', 'authorization', 'secure'])) {
      subtasks.push({
        id: `subtask-${Date.now()}-sec`,
        description: 'Implement security and authentication',
        agentType: 'security',
        dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
        priority: 8,
        status: 'pending' as TaskStatus,
      });
    }

    // Check for testing keywords
    if (this.containsKeywords(description, ['test', 'testing', 'tests', 'coverage', 'quality'])) {
      subtasks.push({
        id: `subtask-${Date.now()}-test`,
        description: 'Write comprehensive tests',
        agentType: 'quality',
        dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
        priority: 7,
        status: 'pending' as TaskStatus,
      });
    }

    // Check for documentation keywords
    if (this.containsKeywords(description, ['document', 'documentation', 'docs', 'readme'])) {
      subtasks.push({
        id: `subtask-${Date.now()}-doc`,
        description: 'Write documentation',
        agentType: 'writer',
        dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
        priority: 6,
        status: 'pending' as TaskStatus,
      });
    }

    // If no specific subtasks identified, treat as single task
    if (subtasks.length === 0) {
      const agent = this.registry.findBestAgent(task);
      subtasks.push({
        id: `subtask-${Date.now()}-main`,
        description: task.description,
        agentType: agent?.getMetadata().type || 'backend',
        priority: 10,
        status: 'pending' as TaskStatus,
      });
    }

    return subtasks;
  }

  /**
   * Determine optimal execution strategy based on subtasks
   */
  private determineStrategy(subtasks: SubTask[]): 'sequential' | 'parallel' {
    // If any subtask has dependencies, must use sequential
    const hasDependencies = subtasks.some(st => st.dependsOn && st.dependsOn.length > 0);
    return hasDependencies ? 'sequential' : 'parallel';
  }

  /**
   * Execute workflow with given strategy
   */
  private async executeWorkflow(
    subtasks: SubTask[],
    strategy: 'sequential' | 'parallel',
    context: AgentContext
  ): Promise<SubTask[]> {
    if (strategy === 'sequential') {
      return this.executeSequential(subtasks, context);
    } else {
      return this.executeParallel(subtasks, context);
    }
  }

  /**
   * Execute subtasks sequentially (respects dependencies)
   */
  private async executeSequential(subtasks: SubTask[], context: AgentContext): Promise<SubTask[]> {
    const results = [...subtasks];

    for (const subtask of results) {
      // Wait for dependencies to complete
      if (subtask.dependsOn) {
        const dependenciesComplete = subtask.dependsOn.every(
          depId => results.find(st => st.id === depId)?.status === 'completed'
        );
        if (!dependenciesComplete) {
          subtask.status = 'failed' as TaskStatus;
          subtask.result = { success: false, message: 'Dependencies not met' };
          continue;
        }
      }

      // Execute subtask
      subtask.status = 'running' as TaskStatus;
      this.emit('subtask:start', subtask);

      try {
        const agent = this.registry.get(subtask.agentType);
        if (!agent) {
          throw new Error(`Agent not found: ${subtask.agentType}`);
        }

        const task: Task = {
          id: subtask.id,
          description: subtask.description,
          status: 'running' as TaskStatus,
          priority: 'medium' as const,
          createdAt: Date.now(),
        };

        subtask.result = await agent.execute(task, context);
        subtask.status = subtask.result.success ? ('completed' as TaskStatus) : ('failed' as TaskStatus);
        this.emit('subtask:complete', subtask);
      } catch (error) {
        subtask.status = 'failed' as TaskStatus;
        subtask.result = { success: false, message: `Subtask failed: ${error}` };
        this.emit('subtask:error', { subtask, error });
      }
    }

    return results;
  }

  /**
   * Execute subtasks in parallel (no dependencies)
   */
  private async executeParallel(subtasks: SubTask[], context: AgentContext): Promise<SubTask[]> {
    const results = [...subtasks];

    const promises = results.map(async (subtask) => {
      subtask.status = 'running' as TaskStatus;
      this.emit('subtask:start', subtask);

      try {
        const agent = this.registry.get(subtask.agentType);
        if (!agent) {
          throw new Error(`Agent not found: ${subtask.agentType}`);
        }

        const task: Task = {
          id: subtask.id,
          description: subtask.description,
          status: 'running' as TaskStatus,
          priority: 'medium' as const,
          createdAt: Date.now(),
        };

        subtask.result = await agent.execute(task, context);
        subtask.status = subtask.result.success ? ('completed' as TaskStatus) : ('failed' as TaskStatus);
        this.emit('subtask:complete', subtask);
      } catch (error) {
        subtask.status = 'failed' as TaskStatus;
        subtask.result = { success: false, message: `Subtask failed: ${error}` };
        this.emit('subtask:error', { subtask, error });
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Aggregate results from multiple agents
   */
  private async aggregateResults(subtasks: SubTask[], context: AgentContext): Promise<TaskResult> {
    const successfulSubtasks = subtasks.filter(st => st.status === 'completed' && st.result?.success);
    const failedSubtasks = subtasks.filter(st => st.status === 'failed' || !st.result?.success);

    if (successfulSubtasks.length === 0) {
      return {
        success: false,
        message: 'All subtasks failed',
        metadata: { subtasks, successCount: 0, failureCount: failedSubtasks.length },
      };
    }

    // Combine all successful results
    const combinedData: string[] = [];
    const allArtifacts: any[] = [];

    for (const subtask of successfulSubtasks) {
      if (subtask.result?.data) {
        combinedData.push(`\n### ${subtask.description}\n\n${subtask.result.data}`);
      }
      if (subtask.result?.artifacts) {
        allArtifacts.push(...subtask.result.artifacts);
      }
    }

    return {
      success: true,
      data: combinedData.join('\n'),
      artifacts: allArtifacts,
      metadata: {
        subtasks,
        successCount: successfulSubtasks.length,
        failureCount: failedSubtasks.length,
        agentsUsed: successfulSubtasks.map(st => st.agentType),
      },
    };
  }

  /**
   * Check if description contains any of the keywords
   */
  private containsKeywords(description: string, keywords: string[]): boolean {
    return keywords.some(keyword => description.includes(keyword));
  }
}
