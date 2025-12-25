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
});
