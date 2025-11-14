/**
 * AgentCollaborator.ts
 * Multi-agent workflow orchestration
 * Phase 7: Agent System Implementation - Day 4
 */
import { EventEmitter } from 'events';
export class AgentCollaborator extends EventEmitter {
    registry;
    constructor(registry) {
        super();
        this.registry = registry;
    }
    /**
     * Execute a complex task that requires multiple agents
     */
    async collaborate(task, context, strategy = 'auto') {
        const startTime = Date.now();
        this.emit('collaboration:start', { task, strategy });
        try {
            // Decompose task into subtasks
            const subtasks = await this.decomposeTask(task, context);
            this.emit('collaboration:decomposed', { subtasks });
            // Determine execution strategy
            const executionStrategy = strategy === 'auto' ? this.determineStrategy(subtasks) : strategy;
            this.emit('collaboration:strategy', { strategy: executionStrategy });
            // Execute workflow
            const executedSubtasks = await this.executeWorkflow(subtasks, executionStrategy, context);
            // Aggregate results
            const aggregatedResult = await this.aggregateResults(executedSubtasks, context);
            const result = {
                success: true,
                subtasks: executedSubtasks,
                aggregatedResult,
                executionTime: Date.now() - startTime,
                strategy: executionStrategy,
            };
            this.emit('collaboration:complete', result);
            return result;
        }
        catch (error) {
            this.emit('collaboration:error', { task, error });
            throw error;
        }
    }
    /**
     * Decompose a complex task into subtasks
     */
    async decomposeTask(task, context) {
        const description = task.description.toLowerCase();
        const subtasks = [];
        // Check for database/schema keywords
        if (this.containsKeywords(description, ['database', 'schema', 'table', 'sql', 'query'])) {
            subtasks.push({
                id: `subtask-${Date.now()}-db`,
                description: 'Design database schema and queries',
                agentType: 'database',
                priority: 10,
                status: 'pending',
            });
        }
        // Check for API keywords
        if (this.containsKeywords(description, ['api', 'endpoint', 'rest', 'graphql', 'route'])) {
            subtasks.push({
                id: `subtask-${Date.now()}-api`,
                description: 'Design and implement API endpoints',
                agentType: 'api',
                dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
                priority: 9,
                status: 'pending',
            });
        }
        // Check for security keywords
        if (this.containsKeywords(description, ['security', 'auth', 'authentication', 'authorization', 'secure'])) {
            subtasks.push({
                id: `subtask-${Date.now()}-sec`,
                description: 'Implement security and authentication',
                agentType: 'security',
                dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
                priority: 8,
                status: 'pending',
            });
        }
        // Check for testing keywords
        if (this.containsKeywords(description, ['test', 'testing', 'tests', 'coverage', 'quality'])) {
            subtasks.push({
                id: `subtask-${Date.now()}-test`,
                description: 'Write comprehensive tests',
                agentType: 'quality',
                dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
                priority: 7,
                status: 'pending',
            });
        }
        // Check for documentation keywords
        if (this.containsKeywords(description, ['document', 'documentation', 'docs', 'readme'])) {
            subtasks.push({
                id: `subtask-${Date.now()}-doc`,
                description: 'Write documentation',
                agentType: 'writer',
                dependsOn: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : undefined,
                priority: 6,
                status: 'pending',
            });
        }
        // If no specific subtasks identified, treat as single task
        if (subtasks.length === 0) {
            const agent = this.registry.findBestAgent(task);
            subtasks.push({
                id: `subtask-${Date.now()}-main`,
                description: task.description,
                agentType: agent?.getMetadata().type || 'backend',
                priority: 10,
                status: 'pending',
            });
        }
        return subtasks;
    }
    /**
     * Determine optimal execution strategy based on subtasks
     */
    determineStrategy(subtasks) {
        // If any subtask has dependencies, must use sequential
        const hasDependencies = subtasks.some(st => st.dependsOn && st.dependsOn.length > 0);
        return hasDependencies ? 'sequential' : 'parallel';
    }
    /**
     * Execute workflow with given strategy
     */
    async executeWorkflow(subtasks, strategy, context) {
        if (strategy === 'sequential') {
            return this.executeSequential(subtasks, context);
        }
        else {
            return this.executeParallel(subtasks, context);
        }
    }
    /**
     * Execute subtasks sequentially (respects dependencies)
     */
    async executeSequential(subtasks, context) {
        const results = [...subtasks];
        for (const subtask of results) {
            // Wait for dependencies to complete
            if (subtask.dependsOn) {
                const dependenciesComplete = subtask.dependsOn.every(depId => results.find(st => st.id === depId)?.status === 'completed');
                if (!dependenciesComplete) {
                    subtask.status = 'failed';
                    subtask.result = { success: false, message: 'Dependencies not met' };
                    continue;
                }
            }
            // Execute subtask
            subtask.status = 'running';
            this.emit('subtask:start', subtask);
            try {
                const agent = this.registry.getAgent(subtask.agentType);
                if (!agent) {
                    throw new Error(`Agent not found: ${subtask.agentType}`);
                }
                const task = {
                    id: subtask.id,
                    description: subtask.description,
                    status: 'running',
                    priority: 'medium',
                    createdAt: Date.now(),
                };
                subtask.result = await agent.execute(task, context);
                subtask.status = subtask.result.success ? 'completed' : 'failed';
                this.emit('subtask:complete', subtask);
            }
            catch (error) {
                subtask.status = 'failed';
                subtask.result = { success: false, message: `Subtask failed: ${error}` };
                this.emit('subtask:error', { subtask, error });
            }
        }
        return results;
    }
    /**
     * Execute subtasks in parallel (no dependencies)
     */
    async executeParallel(subtasks, context) {
        const results = [...subtasks];
        const promises = results.map(async (subtask) => {
            subtask.status = 'running';
            this.emit('subtask:start', subtask);
            try {
                const agent = this.registry.getAgent(subtask.agentType);
                if (!agent) {
                    throw new Error(`Agent not found: ${subtask.agentType}`);
                }
                const task = {
                    id: subtask.id,
                    description: subtask.description,
                    status: 'running',
                    priority: 'medium',
                    createdAt: Date.now(),
                };
                subtask.result = await agent.execute(task, context);
                subtask.status = subtask.result.success ? 'completed' : 'failed';
                this.emit('subtask:complete', subtask);
            }
            catch (error) {
                subtask.status = 'failed';
                subtask.result = { success: false, message: `Subtask failed: ${error}` };
                this.emit('subtask:error', { subtask, error });
            }
        });
        await Promise.all(promises);
        return results;
    }
    /**
     * Aggregate results from multiple agents
     */
    async aggregateResults(subtasks, context) {
        const successfulSubtasks = subtasks.filter(st => st.status === 'completed' && st.result?.success);
        const failedSubtasks = subtasks.filter(st => st.status === 'failed' || !st.result?.success);
        if (successfulSubtasks.length === 0) {
            return {
                success: false,
                message: 'All subtasks failed',
                metadata: { subtasks, successCount: 0, failureCount: failedSubtasks.length },
            };
        }
        // Combine all successful results
        const combinedData = [];
        const allArtifacts = [];
        for (const subtask of successfulSubtasks) {
            if (subtask.result?.data) {
                combinedData.push(`\n### ${subtask.description}\n\n${subtask.result.data}`);
            }
            if (subtask.result?.artifacts) {
                allArtifacts.push(...subtask.result.artifacts);
            }
        }
        return {
            success: true,
            data: combinedData.join('\n'),
            artifacts: allArtifacts,
            metadata: {
                subtasks,
                successCount: successfulSubtasks.length,
                failureCount: failedSubtasks.length,
                agentsUsed: successfulSubtasks.map(st => st.agentType),
            },
        };
    }
    /**
     * Check if description contains any of the keywords
     */
    containsKeywords(description, keywords) {
        return keywords.some(keyword => description.includes(keyword));
    }
}
//# sourceMappingURL=AgentCollaborator.js.map