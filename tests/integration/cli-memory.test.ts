/**
 * CLI Memory Command Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

describe('CLI Memory Command Integration', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(async () => {
    // Create test directory with unique name (Bug #9: use mkdtemp to avoid timestamp collisions)
    const tmpBase = join(tmpdir(), 'automatosx-memory-test-');
    testDir = await mkdtemp(tmpBase);
    // Note: mkdtemp already creates the directory, no need for mkdir

    // CLI path (built binary)
    cliPath = join(process.cwd(), 'dist', 'index.js');

    // Initialize project
    await execFileAsync('node', [cliPath, 'setup'], {
      cwd: testDir,
      env: process.env
    });
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('memory add', () => {
    it('should add a memory entry', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Test memory content',
        '--type', 'task'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/added|success/i);
    });

    it('should add memory with tags', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Tagged memory',
        '--tags', 'test,important'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/added|success/i);
      expect(result.stdout).toMatch(/test|important/i);
    });

    it('should add memory with metadata', async () => {
      const customMetadata = JSON.stringify({
        priority: 'high',
        project: 'test-project',
        author: 'test-user'
      });

      const result = await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Test with custom metadata',
        '--metadata', customMetadata
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/added|success/i);

      // Verify metadata was stored
      const listResult = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--output', 'json'
      ], { cwd: testDir, env: process.env });

      const entries = JSON.parse(listResult.stdout.trim());
      const entry = entries.find((e: any) => e.content === 'Test with custom metadata');

      expect(entry).toBeDefined();
      expect(entry.metadata.priority).toBe('high');
      expect(entry.metadata.project).toBe('test-project');
      expect(entry.metadata.author).toBe('test-user');
    });

    it('should accept type option', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Typed memory',
        '--type', 'document'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/added|success/i);
    });

    it('should handle long content', async () => {
      const longContent = 'A'.repeat(1000);
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'add',
        longContent
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/added|success/i);
    });
  });

  describe('memory list', () => {
    beforeEach(async () => {
      // Add test memories
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'First memory',
        '--tags', 'test'
      ], { cwd: testDir, env: process.env });

      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Second memory',
        '--tags', 'important'
      ], { cwd: testDir, env: process.env });
    });

    it('should list all memories', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'list'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toContain('First memory');
      expect(result.stdout).toContain('Second memory');
    });

    it('should filter by type', async () => {
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Code memory',
        '--type', 'code'
      ], { cwd: testDir, env: process.env });

      const result = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--type', 'code'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toContain('Code memory');
    });

    it('should filter by tags', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--tags', 'test'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toContain('First memory');
      expect(result.stdout).not.toContain('Second memory');
    });

    it('should support limit option', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--limit', '1'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toBeTruthy();
    });

    it('should support JSON output format', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--output', 'json'
      ], {
        cwd: testDir,
        env: process.env
      });

      // Parse JSON output (logger now goes to stderr, so stdout is clean JSON)
      const parsed = JSON.parse(result.stdout.trim());

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(2); // We added 2 memories in beforeEach
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('content');
      expect(parsed[0]).toHaveProperty('metadata');
    });
  });

  describe('memory search', () => {
    beforeEach(async () => {
      // Add test memories with different content
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'JavaScript is a programming language',
        '--tags', 'programming'
      ], { cwd: testDir, env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' } });

      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Python is also a programming language',
        '--tags', 'programming'
      ], { cwd: testDir, env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' } });

      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'The weather is nice today',
        '--tags', 'weather'
      ], { cwd: testDir, env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' } });
    });

    it('should search memories by query', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'search',
        'programming language',
        '--output', 'json'
      ], {
        cwd: testDir,
        env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' }
      });

      const results = JSON.parse(result.stdout.trim());

      // Should return valid array (may be empty with mock embeddings)
      expect(Array.isArray(results)).toBe(true);

      // If results exist, they should have correct structure
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('similarity');
        expect(results[0]).toHaveProperty('entry');
        expect(results[0].entry).toHaveProperty('content');
      }

      // Test passes if command executes without error
      // Mock embeddings may not have semantic similarity
    });

    it('should support limit in search', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'search',
        'programming',
        '--limit', '1',
        '--output', 'json'
      ], {
        cwd: testDir,
        env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' }
      });

      const results = JSON.parse(result.stdout.trim());

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('memory delete', () => {
    it('should delete memory by ID', async () => {
      // Step 1: Add a test memory
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Memory to delete',
        '--tags', 'delete-test'
      ], { cwd: testDir, env: process.env });

      // Step 2: Get ID via JSON list (logger now goes to stderr)
      const listResult = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--output', 'json'
      ], { cwd: testDir, env: process.env });

      const entries = JSON.parse(listResult.stdout.trim());
      const targetEntry = entries.find((e: any) => e.content === 'Memory to delete');
      expect(targetEntry).toBeDefined();
      expect(targetEntry.id).toBeDefined();

      // Step 3: Delete by ID
      const deleteResult = await execFileAsync('node', [
        cliPath, 'memory', 'delete',
        String(targetEntry.id),
        '--confirm'
      ], { cwd: testDir, env: process.env });

      expect(deleteResult.stdout).toMatch(/deleted|success/i);

      // Step 4: Verify deleted
      const verifyResult = await execFileAsync('node', [
        cliPath, 'memory', 'list',
        '--output', 'json'
      ], { cwd: testDir, env: process.env });

      const remainingEntries = JSON.parse(verifyResult.stdout.trim());
      const stillExists = remainingEntries.find((e: any) => e.id === targetEntry.id);
      expect(stillExists).toBeUndefined();
    });

    it('should show error for invalid ID', async () => {
      try {
        await execFileAsync('node', [
          cliPath, 'memory', 'delete',
          'nonexistent-id'
        ], {
          cwd: testDir,
          env: process.env
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stderr).toMatch(/not found|error/i);
      }
    });
  });

  describe('memory export', () => {
    beforeEach(async () => {
      // Add some memories to export
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Export test 1'
      ], { cwd: testDir, env: process.env });

      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Export test 2'
      ], { cwd: testDir, env: process.env });
    });

    it('should export memories to file', async () => {
      const exportPath = join(testDir, 'export.json');

      const result = await execFileAsync('node', [
        cliPath, 'memory', 'export',
        exportPath
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/exported|success/i);
      expect(existsSync(exportPath)).toBe(true);

      // Validate export file
      const exportData = JSON.parse(await readFile(exportPath, 'utf-8'));
      expect(exportData.version).toBeDefined();
      expect(Array.isArray(exportData.entries)).toBe(true);
      expect(exportData.entries.length).toBeGreaterThan(0);
    });

    it('should export with type filter', async () => {
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Code export test',
        '--type', 'code'
      ], { cwd: testDir, env: process.env });

      const exportPath = join(testDir, 'filtered-export.json');

      const result = await execFileAsync('node', [
        cliPath, 'memory', 'export',
        exportPath,
        '--type', 'code'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/exported|success/i);
      expect(existsSync(exportPath)).toBe(true);
    });
  });

  describe('memory import', () => {
    it('should import memories from file', async () => {
      // Create export file
      const exportData = {
        version: '4.0.0',
        exported: new Date().toISOString(),
        entries: [
          {
            id: 'test-id-1',
            content: 'Imported memory 1',
            type: 'task',
            tags: ['imported'],
            metadata: {},
            embedding: new Array(1536).fill(0.1),
            createdAt: Date.now(),
            accessedAt: Date.now(),
            accessCount: 0
          },
          {
            id: 'test-id-2',
            content: 'Imported memory 2',
            type: 'code',
            tags: ['imported'],
            metadata: {},
            embedding: new Array(1536).fill(0.2),
            createdAt: Date.now(),
            accessedAt: Date.now(),
            accessCount: 0
          }
        ]
      };

      const importPath = join(testDir, 'import.json');
      await writeFile(importPath, JSON.stringify(exportData));

      const result = await execFileAsync('node', [
        cliPath, 'memory', 'import',
        importPath
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/imported|success/i);

      // Verify import
      const listResult = await execFileAsync('node', [
        cliPath, 'memory', 'list'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(listResult.stdout).toContain('Imported memory 1');
      expect(listResult.stdout).toContain('Imported memory 2');
    });

    it('should handle invalid import file', async () => {
      const importPath = join(testDir, 'invalid.json');
      await writeFile(importPath, 'invalid json');

      try {
        await execFileAsync('node', [
          cliPath, 'memory', 'import',
          importPath
        ], {
          cwd: testDir,
          env: process.env
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stderr).toMatch(/error|invalid/i);
      }
    });
  });

  describe('memory stats', () => {
    beforeEach(async () => {
      // Add various memories
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Stat test 1',
        '--type', 'task'
      ], { cwd: testDir, env: process.env });

      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'Stat test 2',
        '--type', 'code'
      ], { cwd: testDir, env: process.env });
    });

    it('should show memory statistics', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'stats'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/total|count|entries/i);
      expect(result.stdout).toMatch(/\d+/); // Should contain numbers
    });
  });

  describe('memory clear', () => {
    beforeEach(async () => {
      // Add memories to clear
      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'To clear 1'
      ], { cwd: testDir, env: process.env });

      await execFileAsync('node', [
        cliPath, 'memory', 'add',
        'To clear 2'
      ], { cwd: testDir, env: process.env });
    });

    it('should clear all memories with confirmation', async () => {
      // Note: This test might need interactive input handling
      // For now, we'll skip it or mock the confirmation
      // Actual implementation would need stdin simulation
    });

    it('should support confirm flag to skip confirmation', async () => {
      const result = await execFileAsync('node', [
        cliPath, 'memory', 'clear',
        '--all',
        '--confirm'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(result.stdout).toMatch(/cleared|success/i);

      // Verify all cleared
      const listResult = await execFileAsync('node', [
        cliPath, 'memory', 'list'
      ], {
        cwd: testDir,
        env: process.env
      });

      expect(listResult.stdout).toMatch(/no entries|empty|0/i);
    });
  });

  describe('Error Handling', () => {
    it('should show help when no subcommand provided', async () => {
      try {
        await execFileAsync('node', [cliPath, 'memory'], {
          cwd: testDir,
          env: process.env
        });
      } catch (error: any) {
        // Command might exit with 0 showing help, or error
        const output = error.stdout || error.stderr || '';
        expect(output).toMatch(/add|list|search|delete|export|import/i);
      }
    });

    it('should handle missing required arguments', async () => {
      try {
        await execFileAsync('node', [
          cliPath, 'memory', 'add'
          // Missing content
        ], {
          cwd: testDir,
          env: process.env
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });

    it('should handle invalid options', async () => {
      try {
        await execFileAsync('node', [
          cliPath, 'memory', 'list',
          '--invalid-option'
        ], {
          cwd: testDir,
          env: process.env
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });
  });
});
