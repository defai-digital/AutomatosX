import {
  createRuntimeBridgeService,
  type ImportSkillDocumentOptions,
  scoreSkillAgainstQuery as scoreSkillAgainstQueryShared,
  type ExportedSkillResult,
  type ImportedSkillResult,
  type SkillLoadFailure,
  type SkillLoadResult,
  type SkillLoadSuccess,
  type SkillSpec,
} from '@defai.digital/shared-runtime';

export type {
  ExportedSkillResult,
  ImportSkillDocumentOptions,
  ImportedSkillResult,
  SkillLoadFailure,
  SkillLoadResult,
  SkillLoadSuccess,
};

export async function discoverSkillDefinitions(basePath: string): Promise<SkillLoadResult[]> {
  return createRuntimeBridgeService({ basePath }).discoverSkillDefinitions();
}

export async function resolveSkillReference(
  basePath: string,
  reference: string,
): Promise<SkillLoadSuccess> {
  return createRuntimeBridgeService({ basePath }).resolveSkillReference(reference);
}

export async function loadRequiredSkillDefinition(
  basePath: string,
  path: string,
): Promise<SkillLoadSuccess> {
  return createRuntimeBridgeService({ basePath }).loadRequiredSkillDefinition(path);
}

export async function importSkillDocument(
  basePath: string,
  sourcePath: string,
  options?: ImportSkillDocumentOptions,
): Promise<ImportedSkillResult> {
  return createRuntimeBridgeService({ basePath }).importSkillDocument(sourcePath, options);
}

export async function exportSkillDocument(
  basePath: string,
  reference: string,
  outputPath: string,
): Promise<ExportedSkillResult> {
  return createRuntimeBridgeService({ basePath }).exportSkillDocument(reference, outputPath);
}

export function scoreSkillAgainstQuery(skill: SkillSpec, query: string): number {
  return scoreSkillAgainstQueryShared(skill, query);
}
