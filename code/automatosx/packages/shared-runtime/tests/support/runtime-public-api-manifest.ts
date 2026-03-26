export const EXPECTED_RUNTIME_VALUE_EXPORTS = [
  'AUTOMATOSX_DIRECTORY',
  'ApprovalSpecSchema',
  'BRIDGE_DIRECTORY',
  'BridgeArtifactSchema',
  'BridgeKindSchema',
  'BridgeSpecSchema',
  'CANONICAL_BRIDGE_FILE',
  'CANONICAL_SKILL_FILE',
  'DeniedImportedSkillAggregateEntrySchema',
  'DeniedImportedSkillAggregateSchema',
  'ProvenanceSpecSchema',
  'RuntimeGovernanceAggregateEntrySchema',
  'RuntimeGovernanceAggregateSchema',
  'RuntimeGovernanceError',
  'RuntimeTraceGuardSummarySchema',
  'SKILL_DIRECTORY',
  'SKILL_MARKDOWN_FILE',
  'SkillDispatchModeSchema',
  'SkillSpecSchema',
  'assertBridgeExecutionAllowed',
  'assertSkillExecutionAllowed',
  'buildDeniedImportedSkillAggregate',
  'buildRuntimeGovernanceAggregate',
  'createRuntimeBridgeService',
  'createSharedRuntimeService',
  'evaluateBridgeExecutionTrust',
  'evaluateSkillExecutionTrust',
  'executeBridge',
  'exportSkillDocument',
  'extractRuntimeTraceGuardSummary',
  'formatSchemaErrors',
  'formatWorkflowInputSummary',
  'getDefaultAgentCatalogEntry',
  'getStableAgentEntry',
  'getWorkflowCatalogEntry',
  'importSkillDocument',
  'installBridgeDefinition',
  'isBundledWorkflowDir',
  'isRuntimeGovernanceError',
  'isStableCatalogAgentEntry',
  'listDefaultAgentCatalog',
  'listStableAgentCapabilities',
  'listStableAgentEntries',
  'listWorkflowCatalog',
  'recommendStableAgents',
  'resolveBridgeRoot',
  'resolveBundledWorkflowDir',
  'resolveEffectiveWorkflowDir',
  'resolveSkillRoot',
  'scoreSkillAgainstQuery',
  'toDefaultAgentRegistrations',
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
