/**
 * Agent Registry - Central registry for agent profiles
 *
 * Provides fast lookup and querying of agent profiles with
 * support for teams, abilities, and filtering.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Imports
// =============================================================================

import { type AgentProfile } from '@ax/schemas';
import { AgentLoader, type LoadedAgent, type AgentLoadError } from './loader.js';
import { AgentNotFoundError, findSimilar } from '../errors.js';

// =============================================================================
// Types
// =============================================================================

export interface AgentFilter {
  /** Filter by team */
  team?: string;
  /** Filter by ability */
  ability?: string;
  /** Filter by any of these abilities */
  abilities?: string[];
  /** Filter by communication style */
  communicationStyle?: 'formal' | 'casual' | 'technical';
  /** Filter by max delegation depth (agents that can delegate) */
  canDelegate?: boolean;
}

export interface AgentRegistryOptions {
  /** Agent loader instance */
  loader: AgentLoader;
}

export interface AgentRegistryEvents {
  onAgentRegistered?: (agent: AgentProfile) => void;
  onAgentRemoved?: (agentId: string) => void;
  onReloaded?: (agents: AgentProfile[]) => void;
}

// =============================================================================
// Agent Registry Class
// =============================================================================

export class AgentRegistry {
  private readonly loader: AgentLoader;
  private readonly agents: Map<string, AgentProfile> = new Map();
  private readonly byTeam: Map<string, Set<string>> = new Map();
  private readonly byAbility: Map<string, Set<string>> = new Map();
  private readonly events: AgentRegistryEvents = {};
  private initialized = false;

  constructor(options: AgentRegistryOptions) {
    this.loader = options.loader;
  }

  // =============================================================================
  // Lifecycle Methods
  // =============================================================================

  /**
   * Initialize registry by loading all agents
   */
  async initialize(): Promise<{
    loaded: number;
    errors: AgentLoadError[];
  }> {
    if (this.initialized) {
      return { loaded: this.agents.size, errors: [] };
    }

    const { agents, errors } = await this.loader.loadAll();

    for (const loaded of agents) {
      this.registerAgent(loaded.profile);
    }

    this.initialized = true;

    return {
      loaded: agents.length,
      errors,
    };
  }

  /**
   * Reload all agents from disk
   */
  async reload(): Promise<{
    loaded: number;
    errors: AgentLoadError[];
  }> {
    // Clear existing data
    this.agents.clear();
    this.byTeam.clear();
    this.byAbility.clear();

    // Reload from loader
    const { agents, errors } = await this.loader.reload();

    for (const loaded of agents) {
      this.registerAgent(loaded.profile);
    }

    this.events.onReloaded?.(Array.from(this.agents.values()));

    return {
      loaded: agents.length,
      errors,
    };
  }

  // =============================================================================
  // Agent Operations
  // =============================================================================

  /**
   * Register an agent profile
   */
  registerAgent(profile: AgentProfile): void {
    const id = profile.name;

    // Store agent
    this.agents.set(id, profile);

    // Index by team
    const team = profile.team ?? 'default';
    if (!this.byTeam.has(team)) {
      this.byTeam.set(team, new Set());
    }
    this.byTeam.get(team)!.add(id);

    // Index by abilities
    for (const ability of profile.abilities) {
      if (!this.byAbility.has(ability)) {
        this.byAbility.set(ability, new Set());
      }
      this.byAbility.get(ability)!.add(id);
    }

    this.events.onAgentRegistered?.(profile);
  }

  /**
   * Remove an agent from registry
   */
  removeAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Remove from main store
    this.agents.delete(agentId);

    // Remove from team index
    const team = agent.team ?? 'default';
    this.byTeam.get(team)?.delete(agentId);
    if (this.byTeam.get(team)?.size === 0) {
      this.byTeam.delete(team);
    }

    // Remove from ability index
    for (const ability of agent.abilities) {
      this.byAbility.get(ability)?.delete(agentId);
      if (this.byAbility.get(ability)?.size === 0) {
        this.byAbility.delete(ability);
      }
    }

