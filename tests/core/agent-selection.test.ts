/**
 * Agent Selection Service Tests
 *
 * Tests for agent recommendation and capability discovery.
 *
 * Invariants tested:
 * - INV-AGT-SEL-001: Selection is deterministic (same input = same output)
 * - INV-AGT-SEL-002: Confidence scores must be between 0 and 1
 * - INV-AGT-SEL-003: Results must be sorted by confidence descending
 * - INV-AGT-SEL-004: Always returns at least one result (fallback to 'standard')
 * - INV-AGT-SEL-005: exampleTasks boost confidence when matched
 * - INV-AGT-SEL-006: notForTasks reduce confidence when matched
 * - INV-AGT-SEL-007: Feedback-based adjustments applied when available
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentSelectionService,
  AgentSelectionService,
  InMemoryAgentRegistry,
} from '@defai.digital/agent-domain';
import type {
  FeedbackScoreAdjusterPort,
  AgentSelectionServicePort,
} from '@defai.digital/agent-domain';
import type { AgentProfile } from '@defai.digital/contracts';

describe('Agent Selection Service', () => {
  let registry: InMemoryAgentRegistry;
  let selectionService: AgentSelectionServicePort;

  const backendAgent: AgentProfile = {
    agentId: 'backend',
    displayName: 'Backend Developer',
    description: 'Expert in backend development, APIs, and databases',
    enabled: true,
    capabilities: ['api', 'database', 'nodejs', 'typescript'],
    expertise: ['rest-api', 'graphql', 'postgresql'],
    role: 'Backend Developer',
    selectionMetadata: {
      agentCategory: 'implementer',
      primaryIntents: ['implement', 'build', 'create', 'develop'],
      keywords: ['api', 'server', 'database', 'backend', 'endpoint'],
      exampleTasks: [
        'Build REST API endpoints',
        'Create database migrations',
        'Implement authentication system',
      ],
      notForTasks: ['design UI', 'create CSS styles', 'frontend'],
      antiKeywords: ['css', 'html', 'ui', 'frontend'],
    },
  };

  const frontendAgent: AgentProfile = {
    agentId: 'frontend',
    displayName: 'Frontend Developer',
    description: 'Expert in frontend development, React, and UI/UX',
    enabled: true,
    capabilities: ['react', 'typescript', 'css', 'html'],
    expertise: ['react-hooks', 'state-management', 'responsive-design'],
    role: 'Frontend Developer',
    selectionMetadata: {
      agentCategory: 'implementer',
      primaryIntents: ['implement', 'build', 'create', 'design'],
      keywords: ['react', 'component', 'ui', 'frontend', 'css'],
      exampleTasks: [
        'Create React component',
        'Build user interface',
        'Implement responsive design',
      ],
      notForTasks: ['database', 'api endpoint', 'backend'],
      antiKeywords: ['database', 'sql', 'migration', 'backend'],
    },
  };

  const researcherAgent: AgentProfile = {
    agentId: 'researcher',
    displayName: 'Riley',
    description: 'Expert in technical research and documentation',
    enabled: true,
    capabilities: ['research', 'documentation', 'analysis'],
    expertise: ['technical-research', 'literature-review'],
    role: 'Technical Researcher',
    selectionMetadata: {
      agentCategory: 'specialist',
      primaryIntents: ['research', 'investigate', 'compare', 'analyze'],
      keywords: ['documentation', 'latest', 'trend', 'state-of-the-art'],
      exampleTasks: [
        'Research the latest React 19 features',
        'Compare different authentication libraries',
      ],
      notForTasks: ['implement this feature', 'write unit tests'],
      antiKeywords: ['implement', 'code', 'deploy', 'fix'],
    },
  };

  beforeEach(async () => {
    registry = new InMemoryAgentRegistry();
    await registry.register(backendAgent);
    await registry.register(frontendAgent);
    await registry.register(researcherAgent);

    selectionService = createAgentSelectionService(registry);
  });

  describe('recommend (INV-AGT-SEL-001 to INV-AGT-SEL-006)', () => {
    it('should be deterministic (INV-AGT-SEL-001)', async () => {
      const task = 'Build REST API endpoints';

      const result1 = await selectionService.recommend({ task });
      const result2 = await selectionService.recommend({ task });

      expect(result1.recommended).toBe(result2.recommended);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it('should return confidence between 0 and 1 (INV-AGT-SEL-002)', async () => {
      const result = await selectionService.recommend({
        task: 'Build an API',
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should sort results by confidence descending (INV-AGT-SEL-003)', async () => {
      const result = await selectionService.recommend({
        task: 'Build an application',
        maxResults: 3,
      });

      if (result.alternatives.length > 0) {
        expect(result.confidence).toBeGreaterThanOrEqual(
          result.alternatives[0]!.confidence
        );
      }

      for (let i = 1; i < result.alternatives.length; i++) {
        expect(result.alternatives[i - 1]!.confidence).toBeGreaterThanOrEqual(
          result.alternatives[i]!.confidence
        );
      }
    });

    it('should fallback to standard agent (INV-AGT-SEL-004)', async () => {
      // Clear all agents
      registry.clear();

      const result = await selectionService.recommend({
        task: 'Some task with no matching agents',
      });

      expect(result.recommended).toBe('standard');
      expect(result.confidence).toBe(0.5);
    });

    it('should boost confidence for exampleTasks match (INV-AGT-SEL-005)', async () => {
      const result = await selectionService.recommend({
        task: 'Build REST API endpoints', // Exact match with backend exampleTask
      });

      expect(result.recommended).toBe('backend');
      expect(result.confidence).toBeGreaterThan(0.5); // Should have significant boost
    });

    it('should reduce confidence for notForTasks match (INV-AGT-SEL-006)', async () => {
      // Ask backend agent about frontend task
      const frontendTask = await selectionService.recommend({
        task: 'design UI components',
      });

      // Backend should not be top recommendation for UI task
      expect(frontendTask.recommended).not.toBe('backend');
    });

    it('should match researcher for research tasks', async () => {
      const result = await selectionService.recommend({
        task: 'Research the latest React 19 features',
      });

      expect(result.recommended).toBe('researcher');
    });

    it('should filter by team', async () => {
      // Register an agent with a team
      await registry.register({
        agentId: 'devops',
        description: 'DevOps specialist',
        enabled: true,
        team: 'infrastructure',
        capabilities: ['deployment', 'ci-cd'],
      });

      const result = await selectionService.recommend({
        task: 'Deploy application',
        team: 'infrastructure',
      });

      expect(result.recommended).toBe('devops');
    });

    it('should exclude specified agents', async () => {
      const result = await selectionService.recommend({
        task: 'Build REST API endpoints',
        excludeAgents: ['backend'],
      });

      expect(result.recommended).not.toBe('backend');
    });

    it('should respect maxResults', async () => {
      const result = await selectionService.recommend({
        task: 'Build application',
        maxResults: 2,
      });

      // alternatives + recommended = total results
      expect(result.alternatives.length + 1).toBeLessThanOrEqual(2);
    });

    it('should match required capabilities', async () => {
      const result = await selectionService.recommend({
        task: 'Build something',
        requiredCapabilities: ['react', 'css'],
      });

      expect(result.recommended).toBe('frontend');
    });
  });

  describe('getCapabilities', () => {
    it('should return all capabilities', async () => {
      const result = await selectionService.getCapabilities({});

      expect(result.capabilities).toContain('api');
      expect(result.capabilities).toContain('react');
      expect(result.capabilities).toContain('research');
    });

    it('should map agents by capability', async () => {
      const result = await selectionService.getCapabilities({});

      expect(result.agentsByCapability['api']).toContain('backend');
      expect(result.agentsByCapability['react']).toContain('frontend');
    });

    it('should map capabilities by agent', async () => {
      const result = await selectionService.getCapabilities({});

      expect(result.capabilitiesByAgent['backend']).toContain('api');
      expect(result.capabilitiesByAgent['frontend']).toContain('react');
    });

    it('should include categories', async () => {
      const result = await selectionService.getCapabilities({});

      expect(result.categoriesByAgent?.['backend']).toBe('implementer');
      expect(result.categoriesByAgent?.['researcher']).toBe('specialist');
    });

    it('should filter by category', async () => {
      const result = await selectionService.getCapabilities({
        category: 'specialist',
      });

      expect(result.capabilitiesByAgent['researcher']).toBeDefined();
      expect(result.capabilitiesByAgent['backend']).toBeUndefined();
    });

    it('should include disabled agents when requested', async () => {
      await registry.register({
        agentId: 'disabled-agent',
        description: 'Disabled agent',
        enabled: false,
        capabilities: ['special'],
      });

      const withDisabled = await selectionService.getCapabilities({
        includeDisabled: true,
      });

      expect(withDisabled.capabilitiesByAgent['disabled-agent']).toBeDefined();
    });
  });
});

describe('Agent Selection Service with Feedback (INV-AGT-SEL-007)', () => {
  let registry: InMemoryAgentRegistry;
  let feedbackAdjuster: FeedbackScoreAdjusterPort;
  let selectionService: AgentSelectionServicePort;

  const agent1: AgentProfile = {
    agentId: 'agent-a',
    description: 'Agent A',
    enabled: true,
    capabilities: ['task-type'],
    selectionMetadata: {
      primaryIntents: ['process'],
      keywords: ['task'],
    },
  };

  const agent2: AgentProfile = {
    agentId: 'agent-b',
    description: 'Agent B',
    enabled: true,
    capabilities: ['task-type'],
    selectionMetadata: {
      primaryIntents: ['process'],
      keywords: ['task'],
    },
  };

  beforeEach(async () => {
    registry = new InMemoryAgentRegistry();
    await registry.register(agent1);
    await registry.register(agent2);

    // Mock feedback adjuster
    feedbackAdjuster = {
      async getAdjustment(agentId: string, _taskDescription: string): Promise<number> {
        // Agent A gets positive adjustment, Agent B gets negative
        if (agentId === 'agent-a') return 0.3;
        if (agentId === 'agent-b') return -0.2;
        return 0;
      },
    };

    selectionService = new AgentSelectionService(registry, {
      feedbackAdjuster,
    });
  });

  it('should apply positive feedback adjustment (INV-AGT-SEL-007)', async () => {
    const result = await selectionService.recommend({
      task: 'Process this task',
      maxResults: 2,
    });

    // Agent A should be recommended due to positive feedback adjustment (+0.3)
    // Agent B has negative adjustment (-0.2)
    expect(result.recommended).toBe('agent-a');

    // The confidence difference should reflect the adjustments
    // Agent A: base score + 0.3, Agent B: base score - 0.2 = 0.5 difference
    if (result.alternatives.length > 0) {
      expect(result.confidence).toBeGreaterThan(result.alternatives[0]!.confidence);
    }
  });

  it('should apply negative feedback adjustment (INV-AGT-SEL-007)', async () => {
    // Create service with only agent-b having negative adjustment
    const negAdjuster: FeedbackScoreAdjusterPort = {
      async getAdjustment(agentId: string): Promise<number> {
        if (agentId === 'agent-b') return -0.5;
        return 0;
      },
    };

    const service = new AgentSelectionService(registry, {
      feedbackAdjuster: negAdjuster,
    });

    const result = await service.recommend({
      task: 'Process this task',
    });

    // Agent A should be recommended due to agent B's negative adjustment
    expect(result.recommended).toBe('agent-a');
  });

  it('should clamp adjusted confidence to [0,1] (INV-AGT-SEL-002)', async () => {
    // Create adjuster that would push score above 1
    const extremeAdjuster: FeedbackScoreAdjusterPort = {
      async getAdjustment(): Promise<number> {
        return 0.5; // Max allowed adjustment
      },
    };

    const service = new AgentSelectionService(registry, {
      feedbackAdjuster: extremeAdjuster,
    });

    const result = await service.recommend({
      task: 'Process this task',
    });

    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should work without feedback adjuster', async () => {
    const serviceNoFeedback = createAgentSelectionService(registry);

    const result = await serviceNoFeedback.recommend({
      task: 'Process this task',
    });

    // Should still work, just without feedback adjustments
    expect(result.recommended).toBeDefined();
    expect(result.confidence).toBeDefined();
  });

  it('should handle zero adjustment gracefully', async () => {
    const zeroAdjuster: FeedbackScoreAdjusterPort = {
      async getAdjustment(): Promise<number> {
        return 0;
      },
    };

    const service = new AgentSelectionService(registry, {
      feedbackAdjuster: zeroAdjuster,
    });

    const result = await service.recommend({
      task: 'Process this task',
    });

    // Should work and not include feedback adjustment in reason
    expect(result.recommended).toBeDefined();
    expect(result.reason).not.toContain('feedback adjustment');
  });
});

describe('Factory Function', () => {
  it('should create selection service with options', async () => {
    const registry = new InMemoryAgentRegistry();
    await registry.register({
      agentId: 'test',
      description: 'Test',
      enabled: true,
    });

    const mockAdjuster: FeedbackScoreAdjusterPort = {
      async getAdjustment(): Promise<number> {
        return 0.1;
      },
    };

    const service = createAgentSelectionService(registry, {
      feedbackAdjuster: mockAdjuster,
    });

    const result = await service.recommend({ task: 'test' });
    expect(result).toBeDefined();
  });
});
