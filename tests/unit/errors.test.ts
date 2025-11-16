/**
 * Error Handling Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  BaseError,
  ConfigError,
  PathError,
  MemoryError,
  ProviderError,
  AgentError,
  ValidationError,
  toBaseError,
  isOperationalError
} from '../../src/utils/errors.js';

describe('Error Hierarchy', () => {
  describe('BaseError', () => {
    it('should create error with code and message', () => {
      const error = new BaseError(
        'Test error',
        ErrorCode.UNKNOWN_ERROR,
        ['Suggestion 1', 'Suggestion 2']
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
      expect(error.isOperational).toBe(true);
    });

    it('should provide formatted message', () => {
      const error = new BaseError(
        'Test error',
        ErrorCode.UNKNOWN_ERROR,
        ['Try this', 'Or this']
      );

      const formatted = error.getFormattedMessage();

      expect(formatted).toContain('[E9999]');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Suggestions:');
      expect(formatted).toContain('1. Try this');
      expect(formatted).toContain('2. Or this');
    });

    it('should convert to JSON', () => {
      const error = new BaseError(
        'Test error',
        ErrorCode.UNKNOWN_ERROR,
        ['Suggestion'],
        { key: 'value' }
      );

      const json = error.toJSON();

      expect(json.name).toBe('BaseError');
      expect(json.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(json.message).toBe('Test error');
      expect(json.suggestions).toEqual(['Suggestion']);
      expect(json.context).toEqual({ key: 'value' });
      expect(json.isOperational).toBe(true);
    });

    it('should support non-operational errors', () => {
      const error = new BaseError(
        'Programming error',
        ErrorCode.UNKNOWN_ERROR,
        [],
        undefined,
        false // not operational
      );

      expect(error.isOperational).toBe(false);
    });
  });

  describe('ConfigError', () => {
    it('should create config not found error', () => {
      const error = ConfigError.notFound('/path/to/config.json');

      expect(error).toBeInstanceOf(ConfigError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
      expect(error.message).toContain('/path/to/config.json');
      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.context).toEqual({ path: '/path/to/config.json' });
    });

    it('should create invalid config error', () => {
      const error = ConfigError.invalid('Missing required field');

      expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(error.message).toContain('Missing required field');
    });

    it('should create parse error', () => {
      const parseError = new Error('Unexpected token');
      const error = ConfigError.parseError(parseError, '/path/config.json');

      expect(error.code).toBe(ErrorCode.CONFIG_PARSE_ERROR);
      expect(error.message).toContain('Unexpected token');
      expect(error.context).toHaveProperty('originalError');
    });
  });

  describe('PathError', () => {
    it('should create path traversal error', () => {
      const error = PathError.traversal('../../../etc/passwd');

      expect(error.code).toBe(ErrorCode.PATH_TRAVERSAL);
      expect(error.message).toContain('../../../etc/passwd');
      expect(error.isOperational).toBe(false); // Security error
    });

    it('should create path not found error', () => {
      const error = PathError.notFound('/path/to/file', 'Agent');

      expect(error.code).toBe(ErrorCode.PATH_NOT_FOUND);
      expect(error.message).toContain('Agent not found');
      expect(error.context).toEqual({ path: '/path/to/file', type: 'Agent' });
    });
  });

  describe('MemoryError', () => {
    it('should create not initialized error', () => {
      const error = MemoryError.notInitialized();

      expect(error.code).toBe(ErrorCode.MEMORY_NOT_INITIALIZED);
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it('should create embedding error', () => {
      const error = MemoryError.embeddingError('API key missing');

      expect(error.code).toBe(ErrorCode.MEMORY_EMBEDDING_ERROR);
      expect(error.message).toContain('API key missing');
      expect(error.suggestions.some(s => s.includes('OPENAI_API_KEY'))).toBe(true);
    });

    it('should create query error', () => {
      const queryError = new Error('Database locked');
      const error = MemoryError.queryError('SELECT * FROM memories', queryError);

      expect(error.code).toBe(ErrorCode.MEMORY_QUERY_ERROR);
      expect(error.context).toHaveProperty('query');
      expect(error.context).toHaveProperty('originalError');
    });
  });

  describe('ProviderError', () => {
    it('should create provider not found error', () => {
      const error = ProviderError.notFound('claude');

      expect(error.code).toBe(ErrorCode.PROVIDER_NOT_FOUND);
      expect(error.message).toContain('claude');
    });

    it('should create provider unavailable error', () => {
      const error = ProviderError.unavailable('gemini', 'CLI not found');

      expect(error.code).toBe(ErrorCode.PROVIDER_UNAVAILABLE);
      expect(error.message).toContain('gemini');
      expect(error.message).toContain('CLI not found');
    });

    it('should create timeout error', () => {
      const error = ProviderError.timeout('claude', 30000);

      expect(error.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
      expect(error.message).toContain('30000');
      expect(error.suggestions.some(s => s.includes('timeout'))).toBe(true);
    });

    it('should create no available providers error', () => {
      const error = ProviderError.noAvailableProviders();

      expect(error.code).toBe(ErrorCode.PROVIDER_NO_AVAILABLE);
      expect(error.suggestions.some(s => s.includes('Install'))).toBe(true);
    });

    it('should create execution error', () => {
      const execError = new Error('spawn ENOENT');
      const error = ProviderError.executionError('claude', execError);

      expect(error.code).toBe(ErrorCode.PROVIDER_EXEC_ERROR);
      expect(error.context).toHaveProperty('originalError');
    });
  });

  describe('AgentError', () => {
    it('should create profile not found error', () => {
      const error = AgentError.profileNotFound('my-agent');

      expect(error.code).toBe(ErrorCode.AGENT_PROFILE_NOT_FOUND);
      expect(error.message).toContain('my-agent');
      expect(error.suggestions.some(s => s.includes('list'))).toBe(true);
    });

    it('should create profile invalid error', () => {
      const error = AgentError.profileInvalid('my-agent', 'Missing provider field');

      expect(error.code).toBe(ErrorCode.AGENT_PROFILE_INVALID);
      expect(error.message).toContain('Missing provider field');
    });

    it('should create ability not found error', () => {
      const error = AgentError.abilityNotFound('coding', 'my-agent');

      expect(error.code).toBe(ErrorCode.AGENT_ABILITY_NOT_FOUND);
      expect(error.message).toContain('coding');
      expect(error.message).toContain('my-agent');
    });

    it('should create execution error', () => {
      const execError = new Error('Provider failed');
      const error = AgentError.executionError('my-agent', execError);

      expect(error.code).toBe(ErrorCode.AGENT_EXECUTION_ERROR);
      expect(error.context).toHaveProperty('originalError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation failed error', () => {
      const error = ValidationError.failed('email', 'Invalid format');

      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.message).toContain('email');
      expect(error.message).toContain('Invalid format');
    });

    it('should create type error', () => {
      const error = ValidationError.typeError('age', 'number', 'string');

      expect(error.code).toBe(ErrorCode.VALIDATION_TYPE_ERROR);
      expect(error.message).toContain('number');
      expect(error.message).toContain('string');
    });
  });

  describe('Utility Functions', () => {
    it('should convert Error to BaseError', () => {
      const normalError = new Error('Something went wrong');
      const baseError = toBaseError(normalError);

      expect(baseError).toBeInstanceOf(BaseError);
      expect(baseError.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(baseError.message).toBe('Something went wrong');
    });

    it('should pass through BaseError unchanged', () => {
      const original = new BaseError('Test', ErrorCode.CONFIG_INVALID);
      const converted = toBaseError(original);

      expect(converted).toBe(original);
    });

    it('should convert non-Error values', () => {
      const baseError = toBaseError('String error');

      expect(baseError).toBeInstanceOf(BaseError);
      expect(baseError.message).toBe('String error');
    });

    it('should identify operational errors', () => {
      const operational = new BaseError('Test', ErrorCode.CONFIG_INVALID, [], undefined, true);
      const programming = new BaseError('Test', ErrorCode.UNKNOWN_ERROR, [], undefined, false);

      expect(isOperationalError(operational)).toBe(true);
      expect(isOperationalError(programming)).toBe(false);
      expect(isOperationalError(new Error('normal'))).toBe(false);
    });
  });

  describe('Error Codes', () => {
    it('should have unique error codes', () => {
      const codes = Object.values(ErrorCode);
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should use standard error code format', () => {
      const codes = Object.values(ErrorCode);

      codes.forEach(code => {
        expect(code).toMatch(/^E\d{4}$/);
      });
    });

    it('should group error codes by category', () => {
      // Config errors: 1000-1099
      expect(ErrorCode.CONFIG_NOT_FOUND).toBe('E1000');
      expect(ErrorCode.CONFIG_INVALID).toBe('E1001');

      // Path errors: 1100-1199
      expect(ErrorCode.PATH_TRAVERSAL).toBe('E1100');

      // Memory errors: 1200-1299
      expect(ErrorCode.MEMORY_NOT_INITIALIZED).toBe('E1200');

      // Provider errors: 1300-1399
      expect(ErrorCode.PROVIDER_NOT_FOUND).toBe('E1300');

      // Agent errors: 1400-1499
      expect(ErrorCode.AGENT_PROFILE_NOT_FOUND).toBe('E1400');

      // Validation errors: 1500-1599
      expect(ErrorCode.VALIDATION_FAILED).toBe('E1500');

      // File errors: 1600-1699
      expect(ErrorCode.FILE_NOT_FOUND).toBe('E1600');

      // CLI errors: 1700-1799
      expect(ErrorCode.CLI_INVALID_COMMAND).toBe('E1700');

      // Unknown: 9999
      expect(ErrorCode.UNKNOWN_ERROR).toBe('E9999');
    });
  });
});
