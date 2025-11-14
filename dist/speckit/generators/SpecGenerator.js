/**
 * SpecGenerator - Natural Language to YAML Workflow Specification
 *
 * Week 3-4 Implementation - Day 1
 * Converts natural language descriptions into valid AutomatosX workflow YAML
 */
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { z } from 'zod';
// Local Zod schema for Week 3-4 workflow format validation
const RetryConfigSchema = z.object({
    maxRetries: z.number(),
    backoffMs: z.number(),
    backoffMultiplier: z.number().optional(),
});
const WorkflowStepSchemaLocal = z.object({
    id: z.string(),
    name: z.string(),
    agent: z.string(),
    action: z.string(),
    config: z.record(z.string(), z.any()).optional(),
    dependsOn: z.array(z.string()).optional(),
    retryConfig: RetryConfigSchema.optional(),
    timeout: z.number().optional(),
});
const WorkflowDefinitionSchemaLocal = z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    steps: z.array(WorkflowStepSchemaLocal),
    config: z.object({
        maxConcurrency: z.number().optional(),
        defaultTimeout: z.number().optional(),
        errorHandling: z.enum(['fail-fast', 'continue', 'rollback']).optional(),
    }).optional(),
});
/**
 * SpecGenerator converts natural language task descriptions into
 * structured YAML workflow definitions using AI-powered generation
 */
