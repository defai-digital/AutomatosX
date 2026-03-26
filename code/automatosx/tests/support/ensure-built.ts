import { access, mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  getWorkspaceBuildEntry,
  workspaceBuildOutputs,
} from '../../tools/workspace-manifest.js';
import { buildAllWorkspaces, buildWorkspacePackage, repoRoot } from '../../tools/workspace-build.js';

const buildPromises = new Map<string, Promise<void>>();
const BUILD_LOCK_DIR = resolve(repoRoot, '.tmp', 'ensure-built-locks');
const BUILD_LOCK_STALE_MS = 5 * 60 * 1000;
const BUILD_LOCK_RETRY_MS = 100;

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

function getBuildLockPath(key: string): string {
  return join(BUILD_LOCK_DIR, key.replaceAll(/[^a-zA-Z0-9_-]/g, '-'));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function clearStaleBuildLock(lockPath: string): Promise<void> {
  try {
    const info = await stat(lockPath);
    if (Date.now() - info.mtimeMs > BUILD_LOCK_STALE_MS) {
      await rm(lockPath, { recursive: true, force: true });
    }
  } catch {
    return;
  }
}

async function withBuildLock(
  key: string,
  outputs: string[],
  build: () => Promise<void>,
): Promise<void> {
  const existing = buildPromises.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const buildPromise = (async () => {
    const lockPath = getBuildLockPath(key);
    await mkdir(BUILD_LOCK_DIR, { recursive: true });

    while (true) {
      if (await allOutputsExist(outputs)) {
        return;
      }

      try {
        await mkdir(lockPath);
        break;
      } catch {
        await clearStaleBuildLock(lockPath);
        await sleep(BUILD_LOCK_RETRY_MS);
      }
    }

    try {
      if (!(await allOutputsExist(outputs))) {
        await build();
      }
    } finally {
      await rm(lockPath, { recursive: true, force: true });
    }
  })();

  buildPromises.set(key, buildPromise);
  return buildPromise;
}

export async function ensureWorkspaceBuilt(): Promise<void> {
  if (await allOutputsExist(workspaceBuildOutputs)) {
    return;
  }
  return withBuildLock('workspace', workspaceBuildOutputs, () => buildAllWorkspaces());
}

export async function ensurePackageBuilt(packageName: string): Promise<void> {
  const entry = getWorkspaceBuildEntry(packageName);
  if (entry === undefined) {
    throw new Error(`Unknown build workspace: ${packageName}`);
  }

  if (await allOutputsExist([entry.buildOutput])) {
    return;
  }

  return withBuildLock(`package:${packageName}`, [entry.buildOutput], () => buildWorkspacePackage(packageName));
}
