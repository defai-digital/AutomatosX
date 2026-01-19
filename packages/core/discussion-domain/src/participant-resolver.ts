/**
 * Participant Resolver
 *
 * Resolves discussion participants (providers and agents) to their execution config.
 * Handles agent-to-provider mapping using providerAffinity.
 *
 * Invariants:
 * - INV-DISC-640: Agent uses providerAffinity.preferred[0] for provider selection
 * - INV-DISC-641: Agent abilities injected with max 10K tokens
 * - INV-DISC-642: Agent weight multiplier between 0.5-3.0 (default 1.5)
 */

import {
  LIMIT_ABILITY_TOKENS_AGENT,
  DEFAULT_AGENT_WEIGHT_MULTIPLIER,
  getErrorMessage,
  type DiscussionParticipant,
} from '@defai.digital/contracts';

/**
 * Resolved participant ready for discussion execution
 */
export interface ResolvedParticipant {
  /** Original participant identifier */
  id: string;

  /** Whether this is an agent (vs raw provider) */
  isAgent: boolean;

  /** Provider ID to use for LLM calls */
  providerId: string;

  /** Agent ID (if isAgent) */
  agentId?: string | undefined;

  /** System prompt override (from agent config) */
  systemPromptOverride?: string | undefined;

  /** Injected ability content */
  abilityContent?: string | undefined;

  /** Temperature override (from agent config) */
  temperatureOverride?: number | undefined;

  /** Weight multiplier for consensus (agents typically get higher weight) */
  weightMultiplier: number;
}

/**
 * Agent profile interface (subset needed for resolution)
 */
export interface AgentProfileLike {
  agentId: string;
  systemPrompt?: string | undefined;
  providerAffinity?: {
    preferred?: string[] | undefined;
    defaultSynthesizer?: string | undefined;
    temperatureOverrides?: Record<string, number> | undefined;
  } | undefined;
  temperature?: number | undefined;
}

/**
 * Agent registry interface for looking up agents
 */
export interface AgentRegistryLike {
  get(agentId: string): Promise<AgentProfileLike | null>;
}

/**
 * Ability manager interface for injecting abilities
 */
export interface AbilityManagerLike {
  injectAbilities(
    agentId: string,
    task: string,
    coreAbilities: string[],
    options: { maxAbilities: number; maxTokens: number }
  ): Promise<{ combinedContent: string; injectedAbilities: string[] }>;
}

/**
 * Options for participant resolution
 */
export interface ParticipantResolverOptions {
  /** Agent registry for looking up agents */
  agentRegistry?: AgentRegistryLike | undefined;

  /** Ability manager for injecting abilities */
  abilityManager?: AbilityManagerLike | undefined;

  /** Default provider to use when agent has no preference */
  defaultProvider?: string | undefined;

  /** Default weight multiplier for agent participants */
  agentWeightMultiplier?: number | undefined;

  /** Maximum tokens for ability injection */
  maxAbilityTokens?: number | undefined;

  /** Topic for ability matching */
  topic?: string | undefined;
}

/**
 * Default provider when agent has no preference
 */
const DEFAULT_PROVIDER = 'claude';

/**
 * Default agent weight multiplier (INV-DISC-642)
 * Uses constant from contracts for single source of truth
 */
const DEFAULT_AGENT_WEIGHT = DEFAULT_AGENT_WEIGHT_MULTIPLIER;

/**
 * Maximum tokens for ability injection (INV-DISC-641)
 * Uses LIMIT_ABILITY_TOKENS_AGENT from contracts
 */
const DEFAULT_MAX_ABILITY_TOKENS = LIMIT_ABILITY_TOKENS_AGENT;

/**
 * Resolve a single participant to execution config
 */
