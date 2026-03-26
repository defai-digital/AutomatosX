import {
  readCachedWorkspaceConfig,
  writeCachedWorkspaceConfig,
} from './workspace-config-cache.js';

export function listConfiguredExecutors(config: Record<string, unknown>): string[] {
  const providers = config.providers;
  if (providers === null || typeof providers !== 'object' || Array.isArray(providers)) {
    return [];
  }
  const executors = (providers as Record<string, unknown>).executors;
  if (executors === null || typeof executors !== 'object' || Array.isArray(executors)) {
    return [];
  }
  return Object.entries(executors)
    .filter(([, value]) => value !== null && typeof value === 'object' && !Array.isArray(value))
    .map(([providerId]) => providerId)
    .sort();
}

export async function readWorkspaceConfig(basePath: string): Promise<Record<string, unknown>> {
  return readCachedWorkspaceConfig(basePath);
}

export async function writeWorkspaceConfig(basePath: string, config: Record<string, unknown>): Promise<void> {
  await writeCachedWorkspaceConfig(basePath, config);
}

export function getValueAtPath(config: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter((part) => part.length > 0);
  let current: unknown = config;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

export function setValueAtPath(config: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error('config path is required');
  }
  let current: Record<string, unknown> = config;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const next = current[part];
    if (!isRecord(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
