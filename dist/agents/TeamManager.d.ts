/**
 * TeamManager - Load and manage team configurations
 * Restores v7.6.1 team system for v8.x
 */
import type { AgentProfile } from './ProfileLoader.js';
/**
 * Team configuration structure (from v7.6.1 YAML schema)
 */
export interface TeamConfig {
    name: string;
    displayName?: string;
    description: string;
    provider?: {
        primary: string;
        fallback?: string;
        fallbackChain?: string[];
    };
    sharedAbilities?: string[];
    capabilities?: {
        canDo?: string[];
        shouldDelegate?: string[];
    };
    orchestration?: {
        maxDelegationDepth: number;
        canWriteToShared?: boolean;
        canReadWorkspaces?: string[];
    };
    metadata?: {
        color?: string;
        icon?: string;
        priority?: number;
    };
    version?: string;
}
/**
 * Loads team configurations from .automatosx/teams/*.yaml files
 */
export declare class TeamManager {
    private messagesConfig;
    private runtimeConfig;
    private projectRoot;
    private teamCache;
    constructor(projectRoot?: string);
    /**
     * Load team configuration from YAML file
     */
    loadTeam(teamName: string): Promise<TeamConfig>;
    /**
     * Merge agent profile with team configuration
     * Team settings provide defaults that agent can override
     */
    mergeWithTeam(profile: AgentProfile): Promise<AgentProfile>;
    /**
     * List all available teams in .automatosx/teams/
     */
    listTeams(): Promise<string[]>;
    /**
     * Get detailed info about a team
     */
    getTeamInfo(teamName: string): Promise<{
        name: string;
        displayName?: string;
        description: string;
        sharedAbilities: number;
        provider?: string;
    }>;
    /**
     * Clear team cache (useful for testing)
     */
    clearCache(): void;
    /**
     * Resolve team configuration file path
     */
    private resolveTeamPath;
    /**
     * Validate team has required fields
     */
    private validateTeam;
}
//# sourceMappingURL=TeamManager.d.ts.map