export async function resolveParticipant(
  participant: DiscussionParticipant,
  options: ParticipantResolverOptions = {}
): Promise<ResolvedParticipant> {
  const {
    agentRegistry,
    abilityManager,
    defaultProvider = DEFAULT_PROVIDER,
    agentWeightMultiplier = DEFAULT_AGENT_WEIGHT,
    maxAbilityTokens = DEFAULT_MAX_ABILITY_TOKENS,
    topic = '',
  } = options;

  // Provider participant - simple resolution
  if (participant.type === 'provider') {
    return {
      id: participant.id,
      isAgent: false,
      providerId: participant.id,
      weightMultiplier: 1.0, // Base weight for providers
    };
  }

  // Agent participant - resolve via registry
  const agentId = participant.id;

  // If no registry, fall back to default provider with agent weight
  if (!agentRegistry) {
    return {
      id: agentId,
      isAgent: true,
      providerId: defaultProvider,
      agentId,
      weightMultiplier: agentWeightMultiplier,
    };
  }

  // Look up agent
  const agent = await agentRegistry.get(agentId);

  if (!agent) {
    // Agent not found, fall back to default provider
    return {
      id: agentId,
      isAgent: true,
      providerId: defaultProvider,
      agentId,
      weightMultiplier: agentWeightMultiplier,
    };
  }

  // INV-DISC-640: Use providerAffinity.preferred[0] or fallback to default
  const providerId = agent.providerAffinity?.preferred?.[0] ?? defaultProvider;

  // Get temperature override if configured
  const temperatureOverride = agent.providerAffinity?.temperatureOverrides?.[providerId]
    ?? agent.temperature;

  // Build resolved participant
  const resolved: ResolvedParticipant = {
    id: agentId,
    isAgent: true,
    providerId,
    agentId,
    systemPromptOverride: agent.systemPrompt,
    temperatureOverride,
    weightMultiplier: agentWeightMultiplier,
  };

  // INV-DISC-641: Inject abilities if ability manager available
  if (abilityManager && topic) {
    try {
      const injection = await abilityManager.injectAbilities(
        agentId,
        topic,
        [], // coreAbilities
        { maxAbilities: 5, maxTokens: maxAbilityTokens }
      );

      if (injection.combinedContent) {
        resolved.abilityContent = injection.combinedContent;
      }
    } catch (error) {
      // Log warning for diagnostics, but don't fail discussion
      console.warn(
        `[participant-resolver] Ability injection failed for agent ${agentId}:`,
        getErrorMessage(error)
      );
    }
  }

  return resolved;
}

/**
 * Resolve multiple participants
 */
export async function resolveParticipants(
  participants: DiscussionParticipant[],
  options: ParticipantResolverOptions = {}
): Promise<ResolvedParticipant[]> {
  const resolved = await Promise.all(
    participants.map(p => resolveParticipant(p, options))
  );

  return resolved;
}

/**
 * Convert legacy string provider list to participant array
 */
export function providersToParticipants(providers: string[]): DiscussionParticipant[] {
  return providers.map(id => ({ type: 'provider' as const, id }));
}

/**
 * Parse participant string (e.g., "claude" or "reviewer:agent")
 */
export function parseParticipantString(input: string): DiscussionParticipant {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Participant string cannot be empty');
  }

  const parts = trimmed.split(':');
  const id = parts[0]!.trim();

  if (!id) {
    throw new Error('Participant ID cannot be empty');
  }

  if (parts.length === 2 && parts[1] === 'agent') {
    return { type: 'agent', id };
  }

  return { type: 'provider', id };
}

/**
 * Parse participant list from CLI input
 * Format: "claude,grok,reviewer:agent,security:agent"
 */
export function parseParticipantList(input: string): DiscussionParticipant[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(parseParticipantString);
}

/**
 * Get provider IDs from resolved participants
 */
export function getProviderIds(participants: ResolvedParticipant[]): string[] {
  // Unique provider IDs preserving order
  const seen = new Set<string>();
  const result: string[] = [];

  for (const p of participants) {
    if (!seen.has(p.providerId)) {
      seen.add(p.providerId);
      result.push(p.providerId);
    }
  }

  return result;
}

/**
 * Build enhanced system prompt with agent context
 */
export function buildEnhancedSystemPrompt(
  basePrompt: string,
  participant: ResolvedParticipant
): string {
  const parts: string[] = [];

  // Add ability content first (provides domain knowledge)
  if (participant.abilityContent) {
    parts.push(participant.abilityContent);
    parts.push('---');
  }

  // Add agent system prompt
  if (participant.systemPromptOverride) {
    parts.push(participant.systemPromptOverride);
    parts.push('---');
  }

  // Add base system prompt
  parts.push(basePrompt);

  return parts.join('\n\n');
}
