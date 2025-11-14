/**
 * DataAgent.ts
 *
 * Data engineering and pipeline specialist
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
 * DataAgent - Data engineering specialist
 *
 * Specializes in:
 * - ETL/ELT pipeline design
 * - Data modeling and schema design
 * - Data transformation and processing
 * - Data quality and validation
 * - Big data technologies (Spark, Kafka, Airflow)
 */
export class DataAgent extends AgentBase {
  constructor() {
    super({
      type: 'data',
      name: 'Data Engineering Specialist (Daisy)',
      description:
        'Expert in data engineering, ETL pipelines, data modeling, and big data technologies. Specializes in building scalable data processing systems.',
      capabilities: [
        {
          name: 'ETL Pipelines',
          description: 'Design and implement ETL/ELT pipelines',
          keywords: ['etl', 'elt', 'pipeline', 'airflow', 'data pipeline', 'workflow'],
        },
        {
          name: 'Data Modeling',
          description: 'Design data models and schemas',
          keywords: ['data model', 'schema', 'dimensional', 'star schema', 'snowflake', 'data warehouse'],
        },
        {
          name: 'Data Transformation',
          description: 'Transform and process data at scale',
          keywords: ['transform', 'process', 'spark', 'dbt', 'dataflow', 'batch', 'stream'],
        },
        {
          name: 'Data Quality',
          description: 'Ensure data quality and validation',
          keywords: ['quality', 'validation', 'cleansing', 'deduplication', 'consistency'],
        },
        {
          name: 'Big Data',
          description: 'Work with big data technologies',
          keywords: ['spark', 'kafka', 'hadoop', 'flink', 'big data', 'streaming'],
        },
      ],
      specializations: [
        'Apache Airflow',
        'Apache Spark',
        'Kafka',
        'dbt',
        'SQL',
        'Data Warehousing',
        'ETL/ELT',
        'Data Pipelines',
        'Data Quality',
      ],
      temperature: 0.6,
      maxTokens: 4000,
    });
  }

  protected async executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      const suggestion = this.suggestDelegation(task);
      return {
        success: false,
        message: `This task is outside my data engineering specialization. Consider @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `Data agent handling: ${task.description}`);

    try {
      // Search for existing data pipelines
      const existingPipelines = await context.codeIntelligence.searchCode(
        'pipeline etl data transform'
      );

      // Check past data solutions
      const pastSolutions = await context.memory.search('data pipeline etl schema');

      const prompt = this.buildDataPrompt(task, context, existingPipelines.slice(0, 5), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseDataArtifacts(response);

      await context.memory.store({
        type: 'data_solution',
        agent: this.metadata.type,
        task: task.description,
        response,
        artifacts: artifacts.map((a) => ({ type: a.type, name: a.name })),
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: response,
        artifacts,
        metadata: {
          agent: this.metadata.type,
          capabilityScore: capability,
          category: 'data-engineering',
        },
      };
    } catch (error) {
      context.monitoring.log('error', `Data agent failed: ${error}`);
      throw error;
    }
  }

  private buildDataPrompt(
    task: Task,
    context: AgentContext,
    pipelineContext: any[],
    pastSolutions: any[]
  ): string {
    let prompt = this.buildPrompt(task, context);

    if (pipelineContext.length > 0) {
      prompt += '\n\nExisting data pipelines:\n';
      pipelineContext.forEach((pipeline, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(pipeline).slice(0, 200)}...\n`;
      });
    }

    prompt += '\n\nProvide complete data engineering solution with:';
    prompt += '\n1. Data pipeline design (DAG, workflow)';
    prompt += '\n2. Data schema/model (SQL DDL or data model diagram)';
    prompt += '\n3. ETL/transformation logic (SQL, Spark, Python)';
    prompt += '\n4. Data quality checks and validation';
    prompt += '\n5. Error handling and monitoring';
    prompt += '\n6. Performance optimization strategies';
    prompt += '\n7. Scalability considerations';

    return prompt;
  }

  private parseDataArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();

      let artifactName = `${language}-artifact`;

      // Detect data engineering artifacts
      if (language === 'sql') {
        if (content.toUpperCase().includes('CREATE TABLE') || content.toUpperCase().includes('CREATE VIEW')) {
          artifactName = 'schema-ddl';
        } else if (content.toUpperCase().includes('SELECT') && content.toUpperCase().includes('FROM')) {
          artifactName = 'transformation-query';
        }
      } else if (language === 'python' && (content.includes('spark') || content.includes('pyspark'))) {
        artifactName = 'spark-job';
      } else if (language === 'yaml' && content.includes('dag')) {
        artifactName = 'airflow-dag';
      }

      artifacts.push({
        type: 'code',
        name: artifactName,
        content,
        metadata: { language, category: 'data-engineering' },
      });
    }

    return artifacts;
  }

  protected getContextPrompt(context: AgentContext): string {
    return `
Data Engineering Context:
- Design scalable, fault-tolerant data pipelines
- Ensure data quality and validation at every stage
- Optimize for performance (partitioning, indexing, caching)
- Implement proper error handling and retry logic
- Monitor data pipeline health and SLAs
- Follow data governance and security best practices
- Consider idempotency and exactly-once processing
`;
  }
}
