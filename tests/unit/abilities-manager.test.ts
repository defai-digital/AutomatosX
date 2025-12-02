/**
 * Abilities Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AbilitiesManager } from '../../src/agents/abilities-manager.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AbilitiesManager', () => {
  let testDir: string;
  let manager: AbilitiesManager;

  beforeEach(async () => {
    // Create temp directory for test abilities
    testDir = join(tmpdir(), `automatosx-abilities-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    manager = new AbilitiesManager(testDir);
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadAbility', () => {
    it('should load ability markdown from file', async () => {
      const markdown = `# Test Ability\n\nThis is a test ability.`;
      await writeFile(join(testDir, 'test.md'), markdown);

      const content = await manager.loadAbility('test');

      expect(content).toBe(markdown);
    });

    it('should return empty string for missing ability', async () => {
      const content = await manager.loadAbility('nonexistent');
      expect(content).toBe('');
    });

    it('should cache loaded abilities', async () => {
      const markdown = `# Test Ability`;
      await writeFile(join(testDir, 'test.md'), markdown);

      const content1 = await manager.loadAbility('test');
      const content2 = await manager.loadAbility('test');

      expect(content1).toBe(content2);
    });

    it('should clear cache', async () => {
      const markdown = `# Test Ability`;
      await writeFile(join(testDir, 'test.md'), markdown);

      await manager.loadAbility('test');
      manager.clearCache();

      // Should reload from file (not cache)
      const content = await manager.loadAbility('test');
      expect(content).toBe(markdown);
    });
  });

  describe('loadAbilities', () => {
    it('should load multiple abilities', async () => {
      await writeFile(join(testDir, 'ability1.md'), '# Ability 1');
      await writeFile(join(testDir, 'ability2.md'), '# Ability 2');
      await writeFile(join(testDir, 'ability3.md'), '# Ability 3');

      const abilities = await manager.loadAbilities(['ability1', 'ability2', 'ability3']);

      expect(abilities.size).toBe(3);
      expect(abilities.get('ability1')).toBe('# Ability 1');
      expect(abilities.get('ability2')).toBe('# Ability 2');
      expect(abilities.get('ability3')).toBe('# Ability 3');
    });

    it('should skip missing abilities', async () => {
      await writeFile(join(testDir, 'ability1.md'), '# Ability 1');

      const abilities = await manager.loadAbilities(['ability1', 'missing', 'ability3']);

      expect(abilities.size).toBe(1);
      expect(abilities.has('ability1')).toBe(true);
      expect(abilities.has('missing')).toBe(false);
    });

    it('should return empty map for empty input', async () => {
      const abilities = await manager.loadAbilities([]);
      expect(abilities.size).toBe(0);
    });
  });

  describe('getAbilitiesText', () => {
    it('should concatenate abilities with headers', async () => {
      await writeFile(join(testDir, 'ability1.md'), 'Content 1');
      await writeFile(join(testDir, 'ability2.md'), 'Content 2');

      const text = await manager.getAbilitiesText(['ability1', 'ability2']);

      expect(text).toContain('## Ability: ability1');
      expect(text).toContain('Content 1');
      expect(text).toContain('## Ability: ability2');
      expect(text).toContain('Content 2');
      expect(text).toContain('---');
    });

    it('should return empty string for no abilities', async () => {
      const text = await manager.getAbilitiesText([]);
      expect(text).toBe('');
    });

    it('should return empty string for all missing abilities', async () => {
      const text = await manager.getAbilitiesText(['missing1', 'missing2']);
      expect(text).toBe('');
    });
  });

  describe('listAbilities', () => {
    it('should list all markdown files', async () => {
      await writeFile(join(testDir, 'ability1.md'), '# Ability 1');
      await writeFile(join(testDir, 'ability2.md'), '# Ability 2');
      await writeFile(join(testDir, 'readme.txt'), 'not an ability');

      const abilities = await manager.listAbilities();

      expect(abilities).toContain('ability1');
      expect(abilities).toContain('ability2');
      expect(abilities).not.toContain('readme');
      expect(abilities.length).toBe(2);
    });

    it('should return empty array for non-existent directory', async () => {
      const emptyManager = new AbilitiesManager('/nonexistent/path');
      const abilities = await emptyManager.listAbilities();
      expect(abilities).toEqual([]);
    });

    it('should sort abilities alphabetically', async () => {
      await writeFile(join(testDir, 'zebra.md'), 'Z');
      await writeFile(join(testDir, 'alpha.md'), 'A');
      await writeFile(join(testDir, 'beta.md'), 'B');

      const abilities = await manager.listAbilities();

      expect(abilities).toEqual(['alpha', 'beta', 'zebra']);
    });
  });

  describe('Security Tests', () => {
    describe('Path Traversal Prevention', () => {
      it('should reject path traversal with ../', async () => {
        await expect(manager.loadAbility('../etc/passwd')).rejects.toThrow('Invalid ability name');
      });

      it('should reject absolute paths', async () => {
        await expect(manager.loadAbility('/etc/passwd')).rejects.toThrow('Invalid ability name');
      });

      it('should reject paths with special characters', async () => {
        await expect(manager.loadAbility('ability;rm -rf /')).rejects.toThrow('Invalid ability name');
        await expect(manager.loadAbility('ability$(whoami)')).rejects.toThrow('Invalid ability name');
        await expect(manager.loadAbility('ability|whoami')).rejects.toThrow('Invalid ability name');
      });

      it('should allow valid ability names', async () => {
        await writeFile(join(testDir, 'valid-ability-123.md'), '# Valid Ability');
        const content = await manager.loadAbility('valid-ability-123');
        expect(content).toBe('# Valid Ability');
      });
    });

    describe('File Size Limit', () => {
      it('should reject files larger than 500KB', async () => {
        // Create a large markdown file (>500KB)
        const largeContent = '# Large\n' + 'x'.repeat(510 * 1024);
        await writeFile(join(testDir, 'large.md'), largeContent);

        await expect(manager.loadAbility('large')).rejects.toThrow('Ability file too large');
      });

      it('should accept files under 500KB', async () => {
        // Create a file just under the limit
        const content = '# Medium\n' + 'x'.repeat(400 * 1024);
        await writeFile(join(testDir, 'medium.md'), content);

        const loaded = await manager.loadAbility('medium');
        expect(loaded.length).toBeLessThan(500 * 1024);
      });
    });
  });
});
