/**
 * Agent Registry Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry, type AgentFilter } from './registry.js';
import { AgentLoader } from './loader.js';
import type { AgentProfile } from '@ax/schemas';

// Mock agent profiles
const mockAgents: AgentProfile[] = [
  {
    name: 'backend',
    displayName: 'Bob Backend',
    team: 'engineering',
    role: 'Backend Developer',
    description: 'Backend development expert',
    systemPrompt: 'You are a backend developer.',
    abilities: ['code-generation', 'api-design', 'database'],
    personality: {
      traits: ['analytical', 'thorough'],
      communicationStyle: 'technical',
    },
    orchestration: {
      maxDelegationDepth: 2,
      delegationTargets: ['frontend', 'quality'],
    },
  },
  {
    name: 'frontend',
    displayName: 'Frank Frontend',
    team: 'engineering',
    role: 'Frontend Developer',
    description: 'Frontend development expert',
    systemPrompt: 'You are a frontend developer.',
    abilities: ['code-generation', 'ui-design', 'react'],
    personality: {
      traits: ['creative', 'detail-oriented'],
      communicationStyle: 'casual',
    },
  },
  {
    name: 'security',
    displayName: 'Steve Security',
    team: 'security',
    role: 'Security Expert',
    description: 'Security and audit expert',
    systemPrompt: 'You are a security expert.',
    abilities: ['security-audit', 'threat-modeling', 'code-review'],
    personality: {
      traits: ['cautious', 'thorough'],
      communicationStyle: 'formal',
    },
    orchestration: {
      maxDelegationDepth: 1,
      delegationTargets: ['backend'],
    },
  },
  {
    name: 'quality',
    displayName: 'Queenie Quality',
    team: 'engineering',
    role: 'QA Engineer',
    description: 'Quality assurance expert',
    systemPrompt: 'You are a QA engineer.',
    abilities: ['testing', 'quality-assurance', 'test-writing'],
    personality: {
      traits: ['meticulous', 'patient'],
      communicationStyle: 'technical',
    },
  },
];

// Mock AgentLoader
class MockAgentLoader extends AgentLoader {
  constructor() {
    super({ basePath: '/mock' });
  }

  async loadAll() {
    return {
      agents: mockAgents.map(profile => ({
        profile,
        filePath: `/mock/agents/${profile.name}.yaml`,
        loadedAt: new Date(),
      })),
      errors: [],
    };
  }

  async reload() {
    return this.loadAll();
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let loader: MockAgentLoader;

  beforeEach(async () => {
    loader = new MockAgentLoader();
    registry = new AgentRegistry({ loader });
    await registry.initialize();
  });

  describe('initialization', () => {
    it('should load all agents on initialize', async () => {
      expect(registry.size).toBe(4);
    });

    it('should be idempotent', async () => {
      const result = await registry.initialize();
      expect(result.loaded).toBe(4);
    });

    it('should track load errors', async () => {
      const errorLoader = new MockAgentLoader();
      vi.spyOn(errorLoader, 'loadAll').mockResolvedValue({
        agents: [],
        errors: [{ filePath: '/mock/bad.yaml', error: new Error('Parse error') }],
      });

      const errorRegistry = new AgentRegistry({ loader: errorLoader });
      const result = await errorRegistry.initialize();

      expect(result.errors).toHaveLength(1);
    });
  });

  describe('registerAgent()', () => {
    it('should register a new agent', () => {
      const newAgent: AgentProfile = {
        name: 'devops',
        displayName: 'Oliver DevOps',
        role: 'DevOps Engineer',
        description: 'DevOps expert',
        systemPrompt: 'You are a DevOps engineer.',
        abilities: ['deployment', 'infrastructure'],
      };

      registry.registerAgent(newAgent);

      expect(registry.has('devops')).toBe(true);
      expect(registry.size).toBe(5);
    });

    it('should index by team', () => {
      const agent = registry.get('backend');
      expect(agent!.team).toBe('engineering');

      const teamAgents = registry.getByTeam('engineering');
      expect(teamAgents.some(a => a.name === 'backend')).toBe(true);
    });

    it('should index by ability', () => {
      const agents = registry.getByAbility('code-generation');

      expect(agents).toHaveLength(2);
      expect(agents.some(a => a.name === 'backend')).toBe(true);
      expect(agents.some(a => a.name === 'frontend')).toBe(true);
    });
  });

  describe('removeAgent()', () => {
    it('should remove an existing agent', () => {
      const removed = registry.removeAgent('backend');

      expect(removed).toBe(true);
      expect(registry.has('backend')).toBe(false);
      expect(registry.size).toBe(3);
    });

    it('should return false for non-existent agent', () => {
      const removed = registry.removeAgent('non-existent');
      expect(removed).toBe(false);
    });

    it('should update indexes after removal', () => {
      registry.removeAgent('backend');

      const teamAgents = registry.getByTeam('engineering');
      expect(teamAgents.some(a => a.name === 'backend')).toBe(false);

      const abilityAgents = registry.getByAbility('api-design');
      expect(abilityAgents).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should return agent by ID', () => {
      const agent = registry.get('backend');

      expect(agent).toBeDefined();
      expect(agent!.name).toBe('backend');
      expect(agent!.displayName).toBe('Bob Backend');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.get('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getOrThrow()', () => {
    it('should throw for non-existent agent', () => {
      expect(() => registry.getOrThrow('non-existent')).toThrow('not found');
    });

    it('should throw AgentNotFoundError with helpful message', () => {
      try {
        registry.getOrThrow('backnd'); // typo of 'backend'
      } catch (error) {
        expect(error).toBeDefined();
        // The error should mention the requested agent
        expect(String(error)).toContain('backnd');
        // The error should be an AgentNotFoundError
        expect((error as Error).name).toBe('AgentNotFoundError');
      }
    });
  });

  describe('getAll()', () => {
    it('should return all agents', () => {
      const agents = registry.getAll();

      expect(agents).toHaveLength(4);
    });
  });

  describe('getIds()', () => {
    it('should return all agent IDs', () => {
      const ids = registry.getIds();

      expect(ids).toContain('backend');
      expect(ids).toContain('frontend');
      expect(ids).toContain('security');
      expect(ids).toContain('quality');
    });
  });

  describe('find()', () => {
    it('should filter by team', () => {
      const agents = registry.find({ team: 'engineering' });

      expect(agents).toHaveLength(3);
      expect(agents.every(a => a.team === 'engineering')).toBe(true);
    });

    it('should filter by ability', () => {
      const agents = registry.find({ ability: 'security-audit' });

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe('security');
    });

    it('should filter by any of abilities', () => {
      const agents = registry.find({ abilities: ['testing', 'security-audit'] });

      expect(agents).toHaveLength(2);
    });

    it('should filter by communication style', () => {
      const agents = registry.find({ communicationStyle: 'formal' });

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe('security');
    });

    it('should filter by canDelegate true', () => {
      const agents = registry.find({ canDelegate: true });

      expect(agents).toHaveLength(2);
      expect(agents.some(a => a.name === 'backend')).toBe(true);
      expect(agents.some(a => a.name === 'security')).toBe(true);
    });

    it('should filter by canDelegate false', () => {
      const agents = registry.find({ canDelegate: false });

      expect(agents).toHaveLength(2);
      expect(agents.some(a => a.name === 'frontend')).toBe(true);
      expect(agents.some(a => a.name === 'quality')).toBe(true);
    });

    it('should combine multiple filters', () => {
      const agents = registry.find({
        team: 'engineering',
        communicationStyle: 'technical',
      });

      expect(agents).toHaveLength(2);
    });

    it('should return empty for no matches', () => {
      const agents = registry.find({ team: 'non-existent' });
      expect(agents).toHaveLength(0);
    });
  });

  describe('getByTeam()', () => {
    it('should return agents in team', () => {
      const agents = registry.getByTeam('security');

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe('security');
    });

    it('should return empty for non-existent team', () => {
      const agents = registry.getByTeam('non-existent');
      expect(agents).toHaveLength(0);
    });
  });

  describe('getTeams()', () => {
    it('should return all team names', () => {
      const teams = registry.getTeams();

      expect(teams).toContain('engineering');
      expect(teams).toContain('security');
    });
  });

  describe('getByAbility()', () => {
    it('should return agents with ability', () => {
      const agents = registry.getByAbility('testing');

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe('quality');
    });
  });

  describe('getAbilities()', () => {
    it('should return all abilities', () => {
      const abilities = registry.getAbilities();

      expect(abilities).toContain('code-generation');
      expect(abilities).toContain('security-audit');
      expect(abilities).toContain('testing');
    });
  });

  describe('findForTask()', () => {
    it('should find agents for coding tasks', () => {
      const agents = registry.findForTask('coding');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.abilities.includes('code-generation'))).toBe(true);
    });

    it('should find agents for testing tasks', () => {
      const agents = registry.findForTask('testing');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.name === 'quality')).toBe(true);
    });

    it('should find agents for security tasks', () => {
      const agents = registry.findForTask('security');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.name === 'security')).toBe(true);
    });

    it('should return all agents for unknown task type', () => {
      const agents = registry.findForTask('unknown-task');
      expect(agents.length).toBe(4);
    });
  });

  describe('reload()', () => {
    it('should reload all agents', async () => {
      registry.removeAgent('backend');
      expect(registry.size).toBe(3);

      const result = await registry.reload();

      expect(result.loaded).toBe(4);
      expect(registry.has('backend')).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit onAgentRegistered', () => {
      let emitted: AgentProfile | null = null;
      registry.setEvents({
        onAgentRegistered: (agent) => { emitted = agent; },
      });

      const newAgent: AgentProfile = {
        name: 'new-agent',
        displayName: 'New Agent',
        role: 'Test',
        description: 'Test agent',
        systemPrompt: 'You are a test agent.',
        abilities: ['test'],
      };
      registry.registerAgent(newAgent);

      expect(emitted).not.toBeNull();
      expect(emitted!.name).toBe('new-agent');
    });

    it('should emit onAgentRemoved', () => {
      let removedId: string | null = null;
      registry.setEvents({
        onAgentRemoved: (id) => { removedId = id; },
      });

      registry.removeAgent('backend');

      expect(removedId).toBe('backend');
    });

    it('should emit onReloaded', async () => {
      let reloaded: AgentProfile[] | null = null;
      registry.setEvents({
        onReloaded: (agents) => { reloaded = agents; },
      });

      await registry.reload();

      expect(reloaded).not.toBeNull();
      expect(reloaded!.length).toBe(4);
    });
  });
});
