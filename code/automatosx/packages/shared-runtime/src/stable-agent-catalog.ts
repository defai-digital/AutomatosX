import type { AgentEntry } from '@defai.digital/state-store';
import { listWorkflowCatalog } from './stable-workflow-catalog.js';

interface DefaultAgentMetadata {
  description: string;
  team: string;
  useCases: string[];
  notFor: string[];
  recommendedCommands?: string[];
}

export interface DefaultAgentCatalogEntry {
  agentId: string;
  name: string;
  capabilities: string[];
  metadata: DefaultAgentMetadata;
}

const DEFAULT_AGENT_CATALOG: readonly DefaultAgentCatalogEntry[] = [
  {
    agentId: 'architect',
    name: 'Architect',
    capabilities: ['adr', 'architecture', 'planning'],
    metadata: {
      description: 'Turns requirements into architecture proposals, ADRs, and phased implementation plans.',
      team: 'core',
      useCases: [
        'new system design',
        'cross-cutting refactors',
        'tradeoff analysis and phased planning',
      ],
      notFor: [
        'bug triage',
        'release note drafting',
      ],
    },
  },
  {
    agentId: 'quality',
    name: 'Quality',
    capabilities: ['bug-hunting', 'qa', 'review'],
    metadata: {
      description: 'Reviews change readiness, audits risk, and validates QA scenarios.',
      team: 'core',
      useCases: [
        'ship readiness reviews',
        'repo or subsystem audits',
        'user-facing QA validation',
      ],
      notFor: [
        'high-level architecture design',
        'release package drafting',
      ],
    },
  },
  {
    agentId: 'bug-hunter',
    name: 'Bug Hunter',
    capabilities: ['debugging', 'regression-analysis'],
    metadata: {
      description: 'Investigates regressions, isolates failures, and narrows root causes.',
      team: 'core',
      recommendedCommands: ['ax agent run bug-hunter --task "<debug target>"'],
      useCases: [
        'regression investigation',
        'root-cause analysis',
        'narrowing a failing subsystem',
      ],
      notFor: [
        'new feature architecture',
        'release communications',
      ],
    },
  },
  {
    agentId: 'release-manager',
    name: 'Release Manager',
    capabilities: ['changelog', 'release', 'rollout'],
    metadata: {
      description: 'Packages release highlights, upgrade notes, and deployment follow-up actions.',
      team: 'core',
      useCases: [
        'release notes drafting',
        'upgrade guidance',
        'deployment checklists',
      ],
      notFor: [
        'architecture planning',
        'interactive QA execution',
      ],
    },
  },
] as const;

const DEFAULT_AGENT_CATALOG_BY_ID = new Map(
  DEFAULT_AGENT_CATALOG.map((entry) => [entry.agentId, entry] as const),
);

export const STABLE_CATALOG_AGENT_SOURCE = 'stable-catalog';
const STABLE_CATALOG_REGISTRATION_PREFIX = 'stable-catalog:';

export function listDefaultAgentCatalog(): DefaultAgentCatalogEntry[] {
  return DEFAULT_AGENT_CATALOG.map(cloneCatalogEntry);
}

export function getDefaultAgentCatalogEntry(agentId: string): DefaultAgentCatalogEntry | undefined {
  const entry = DEFAULT_AGENT_CATALOG_BY_ID.get(agentId);
  return entry === undefined ? undefined : cloneCatalogEntry(entry);
}

export function toDefaultAgentRegistrations(): Array<{
  agentId: string;
  name: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
}> {
  return listDefaultAgentCatalog().map((entry) => ({
    agentId: entry.agentId,
    name: entry.name,
    capabilities: [...entry.capabilities],
    metadata: buildAgentMetadata(entry),
  }));
}

