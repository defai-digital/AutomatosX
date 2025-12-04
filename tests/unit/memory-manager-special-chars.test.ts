/**
 * FTS5 Special Character Handling Tests
 *
 * This test suite verifies that memory search handles all special
 * characters that appear in real-world queries.
 *
 * @see https://github.com/defai-digital/automatosx/issues/XXX
 * @since v5.0.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../../src/core/memory/manager.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MemoryManager - FTS5 Special Character Handling', () => {
  let memoryManager: MemoryManager;
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory for test database
    testDir = mkdtempSync(join(tmpdir(), 'memory-test-'));
    const dbPath = join(testDir, 'test.db');

    memoryManager = await MemoryManager.create({ dbPath });
  });

  afterEach(async () => {
    if (memoryManager) {
      await memoryManager.close();
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('File Path Queries (Forward Slash)', () => {
    it('should handle Unix file paths', async () => {
      // Add memory with file path
      await memoryManager.add(
        'Review the file src/core/memory/manager.ts for bugs',
        null,
        { type: 'task', agentId: 'test', source: 'user' }
      );

      // Search with file path containing /
      const results = await memoryManager.search({
        text: 'src/core/memory/manager.ts'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.entry.content).toContain('src/core/memory/manager.ts');
    });

    it('should handle Windows file paths', async () => {
      await memoryManager.add(
        'Check C:/Program Files/AutomatosX/config.json',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'C:/Program Files/AutomatosX'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle multiple slashes in query', async () => {
      await memoryManager.add(
        'Deploy to https://api.example.com/v1/users',
        null,
        { type: 'task', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'https://api.example.com/v1/users'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('URL Queries', () => {
    it('should handle HTTPS URLs', async () => {
      await memoryManager.add(
        'Check documentation at https://github.com/defai/automatosx',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'https://github.com/defai/automatosx'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.entry.content).toContain('github.com');
    });

    it('should handle URLs with query parameters', async () => {
      await memoryManager.add(
        'API endpoint: https://api.example.com/search?q=test&limit=10',
        null,
        { type: 'other', agentId: 'test', source: 'system' }
      );

      const results = await memoryManager.search({
        text: 'https://api.example.com/search?q=test&limit=10'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle URLs with hash fragments', async () => {
      await memoryManager.add(
        'See docs: https://example.com/docs#getting-started',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'https://example.com/docs#getting-started'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Date Queries (With Slashes)', () => {
    it('should handle date format YYYY/MM/DD', async () => {
      await memoryManager.add(
        'Release scheduled for 2025/10/09',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: '2025/10/09'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle date format MM/DD/YYYY', async () => {
      await memoryManager.add(
        'Meeting on 10/09/2025 at 3pm',
        null,
        { type: 'other', agentId: 'test', source: 'calendar' }
      );

      const results = await memoryManager.search({
        text: '10/09/2025'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Email Address Queries (At Sign)', () => {
    it('should handle standard email addresses', async () => {
      await memoryManager.add(
        'Contact user@example.com for more information',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'user@example.com'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle email addresses with subdomain', async () => {
      await memoryManager.add(
        'Support email: support@mail.example.com',
        null,
        { type: 'other', agentId: 'test', source: 'system' }
      );

      const results = await memoryManager.search({
        text: 'support@mail.example.com'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Hashtag Queries (Hash Sign)', () => {
    it('should handle hashtags', async () => {
      await memoryManager.add(
        'Important reminder #urgent #priority1',
        null,
        {
          type: 'other',
          agentId: 'test',
          source: 'user',
          tags: ['urgent', 'priority1']
        }
      );

      const results = await memoryManager.search({
        text: '#urgent'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle multiple hashtags', async () => {
      await memoryManager.add(
        'Task marked as #bug #critical #security',
        null,
        {
          type: 'task',
          agentId: 'test',
          source: 'issue',
          tags: ['bug', 'critical', 'security']
        }
      );

      const results = await memoryManager.search({
        text: '#security'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Mathematical Expressions', () => {
    it('should handle fractions with slash', async () => {
      await memoryManager.add(
        'Approximately 3/4 of users prefer dark mode',
        null,
        { type: 'other', agentId: 'test', source: 'analytics' }
      );

      const results = await memoryManager.search({
        text: '3/4 of users'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle equations with equals', async () => {
      await memoryManager.add(
        'Formula: price = base * 1.1 + shipping',
        null,
        { type: 'other', agentId: 'test', source: 'system' }
      );

      const results = await memoryManager.search({
        text: 'price = base'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Question Queries', () => {
    it('should handle questions with question mark', async () => {
      await memoryManager.add(
        'User asked: How do I reset my password?',
        null,
        { type: 'other', agentId: 'test', source: 'support' }
      );

      const results = await memoryManager.search({
        text: 'How do I reset my password?'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Exclamation Queries', () => {
    it('should handle exclamations', async () => {
      await memoryManager.add(
        'URGENT! Production server is down!',
        null,
        { type: 'other', agentId: 'test', source: 'monitoring' }
      );

      const results = await memoryManager.search({
        text: 'URGENT! Production'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Ampersand Queries', () => {
    it('should handle company names with ampersand', async () => {
      await memoryManager.add(
        'Meeting with Smith & Johnson LLC',
        null,
        { type: 'other', agentId: 'test', source: 'calendar' }
      );

      const results = await memoryManager.search({
        text: 'Smith & Johnson'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Real-World Queries', () => {
    it('should handle file path with line number', async () => {
      await memoryManager.add(
        'Bug found at src/core/memory/manager.ts:301',
        null,
        { type: 'other', agentId: 'test', source: 'review' }
      );

      const results = await memoryManager.search({
        text: 'src/core/memory/manager.ts:301'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle markdown link', async () => {
      await memoryManager.add(
        'See [docs](https://example.com/docs#api)',
        null,
        { type: 'other', agentId: 'test', source: 'documentation' }
      );

      const results = await memoryManager.search({
        text: 'https://example.com/docs#api'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle Git commit message', async () => {
      await memoryManager.add(
        'fix: resolve issue #123 in src/utils/parser.ts',
        null,
        { type: 'other', agentId: 'test', source: 'git' }
      );

      const results = await memoryManager.search({
        text: 'src/utils/parser.ts'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle npm package name', async () => {
      await memoryManager.add(
        'Install @defai.digital/automatosx package',
        null,
        { type: 'other', agentId: 'test', source: 'documentation' }
      );

      const results = await memoryManager.search({
        text: '@defai.digital/automatosx'
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle query with ALL special characters', async () => {
      const specialQuery = 'test/.@#$%^&*(){}[]|\\:;"\'<>?,!~`+=';

      await memoryManager.add(
        `Special test: ${specialQuery}`,
        null,
        { type: 'other', agentId: 'test', source: 'system' }
      );

      // Should not throw syntax error
      const results = await memoryManager.search({
        text: specialQuery
      });

      // Verify results are defined and search completed successfully
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // After sanitization, query becomes "test" which should match stored content
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.entry.content).toContain('Special test:');
    });

    it('should handle empty query after sanitization', async () => {
      // Query that becomes empty after sanitization
      const results = await memoryManager.search({
        text: '!!!'  // All special chars
      });

      expect(results).toEqual([]);
    });

    it('should handle very long file path', async () => {
      const longPath = 'src/components/features/authentication/providers/oauth/google/GoogleOAuthProvider.ts';

      await memoryManager.add(
        `Review ${longPath}`,
        null,
        { type: 'task', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: longPath
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Regression Tests (Existing Functionality)', () => {
    it('should still handle simple text queries', async () => {
      await memoryManager.add(
        'Simple text without special characters',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'Simple text'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should still handle multi-word queries', async () => {
      await memoryManager.add(
        'The quick brown fox jumps over the lazy dog',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'quick brown fox'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should still respect search limits', async () => {
      // Add 20 entries
      for (let i = 0; i < 20; i++) {
        await memoryManager.add(
          `Test entry number ${i}`,
          null,
          { type: 'other', agentId: 'test', source: 'system' }
        );
      }

      const results = await memoryManager.search({
        text: 'Test entry',
        limit: 5
      });

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should still filter by metadata', async () => {
      await memoryManager.add(
        'Task entry',
        null,
        { type: 'task', agentId: 'test', source: 'user' }
      );

      await memoryManager.add(
        'Note entry',
        null,
        { type: 'other', agentId: 'test', source: 'user' }
      );

      const results = await memoryManager.search({
        text: 'entry',
        filters: { type: 'task' }
      });

      expect(results.length).toBe(1);
      expect(results[0]?.entry.metadata.type).toBe('task');
    });
  });

  describe('Performance Tests', () => {
    it('should handle special characters without performance degradation', async () => {
      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        await memoryManager.add(
          `Entry ${i}: Check file src/core/test-${i}.ts`,
          null,
          { type: 'other', agentId: 'test', source: 'system' }
        );
      }

      const startTime = Date.now();

      const results = await memoryManager.search({
        text: 'src/core/test'
      });

      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      // Verify search completes in reasonable time (relaxed for CI environments)
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
