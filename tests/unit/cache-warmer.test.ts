/**
 * Cache Warmer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheWarmer } from '../../src/core/cache-warmer.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CacheWarmer', () => {
  let testDir: string;
  let agentsPath: string;
  let abilitiesPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `cache-warmer-test-${Date.now()}`);
    agentsPath = join(testDir, 'agents');
    abilitiesPath = join(testDir, 'abilities');

    await mkdir(agentsPath, { recursive: true });
    await mkdir(abilitiesPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const warmer = new CacheWarmer();
      const stats = warmer.getStats();

      expect(stats).toEqual({
        agents: 0,
        abilities: 0,
        duration: 0
      });
    });

    it('should accept custom configuration', () => {
      const warmer = new CacheWarmer({
        paths: { agents: agentsPath, abilities: abilitiesPath },
        debug: true,
        concurrency: 10
      });

      expect(warmer).toBeDefined();
    });

    it('should use default values for missing config', () => {
      const warmer = new CacheWarmer({
        paths: { agents: agentsPath }
      });

      expect(warmer).toBeDefined();
    });
  });

  describe('warmAll()', () => {
    it('should warm all caches successfully', async () => {
      // Create test files
      await writeFile(join(agentsPath, 'test1.yaml'), 'name: test1');
      await writeFile(join(agentsPath, 'test2.yml'), 'name: test2');
      await writeFile(join(abilitiesPath, 'skill1.md'), '# Skill 1');
      await writeFile(join(abilitiesPath, 'skill2.md'), '# Skill 2');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath, abilities: abilitiesPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(2);
      expect(stats.abilities).toBe(2);
      expect(stats.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return zero counts for empty directories', async () => {
      const warmer = new CacheWarmer({
        paths: { agents: agentsPath, abilities: abilitiesPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(0);
      expect(stats.abilities).toBe(0);
    });

    it('should only warm specified caches', async () => {
      await writeFile(join(agentsPath, 'test.yaml'), 'name: test');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(1);
      expect(stats.abilities).toBe(0);
    });

    it('should measure warming duration', async () => {
      const warmer = new CacheWarmer({
        paths: { agents: agentsPath }
      });

      const start = performance.now();
      const stats = await warmer.warmAll();
      const end = performance.now();

      expect(stats.duration).toBeGreaterThanOrEqual(0);
      expect(stats.duration).toBeLessThanOrEqual(end - start + 10); // +10ms tolerance
    });

    it('should warm multiple paths in parallel', async () => {
      // Create multiple files
      await writeFile(join(agentsPath, 'agent1.yaml'), 'name: agent1');
      await writeFile(join(agentsPath, 'agent2.yaml'), 'name: agent2');
      await writeFile(join(abilitiesPath, 'skill1.md'), '# Skill 1');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath, abilities: abilitiesPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(2);
      expect(stats.abilities).toBe(1);
    });
  });

  describe('warmAgents()', () => {
    it('should count YAML files correctly', async () => {
      await writeFile(join(agentsPath, 'agent1.yaml'), 'name: agent1');
      await writeFile(join(agentsPath, 'agent2.yml'), 'name: agent2');
      await writeFile(join(agentsPath, 'not-yaml.txt'), 'ignore');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(2);
    });

    it('should handle directory read errors gracefully', async () => {
      const invalidPath = join(testDir, 'non-existent');

      const warmer = new CacheWarmer({
        paths: { agents: invalidPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(0);
    });

    it('should filter only YAML/YML extensions', async () => {
      await writeFile(join(agentsPath, 'valid.yaml'), 'valid');
      await writeFile(join(agentsPath, 'valid.yml'), 'valid');
      await writeFile(join(agentsPath, 'invalid.json'), 'invalid');
      await writeFile(join(agentsPath, 'invalid.md'), 'invalid');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(2);
    });
  });

  describe('warmAbilities()', () => {
    it('should count Markdown files correctly', async () => {
      await writeFile(join(abilitiesPath, 'skill1.md'), '# Skill 1');
      await writeFile(join(abilitiesPath, 'skill2.md'), '# Skill 2');
      await writeFile(join(abilitiesPath, 'not-md.txt'), 'ignore');

      const warmer = new CacheWarmer({
        paths: { abilities: abilitiesPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.abilities).toBe(2);
    });

    it('should handle directory read errors gracefully', async () => {
      const invalidPath = join(testDir, 'non-existent');

      const warmer = new CacheWarmer({
        paths: { abilities: invalidPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.abilities).toBe(0);
    });

    it('should filter only MD extension', async () => {
      await writeFile(join(abilitiesPath, 'valid.md'), 'valid');
      await writeFile(join(abilitiesPath, 'invalid.txt'), 'invalid');
      await writeFile(join(abilitiesPath, 'invalid.yaml'), 'invalid');

      const warmer = new CacheWarmer({
        paths: { abilities: abilitiesPath }
      });

      const stats = await warmer.warmAll();

      expect(stats.abilities).toBe(1);
    });
  });

  describe('Debug Logging', () => {
    it('should warm successfully with debug enabled', async () => {
      await writeFile(join(agentsPath, 'test.yaml'), 'name: test');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath },
        debug: true
      });

      const stats = await warmer.warmAll();

      // Verify warming works with debug enabled
      expect(stats.agents).toBe(1);
    });

    it('should warm successfully with debug disabled', async () => {
      await writeFile(join(agentsPath, 'test.yaml'), 'name: test');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath },
        debug: false
      });

      const stats = await warmer.warmAll();

      // Verify warming works with debug disabled
      expect(stats.agents).toBe(1);
    });
  });

  describe('getStats()', () => {
    it('should return initial stats', () => {
      const warmer = new CacheWarmer();
      const stats = warmer.getStats();

      expect(stats).toEqual({
        agents: 0,
        abilities: 0,
        duration: 0
      });
    });

    it('should return updated stats after warming', async () => {
      await writeFile(join(agentsPath, 'agent.yaml'), 'name: agent');
      await writeFile(join(abilitiesPath, 'skill.md'), '# Skill');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath, abilities: abilitiesPath }
      });

      await warmer.warmAll();
      const stats = warmer.getStats();

      expect(stats.agents).toBe(1);
      expect(stats.abilities).toBe(1);
      expect(stats.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return a copy of stats (immutability)', async () => {
      const warmer = new CacheWarmer();
      const stats1 = warmer.getStats();
      stats1.agents = 999;

      const stats2 = warmer.getStats();

      expect(stats2.agents).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty config paths', async () => {
      const warmer = new CacheWarmer({ paths: {} });
      const stats = await warmer.warmAll();

      expect(stats.agents).toBe(0);
      expect(stats.abilities).toBe(0);
    });

    it('should handle undefined paths', async () => {
      const warmer = new CacheWarmer();
      const stats = await warmer.warmAll();

      expect(stats).toBeDefined();
    });

    it('should handle permission errors gracefully', async () => {
      // Create a directory without read permissions (Unix only)
      if (process.platform !== 'win32') {
        const restrictedPath = join(testDir, 'restricted');
        await mkdir(restrictedPath, { mode: 0o000 });

        const warmer = new CacheWarmer({
          paths: { agents: restrictedPath }
        });

        const stats = await warmer.warmAll();

        expect(stats.agents).toBe(0);

        // Cleanup: restore permissions before deletion
        await rm(restrictedPath, { recursive: true, force: true });
      }
    });

    it('should handle concurrent warmAll calls', async () => {
      await writeFile(join(agentsPath, 'agent.yaml'), 'name: agent');

      const warmer = new CacheWarmer({
        paths: { agents: agentsPath }
      });

      const [stats1, stats2] = await Promise.all([
        warmer.warmAll(),
        warmer.warmAll()
      ]);

      expect(stats1.agents).toBe(1);
      expect(stats2.agents).toBe(1);
    });
  });
});
