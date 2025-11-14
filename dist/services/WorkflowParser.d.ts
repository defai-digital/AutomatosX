/**
 * WorkflowParser.ts
 *
 * Parse and validate workflow definitions from YAML/JSON
 * Build dependency graphs and detect cycles
 * Phase 4 Week 2: Workflow Parser & Orchestration
 */
import { WorkflowDefinition, WorkflowStep, DependencyGraph } from '../types/schemas/workflow.schema.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { WorkflowAgentBridge } from '../bridge/WorkflowAgentBridge.js';
/**
 * Parse error with context
 */
export declare class WorkflowParseError extends Error {
    readonly context?: unknown | undefined;
    constructor(message: string, context?: unknown | undefined);
}
/**
 * Dependency cycle error
 */
export declare class DependencyCycleError extends Error {
    readonly cycle: string[];
    constructor(message: string, cycle: string[]);
}
/**
 * WorkflowParser - Parse and validate workflow definitions
 */
export declare class WorkflowParser {
    private agentRegistry?;
    private agentBridge?;
    constructor(agentRegistry?: AgentRegistry, agentBridge?: WorkflowAgentBridge);
    /**
     * Parse YAML string to workflow definition
     */
    parseYAML(yamlString: string): WorkflowDefinition;
    /**
     * Parse JSON string to workflow definition
     */
    parseJSON(jsonString: string): WorkflowDefinition;
    /**
     * Parse workflow from file (auto-detects format)
     */
    parseFile(filePath: string): Promise<WorkflowDefinition>;
    /**
     * Build dependency graph from workflow definition
     *
     * Returns a directed acyclic graph (DAG) with topological ordering
     * Detects cycles and throws if found
     */
    buildDependencyGraph(workflow: WorkflowDefinition): DependencyGraph;
    /**
     * Validate workflow definition for common issues
     *
     * Checks:
     * - All step keys are unique
     * - All dependencies exist
     * - No cycles in dependency graph
     * - Agent names are valid
     * - Prompts contain valid placeholders
     */
    validate(workflow: WorkflowDefinition): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Extract placeholder variables from prompt template
     *
     * Example: "Process {{input}} and {{step1.result}}" → ["input", "step1.result"]
     */
    private extractPlaceholders;
    /**
     * Render prompt template with context values
     *
     * Replaces {{variable}} placeholders with actual values from context
     */
    renderPrompt(template: string, context: Record<string, unknown>): string;
    /**
     * Resolve context value from placeholder path
     *
     * Supports nested access: "step1.result" → context.step1.result
     */
    private resolveContextValue;
    /**
     * Serialize workflow definition to YAML string
     */
    toYAML(workflow: WorkflowDefinition): string;
    /**
     * Serialize workflow definition to JSON string
     */
    toJSON(workflow: WorkflowDefinition, pretty?: boolean): string;
    /**
     * Suggest agents for a workflow step
     *
     * Returns agent suggestions based on step content and 3-tier routing strategy.
     * Requires WorkflowAgentBridge to be provided in constructor.
     *
     * @param step - Workflow step to analyze
     * @param limit - Maximum number of suggestions (default: 3)
     * @returns Array of agent suggestions with confidence scores
     */
    suggestAgents(step: WorkflowStep, limit?: number): Promise<Array<{
        agent: string;
        confidence: number;
        reason: string;
        tier: string;
    }>>;
    /**
     * Validate a single step's agent assignment
     *
     * Checks if the agent exists in registry and provides suggestions if not found.
     *
     * @param step - Workflow step to validate
     * @returns Validation result with suggestions
     */
    validateStepAgent(step: WorkflowStep): Promise<{
        valid: boolean;
        agent?: string;
        suggestions: Array<{
            agent: string;
            confidence: number;
            reason: string;
        }>;
        message: string;
    }>;
    /**
     * Get agent suggestions for all steps in workflow
     *
     * Useful for workflow analysis and optimization.
     *
     * @param workflow - Workflow definition
     * @returns Map of step key to suggestions
     */
    getWorkflowAgentSuggestions(workflow: WorkflowDefinition): Promise<Map<string, Array<{
        agent: string;
        confidence: number;
        reason: string;
        tier: string;
    }>>>;
}
//# sourceMappingURL=WorkflowParser.d.ts.map