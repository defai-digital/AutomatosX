/**
 * Logger Sanitization Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleLogger } from '../../src/shared/logging/logger.js';

describe('Logger Sanitization', () => {
  let logger: SimpleLogger;
  let consoleSpy: any;

  beforeEach(() => {
    logger = new SimpleLogger({ level: 'debug', console: true });
    // Logger now outputs to stderr (console.error), not stdout
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should redact password field', () => {
    logger.info('Test log', { username: 'user', password: 'secret123' });

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('secret123');
    expect(logOutput).toContain('user'); // username not sensitive
  });

  it('should redact apiKey field', () => {
    logger.info('API call', { apiKey: 'sk-1234567890', endpoint: '/api/test' });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('sk-1234567890');
    expect(logOutput).toContain('/api/test'); // endpoint not sensitive
  });

  it('should redact multiple sensitive fields', () => {
    logger.info('Auth', {
      username: 'user',
      password: 'pass123',
      token: 'Bearer xyz',
      apiKey: 'key123'
    });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('user');
    expect(logOutput).not.toContain('pass123');
    expect(logOutput).not.toContain('Bearer xyz');
    expect(logOutput).not.toContain('key123');
    expect((logOutput.match(/\[REDACTED\]/g) || []).length).toBe(3);
  });

  it('should redact nested sensitive fields', () => {
    logger.info('Config', {
      database: {
        host: 'localhost',
        password: 'db_secret'
      },
      api: {
        url: 'https://api.example.com',
        apiKey: 'api_secret'
      }
    });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('localhost');
    expect(logOutput).toContain('https://api.example.com');
    expect(logOutput).not.toContain('db_secret');
    expect(logOutput).not.toContain('api_secret');
  });

  it('should handle arrays with sensitive data', () => {
    logger.info('Users', {
      users: [
        { name: 'Alice', password: 'alice123' },
        { name: 'Bob', token: 'bob_token' }
      ]
    });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('Alice');
    expect(logOutput).toContain('Bob');
    expect(logOutput).not.toContain('alice123');
    expect(logOutput).not.toContain('bob_token');
  });

  it('should handle case-insensitive matching', () => {
    logger.info('Test', {
      PASSWORD: 'UPPER',
      ApiKey: 'Mixed',
      secret: 'lower'
    });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).not.toContain('UPPER');
    expect(logOutput).not.toContain('Mixed');
    expect(logOutput).not.toContain('lower');
    expect((logOutput.match(/\[REDACTED\]/g) || []).length).toBe(3);
  });

  it('should not redact non-sensitive fields', () => {
    logger.info('Safe data', {
      userId: 123,
      email: 'user@example.com',
      settings: { theme: 'dark' }
    });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('123');
    expect(logOutput).toContain('user@example.com');
    expect(logOutput).toContain('dark');
    expect(logOutput).not.toContain('[REDACTED]');
  });

  it('should handle null and undefined values', () => {
    logger.info('Null test', {
      value: null,
      missing: undefined,
      password: 'secret'
    });

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('null');
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('secret');
  });

  it('should prevent infinite recursion with max depth', () => {
    const circular: any = { name: 'test', password: 'secret' };
    circular.self = circular;

    // Should not throw
    expect(() => {
      logger.info('Circular test', circular);
    }).not.toThrow();

    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('[REDACTED]'); // password redacted
  });
});
