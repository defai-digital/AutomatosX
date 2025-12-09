/**
 * Comprehensive tests for TeamManager
 *
 * Tests for team configuration loading and validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamManager } from '../../../src/core/team-manager.js';
import { TeamNotFoundError, TeamValidationError } from '../../../src/types/team.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn()
}));

// Mock js-yaml
vi.mock('js-yaml', () => ({
  load: vi.fn()
}));

import { readFile, readdir } from 'fs/promises';
import { load } from 'js-yaml';

describe('TeamManager', () => {
  let teamManager: TeamManager;
  const mockReadFile = vi.mocked(readFile);
  const mockReaddir = vi.mocked(readdir);
  const mockLoad = vi.mocked(load);

  const validTeamConfig = {
    name: 'core',
    displayName: 'Core Team',
    description: 'Core team for main development',
    provider: {
      primary: 'claude',
      fallback: 'gemini'
    },
    sharedAbilities: ['code-review', 'testing']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    teamManager = new TeamManager('/test/teams');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadTeam', () => {
    it('should load team from YAML file', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue(validTeamConfig);

      const team = await teamManager.loadTeam('core');

      expect(team).toEqual(validTeamConfig);
      expect(mockReadFile).toHaveBeenCalledWith('/test/teams/core.yaml', 'utf-8');
    });

    it('should cache loaded team', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue(validTeamConfig);

      // First call loads from file
      await teamManager.loadTeam('core');
      expect(mockReadFile).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const team = await teamManager.loadTeam('core');
      expect(mockReadFile).toHaveBeenCalledTimes(1); // Still only one call
      expect(team).toEqual(validTeamConfig);
    });

    it('should throw TeamNotFoundError when team file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      await expect(teamManager.loadTeam('nonexistent')).rejects.toThrow(TeamNotFoundError);
    });

    it('should throw TeamValidationError for other read errors', async () => {
      mockReadFile.mockRejectedValue(new Error('Read permission denied'));

      await expect(teamManager.loadTeam('core')).rejects.toThrow(TeamValidationError);
      await expect(teamManager.loadTeam('core')).rejects.toThrow(/Failed to load team/);
    });
  });

  describe('getAllTeams', () => {
    it('should load all teams from directory', async () => {
      mockReaddir.mockResolvedValue(['core.yaml', 'engineering.yaml'] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue(validTeamConfig);

      const teams = await teamManager.getAllTeams();

      expect(teams).toHaveLength(2);
      expect(mockReaddir).toHaveBeenCalledWith('/test/teams');
    });

    it('should filter only YAML files', async () => {
      mockReaddir.mockResolvedValue(['core.yaml', 'README.md', 'team.yml', 'config.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue(validTeamConfig);

      const teams = await teamManager.getAllTeams();

      // Should load core.yaml and team.yml only
      expect(teams).toHaveLength(2);
    });

    it('should handle .yml extension', async () => {
      mockReaddir.mockResolvedValue(['team.yml'] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue(validTeamConfig);

      const teams = await teamManager.getAllTeams();

      expect(teams).toHaveLength(1);
    });

    it('should return empty array when teams directory does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReaddir.mockRejectedValue(error);

      const teams = await teamManager.getAllTeams();

      expect(teams).toEqual([]);
    });

    it('should skip teams that fail to load', async () => {
      mockReaddir.mockResolvedValue(['valid.yaml', 'invalid.yaml'] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockReadFile
        .mockResolvedValueOnce('valid yaml')
        .mockRejectedValueOnce(new Error('Parse error'));
      mockLoad.mockReturnValue(validTeamConfig);

      const teams = await teamManager.getAllTeams();

      // Should only include valid team
      expect(teams).toHaveLength(1);
    });

    it('should propagate non-ENOENT errors', async () => {
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      await expect(teamManager.getAllTeams()).rejects.toThrow('Permission denied');
    });
  });

  describe('listTeams', () => {
    it('should list team names from directory', async () => {
      mockReaddir.mockResolvedValue(['core.yaml', 'engineering.yaml'] as unknown as Awaited<ReturnType<typeof readdir>>);

      const names = await teamManager.listTeams();

      expect(names).toEqual(['core', 'engineering']);
    });

    it('should handle both .yaml and .yml extensions', async () => {
      mockReaddir.mockResolvedValue(['core.yaml', 'business.yml'] as unknown as Awaited<ReturnType<typeof readdir>>);

      const names = await teamManager.listTeams();

      expect(names).toEqual(['core', 'business']);
    });

    it('should return empty array when directory does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReaddir.mockRejectedValue(error);

      const names = await teamManager.listTeams();

      expect(names).toEqual([]);
    });

    it('should propagate non-ENOENT errors', async () => {
      mockReaddir.mockRejectedValue(new Error('Access denied'));

      await expect(teamManager.listTeams()).rejects.toThrow('Access denied');
    });

    it('should filter non-YAML files', async () => {
      mockReaddir.mockResolvedValue(['core.yaml', 'README.md', '.gitignore'] as unknown as Awaited<ReturnType<typeof readdir>>);

      const names = await teamManager.listTeams();

      expect(names).toEqual(['core']);
    });
  });

  describe('teamExists', () => {
    it('should return true for existing team', async () => {
      mockReaddir.mockResolvedValue(['core.yaml', 'engineering.yaml'] as unknown as Awaited<ReturnType<typeof readdir>>);

      const exists = await teamManager.teamExists('core');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing team', async () => {
      mockReaddir.mockResolvedValue(['core.yaml'] as unknown as Awaited<ReturnType<typeof readdir>>);

      const exists = await teamManager.teamExists('nonexistent');

      expect(exists).toBe(false);
    });

    it('should return false when teams directory does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReaddir.mockRejectedValue(error);

      const exists = await teamManager.teamExists('core');

      expect(exists).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cached teams', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue(validTeamConfig);

      // Load team (caches it)
      await teamManager.loadTeam('core');
      expect(mockReadFile).toHaveBeenCalledTimes(1);

      // Clear cache
      teamManager.clearCache();

      // Load again should hit file system
      await teamManager.loadTeam('core');
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('validation', () => {
    it('should throw error for missing team name', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        displayName: 'Core',
        description: 'Test',
        provider: { primary: 'claude' }
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow(TeamValidationError);
      await expect(teamManager.loadTeam('core')).rejects.toThrow('Team name is required');
    });

    it('should throw error for missing displayName', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        description: 'Test',
        provider: { primary: 'claude' }
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('displayName is required');
    });

    it('should throw error for missing description', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        provider: { primary: 'claude' }
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('description is required');
    });

    it('should throw error for missing provider configuration', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test'
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('provider configuration is required');
    });

    it('should throw error for missing provider.primary', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test',
        provider: {}
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('provider.primary is required');
    });

    it('should throw error for invalid primary provider', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test',
        provider: { primary: 'invalid-provider' }
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('Invalid primary provider');
    });

    it('should throw error for invalid fallback provider', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test',
        provider: { primary: 'claude', fallback: 'invalid' }
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('Invalid fallback provider');
    });

    it('should throw error for invalid provider in fallbackChain', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test',
        provider: {
          primary: 'claude',
          fallbackChain: ['gemini', 'invalid-provider']
        }
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('Invalid provider in fallbackChain');
    });

    it('should throw error when sharedAbilities is not an array', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test',
        provider: { primary: 'claude' },
        sharedAbilities: 'not-an-array'
      });

      await expect(teamManager.loadTeam('core')).rejects.toThrow('sharedAbilities must be an array');
    });

    describe('valid provider names', () => {
      const validProviders = ['claude', 'claude-code', 'gemini', 'gemini-cli', 'codex', 'openai'];

      validProviders.forEach(provider => {
        it(`should accept ${provider} as valid primary provider`, async () => {
          mockReadFile.mockResolvedValue('yaml content');
          mockLoad.mockReturnValue({
            name: 'core',
            displayName: 'Core',
            description: 'Test',
            provider: { primary: provider }
          });

          const team = await teamManager.loadTeam('core');
          expect(team.provider.primary).toBe(provider);
        });

        it(`should accept ${provider} as valid fallback provider`, async () => {
          mockReadFile.mockResolvedValue('yaml content');
          mockLoad.mockReturnValue({
            name: 'core',
            displayName: 'Core',
            description: 'Test',
            provider: { primary: 'claude', fallback: provider }
          });

          const team = await teamManager.loadTeam('core');
          expect(team.provider.fallback).toBe(provider);
        });
      });
    });

    it('should validate team with fallbackChain', async () => {
      mockReadFile.mockResolvedValue('yaml content');
      mockLoad.mockReturnValue({
        name: 'core',
        displayName: 'Core',
        description: 'Test',
        provider: {
          primary: 'claude',
          fallbackChain: ['gemini', 'codex']
        },
        sharedAbilities: ['testing']
      });

      const team = await teamManager.loadTeam('core');
      expect(team.provider.fallbackChain).toEqual(['gemini', 'codex']);
    });
  });
});
