/**
 * MCP Tool Tests: list_agents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createListAgentsHandler } from '../../../../src/mcp/tools/list-agents.js';

describe('MCP Tool: list_agents', () => {
  let mockProfileLoader: any;

  beforeEach(() => {
    mockProfileLoader = {
      listProfiles: vi.fn(),
      loadProfile: vi.fn()
    };
  });

  describe('Successful Listing', () => {
    it('should list all available agents', async () => {
      const mockProfiles = [
        {
          name: 'backend',
          displayName: 'Bob',
          role: 'Senior Backend Engineer',
          team: 'engineering'
        },
        {
          name: 'frontend',
          displayName: 'Frank',
          role: 'Senior Frontend Engineer',
          team: 'engineering'
        },
        {
          name: 'product',
          displayName: 'Paris',
          role: 'Product Manager',
          team: 'business'
        }
      ];

      mockProfileLoader.listProfiles.mockResolvedValue([
        'backend',
        'frontend',
        'product'
      ]);

      mockProfiles.forEach((profile) => {
        mockProfileLoader.loadProfile
          .mockResolvedValueOnce(profile);
      });

      const handler = createListAgentsHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({});

      expect(result.agents).toHaveLength(3);
      expect(result.agents[0]).toEqual({
        name: 'backend',
        displayName: 'Bob',
        role: 'Senior Backend Engineer',
        team: 'engineering'
      });
      expect(result.agents[1]).toEqual({
        name: 'frontend',
        displayName: 'Frank',
        role: 'Senior Frontend Engineer',
        team: 'engineering'
      });
      expect(result.agents[2]).toEqual({
        name: 'product',
        displayName: 'Paris',
        role: 'Product Manager',
        team: 'business'
      });
    });

    it('should handle empty agent list', async () => {
      mockProfileLoader.listProfiles.mockResolvedValue([]);

      const handler = createListAgentsHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({});

      expect(result.agents).toHaveLength(0);
      expect(result.agents).toEqual([]);
    });

    it('should filter out agents that fail to load', async () => {
      mockProfileLoader.listProfiles.mockResolvedValue([
        'backend',
        'corrupted-agent',
        'frontend'
      ]);

      mockProfileLoader.loadProfile
        .mockResolvedValueOnce({
          name: 'backend',
          displayName: 'Bob',
          role: 'Senior Backend Engineer',
          team: 'engineering'
        })
        .mockRejectedValueOnce(new Error('Profile corrupted'))
        .mockResolvedValueOnce({
          name: 'frontend',
          displayName: 'Frank',
          role: 'Senior Frontend Engineer',
          team: 'engineering'
        });

      const handler = createListAgentsHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({});

      // Should only return 2 agents (corrupted one filtered out)
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]?.name).toBe('backend');
      expect(result.agents[1]?.name).toBe('frontend');
    });
  });

  describe('Error Handling', () => {
    it('should handle listProfiles failure', async () => {
      mockProfileLoader.listProfiles.mockRejectedValue(
        new Error('Failed to read agents directory')
      );

      const handler = createListAgentsHandler({
        profileLoader: mockProfileLoader
      });

      await expect(handler({})).rejects.toThrow('Failed to list agents');
      await expect(handler({})).rejects.toThrow('Failed to read agents directory');
    });

    it('should handle partial profile loading failure gracefully', async () => {
      mockProfileLoader.listProfiles.mockResolvedValue([
        'agent1',
        'agent2',
        'agent3'
      ]);

      mockProfileLoader.loadProfile
        .mockResolvedValueOnce({
          name: 'agent1',
          displayName: 'Agent 1',
          role: 'Engineer',
          team: 'engineering'
        })
        .mockRejectedValueOnce(new Error('Load failed'))
        .mockResolvedValueOnce({
          name: 'agent3',
          displayName: 'Agent 3',
          role: 'Designer',
          team: 'design'
        });

      const handler = createListAgentsHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({});

      // Should return 2 agents (agent2 filtered out)
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]?.name).toBe('agent1');
      expect(result.agents[1]?.name).toBe('agent3');
    });
  });

  describe('Profile Data', () => {
    it('should include all required fields', async () => {
      mockProfileLoader.listProfiles.mockResolvedValue(['test-agent']);
      mockProfileLoader.loadProfile.mockResolvedValue({
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'Test Engineer',
        team: 'test-team',
        // Additional fields that should be ignored
        systemPrompt: 'You are a test agent',
        abilities: ['test-ability'],
        selectionMetadata: undefined
      });

      const handler = createListAgentsHandler({
        profileLoader: mockProfileLoader
      });

      const result = await handler({});

      expect(result.agents).toHaveLength(1);

      // Should include name, displayName, role, team, selectionMetadata (v5.7.0+)
      const agent = result.agents[0];
      expect(agent).toBeDefined();
      expect(agent).toEqual({
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'Test Engineer',
        team: 'test-team',
        selectionMetadata: undefined
      });

      // Should have 5 fields (v5.7.0+: added selectionMetadata)
      expect(agent && Object.keys(agent)).toHaveLength(5);
    });
  });
});
