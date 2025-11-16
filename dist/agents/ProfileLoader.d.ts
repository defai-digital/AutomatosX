/**
 * ProfileLoader - Load and validate YAML agent profiles
 * Restores v7.6.1 agent system for v8.x
 */
/**
 * Agent profile structure (from v7.6.1 YAML schema)
 */
export interface AgentProfile {
    name: string;
    displayName?: string;
    team?: string;
    role: string;
    description: string;
    abilities: string[];
    abilitySelection?: {
        core: string[];
        taskBased: Record<string, string[]>;
    };
    providers?: {
        default: string;
        fallback?: string[];
    };
    orchestration?: {
        maxDelegationDepth: number;
        canReadWorkspaces?: string[];
        canWriteToShared?: boolean;
    };
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
}
/**
 * Loads agent profiles from .automatosx/agents/*.yaml files
 */
export declare class ProfileLoader {
    private messagesConfig;
    private projectRoot;
    private profileCache;
    constructor(projectRoot?: string);
    /**
     * Load agent profile from YAML file
     */
    loadProfile(agentName: string): Promise<AgentProfile>;
    /**
     * List all available agents in .automatosx/agents/
     */
    listAgents(): Promise<string[]>;
    /**
     * Get detailed info about an agent
     */
    getAgentInfo(agentName: string): Promise<{
        name: string;
        displayName?: string;
        role: string;
        description: string;
        team?: string;
        abilities: number;
    }>;
    /**
     * Clear profile cache (useful for testing)
     */
    clearCache(): void;
    /**
     * Resolve agent profile file path
     */
    private resolveProfilePath;
    /**
     * Validate profile has required fields
     */
    private validateProfile;
}
//# sourceMappingURL=ProfileLoader.d.ts.map