export class SpecGenerator {
    providerRouter;
    agentRegistry;
    workflowParser;
    VERSION = '1.0.0';
    constructor(providerRouter, agentRegistry, workflowParser) {
        this.providerRouter = providerRouter;
        this.agentRegistry = agentRegistry;
        this.workflowParser = workflowParser;
    }
    /**
     * Generate workflow specification from natural language description
     *
     * @param description Natural language task description
     * @param options Generation options
     * @returns Generated spec with YAML, definition, and metadata
     */
    async generateSpec(description, options = {}) {
        if (!description || description.trim().length === 0) {
            throw new Error('Description cannot be empty');
        }
        if (options.verbose) {
            console.log(chalk.cyan('\n📝 Building generation context...'));
        }
        // 1. Build context
        const context = await this.buildContext(description, options);
        if (options.verbose) {
            console.log(chalk.gray(`   Available agents: ${context.availableAgents.length}`));
            console.log(chalk.cyan('\n🤖 Generating workflow with AI...'));
        }
        // 2. Build prompt for AI
        const prompt = this.buildPrompt(description, context, options);
        // 3. Call AI provider
        const response = await this.providerRouter.route({
            messages: [{ role: 'user', content: prompt }],
            provider: options.verbose ? 'claude' : undefined, // Use default if not verbose
            temperature: 0.3, // Low temperature for consistent structured output
            maxTokens: 4000,
        });
        if (options.verbose) {
            console.log(chalk.cyan('\n✂️  Extracting and validating YAML...'));
        }
        // 4. Extract YAML from response
        const yamlContent = this.extractYAML(response.content);
        // 5. Parse YAML
        const definition = this.parseYAML(yamlContent);
        // 6. Validate workflow definition
        const validation = await this.validateSpec(definition);
        if (!validation.valid) {
            throw new Error(`Invalid workflow specification:\n${validation.errors.join('\n')}`);
        }
        if (validation.warnings.length > 0 && options.verbose) {
            console.log(chalk.yellow('\n⚠️  Warnings:'));
            validation.warnings.forEach(w => console.log(chalk.yellow(`   ${w}`)));
        }
        if (options.verbose) {
            console.log(chalk.cyan('\n📊 Generating metadata...'));
        }
        // 7. Generate metadata
        const metadata = this.generateMetadata(definition, description, context);
        // 8. Write to file
        const outputPath = await this.writeSpec(yamlContent, definition, options);
        if (options.verbose) {
            console.log(chalk.green(`\n✅ Spec written to: ${outputPath}`));
        }
        return {
            yaml: yamlContent,
            definition,
            outputPath,
            metadata,
        };
    }
    /**
     * Build generation context with available agents and metadata
     */
    async buildContext(description, options) {
        // Get all available agents
        let availableAgents = this.agentRegistry.list().map(agent => ({
            name: agent.name,
            description: agent.description,
            capabilities: agent.capabilities || [],
        }));
        // Filter to specific agents if requested
        if (options.agents && options.agents.length > 0) {
            availableAgents = availableAgents.filter(a => options.agents.includes(a.name));
            if (availableAgents.length === 0) {
                throw new Error(`No agents found matching: ${options.agents.join(', ')}`);
            }
        }
        return {
            description,
            availableAgents,
            project: options.projectName
                ? {
                    name: options.projectName,
                    version: this.VERSION,
                    description,
                    stack: [],
                }
                : undefined,
        };
    }
    /**
     * Build AI prompt for workflow generation
     */
    buildPrompt(description, context, options) {
        const agentsList = context.availableAgents
            .map(a => `- ${a.name}: ${a.description}`)
            .join('\n');
        const constraintsSection = this.buildConstraintsSection(options);
        return `You are a workflow architect for AutomatosX v8.0.0, an AI-powered code intelligence platform.

Your task is to generate a YAML workflow specification for the following task:

"""
${description}
"""

Available Agents:
${agentsList}

YAML Schema (AutomatosX Workflow Format):
\`\`\`yaml
name: "Workflow Name"
version: "1.0.0"
description: "Description of what this workflow does"

steps:
  - id: "step-1"
    name: "Step Name"
    agent: "agent-name"
    action: "action-name"
    config:
      key: value
    dependsOn: []
    retryConfig:
      maxRetries: 3
      backoffMs: 1000
    timeout: 30000
\`\`\`

Requirements:
1. Use ONLY agents from the available list above
2. Each step must have a unique ID (e.g., "step-1", "step-2")
3. Define clear dependencies using "dependsOn" array
4. Include retry configuration for critical steps
5. Add reasonable timeouts (in milliseconds)
6. Break complex tasks into logical steps
7. Ensure workflow can run end-to-end successfully
${constraintsSection}

Important Guidelines:
- Start with simple steps (e.g., file analysis, code search)
- Build up to complex steps (e.g., code generation, refactoring)
- Use appropriate agents for each task type
- Minimize dependencies for parallel execution where possible
- Include error handling and retry logic
- Estimate realistic timeouts based on task complexity

Output Requirements:
- Output ONLY valid YAML
- Do NOT include any explanatory text before or after the YAML
- Do NOT wrap the YAML in markdown code blocks
- Ensure YAML is properly formatted and indented

Generate the workflow now:`;
    }
    /**
     * Build constraints section based on options
     */
    buildConstraintsSection(options) {
        const constraints = [];
        if (options.maxSteps) {
            constraints.push(`8. Maximum ${options.maxSteps} steps`);
        }
        if (options.includeRetry !== false) {
            constraints.push('9. Include retry configuration for all steps');
        }
        if (options.includeCost) {
            constraints.push('10. Optimize for cost (prefer cheaper providers)');
        }
        return constraints.length > 0 ? '\n' + constraints.join('\n') : '';
    }
    /**
     * Extract YAML content from AI response
     */
    extractYAML(response) {
        // Remove markdown code blocks if present
        let content = response.trim();
        // Remove ```yaml or ``` wrappers
        const codeBlockMatch = content.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            content = codeBlockMatch[1].trim();
        }
        // Remove any leading/trailing non-YAML text
        const yamlStart = content.search(/^[a-zA-Z]/m);
        if (yamlStart > 0) {
            content = content.substring(yamlStart);
        }
        return content;
    }
    /**
     * Parse YAML string to WorkflowDefinition
     */
    parseYAML(yamlContent) {
        try {
            const parsed = yaml.load(yamlContent);
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('YAML does not parse to an object');
            }
            // Validate against schema
            const validated = WorkflowDefinitionSchemaLocal.parse(parsed);
            return validated;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`YAML parsing failed: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Validate workflow specification
     */
    async validateSpec(definition) {
        const errors = [];
        const warnings = [];
        // Check basic structure
        if (!definition.name || definition.name.trim().length === 0) {
            errors.push('Workflow name is required');
        }
        if (!definition.version || definition.version.trim().length === 0) {
            errors.push('Workflow version is required');
        }
        if (!definition.steps || definition.steps.length === 0) {
            errors.push('Workflow must have at least one step');
        }
        if (definition.steps) {
            // Check for duplicate step IDs
            const stepIds = definition.steps.map(s => s.id);
            const duplicates = stepIds.filter((id, index) => stepIds.indexOf(id) !== index);
            if (duplicates.length > 0) {
                errors.push(`Duplicate step IDs: ${duplicates.join(', ')}`);
            }
            // Validate each step
            for (const step of definition.steps) {
                // Check agent exists
                const agent = this.agentRegistry.get(step.agent);
                if (!agent) {
                    errors.push(`Unknown agent in step ${step.id}: ${step.agent}`);
                }
                // Check dependencies reference valid steps
                if (step.dependsOn) {
                    for (const depId of step.dependsOn) {
                        if (!stepIds.includes(depId)) {
                            errors.push(`Step ${step.id} depends on unknown step: ${depId}`);
                        }
                    }
                }
                // Warn about missing retry config
                if (!step.retryConfig) {
                    warnings.push(`Step ${step.id} has no retry configuration`);
                }
                // Warn about missing timeout
                if (!step.timeout) {
                    warnings.push(`Step ${step.id} has no timeout specified`);
                }
            }
            // Check for circular dependencies
            const cycles = this.detectCycles(definition.steps);
            if (cycles.length > 0) {
                errors.push(`Circular dependencies detected: ${cycles.map(c => c.join(' → ')).join('; ')}`);
            }
        }
        // Use WorkflowParser for additional validation
        try {
            await this.workflowParser.parse(definition);
        }
        catch (error) {
            if (error instanceof Error) {
                errors.push(`WorkflowParser validation failed: ${error.message}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Detect circular dependencies in workflow steps
     */
    detectCycles(steps) {
        const cycles = [];
        const visited = new Set();
        const recStack = new Set();
        const dfs = (stepId, path) => {
            visited.add(stepId);
            recStack.add(stepId);
            path.push(stepId);
            const step = steps.find(s => s.id === stepId);
            if (step && step.dependsOn) {
                for (const depId of step.dependsOn) {
                    if (!visited.has(depId)) {
                        dfs(depId, [...path]);
                    }
                    else if (recStack.has(depId)) {
                        // Cycle detected
                        const cycleStart = path.indexOf(depId);
                        cycles.push([...path.slice(cycleStart), depId]);
                    }
                }
            }
            recStack.delete(stepId);
        };
        for (const step of steps) {
            if (!visited.has(step.id)) {
                dfs(step.id, []);
            }
        }
        return cycles;
    }
    /**
     * Generate metadata for the spec
     */
    generateMetadata(definition, description, context) {
        // Count unique agents
        const agentsUsed = [
            ...new Set(definition.steps.map(s => s.agent)),
        ];
        // Estimate duration (simple heuristic)
        const avgStepDuration = 30000; // 30 seconds per step
        const estimatedDuration = definition.steps.length * avgStepDuration;
        // Estimate cost (simple heuristic)
        const avgStepCost = 0.01; // $0.01 per step
        const estimatedCost = definition.steps.length * avgStepCost;
        // Determine complexity
        let complexity = 'low';
        if (definition.steps.length > 10) {
            complexity = 'high';
        }
        else if (definition.steps.length > 5) {
            complexity = 'medium';
        }
        // Check for complex dependencies
        const maxDeps = Math.max(...definition.steps.map(s => s.dependsOn?.length || 0));
        if (maxDeps > 3) {
            complexity = 'high';
        }
        return {
            stepsCount: definition.steps.length,
            agentsUsed,
            estimatedDuration,
            estimatedCost,
            complexity,
            generatedAt: new Date().toISOString(),
            generatorVersion: this.VERSION,
        };
    }
    /**
     * Write spec to file
     */
    async writeSpec(yamlContent, definition, options) {
        const outputDir = options.outputPath || 'workflows';
        const fileName = this.sanitizeFileName(definition.name) + '.yaml';
        const outputPath = path.join(outputDir, fileName);
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        // Add metadata header comment
        const header = this.generateHeader(definition);
        const fullContent = header + '\n' + yamlContent;
        // Write file
        await fs.writeFile(outputPath, fullContent, 'utf-8');
        return outputPath;
    }
    /**
     * Generate header comment for YAML file
     */
    generateHeader(definition) {
        return `#
# AutomatosX Workflow: ${definition.name}
# Generated: ${new Date().toISOString()}
# Generator: SpecGenerator v${this.VERSION}
#
# Description: ${definition.description}
# Steps: ${definition.steps.length}
#
`;
    }
    /**
     * Sanitize filename
     */
    sanitizeFileName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
}
//# sourceMappingURL=SpecGenerator.js.map