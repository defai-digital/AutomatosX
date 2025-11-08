/**
 * ErrorHandler.test.ts
 *
 * Tests for enhanced error handling
 */

import { describe, it, expect } from 'vitest';
import { ErrorHandler, ErrorCategory } from '../ErrorHandler.js';

describe('ErrorHandler', () => {
  describe('enhance', () => {
    it('should detect file not found errors', () => {
      const error = new Error('ENOENT: no such file');
      const enhanced = ErrorHandler.enhance(error);

      expect(enhanced.category).toBe(ErrorCategory.FILE_NOT_FOUND);
      expect(enhanced.message).toContain('File not found');
      expect(enhanced.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect directory not found errors', () => {
      const error = new Error('ENOENT: directory not found');
      const enhanced = ErrorHandler.enhance(error);

      expect(enhanced.category).toBe(ErrorCategory.DIRECTORY_NOT_FOUND);
      expect(enhanced.message).toContain('Directory not found');
      expect(enhanced.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect permission errors', () => {
      const error = new Error('EACCES: permission denied');
      const enhanced = ErrorHandler.enhance(error);

      expect(enhanced.category).toBe(ErrorCategory.PERMISSION_ERROR);
      expect(enhanced.message).toContain('Permission denied');
      expect(enhanced.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect database errors', () => {
      const error = new Error('sqlite error: database is locked');
      const enhanced = ErrorHandler.enhance(error);

      expect(enhanced.category).toBe(ErrorCategory.DATABASE_ERROR);
      expect(enhanced.message).toContain('Database error');
      expect(enhanced.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect parser errors', () => {
      const error = new Error('parse error: unexpected token');
      const enhanced = ErrorHandler.enhance(error);

      expect(enhanced.category).toBe(ErrorCategory.PARSER_ERROR);
      expect(enhanced.message).toContain('Parser error');
      expect(enhanced.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      const enhanced = ErrorHandler.enhance(error);

      expect(enhanced.category).toBe(ErrorCategory.UNKNOWN_ERROR);
      expect(enhanced.message).toContain('Unexpected error');
      expect(enhanced.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle non-Error objects', () => {
      const enhanced = ErrorHandler.enhance('String error message');

      expect(enhanced.category).toBe(ErrorCategory.UNKNOWN_ERROR);
      expect(enhanced.message).toContain('String error message');
    });
  });

  describe('specific error creators', () => {
    it('should create file not found error', () => {
      const error = ErrorHandler.fileNotFound('/path/to/file.ts');

      expect(error.category).toBe(ErrorCategory.FILE_NOT_FOUND);
      expect(error.message).toContain('/path/to/file.ts');
      expect(error.suggestions).toContain('Check the file path is correct');
    });

    it('should create directory not found error', () => {
      const error = ErrorHandler.directoryNotFound('/path/to/dir');

      expect(error.category).toBe(ErrorCategory.DIRECTORY_NOT_FOUND);
      expect(error.message).toContain('/path/to/dir');
      expect(error.suggestions).toContain('Use `.` for current directory');
    });

    it('should create no files to index error', () => {
      const error = ErrorHandler.noFilesToIndex(['.ts', '.js']);

      expect(error.category).toBe(ErrorCategory.NO_FILES_TO_INDEX);
      expect(error.message).toContain('No files found');
      expect(error.suggestions.some(s => s.includes('.ts,.js'))).toBe(true);
    });

    it('should create no results found error', () => {
      const error = ErrorHandler.noResultsFound('myFunction');

      expect(error.category).toBe(ErrorCategory.NO_RESULTS_FOUND);
      expect(error.message).toContain('myFunction');
      expect(error.suggestions).toContain('Try different search terms');
    });

    it('should create invalid query error', () => {
      const error = ErrorHandler.invalidQuery('x', 'too short');

      expect(error.category).toBe(ErrorCategory.INVALID_QUERY);
      expect(error.message).toContain('too short');
      expect(error.suggestions.some(s => s.includes('2 characters'))).toBe(true);
    });

    it('should create no index data error', () => {
      const error = ErrorHandler.noIndexData();

      expect(error.category).toBe(ErrorCategory.NO_RESULTS_FOUND);
      expect(error.message).toContain('No files have been indexed');
      expect(error.suggestions).toContain('Index your codebase first: ax index .');
    });
  });

  describe('validation helpers', () => {
    it('should validate non-empty query', () => {
      expect(() => ErrorHandler.validateQuery('validQuery')).not.toThrow();
    });

    it('should reject empty query', () => {
      expect(() => ErrorHandler.validateQuery('')).toThrow('Query cannot be empty');
    });

    it('should reject whitespace-only query', () => {
      expect(() => ErrorHandler.validateQuery('   ')).toThrow('Query cannot be empty');
    });

    it('should reject query with less than 2 characters', () => {
      expect(() => ErrorHandler.validateQuery('x')).toThrow('at least 2 characters');
    });
  });

  describe('error suggestions', () => {
    it('should provide actionable suggestions for file not found', () => {
      const error = ErrorHandler.fileNotFound('test.ts');

      expect(error.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(error.suggestions.some(s => s.toLowerCase().includes('path'))).toBe(true);
      expect(error.suggestions.some(s => s.toLowerCase().includes('ls'))).toBe(true);
    });

    it('should provide actionable suggestions for no results', () => {
      const error = ErrorHandler.noResultsFound('searchTerm');

      expect(error.suggestions.length).toBeGreaterThanOrEqual(4);
      expect(error.suggestions.some(s => s.toLowerCase().includes('spelling'))).toBe(true);
      expect(error.suggestions.some(s => s.toLowerCase().includes('index'))).toBe(true);
    });

    it('should provide actionable suggestions for database errors', () => {
      const error = ErrorHandler.databaseError('locked');

      expect(error.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(error.suggestions.some(s => s.includes('rm -rf .automatosx/db'))).toBe(true);
      expect(error.suggestions.some(s => s.toLowerCase().includes('disk space'))).toBe(true);
    });
  });
});
