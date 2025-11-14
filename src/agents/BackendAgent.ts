/**
 * BackendAgent.ts
 *
 * Backend development specialist
 * Phase 7: Agent System Implementation - Day 2
 */

import { AgentBase } from './AgentBase.js';
import {
  Task,
  TaskResult,
  AgentContext,
  AgentExecutionOptions,
  TaskArtifact,
} from '../types/agents.types.js';

/**
 * BackendAgent - Backend development specialist
 *
 * Specializes in:
 * - REST/GraphQL API design and implementation
 * - Database schema design and optimization
 * - Authentication and authorization
 * - Server-side business logic
 * - Microservices architecture
 */
export class BackendAgent extends AgentBase {
  constructor() {
    super({
      type: 'backend',
      name: 'Backend Specialist (Bob)',
      description:
        'Expert in backend development, API design, databases, authentication, and server-side architecture. Specializes in Node.js, Python, Go, and modern backend frameworks.',
      capabilities: [
        {
          name: 'API Design',
          description: 'Design and implement REST and GraphQL APIs',
          keywords: ['api', 'rest', 'graphql', 'endpoint', 'route', 'controller'],
        },
        {
          name: 'Database Design',
          description: 'Design schemas, write queries, optimize performance',
          keywords: ['database', 'sql', 'nosql', 'schema', 'query', 'postgres', 'mysql', 'mongodb'],
        },
        {
          name: 'Authentication',
          description: 'Implement authentication and authorization systems',
          keywords: ['auth', 'authentication', 'authorization', 'jwt', 'oauth', 'session', 'token'],
        },
        {
          name: 'Business Logic',
          description: 'Implement server-side business logic and data processing',
          keywords: ['business', 'logic', 'service', 'validation', 'processing'],
        },
        {
          name: 'Microservices',
          description: 'Design and implement microservices architecture',
          keywords: ['microservices', 'microservice', 'architecture', 'distributed', 'services'],
        },
      ],
      specializations: [
        'Node.js',
        'TypeScript',
        'Python',
        'Go',
        'Express',
        'FastAPI',
        'PostgreSQL',
        'MongoDB',
        'Redis',
        'Authentication',
        'API Design',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });
  }

  protected async executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    // 1. Check if task matches capabilities
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      const suggestion = this.suggestDelegation(task);
      return {
        success: false,
        message: `This task appears to be outside my backend specialization. Consider delegating to @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `Backend agent handling task: ${task.description}`);

    try {
      // 2. Gather relevant context
      const relevantCode = await this.gatherCodeContext(task, context);
      const pastSolutions = await this.gatherMemoryContext(task, context);

      // 3. Build enhanced prompt
      const prompt = this.buildEnhancedPrompt(task, context, relevantCode, pastSolutions);

      // 4. Call AI provider
      const response = await this.callProvider(prompt, context, options);

      // 5. Parse artifacts from response
      const artifacts = this.parseArtifacts(response);

      // 6. Store solution in memory for future reference
      await context.memory.store({
        type: 'agent_solution',
        agent: this.metadata.type,
        task: task.description,
        response,
        artifacts: artifacts.map((a) => ({ type: a.type, name: a.name })),
        timestamp: Date.now(),
      });

      context.monitoring.log('info', 'Backend agent completed task successfully');

      // 7. Return result
      return {
        success: true,
        data: response,
        artifacts,
        metadata: {
          agent: this.metadata.type,
          capabilityScore: capability,
          codeContextUsed: relevantCode.length > 0,
          memoryContextUsed: pastSolutions.length > 0,
        },
      };
    } catch (error) {
      context.monitoring.log('error', `Backend agent failed: ${error}`);
      throw error;
    }
  }

  /**
   * Gather relevant code context for the task
   */
  private async gatherCodeContext(task: Task, context: AgentContext): Promise<any[]> {
    try {
      // Extract potential symbols/functions from task description
      const keywords = this.extractKeywords(task.description);
      const codeResults: any[] = [];

      for (const keyword of keywords.slice(0, 3)) {
        // Limit to top 3 keywords
        const results = await context.codeIntelligence.searchCode(keyword);
        codeResults.push(...results.slice(0, 5)); // Top 5 results per keyword
      }

      return codeResults;
    } catch (error) {
      context.monitoring.log('warn', `Failed to gather code context: ${error}`);
      return [];
    }
  }

  /**
   * Gather relevant memory context for the task
   */
  private async gatherMemoryContext(task: Task, context: AgentContext): Promise<any[]> {
    try {
      const results = await context.memory.search(task.description);
      return results.slice(0, 5); // Top 5 past solutions
    } catch (error) {
      context.monitoring.log('warn', `Failed to gather memory context: ${error}`);
      return [];
    }
  }

  /**
   * Extract keywords from task description
   */
  private extractKeywords(description: string): string[] {
    const words = description.toLowerCase().split(/\s+/);
    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    return words.filter((w) => w.length > 3 && !stopWords.has(w)).slice(0, 5);
  }

  /**
   * Build enhanced prompt with context
   */
  private buildEnhancedPrompt(
    task: Task,
    context: AgentContext,
    codeContext: any[],
    memoryContext: any[]
  ): string {
    const basePrompt = this.buildPrompt(task, context);

    let enhancedPrompt = basePrompt;

    // Add code context if available
    if (codeContext.length > 0) {
      enhancedPrompt += '\n\nRelevant code from codebase:\n';
      codeContext.forEach((code, idx) => {
        enhancedPrompt += `\n${idx + 1}. ${JSON.stringify(code).slice(0, 200)}...\n`;
      });
    }

    // Add memory context if available
    if (memoryContext.length > 0) {
      enhancedPrompt += '\n\nPast similar solutions:\n';
      memoryContext.forEach((mem, idx) => {
        enhancedPrompt += `\n${idx + 1}. ${JSON.stringify(mem).slice(0, 200)}...\n`;
      });
    }

    enhancedPrompt += '\n\nProvide a complete, production-ready solution with:';
    enhancedPrompt += '\n1. Implementation code (use ```typescript, ```python, etc. code blocks)';
    enhancedPrompt += '\n2. Error handling and validation';
    enhancedPrompt += '\n3. Database queries if applicable';
    enhancedPrompt += '\n4. API endpoints if applicable';
    enhancedPrompt += '\n5. Brief explanation of approach';

    return enhancedPrompt;
  }

  /**
   * Parse artifacts (code blocks, files) from response
   */
  private parseArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];

    // Extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      artifacts.push({
        type: 'code',
        name: `code-block-${language}`,
        content: code,
        metadata: { language },
      });
    }

    // Extract file paths mentioned (common patterns: src/..., lib/..., app/...)
    const filePathRegex = /(?:src|lib|app|config)\/[\w\/-]+\.[\w]+/g;
    const filePaths = response.match(filePathRegex) || [];

    filePaths.forEach((path, idx) => {
      artifacts.push({
        type: 'file',
        name: `suggested-file-${idx + 1}`,
        path,
        metadata: { mentioned: true },
      });
    });

    return artifacts;
  }

  /**
   * Override context prompt to add backend-specific context
   */
  protected getContextPrompt(context: AgentContext): string {
    return `
Current Task Context:
- You have access to the codebase via code intelligence
- You have access to past solutions via memory
- Focus on production-ready, scalable backend solutions
- Consider error handling, validation, and security
- Follow best practices for the tech stack mentioned
`;
  }
}
