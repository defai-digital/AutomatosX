import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getWorkspaceBuildChain, workspaceManifest } from './workspace-manifest.ts';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '..');

export async function buildWorkspacePackage(packageName: string): Promise<void> {
  const chain = getWorkspaceBuildChain(packageName);
  for (const entry of chain) {
    await execFileAsync('npm', ['run', 'build', '--workspace', entry.workspace], {
      cwd: repoRoot,
      env: process.env,
    });
  }
}

export async function buildAllWorkspaces(): Promise<void> {
  for (const entry of workspaceManifest) {
    await execFileAsync('npm', ['run', 'build', '--workspace', entry.workspace], {
      cwd: repoRoot,
      env: process.env,
    });
  }
}
