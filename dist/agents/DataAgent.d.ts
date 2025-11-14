/**
 * DataAgent.ts
 *
 * Data engineering and pipeline specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
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
export declare class DataAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildDataPrompt;
    private parseDataArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=DataAgent.d.ts.map