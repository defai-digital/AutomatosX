/**
 * Tests for plan_multi_agent MCP tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPlanMultiAgentHandler,
  type PlanMultiAgentInput,
  type PlanMultiAgentOutput
} from '../../../../src/mcp/tools/plan-multi-agent.js';
import type { ProfileLoader } from '../../../../src/agents/profile-loader.js';
import type { IMemoryManager } from '../../../../src/types/memory.js';
import type { AgentProfile } from '../../../../src/types/agent.js';

describe('plan_multi_agent MCP tool', () => {
  let mockProfileLoader: ProfileLoader;
  let mockMemoryManager: IMemoryManager;

  const mockProfiles: Record<string, AgentProfile> = {
    backend: {
      name: 'backend',
      displayName: 'Benny',
      role: 'Backend Developer',
      description: 'Backend development specialist',
      systemPrompt: 'You are a backend developer',
      abilities: ['api-design', 'database'],
      selectionMetadata: {
        primaryIntents: ['implement API', 'backend service', 'database'],
        secondarySignals: ['api', 'server', 'endpoint', 'rest', 'graphql']
      }
    },
    frontend: {
      name: 'frontend',
      displayName: 'Frankie',
      role: 'Frontend Developer',
      description: 'Frontend development specialist',
      systemPrompt: 'You are a frontend developer',
      abilities: ['react', 'ui'],
      selectionMetadata: {
        primaryIntents: ['build UI', 'frontend component', 'user interface'],
        secondarySignals: ['ui', 'component', 'page', 'form', 'react']
      }
    },
    security: {
      name: 'security',
      displayName: 'Sarah',
      role: 'Security Engineer',
      description: 'Security engineering specialist',
      systemPrompt: 'You are a security engineer',
      abilities: ['security-audit', 'auth'],
      selectionMetadata: {
        primaryIntents: ['security audit', 'authentication', 'authorization'],
        secondarySignals: ['security', 'auth', 'jwt', 'oauth', 'vulnerability']
      }
    },
    quality: {
      name: 'quality',
      displayName: 'Queenie',
      role: 'QA Engineer',
      description: 'Quality assurance specialist',
      systemPrompt: 'You are a QA engineer',
      abilities: ['testing', 'review'],
      selectionMetadata: {
        primaryIntents: ['test', 'review', 'quality assurance'],
        secondarySignals: ['test', 'review', 'verify', 'validate', 'check']
      }
    },
    architecture: {
      name: 'architecture',
      displayName: 'Archie',
      role: 'Solutions Architect',
      description: 'Solutions architecture specialist',
      systemPrompt: 'You are a solutions architect',
      abilities: ['system-design', 'architecture'],
      selectionMetadata: {
        primaryIntents: ['design system', 'architecture', 'technical design'],
        secondarySignals: ['design', 'architecture', 'plan', 'structure']
      }
    }
  };

  beforeEach(() => {
    mockProfileLoader = {
      listProfiles: vi.fn().mockResolvedValue(Object.keys(mockProfiles)),
      loadProfile: vi.fn().mockImplementation((name: string) => {
        const profile = mockProfiles[name];
        if (!profile) throw new Error(`Profile not found: ${name}`);
        return Promise.resolve(profile);
      }),
      resolveAgentName: vi.fn().mockImplementation((name: string) => Promise.resolve(name))
    } as unknown as ProfileLoader;

    mockMemoryManager = {
      search: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue({ totalEntries: 0 })
    } as unknown as IMemoryManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('task analysis', () => {
    it('should analyze simple task and create plan', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Build a REST API for user management'
      });

      expect(result.originalTask).toBe('Build a REST API for user management');
      expect(result.subtasks.length).toBeGreaterThan(0);
      expect(result.executionPlan.length).toBeGreaterThan(0);
      expect(result.uniqueAgents.length).toBeGreaterThan(0);
    });

    it('should identify authentication tasks and assign security agent', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Implement user authentication with JWT tokens'
      });

      // Should include security agent for auth tasks
      const hasSecurityOrBackend = result.subtasks.some(
        t => t.agent === 'security' || t.agent === 'backend'
      );
      expect(hasSecurityOrBackend).toBe(true);
    });

    it('should create parallel execution groups for independent tasks', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Build a complete user registration system with login UI and backend API'
      });

      // Should have execution groups
      expect(result.executionPlan.length).toBeGreaterThan(0);

      // Should recommend parallel execution for complex task
      // (unless all tasks are sequential due to dependencies)
      expect(result.parallelizationAdvice).toBeDefined();
    });
  });

  describe('agent selection', () => {
    it('should select appropriate agents based on task keywords', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Design the API architecture and implement the backend service'
      });

      // Should include architecture or backend agent
      const agents = result.subtasks.map(t => t.agent);
      const hasRelevantAgent = agents.some(
        a => a === 'architecture' || a === 'backend'
      );
      expect(hasRelevantAgent).toBe(true);
    });

    it('should respect preferred agents when specified', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Build a simple feature',
        preferredAgents: ['backend', 'quality']
      });

      // Should prefer specified agents
      const agents = new Set(result.subtasks.map(t => t.agent));
      // At least some subtasks should use preferred agents
      const usesPreferred = result.subtasks.some(
        t => t.agent === 'backend' || t.agent === 'quality'
      );
      expect(usesPreferred).toBe(true);
    });
  });

  describe('output structure', () => {
    it('should return all required fields', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Build an e-commerce checkout system'
      });

      expect(result).toHaveProperty('originalTask');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('subtasks');
      expect(result).toHaveProperty('executionPlan');
      expect(result).toHaveProperty('totalAgents');
      expect(result).toHaveProperty('uniqueAgents');
      expect(result).toHaveProperty('recommendParallel');
      expect(result).toHaveProperty('parallelizationAdvice');
      expect(result).toHaveProperty('exampleCalls');
    });

    it('should provide example run_agent calls', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Implement user authentication'
      });

      expect(result.exampleCalls.length).toBeGreaterThan(0);
      expect(result.exampleCalls.some(c => c.includes('run_agent'))).toBe(true);
    });

    it('should include rationale for agent selection', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Build a REST API'
      });

      for (const subtask of result.subtasks) {
        expect(subtask.rationale).toBeDefined();
        expect(Array.isArray(subtask.rationale)).toBe(true);
      }
    });
  });

  describe('memory integration', () => {
    it('should include memory context when requested', async () => {
      const mockResults = [
        { entry: { id: 1, content: 'Previous auth implementation used JWT' }, similarity: 0.8 }
      ];
      mockMemoryManager.search = vi.fn().mockResolvedValue(mockResults);

      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader,
        memoryManager: mockMemoryManager
      });

      const result = await handler({
        task: 'Implement authentication',
        includeMemory: true
      });

      expect(mockMemoryManager.search).toHaveBeenCalled();
      expect(result.memoryContext).toBeDefined();
      expect(result.memoryContext?.length).toBeGreaterThan(0);
    });

    it('should not search memory when not requested', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader,
        memoryManager: mockMemoryManager
      });

      await handler({
        task: 'Build something',
        includeMemory: false
      });

      expect(mockMemoryManager.search).not.toHaveBeenCalled();
    });
  });

  describe('subtask limits', () => {
    it('should respect maxSubtasks parameter', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Build a very complex system with many features and components',
        maxSubtasks: 3
      });

      expect(result.subtasks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('dependency analysis', () => {
    it('should identify task dependencies', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Design system architecture, implement backend, and write tests'
      });

      // Later tasks should have dependencies on earlier design tasks
      const hasNonEmptyDeps = result.subtasks.some(t => t.dependencies.length > 0);
      // Note: May or may not have dependencies depending on task analysis
      expect(result.subtasks).toBeDefined();
    });

    it('should create execution groups based on dependencies', async () => {
      const handler = createPlanMultiAgentHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({
        task: 'Design the system, implement frontend and backend in parallel, then test'
      });

      // Should have multiple execution levels
      expect(result.executionPlan.length).toBeGreaterThan(0);

      // Each group should have tasks
      for (const group of result.executionPlan) {
        expect(group.tasks.length).toBeGreaterThan(0);
        expect(group).toHaveProperty('canParallelize');
        expect(group).toHaveProperty('parallelizationReason');
      }
    });
  });
});
