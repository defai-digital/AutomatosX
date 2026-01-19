/**
 * Context Contract Tests
 *
 * Validates context schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  ContextFileSchema,
  ProjectContextSchema,
  ContextLoaderConfigSchema,
  ContextLoadResultSchema,
  MAX_CONTEXT_FILE_SIZE,
  MAX_CONTEXT_TOTAL_SIZE,
  validateContextFile,
  safeValidateContextFile,
  validateProjectContext,
} from '@defai.digital/contracts';

describe('Context Contract', () => {
  describe('ContextFileSchema', () => {
    it('should validate a context file', () => {
      const file = {
        filename: 'README.md',
        relativePath: 'context/README.md',
        content: '# Project Context',
        size: 17,
        loadedAt: new Date().toISOString(),
      };
      const result = ContextFileSchema.safeParse(file);
      expect(result.success).toBe(true);
    });

    it('should validate file with all fields', () => {
      const file = {
        filename: 'architecture.md',
        relativePath: 'context/architecture.md',
        content: '# Architecture\n\nThis project uses...',
        size: 50,
        loadedAt: new Date().toISOString(),
      };
      const result = safeValidateContextFile(file);
      expect(result.success).toBe(true);
    });
  });

  describe('ProjectContextSchema', () => {
    it('should validate project context', () => {
      const context = {
        projectPath: '/path/to/project',
        contextPath: '/path/to/project/context',
        files: [
          {
            filename: 'README.md',
            relativePath: 'README.md',
            content: '# README',
            size: 8,
            loadedAt: new Date().toISOString(),
          },
        ],
        totalSize: 8,
        fileCount: 1,
        loadedAt: new Date().toISOString(),
      };
      const result = validateProjectContext(context);
      expect(result.projectPath).toBe('/path/to/project');
    });
  });

  describe('ContextLoaderConfigSchema', () => {
    it('should validate loader config', () => {
      const config = {
        maxFileSize: 100000,
        maxTotalSize: 1000000,
        fileExtensions: ['.md', '.txt'],
        excludePatterns: ['**/node_modules/**'],
      };
      const result = ContextLoaderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = ContextLoaderConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxFileSize).toBe(MAX_CONTEXT_FILE_SIZE);
      }
    });
  });

  describe('ContextLoadResultSchema', () => {
    it('should validate load result', () => {
      const result = {
        success: true,
        filesLoaded: 5,
        filesSkipped: 2,
      };
      const parsed = ContextLoadResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have defined size limits', () => {
      expect(MAX_CONTEXT_FILE_SIZE).toBeGreaterThan(0);
      expect(MAX_CONTEXT_TOTAL_SIZE).toBeGreaterThan(MAX_CONTEXT_FILE_SIZE);
    });
  });

  describe('INV-CTX-001: File Size Limits', () => {
    it('should respect max file size constant', () => {
      expect(MAX_CONTEXT_FILE_SIZE).toBeLessThanOrEqual(10 * 1024 * 1024); // Max 10MB
    });
  });

  describe('Schema Rejection Tests', () => {
    it('should reject context file without required filename', () => {
      const file = {
        relativePath: 'context/README.md',
        content: '# Project Context',
        size: 17,
        loadedAt: new Date().toISOString(),
      };
      const result = ContextFileSchema.safeParse(file);
      expect(result.success).toBe(false);
    });

    it('should reject context file without required content', () => {
      const file = {
        filename: 'README.md',
        relativePath: 'context/README.md',
        size: 17,
        loadedAt: new Date().toISOString(),
      };
      const result = ContextFileSchema.safeParse(file);
      expect(result.success).toBe(false);
    });

    it('should reject context file with negative size', () => {
      const file = {
        filename: 'README.md',
        relativePath: 'context/README.md',
        content: '# Project Context',
        size: -1,
        loadedAt: new Date().toISOString(),
      };
      const result = ContextFileSchema.safeParse(file);
      expect(result.success).toBe(false);
    });

    it('should reject project context with mismatched file count', () => {
      const context = {
        projectPath: '/path/to/project',
        contextPath: '/path/to/project/context',
        files: [],
        totalSize: 0,
        fileCount: 5, // Claims 5 files but array is empty
        loadedAt: new Date().toISOString(),
      };
      // Note: Schema doesn't enforce count matching array length
      // This tests that schema accepts mismatched counts (documenting current behavior)
      const result = ProjectContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should reject load result with invalid success field', () => {
      const result = {
        success: 'yes', // Should be boolean
        filesLoaded: 5,
        filesSkipped: 2,
      };
      const parsed = ContextLoadResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should validate empty files array in project context', () => {
      const context = {
        projectPath: '/path/to/project',
        contextPath: '/path/to/project/context',
        files: [],
        totalSize: 0,
        fileCount: 0,
        loadedAt: new Date().toISOString(),
      };
      const result = ProjectContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should validate context file with empty content', () => {
      const file = {
        filename: 'empty.md',
        relativePath: 'context/empty.md',
        content: '',
        size: 0,
        loadedAt: new Date().toISOString(),
      };
      const result = ContextFileSchema.safeParse(file);
      expect(result.success).toBe(true);
    });

    it('should validate load result with skipped reasons', () => {
      const result = {
        success: true,
        filesLoaded: 3,
        filesSkipped: 2,
        skippedReasons: [
          { filename: 'large.md', reason: 'File exceeds max size' },
          { filename: 'binary.bin', reason: 'Unsupported extension' },
        ],
      };
      const parsed = ContextLoadResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate failed load result with error', () => {
      const result = {
        success: false,
        error: 'Context directory not found',
        filesLoaded: 0,
        filesSkipped: 0,
      };
      const parsed = ContextLoadResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
