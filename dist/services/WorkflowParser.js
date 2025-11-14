/**
 * WorkflowParser.ts
 *
 * Parse and validate workflow definitions from YAML/JSON
 * Build dependency graphs and detect cycles
 * Phase 4 Week 2: Workflow Parser & Orchestration
 */
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { validateWorkflowDefinition, } from '../types/schemas/workflow.schema.js';
/**
 * Parse error with context
 */
export class WorkflowParseError extends Error {
    context;
    constructor(message, context) {
        super(message);
        this.context = context;
        this.name = 'WorkflowParseError';
    }
}
/**
 * Dependency cycle error
 */
export class DependencyCycleError extends Error {
    cycle;
    constructor(message, cycle) {
        super(message);
        this.cycle = cycle;
        this.name = 'DependencyCycleError';
    }
}
/**
 * WorkflowParser - Parse and validate workflow definitions
 */
export class WorkflowParser {
    agentRegistry;
    agentBridge;
    constructor(agentRegistry, agentBridge) {
        this.agentRegistry = agentRegistry;
        this.agentBridge = agentBridge;
    }
    /**
     * Parse YAML string to workflow definition
     */
    parseYAML(yamlString) {
        try {
            const parsed = yaml.load(yamlString);
            if (!parsed || typeof parsed !== 'object') {
                throw new WorkflowParseError('Invalid YAML: expected object at root');
            }
            return validateWorkflowDefinition(parsed);
        }
        catch (error) {
            if (error instanceof WorkflowParseError) {
                throw error;
            }
            throw new WorkflowParseError(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`, error);
        }
    }
    /**
     * Parse JSON string to workflow definition
     */
    parseJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return validateWorkflowDefinition(parsed);
        }
        catch (error) {
            throw new WorkflowParseError(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`, error);
        }
    }
    /**
     * Parse workflow from file (auto-detects format)
     */
    async parseFile(filePath) {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new WorkflowParseError(`File not found: ${filePath}`);
        }
        // Read file content
        const content = fs.readFileSync(filePath, 'utf-8');
        // Detect format by extension
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
            return this.parseYAML(content);
        }
        else if (ext === '.json') {
            return this.parseJSON(content);
        }
        else {
            throw new WorkflowParseError(`Unsupported file format: ${ext}. Expected .yaml, .yml, or .json`);
        }
    }
    /**
     * Build dependency graph from workflow definition
     *
     * Returns a directed acyclic graph (DAG) with topological ordering
     * Detects cycles and throws if found
     */
    buildDependencyGraph(workflow) {
        const nodes = new Map();
        // Initialize nodes
        for (const step of workflow.steps) {
            nodes.set(step.key, {
                stepKey: step.key,
                dependencies: [...step.dependencies],
                dependents: [],
                level: 0,
            });
        }
        // Build dependents (reverse edges)
        for (const step of workflow.steps) {
            for (const depKey of step.dependencies) {
                const depNode = nodes.get(depKey);
                if (!depNode) {
                    throw new WorkflowParseError(`Step "${step.key}" depends on non-existent step "${depKey}"`);
                }
                depNode.dependents.push(step.key);
            }
        }
        // Detect cycles using DFS
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const detectCycle = (nodeKey) => {
            visited.add(nodeKey);
            recursionStack.add(nodeKey);
            path.push(nodeKey);
            const node = nodes.get(nodeKey);
            for (const depKey of node.dependencies) {
                if (!visited.has(depKey)) {
                    if (detectCycle(depKey)) {
                        return true;
                    }
                }
                else if (recursionStack.has(depKey)) {
                    // Cycle detected!
                    const cycleStart = path.indexOf(depKey);
                    const cycle = path.slice(cycleStart);
                    cycle.push(depKey); // Complete the cycle
                    throw new DependencyCycleError(`Dependency cycle detected: ${cycle.join(' → ')}`, cycle);
                }
            }
            recursionStack.delete(nodeKey);
            path.pop();
            return false;
        };
        // Check all nodes for cycles
        for (const nodeKey of Array.from(nodes.keys())) {
            if (!visited.has(nodeKey)) {
                detectCycle(nodeKey);
            }
        }
        // Compute topological order using Kahn's algorithm
        const topologicalOrder = [];
        const inDegree = new Map();
        for (const [key, node] of Array.from(nodes.entries())) {
            inDegree.set(key, node.dependencies.length);
        }
        const queue = [];
        for (const [key, degree] of Array.from(inDegree.entries())) {
            if (degree === 0) {
                queue.push(key);
            }
        }
        while (queue.length > 0) {
            const current = queue.shift();
            topologicalOrder.push(current);
            const currentNode = nodes.get(current);
            for (const dependent of currentNode.dependents) {
                const newDegree = inDegree.get(dependent) - 1;
                inDegree.set(dependent, newDegree);
                if (newDegree === 0) {
                    queue.push(dependent);
                }
            }
        }
        // Sanity check: all nodes should be in topological order
        if (topologicalOrder.length !== nodes.size) {
            throw new DependencyCycleError('Failed to compute topological order (possible cycle)', []);
        }
        // Assign levels for parallel execution
        const levels = [];
        const levelMap = new Map();
        for (const stepKey of topologicalOrder) {
            const node = nodes.get(stepKey);
            // Level is max(dependency levels) + 1
            let maxDepLevel = -1;
            for (const depKey of node.dependencies) {
                const depLevel = levelMap.get(depKey);
                maxDepLevel = Math.max(maxDepLevel, depLevel);
            }
            const level = maxDepLevel + 1;
            node.level = level;
            levelMap.set(stepKey, level);
            // Add to level group
            if (!levels[level]) {
                levels[level] = [];
            }
            levels[level].push(stepKey);
        }
        return {
            nodes: Array.from(nodes.values()),
            hasCycle: false,
            topologicalOrder,
            levels,
        };
    }
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
    validate(workflow) {
        const errors = [];
        // Check for duplicate step keys
        const stepKeys = new Set();
        for (const step of workflow.steps) {
            if (stepKeys.has(step.key)) {
                errors.push(`Duplicate step key: "${step.key}"`);
            }
            stepKeys.add(step.key);
        }
        // Check dependencies exist
        for (const step of workflow.steps) {
            for (const depKey of step.dependencies) {
                if (!stepKeys.has(depKey)) {
                    errors.push(`Step "${step.key}" depends on non-existent step "${depKey}"`);
                }
            }
        }
        // Try to build dependency graph (will throw on cycles)
        try {
            this.buildDependencyGraph(workflow);
        }
        catch (error) {
            if (error instanceof DependencyCycleError) {
                errors.push(error.message);
            }
            else {
                errors.push(`Failed to build dependency graph: ${error}`);
            }
        }
        // Check for valid placeholders in prompts
        for (const step of workflow.steps) {
            const placeholders = this.extractPlaceholders(step.prompt);
            for (const placeholder of placeholders) {
                // Check if placeholder references a valid step output
                if (placeholder.includes('.')) {
                    const [stepKey] = placeholder.split('.');
                    if (!stepKeys.has(stepKey)) {
                        errors.push(`Step "${step.key}" prompt references non-existent step "${stepKey}"`);
                    }
                }
            }
        }
        // Validate agent assignments (if registry available)
        if (this.agentRegistry) {
            for (const step of workflow.steps) {
                if (step.agent) {
                    const agent = this.agentRegistry.get(step.agent);
                    if (!agent) {
                        const availableAgents = this.agentRegistry.getAll().map(a => a.getName()).join(', ');
                        errors.push(`Step "${step.key}": Agent "${step.agent}" not found in registry. ` +
                            `Available agents: ${availableAgents}`);
                    }
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * Extract placeholder variables from prompt template
     *
     * Example: "Process {{input}} and {{step1.result}}" → ["input", "step1.result"]
     */
    extractPlaceholders(prompt) {
        const regex = /{{([^}]+)}}/g;
        const matches = [];
        let match;
        while ((match = regex.exec(prompt)) !== null) {
            matches.push(match[1].trim());
        }
        return matches;
    }
    /**
     * Render prompt template with context values
     *
     * Replaces {{variable}} placeholders with actual values from context
     */
    renderPrompt(template, context) {
        let rendered = template;
        const placeholders = this.extractPlaceholders(template);
        for (const placeholder of placeholders) {
            const value = this.resolveContextValue(placeholder, context);
            const valueString = typeof value === 'string' ? value : JSON.stringify(value);
            rendered = rendered.replace(new RegExp(`{{\\s*${placeholder}\\s*}}`, 'g'), valueString);
        }
        return rendered;
    }
    /**
     * Resolve context value from placeholder path
     *
     * Supports nested access: "step1.result" → context.step1.result
     */
    resolveContextValue(path, context) {
        const parts = path.split('.');
        let value = context;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    /**
     * Serialize workflow definition to YAML string
     */
    toYAML(workflow) {
        return yaml.dump(workflow, {
            indent: 2,
            lineWidth: 120,
            noRefs: true,
        });
    }
    /**
     * Serialize workflow definition to JSON string
     */
    toJSON(workflow, pretty = true) {
        return pretty ? JSON.stringify(workflow, null, 2) : JSON.stringify(workflow);
    }
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
    async suggestAgents(step, limit = 3) {
        if (!this.agentBridge) {
            return [];
        }
        const suggestions = await this.agentBridge.getSuggestedAgents(step, limit);
        // Add tier information based on confidence
        return suggestions.map(s => ({
            ...s,
            tier: s.confidence >= 0.90 ? 'explicit' : s.confidence >= 0.70 ? 'type' : 'semantic',
        }));
    }
    /**
     * Validate a single step's agent assignment
     *
     * Checks if the agent exists in registry and provides suggestions if not found.
     *
     * @param step - Workflow step to validate
     * @returns Validation result with suggestions
     */
    async validateStepAgent(step) {
        // If no agent specified, provide suggestions
        if (!step.agent) {
            const suggestions = await this.suggestAgents(step, 5);
            return {
                valid: true,
                suggestions,
                message: `No agent specified. Consider: ${suggestions.slice(0, 3).map(s => s.agent).join(', ')}`,
            };
        }
        // If registry available, validate agent exists
        if (this.agentRegistry) {
            const agent = this.agentRegistry.get(step.agent);
            if (!agent) {
                const suggestions = await this.suggestAgents(step, 5);
                const availableAgents = this.agentRegistry.getAll().map(a => a.getName()).join(', ');
                return {
                    valid: false,
                    agent: step.agent,
                    suggestions,
                    message: `Agent "${step.agent}" not found. Available: ${availableAgents}`,
                };
            }
            return {
                valid: true,
                agent: step.agent,
                suggestions: [],
                message: `Agent "${step.agent}" is valid.`,
            };
        }
        // No registry - cannot validate
        return {
            valid: true,
            agent: step.agent,
            suggestions: [],
            message: 'Agent registry not available for validation.',
        };
    }
    /**
     * Get agent suggestions for all steps in workflow
     *
     * Useful for workflow analysis and optimization.
     *
     * @param workflow - Workflow definition
     * @returns Map of step key to suggestions
     */
    async getWorkflowAgentSuggestions(workflow) {
        const suggestions = new Map();
        for (const step of workflow.steps) {
            const stepSuggestions = await this.suggestAgents(step, 5);
            suggestions.set(step.key, stepSuggestions);
        }
        return suggestions;
    }
}
//# sourceMappingURL=WorkflowParser.js.map