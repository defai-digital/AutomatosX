/**
 * TaskDecompositionConfig.ts
 * REFACTORING #17: Load task decomposition rules from YAML
 * Replaces hard-coded keyword arrays in AgentCollaborator
 */
import { AgentType } from '../types/agents.types.js';
export interface DecompositionRule {
    id: string;
    keywords: string[];
    agentType: AgentType;
    description: string;
    priority: number;
    idSuffix: string;
    createDependency?: boolean;
}
export interface DefaultRule {
    agentType: AgentType;
    description: string;
    priority: number;
    idSuffix: string;
}
export interface TaskDecompositionConfig {
    version: string;
    rules: DecompositionRule[];
    default: DefaultRule;
}
/**
 * Load task decomposition rules from YAML configuration (with caching)
 */
export declare function loadTaskDecompositionConfig(): TaskDecompositionConfig;
/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export declare function clearTaskDecompositionConfigCache(): void;
//# sourceMappingURL=TaskDecompositionConfig.d.ts.map