    this.events.onAgentRemoved?.(agentId);
    return true;
  }

  /**
   * Get agent by ID
   */
  get(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by ID (throws if not found)
   */
  getOrThrow(agentId: string): AgentProfile {
    const agent = this.agents.get(agentId);
    if (!agent) {
      const availableAgents = Array.from(this.agents.keys());
      const similarAgents = findSimilar(agentId, availableAgents);
      throw new AgentNotFoundError(agentId, {
        availableAgents,
        similarAgents,
      });
    }
    return agent;
  }

  /**
   * Check if agent exists
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get all agents
   */
  getAll(): AgentProfile[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all agent IDs
   */
  getIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent count
   */
  get size(): number {
    return this.agents.size;
  }

  // =============================================================================
  // Query Methods
  // =============================================================================

  /**
   * Find agents matching filter criteria
   */
  find(filter: AgentFilter): AgentProfile[] {
    let results = Array.from(this.agents.values());

    if (filter.team) {
      const teamAgents = this.byTeam.get(filter.team);
      if (!teamAgents) return [];
      results = results.filter(a => teamAgents.has(a.name));
    }

    if (filter.ability) {
      const abilityAgents = this.byAbility.get(filter.ability);
      if (!abilityAgents) return [];
      results = results.filter(a => abilityAgents.has(a.name));
    }

    if (filter.abilities && filter.abilities.length > 0) {
      results = results.filter(a =>
        filter.abilities!.some(ability => a.abilities.includes(ability))
      );
    }

    if (filter.communicationStyle) {
      results = results.filter(a =>
        a.personality?.communicationStyle === filter.communicationStyle
      );
    }

    if (filter.canDelegate !== undefined) {
      if (filter.canDelegate) {
        results = results.filter(a =>
          a.orchestration && a.orchestration.maxDelegationDepth > 0
        );
      } else {
        results = results.filter(a =>
          !a.orchestration || a.orchestration.maxDelegationDepth === 0
        );
      }
    }

    return results;
  }

  /**
   * Get agents by team
   */
  getByTeam(team: string): AgentProfile[] {
    const agentIds = this.byTeam.get(team);
    if (!agentIds) return [];
    return Array.from(agentIds)
      .map(id => this.agents.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all team names
   */
  getTeams(): string[] {
    return Array.from(this.byTeam.keys());
  }

  /**
   * Get agents by ability
   */
  getByAbility(ability: string): AgentProfile[] {
    const agentIds = this.byAbility.get(ability);
    if (!agentIds) return [];
    return Array.from(agentIds)
      .map(id => this.agents.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all available abilities
   */
  getAbilities(): string[] {
    return Array.from(this.byAbility.keys());
  }

  /**
   * Find agents that can perform a specific task type
   */
  findForTask(taskType: string): AgentProfile[] {
    // Simple mapping of task types to abilities
    const taskAbilityMap: Record<string, string[]> = {
      coding: ['code-generation', 'implementation', 'development'],
      testing: ['testing', 'quality-assurance', 'test-writing'],
      review: ['code-review', 'analysis', 'audit'],
      design: ['architecture', 'design', 'planning'],
      documentation: ['technical-writing', 'documentation'],
      debugging: ['debugging', 'troubleshooting'],
      security: ['security-audit', 'threat-modeling'],
      data: ['data-engineering', 'data-analysis'],
    };

    const requiredAbilities = taskAbilityMap[taskType.toLowerCase()] ?? [];

    if (requiredAbilities.length === 0) {
      return this.getAll();
    }

    return this.find({ abilities: requiredAbilities });
  }

  // =============================================================================
  // Event Management
  // =============================================================================

  /**
   * Set event handlers
   */
  setEvents(events: AgentRegistryEvents): void {
    Object.assign(this.events, events);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new agent registry instance
 */
export function createAgentRegistry(options: AgentRegistryOptions): AgentRegistry {
  return new AgentRegistry(options);
}
