/**
 * TaskDecompositionConfig.ts
 * REFACTORING #17: Load task decomposition rules from YAML
 * Replaces hard-coded keyword arrays in AgentCollaborator
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
// BUG FIX #36: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// BUG FIX #32: Cache configuration to avoid redundant file reads
// AgentCollaborator loads this config in constructor
let cachedConfig = null;
/**
 * Load task decomposition rules from YAML configuration (with caching)
 */
export function loadTaskDecompositionConfig() {
    // Return cached config if available
    if (cachedConfig) {
        return cachedConfig;
    }
    const configPath = join(__dirname, 'yaml', 'task-decomposition-rules.yaml');
    try {
        const yamlContent = readFileSync(configPath, 'utf-8');
        const config = YAML.parse(yamlContent);
        // Validate config
        if (!config.version || !config.rules || !config.default) {
            throw new Error('Invalid task decomposition config: missing required fields');
        }
        // Cache for future calls
        cachedConfig = config;
        return config;
    }
    catch (error) {
        // BUG FIX #37: Only cache default config for ENOENT errors
        // For validation/parse errors, don't cache so user can fix and retry
        const shouldCache = error instanceof Error && 'code' in error && error.code === 'ENOENT';
        console.warn('Failed to load task decomposition config, using defaults:', error);
        const defaultConfig = getDefaultTaskDecompositionConfig();
        if (shouldCache) {
            cachedConfig = defaultConfig;
        }
        return defaultConfig;
    }
}
/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export function clearTaskDecompositionConfigCache() {
    cachedConfig = null;
}
/**
 * Get default configuration (fallback if YAML fails to load)
 */
function getDefaultTaskDecompositionConfig() {
    return {
        version: '1.0',
        rules: [
            {
                id: 'database',
                keywords: ['database', 'schema', 'table', 'sql', 'query'],
                agentType: 'database',
                description: 'Design database schema and queries',
                priority: 10,
                idSuffix: 'db',
            },
            {
                id: 'api',
                keywords: ['api', 'endpoint', 'rest', 'graphql', 'route'],
                agentType: 'api',
                description: 'Design and implement API endpoints',
                priority: 9,
                idSuffix: 'api',
                createDependency: true,
            },
            {
                id: 'security',
                keywords: ['security', 'auth', 'authentication', 'authorization', 'secure'],
                agentType: 'security',
                description: 'Implement security and authentication',
                priority: 8,
                idSuffix: 'sec',
                createDependency: true,
            },
            {
                id: 'testing',
                keywords: ['test', 'testing', 'tests', 'coverage', 'quality'],
                agentType: 'quality',
                description: 'Write comprehensive tests',
                priority: 7,
                idSuffix: 'test',
                createDependency: true,
            },
            {
                id: 'documentation',
                keywords: ['document', 'documentation', 'docs', 'readme'],
                agentType: 'writer',
                description: 'Write documentation',
                priority: 6,
                idSuffix: 'doc',
                createDependency: true,
            },
        ],
        default: {
            agentType: 'backend',
            description: '',
            priority: 10,
            idSuffix: 'main',
        },
    };
}
//# sourceMappingURL=TaskDecompositionConfig.js.map