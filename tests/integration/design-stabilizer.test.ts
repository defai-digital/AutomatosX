/**
 * Design Stabilizer Integration Tests
 *
 * Tests the MCP tool handlers work correctly with the ax-core library.
 * These tests verify API contracts and error handling.
 *
 * @since v12.9.0
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Import handlers directly for integration testing
import { createDesignCheckHandler } from '../../src/mcp/tools/design-check.js';
import { createDesignCheckStreamHandler } from '../../src/mcp/tools/design-check-stream.js';
import { createDesignRulesHandler } from '../../src/mcp/tools/design-rules.js';
import { createDesignSuggestFixesHandler } from '../../src/mcp/tools/design-suggest-fixes.js';
import { createDesignApplyFixesHandler } from '../../src/mcp/tools/design-apply-fixes.js';

describe('Design Stabilizer Integration', () => {
  let testDir: string;

  beforeAll(async () => {
    // Create temp directory for test files
    testDir = join(tmpdir(), `design-stabilizer-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('design_check API', () => {
    it('should return valid response structure', async () => {
      const testFile = join(testDir, 'api-test.tsx');
      await writeFile(testFile, 'const x = 1;', 'utf-8');

      const handler = createDesignCheckHandler();
      const result = await handler({ paths: [testFile] });

      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('availableRules');
      expect(result).toHaveProperty('durationMs');

      // Verify summary structure
      expect(result.summary).toHaveProperty('files');
      expect(result.summary).toHaveProperty('filesWithViolations');
      expect(result.summary).toHaveProperty('errors');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('skipped');
    });

    it('should handle non-existent files gracefully', async () => {
      const handler = createDesignCheckHandler();
      const result = await handler({
        paths: [join(testDir, 'nonexistent.tsx')],
      });

      expect(result.success).toBe(true);
      expect(result.summary.files).toBe(0);
    });

    it('should reject empty paths', async () => {
      const handler = createDesignCheckHandler();

      await expect(handler({ paths: [] })).rejects.toThrow(
        'paths parameter is required'
      );
    });
  });

  describe('design_check_stream API', () => {
    it('should return valid streaming response structure', async () => {
      const testFile = join(testDir, 'stream-test.tsx');
      await writeFile(testFile, 'const y = 2;', 'utf-8');

      const handler = createDesignCheckStreamHandler();
      const result = await handler({
        paths: [testFile],
        chunkSize: 10,
      });

      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stoppedEarly');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('progressEvents');
      expect(result).toHaveProperty('durationMs');

      // Verify summary structure
      expect(result.summary).toHaveProperty('filesScanned');
      expect(result.summary).toHaveProperty('totalFiles');
    });

    it('should handle empty paths gracefully', async () => {
      const handler = createDesignCheckStreamHandler();
      const result = await handler({ paths: [] });

      expect(result.success).toBe(false);
      expect(result.stoppedEarly).toBe(true);
    });
  });

  describe('design_rules API', () => {
    it('should list available rules', async () => {
      const handler = createDesignRulesHandler();
      const result = await handler({});

      expect(result).toHaveProperty('rules');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.rules)).toBe(true);

      // Verify rule structure if rules exist
      if (result.rules.length > 0) {
        const rule = result.rules[0];
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('defaultSeverity');
        expect(rule).toHaveProperty('currentSeverity');
        expect(rule).toHaveProperty('fixable');
        expect(rule).toHaveProperty('category');
      }
    });

    it('should filter rules by keyword', async () => {
      const handler = createDesignRulesHandler();
      const allRules = await handler({});
      const filteredRules = await handler({ filter: 'color' });

      // Filtered should be subset or equal
      expect(filteredRules.total).toBeLessThanOrEqual(allRules.total);
    });
  });

  describe('design_suggest_fixes API', () => {
    it('should return valid response for valid file', async () => {
      const testFile = join(testDir, 'suggest-test.tsx');
      await writeFile(testFile, 'const z = 3;', 'utf-8');

      const handler = createDesignSuggestFixesHandler();
      const result = await handler({ file: testFile });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('patches');
      expect(result).toHaveProperty('unifiedDiff');
      expect(result).toHaveProperty('wouldFix');
      expect(result).toHaveProperty('cannotFix');
      expect(Array.isArray(result.patches)).toBe(true);
    });

    it('should reject empty file path', async () => {
      const handler = createDesignSuggestFixesHandler();

      await expect(handler({ file: '' })).rejects.toThrow(
        'file parameter is required'
      );
    });

    it('should reject non-existent file', async () => {
      const handler = createDesignSuggestFixesHandler();

      await expect(
        handler({ file: join(testDir, 'nonexistent.tsx') })
      ).rejects.toThrow('Cannot read file');
    });
  });

  describe('design_apply_fixes API', () => {
    it('should return valid response for file with no violations', async () => {
      const testFile = join(testDir, 'apply-test.tsx');
      await writeFile(testFile, 'const a = 1;', 'utf-8');

      const handler = createDesignApplyFixesHandler();
      const result = await handler({
        file: testFile,
        createBackup: false,
        verify: false,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('applied');
      expect(result).toHaveProperty('failed');
      expect(result.success).toBe(true);
      expect(result.applied).toBe(0); // No violations to fix
    });

    it('should reject empty file path', async () => {
      const handler = createDesignApplyFixesHandler();

      await expect(handler({ file: '' })).rejects.toThrow(
        'file parameter is required'
      );
    });
  });

  describe('End-to-end workflow', () => {
    it('should complete check -> rules -> suggest workflow', async () => {
      const testFile = join(testDir, 'workflow-test.tsx');
      await writeFile(testFile, 'export const Component = () => <div />;', 'utf-8');

      // 1. Check
      const checkHandler = createDesignCheckHandler();
      const checkResult = await checkHandler({ paths: [testFile] });
      expect(checkResult.success).toBe(true);

      // 2. Rules
      const rulesHandler = createDesignRulesHandler();
      const rulesResult = await rulesHandler({});
      expect(rulesResult.total).toBeGreaterThanOrEqual(0);

      // 3. Suggest
      const suggestHandler = createDesignSuggestFixesHandler();
      const suggestResult = await suggestHandler({ file: testFile });
      expect(suggestResult.success).toBe(true);

      // Workflow completed successfully
      expect(true).toBe(true);
    });
  });
});
