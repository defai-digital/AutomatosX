/**
 * AgentRuntime.ts
 *
 * Agent execution engine with context injection
 * Phase 7: Agent System Implementation - Day 1
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
/**
 * AgentRuntime - Execution engine for agents
 *
 * Responsibilities:
 * - Context construction (inject dependencies)
 * - Task execution coordination
 * - Provider routing
 * - Monitoring integration
 * - Error handling
 */
export class AgentRuntime extends EventEmitter {
    registry;
    memoryService;
    fileService;
    claudeProvider;
    geminiProvider;
    openaiProvider;
    metrics;
    logger;
    tracer;
    activeTasks = new Map();
    constructor(registry, memoryService, fileService, providers, monitoring) {
        super();
        this.registry = registry;
        this.memoryService = memoryService;
        this.fileService = fileService;
        this.claudeProvider = providers.claude;
        this.geminiProvider = providers.gemini;
        this.openaiProvider = providers.openai;
        this.metrics = monitoring.metrics;
        this.logger = monitoring.logger;
        this.tracer = monitoring.tracer;
    }
    /**
     * Execute a task with an agent
     */
    async executeTask(task, options) {
        const taskId = task.id || randomUUID();
        task.id = taskId;
        this.logger.info(`Task execution started: ${task.description}`, 'AgentRuntime', {
            metadata: { taskId, priority: task.priority },
        });
        // Track active task
        task.status = 'running';
        task.startedAt = Date.now();
        this.activeTasks.set(taskId, task);
        try {
            // 1. Select agent
            const agent = this.selectAgent(task);
            if (!agent) {
                throw new Error(`No suitable agent found for task: ${task.description}`);
            }
            this.logger.debug(`Agent selected: ${agent.getMetadata().type}`, 'AgentRuntime', {
                metadata: { taskId, agent: agent.getMetadata().type },
            });
            // 2. Build context
            const context = await this.buildContext(task, options);
            // 3. Execute with agent
            const result = await agent.execute(task, context, options);
            // 4. Update task status
            task.status = result.success ? 'completed' : 'failed';
            task.completedAt = Date.now();
            task.result = result;
            // 5. Record metrics
            this.metrics.recordMetric('agent.task.duration', task.completedAt - task.startedAt, {
                agent: agent.getMetadata().type,
                status: task.status,
            });
            this.logger.info(`Task execution ${task.status}: ${task.description}`, 'AgentRuntime', {
                metadata: { taskId, agent: agent.getMetadata().type, duration: task.completedAt - task.startedAt },
            });
            this.emit('task.completed', { task, result });
            return result;
        }
        catch (error) {
            task.status = 'failed';
            task.completedAt = Date.now();
            task.error = error instanceof Error ? error.message : String(error);
            this.logger.error(`Task execution failed: ${task.description}`, 'AgentRuntime', {
                metadata: { taskId, error: task.error },
                error: error instanceof Error ? error : undefined,
            });
            this.emit('task.failed', { task, error });
            return {
                success: false,
                message: `Task failed: ${task.error}`,
            };
        }
        finally {
            this.activeTasks.delete(taskId);
        }
    }
    /**
     * Select best agent for task
     */
    selectAgent(task) {
        if (task.assignedAgent) {
            return this.registry.get(task.assignedAgent) || null;
        }
        return this.registry.findBestAgent(task);
    }
    /**
     * Build execution context for agent
     */
    async buildContext(task, options) {
        const context = {
            task,
            // Memory access
            memory: {
                search: async (query) => {
                    return this.memoryService.search(query);
                },
                recall: async (conversationId) => {
                    return this.memoryService.getConversation(conversationId);
                },
                store: async (data) => {
                    await this.memoryService.createEntry({
                        content: JSON.stringify(data),
                        conversationId: task.id,
                        role: 'assistant',
                    });
                },
            },
            // Code intelligence access
            codeIntelligence: {
                findSymbol: async (name) => {
                    return this.fileService.findSymbol(name);
                },
                getCallGraph: async (functionName) => {
                    return this.fileService.getCallGraph(functionName);
                },
                searchCode: async (query) => {
                    const response = this.fileService.search(query);
                    return response.results;
                },
                analyzeQuality: async (filePath) => {
                    return this.fileService.analyzeQuality(filePath);
                },
            },
            // Provider access
            provider: {
                call: async (prompt, providerOptions) => {
                    return this.callProvider(prompt, options?.provider, providerOptions);
                },
                stream: async function* (prompt, providerOptions) {
                    // Streaming not implemented yet - return single response
                    const response = await this.call(prompt, providerOptions);
                    yield response;
                },
            },
            // Delegation
            delegate: async (agentType, taskDescription) => {
                return this.delegateTask(agentType, taskDescription, task);
            },
            // Monitoring
            monitoring: {
                recordMetric: (name, value) => {
                    this.metrics.recordMetric(name, value, { taskId: task.id });
                },
                startTrace: () => {
                    return this.tracer.startTrace(task.id);
                },
                startSpan: (traceId, name) => {
                    return this.tracer.startSpan(traceId, name, 'internal');
                },
                completeSpan: (spanId) => {
                    this.tracer.completeSpan(spanId);
                },
                log: (level, message) => {
                    const logMethod = this.logger[level];
                    if (typeof logMethod === 'function') {
                        logMethod.call(this.logger, message, 'AgentContext', {
                            metadata: { taskId: task.id },
                        });
                    }
                },
            },
        };
        return context;
    }
    /**
     * Call AI provider
     */
    async callProvider(prompt, preferredProvider, options) {
        const provider = preferredProvider || 'claude'; // Default to Claude
        try {
            let selectedProvider;
            switch (provider) {
                case 'claude':
                    selectedProvider = this.claudeProvider;
                    break;
                case 'gemini':
                    selectedProvider = this.geminiProvider;
                    break;
                case 'openai':
                    selectedProvider = this.openaiProvider;
                    break;
                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }
            const response = await selectedProvider.request({
                messages: [{ role: 'user', content: prompt }],
                maxTokens: options?.maxTokens || 4096,
                temperature: options?.temperature || 1.0,
                streaming: false,
                timeout: 60000,
            });
            return response.content;
        }
        catch (error) {
            this.logger.error(`Provider call failed: ${provider}`, 'AgentRuntime', {
                error: error instanceof Error ? error : undefined,
            });
            throw error;
        }
    }
    /**
     * Delegate task to another agent
     */
    async delegateTask(agentType, taskDescription, parentTask) {
        this.logger.info(`Delegating task to @${agentType}`, 'AgentRuntime', {
            metadata: { parentTaskId: parentTask.id, targetAgent: agentType },
        });
        const delegatedTask = {
            id: randomUUID(),
            description: taskDescription,
            priority: parentTask.priority,
            status: 'pending',
            assignedAgent: agentType,
            context: {
                ...parentTask.context,
                delegatedFrom: parentTask.id,
            },
            createdAt: Date.now(),
        };
        // Execute delegated task
        const result = await this.executeTask(delegatedTask);
        return result;
    }
    /**
     * Get active tasks
     */
    getActiveTasks() {
        return Array.from(this.activeTasks.values());
    }
    /**
     * Get task by ID
     */
    getTask(taskId) {
        return this.activeTasks.get(taskId);
    }
    /**
     * Cancel task
     */
    cancelTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            task.status = 'cancelled';
            task.completedAt = Date.now();
            this.activeTasks.delete(taskId);
            this.emit('task.cancelled', { task });
            return true;
        }
        return false;
    }
    /**
     * Get runtime statistics
     */
    getStats() {
        return {
            activeTasks: this.activeTasks.size,
            totalAgents: this.registry.size(),
            registryInitialized: this.registry.isInitialized(),
        };
    }
}
//# sourceMappingURL=AgentRuntime.js.map