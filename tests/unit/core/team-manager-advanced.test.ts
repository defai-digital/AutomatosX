/**
 * Team Manager Advanced Unit Tests
 *
 * Comprehensive tests for the TeamManager including:
 * - Team loading and validation
 * - Caching behavior
 * - Error handling
 * - Provider validation
 *
 * @module tests/unit/core/team-manager-advanced.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamManager } from '@/core/team-manager.js';
import { TeamNotFoundError, TeamValidationError } from '@/types/team.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

// ============================================================================
// Test Setup
// ============================================================================

describe('TeamManager Advanced Tests', () => {
  let teamManager: TeamManager;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test team files
    testDir = path.join(tmpdir(), `team-manager-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    teamManager = new TeamManager(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function createTeamFile(name: string, content: Record<string, unknown>): Promise<void> {
    const yaml = Object.entries(content)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
        } else if (typeof value === 'object' && value !== null) {
          const nested = Object.entries(value)
            .map(([k, v]) => {
              if (Array.isArray(v)) {
                return `  ${k}:\n${v.map(item => `    - ${item}`).join('\n')}`;
              }
              return `  ${k}: ${v}`;
            })
            .join('\n');
          return `${key}:\n${nested}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    await fs.writeFile(path.join(testDir, `${name}.yaml`), yaml);
  }

  // ============================================================================
  // Team Loading Tests
  // ============================================================================

  describe('Team Loading', () => {
    it('should load a valid team configuration', async () => {
      await createTeamFile('core', {
        name: 'core',
        displayName: 'Core Team',
        description: 'The core development team',
        provider: {
          primary: 'claude',
        },
      });

      const team = await teamManager.loadTeam('core');

      expect(team.name).toBe('core');
      expect(team.displayName).toBe('Core Team');
      expect(team.description).toBe('The core development team');
      expect(team.provider.primary).toBe('claude');
    });

    it('should load team with all provider options', async () => {
      await createTeamFile('engineering', {
        name: 'engineering',
        displayName: 'Engineering Team',
        description: 'Software engineering team',
        provider: {
          primary: 'claude',
          fallback: 'gemini',
          fallbackChain: ['openai', 'codex'],
        },
      });

      const team = await teamManager.loadTeam('engineering');

      expect(team.provider.primary).toBe('claude');
      expect(team.provider.fallback).toBe('gemini');
      expect(team.provider.fallbackChain).toEqual(['openai', 'codex']);
    });

    it('should load team with shared abilities', async () => {
      await createTeamFile('platform', {
        name: 'platform',
        displayName: 'Platform Team',
        description: 'Platform infrastructure team',
        provider: {
          primary: 'gemini-cli',
        },
        sharedAbilities: ['docker', 'kubernetes', 'terraform'],
      });

      const team = await teamManager.loadTeam('platform');

      expect(team.sharedAbilities).toEqual(['docker', 'kubernetes', 'terraform']);
    });

    it('should throw TeamNotFoundError for non-existent team', async () => {
      await expect(teamManager.loadTeam('nonexistent')).rejects.toThrow(TeamNotFoundError);
    });

    it('should throw TeamValidationError for invalid YAML', async () => {
      await fs.writeFile(path.join(testDir, 'invalid.yaml'), 'not: valid: yaml: syntax:');

      await expect(teamManager.loadTeam('invalid')).rejects.toThrow();
    });
  });

  // ============================================================================
  // Team Validation Tests
  // ============================================================================

  describe('Team Validation', () => {
    it('should reject team without name', async () => {
      await createTeamFile('noname', {
        displayName: 'No Name Team',
        description: 'Missing name',
        provider: { primary: 'claude' },
      });

      await expect(teamManager.loadTeam('noname')).rejects.toThrow(TeamValidationError);
    });

    it('should reject team without displayName', async () => {
      await createTeamFile('nodisplay', {
        name: 'nodisplay',
        description: 'Missing displayName',
        provider: { primary: 'claude' },
      });

      await expect(teamManager.loadTeam('nodisplay')).rejects.toThrow(TeamValidationError);
    });

    it('should reject team without description', async () => {
      await createTeamFile('nodesc', {
        name: 'nodesc',
        displayName: 'No Description',
        provider: { primary: 'claude' },
      });

      await expect(teamManager.loadTeam('nodesc')).rejects.toThrow(TeamValidationError);
    });

    it('should reject team without provider', async () => {
      await createTeamFile('noprovider', {
        name: 'noprovider',
        displayName: 'No Provider',
        description: 'Missing provider config',
      });

      await expect(teamManager.loadTeam('noprovider')).rejects.toThrow(TeamValidationError);
    });

    it('should reject team without provider.primary', async () => {
      await createTeamFile('noprimary', {
        name: 'noprimary',
        displayName: 'No Primary',
        description: 'Missing primary provider',
        provider: { fallback: 'gemini' },
      });

      await expect(teamManager.loadTeam('noprimary')).rejects.toThrow(TeamValidationError);
    });

    it('should reject invalid primary provider', async () => {
      await createTeamFile('badprovider', {
        name: 'badprovider',
        displayName: 'Bad Provider',
        description: 'Invalid provider name',
        provider: { primary: 'invalid-provider' },
      });

      await expect(teamManager.loadTeam('badprovider')).rejects.toThrow(TeamValidationError);
    });

    it('should reject invalid fallback provider', async () => {
      await createTeamFile('badfallback', {
        name: 'badfallback',
        displayName: 'Bad Fallback',
        description: 'Invalid fallback provider',
        provider: { primary: 'claude', fallback: 'invalid-provider' },
      });

      await expect(teamManager.loadTeam('badfallback')).rejects.toThrow(TeamValidationError);
    });

    it('should reject invalid provider in fallbackChain', async () => {
      await createTeamFile('badchain', {
        name: 'badchain',
        displayName: 'Bad Chain',
        description: 'Invalid fallback chain',
        provider: { primary: 'claude', fallbackChain: ['gemini', 'invalid'] },
      });

      await expect(teamManager.loadTeam('badchain')).rejects.toThrow(TeamValidationError);
    });

    it('should accept all valid provider names', async () => {
      const validProviders = ['claude', 'claude-code', 'gemini', 'gemini-cli', 'codex', 'openai'];

      for (const provider of validProviders) {
        const teamName = `valid-${provider.replace('-', '')}`;
        await createTeamFile(teamName, {
          name: teamName,
          displayName: `Valid ${provider}`,
          description: `Team with ${provider}`,
          provider: { primary: provider },
        });

        const team = await teamManager.loadTeam(teamName);
        expect(team.provider.primary).toBe(provider);
        teamManager.clearCache();
      }
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('Caching', () => {
    it('should cache loaded teams', async () => {
      await createTeamFile('cached', {
        name: 'cached',
        displayName: 'Cached Team',
        description: 'Testing cache behavior',
        provider: { primary: 'claude' },
      });

      // Load twice
      const team1 = await teamManager.loadTeam('cached');
      const team2 = await teamManager.loadTeam('cached');

      // Should be the same reference (from cache)
      expect(team1).toBe(team2);
    });

    it('should clear cache', async () => {
      await createTeamFile('clearable', {
        name: 'clearable',
        displayName: 'Clearable Team',
        description: 'Testing cache clearing',
        provider: { primary: 'claude' },
      });

      const team1 = await teamManager.loadTeam('clearable');
      teamManager.clearCache();
      const team2 = await teamManager.loadTeam('clearable');

      // Should be different objects after cache clear
      expect(team1).not.toBe(team2);
      // But same content
      expect(team1.name).toBe(team2.name);
    });
  });

  // ============================================================================
  // List Teams Tests
  // ============================================================================

  describe('List Teams', () => {
    it('should list all available teams', async () => {
      await createTeamFile('team-a', {
        name: 'team-a',
        displayName: 'Team A',
        description: 'First team',
        provider: { primary: 'claude' },
      });

      await createTeamFile('team-b', {
        name: 'team-b',
        displayName: 'Team B',
        description: 'Second team',
        provider: { primary: 'gemini' },
      });

      const teams = await teamManager.listTeams();

      expect(teams).toContain('team-a');
      expect(teams).toContain('team-b');
    });

    it('should return empty array for non-existent directory', async () => {
      const nonExistentManager = new TeamManager('/non/existent/path');
      const teams = await nonExistentManager.listTeams();

      expect(teams).toEqual([]);
    });

    it('should handle both .yaml and .yml extensions', async () => {
      await fs.writeFile(
        path.join(testDir, 'yaml-team.yaml'),
        'name: yaml-team\ndisplayName: YAML Team\ndescription: Uses .yaml\nprovider:\n  primary: claude'
      );
      await fs.writeFile(
        path.join(testDir, 'yml-team.yml'),
        'name: yml-team\ndisplayName: YML Team\ndescription: Uses .yml\nprovider:\n  primary: gemini'
      );

      const teams = await teamManager.listTeams();

      expect(teams).toContain('yaml-team');
      expect(teams).toContain('yml-team');
    });
  });

  // ============================================================================
  // Get All Teams Tests
  // ============================================================================

  describe('Get All Teams', () => {
    it('should load all valid teams', async () => {
      await createTeamFile('all-a', {
        name: 'all-a',
        displayName: 'All A',
        description: 'First team',
        provider: { primary: 'claude' },
      });

      await createTeamFile('all-b', {
        name: 'all-b',
        displayName: 'All B',
        description: 'Second team',
        provider: { primary: 'gemini' },
      });

      const teams = await teamManager.getAllTeams();

      expect(teams).toHaveLength(2);
      expect(teams.map(t => t.name)).toContain('all-a');
      expect(teams.map(t => t.name)).toContain('all-b');
    });

    it('should skip invalid teams and continue loading others', async () => {
      await createTeamFile('valid-team', {
        name: 'valid-team',
        displayName: 'Valid Team',
        description: 'A valid team',
        provider: { primary: 'claude' },
      });

      // Create an invalid team file
      await fs.writeFile(path.join(testDir, 'invalid-team.yaml'), 'name: invalid\n# missing required fields');

      const teams = await teamManager.getAllTeams();

      // Should only have the valid team
      expect(teams).toHaveLength(1);
      expect(teams[0]?.name).toBe('valid-team');
    });

    it('should return empty array for non-existent directory', async () => {
      const nonExistentManager = new TeamManager('/non/existent/path');
      const teams = await nonExistentManager.getAllTeams();

      expect(teams).toEqual([]);
    });
  });

  // ============================================================================
  // Team Exists Tests
  // ============================================================================

  describe('Team Exists', () => {
    it('should return true for existing team', async () => {
      await createTeamFile('exists', {
        name: 'exists',
        displayName: 'Existing Team',
        description: 'This team exists',
        provider: { primary: 'claude' },
      });

      const exists = await teamManager.teamExists('exists');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing team', async () => {
      const exists = await teamManager.teamExists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle team with empty sharedAbilities array', async () => {
      await createTeamFile('empty-abilities', {
        name: 'empty-abilities',
        displayName: 'Empty Abilities',
        description: 'Team with empty abilities',
        provider: { primary: 'claude' },
        sharedAbilities: [],
      });

      const team = await teamManager.loadTeam('empty-abilities');
      // Empty arrays in YAML can be parsed as null
      expect(team.sharedAbilities === null || team.sharedAbilities?.length === 0).toBe(true);
    });

    it('should handle team names with hyphens', async () => {
      await createTeamFile('my-special-team', {
        name: 'my-special-team',
        displayName: 'My Special Team',
        description: 'Team with hyphenated name',
        provider: { primary: 'claude' },
      });

      const team = await teamManager.loadTeam('my-special-team');
      expect(team.name).toBe('my-special-team');
    });

    it('should handle concurrent team loading', async () => {
      await createTeamFile('concurrent', {
        name: 'concurrent',
        displayName: 'Concurrent Team',
        description: 'Testing concurrent loading',
        provider: { primary: 'claude' },
      });

      const [team1, team2, team3] = await Promise.all([
        teamManager.loadTeam('concurrent'),
        teamManager.loadTeam('concurrent'),
        teamManager.loadTeam('concurrent'),
      ]);

      expect(team1.name).toBe('concurrent');
      expect(team2.name).toBe('concurrent');
      expect(team3.name).toBe('concurrent');
    });

    it('should reject sharedAbilities that is not an array', async () => {
      await fs.writeFile(
        path.join(testDir, 'bad-abilities.yaml'),
        'name: bad-abilities\ndisplayName: Bad\ndescription: Bad abilities\nprovider:\n  primary: claude\nsharedAbilities: not-an-array'
      );

      await expect(teamManager.loadTeam('bad-abilities')).rejects.toThrow(TeamValidationError);
    });
  });
});
