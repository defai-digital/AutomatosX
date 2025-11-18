/**
 * Tests for GrokProjectInstructionsLoader (v8.6.0)
 *
 * @module tests/unit/integrations/grok-cli/project-instructions-loader.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GrokProjectInstructionsLoader } from '../../../../src/integrations/grok-cli/project-instructions-loader.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('GrokProjectInstructionsLoader', () => {
  let tempDir: string;
  let loader: GrokProjectInstructionsLoader;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = path.join(os.tmpdir(), `grok-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const instructionsPath = path.join(tempDir, 'GROK.md');
    loader = new GrokProjectInstructionsLoader(instructionsPath);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  });

  describe('constructor()', () => {
    it('should use default path when no custom path provided', () => {
      const defaultLoader = new GrokProjectInstructionsLoader();
      const expectedPath = path.join(process.cwd(), '.grok', 'GROK.md');
      expect(defaultLoader.getPath()).toBe(expectedPath);
    });

    it('should use custom path when provided', () => {
      const customPath = '/custom/path/GROK.md';
      const customLoader = new GrokProjectInstructionsLoader(customPath);
      expect(customLoader.getPath()).toBe(customPath);
    });
  });

  describe('load()', () => {
    it('should return empty string when file does not exist', async () => {
      const content = await loader.load();
      expect(content).toBe('');
    });

    it('should load valid markdown content from file', async () => {
      const testContent = '# Project Instructions\n\nThis is a test project.';

      await fs.promises.writeFile(
        loader.getPath(),
        testContent,
        'utf-8'
      );

      const loaded = await loader.load();
      expect(loaded).toBe(testContent);
    });

    it('should handle multi-line markdown', async () => {
      const testContent = `# Project Instructions

## Overview
This is a test project.

## Requirements
- Requirement 1
- Requirement 2

## Notes
Some additional notes here.`;

      await fs.promises.writeFile(
        loader.getPath(),
        testContent,
        'utf-8'
      );

      const loaded = await loader.load();
      expect(loaded).toBe(testContent);
    });

    it('should return empty string for empty file', async () => {
      await fs.promises.writeFile(
        loader.getPath(),
        '',
        'utf-8'
      );

      const content = await loader.load();
      expect(content).toBe('');
    });

    it('should cache loaded content', async () => {
      const testContent = '# Test';

      await fs.promises.writeFile(
        loader.getPath(),
        testContent,
        'utf-8'
      );

      await loader.load();
      const cached = loader.getCached();

      expect(cached).toBe(testContent);
    });

    it('should handle special markdown characters', async () => {
      const testContent = '# Test\n\n`code` **bold** *italic* [link](url)';

      await fs.promises.writeFile(
        loader.getPath(),
        testContent,
        'utf-8'
      );

      const loaded = await loader.load();
      expect(loaded).toBe(testContent);
    });
  });

  describe('create()', () => {
    it('should create file with markdown content', async () => {
      const content = '# Project Instructions\n\nTest content';

      await loader.create(content);

      const fileContent = await fs.promises.readFile(loader.getPath(), 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should create parent directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'GROK.md');
      const nestedLoader = new GrokProjectInstructionsLoader(nestedPath);

      await nestedLoader.create('# Test');

      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('should throw error for empty content', async () => {
      await expect(loader.create('')).rejects.toThrow();
    });

    it('should update cache after creating', async () => {
      const content = '# Test';

      await loader.create(content);
      const cached = loader.getCached();

      expect(cached).toBe(content);
    });

    it('should use atomic write pattern', async () => {
      const content = '# Test';

      await loader.create(content);

      // Verify temp file was cleaned up
      const tempPath = `${loader.getPath()}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);
    });

    it('should overwrite existing file', async () => {
      await loader.create('# Old Content');
      await loader.create('# New Content');

      const content = await fs.promises.readFile(loader.getPath(), 'utf-8');
      expect(content).toBe('# New Content');
    });

    it('should handle long content', async () => {
      const longContent = '# Test\n\n' + 'A'.repeat(10000);

      await loader.create(longContent);

      const loaded = await loader.load();
      expect(loaded).toBe(longContent);
    });
  });

  describe('exists()', () => {
    it('should return false when file does not exist', () => {
      expect(loader.exists()).toBe(false);
    });

    it('should return true when file exists', async () => {
      await loader.create('# Test');

      expect(loader.exists()).toBe(true);
    });

    it('should return false after delete', async () => {
      await loader.create('# Test');
      await loader.delete();

      expect(loader.exists()).toBe(false);
    });
  });

  describe('getPath()', () => {
    it('should return the instructions file path', () => {
      const expectedPath = path.join(tempDir, 'GROK.md');
      expect(loader.getPath()).toBe(expectedPath);
    });
  });

  describe('delete()', () => {
    it('should delete the instructions file', async () => {
      await loader.create('# Test');

      await loader.delete();

      expect(fs.existsSync(loader.getPath())).toBe(false);
    });

    it('should clear the cache', async () => {
      await loader.create('# Test');
      await loader.delete();

      const cached = loader.getCached();

      expect(cached).toBeNull();
    });

    it('should not throw if file does not exist', async () => {
      await expect(loader.delete()).resolves.not.toThrow();
    });
  });

  describe('getCached()', () => {
    it('should return null when no content loaded', () => {
      expect(loader.getCached()).toBeNull();
    });

    it('should return cached content after load', async () => {
      const content = '# Test';

      await loader.create(content);
      await loader.load();

      const cached = loader.getCached();

      expect(cached).toBe(content);
    });

    it('should return cached content after create', async () => {
      const content = '# Test';

      await loader.create(content);

      const cached = loader.getCached();

      expect(cached).toBe(content);
    });

    it('should return null after delete', async () => {
      await loader.create('# Test');
      await loader.delete();

      const cached = loader.getCached();

      expect(cached).toBeNull();
    });
  });

  describe('Markdown Validation', () => {
    it('should accept valid markdown headings', async () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

      await expect(loader.create(content)).resolves.not.toThrow();
    });

    it('should accept lists', async () => {
      const content = `# Lists

- Item 1
- Item 2

1. Numbered 1
2. Numbered 2`;

      await expect(loader.create(content)).resolves.not.toThrow();
    });

    it('should accept code blocks', async () => {
      const content = `# Code

\`\`\`typescript
const x = 42;
\`\`\``;

      await expect(loader.create(content)).resolves.not.toThrow();
    });

    it('should accept links and images', async () => {
      const content = `# Media

[Link](https://example.com)
![Image](image.png)`;

      await expect(loader.create(content)).resolves.not.toThrow();
    });

    it('should accept tables', async () => {
      const content = `# Table

| Col1 | Col2 |
|------|------|
| A    | B    |`;

      await expect(loader.create(content)).resolves.not.toThrow();
    });

    it('should accept blockquotes', async () => {
      const content = `# Quote

> This is a quote`;

      await expect(loader.create(content)).resolves.not.toThrow();
    });

    it('should accept horizontal rules', async () => {
      const content = `# Rule

---

Content below`;

      await expect(loader.create(content)).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle read errors gracefully', async () => {
      // Create file with no read permissions (Unix only)
      if (process.platform !== 'win32') {
        await loader.create('# Test');
        await fs.promises.chmod(loader.getPath(), 0o000);

        const content = await loader.load();

        expect(content).toBe('');

        // Restore permissions for cleanup
        await fs.promises.chmod(loader.getPath(), 0o644);
      }
    });

    it('should handle write errors gracefully', async () => {
      // Try to write to a directory path (will fail)
      const dirPath = path.join(tempDir, 'dir-not-file');
      await fs.promises.mkdir(dirPath);
      const invalidLoader = new GrokProjectInstructionsLoader(dirPath);

      await expect(invalidLoader.create('# Test')).rejects.toThrow();
    });
  });

  describe('Atomic Writes', () => {
    it('should not corrupt file if write is interrupted', async () => {
      const content1 = '# Content 1';
      const content2 = '# Content 2';

      await loader.create(content1);

      // Simulate interrupted write by creating temp file
      const tempPath = `${loader.getPath()}.tmp`;
      await fs.promises.writeFile(tempPath, 'corrupted', 'utf-8');

      // Complete the write
      await loader.create(content2);

      const loaded = await loader.load();

      expect(loaded).toBe(content2);
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });

  describe('Integration', () => {
    it('should support full CRUD workflow', async () => {
      // Create
      await loader.create('# Initial Content');
      expect(loader.exists()).toBe(true);

      // Read
      let content = await loader.load();
      expect(content).toBe('# Initial Content');

      // Update
      await loader.create('# Updated Content');
      content = await loader.load();
      expect(content).toBe('# Updated Content');

      // Delete
      await loader.delete();
      expect(loader.exists()).toBe(false);

      // Read after delete
      content = await loader.load();
      expect(content).toBe('');
    });

    it('should maintain consistency across multiple operations', async () => {
      for (let i = 0; i < 10; i++) {
        const content = `# Iteration ${i}`;
        await loader.create(content);

        const loaded = await loader.load();
        expect(loaded).toBe(content);

        const cached = loader.getCached();
        expect(cached).toBe(content);
      }
    });
  });
});
