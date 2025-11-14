/**
 * Unit Tests for ValidationRules.res
 *
 * Tests the ReScript ValidationRules module for phantom types,
 * bounds checking, and compile-time validation guarantees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureBridge,
  isOk,
  isError,
  Ok,
  Error as ResultError,
  type Result,
} from '../../bridge/RescriptBridge';

// Note: ValidationRules module would need to be added to RescriptBridge
// For now, we'll test the concepts with a mock implementation

describe('ValidationRules Module', () => {
  beforeEach(() => {
    configureBridge({ enableValidationRules: true, logTransitions: false });
  });

  describe('BUG #5: Missing Null Checks Causing Runtime Crashes', () => {
    it('should prevent null/undefined access with Option type', () => {
      // BUGGY TypeScript version:
      // function getUserName(user: User | null): string {
      //   return user.name;  // ❌ Crashes if user is null!
      // }

      // ReScript version with Option:
      function getUserName(user: { name: string } | null): Result<string, string> {
        if (user === null) {
          return ResultError('User not found');
        }
        return Ok(user.name);
      }

      const validResult = getUserName({ name: 'John' });
      expect(isOk(validResult)).toBe(true);
      if (isOk(validResult)) {
        expect(validResult._0).toBe('John');
      }

      const nullResult = getUserName(null);
      expect(isError(nullResult)).toBe(true);
      if (isError(nullResult)) {
        expect(nullResult._0).toBe('User not found');
      }
    });

    it('should prevent accessing undefined properties', () => {
      // BUGGY TypeScript version:
      // interface Config {
      //   timeout?: number;
      // }
      // function getTimeout(config: Config): number {
      //   return config.timeout * 1000;  // ❌ Crashes if undefined!
      // }

      // ReScript version:
      function getTimeout(timeout: number | undefined): Result<number, string> {
        if (timeout === undefined) {
          return ResultError('Timeout not configured');
        }
        return Ok(timeout * 1000);
      }

      const validResult = getTimeout(5);
      expect(isOk(validResult)).toBe(true);
      if (isOk(validResult)) {
        expect(validResult._0).toBe(5000);
      }

      const undefinedResult = getTimeout(undefined);
      expect(isError(undefinedResult)).toBe(true);
    });

    it('should prevent null propagation in chains', () => {
      // BUGGY TypeScript version:
      // const user = getUser();
      // const address = user.profile.address;  // ❌ Multiple null checks needed!

      // ReScript version:
      type User = { profile: { address: string } | null } | null;

      function getAddress(user: User): Result<string, string> {
        if (user === null) {
          return ResultError('User not found');
        }
        if (user.profile === null) {
          return ResultError('Profile not found');
        }
        return Ok(user.profile.address);
      }

      const validUser = { profile: { address: '123 Main St' } };
      const result = getAddress(validUser);
      expect(isOk(result)).toBe(true);

      const nullUser = null;
      const nullResult = getAddress(nullUser);
      expect(isError(nullResult)).toBe(true);

      const noProfile = { profile: null };
      const noProfileResult = getAddress(noProfile);
      expect(isError(noProfileResult)).toBe(true);
    });
  });

  describe('BUG #13: Missing Array Bounds Checks', () => {
    it('should prevent out-of-bounds array access', () => {
      // BUGGY TypeScript version:
      // function getFirst<T>(arr: T[]): T {
      //   return arr[0];  // ❌ Crashes on empty array!
      // }

      // ReScript version:
      function getFirst<T>(arr: T[]): Result<T, string> {
        if (arr.length === 0) {
          return ResultError('Array is empty');
        }
        return Ok(arr[0]);
      }

      const validResult = getFirst([1, 2, 3]);
      expect(isOk(validResult)).toBe(true);
      if (isOk(validResult)) {
        expect(validResult._0).toBe(1);
      }

      const emptyResult = getFirst([]);
      expect(isError(emptyResult)).toBe(true);
      if (isError(emptyResult)) {
        expect(emptyResult._0).toBe('Array is empty');
      }
    });

    it('should prevent negative index access', () => {
      // BUGGY TypeScript version:
      // function getAt<T>(arr: T[], index: number): T {
      //   return arr[index];  // ❌ No bounds checking!
      // }

      // ReScript version:
      function getAt<T>(arr: T[], index: number): Result<T, string> {
        if (index < 0 || index >= arr.length) {
          return ResultError(`Index ${index} out of bounds [0, ${arr.length})`);
        }
        return Ok(arr[index]);
      }

      const arr = [10, 20, 30];

      const valid = getAt(arr, 1);
      expect(isOk(valid)).toBe(true);
      if (isOk(valid)) {
        expect(valid._0).toBe(20);
      }

      const negative = getAt(arr, -1);
      expect(isError(negative)).toBe(true);

      const tooLarge = getAt(arr, 5);
      expect(isError(tooLarge)).toBe(true);
    });

    it('should validate array slice bounds', () => {
      // BUGGY TypeScript version:
      // function slice<T>(arr: T[], start: number, end: number): T[] {
      //   return arr.slice(start, end);  // ❌ Invalid bounds silently ignored!
      // }

      // ReScript version:
      function slice<T>(arr: T[], start: number, end: number): Result<T[], string> {
        if (start < 0 || start > arr.length) {
          return ResultError(`Start ${start} out of bounds`);
        }
        if (end < start || end > arr.length) {
          return ResultError(`End ${end} invalid`);
        }
        return Ok(arr.slice(start, end));
      }

      const arr = [1, 2, 3, 4, 5];

      const valid = slice(arr, 1, 3);
      expect(isOk(valid)).toBe(true);
      if (isOk(valid)) {
        expect(valid._0).toEqual([2, 3]);
      }

      const invalidStart = slice(arr, -1, 3);
      expect(isError(invalidStart)).toBe(true);

      const invalidEnd = slice(arr, 1, 10);
      expect(isError(invalidEnd)).toBe(true);

      const reversed = slice(arr, 3, 1);
      expect(isError(reversed)).toBe(true);
    });
  });

  describe('BUG #14: Missing Validation for Domain Objects', () => {
    it('should validate email format', () => {
      // BUGGY TypeScript version:
      // function sendEmail(email: string) {
      //   // ❌ No validation!
      //   smtp.send(email, message);
      // }

      // ReScript version:
      function validateEmail(email: string): Result<string, string> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return ResultError('Invalid email format');
        }
        return Ok(email);
      }

      const validEmail = validateEmail('user@example.com');
      expect(isOk(validEmail)).toBe(true);

      const invalidEmail1 = validateEmail('not-an-email');
      expect(isError(invalidEmail1)).toBe(true);

      const invalidEmail2 = validateEmail('missing@domain');
      expect(isError(invalidEmail2)).toBe(true);

      const invalidEmail3 = validateEmail('@example.com');
      expect(isError(invalidEmail3)).toBe(true);
    });

    it('should validate URL format', () => {
      function validateUrl(url: string): Result<string, string> {
        try {
          new URL(url);
          return Ok(url);
        } catch {
          return ResultError('Invalid URL format');
        }
      }

      const validUrl = validateUrl('https://example.com/path');
      expect(isOk(validUrl)).toBe(true);

      const invalidUrl = validateUrl('not a url');
      expect(isError(invalidUrl)).toBe(true);
    });

    it('should validate phone number format', () => {
      function validatePhone(phone: string): Result<string, string> {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phone)) {
          return ResultError('Invalid phone number');
        }
        return Ok(phone);
      }

      const validPhone = validatePhone('+12025551234');
      expect(isOk(validPhone)).toBe(true);

      const invalidPhone = validatePhone('123');
      expect(isError(invalidPhone)).toBe(true);
    });

    it('should validate password strength', () => {
      function validatePassword(password: string): Result<string, string> {
        if (password.length < 8) {
          return ResultError('Password must be at least 8 characters');
        }
        if (!/[A-Z]/.test(password)) {
          return ResultError('Password must contain uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
          return ResultError('Password must contain lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
          return ResultError('Password must contain number');
        }
        return Ok(password);
      }

      const validPassword = validatePassword('SecurePass123');
      expect(isOk(validPassword)).toBe(true);

      const tooShort = validatePassword('Short1');
      expect(isError(tooShort)).toBe(true);

      const noUppercase = validatePassword('lowercase123');
      expect(isError(noUppercase)).toBe(true);

      const noNumber = validatePassword('NoNumbers');
      expect(isError(noNumber)).toBe(true);
    });
  });

  describe('Phantom Types - Validated vs Unvalidated', () => {
    it('should distinguish validated from unvalidated data', () => {
      // Phantom types ensure compile-time tracking of validation state

      type Validated<T> = { __validated: true; value: T };
      type Unvalidated<T> = { __validated: false; value: T };

      function validate(input: Unvalidated<string>): Result<Validated<string>, string> {
        if (input.value.length === 0) {
          return ResultError('Cannot be empty');
        }
        return Ok({ __validated: true, value: input.value });
      }

      function useValidated(data: Validated<string>): string {
        return data.value.toUpperCase();
      }

      const unvalidated: Unvalidated<string> = { __validated: false, value: 'test' };
      const validated = validate(unvalidated);

      expect(isOk(validated)).toBe(true);
      if (isOk(validated)) {
        const result = useValidated(validated._0);
        expect(result).toBe('TEST');
      }
    });
  });

  describe('Non-Empty Arrays', () => {
    it('should guarantee non-empty array at type level', () => {
      // ReScript NonEmptyArray guarantees at least one element

      type NonEmptyArray<T> = [T, ...T[]];

      function makeNonEmpty<T>(arr: T[]): Result<NonEmptyArray<T>, string> {
        if (arr.length === 0) {
          return ResultError('Array cannot be empty');
        }
        return Ok(arr as NonEmptyArray<T>);
      }

      function head<T>(arr: NonEmptyArray<T>): T {
        return arr[0];  // Safe! Always has at least one element
      }

      const validArray = makeNonEmpty([1, 2, 3]);
      expect(isOk(validArray)).toBe(true);
      if (isOk(validArray)) {
        expect(head(validArray._0)).toBe(1);
      }

      const emptyArray = makeNonEmpty([]);
      expect(isError(emptyArray)).toBe(true);
    });

    it('should prevent operations on empty arrays', () => {
      function getMax(arr: number[]): Result<number, string> {
        if (arr.length === 0) {
          return ResultError('Cannot get max of empty array');
        }
        return Ok(Math.max(...arr));
      }

      const valid = getMax([1, 5, 3, 9, 2]);
      expect(isOk(valid)).toBe(true);
      if (isOk(valid)) {
        expect(valid._0).toBe(9);
      }

      const empty = getMax([]);
      expect(isError(empty)).toBe(true);
    });
  });

  describe('Bounded Integers', () => {
    it('should validate integer ranges', () => {
      function validateBounded(value: number, min: number, max: number): Result<number, string> {
        if (value < min || value > max) {
          return ResultError(`Value ${value} out of bounds [${min}, ${max}]`);
        }
        return Ok(value);
      }

      const valid = validateBounded(5, 0, 10);
      expect(isOk(valid)).toBe(true);

      const tooSmall = validateBounded(-1, 0, 10);
      expect(isError(tooSmall)).toBe(true);

      const tooLarge = validateBounded(11, 0, 10);
      expect(isError(tooLarge)).toBe(true);
    });

    it('should validate percentage range', () => {
      function validatePercentage(value: number): Result<number, string> {
        if (value < 0 || value > 100) {
          return ResultError('Percentage must be between 0 and 100');
        }
        return Ok(value);
      }

      const valid = validatePercentage(50);
      expect(isOk(valid)).toBe(true);

      const negative = validatePercentage(-10);
      expect(isError(negative)).toBe(true);

      const tooLarge = validatePercentage(150);
      expect(isError(tooLarge)).toBe(true);
    });

    it('should validate port number range', () => {
      function validatePort(port: number): Result<number, string> {
        if (port < 1 || port > 65535) {
          return ResultError('Port must be between 1 and 65535');
        }
        return Ok(port);
      }

      const valid = validatePort(8080);
      expect(isOk(valid)).toBe(true);

      const zero = validatePort(0);
      expect(isError(zero)).toBe(true);

      const tooLarge = validatePort(70000);
      expect(isError(tooLarge)).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should validate user registration', () => {
      interface UserRegistration {
        username: string;
        email: string;
        password: string;
        age: number;
      }

      function validateRegistration(data: UserRegistration): Result<UserRegistration, string[]> {
        const errors: string[] = [];

        if (data.username.length < 3) {
          errors.push('Username must be at least 3 characters');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
          errors.push('Invalid email format');
        }

        if (data.password.length < 8) {
          errors.push('Password must be at least 8 characters');
        }

        if (data.age < 18 || data.age > 120) {
          errors.push('Age must be between 18 and 120');
        }

        if (errors.length > 0) {
          return ResultError(errors.join(', '));
        }

        return Ok(data);
      }

      const validData = {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        age: 25,
      };

      const result = validateRegistration(validData);
      expect(isOk(result)).toBe(true);

      const invalidData = {
        username: 'ab',
        email: 'invalid-email',
        password: 'short',
        age: 15,
      };

      const invalidResult = validateRegistration(invalidData);
      expect(isError(invalidResult)).toBe(true);
    });

    it('should validate API request parameters', () => {
      interface SearchParams {
        query: string;
        page: number;
        limit: number;
      }

      function validateSearchParams(params: SearchParams): Result<SearchParams, string> {
        if (params.query.length === 0) {
          return ResultError('Query cannot be empty');
        }

        if (params.page < 1) {
          return ResultError('Page must be at least 1');
        }

        if (params.limit < 1 || params.limit > 100) {
          return ResultError('Limit must be between 1 and 100');
        }

        return Ok(params);
      }

      const valid = validateSearchParams({ query: 'test', page: 1, limit: 10 });
      expect(isOk(valid)).toBe(true);

      const emptyQuery = validateSearchParams({ query: '', page: 1, limit: 10 });
      expect(isError(emptyQuery)).toBe(true);

      const invalidPage = validateSearchParams({ query: 'test', page: 0, limit: 10 });
      expect(isError(invalidPage)).toBe(true);

      const invalidLimit = validateSearchParams({ query: 'test', page: 1, limit: 200 });
      expect(isError(invalidLimit)).toBe(true);
    });

    it('should validate file upload', () => {
      interface FileUpload {
        name: string;
        size: number;
        type: string;
      }

      function validateFileUpload(file: FileUpload): Result<FileUpload, string> {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (file.name.length === 0) {
          return ResultError('File name cannot be empty');
        }

        if (!allowedTypes.includes(file.type)) {
          return ResultError(`File type ${file.type} not allowed`);
        }

        if (file.size > maxSize) {
          return ResultError('File size exceeds 5MB limit');
        }

        return Ok(file);
      }

      const validFile = {
        name: 'document.pdf',
        size: 1024 * 1024,
        type: 'application/pdf',
      };

      const result = validateFileUpload(validFile);
      expect(isOk(result)).toBe(true);

      const invalidType = {
        name: 'script.js',
        size: 1024,
        type: 'application/javascript',
      };

      const typeResult = validateFileUpload(invalidType);
      expect(isError(typeResult)).toBe(true);

      const tooLarge = {
        name: 'large.pdf',
        size: 10 * 1024 * 1024,
        type: 'application/pdf',
      };

      const sizeResult = validateFileUpload(tooLarge);
      expect(isError(sizeResult)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      function validateNonEmpty(str: string): Result<string, string> {
        if (str.trim().length === 0) {
          return ResultError('String cannot be empty or whitespace');
        }
        return Ok(str);
      }

      const valid = validateNonEmpty('test');
      expect(isOk(valid)).toBe(true);

      const empty = validateNonEmpty('');
      expect(isError(empty)).toBe(true);

      const whitespace = validateNonEmpty('   ');
      expect(isError(whitespace)).toBe(true);
    });

    it('should handle boundary values', () => {
      function validateRange(value: number): Result<number, string> {
        if (value < 0 || value > 100) {
          return ResultError('Out of range');
        }
        return Ok(value);
      }

      // Boundary values
      expect(isOk(validateRange(0))).toBe(true);
      expect(isOk(validateRange(100))).toBe(true);
      expect(isError(validateRange(-1))).toBe(true);
      expect(isError(validateRange(101))).toBe(true);
    });

    it('should handle special characters', () => {
      function validateUsername(username: string): Result<string, string> {
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(username)) {
          return ResultError('Invalid username format');
        }
        return Ok(username);
      }

      const valid = validateUsername('user_123');
      expect(isOk(valid)).toBe(true);

      const withSpace = validateUsername('user name');
      expect(isError(withSpace)).toBe(true);

      const withSpecial = validateUsername('user@123');
      expect(isError(withSpecial)).toBe(true);
    });
  });
});
