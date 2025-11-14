/**
 * Scaffold Generator
 *
 * Week 3-4 Implementation - Day 4
 * Generates complete project structures from workflow definitions
 */
import type { WorkflowDefinition, ScaffoldOptions, ScaffoldResult } from '../types/speckit.types.js';
import { TemplateRegistry } from '../utils/TemplateRegistry.js';
/**
 * Scaffold Generator
 *
 * Main class for generating project scaffolds from workflow definitions.
 * Orchestrates structure building, template rendering, and file writing.
 */
export declare class ScaffoldGenerator {
    private structureBuilder;
    private templateRegistry;
    private templateRenderer;
    private fileWriter;
    constructor();
    /**
     * Generate scaffold from workflow definition
     */
    generateScaffold(workflow: WorkflowDefinition, options?: ScaffoldOptions): Promise<ScaffoldResult>;
    /**
     * Validate workflow definition
     */
    private validateWorkflow;
    /**
     * Get template registry (for custom template registration)
     */
    getTemplateRegistry(): TemplateRegistry;
}
//# sourceMappingURL=ScaffoldGenerator.d.ts.map