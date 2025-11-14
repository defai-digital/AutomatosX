/**
 * PlanGenerator - Workflow Execution Plan Generator
 *
 * Week 3-4 Implementation - Day 2
 * Generates detailed execution plans from workflow definitions with
 * cost estimates, resource requirements, and risk assessments
 */
import type { PlanOptions, WorkflowDefinition, ExecutionPlan } from '../types/speckit.types.js';
import { WorkflowParser } from '../../services/WorkflowParser.js';
/**
 * PlanGenerator analyzes workflow definitions and generates
 * comprehensive execution plans with phases, costs, and risks
 */
export declare class PlanGenerator {
    private readonly VERSION;
    private costEstimator;
    private workflowParser;
    constructor(workflowParser: WorkflowParser);
    /**
     * Generate execution plan from workflow definition
     */
    generatePlan(workflow: WorkflowDefinition, options?: PlanOptions): Promise<ExecutionPlan>;
    /**
     * Generate execution phases from workflow
     */
    private generatePhases;
    /**
     * Generate phase description
     */
    private generatePhaseDescription;
    /**
     * Calculate resource requirements
     */
    private calculateResourceRequirements;
    /**
     * Assess workflow execution risks
     */
    private assessRisks;
    /**
     * Generate plan summary
     */
    private generateSummary;
    /**
     * Write plan to file
     */
    writePlan(plan: ExecutionPlan, workflow: WorkflowDefinition, options: PlanOptions): Promise<string>;
    /**
     * Generate markdown documentation for the plan
     */
    private generateMarkdown;
    /**
     * Format duration in human-readable format
     */
    private formatDuration;
    /**
     * Sanitize filename
     */
    private sanitizeFileName;
}
//# sourceMappingURL=PlanGenerator.d.ts.map