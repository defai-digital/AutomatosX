import { join } from 'node:path';
import { z } from 'zod';
import { listStableAgentEntries } from '../agent-catalog.js';
import {
  buildCliGovernanceSnapshot,
} from '../utils/runtime-guard-summary.js';
import { readJsonObjectFile } from '../json-object-file.js';
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
    readJsonObjectFile(join(basePath, '.automatosx', 'environment.json')),
    readJsonObjectFile(join(basePath, '.automatosx', 'providers.json')),
  ]);

  const generatedAt = asOptionalString(environmentSnapshot?.generatedAt);
  const environmentProviders = asRecordArray(environmentSnapshot?.providers);
  const summaryProviders = asRecordArray(providerSummary?.providers);

  const detectedProviders = environmentProviders
    .filter((provider) => asOptionalString(provider.providerId) !== undefined && provider.installed === true)
    .map((provider) => asOptionalString(provider.providerId)!)
    .filter(uniqueStrings);
  const enabledProviders = summaryProviders
    .filter((provider) => asOptionalString(provider.providerId) !== undefined && provider.enabled === true)
    .map((provider) => asOptionalString(provider.providerId)!)
    .filter(uniqueStrings);
  const installedButDisabledProviders = summaryProviders
    .filter((provider) => asOptionalString(provider.providerId) !== undefined && provider.installed === true && provider.enabled !== true)
    .map((provider) => asOptionalString(provider.providerId)!)
    .filter(uniqueStrings);
  const configuredButUnavailableProviders = summaryProviders
    .filter((provider) => asOptionalString(provider.providerId) !== undefined && provider.enabled === true && provider.installed !== true)
    .map((provider) => asOptionalString(provider.providerId)!)
    .filter(uniqueStrings);

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
      configuredButUnavailableProviders: [],
    };
  }

  return {
    source: 'cached',
    generatedAt,
    detectedProviders,
    enabledProviders,
    installedButDisabledProviders,
    configuredButUnavailableProviders,
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

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    : [];
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function uniqueStrings(value: string, index: number, array: string[]): boolean {
  return array.indexOf(value) === index;
}
