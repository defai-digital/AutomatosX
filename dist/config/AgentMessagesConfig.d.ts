/**
 * AgentMessagesConfig.ts
 * REFACTORING #23: Load agent messages from YAML
 * Replaces hard-coded error/log messages in AgentBase, AgentCollaborator, AgentExecutor
 */
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
export interface AgentLogMessages {
    handling: string;
    analyzing: string;
    completed: string;
    failed: string;
    codeContextFailed: string;
    memoryContextFailed: string;
}
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
    agentLogs: AgentLogMessages;
    formatting: FormattingConfig;
    abilities: AbilitiesMessages;
    context: ContextMessages;
}
/**
 * Load agent messages configuration from YAML (with caching)
 */
export declare function loadAgentMessagesConfig(): AgentMessagesConfig;
/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export declare function clearAgentMessagesConfigCache(): void;
//# sourceMappingURL=AgentMessagesConfig.d.ts.map