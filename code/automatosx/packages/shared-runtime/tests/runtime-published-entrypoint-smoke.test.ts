import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ensureWorkspaceBuilt } from '../../../tests/support/ensure-built.js';

const execFileAsync = promisify(execFile);
const SHARED_RUNTIME_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOT = resolve(SHARED_RUNTIME_PACKAGE_ROOT, '..', '..');

describe('shared-runtime published entrypoint smoke test', () => {
  it('resolves the built top-level and domain subpath entrypoints through Node package exports', async () => {
    await ensureWorkspaceBuilt();

    const workerSource = [
      'const top = await import("@defai.digital/shared-runtime");',
      'const bridge = await import("@defai.digital/shared-runtime/bridge");',
      'const governance = await import("@defai.digital/shared-runtime/governance");',
      'const catalog = await import("@defai.digital/shared-runtime/catalog");',
      'console.log(JSON.stringify({',
      '  topKeys: Object.keys(top).sort(),',
      '  topHasBridgeService: "createRuntimeBridgeService" in top,',
      '  topHasGovernanceSchema: "RuntimeGovernanceAggregateSchema" in top,',
      '  bridgeHasService: typeof bridge.createRuntimeBridgeService === "function",',
      '  governanceHasSchema: governance.RuntimeGovernanceAggregateSchema != null,',
      '  catalogHasWorkflowCatalog: typeof catalog.listWorkflowCatalog === "function",',
      '}));',
    ].join('\n');

    const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '--eval', workerSource], {
      cwd: WORKSPACE_ROOT,
      env: process.env,
    });

    const summary = JSON.parse(stdout) as {
      topKeys: string[];
      topHasBridgeService: boolean;
      topHasGovernanceSchema: boolean;
      bridgeHasService: boolean;
      governanceHasSchema: boolean;
      catalogHasWorkflowCatalog: boolean;
    };

    expect(summary.topKeys).toEqual(['createSharedRuntimeService']);
    expect(summary.topHasBridgeService).toBe(false);
    expect(summary.topHasGovernanceSchema).toBe(false);
    expect(summary.bridgeHasService).toBe(true);
    expect(summary.governanceHasSchema).toBe(true);
    expect(summary.catalogHasWorkflowCatalog).toBe(true);
  });
});
