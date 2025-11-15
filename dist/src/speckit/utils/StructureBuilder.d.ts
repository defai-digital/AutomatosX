/**
 * Structure Builder
 *
 * Week 3-4 Implementation - Day 4
 * Builds project structure from workflow definitions
 */
import type { WorkflowDefinition, ScaffoldOptions, ProjectStructure } from '../types/speckit.types.js';
/**
 * Structure Builder
 *
 * Responsible for determining which directories and files should be created
 * based on the workflow definition and scaffold options.
 */
export declare class StructureBuilder {
    /**
     * Build project structure from workflow and options
     */
    build(workflow: WorkflowDefinition, options: ScaffoldOptions): ProjectStructure;
    /**
     * Build minimal structure (workflows and basic config only)
     */
    private buildMinimal;
    /**
     * Build standard structure (workflows, configs, scripts, docs)
     */
    private buildStandard;
    /**
     * Build complete structure (everything including examples, docs, tests, CI)
     */
    private buildComplete;
}
//# sourceMappingURL=StructureBuilder.d.ts.map