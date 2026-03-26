export {
  AUTOMATOSX_DIRECTORY,
  BRIDGE_DIRECTORY,
  SKILL_DIRECTORY,
  CANONICAL_BRIDGE_FILE,
  CANONICAL_SKILL_FILE,
  SKILL_MARKDOWN_FILE,
  BridgeKindSchema,
  SkillDispatchModeSchema,
  SkillSpecSchema,
  BridgeArtifactSchema,
  BridgeSpecSchema,
  formatSchemaErrors,
  resolveBridgeRoot,
  resolveSkillRoot,
} from './bridge-contracts.js';
export type {
  BridgeSpec,
  SkillSpec,
} from './bridge-contracts.js';

export {
  createRuntimeBridgeService,
  installBridgeDefinition,
  executeBridge,
  importSkillDocument,
  exportSkillDocument,
  scoreSkillAgainstQuery,
} from './bridge-runtime-service.js';
export type {
  BridgeLoadSuccess,
  BridgeLoadFailure,
  BridgeLoadResult,
  InstallBridgeDefinitionOptions,
  ImportSkillDocumentOptions,
  InstalledBridgeResult,
  SkillLoadSuccess,
  SkillLoadFailure,
  SkillLoadResult,
  ImportedSkillResult,
  ExportedSkillResult,
  BridgeExecutionResult,
} from './bridge-runtime-service.js';
