/**
 * ContextManager - Build execution context for agent tasks
 * Provides environment and workspace information
 */
import { logger } from '../utils/logger.js';
import { loadAgentMessagesConfig } from '../config/AgentMessagesConfig.js';
/**
 * Manages execution context for agent tasks
 */
export class ContextManager {
    // REFACTORING #32: Load context formatting from YAML configuration
    messagesConfig;
    constructor() {
        this.messagesConfig = loadAgentMessagesConfig();
    }
    /**
     * Build execution context from task and options
     */
    async buildContext(task, options = {}) {
        const context = {
            task,
            timestamp: new Date(),
            cwd: process.cwd(),
            environment: process.env.NODE_ENV || 'development'
        };
        // Memory integration (Phase 3 - deferred for now)
        if (options.memory) {
            // REFACTORING #38: Use YAML-configured message
            logger.debug(this.messagesConfig.context.memoryNotImplemented);
            // context.memory = await this.loadMemory(task);
        }
        // Session context (Phase 3 - deferred for now)
        if (options.session) {
            // REFACTORING #38: Use YAML-configured message
            logger.debug(`${this.messagesConfig.context.sessionNotImplemented}: ${options.session} ${this.messagesConfig.context.sessionNotImplementedSuffix}`);
            // context.session = await this.loadSession(options.session);
        }
        return context;
    }
    /**
     * Format context for inclusion in prompts
     */
    formatContextForPrompt(context) {
        const parts = [];
        // REFACTORING #32: Use YAML-configured context header
        parts.push(`\n${this.messagesConfig.formatting.contextHeader}`);
        // REFACTORING #38: Use YAML-configured field labels
        parts.push(`${this.messagesConfig.context.workingDirectory}: ${context.cwd}`);
        parts.push(`${this.messagesConfig.context.environment}: ${context.environment}`);
        parts.push(`${this.messagesConfig.context.timestamp}: ${context.timestamp.toISOString()}`);
        if (context.memory && context.memory.length > 0) {
            parts.push(`\n${this.messagesConfig.context.relevantMemory}: ${context.memory.length} ${this.messagesConfig.context.entries}`);
        }
        return parts.join('\n');
    }
}
//# sourceMappingURL=ContextManager.js.map