export function enrichAgentEntry<T extends AgentEntry>(agent: T): T {
  const catalogEntry = getDefaultAgentCatalogEntry(agent.agentId);
  if (catalogEntry === undefined) {
    return agent;
  }

  const existingMetadata = isRecord(agent.metadata) ? agent.metadata : undefined;
  const metadata = {
    ...buildAgentMetadata(catalogEntry),
    ...(existingMetadata ?? {}),
  };
  const capabilities = [...new Set([
    ...agent.capabilities,
    ...catalogEntry.capabilities,
  ])];

  return {
    ...agent,
    name: agent.name.length > 0 ? agent.name : catalogEntry.name,
    capabilities,
    metadata,
  };
}

export function listStableAgentEntries(agents: AgentEntry[]): AgentEntry[] {
  const registeredById = new Map(
    agents.map((agent) => [agent.agentId, enrichAgentEntry(agent)] as const),
  );
  const merged: AgentEntry[] = [];

  for (const catalogEntry of DEFAULT_AGENT_CATALOG) {
    const registered = registeredById.get(catalogEntry.agentId);
    if (registered !== undefined) {
      merged.push(registered);
      registeredById.delete(catalogEntry.agentId);
      continue;
    }
    merged.push(createStableCatalogAgentEntry(catalogEntry));
  }

  return [
    ...merged,
    ...registeredById.values(),
  ];
}

export function getStableAgentEntry(agentId: string, agent?: AgentEntry): AgentEntry | undefined {
  if (agent !== undefined) {
    return enrichAgentEntry(agent);
  }

  const catalogEntry = getDefaultAgentCatalogEntry(agentId);
  return catalogEntry === undefined ? undefined : createStableCatalogAgentEntry(catalogEntry);
}

export function listStableAgentCapabilities(agents: AgentEntry[]): string[] {
  return [...new Set(
    listStableAgentEntries(agents)
      .flatMap((agent) => agent.capabilities),
  )].sort((left, right) => left.localeCompare(right));
}

export function isStableCatalogAgentEntry(agent: Pick<AgentEntry, 'registrationKey' | 'metadata'>): boolean {
  return agent.registrationKey.startsWith(STABLE_CATALOG_REGISTRATION_PREFIX)
    || (isRecord(agent.metadata) && agent.metadata.source === STABLE_CATALOG_AGENT_SOURCE);
}

export interface StableAgentRecommendation {
  agentId: string;
  name: string;
  capabilities: string[];
  score: number;
  confidence: number;
  reasons: string[];
  metadata?: Record<string, unknown>;
}

export function recommendStableAgents(request: {
  agents: AgentEntry[];
  task: string;
  requiredCapabilities?: string[];
  team?: string;
  limit?: number;
}): StableAgentRecommendation[] {
  const team = request.team?.trim().toLowerCase();
  const requiredCapabilities = normalizeRequiredCapabilities(request.requiredCapabilities);
  const taskTokens = tokenizeForMatching(request.task);
  const ranked = listStableAgentEntries(request.agents)
    .filter((agent) => {
      if (requiredCapabilities.length > 0) {
        const capabilitySet = new Set(agent.capabilities.map((entry) => entry.toLowerCase()));
        if (!requiredCapabilities.every((capability) => capabilitySet.has(capability))) {
          return false;
        }
      }

      if (team !== undefined) {
        return normalizeMetadataString(agent.metadata, 'team') === team;
      }

      return true;
    })
    .map((agent) => scoreStableAgentRecommendation(agent, taskTokens, requiredCapabilities))
    .sort((left, right) => (
      right.score - left.score
      || right.confidence - left.confidence
      || left.agentId.localeCompare(right.agentId)
    ));

  return request.limit === undefined
    ? ranked
    : ranked.slice(0, Math.max(0, request.limit));
}

function cloneCatalogEntry(entry: DefaultAgentCatalogEntry): DefaultAgentCatalogEntry {
  return {
    agentId: entry.agentId,
    name: entry.name,
    capabilities: [...entry.capabilities],
    metadata: {
      ...entry.metadata,
      useCases: [...entry.metadata.useCases],
      notFor: [...entry.metadata.notFor],
      ...(entry.metadata.recommendedCommands === undefined
        ? {}
        : { recommendedCommands: [...entry.metadata.recommendedCommands] }),
    },
  };
}

