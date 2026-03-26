import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

interface CachedWorkspaceConfig {
  mtimeMs: number | null;
  config: Record<string, unknown>;
}

const workspaceConfigCache = new Map<string, CachedWorkspaceConfig>();
const workspaceConfigLoads = new Map<string, Promise<Record<string, unknown>>>();
const workspaceConfigSchema = z.record(z.string(), z.unknown());

export async function readCachedWorkspaceConfig(basePath: string): Promise<Record<string, unknown>> {
  const configPath = join(basePath, '.automatosx', 'config.json');
  const existingLoad = workspaceConfigLoads.get(configPath);
  if (existingLoad !== undefined) {
    return existingLoad;
  }

  const load = loadWorkspaceConfig(configPath);
  workspaceConfigLoads.set(configPath, load);
  try {
    return await load;
  } finally {
    if (workspaceConfigLoads.get(configPath) === load) {
      workspaceConfigLoads.delete(configPath);
    }
  }
}

export async function writeCachedWorkspaceConfig(
  basePath: string,
  config: Record<string, unknown>,
): Promise<void> {
  const configPath = join(basePath, '.automatosx', 'config.json');
  await mkdir(join(basePath, '.automatosx'), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  const mtimeMs = await readConfigMtime(configPath);
  workspaceConfigCache.set(configPath, { mtimeMs, config });
}

async function loadWorkspaceConfig(configPath: string): Promise<Record<string, unknown>> {
  const mtimeMs = await readConfigMtime(configPath);
  const cached = workspaceConfigCache.get(configPath);
  if (cached !== undefined && cached.mtimeMs === mtimeMs) {
    return cached.config;
  }

  if (mtimeMs === null) {
    const empty = {};
    workspaceConfigCache.set(configPath, { mtimeMs: null, config: empty });
    return empty;
  }

  try {
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const result = workspaceConfigSchema.safeParse(parsed);
    const config = result.success ? result.data : {};
    workspaceConfigCache.set(configPath, { mtimeMs, config });
    return config;
  } catch {
    const empty = {};
    workspaceConfigCache.set(configPath, { mtimeMs: null, config: empty });
    return empty;
  }
}

async function readConfigMtime(configPath: string): Promise<number | null> {
  try {
    const stats = await stat(configPath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}
