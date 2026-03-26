import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { listStableAgentEntries } from '../agent-catalog.js';
import {
  buildCliGovernanceSnapshot,
} from '../utils/runtime-guard-summary.js';
import { parseJsonObjectString } from '../utils/validation.js';
import { loadMonitorWorkflows } from './monitor-workflows.js';
import type {
  MonitorApiState,
  MonitorConfig,
  MonitorProviderSnapshot,
  RuntimeService,
} from './monitor-types.js';

const DEFAULT_PORT_MIN = 3000;
const DEFAULT_PORT_MAX = 3999;
const PROVIDER_SNAPSHOT_TTL_MS = 10_000;

const environmentProviderSchema = z.object({
  providerId: z.string(),
  cli: z.string().optional(),
  installed: z.boolean().optional(),
});
const environmentSnapshotSchema = z.object({
  generatedAt: z.string().optional(),
  providers: z.array(environmentProviderSchema).optional(),
});
const providerSummaryEntrySchema = z.object({
  providerId: z.string().optional(),
  enabled: z.boolean().optional(),
  installed: z.boolean().optional(),
});
const providerSummarySchema = z.object({
  generatedBy: z.string().optional(),
  providers: z.array(providerSummaryEntrySchema).optional(),
});
const monitorConfigSchema = z.object({
  monitor: z.object({
    portMin: z.number().int().min(1).max(65535).optional(),
    portMax: z.number().int().min(1).max(65535).optional(),
    autoOpen: z.boolean().optional(),
  }).optional(),
});

export function resolveMonitorConfig(config: unknown): MonitorConfig {
  const parsed = monitorConfigSchema.safeParse(config);
  const monitor = parsed.success ? parsed.data.monitor : undefined;
  const portMin = monitor?.portMin ?? DEFAULT_PORT_MIN;
  const portMax = monitor?.portMax ?? DEFAULT_PORT_MAX;
  return {
    portMin: Math.min(portMin, portMax),
    portMax: Math.max(portMin, portMax),
    autoOpen: monitor?.autoOpen ?? true,
  };
}

export async function readCachedProviderSnapshot(basePath: string): Promise<MonitorProviderSnapshot> {
  const [environmentSnapshot, providerSummary] = await Promise.all([
    readJsonFile(join(basePath, '.automatosx', 'environment.json'), environmentSnapshotSchema),
    readJsonFile(join(basePath, '.automatosx', 'providers.json'), providerSummarySchema),
  ]);

  const detectedProviders = environmentSnapshot?.providers
    ?.filter((provider) => provider.installed === true)
    .map((provider) => provider.providerId) ?? [];
  const enabledProviders = providerSummary?.providers
    ?.filter((provider) => provider.enabled === true && typeof provider.providerId === 'string')
    .map((provider) => provider.providerId as string) ?? [];
  const installedButDisabledProviders = providerSummary?.providers
    ?.filter((provider) => provider.installed === true && provider.enabled !== true && typeof provider.providerId === 'string')
    .map((provider) => provider.providerId as string) ?? [];

  if (
    environmentSnapshot === undefined
    && providerSummary === undefined
    && detectedProviders.length === 0
    && enabledProviders.length === 0
  ) {
    return {
      source: 'unavailable',
      detectedProviders: [],
      enabledProviders: [],
      installedButDisabledProviders: [],
    };
  }

  return {
    source: 'cached',
    generatedAt: environmentSnapshot?.generatedAt,
    detectedProviders,
    enabledProviders,
    installedButDisabledProviders,
  };
}

export function createProviderSnapshotLoader(basePath: string): () => Promise<MonitorProviderSnapshot> {
  let cachedValue: MonitorProviderSnapshot | undefined;
  let cachedAt = 0;
  let pending: Promise<MonitorProviderSnapshot> | undefined;

  return async () => {
    const now = Date.now();
    if (cachedValue !== undefined && now - cachedAt < PROVIDER_SNAPSHOT_TTL_MS) {
      return cachedValue;
    }
    if (pending !== undefined) {
      return pending;
    }

    pending = readCachedProviderSnapshot(basePath)
      .then((snapshot) => {
        cachedValue = snapshot;
        cachedAt = Date.now();
        return snapshot;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}

export async function readMonitorConfig(runtime: RuntimeService): Promise<MonitorConfig> {
  try {
    return resolveMonitorConfig(await runtime.showConfig());
  } catch {
    return resolveMonitorConfig(undefined);
  }
}

export async function buildMonitorState(
  runtime: RuntimeService,
  loadProviderSnapshot: () => Promise<MonitorProviderSnapshot>,
  basePath: string,
  workflowDir: string | undefined,
  limit: number,
): Promise<MonitorApiState> {
  const [status, sessions, traces, agents, workflows, providers] = await Promise.all([
    runtime.getStatus({ limit }),
    runtime.listSessions(),
    runtime.listTraces(limit),
    runtime.listAgents(),
    loadMonitorWorkflows(runtime, basePath, workflowDir),
    loadProviderSnapshot(),
  ]);
  const { governance, deniedInstalledBridges } = await buildCliGovernanceSnapshot(basePath, status.recentFailedTraces);

  return {
    status,
    governance,
    deniedInstalledBridges,
    sessions,
    traces,
    agents: listStableAgentEntries(agents),
    workflows,
    providers,
  };
}

async function readJsonFile<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = parseJsonObjectString(raw);
    if (parsed.error !== undefined) {
      return undefined;
    }
    const result = schema.safeParse(parsed.value);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
