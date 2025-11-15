/**
 * AgentBase.ts
 *
 * Base class for all AI agents
 * Phase 7: Agent System Implementation - Day 1
 */

import { EventEmitter } from 'events';
import {
  AgentMetadata,
  AgentContext,
  Task,
  TaskResult,
  AgentExecutionOptions,
  TaskStatus,
} from '../types/agents.types.js';

/**
 * AgentBase - Abstract base class for all agents
 *
 * Provides:
 * - Standard execution interface
 * - Context management
 * - Error handling and retry logic
 * - Event emission for monitoring
 */
export abstract class AgentBase extends EventEmitter {
  protected metadata: AgentMetadata;

  constructor(metadata: AgentMetadata) {
    super();
    this.metadata = metadata;
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return this.metadata;
  }

  /**
   * Execute a task
   * This is the main entry point for agent execution
   */
  async execute(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    const maxRetries = options?.maxRetries ?? 3;
    const timeout = options?.timeout ?? 300000; // 5 minutes default

    this.emit('task.started', { agent: this.metadata.type, task });

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
      try {
        // Start trace
        const traceId = context.monitoring.startTrace();
        const spanId = context.monitoring.startSpan(traceId, `agent.${this.metadata.type}`);

        // Execute with timeout
        const result = await this.executeWithTimeout(task, context, options, timeout);

        // Complete trace
        context.monitoring.completeSpan(spanId);

        // Record success metric
        context.monitoring.recordMetric('agent.task.success', 1);

        this.emit('task.completed', { agent: this.metadata.type, task, result });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        context.monitoring.log('error', `Agent execution failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    context.monitoring.recordMetric('agent.task.failure', 1);

    const errorResult: TaskResult = {
      success: false,
      message: `Task failed after ${maxRetries} attempts: ${lastError?.message}`,
    };

    this.emit('task.failed', { agent: this.metadata.type, task, error: lastError });

    return errorResult;
  }

  /**
   * Execute task with timeout
   */
  private async executeWithTimeout(
    task: Task,
    context: AgentContext,
    options: AgentExecutionOptions | undefined,
    timeoutMs: number
  ): Promise<TaskResult> {
    // Fixed: Clear timeout to prevent memory leak
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<TaskResult>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Task execution timeout')), timeoutMs);
    });

    try {
      return await Promise.race([
        this.executeTask(task, context, options),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  /**
   * Execute task (implemented by subclasses)
   */
  protected abstract executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult>;

  /**
   * Build prompt for AI provider
   */
  protected buildPrompt(task: Task, context: AgentContext): string {
    const systemPrompt = this.getSystemPrompt();
    const taskPrompt = this.getTaskPrompt(task);
    const contextPrompt = this.getContextPrompt(context);

    return `${systemPrompt}\n\n${taskPrompt}\n\n${contextPrompt}`;
  }

  /**
   * Get system prompt (describes agent role and capabilities)
   */
  protected getSystemPrompt(): string {
    return `You are ${this.metadata.name}, a specialized AI agent.

Role: ${this.metadata.description}

Capabilities:
${this.metadata.capabilities.map((c) => `- ${c.name}: ${c.description}`).join('\n')}

Specializations:
${this.metadata.specializations.map((s) => `- ${s}`).join('\n')}

You have access to:
- Memory system (search past conversations and decisions)
- Code intelligence (search code, analyze symbols, call graphs)
- Delegation (assign tasks to other specialized agents)
- Monitoring (record metrics, traces, logs)

Provide concise, actionable responses. If a task requires expertise outside your specialization, suggest delegation to the appropriate agent.`;
  }

  /**
   * Get task prompt
   */
  protected getTaskPrompt(task: Task): string {
    return `Task: ${task.description}

Priority: ${task.priority}
${task.context ? `\nContext:\n${JSON.stringify(task.context, null, 2)}` : ''}
${task.dependencies ? `\nDepends on: ${task.dependencies.join(', ')}` : ''}`;
  }

  /**
   * Get context prompt (additional context from memory, code, etc.)
   */
  protected getContextPrompt(context: AgentContext): string {
    // Subclasses can override to add more context
    return '';
  }

  /**
   * Call AI provider
   */
  protected async callProvider(
    prompt: string,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<string> {
    try {
      const response = await context.provider.call(prompt, {
        temperature: options?.temperature ?? this.metadata.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? this.metadata.maxTokens ?? 4000,
      });

      return response;
    } catch (error) {
      context.monitoring.log('error', `Provider call failed: ${error}`);
      throw error;
    }
  }

  /**
   * Check if task matches agent capabilities
   */
  canHandle(task: Task): number {
    const keywords = this.metadata.capabilities.flatMap((c) => c.keywords);
    const taskLower = task.description.toLowerCase();

    let score = 0;

    // Check keyword matches
    for (const keyword of keywords) {
      if (taskLower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Check specialization matches
    for (const spec of this.metadata.specializations) {
      if (taskLower.includes(spec.toLowerCase())) {
        score += 2; // Higher weight for specializations
      }
    }

    // Normalize to 0-1 range
    return Math.min(score / 10, 1);
  }

  /**
   * Suggest delegation if task is outside specialization
   */
  protected suggestDelegation(task: Task): string | null {
    const taskLower = task.description.toLowerCase();

    // Simple heuristic - subclasses can override for more sophisticated logic
    if (taskLower.includes('frontend') || taskLower.includes('ui') || taskLower.includes('react')) {
      return 'frontend';
    }
    if (taskLower.includes('backend') || taskLower.includes('api') || taskLower.includes('database')) {
      return 'backend';
    }
    if (taskLower.includes('security') || taskLower.includes('vulnerability')) {
      return 'security';
    }
    if (taskLower.includes('test') || taskLower.includes('qa')) {
      return 'quality';
    }
    if (taskLower.includes('devops') || taskLower.includes('deploy') || taskLower.includes('ci/cd')) {
      return 'devops';
    }

    return null;
  }
}
