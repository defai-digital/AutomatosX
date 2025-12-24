/**
 * Agent Registry Implementation
 *
 * Manages agent profile registration, lookup, and lifecycle.
 */

import {
  type AgentProfile,
  validateAgentProfile,
  AgentErrorCode,
} from '@automatosx/contracts';
import type { AgentRegistry, AgentFilter } from './types.js';

/**
 * In-memory agent registry implementation
 */
export class InMemoryAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<string, AgentProfile>();

  /**
   * Register a new agent profile
   */
  async register(profile: AgentProfile): Promise<void> {
    // Validate the profile
    const validated = validateAgentProfile(profile);

    // Check for duplicate
    if (this.agents.has(validated.agentId)) {
      throw new AgentRegistryError(
        AgentErrorCode.AGENT_VALIDATION_ERROR,
        `Agent with ID "${validated.agentId}" already exists`
      );
    }

    // Add timestamps
    const now = new Date().toISOString();
    const withTimestamps: AgentProfile = {
      ...validated,
      createdAt: now,
      updatedAt: now,
    };

    this.agents.set(validated.agentId, withTimestamps);
  }

  /**
   * Get an agent by ID
   */
  async get(agentId: string): Promise<AgentProfile | undefined> {
    return this.agents.get(agentId);
  }

  /**
   * List all registered agents with optional filtering
   */
  async list(filter?: AgentFilter): Promise<AgentProfile[]> {
    let agents = Array.from(this.agents.values());

    if (filter !== undefined) {
      if (filter.team !== undefined) {
        agents = agents.filter((a) => a.team === filter.team);
      }

      if (filter.tags !== undefined && filter.tags.length > 0) {
        agents = agents.filter(
          (a) =>
            a.tags !== undefined &&
            filter.tags!.some((tag) => a.tags!.includes(tag))
        );
      }

      if (filter.enabled !== undefined) {
        agents = agents.filter((a) => a.enabled === filter.enabled);
      }

      if (filter.capability !== undefined) {
        agents = agents.filter(
          (a) =>
            a.capabilities !== undefined &&
            a.capabilities.includes(filter.capability!)
        );
      }
    }

    return agents;
  }

  /**
   * Update an agent profile
   */
  async update(agentId: string, updates: Partial<AgentProfile>): Promise<void> {
    const existing = this.agents.get(agentId);

    if (existing === undefined) {
      throw new AgentRegistryError(
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent with ID "${agentId}" not found`
      );
    }

    // Merge and validate
    const merged = {
      ...existing,
      ...updates,
      agentId, // Cannot change ID
      updatedAt: new Date().toISOString(),
    };

    const validated = validateAgentProfile(merged);
    this.agents.set(agentId, validated);
  }

  /**
   * Remove an agent
   */
  async remove(agentId: string): Promise<void> {
    if (!this.agents.has(agentId)) {
      throw new AgentRegistryError(
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent with ID "${agentId}" not found`
      );
    }

    this.agents.delete(agentId);
  }

  /**
   * Check if an agent exists
   */
  async exists(agentId: string): Promise<boolean> {
    return this.agents.has(agentId);
  }

  /**
   * Clear all agents (useful for testing)
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Get the count of registered agents
   */
  get size(): number {
    return this.agents.size;
  }
}

/**
 * Agent registry error
 */
export class AgentRegistryError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AgentRegistryError';
  }
}

/**
 * Creates a new in-memory agent registry
 */
export function createAgentRegistry(): AgentRegistry {
  return new InMemoryAgentRegistry();
}
