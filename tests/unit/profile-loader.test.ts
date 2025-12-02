/**
 * Profile Loader Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileLoader } from '../../src/agents/profile-loader.js';
import { AgentValidationError, AgentNotFoundError } from '../../src/types/agent.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ProfileLoader', () => {
  let testDir: string;
  let loader: ProfileLoader;

  beforeEach(async () => {
    // Create temp directory for test profiles
    testDir = join(tmpdir(), `automatosx-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    loader = new ProfileLoader(testDir);
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadProfile', () => {
    it('should load valid profile from YAML', async () => {
      const profileYaml = `
name: Test Agent
role: tester
description: A test agent
systemPrompt: You are a test agent
abilities:
  - test-ability
provider: claude
model: claude-3-5-sonnet-20241022
temperature: 0.7
maxTokens: 4096
      `;

      await writeFile(join(testDir, 'test.yaml'), profileYaml);

      const profile = await loader.loadProfile('test');

      // Name preprocessing: invalid name "Test Agent" moved to displayName, filename used as name
      expect(profile.name).toBe('test');
      expect(profile.displayName).toBe('Test Agent');
      expect(profile.role).toBe('tester');
      expect(profile.description).toBe('A test agent');
      expect(profile.systemPrompt).toBe('You are a test agent');
      expect(profile.abilities).toEqual(['test-ability']);
      expect(profile.provider).toBe('claude');
      expect(profile.model).toBe('claude-3-5-sonnet-20241022');
      expect(profile.temperature).toBe(0.7);
      expect(profile.maxTokens).toBe(4096);
    });

    it('should use filename as name if not specified', async () => {
      const profileYaml = `
role: tester
description: A test agent
systemPrompt: You are a test agent
      `;

      await writeFile(join(testDir, 'myagent.yaml'), profileYaml);

      const profile = await loader.loadProfile('myagent');
      expect(profile.name).toBe('myagent');
    });

    it('should use empty array for abilities if not specified', async () => {
      const profileYaml = `
name: Test
role: tester
description: A test agent
systemPrompt: You are a test agent
      `;

      await writeFile(join(testDir, 'test.yaml'), profileYaml);

      const profile = await loader.loadProfile('test');
      expect(profile.abilities).toEqual([]);
    });

    it('should throw AgentNotFoundError for missing profile', async () => {
      await expect(loader.loadProfile('nonexistent')).rejects.toThrow(AgentNotFoundError);
    });

    it('should cache loaded profiles', async () => {
      const profileYaml = `
name: Test
role: tester
description: A test agent
systemPrompt: You are a test agent
      `;

      await writeFile(join(testDir, 'test.yaml'), profileYaml);

      const profile1 = await loader.loadProfile('test');
      const profile2 = await loader.loadProfile('test');

      expect(profile1).toBe(profile2); // Same object reference (cached)
    });

    it('should clear cache', async () => {
      const profileYaml = `
name: Test
role: tester
description: A test agent
systemPrompt: You are a test agent
      `;

      await writeFile(join(testDir, 'test.yaml'), profileYaml);

      const profile1 = await loader.loadProfile('test');
      await loader.clearCache();
      const profile2 = await loader.loadProfile('test');

      expect(profile1).not.toBe(profile2); // Different object reference
    });
  });

  describe('listProfiles', () => {
    it('should list all available profiles (local + built-in)', async () => {
      await writeFile(join(testDir, 'agent1.yaml'), 'name: Agent1\nrole: test\ndescription: Test\nsystemPrompt: Test');
      await writeFile(join(testDir, 'agent2.yaml'), 'name: Agent2\nrole: test\ndescription: Test\nsystemPrompt: Test');
      await writeFile(join(testDir, 'agent3.yml'), 'name: Agent3\nrole: test\ndescription: Test\nsystemPrompt: Test');

      const profiles = await loader.listProfiles();

      // Should contain local agents
      expect(profiles).toContain('agent1');
      expect(profiles).toContain('agent2');
      expect(profiles).toContain('agent3');
      // Should also include built-in agents (fallback)
      expect(profiles.length).toBeGreaterThanOrEqual(3);
    });

    it('should return built-in agents for non-existent directory', async () => {
      const emptyLoader = new ProfileLoader('/nonexistent/path');
      const profiles = await emptyLoader.listProfiles();
      // Should fall back to built-in agents
      // v5.0.11: Updated to check for specialized default agents (not templates)
      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles).toContain('backend'); // Built-in agent
    });

    it('should ignore non-YAML files', async () => {
      await writeFile(join(testDir, 'agent1.yaml'), 'name: Agent1\nrole: test\ndescription: Test\nsystemPrompt: Test');
      await writeFile(join(testDir, 'readme.md'), '# README');
      await writeFile(join(testDir, 'config.json'), '{}');

      const profiles = await loader.listProfiles();

      // Should contain local agent1 + built-in agents
      expect(profiles).toContain('agent1');
      expect(profiles.length).toBeGreaterThan(1); // agent1 + built-ins
    });
  });

  describe('validateProfile', () => {
    it('should validate profile with required fields', () => {
      const profile = {
        name: 'Test',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: []
      };

      expect(() => loader.validateProfile(profile)).not.toThrow();
    });

    it('should throw error for missing name', () => {
      const profile = {
        name: '',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: []
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
    });

    it('should throw error for missing role', () => {
      const profile = {
        name: 'Test',
        role: '',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: []
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
    });

    it('should throw error for missing description', () => {
      const profile = {
        name: 'Test',
        role: 'tester',
        description: '',
        systemPrompt: 'You are a test agent',
        abilities: []
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
    });

    it('should throw error for missing systemPrompt', () => {
      const profile = {
        name: 'Test',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: '',
        abilities: []
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
    });

    it('should throw error for invalid abilities type', () => {
      const profile = {
        name: 'Test',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: 'not-an-array' as any
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
      expect(() => loader.validateProfile(profile)).toThrow('abilities must be an array');
    });

    it('should throw error for invalid temperature', () => {
      const profile = {
        name: 'Test',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: [],
        temperature: 2.0
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
      expect(() => loader.validateProfile(profile)).toThrow('temperature must be a number between 0 and 1');
    });

    it('should throw error for invalid maxTokens', () => {
      const profile = {
        name: 'Test',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: [],
        maxTokens: -100
      };

      expect(() => loader.validateProfile(profile)).toThrow(AgentValidationError);
      expect(() => loader.validateProfile(profile)).toThrow('maxTokens must be a positive number');
    });
  });

  describe('getProfilePath', () => {
    it('should return array of profile paths (primary and fallback)', () => {
      const paths = loader.getProfilePath('myagent');
      expect(Array.isArray(paths)).toBe(true);
      expect(paths[0]).toBe(join(testDir, 'myagent.yaml')); // Primary path first
      expect(paths.length).toBeGreaterThanOrEqual(1); // At least one path
    });
  });

  describe('resolveAgentName', () => {
    it('should return name directly if profile exists', async () => {
      const profileYaml = `
name: backend
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
      `;

      await writeFile(join(testDir, 'backend.yaml'), profileYaml);

      const resolvedName = await loader.resolveAgentName('backend');
      expect(resolvedName).toBe('backend');
    });

    it('should resolve displayName to actual name', async () => {
      const profileYaml = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
      `;

      await writeFile(join(testDir, 'backend.yaml'), profileYaml);

      const resolvedName = await loader.resolveAgentName('Bob');
      expect(resolvedName).toBe('backend');
    });

    it('should be case-insensitive for displayName', async () => {
      const profileYaml = `
name: backend
displayName: Bob
role: Backend Developer
description: A backend developer
systemPrompt: You are a backend developer
      `;

      await writeFile(join(testDir, 'backend.yaml'), profileYaml);

      const resolvedName = await loader.resolveAgentName('bob');
      expect(resolvedName).toBe('backend');

      const resolvedName2 = await loader.resolveAgentName('BOB');
      expect(resolvedName2).toBe('backend');
    });

    it('should throw AgentNotFoundError if neither name nor displayName found', async () => {
      await expect(loader.resolveAgentName('nonexistent')).rejects.toThrow(AgentNotFoundError);
    });

    it('should prefer exact name match over displayName', async () => {
      // Create two profiles: one named "Tony", another with displayName "Tony"
      const profile1 = `
name: tony
role: Product Manager
description: A product manager
systemPrompt: You are a product manager
      `;

      const profile2 = `
name: cto
displayName: Tony
role: CTO
description: A CTO
systemPrompt: You are a CTO
      `;

      await writeFile(join(testDir, 'tony.yaml'), profile1);
      await writeFile(join(testDir, 'cto.yaml'), profile2);

      // Should resolve to profile named "tony" (exact match takes precedence)
      const resolvedName = await loader.resolveAgentName('tony');
      expect(resolvedName).toBe('tony');
    });

    it('should handle multiple agents with different displayNames', async () => {
      const profile1 = `
name: backend
displayName: Bob
role: Backend Developer
description: Backend developer
systemPrompt: You are a backend developer
      `;

      const profile2 = `
name: frontend
displayName: Alice
role: Frontend Developer
description: Frontend developer
systemPrompt: You are a frontend developer
      `;

      await writeFile(join(testDir, 'backend.yaml'), profile1);
      await writeFile(join(testDir, 'frontend.yaml'), profile2);

      const resolved1 = await loader.resolveAgentName('Bob');
      expect(resolved1).toBe('backend');

      const resolved2 = await loader.resolveAgentName('Alice');
      expect(resolved2).toBe('frontend');
    });
  });

  describe('Security Tests', () => {
    describe('Path Traversal Prevention', () => {
      it('should reject path traversal with ../', async () => {
        await expect(loader.loadProfile('../etc/passwd')).rejects.toThrow(AgentValidationError);
        await expect(loader.loadProfile('../etc/passwd')).rejects.toThrow('Invalid profile name');
      });

      it('should reject absolute paths', async () => {
        await expect(loader.loadProfile('/etc/passwd')).rejects.toThrow(AgentValidationError);
      });

      it('should reject paths with special characters', async () => {
        await expect(loader.loadProfile('agent;rm -rf /')).rejects.toThrow(AgentValidationError);
        await expect(loader.loadProfile('agent$(whoami)')).rejects.toThrow(AgentValidationError);
        await expect(loader.loadProfile('agent|whoami')).rejects.toThrow(AgentValidationError);
      });

      it('should allow valid profile names', async () => {
        const profileYaml = `
name: Test
role: tester
description: A test agent
systemPrompt: You are a test agent
        `;

        await writeFile(join(testDir, 'valid-agent-123.yaml'), profileYaml);
        const profile = await loader.loadProfile('valid-agent-123');
        expect(profile.name).toBe('Test');
      });
    });

    describe('YAML Bomb Prevention', () => {
      it('should reject files larger than 100KB', async () => {
        // Create a large YAML file (>100KB)
        const largeYaml = 'x: ' + 'a'.repeat(110 * 1024);
        await writeFile(join(testDir, 'large.yaml'), largeYaml);

        await expect(loader.loadProfile('large')).rejects.toThrow('Profile file too large');
      });
    });
  });
});
