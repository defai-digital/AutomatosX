import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const buildPromises = new Map<string, Promise<void>>();
const workspaceOutputs = [
  'packages/contracts/dist/index.js',
  'packages/workflow-engine/dist/index.js',
  'packages/state-store/dist/index.js',
  'packages/trace-store/dist/index.js',
  'packages/shared-runtime/dist/index.js',
  'packages/monitoring/dist/index.js',
  'packages/mcp-server/dist/index.js',
  'packages/cli/dist/main.js',
];

async function allOutputsExist(paths: string[]): Promise<boolean> {
  const results = await Promise.all(paths.map(async (path) => {
    try {
      await access(resolve(repoRoot, path));
      return true;
    } catch {
      return false;
    }
  }));
  return results.every(Boolean);
}

function runBuild(key: string, args: string[]): Promise<void> {
  const existing = buildPromises.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const buildPromise = execFileAsync('npm', args, {
    cwd: repoRoot,
    env: process.env,
  }).then(() => undefined);

  buildPromises.set(key, buildPromise);
  return buildPromise;
}

export async function ensureWorkspaceBuilt(): Promise<void> {
  if (await allOutputsExist(workspaceOutputs)) {
    return;
  }
  return runBuild('workspace', ['run', 'build']);
}

export async function ensurePackageBuilt(packageName: string): Promise<void> {
  if (await allOutputsExist([`packages/${packageName}/dist/index.js`])) {
    return;
  }
  return runBuild(`package:${packageName}`, ['run', 'build', '--workspace', `packages/${packageName}`]);
}
