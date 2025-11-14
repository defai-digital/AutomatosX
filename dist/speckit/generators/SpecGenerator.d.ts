/**
 * SpecGenerator - Natural Language to YAML Workflow Specification
 *
 * Week 3-4 Implementation - Day 1
 * Converts natural language descriptions into valid AutomatosX workflow YAML
 */
import { SpecOptions, GeneratedSpec } from '../types/speckit.types.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { WorkflowParser } from '../../services/WorkflowParser.js';
/**
 * SpecGenerator converts natural language task descriptions into
 * structured YAML workflow definitions using AI-powered generation
 */
export declare class SpecGenerator {
    private providerRouter;
    private agentRegistry;
    private workflowParser;
    private readonly VERSION;
    constructor(providerRouter: ProviderRouterV2, agentRegistry: AgentRegistry, workflowParser: WorkflowParser);
    /**
     * Generate workflow specification from natural language description
     *
     * @param description Natural language task description
     * @param options Generation options
     * @returns Generated spec with YAML, definition, and metadata
     */
    generateSpec(description: string, options?: SpecOptions): Promise<GeneratedSpec>;
    /**
     * Build generation context with available agents and metadata
     */
    private buildContext;
    /**
     * Build AI prompt for workflow generation
     */
    private buildPrompt;
    /**
     * Build constraints section based on options
     */
    private buildConstraintsSection;
    /**
     * Extract YAML content from AI response
     */
    private extractYAML;
    /**
     * Parse YAML string to WorkflowDefinition
     */
    private parseYAML;
    /**
     * Validate workflow specification
     */
    private validateSpec;
    /**
     * Detect circular dependencies in workflow steps
     */
    private detectCycles;
    /**
     * Generate metadata for the spec
     */
    private generateMetadata;
    /**
     * Write spec to file
     */
    private writeSpec;
    /**
     * Generate header comment for YAML file
     */
    private generateHeader;
    /**
     * Sanitize filename
     */
    private sanitizeFileName;
}
//# sourceMappingURL=SpecGenerator.d.ts.map