/**
 * Agent Helpers Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  isValidAgentName,
  suggestValidAgentName,
  checkDisplayNameConflict,
  listAvailableTemplates,
  listAvailableTeams
} from '../../src/cli/commands/agent/helpers.js';

describe('Agent Helpers', () => {
  describe('isValidAgentName', () => {
    it('should accept valid agent names', () => {
      expect(isValidAgentName('backend').valid).toBe(true);
      expect(isValidAgentName('frontend-dev').valid).toBe(true);
      expect(isValidAgentName('qa-specialist').valid).toBe(true);
      expect(isValidAgentName('agent-123').valid).toBe(true);
    });

    it('should reject names starting with numbers', () => {
      const result = isValidAgentName('123-agent');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase letter');
    });

    it('should reject names with uppercase letters', () => {
      const result = isValidAgentName('Backend');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject names with special characters', () => {
      const result = isValidAgentName('backend_dev');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase letters, numbers, and hyphens');
    });

    it('should reject names with consecutive hyphens', () => {
      const result = isValidAgentName('backend--dev');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });

    it('should reject names ending with hyphen', () => {
      const result = isValidAgentName('backend-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot end with a hyphen');
    });

    it('should reject names that are too short', () => {
      const result = isValidAgentName('a');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2 characters');
    });

    it('should reject names that are too long', () => {
      const result = isValidAgentName('a'.repeat(51));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 50 characters');
    });

    it('should reject empty names', () => {
      const result = isValidAgentName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('suggestValidAgentName', () => {
    it('should convert uppercase to lowercase', () => {
      expect(suggestValidAgentName('Backend')).toBe('backend');
    });

    it('should replace invalid characters with hyphens', () => {
      expect(suggestValidAgentName('backend_dev')).toBe('backend-dev');
      expect(suggestValidAgentName('backend dev')).toBe('backend-dev');
      expect(suggestValidAgentName('backend@dev')).toBe('backend-dev');
    });

    it('should remove consecutive hyphens', () => {
      expect(suggestValidAgentName('backend--dev')).toBe('backend-dev');
      expect(suggestValidAgentName('backend---dev')).toBe('backend-dev');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(suggestValidAgentName('-backend-')).toBe('backend');
    });

    it('should prepend "agent-" if starting with number', () => {
      expect(suggestValidAgentName('123-backend')).toBe('agent-123-backend');
    });

    it('should limit length to 50 characters', () => {
      const longName = 'a'.repeat(60);
      const suggested = suggestValidAgentName(longName);
      expect(suggested.length).toBeLessThanOrEqual(50);
    });

    it('should return "agent" for very short invalid names', () => {
      expect(suggestValidAgentName('-')).toBe('agent');
      expect(suggestValidAgentName('_')).toBe('agent');
    });
  });

  // NOTE: Skipped due to process.chdir() not supported in Vitest worker threads
  // Run with --pool=forks or --no-threads to test locally
  // TODO v5.8: Refactor helpers to accept baseDir parameter
  describe.skip('checkDisplayNameConflict', () => {
    let testDir: string;
    let originalCwd: string;

    beforeEach(async () => {
      // Save original working directory
      originalCwd = process.cwd();

      testDir = join(tmpdir(), `agent-test-${Date.now()}`);
      await mkdir(join(testDir, '.automatosx', 'agents'), { recursive: true });

      // Change working directory to test directory
      process.chdir(testDir);
    });

    afterEach(async () => {
      // Restore original working directory
      process.chdir(originalCwd);

      await rm(testDir, { recursive: true, force: true });
    });

    it('should return undefined for no conflicts', async () => {
      const conflict = await checkDisplayNameConflict('NewAgent');
      expect(conflict).toBeUndefined();
    });

    it('should detect conflicts with existing displayName', async () => {
      const agentYaml = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
      `;
      await writeFile(join(testDir, '.automatosx', 'agents', 'backend.yaml'), agentYaml);

      const conflict = await checkDisplayNameConflict('Bob');
      expect(conflict).toBe('backend');
    });

    it('should be case-insensitive', async () => {
      const agentYaml = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
      `;
      await writeFile(join(testDir, '.automatosx', 'agents', 'backend.yaml'), agentYaml);

      const conflict = await checkDisplayNameConflict('bob');
      expect(conflict).toBe('backend');

      const conflict2 = await checkDisplayNameConflict('BOB');
      expect(conflict2).toBe('backend');
    });

    it('should exclude specified agent', async () => {
      const agentYaml = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
      `;
      await writeFile(join(testDir, '.automatosx', 'agents', 'backend.yaml'), agentYaml);

      const conflict = await checkDisplayNameConflict('Bob', 'backend');
      expect(conflict).toBeUndefined();
    });
  });

  describe('listAvailableTemplates', () => {
    it('should list built-in templates', async () => {
      const templates = await listAvailableTemplates();
      expect(templates.length).toBeGreaterThan(0);

      // Should include built-in templates
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('basic-agent');
    });

    // NOTE: Skipped due to process.chdir() not supported in Vitest worker threads
    // TODO v5.8: Refactor to accept baseDir parameter
    it.skip('should include project templates if they exist', async () => {
      const originalCwd = process.cwd();
      const testDir = join(tmpdir(), `agent-test-${Date.now()}`);

      try {
        await mkdir(join(testDir, '.automatosx', 'templates'), { recursive: true });
        process.chdir(testDir);

        // Create a custom template
        await writeFile(join(testDir, '.automatosx', 'templates', 'custom.yaml'), 'name: custom');

        const templates = await listAvailableTemplates();
        const templateNames = templates.map(t => t.name);
        expect(templateNames).toContain('custom');
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);

        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('listAvailableTeams', () => {
    // NOTE: Skipped due to process.chdir() not supported in Vitest worker threads
    // TODO v5.8: Refactor to accept baseDir parameter
    it.skip('should return default teams if no custom teams exist', async () => {
      const originalCwd = process.cwd();
      const testDir = join(tmpdir(), `agent-test-${Date.now()}`);

      try {
        await mkdir(join(testDir, '.automatosx', 'teams'), { recursive: true });
        process.chdir(testDir);

        // Create default teams
        const coreTeam = `
name: core
displayName: Core Team
description: Quality assurance, core functions
provider:
  primary: claude
  fallbackChain: [claude, gemini, codex]
      `;
        await writeFile(join(testDir, '.automatosx', 'teams', 'core.yaml'), coreTeam);

        const engineeringTeam = `
name: engineering
displayName: Engineering Team
description: Software development
provider:
  primary: codex
  fallbackChain: [codex, gemini, claude]
      `;
        await writeFile(join(testDir, '.automatosx', 'teams', 'engineering.yaml'), engineeringTeam);

        const teams = await listAvailableTeams();
        expect(teams.length).toBeGreaterThan(0);

        const teamNames = teams.map(t => t.name);
        expect(teamNames).toContain('core');
        expect(teamNames).toContain('engineering');
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);

        await rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
