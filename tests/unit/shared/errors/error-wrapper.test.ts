/**
 * Comprehensive tests for error-wrapper.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  getErrorStack,
  isErrorInstance,
  wrapError,
  safeAsync,
  safeSync,
  errorToObject,
  isRetriableError,
  isFatalError
} from '../../../../src/shared/errors/error-wrapper.js';
import { BaseError, ErrorCode } from '../../../../src/shared/errors/errors.js';

/**
 * Test error class that matches the wrapError expected signature:
 * (message: string, code: string, metadata?: Record<string, unknown>)
 *
 * This differs from BaseError which expects ErrorCode enum and suggestions array.
 * We store metadata in BaseError's context field.
 */
class TestError extends BaseError {
  public readonly metadata?: Record<string, unknown>;

  constructor(message: string, code: string, metadata?: Record<string, unknown>) {
    // BaseError expects: message, ErrorCode, suggestions[], context?, isOperational?
    // We pass metadata as context
    super(message, ErrorCode.UNKNOWN_ERROR, [], metadata);
    this.name = 'TestError';
    // Store metadata as a separate property for tests that expect it
    this.metadata = metadata;
    // Override code with the string code for testing
    (this as { code: string }).code = code;
  }
}

describe('error-wrapper', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return string as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Object error message' };
      expect(getErrorMessage(error)).toBe('Object error message');
    });

    it('should extract message from nested error.message', () => {
      const error = { error: { message: 'Nested error message' } };
      expect(getErrorMessage(error)).toBe('Nested error message');
    });

    it('should extract error string property', () => {
      const error = { error: 'Error string property' };
      expect(getErrorMessage(error)).toBe('Error string property');
    });

    it('should convert non-string values', () => {
      expect(getErrorMessage(123)).toBe('123');
      expect(getErrorMessage(null)).toBe('null');
      expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('should handle empty object', () => {
      const error = {};
      expect(getErrorMessage(error)).toBe('[object Object]');
    });
  });

  describe('getErrorStack', () => {
    it('should return stack from Error instance', () => {
      const error = new Error('Test');
      expect(getErrorStack(error)).toBeDefined();
      expect(getErrorStack(error)).toContain('Error: Test');
    });

    it('should return undefined for non-Error values', () => {
      expect(getErrorStack('string error')).toBeUndefined();
      expect(getErrorStack({ message: 'object error' })).toBeUndefined();
      expect(getErrorStack(123)).toBeUndefined();
      expect(getErrorStack(null)).toBeUndefined();
    });
  });

  describe('isErrorInstance', () => {
    it('should return true for matching error class', () => {
      const error = new TypeError('Type error');
      expect(isErrorInstance(error, TypeError as unknown as new (...args: unknown[]) => TypeError)).toBe(true);
    });

    it('should return true for parent class', () => {
      const error = new TypeError('Type error');
      expect(isErrorInstance(error, Error as unknown as new (...args: unknown[]) => Error)).toBe(true);
    });

    it('should return false for non-matching class', () => {
      const error = new TypeError('Type error');
      expect(isErrorInstance(error, SyntaxError as unknown as new (...args: unknown[]) => SyntaxError)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      const ErrorClass = Error as unknown as new (...args: unknown[]) => Error;
      expect(isErrorInstance('string', ErrorClass)).toBe(false);
      expect(isErrorInstance(null, ErrorClass)).toBe(false);
      expect(isErrorInstance({}, ErrorClass)).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return same error if already correct type', () => {
      const original = new TestError('Original', 'CODE');
      const wrapped = wrapError(original, TestError, 'Wrapped', 'WRAP_CODE');
      expect(wrapped).toBe(original);
    });

    it('should wrap Error instance', () => {
      const original = new Error('Original error');
      const wrapped = wrapError(original, TestError, 'Wrapped message', 'WRAP_CODE');

      expect(wrapped).toBeInstanceOf(TestError);
      expect(wrapped.message).toContain('Wrapped message');
      expect(wrapped.message).toContain('Original error');
      expect(wrapped.code).toBe('WRAP_CODE');
    });

    it('should wrap string error', () => {
      const wrapped = wrapError('String error', TestError, 'Wrapped', 'CODE');

      expect(wrapped).toBeInstanceOf(TestError);
      expect(wrapped.message).toContain('String error');
    });

    it('should include metadata', () => {
      const wrapped = wrapError(
        new Error('Original'),
        TestError,
        'Wrapped',
        'CODE',
        { extra: 'data' }
      );

      expect(wrapped.metadata?.extra).toBe('data');
      expect(wrapped.metadata?.originalMessage).toBe('Original');
    });

    it('should preserve stack trace', () => {
      const original = new Error('Original');
      const wrapped = wrapError(original, TestError, 'Wrapped', 'CODE');

      expect(wrapped.stack).toContain('Caused by:');
    });
  });

  describe('safeAsync', () => {
    it('should return result on success', async () => {
      const result = await safeAsync(
        () => Promise.resolve('success'),
        TestError,
        'Failed',
        'CODE'
      );

      expect(result).toBe('success');
    });

    it('should throw wrapped error on failure', async () => {
      await expect(
        safeAsync(
          () => Promise.reject(new Error('Async error')),
          TestError,
          'Operation failed',
          'ASYNC_ERROR'
        )
      ).rejects.toThrow(TestError);
    });

    it('should include original error message', async () => {
      try {
        await safeAsync(
          () => Promise.reject(new Error('Original')),
          TestError,
          'Wrapped',
          'CODE'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TestError);
        expect((error as TestError).message).toContain('Original');
      }
    });
  });

  describe('safeSync', () => {
    it('should return result on success', () => {
      const result = safeSync(
        () => 'success',
        TestError,
        'Failed',
        'CODE'
      );

      expect(result).toBe('success');
    });

    it('should throw wrapped error on failure', () => {
      expect(() =>
        safeSync(
          () => { throw new Error('Sync error'); },
          TestError,
          'Operation failed',
          'SYNC_ERROR'
        )
      ).toThrow(TestError);
    });

    it('should include original error message', () => {
      try {
        safeSync(
          () => { throw new Error('Original'); },
          TestError,
          'Wrapped',
          'CODE'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TestError);
        expect((error as TestError).message).toContain('Original');
      }
    });
  });

  describe('errorToObject', () => {
    it('should convert Error to object', () => {
      const error = new Error('Test error');
      const obj = errorToObject(error);

      expect(obj.name).toBe('Error');
      expect(obj.message).toBe('Test error');
      expect(obj.stack).toBeDefined();
    });

    it('should include code if present', () => {
      const error = new TestError('Test', 'TEST_CODE');
      const obj = errorToObject(error);

      expect(obj.code).toBe('TEST_CODE');
    });

    it('should include metadata if present', () => {
      const error = new TestError('Test', 'CODE', { extra: 'data' });
      const obj = errorToObject(error);

      expect(obj.metadata).toEqual({ extra: 'data' });
    });

    it('should spread object properties', () => {
      const obj = errorToObject({ foo: 'bar', baz: 123 });
      expect(obj.foo).toBe('bar');
      expect(obj.baz).toBe(123);
    });

    it('should convert primitive to object', () => {
      expect(errorToObject('string')).toEqual({ error: 'string' });
      expect(errorToObject(123)).toEqual({ error: '123' });
      expect(errorToObject(null)).toEqual({ error: 'null' });
    });
  });

  describe('isRetriableError', () => {
    it('should return true for timeout errors', () => {
      expect(isRetriableError(new Error('Connection timeout'))).toBe(true);
      expect(isRetriableError(new Error('Request timeout exceeded'))).toBe(true);
    });

    it('should return true for network errors', () => {
      expect(isRetriableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetriableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      expect(isRetriableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetriableError(new Error('Too many requests'))).toBe(true);
    });

    it('should return true for service unavailable', () => {
      expect(isRetriableError(new Error('temporarily unavailable'))).toBe(true);
      expect(isRetriableError(new Error('service unavailable'))).toBe(true);
    });

    it('should return true for database errors', () => {
      expect(isRetriableError(new Error('database is locked'))).toBe(true);
      expect(isRetriableError(new Error('deadlock'))).toBe(true);
    });

    it('should return true for retry suggestions', () => {
      expect(isRetriableError(new Error('Please try again'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRetriableError(new Error('Not found'))).toBe(false);
      expect(isRetriableError(new Error('Invalid input'))).toBe(false);
    });

    it('should handle string errors', () => {
      expect(isRetriableError('Connection timeout')).toBe(true);
      expect(isRetriableError('Invalid syntax')).toBe(false);
    });
  });

  describe('isFatalError', () => {
    it('should return true for not found errors', () => {
      expect(isFatalError(new Error('Resource not found'))).toBe(true);
      expect(isFatalError(new Error('File does not exist'))).toBe(true);
    });

    it('should return true for auth errors', () => {
      expect(isFatalError(new Error('Unauthorized access'))).toBe(true);
      expect(isFatalError(new Error('Authentication failed'))).toBe(true);
    });

    it('should return true for permission errors', () => {
      expect(isFatalError(new Error('Permission denied'))).toBe(true);
      expect(isFatalError(new Error('Access denied'))).toBe(true);
      expect(isFatalError(new Error('403 Forbidden'))).toBe(true);
    });

    it('should return true for validation errors', () => {
      expect(isFatalError(new Error('Invalid input'))).toBe(true);
      expect(isFatalError(new Error('400 Bad Request'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isFatalError(new Error('Connection timeout'))).toBe(false);
      expect(isFatalError(new Error('Rate limit exceeded'))).toBe(false);
    });

    it('should handle string errors', () => {
      expect(isFatalError('Permission denied')).toBe(true);
      expect(isFatalError('Connection refused')).toBe(false);
    });
  });
});
