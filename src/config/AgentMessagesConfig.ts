/**
 * AgentMessagesConfig.ts
 * REFACTORING #23: Load agent messages from YAML
 * Replaces hard-coded error/log messages in AgentBase, AgentCollaborator, AgentExecutor
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

// BUG FIX #36: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ErrorMessages {
  taskTimeout: string;
  taskFailed: string;
}

export interface FileErrorMessages {
  profileNotFound: string;
  teamNotFound: string;
  abilityNotFound: string;
  invalidProfile: string;
  invalidTeam: string;
  missingField: string;
  invalidFieldType: string;
  failedToLoad: string;
  failedToList: string;
  failedToMerge: string;
  usingProfileAsIs: string;
}

export interface RegistryErrorMessages {
  alreadyRegistered: string;
  noSuitableAgent: string;
  unknownProvider: string;
  taskExecutionFailed: string;
  providerCallFailed: string;
}

export interface CollaborationMessages {
  dependenciesNotMet: string;
  subtaskFailed: string;
  allSubtasksFailed: string;
  agentNotFound: string;
  circularDependency: string;
  dependencyNotFound: string;
  taskProceedWithoutDependency: string;
}

export interface LoggingMessages {
  executingAgent: string;
  executionCompleted: string;
  executionFailed: string;
}

export interface FormattingConfig {
  messageSeparator: string;
  taskHeader: string;
  ellipsis: string;
  contextHeader: string;
}

export interface AbilitiesMessages {
  header: string;
  intro: string;
  footer: string;
  separator: string;
}

// REFACTORING #37: Agent-specific log message templates
export interface AgentLogMessages {
  handling: string;
  analyzing: string;
  completed: string;
  failed: string;
  codeContextFailed: string;
  memoryContextFailed: string;
}

// REFACTORING #38: Context manager string templates
export interface ContextMessages {
  workingDirectory: string;
  environment: string;
  timestamp: string;
  relevantMemory: string;
  entries: string;
  memoryNotImplemented: string;
  sessionNotImplemented: string;
  sessionNotImplementedSuffix: string;
}

export interface AgentMessagesConfig {
  version: string;
  errors: ErrorMessages;
  fileErrors: FileErrorMessages;
  registry: RegistryErrorMessages;
  collaboration: CollaborationMessages;
  logging: LoggingMessages;
  agentLogs: AgentLogMessages;  // REFACTORING #37
  formatting: FormattingConfig;
  abilities: AbilitiesMessages;
  context: ContextMessages;  // REFACTORING #38
}

// BUG FIX #32: Cache configuration to avoid redundant file reads
// Without caching, each AgentExecutor creates 4 helper classes that each load this config,
// resulting in 5 synchronous readFileSync() calls for the same file per AgentExecutor instance
let cachedConfig: AgentMessagesConfig | null = null;

/**
 * Load agent messages configuration from YAML (with caching)
 */
export function loadAgentMessagesConfig(): AgentMessagesConfig {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = join(__dirname, 'yaml', 'agent-messages-config.yaml');

  try {
    const yamlContent = readFileSync(configPath, 'utf-8');
    const config = YAML.parse(yamlContent) as AgentMessagesConfig;

    // Validate config
    // REFACTORING #37-38: Add validation for new agentLogs and context fields
    if (!config.version || !config.errors || !config.fileErrors || !config.registry || !config.collaboration || !config.logging || !config.agentLogs || !config.formatting || !config.abilities || !config.context) {
      throw new Error('Invalid agent messages config: missing required fields');
    }

    // Cache for future calls
    cachedConfig = config;
    return config;
  } catch (error) {
    // BUG FIX #37: Only cache default config for ENOENT errors
    // For validation/parse errors, don't cache so user can fix and retry
    const shouldCache = error instanceof Error && 'code' in error && error.code === 'ENOENT';

    console.warn('Failed to load agent messages config, using defaults:', error);
    const defaultConfig = getDefaultAgentMessagesConfig();

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
export function clearAgentMessagesConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get default configuration (fallback if YAML fails to load)
 */
function getDefaultAgentMessagesConfig(): AgentMessagesConfig {
  return {
    version: '1.0',
    errors: {
      taskTimeout: 'Task execution timeout',
      taskFailed: 'Task failed after',
    },
    fileErrors: {
      profileNotFound: 'Agent profile not found',
      teamNotFound: 'Team configuration not found',
      abilityNotFound: 'Ability not found',
      invalidProfile: 'Invalid agent profile',
      invalidTeam: 'Invalid team configuration',
      missingField: 'missing required field',
      invalidFieldType: 'field must be an array',
      failedToLoad: 'Failed to load',
      failedToList: 'Failed to list',
      failedToMerge: 'Failed to merge with team',
      usingProfileAsIs: 'using agent profile as-is',
    },
    registry: {
      alreadyRegistered: 'Agent already registered',
      noSuitableAgent: 'No suitable agent found for task',
      unknownProvider: 'Unknown provider',
      taskExecutionFailed: 'Task execution failed',
      providerCallFailed: 'Provider call failed',
    },
    collaboration: {
      dependenciesNotMet: 'Dependencies not met',
      subtaskFailed: 'Subtask failed',
      allSubtasksFailed: 'All subtasks failed',
      agentNotFound: 'Agent not found',
      circularDependency: 'Circular dependency detected',
      dependencyNotFound: 'Dependency not found',
      taskProceedWithoutDependency: 'Task will proceed without this dependency',
    },
    logging: {
      executingAgent: 'Executing agent',
      executionCompleted: 'Agent execution completed',
      executionFailed: 'Agent execution failed',
    },
    // REFACTORING #37: Add default agent log messages
    agentLogs: {
      handling: 'handling',
      analyzing: 'analyzing',
      completed: 'completed task successfully',
      failed: 'failed',
      codeContextFailed: 'Failed to gather code context',
      memoryContextFailed: 'Failed to gather memory context',
    },
    formatting: {
      messageSeparator: '\n\n---\n\n',
      taskHeader: '# User Task',
      ellipsis: '...',
      contextHeader: '# Execution Context',
    },
    abilities: {
      header: '# Your Specialized Abilities',
      intro: 'You have access to the following specialized knowledge and capabilities:',
      footer: 'Use these abilities to provide expert-level assistance in your responses.',
      separator: '\n\n---\n\n',
    },
    // REFACTORING #38: Add default context messages
    context: {
      workingDirectory: 'Working Directory',
      environment: 'Environment',
      timestamp: 'Timestamp',
      relevantMemory: 'Relevant Memory',
      entries: 'entries',
      memoryNotImplemented: 'Memory integration requested (not yet implemented)',
      sessionNotImplemented: 'Session integration requested',
      sessionNotImplementedSuffix: '(not yet implemented)',
    },
  };
}
