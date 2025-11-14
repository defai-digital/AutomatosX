/**
 * AgentRegistry.ts
 *
 * Central registry for all AI agents
 * Phase 7: Agent System Implementation - Day 1
 */

import { AgentBase } from './AgentBase.js';
import { AgentType, AgentMetadata, Task } from '../types/agents.types.js';

/**
 * AgentRegistry - Central registry for all agents
 *
 * Provides:
 * - Agent registration and discovery
 * - Agent selection by capability
 * - Agent metadata lookup
 * - List available agents
 */
export class AgentRegistry {
  private agents: Map<AgentType, AgentBase> = new Map();
  private initialized: boolean = false;

  /**
   * Register an agent
   */
  register(agent: AgentBase): void {
    const metadata = agent.getMetadata();

    if (this.agents.has(metadata.type)) {
      throw new Error(`Agent already registered: ${metadata.type}`);
    }

    this.agents.set(metadata.type, agent);
  }

  /**
   * Get agent by type
   */
  get(type: AgentType): AgentBase | undefined {
    return this.agents.get(type);
  }

  /**
   * Get all registered agents
   */
  getAll(): AgentBase[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all agent types
   */
  getTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent metadata by type
   */
  getMetadata(type: AgentType): AgentMetadata | undefined {
    const agent = this.agents.get(type);
    return agent?.getMetadata();
  }

  /**
   * Get all agent metadata
   */
  getAllMetadata(): AgentMetadata[] {
    return this.getAll().map((agent) => agent.getMetadata());
  }

  /**
   * Find best agent for a task based on capability matching
   */
  findBestAgent(task: Task): AgentBase | null {
    if (task.assignedAgent) {
      // Task already assigned to specific agent
      const agent = this.agents.get(task.assignedAgent);
      return agent || null;
    }

    let bestAgent: AgentBase | null = null;
    let bestScore = 0;

    for (const agent of this.agents.values()) {
      const score = agent.canHandle(task);

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    // Require minimum score of 0.3 to consider agent capable
    return bestScore >= 0.3 ? bestAgent : null;
  }

  /**
   * Find multiple agents by capability (for collaboration)
   */
  findAgentsByCapability(capability: string): AgentBase[] {
    const capabilityLower = capability.toLowerCase();
    const matches: AgentBase[] = [];

    for (const agent of this.agents.values()) {
      const metadata = agent.getMetadata();

      // Check capabilities
      for (const cap of metadata.capabilities) {
        if (
          cap.name.toLowerCase().includes(capabilityLower) ||
          cap.keywords.some((k) => k.toLowerCase().includes(capabilityLower))
        ) {
          matches.push(agent);
          break;
        }
      }

      // Check specializations
      for (const spec of metadata.specializations) {
        if (spec.toLowerCase().includes(capabilityLower)) {
          matches.push(agent);
          break;
        }
      }
    }

    return matches;
  }

  /**
   * Search agents by keywords
   */
  searchAgents(keywords: string[]): AgentBase[] {
    const matches: Map<AgentBase, number> = new Map();

    for (const agent of this.agents.values()) {
      let score = 0;
      const metadata = agent.getMetadata();

      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();

        // Check name
        if (metadata.name.toLowerCase().includes(keywordLower)) {
          score += 3;
        }

        // Check description
        if (metadata.description.toLowerCase().includes(keywordLower)) {
          score += 2;
        }

        // Check capabilities
        for (const cap of metadata.capabilities) {
          if (cap.name.toLowerCase().includes(keywordLower)) {
            score += 2;
          }
          if (cap.keywords.some((k) => k.toLowerCase().includes(keywordLower))) {
            score += 1;
          }
        }

        // Check specializations
        for (const spec of metadata.specializations) {
          if (spec.toLowerCase().includes(keywordLower)) {
            score += 2;
          }
        }
      }

      if (score > 0) {
        matches.set(agent, score);
      }
    }

    // Sort by score
    return Array.from(matches.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([agent]) => agent);
  }

  /**
   * Get agents by specialization
   */
  getAgentsBySpecialization(specialization: string): AgentBase[] {
    const specializationLower = specialization.toLowerCase();
    const matches: AgentBase[] = [];

    for (const agent of this.agents.values()) {
      const metadata = agent.getMetadata();
      if (
        metadata.specializations.some((s) => s.toLowerCase().includes(specializationLower))
      ) {
        matches.push(agent);
      }
    }

    return matches;
  }

  /**
   * Check if agent is registered
   */
  has(type: AgentType): boolean {
    return this.agents.has(type);
  }

  /**
   * Unregister an agent
   */
  unregister(type: AgentType): boolean {
    return this.agents.delete(type);
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
    this.initialized = false;
  }

  /**
   * Get registry size
   */
  size(): number {
    return this.agents.size;
  }

  /**
   * Mark registry as initialized
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    agentTypes: AgentType[];
    totalCapabilities: number;
    totalSpecializations: number;
    initialized: boolean;
  } {
    const metadata = this.getAllMetadata();

    return {
      totalAgents: this.size(),
      agentTypes: this.getTypes(),
      totalCapabilities: metadata.reduce((sum, m) => sum + m.capabilities.length, 0),
      totalSpecializations: metadata.reduce((sum, m) => sum + m.specializations.length, 0),
      initialized: this.initialized,
    };
  }

  /**
   * Validate registry (ensure all required agents are registered)
   */
  validate(): { valid: boolean; missingAgents: AgentType[] } {
    const requiredAgents: AgentType[] = [
      'backend',
      'frontend',
      'security',
      'quality',
      'devops',
      'architecture',
      'data',
      'product',
    ];

    const missingAgents = requiredAgents.filter((type) => !this.has(type));

    return {
      valid: missingAgents.length === 0,
      missingAgents,
    };
  }

  /**
   * Export registry as JSON
   */
  toJSON(): any {
    return {
      agents: Array.from(this.agents.entries()).map(([type, agent]) => ({
        type,
        metadata: agent.getMetadata(),
      })),
      stats: this.getStats(),
    };
  }
}
