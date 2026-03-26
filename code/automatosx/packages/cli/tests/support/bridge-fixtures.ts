import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeDeniedInstalledBridge(
  basePath: string,
  options?: {
    bridgeId?: string;
    importedAt?: string;
    sourceRef?: string;
  },
): Promise<string> {
  const bridgeId = options?.bridgeId ?? 'guarded-installed-bridge';
  const bridgeDir = join(basePath, '.automatosx', 'bridges', bridgeId);
  const scriptPath = join(bridgeDir, 'echo.js');
  const bridgePath = join(bridgeDir, 'bridge.json');

  await mkdir(dirname(scriptPath), { recursive: true });
  await writeFile(scriptPath, "process.stdout.write('ok\\n');\n", 'utf8');
  await writeFile(bridgePath, `${JSON.stringify({
    schemaVersion: 1,
    bridgeId,
    name: 'Guarded Installed Bridge',
    version: '0.1.0',
    description: 'Represents an installed bridge that still requires trust approval.',
    kind: 'script',
    entrypoint: {
      type: 'script',
      path: './echo.js',
    },
    provenance: {
      importer: 'ax.bridge.install',
      importedAt: options?.importedAt ?? '2026-03-25T00:00:00.000Z',
      type: 'local-bridge-bundle',
      ref: options?.sourceRef ?? `fixtures/${bridgeId}`,
    },
    approval: {
      mode: 'prompt',
    },
  }, null, 2)}\n`, 'utf8');

  return bridgePath;
}
