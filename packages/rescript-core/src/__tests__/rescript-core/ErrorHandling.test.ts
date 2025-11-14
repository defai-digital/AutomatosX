/**
 * Unit Tests for ErrorHandling.res
 *
 * Tests the ReScript ErrorHandling module through the TypeScript bridge
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureBridge,
  enableAllModules,
  disableAllModules,
  ErrorHandlingBridge,
  Ok,
  Error,
  isOk,
  isError,
  unwrapOk,
  unwrapError,
  type Result,
} from '../../bridge/RescriptBridge';

describe('ErrorHandling Module', () => {
  beforeEach(() => {
    // Enable ErrorHandling module for tests
    configureBridge({ enableErrorHandling: true, logTransitions: false });
  });

  describe('Result Type Basics', () => {
    it('should create Ok result', () => {
      const result = Ok(42);

      expect(isOk(result)).toBe(true);
      expect(isError(result)).toBe(false);
      expect(unwrapOk(result)).toBe(42);
    });

    it('should create Error result', () => {
      const result = Error('Something went wrong');

      expect(isError(result)).toBe(true);
      expect(isOk(result)).toBe(false);
      expect(unwrapError(result)).toBe('Something went wrong');
    });

    it('should throw when unwrapping wrong variant', () => {
      const okResult = Ok(42);
      const errorResult = Error('error');

      expect(() => unwrapError(okResult)).toThrow();
      expect(() => unwrapOk(errorResult)).toThrow();
    });
  });

  describe('mapResult', () => {
    it('should map Ok value', () => {
      const result = Ok(10);
      const mapped = ErrorHandlingBridge.mapResult(x => x * 2, result);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped._0).toBe(20);
      }
    });

    it('should not map Error value', () => {
      const result: Result<number, string> = Error('error');
      const mapped = ErrorHandlingBridge.mapResult(x => x * 2, result);

      expect(isError(mapped)).toBe(true);
      if (isError(mapped)) {
        expect(mapped._0).toBe('error');
      }
    });

    it('should handle complex transformations', () => {
      const result = Ok({ value: 42 });
      const mapped = ErrorHandlingBridge.mapResult(
        obj => ({ ...obj, doubled: obj.value * 2 }),
        result
      );

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped._0).toEqual({ value: 42, doubled: 84 });
      }
    });
  });

  describe('flatMapResult', () => {
    it('should flat map Ok value to Ok', () => {
      const result = Ok(10);
      const flatMapped = ErrorHandlingBridge.flatMapResult(
        x => Ok(x * 2),
        result
      );

      expect(isOk(flatMapped)).toBe(true);
      if (isOk(flatMapped)) {
        expect(flatMapped._0).toBe(20);
      }
    });

    it('should flat map Ok value to Error', () => {
      const result = Ok(10);
      const flatMapped = ErrorHandlingBridge.flatMapResult<number, number, string>(
        x => x > 5 ? Error('Too large') : Ok(x * 2),
        result
      );

      expect(isError(flatMapped)).toBe(true);
      if (isError(flatMapped)) {
        expect(flatMapped._0).toBe('Too large');
      }
    });

    it('should not flat map Error value', () => {
      const result: Result<number, string> = Error('initial error');
      const flatMapped = ErrorHandlingBridge.flatMapResult(
        x => Ok(x * 2),
        result
      );

      expect(isError(flatMapped)).toBe(true);
      if (isError(flatMapped)) {
        expect(flatMapped._0).toBe('initial error');
      }
    });

    it('should chain multiple operations', () => {
      const result = Ok(5);
      const chained = ErrorHandlingBridge.flatMapResult(
        x => ErrorHandlingBridge.flatMapResult(
          y => Ok(y + 10),
          Ok(x * 2)
        ),
        result
      );

      expect(isOk(chained)).toBe(true);
      if (isOk(chained)) {
        expect(chained._0).toBe(20); // (5 * 2) + 10
      }
    });
  });

  describe('asyncMapResult', () => {
    it('should async map Ok value', async () => {
      const result = Ok(10);
      const mapped = await ErrorHandlingBridge.asyncMapResult(
        async (x) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return x * 2;
        },
        result
      );

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped._0).toBe(20);
      }
    });

    it('should handle async errors', async () => {
      const result = Ok(10);
      const mapped = await ErrorHandlingBridge.asyncMapResult(
        async (x) => {
          throw new Error('Async error');
        },
        result
      );

      expect(isError(mapped)).toBe(true);
    });

    it('should not execute async function on Error', async () => {
      let executed = false;
      const result: Result<number, string> = Error('error');

      const mapped = await ErrorHandlingBridge.asyncMapResult(
        async (x) => {
          executed = true;
          return x * 2;
        },
        result
      );

      expect(executed).toBe(false);
      expect(isError(mapped)).toBe(true);
    });
  });

  describe('BUG #2: Unhandled Promise Rejections', () => {
    it('should prevent unhandled rejections with Result type', async () => {
      // BUGGY TypeScript version:
      // async function fetchData() {
      //   const response = await fetch('/api');
      //   return response.json(); // ❌ Can throw, no handling
      // }

      // ReScript version with Result:
      async function fetchData(): Promise<Result<any, string>> {
        try {
          // Simulated fetch that throws
          throw new Error('Network error');
        } catch (error) {
          return Error((error as Error).message);
        }
      }

      const result = await fetchData();

      // MUST handle both cases - compiler enforces this
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result._0).toBe('Network error');
      }
    });
  });

  describe('BUG #3: Error Swallowing in Nested Try/Catch', () => {
    it('should prevent error swallowing with Result chains', () => {
      // BUGGY TypeScript version:
      // try {
      //   try {
      //     throw new Error('inner');
      //   } catch (e) {
      //     // ❌ Swallowed! Outer catch never sees it
      //   }
      // } catch (e) {
      //   console.error(e); // Never reached
      // }

      // ReScript version:
      function innerOperation(): Result<number, string> {
        return Error('inner error');
      }

      function outerOperation(): Result<number, string> {
        return ErrorHandlingBridge.flatMapResult(
          value => Ok(value * 2),
          innerOperation()
        );
      }

      const result = outerOperation();

      // Error is propagated, not swallowed
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result._0).toBe('inner error');
      }
    });
  });

  describe('BUG #4: Silent Failure from Ignoring Result', () => {
    it('should force error handling with Result type', () => {
      // BUGGY TypeScript version:
      // function divide(a: number, b: number): number {
      //   return a / b; // ❌ Returns Infinity or NaN, no error
      // }
      // divide(10, 0); // Silently returns Infinity

      // ReScript version:
      function safeDivide(a: number, b: number): Result<number, string> {
        if (b === 0) {
          return Error('Division by zero');
        }
        return Ok(a / b);
      }

      const result = safeDivide(10, 0);

      // MUST check result - can't ignore it
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result._0).toBe('Division by zero');
      }
    });
  });

  describe('Feature Flag Integration', () => {
    it('should use ReScript when enabled', () => {
      configureBridge({ enableErrorHandling: true, logTransitions: false });

      const result = Ok(42);
      const mapped = ErrorHandlingBridge.mapResult(x => x * 2, result);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped._0).toBe(84);
      }
    });

    it('should use TypeScript fallback when disabled', () => {
      configureBridge({ enableErrorHandling: false, logTransitions: false });

      const result = Ok(42);
      const mapped = ErrorHandlingBridge.mapResult(x => x * 2, result);

      // Should still work with fallback
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped._0).toBe(84);
      }
    });

    it('should toggle between implementations', () => {
      const result = Ok(10);

      // Use ReScript
      configureBridge({ enableErrorHandling: true, logTransitions: false });
      const rescriptResult = ErrorHandlingBridge.mapResult(x => x * 2, result);
      expect(unwrapOk(rescriptResult)).toBe(20);

      // Use TypeScript fallback
      configureBridge({ enableErrorHandling: false, logTransitions: false });
      const tsResult = ErrorHandlingBridge.mapResult(x => x * 3, result);
      expect(unwrapOk(tsResult)).toBe(30);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle user authentication flow', () => {
      function authenticateUser(username: string, password: string): Result<{ token: string }, string> {
        if (username.length === 0) {
          return Error('Username cannot be empty');
        }
        if (password.length < 8) {
          return Error('Password must be at least 8 characters');
        }
        return Ok({ token: 'abc123' });
      }

      const validResult = authenticateUser('john', 'password123');
      expect(isOk(validResult)).toBe(true);

      const invalidResult = authenticateUser('', 'short');
      expect(isError(invalidResult)).toBe(true);
      if (isError(invalidResult)) {
        expect(invalidResult._0).toBe('Username cannot be empty');
      }
    });

    it('should handle data processing pipeline', () => {
      function parseJSON(json: string): Result<any, string> {
        try {
          return Ok(JSON.parse(json));
        } catch {
          return Error('Invalid JSON');
        }
      }

      function validateData(data: any): Result<any, string> {
        if (!data.id) {
          return Error('Missing id field');
        }
        return Ok(data);
      }

      function processData(json: string): Result<any, string> {
        return ErrorHandlingBridge.flatMapResult(
          data => validateData(data),
          parseJSON(json)
        );
      }

      const validResult = processData('{"id": 1, "name": "test"}');
      expect(isOk(validResult)).toBe(true);

      const invalidJSONResult = processData('invalid json');
      expect(isError(invalidJSONResult)).toBe(true);

      const missingIdResult = processData('{"name": "test"}');
      expect(isError(missingIdResult)).toBe(true);
      if (isError(missingIdResult)) {
        expect(missingIdResult._0).toBe('Missing id field');
      }
    });
  });
});
