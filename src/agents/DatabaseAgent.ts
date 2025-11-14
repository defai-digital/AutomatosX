/**
 * DatabaseAgent.ts
 * Database design and optimization specialist
 * Phase 7: Agent System Implementation - Day 3
 */

import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions, TaskArtifact } from '../types/agents.types.js';

export class DatabaseAgent extends AgentBase {
  constructor() {
    super({
      type: 'database',
      name: 'Database Specialist (Derek)',
      description: 'Expert in database design, optimization, indexing, and query performance. Specializes in SQL and NoSQL databases.',
      capabilities: [
        { name: 'Schema Design', description: 'Design optimal database schemas', keywords: ['schema', 'table', 'design', 'normalization', 'denormalization'] },
        { name: 'Query Optimization', description: 'Optimize SQL queries and indexes', keywords: ['query', 'optimization', 'index', 'performance', 'explain'] },
        { name: 'Database Migrations', description: 'Design and implement migrations', keywords: ['migration', 'alter', 'upgrade', 'versioning'] },
        { name: 'Performance Tuning', description: 'Tune database performance', keywords: ['tuning', 'performance', 'slow query', 'bottleneck'] },
        { name: 'Replication & Scaling', description: 'Set up replication and scaling', keywords: ['replication', 'scaling', 'sharding', 'read replica'] },
      ],
      specializations: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQL', 'NoSQL', 'Indexing', 'Query Optimization', 'Migrations', 'Database Design'],
      temperature: 0.6,
      maxTokens: 4000,
    });
  }

  protected async executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      return { success: false, message: `Outside database specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
    }

    context.monitoring.log('info', `Database agent handling: ${task.description}`);

    try {
      const relevantCode = await context.codeIntelligence.searchCode('database schema sql query');
      const pastSolutions = await context.memory.search('database optimization schema migration');
      const prompt = this.buildDatabasePrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseDatabaseArtifacts(response);

      await context.memory.store({ type: 'database_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });

      return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'database' } };
    } catch (error) {
      context.monitoring.log('error', `Database agent failed: ${error}`);
      throw error;
    }
  }

  private buildDatabasePrompt(task: Task, context: AgentContext, codeContext: any[], pastSolutions: any[]): string {
    let prompt = this.buildPrompt(task, context);
    prompt += '\n\nProvide complete database solution with:\n1. Schema design (DDL with constraints)\n2. Indexes for optimal performance\n3. Query examples with EXPLAIN plans\n4. Migration scripts if needed\n5. Performance optimization tips\n6. Scaling and replication strategy';
    return prompt;
  }

  private parseDatabaseArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();
      let name = 'database-code';
      if (language === 'sql') {
        if (content.toUpperCase().includes('CREATE TABLE') || content.toUpperCase().includes('CREATE INDEX')) name = 'schema-ddl';
        else if (content.toUpperCase().includes('ALTER TABLE')) name = 'migration-script';
        else if (content.toUpperCase().includes('SELECT')) name = 'query-optimization';
      }
      artifacts.push({ type: 'code', name, content, metadata: { language, category: 'database' } });
    }
    return artifacts;
  }

  protected getContextPrompt(): string {
    return '\nDatabase Context:\n- Design for data integrity and consistency\n- Use appropriate indexes (B-tree, Hash, GiST)\n- Optimize for read vs write patterns\n- Consider normalization vs denormalization trade-offs\n- Plan for scalability (sharding, replication)\n- Include migration strategies for schema changes';
  }
}
