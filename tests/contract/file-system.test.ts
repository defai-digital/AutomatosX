/**
 * File System Contract Tests
 *
 * Validates file system schemas and security invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  FilePathSchema,
  FileEncodingSchema,
  FileWriteRequestSchema,
  FileWriteResultSchema,
  DirectoryCreateRequestSchema,
  DirectoryCreateResultSchema,
  FileExistsRequestSchema,
  FileExistsResultSchema,
  BatchFileOperationSchema,
  BatchOperationRequestSchema,
  BatchOperationResultSchema,
  FileSystemErrorCode,
  validateFileWriteRequest,
  validateDirectoryCreateRequest,
  validateBatchOperationRequest,
  isPathSafe,
} from '@defai.digital/contracts';

describe('File System Contract', () => {
  describe('FilePathSchema', () => {
    it('should accept valid paths', () => {
      const validPaths = [
        'file.txt',
        'src/index.ts',
        'packages/core/domain/src/service.ts',
        'a/b/c/d/e/file.js',
      ];
      for (const path of validPaths) {
        const result = FilePathSchema.safeParse(path);
        expect(result.success).toBe(true);
      }
    });

    it('should accept paths with special characters', () => {
      const paths = [
        'file-name.ts',
        'file_name.ts',
        'file.test.ts',
        'file@2x.png',
      ];
      for (const path of paths) {
        const result = FilePathSchema.safeParse(path);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('INV-FS-001: No Path Traversal', () => {
    it('should reject paths with ..', () => {
      const traversalPaths = [
        '../etc/passwd',
        'src/../../../etc/passwd',
        'src/foo/../../bar',
        '..\\windows\\system32',
      ];
      for (const path of traversalPaths) {
        const result = FilePathSchema.safeParse(path);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0]?.message).toContain('traversal');
        }
      }
    });

    it('should reject paths with null bytes', () => {
      const result = FilePathSchema.safeParse('file\0.txt');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('Null bytes');
      }
    });

    it('should reject empty paths', () => {
      const result = FilePathSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject paths exceeding max length', () => {
      const longPath = 'a'.repeat(1001);
      const result = FilePathSchema.safeParse(longPath);
      expect(result.success).toBe(false);
    });
  });

  describe('isPathSafe helper', () => {
    it('should return true for safe paths', () => {
      expect(isPathSafe('src/index.ts')).toBe(true);
      expect(isPathSafe('packages/core/file.js')).toBe(true);
    });

    it('should return false for unsafe paths', () => {
      expect(isPathSafe('../etc/passwd')).toBe(false);
      expect(isPathSafe('src/../../etc')).toBe(false);
      expect(isPathSafe('')).toBe(false);
      expect(isPathSafe('file\0.txt')).toBe(false);
    });
  });

  describe('FileEncodingSchema', () => {
    it('should accept valid encodings', () => {
      const encodings = ['utf-8', 'ascii', 'base64', 'binary'];
      for (const encoding of encodings) {
        const result = FileEncodingSchema.safeParse(encoding);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid encodings', () => {
      const result = FileEncodingSchema.safeParse('latin1');
      expect(result.success).toBe(false);
    });
  });

  describe('FileWriteRequestSchema', () => {
    it('should validate a complete write request', () => {
      const request = {
        path: 'src/newfile.ts',
        content: 'export const foo = 1;',
        createDirectories: true,
        overwrite: false,
        encoding: 'utf-8',
        backup: false,
      };
      const result = FileWriteRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const request = {
        path: 'file.txt',
        content: 'hello',
      };
      const result = FileWriteRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createDirectories).toBe(true);
        expect(result.data.overwrite).toBe(false);
        expect(result.data.encoding).toBe('utf-8');
        expect(result.data.backup).toBe(false);
      }
    });

    it('should validate with validateFileWriteRequest', () => {
      const request = {
        path: 'test.ts',
        content: '// test',
      };
      const validated = validateFileWriteRequest(request);
      expect(validated.path).toBe('test.ts');
      expect(validated.encoding).toBe('utf-8');
    });
  });

  describe('INV-FS-002: No Silent Overwrites', () => {
    it('should default overwrite to false', () => {
      const request = {
        path: 'existing.txt',
        content: 'new content',
      };
      const result = FileWriteRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.overwrite).toBe(false);
      }
    });
  });

  describe('FileWriteResultSchema', () => {
    it('should validate successful write result', () => {
      const result = {
        success: true,
        path: 'src/new.ts',
        bytesWritten: 150,
        created: true,
        overwritten: false,
      };
      const parsed = FileWriteResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate write result with backup', () => {
      const result = {
        success: true,
        path: 'src/existing.ts',
        bytesWritten: 200,
        created: false,
        overwritten: true,
        backupPath: 'src/existing.ts.bak',
      };
      const parsed = FileWriteResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate failed write result', () => {
      const result = {
        success: false,
        path: 'readonly/file.ts',
        bytesWritten: 0,
        created: false,
        overwritten: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Cannot write to readonly directory',
        },
      };
      const parsed = FileWriteResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should reject negative bytesWritten', () => {
      const result = {
        success: true,
        path: 'file.ts',
        bytesWritten: -1,
        created: true,
        overwritten: false,
      };
      const parsed = FileWriteResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('DirectoryCreateRequestSchema', () => {
    it('should validate directory create request', () => {
      const request = {
        path: 'new/nested/directory',
        recursive: true,
      };
      const result = DirectoryCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should apply recursive default', () => {
      const request = { path: 'new-dir' };
      const result = DirectoryCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recursive).toBe(true);
      }
    });

    it('should validate with validateDirectoryCreateRequest', () => {
      const request = { path: 'src/new' };
      const validated = validateDirectoryCreateRequest(request);
      expect(validated.path).toBe('src/new');
      expect(validated.recursive).toBe(true);
    });
  });

  describe('DirectoryCreateResultSchema', () => {
    it('should validate successful creation', () => {
      const result = {
        success: true,
        path: 'new-dir',
        created: true,
        existed: false,
      };
      const parsed = DirectoryCreateResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate when directory already exists', () => {
      const result = {
        success: true,
        path: 'existing-dir',
        created: false,
        existed: true,
      };
      const parsed = DirectoryCreateResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate failed creation', () => {
      const result = {
        success: false,
        path: '/root/dir',
        created: false,
        existed: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Cannot create directory',
        },
      };
      const parsed = DirectoryCreateResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('FileExistsRequestSchema', () => {
    it('should validate exists request', () => {
      const request = { path: 'src/index.ts' };
      const result = FileExistsRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('FileExistsResultSchema', () => {
    it('should validate file exists result', () => {
      const result = {
        path: 'src/index.ts',
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 1024,
      };
      const parsed = FileExistsResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate directory exists result', () => {
      const result = {
        path: 'src',
        exists: true,
        isFile: false,
        isDirectory: true,
      };
      const parsed = FileExistsResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate non-existent path', () => {
      const result = {
        path: 'nonexistent.ts',
        exists: false,
      };
      const parsed = FileExistsResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('BatchFileOperationSchema', () => {
    it('should validate write operation', () => {
      const op = {
        operation: 'write',
        path: 'file.ts',
        content: 'code',
        overwrite: false,
      };
      const result = BatchFileOperationSchema.safeParse(op);
      expect(result.success).toBe(true);
    });

    it('should validate mkdir operation', () => {
      const op = {
        operation: 'mkdir',
        path: 'new-dir',
        recursive: true,
      };
      const result = BatchFileOperationSchema.safeParse(op);
      expect(result.success).toBe(true);
    });

    it('should reject unknown operation', () => {
      const op = {
        operation: 'delete',
        path: 'file.ts',
      };
      const result = BatchFileOperationSchema.safeParse(op);
      expect(result.success).toBe(false);
    });
  });

  describe('BatchOperationRequestSchema', () => {
    it('should validate batch request', () => {
      const request = {
        operations: [
          { operation: 'mkdir', path: 'src' },
          { operation: 'write', path: 'src/index.ts', content: 'export {}' },
        ],
        stopOnError: true,
        dryRun: false,
      };
      const result = BatchOperationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const request = {
        operations: [{ operation: 'write', path: 'file.ts', content: '' }],
      };
      const result = BatchOperationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopOnError).toBe(true);
        expect(result.data.dryRun).toBe(false);
      }
    });

    it('should validate with validateBatchOperationRequest', () => {
      const request = {
        operations: [{ operation: 'mkdir', path: 'test' }],
      };
      const validated = validateBatchOperationRequest(request);
      expect(validated.operations).toHaveLength(1);
    });

    it('should reject empty operations array', () => {
      const request = { operations: [] };
      const result = BatchOperationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject operations exceeding limit', () => {
      const operations = Array.from({ length: 101 }, (_, i) => ({
        operation: 'write' as const,
        path: `file${i}.ts`,
        content: '',
      }));
      const request = { operations };
      const result = BatchOperationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('BatchOperationResultSchema', () => {
    it('should validate successful batch result', () => {
      const result = {
        success: true,
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { index: 0, path: 'src', success: true, operation: 'mkdir' },
          { index: 1, path: 'src/file.ts', success: true, operation: 'write' },
        ],
        dryRun: false,
      };
      const parsed = BatchOperationResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate partial failure result', () => {
      const result = {
        success: false,
        total: 2,
        succeeded: 1,
        failed: 1,
        results: [
          { index: 0, path: 'src', success: true, operation: 'mkdir' },
          {
            index: 1,
            path: '../etc',
            success: false,
            operation: 'write',
            error: { code: 'PATH_TRAVERSAL', message: 'Invalid path' },
          },
        ],
        dryRun: false,
      };
      const parsed = BatchOperationResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate dry run result', () => {
      const result = {
        success: true,
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [
          { index: 0, path: 'test.ts', success: true, operation: 'write' },
        ],
        dryRun: true,
      };
      const parsed = BatchOperationResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.dryRun).toBe(true);
      }
    });
  });

  describe('FileSystemErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(FileSystemErrorCode.PATH_TRAVERSAL).toBe('PATH_TRAVERSAL');
      expect(FileSystemErrorCode.FILE_EXISTS).toBe('FILE_EXISTS');
      expect(FileSystemErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(FileSystemErrorCode.INVALID_PATH).toBe('INVALID_PATH');
      expect(FileSystemErrorCode.WRITE_FAILED).toBe('WRITE_FAILED');
      expect(FileSystemErrorCode.MKDIR_FAILED).toBe('MKDIR_FAILED');
      expect(FileSystemErrorCode.OUTSIDE_WORKSPACE).toBe('OUTSIDE_WORKSPACE');
      expect(FileSystemErrorCode.SYMLINK_NOT_ALLOWED).toBe('SYMLINK_NOT_ALLOWED');
      expect(FileSystemErrorCode.BATCH_LIMIT_EXCEEDED).toBe('BATCH_LIMIT_EXCEEDED');
    });
  });

  describe('Schema Rejection Tests', () => {
    it('should reject write request without path', () => {
      const request = { content: 'hello' };
      const result = FileWriteRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject write request without content', () => {
      const request = { path: 'file.ts' };
      const result = FileWriteRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject directory create request without path', () => {
      const request = { recursive: true };
      const result = DirectoryCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject file exists request without path', () => {
      const request = {};
      const result = FileExistsRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject write result without required fields', () => {
      const result = { success: true, path: 'file.ts' };
      const parsed = FileWriteResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle path at max length boundary', () => {
      const maxPath = 'a'.repeat(1000);
      const result = FilePathSchema.safeParse(maxPath);
      expect(result.success).toBe(true);
    });

    it('should handle write request with empty content', () => {
      const request = {
        path: 'empty.ts',
        content: '',
      };
      const result = FileWriteRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should handle batch with exactly 100 operations', () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        operation: 'write' as const,
        path: `file${i}.ts`,
        content: '',
      }));
      const request = { operations };
      const result = BatchOperationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should handle write result with zero bytes written', () => {
      const result = {
        success: true,
        path: 'empty.ts',
        bytesWritten: 0,
        created: true,
        overwritten: false,
      };
      const parsed = FileWriteResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
