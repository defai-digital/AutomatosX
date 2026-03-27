export const EXPECTED_TOP_LEVEL_RUNTIME_VALUE_EXPORTS = [
  'createSharedRuntimeService',
] as const;

export const EXPECTED_BRIDGE_PUBLIC_VALUE_EXPORTS = [
  'AUTOMATOSX_DIRECTORY',
  'BRIDGE_DIRECTORY',
  'SKILL_DIRECTORY',
  'CANONICAL_BRIDGE_FILE',
  'CANONICAL_SKILL_FILE',
  'SKILL_MARKDOWN_FILE',
  'BridgeKindSchema',
  'SkillDispatchModeSchema',
  'SkillSpecSchema',
  'BridgeArtifactSchema',
  'BridgeSpecSchema',
  'formatSchemaErrors',
  'resolveBridgeRoot',
  'resolveSkillRoot',
  'createRuntimeBridgeService',
  'installBridgeDefinition',
  'executeBridge',
  'importSkillDocument',
  'exportSkillDocument',
  'scoreSkillAgainstQuery',
] as const;

export const EXPECTED_GOVERNANCE_PUBLIC_VALUE_EXPORTS = [
  'evaluateBridgeExecutionTrust',
  'RuntimeGovernanceAggregateSchema',
  'extractRuntimeTraceGuardSummary',
  'buildRuntimeGovernanceAggregate',
  'buildDeniedImportedSkillAggregate',
] as const;

export const EXPECTED_CATALOG_PUBLIC_VALUE_EXPORTS = [
  'getDefaultAgentCatalogEntry',
  'getStableAgentEntry',
  'isStableCatalogAgentEntry',
  'listDefaultAgentCatalog',
  'listStableAgentCapabilities',
  'listStableAgentEntries',
  'recommendStableAgents',
  'toDefaultAgentRegistrations',
  'formatWorkflowInputSummary',
  'getWorkflowCatalogEntry',
  'listWorkflowCatalog',
  'isBundledWorkflowDir',
  'resolveBundledWorkflowDir',
  'resolveEffectiveWorkflowDir',
] as const;

export const EXPECTED_ALL_PUBLIC_VALUE_EXPORTS = [
  ...EXPECTED_TOP_LEVEL_RUNTIME_VALUE_EXPORTS,
  ...EXPECTED_BRIDGE_PUBLIC_VALUE_EXPORTS,
  ...EXPECTED_GOVERNANCE_PUBLIC_VALUE_EXPORTS,
  ...EXPECTED_CATALOG_PUBLIC_VALUE_EXPORTS,
] as const;

export const BLOCKED_INTERNAL_VALUE_EXPORTS = [
  'createRuntimeSkillService',
  'readAxBridgeTrustConfig',
  'buildImportedProvenance',
  'discoverBridgeDefinitions',
  'discoverSkillDefinitions',
  'resolveBridgeReference',
  'resolveSkillReference',
  'loadRequiredBridgeDefinition',
  'loadRequiredSkillDefinition',
  'createRuntimeExecutionService',
  'createRuntimeProviderCallService',
  'createRuntimeWorkflowRunnerService',
  'createWorkflowToolExecutor',
  'buildWorkflowGuardSummary',
  'createRuntimeDependencyResolvers',
  'ApprovalSpecSchema',
  'ProvenanceSpecSchema',
  'evaluateSkillExecutionTrust',
  'assertBridgeExecutionAllowed',
  'assertSkillExecutionAllowed',
  'RuntimeGovernanceError',
  'isRuntimeGovernanceError',
  'RuntimeTraceGuardSummarySchema',
  'RuntimeGovernanceAggregateEntrySchema',
  'DeniedImportedSkillAggregateEntrySchema',
  'DeniedImportedSkillAggregateSchema',
] as const;

export const EXPECTED_BRIDGE_CONTRACT_PUBLIC_TYPES = [
  'BridgeSpec',
  'SkillSpec',
] as const;

export const BLOCKED_BRIDGE_CONTRACT_TYPES = [
  'ApprovalSpec',
  'ProvenanceSpec',
] as const;

export const EXPECTED_BRIDGE_RUNTIME_PUBLIC_TYPES = [
  'BridgeLoadSuccess',
  'BridgeLoadFailure',
  'BridgeLoadResult',
  'InstallBridgeDefinitionOptions',
  'ImportSkillDocumentOptions',
  'InstalledBridgeResult',
  'SkillLoadSuccess',
  'SkillLoadFailure',
  'SkillLoadResult',
  'ImportedSkillResult',
  'ExportedSkillResult',
  'BridgeExecutionResult',
] as const;

export const BLOCKED_BRIDGE_RUNTIME_PUBLIC_TYPES = [
  'RuntimeBridgeService',
] as const;

export const EXPECTED_GOVERNANCE_SUMMARY_PUBLIC_TYPES = [
  'RuntimeTraceGuardSummary',
  'RuntimeGovernanceAggregateEntry',
  'RuntimeGovernanceAggregate',
  'RuntimeGovernanceTraceLike',
  'DeniedImportedSkillAggregateEntry',
  'DeniedImportedSkillAggregate',
] as const;

export const EXPECTED_REVIEW_PUBLIC_TYPES = [
  'ReviewFocus',
] as const;

export const BLOCKED_REVIEW_PUBLIC_TYPES = [
  'ReviewFinding',
  'ReviewSeverity',
  'RuntimeReviewResponse',
] as const;

export const EXPECTED_AGENT_CATALOG_PUBLIC_TYPES = [
  'DefaultAgentCatalogEntry',
  'StableAgentRecommendation',
] as const;

export const EXPECTED_WORKFLOW_CATALOG_PUBLIC_TYPES = [
  'StableWorkflowCatalogEntry',
] as const;

export const BLOCKED_WORKFLOW_CATALOG_PUBLIC_TYPES = [
  'StableWorkflowCommandId',
  'StableWorkflowRequiredInputMode',
] as const;

export const INTENTIONALLY_UNCONSUMED_RUNTIME_VALUE_EXPORTS = [
  'executeBridge',
  'exportSkillDocument',
  'importSkillDocument',
  'installBridgeDefinition',
] as const;
