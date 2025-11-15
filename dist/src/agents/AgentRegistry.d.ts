/**
 * AgentRegistry.ts
 *
 * Central registry for all AI agents
 * Phase 7: Agent System Implementation - Day 1
 */
import { AgentBase } from './AgentBase.js';
import { AgentType, AgentMetadata, Task } from '../types/agents.types.js';
/**
 * AgentRegistry - Central registry for all agents
 *
 * Provides:
 * - Agent registration and discovery
 * - Agent selection by capability
 * - Agent metadata lookup
 * - List available agents
 */
export declare class AgentRegistry {
    private agents;
    private initialized;
    /**
     * Register an agent
     */
    register(agent: AgentBase): void;
    /**
     * Get agent by type
     */
    get(type: AgentType): AgentBase | undefined;
    /**
     * Get all registered agents
     */
    getAll(): AgentBase[];
    /**
     * Get all agent types
     */
    getTypes(): AgentType[];
    /**
     * Get agent metadata by type
     */
    getMetadata(type: AgentType): AgentMetadata | undefined;
    /**
     * Get all agent metadata
     */
    getAllMetadata(): AgentMetadata[];
    /**
     * Find best agent for a task based on capability matching
     */
    findBestAgent(task: Task): AgentBase | null;
    /**
     * Find multiple agents by capability (for collaboration)
     */
    findAgentsByCapability(capability: string): AgentBase[];
    /**
     * Search agents by keywords
     */
    searchAgents(keywords: string[]): AgentBase[];
    /**
     * Get agents by specialization
     */
    getAgentsBySpecialization(specialization: string): AgentBase[];
    /**
     * Check if agent is registered
     */
    has(type: AgentType): boolean;
    /**
     * Unregister an agent
     */
    unregister(type: AgentType): boolean;
    /**
     * Clear all agents
     */
    clear(): void;
    /**
     * Get registry size
     */
    size(): number;
    /**
     * Mark registry as initialized
     */
    markInitialized(): void;
    /**
     * Check if registry is initialized
     */
    isInitialized(): boolean;
    /**
     * Get registry statistics
     */
    getStats(): {
        totalAgents: number;
        agentTypes: AgentType[];
        totalCapabilities: number;
        totalSpecializations: number;
        initialized: boolean;
    };
    /**
     * Validate registry (ensure all required agents are registered)
     */
    validate(): {
        valid: boolean;
        missingAgents: AgentType[];
    };
    /**
     * Export registry as JSON
     */
    toJSON(): any;
}
//# sourceMappingURL=AgentRegistry.d.ts.map