/**
 * MCP Validation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validatePathParameter,
  validateAgentName,
  validateStringParameter,
  validateNumberParameter,
  ValidationError
} from '../../../src/mcp/utils/validation.js';

describe('MCP Validation', () => {
  describe('validatePathParameter', () => {
    it('should allow safe relative paths', () => {
      expect(() => validatePathParameter('test.txt', 'testParam')).not.toThrow();
      expect(() => validatePathParameter('folder/test.txt', 'testParam')).not.toThrow();
      expect(() => validatePathParameter('deep/nested/path/file.txt', 'testParam')).not.toThrow();
    });

    it('should reject path traversal attempts', () => {
      expect(() => validatePathParameter('../etc/passwd', 'testParam')).toThrow('dangerous pattern');
      expect(() => validatePathParameter('../../sensitive', 'testParam')).toThrow('dangerous pattern');
      expect(() => validatePathParameter('folder/../../../etc', 'testParam')).toThrow();
    });

    it('should reject absolute paths', () => {
      expect(() => validatePathParameter('/absolute/path', 'testParam')).toThrow('absolute path');
      expect(() => validatePathParameter('/foo/bar/baz', 'testParam')).toThrow('absolute path');
    });

    it('should reject home directory access', () => {
      expect(() => validatePathParameter('~/secret', 'testParam')).toThrow('dangerous pattern');
      expect(() => validatePathParameter('~/.ssh/id_rsa', 'testParam')).toThrow('dangerous pattern');
    });

    it('should reject null bytes', () => {
      expect(() => validatePathParameter('file\0.txt', 'testParam')).toThrow('null byte');
      expect(() => validatePathParameter('test\x00', 'testParam')).toThrow('null byte');
    });

    it('should reject empty paths', () => {
      expect(() => validatePathParameter('', 'testParam')).toThrow('cannot be empty');
      expect(() => validatePathParameter('   ', 'testParam')).toThrow('cannot be empty');
    });

    it('should reject suspicious characters', () => {
      expect(() => validatePathParameter('file<test.txt', 'testParam')).toThrow('invalid characters');
      expect(() => validatePathParameter('file>test.txt', 'testParam')).toThrow('invalid characters');
      expect(() => validatePathParameter('file|test.txt', 'testParam')).toThrow('invalid characters');
    });

    it('should throw ValidationError instances', () => {
      try {
        validatePathParameter('../etc/passwd', 'testParam');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).code).toBeDefined();
      }
    });
  });

  describe('validateAgentName', () => {
    it('should allow valid agent names', () => {
      expect(() => validateAgentName('backend')).not.toThrow();
      expect(() => validateAgentName('frontend')).not.toThrow();
      expect(() => validateAgentName('qa-specialist')).not.toThrow();
      expect(() => validateAgentName('my_agent')).not.toThrow();
      expect(() => validateAgentName('Agent123')).not.toThrow();
    });

    it('should reject path traversal in agent names', () => {
      // Pattern check implicitly rejects path traversal (.., /, \)
      expect(() => validateAgentName('../../../etc/passwd')).toThrow('must contain only');
      expect(() => validateAgentName('../../config')).toThrow('must contain only');
    });

    it('should reject paths with directory separators', () => {
      // Pattern check implicitly rejects directory separators
      expect(() => validateAgentName('folder/agent')).toThrow('must contain only');
      expect(() => validateAgentName('path\\to\\agent')).toThrow('must contain only');
    });

    it('should reject empty names', () => {
      expect(() => validateAgentName('')).toThrow('cannot be empty');
      expect(() => validateAgentName('   ')).toThrow('cannot be empty');
    });

    it('should reject names with special characters', () => {
      expect(() => validateAgentName('agent;rm')).toThrow('must contain only letters');
      expect(() => validateAgentName('agent&malicious')).toThrow('must contain only letters');
      expect(() => validateAgentName('agent|cat')).toThrow('must contain only letters');
      expect(() => validateAgentName('agent with spaces')).toThrow('must contain only letters');
    });

    it('should reject excessively long names', () => {
      const longName = 'a'.repeat(101);
      expect(() => validateAgentName(longName)).toThrow('name too long');
    });
  });

  describe('validateStringParameter', () => {
    it('should allow valid strings', () => {
      expect(() => validateStringParameter('test', 'param')).not.toThrow();
      expect(() => validateStringParameter('', 'param', { required: false })).not.toThrow();
    });

    it('should reject empty required strings', () => {
      expect(() => validateStringParameter('', 'param', { required: true })).toThrow('is required');
      expect(() => validateStringParameter('   ', 'param', { required: true })).toThrow('is required');
    });

    it('should enforce minimum length', () => {
      expect(() => validateStringParameter('ab', 'param', { minLength: 3 })).toThrow('too short');
      expect(() => validateStringParameter('abc', 'param', { minLength: 3 })).not.toThrow();
    });

    it('should enforce maximum length', () => {
      expect(() => validateStringParameter('abcd', 'param', { maxLength: 3 })).toThrow('too long');
      expect(() => validateStringParameter('abc', 'param', { maxLength: 3 })).not.toThrow();
    });

    it('should enforce pattern matching', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(() => validateStringParameter('invalid', 'email', { pattern: emailPattern }))
        .toThrow('does not match required pattern');
      expect(() => validateStringParameter('test@example.com', 'email', { pattern: emailPattern }))
        .not.toThrow();
    });
  });

  describe('validateNumberParameter', () => {
    it('should allow valid numbers', () => {
      expect(() => validateNumberParameter(5, 'param')).not.toThrow();
      expect(() => validateNumberParameter(0, 'param')).not.toThrow();
      expect(() => validateNumberParameter(-5, 'param')).not.toThrow();
      expect(() => validateNumberParameter(3.14, 'param')).not.toThrow();
    });

    it('should reject non-numbers', () => {
      expect(() => validateNumberParameter(NaN, 'param')).toThrow('must be a number');
      expect(() => validateNumberParameter('5' as unknown as number, 'param')).toThrow('must be a number');
    });

    it('should enforce integer requirement', () => {
      expect(() => validateNumberParameter(3.14, 'param', { integer: true })).toThrow('must be an integer');
      expect(() => validateNumberParameter(5, 'param', { integer: true })).not.toThrow();
    });

    it('should enforce minimum value', () => {
      expect(() => validateNumberParameter(4, 'param', { min: 5 })).toThrow('too small');
      expect(() => validateNumberParameter(5, 'param', { min: 5 })).not.toThrow();
      expect(() => validateNumberParameter(6, 'param', { min: 5 })).not.toThrow();
    });

    it('should enforce maximum value', () => {
      expect(() => validateNumberParameter(11, 'param', { max: 10 })).toThrow('too large');
      expect(() => validateNumberParameter(10, 'param', { max: 10 })).not.toThrow();
      expect(() => validateNumberParameter(9, 'param', { max: 10 })).not.toThrow();
    });

    it('should enforce both min and max', () => {
      expect(() => validateNumberParameter(5, 'param', { min: 1, max: 10 })).not.toThrow();
      expect(() => validateNumberParameter(0, 'param', { min: 1, max: 10 })).toThrow('too small');
      expect(() => validateNumberParameter(11, 'param', { min: 1, max: 10 })).toThrow('too large');
    });
  });
});
