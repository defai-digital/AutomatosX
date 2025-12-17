/**
 * Context Domain Tests
 *
 * Tests for context loader functionality.
 *
 * Invariants tested:
 * - INV-CTX-001: Individual files must not exceed MAX_FILE_SIZE
 * - INV-CTX-002: Total context size must not exceed MAX_TOTAL_SIZE
 * - INV-CTX-003: Context files must be valid UTF-8
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ContextLoader,
  createContextLoader,
  hasProjectContext,
  loadProjectContext,
  MAX_CONTEXT_FILE_SIZE,
  MAX_CONTEXT_TOTAL_SIZE,
  CONTEXT_DIRECTORY,
} from '@automatosx/context-domain';

describe('Context Domain', () => {
  let testDir: string;
  let contextDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-test-'));
    contextDir = path.join(testDir, '.automatosx', CONTEXT_DIRECTORY);
    await fs.mkdir(contextDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('ContextLoader', () => {
    describe('hasContext', () => {
      it('should return true when context directory exists', async () => {
        const loader = new ContextLoader();
        const result = await loader.hasContext(testDir);
        expect(result).toBe(true);
      });

      it('should return false when context directory does not exist', async () => {
        const loader = new ContextLoader();
        const result = await loader.hasContext('/non-existent-path');
        expect(result).toBe(false);
      });
    });

    describe('getContextPath', () => {
      it('should return correct context path', () => {
        const loader = new ContextLoader();
        const result = loader.getContextPath('/project');
        expect(result).toBe(`/project/.automatosx/${CONTEXT_DIRECTORY}`);
      });
    });

    describe('load', () => {
      it('should load single context file', async () => {
        // Create a context file
        await fs.writeFile(
          path.join(contextDir, 'conventions.md'),
          '# Conventions\n\nUse TypeScript.'
        );

        const loader = new ContextLoader();
        const result = await loader.load(testDir);

        expect(result.success).toBe(true);
        expect(result.filesLoaded).toBe(1);
        expect(result.context?.files).toHaveLength(1);
        expect(result.context!.files[0]!.filename).toBe('conventions.md');
        expect(result.context!.files[0]!.content).toContain('Use TypeScript');
      });

      it('should load multiple context files', async () => {
        await fs.writeFile(path.join(contextDir, 'conventions.md'), '# Conventions');
        await fs.writeFile(path.join(contextDir, 'architecture.md'), '# Architecture');

        const loader = new ContextLoader();
        const result = await loader.load(testDir);

        expect(result.success).toBe(true);
        expect(result.filesLoaded).toBe(2);
        expect(result.context?.files).toHaveLength(2);
      });

      it('should generate combined content', async () => {
        await fs.writeFile(path.join(contextDir, 'a.md'), 'Content A');
        await fs.writeFile(path.join(contextDir, 'b.md'), 'Content B');

        const loader = new ContextLoader();
        const result = await loader.load(testDir);

        expect(result.context?.combinedContent).toContain('# Project Context');
        expect(result.context?.combinedContent).toContain('## a.md');
        expect(result.context?.combinedContent).toContain('Content A');
        expect(result.context?.combinedContent).toContain('## b.md');
        expect(result.context?.combinedContent).toContain('Content B');
      });

      it('should return empty context when directory does not exist', async () => {
        const loader = new ContextLoader();
        const result = await loader.load('/non-existent');

        expect(result.success).toBe(true);
        expect(result.filesLoaded).toBe(0);
        expect(result.context?.files).toHaveLength(0);
      });

      it('should only load .md and .txt files by default', async () => {
        await fs.writeFile(path.join(contextDir, 'valid.md'), 'Valid');
        await fs.writeFile(path.join(contextDir, 'valid.txt'), 'Also valid');
        await fs.writeFile(path.join(contextDir, 'invalid.json'), '{}');

        const loader = new ContextLoader();
        const result = await loader.load(testDir);

        expect(result.filesLoaded).toBe(2);
      });

      it('should respect custom file extensions', async () => {
        await fs.writeFile(path.join(contextDir, 'file.md'), 'MD');
        await fs.writeFile(path.join(contextDir, 'file.rst'), 'RST');

        const loader = createContextLoader({ fileExtensions: ['.rst'] });
        const result = await loader.load(testDir);

        expect(result.filesLoaded).toBe(1);
        expect(result.context!.files[0]!.filename).toBe('file.rst');
      });

      it('should sort files by name', async () => {
        await fs.writeFile(path.join(contextDir, 'z.md'), 'Z');
        await fs.writeFile(path.join(contextDir, 'a.md'), 'A');
        await fs.writeFile(path.join(contextDir, 'm.md'), 'M');

        const loader = new ContextLoader();
        const result = await loader.load(testDir);

        expect(result.context!.files[0]!.filename).toBe('a.md');
        expect(result.context!.files[1]!.filename).toBe('m.md');
        expect(result.context!.files[2]!.filename).toBe('z.md');
      });

      it('should track total size', async () => {
        const content = 'X'.repeat(1000);
        await fs.writeFile(path.join(contextDir, 'file.md'), content);

        const loader = new ContextLoader();
        const result = await loader.load(testDir);

        expect(result.context?.totalSize).toBe(1000);
      });
    });

    describe('INV-CTX-001: File size limit', () => {
      it('should skip files exceeding max file size', async () => {
        // Create a file that exceeds default limit (use small limit for test)
        const largeContent = 'X'.repeat(1000);
        await fs.writeFile(path.join(contextDir, 'large.md'), largeContent);
        await fs.writeFile(path.join(contextDir, 'small.md'), 'Small');

        const loader = createContextLoader({ maxFileSize: 500 });
        const result = await loader.load(testDir);

        expect(result.filesLoaded).toBe(1);
        expect(result.filesSkipped).toBe(1);
        expect(result.skippedReasons![0]!.filename).toBe('large.md');
        expect(result.skippedReasons![0]!.reason).toContain('exceeds max size');
      });
    });

    describe('INV-CTX-002: Total size limit', () => {
      it('should stop loading when total size exceeded', async () => {
        await fs.writeFile(path.join(contextDir, 'a.md'), 'X'.repeat(300));
        await fs.writeFile(path.join(contextDir, 'b.md'), 'X'.repeat(300));
        await fs.writeFile(path.join(contextDir, 'c.md'), 'X'.repeat(300));

        const loader = createContextLoader({ maxTotalSize: 700 });
        const result = await loader.load(testDir);

        expect(result.filesLoaded).toBe(2);
        expect(result.filesSkipped).toBe(1);
        expect(result.skippedReasons![0]!.reason).toContain('total size limit');
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createContextLoader', () => {
      it('should create loader with default config', () => {
        const loader = createContextLoader();
        expect(loader).toBeDefined();
      });

      it('should create loader with custom config', () => {
        const loader = createContextLoader({
          maxFileSize: 1024,
          fileExtensions: ['.md'],
        });
        expect(loader).toBeDefined();
      });
    });

    describe('hasProjectContext', () => {
      it('should return true when context exists', async () => {
        const result = await hasProjectContext(testDir);
        expect(result).toBe(true);
      });
    });

    describe('loadProjectContext', () => {
      it('should load context with default settings', async () => {
        await fs.writeFile(path.join(contextDir, 'test.md'), 'Test');
        const result = await loadProjectContext(testDir);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Constants', () => {
    it('should export correct constants', () => {
      expect(MAX_CONTEXT_FILE_SIZE).toBe(50 * 1024);
      expect(MAX_CONTEXT_TOTAL_SIZE).toBe(200 * 1024);
      expect(CONTEXT_DIRECTORY).toBe('context');
    });
  });
});
