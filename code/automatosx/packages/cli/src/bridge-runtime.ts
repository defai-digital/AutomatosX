import {
  createRuntimeBridgeService,
  type BridgeExecutionResult,
} from '@defai.digital/shared-runtime/bridge';
import type { BridgeLoadSuccess } from './bridge-registry.js';

export type { BridgeExecutionResult };

export async function executeBridge(
  basePath: string,
  bridge: BridgeLoadSuccess,
  userArgs: string[],
): Promise<BridgeExecutionResult> {
  return createRuntimeBridgeService({ basePath }).executeBridge(bridge, userArgs);
}