function buildAgentMetadata(entry: DefaultAgentCatalogEntry): Record<string, unknown> {
  const recommendedCommands = [
    ...(entry.metadata.recommendedCommands ?? []),
    ...listOwnedWorkflowIds(entry.agentId).map((workflowId) => `ax ${workflowId}`),
  ];

  return {
    description: entry.metadata.description,
    team: entry.metadata.team,
    ownedWorkflows: listOwnedWorkflowIds(entry.agentId),
    recommendedCommands: [...new Set(recommendedCommands)],
    useCases: [...entry.metadata.useCases],
    notFor: [...entry.metadata.notFor],
  };
}

function createStableCatalogAgentEntry(entry: DefaultAgentCatalogEntry): AgentEntry {
  return {
    agentId: entry.agentId,
    name: entry.name,
    capabilities: [...entry.capabilities],
    metadata: {
      ...buildAgentMetadata(entry),
      source: STABLE_CATALOG_AGENT_SOURCE,
    },
    registrationKey: `${STABLE_CATALOG_REGISTRATION_PREFIX}${entry.agentId}`,
    registeredAt: '',
    updatedAt: '',
  };
}

function scoreStableAgentRecommendation(
  agent: AgentEntry,
  taskTokens: string[],
  requiredCapabilities: string[],
): StableAgentRecommendation {
  const capabilityMatches = agent.capabilities.filter((capability) => taskTokens.includes(capability.toLowerCase()));
  const nameTokens = tokenizeForMatching(`${agent.agentId} ${agent.name}`);
  const nameMatches = taskTokens.filter((token) => nameTokens.includes(token));
  const metadataTokens = tokenizeForMatching(flattenMetadataText(agent.metadata));
  const metadataMatches = taskTokens.filter((token) => metadataTokens.includes(token) && !nameMatches.includes(token));

  let score = 0;
  const reasons: string[] = [];

  if (requiredCapabilities.length > 0) {
    score += requiredCapabilities.length * 6;
    reasons.push(`Required capabilities matched: ${requiredCapabilities.join(', ')}`);
  }

  if (capabilityMatches.length > 0) {
    score += capabilityMatches.length * 4;
    reasons.push(`Capability overlap: ${capabilityMatches.join(', ')}`);
  }

  if (nameMatches.length > 0) {
    score += nameMatches.length * 2;
    reasons.push(`Task terms matched agent identity: ${nameMatches.join(', ')}`);
  }

  if (metadataMatches.length > 0) {
    score += metadataMatches.length;
    reasons.push(`Metadata alignment: ${metadataMatches.join(', ')}`);
  }

  if (score === 0 && agent.capabilities.length > 0) {
    score = 1;
    reasons.push('Fallback match based on built-in capabilities.');
  }

  return {
    agentId: agent.agentId,
    name: agent.name,
    capabilities: [...agent.capabilities],
    score,
    confidence: Number(Math.min(0.99, Math.max(0.1, score / 12)).toFixed(2)),
    reasons,
    metadata: isRecord(agent.metadata) ? agent.metadata : undefined,
  };
}

function normalizeRequiredCapabilities(capabilities: string[] | undefined): string[] {
  return (capabilities ?? [])
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function listOwnedWorkflowIds(agentId: string): string[] {
  return listWorkflowCatalog()
    .filter((workflow) => workflow.agentId === agentId)
    .map((workflow) => workflow.commandId);
}

function flattenMetadataText(metadata: Record<string, unknown> | undefined): string {
  if (!isRecord(metadata)) {
    return '';
  }

  return Object.values(metadata)
    .flatMap((value) => {
      if (typeof value === 'string') {
        return [value];
      }
      if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string');
      }
      return [];
    })
    .join(' ');
}

function tokenizeForMatching(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_-]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }
  const value = metadata[key];
  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
