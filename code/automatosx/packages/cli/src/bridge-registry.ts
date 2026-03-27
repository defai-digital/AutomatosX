import {
  createRuntimeBridgeService,
  type BridgeLoadFailure,
  type BridgeLoadResult,
  type BridgeLoadSuccess,
  type InstallBridgeDefinitionOptions,
  type InstalledBridgeResult,
} from '@defai.digital/shared-runtime/bridge';

export type {
  BridgeLoadFailure,
  BridgeLoadResult,
  BridgeLoadSuccess,
  InstallBridgeDefinitionOptions,
  InstalledBridgeResult,
};

export async function discoverBridgeDefinitions(basePath: string): Promise<BridgeLoadResult[]> {
  return createRuntimeBridgeService({ basePath }).discoverBridgeDefinitions();
}

export async function resolveBridgeReference(
  basePath: string,
  reference: string,
): Promise<BridgeLoadSuccess> {
  return createRuntimeBridgeService({ basePath }).resolveBridgeReference(reference);
}

export async function loadRequiredBridgeDefinition(
  basePath: string,
  path: string,
): Promise<BridgeLoadSuccess> {
  return createRuntimeBridgeService({ basePath }).loadRequiredBridgeDefinition(path);
}

export async function installBridgeDefinition(
  basePath: string,
  sourcePath: string,
  options?: InstallBridgeDefinitionOptions,
): Promise<InstalledBridgeResult> {
  return createRuntimeBridgeService({ basePath }).installBridgeDefinition(sourcePath, options);
}
