/**
 * Tests for Agent Router
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectAgent,
  selectAgentWithReason,
  getAgentKeywords,
  getAllKeywords,
  findAgentsByKeyword,
  AGENT_KEYWORDS,
} from './router.js';
import { AgentRegistry } from './registry.js';
import { AgentLoader } from './loader.js';
import { type AgentProfile } from '@ax/schemas';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Agent Router', () => {
  let registry: AgentRegistry;
  let tempDir: string;

  const createTestAgent = (name: string, overrides: Partial<AgentProfile> = {}): AgentProfile => ({
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    role: `${name} specialist`,
    team: 'default',
    abilities: [],
    systemPrompt: `You are a ${name} agent.`,
    enabled: true,
    version: '1.0.0',
    orchestration: {
      maxDelegationDepth: 0,
      canReadWorkspaces: [],
      canWriteToShared: false,
      canDelegateTo: [],
      priority: 5,
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'ax-router-test-'));
    const agentsDir = join(tempDir, 'agents');
    await mkdir(agentsDir, { recursive: true });

    // Create agent files for all agents in the keywords database
    const agentNames = [...Object.keys(AGENT_KEYWORDS), 'standard'];
    for (const name of agentNames) {
      const agent = createTestAgent(name);
      await writeFile(
        join(agentsDir, `${name}.yaml`),
        `name: ${agent.name}\ndisplayName: ${agent.displayName}\nrole: ${agent.role}\nteam: default\nabilities: []\nsystemPrompt: "You are a ${name} agent."\nenabled: true\nversion: "1.0.0"\n`,
      );
    }

    // Create registry with loader
    const loader = new AgentLoader({ basePath: tempDir });
    registry = new AgentRegistry({ loader });
    await registry.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('selectAgent', () => {
    it('should select backend agent for API tasks', () => {
      const agent = selectAgent('Create a REST API for user management', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('backend');
    });

    it('should select frontend agent for UI tasks', () => {
      const agent = selectAgent('Build a React component for the login form', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('frontend');
    });

    it('should select devops agent for deployment tasks', () => {
      const agent = selectAgent('Set up a Docker container and Kubernetes deployment', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('devops');
    });

    it('should select security agent for security tasks', () => {
      const agent = selectAgent('Audit the code for XSS and SQL injection vulnerabilities', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('security');
    });

    it('should select quality agent for testing tasks', () => {
      const agent = selectAgent('Write unit tests for the payment module', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('quality');
    });

    it('should select design agent for UX tasks', () => {
      const agent = selectAgent('Create a wireframe and prototype for the dashboard', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('design');
    });

    it('should select product agent for requirements tasks', () => {
      const agent = selectAgent('Write user stories for the checkout feature', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('product');
    });

    it('should select data agent for data pipeline tasks', () => {
      const agent = selectAgent('Build an ETL pipeline to BigQuery', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('data');
    });

    it('should select architecture agent for system design tasks', () => {
      const agent = selectAgent('Design the microservices architecture for scalability', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('architecture');
    });

    it('should select writer agent for documentation tasks', () => {
      const agent = selectAgent('Write documentation and readme guide for the project', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('writer');
    });

    it('should select mobile agent for mobile app tasks', () => {
      const agent = selectAgent('Build an iOS app using Swift', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('mobile');
    });

    it('should select default agent when no keywords match', () => {
      const agent = selectAgent('Do something random', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('standard');
    });

    it('should handle empty task gracefully', () => {
      const agent = selectAgent('', registry);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('standard');
    });

    it('should be case insensitive', () => {
      const agent1 = selectAgent('Build a REST API', registry);
      const agent2 = selectAgent('build a rest api', registry);
      const agent3 = selectAgent('BUILD A REST API', registry);

      expect(agent1?.name).toBe(agent2?.name);
      expect(agent2?.name).toBe(agent3?.name);
    });
  });

  describe('selectAgentWithReason', () => {
    it('should return matched keywords', () => {
      const result = selectAgentWithReason('Create REST API with database', registry);

      expect(result.agent.name).toBe('backend');
      expect(result.matchedKeywords).toContain('api');
      expect(result.matchedKeywords).toContain('database');
      expect(result.reason).toContain('backend');
    });

    it('should provide alternatives', () => {
      const result = selectAgentWithReason('Build an API with tests', registry);

      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should calculate confidence', () => {
      const result = selectAgentWithReason('Create REST API with database authentication', registry);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have lower confidence for no matches', () => {
      const result = selectAgentWithReason('Do something random', registry);

      expect(result.confidence).toBeLessThanOrEqual(0.5);
      expect(result.matchedKeywords).toHaveLength(0);
    });
  });

  describe('getAgentKeywords', () => {
    it('should return keywords for known agent', () => {
      const keywords = getAgentKeywords('backend');

      expect(keywords).toContain('api');
      expect(keywords).toContain('database');
      expect(keywords).toContain('server');
    });

    it('should return empty array for unknown agent', () => {
      const keywords = getAgentKeywords('unknown-agent');

      expect(keywords).toEqual([]);
    });
  });

  describe('getAllKeywords', () => {
    it('should return all keywords mapping', () => {
      const all = getAllKeywords();

      expect(Object.keys(all)).toContain('backend');
      expect(Object.keys(all)).toContain('frontend');
      expect(Object.keys(all)).toContain('devops');
    });

    it('should return a copy (not mutable)', () => {
      const all = getAllKeywords();
      all['backend'] = ['modified'];

      const allAgain = getAllKeywords();
      expect(allAgain['backend']).toContain('api');
    });
  });

  describe('findAgentsByKeyword', () => {
    it('should find agents by keyword', () => {
      const agents = findAgentsByKeyword('api');

      expect(agents).toContain('backend');
    });

    it('should find partial matches', () => {
      const agents = findAgentsByKeyword('test');

      expect(agents).toContain('quality');
    });

    it('should return empty array for unknown keyword', () => {
      const agents = findAgentsByKeyword('xyznonexistent');

      expect(agents).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks with multiple domain keywords', () => {
      // Task mentions both API and testing
      const result = selectAgentWithReason('Write tests for the REST API', registry);

      // Should select based on which has more matches
      expect(['backend', 'quality']).toContain(result.agent.name);
    });

    it('should prefer agent with more keyword matches', () => {
      // Task heavily focuses on backend
      const result = selectAgentWithReason(
        'Build REST API server with database CRUD endpoints and authentication',
        registry,
      );

      expect(result.agent.name).toBe('backend');
      expect(result.matchedKeywords.length).toBeGreaterThan(3);
    });

    it('should work with custom default agent', () => {
      const result = selectAgentWithReason('Random task', registry, {
        defaultAgent: 'backend',
      });

      expect(result.agent.name).toBe('backend');
    });
  });
});

// Add afterEach import
import { afterEach } from 'vitest';
