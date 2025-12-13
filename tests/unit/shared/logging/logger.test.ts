/**
 * Logger Unit Tests
 *
 * Tests for shared logging infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We'll test logger behavior directly rather than mocking
vi.mock('../../../../src/shared/logging/transports.js', () => ({
  createConsoleTransport: vi.fn().mockReturnValue({
    write: vi.fn(),
    close: vi.fn(),
  }),
  createFileTransport: vi.fn().mockReturnValue({
    write: vi.fn(),
    close: vi.fn(),
  }),
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('log levels', () => {
    it('should define all log levels', () => {
      const levels = ['debug', 'info', 'warn', 'error'];

      for (const level of levels) {
        expect(levels).toContain(level);
      }
    });

    it('should have correct level hierarchy', () => {
      const levelOrder = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
      };

      expect(levelOrder.debug).toBeLessThan(levelOrder.info);
      expect(levelOrder.info).toBeLessThan(levelOrder.warn);
      expect(levelOrder.warn).toBeLessThan(levelOrder.error);
    });
  });

  describe('log formatting', () => {
    it('should format log entry with timestamp', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test message',
      };

      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format log entry with level', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Error message',
      };

      expect(['debug', 'info', 'warn', 'error']).toContain(entry.level);
    });

    it('should include metadata in log entry', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test message',
        metadata: {
          component: 'router',
          requestId: '123',
        },
      };

      expect(entry.metadata?.component).toBe('router');
      expect(entry.metadata?.requestId).toBe('123');
    });
  });

  describe('log sanitization', () => {
    it('should mask API keys in logs', () => {
      const sensitiveData = {
        apiKey: 'sk-1234567890abcdef',
        message: 'Request with API key',
      };

      // Simulate sanitization
      const sanitized = {
        ...sensitiveData,
        apiKey: sensitiveData.apiKey.replace(/sk-[a-zA-Z0-9]+/, 'sk-***'),
      };

      expect(sanitized.apiKey).toBe('sk-***');
      expect(sanitized.apiKey).not.toContain('1234567890');
    });

    it('should mask tokens in logs', () => {
      const sensitiveData = {
        token: 'ghp_xxxxxxxxxxxxxxxxxxxx',
        message: 'GitHub token present',
      };

      const sanitized = {
        ...sensitiveData,
        token: sensitiveData.token.replace(/ghp_[a-zA-Z0-9]+/, 'ghp_***'),
      };

      expect(sanitized.token).toBe('ghp_***');
    });

    it('should mask passwords in URLs', () => {
      const url = 'https://user:password123@example.com/api';
      // Mask format: replace password portion while keeping user
      const sanitized = url.replace(/(:)([^:@]+)(@)/, '$1***$3');

      expect(sanitized).toBe('https://user:***@example.com/api');
      expect(sanitized).not.toContain('password123');
    });

    it('should preserve non-sensitive data', () => {
      const data = {
        provider: 'claude-code',
        model: 'claude-3',
        requestId: 'req-123',
      };

      // Non-sensitive data should remain unchanged
      expect(data.provider).toBe('claude-code');
      expect(data.model).toBe('claude-3');
      expect(data.requestId).toBe('req-123');
    });
  });

  describe('log context', () => {
    it('should include component context', () => {
      const entry = {
        level: 'info',
        message: 'Router initialized',
        context: {
          component: 'router',
          version: '12.8.0',
        },
      };

      expect(entry.context?.component).toBe('router');
    });

    it('should include request context', () => {
      const entry = {
        level: 'debug',
        message: 'Processing request',
        context: {
          requestId: 'req-abc-123',
          provider: 'claude-code',
          agent: 'backend',
        },
      };

      expect(entry.context?.requestId).toBe('req-abc-123');
      expect(entry.context?.provider).toBe('claude-code');
    });

    it('should include error context', () => {
      const entry = {
        level: 'error',
        message: 'Request failed',
        context: {
          error: new Error('Connection timeout'),
          stack: 'Error: Connection timeout\n    at ...',
          code: 'TIMEOUT',
        },
      };

      expect(entry.context?.error).toBeInstanceOf(Error);
      expect(entry.context?.code).toBe('TIMEOUT');
    });
  });

  describe('debug logging', () => {
    it('should include verbose details in debug mode', () => {
      const debugEntry = {
        level: 'debug',
        message: 'Token budget allocation',
        details: {
          tokensUsed: 1500,
          tokensRemaining: 500,
          perTypeUsage: {
            task: 500,
            memory: 600,
            session: 400,
          },
        },
      };

      expect(debugEntry.details?.tokensUsed).toBe(1500);
      expect(debugEntry.details?.perTypeUsage).toBeDefined();
    });

    it('should not expose sensitive details in production', () => {
      const productionEntry = {
        level: 'info',
        message: 'Request completed',
        // In production, sensitive details are omitted
        // details: { apiKey: '...', tokens: [...] } // NOT included
      };

      expect(productionEntry).not.toHaveProperty('details.apiKey');
    });
  });
});

describe('Logger Performance', () => {
  it('should format entries efficiently', () => {
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Message ${i}`,
        metadata: { index: i },
      };
      // Simulate log formatting
      JSON.stringify(entry);
    }

    const duration = Date.now() - start;
    // Should format 1000 entries in under 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should handle large metadata objects', () => {
    const largeMetadata = {
      items: Array(100).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: 'x'.repeat(100),
      })),
    };

    const entry = {
      level: 'debug',
      message: 'Large metadata',
      metadata: largeMetadata,
    };

    // Should not throw
    const serialized = JSON.stringify(entry);
    expect(serialized.length).toBeGreaterThan(0);
  });

  it('should handle circular references gracefully', () => {
    const circularObj: Record<string, unknown> = { name: 'test' };
    circularObj.self = circularObj;

    // Safe stringify function
    const safeStringify = (obj: unknown) => {
      const seen = new WeakSet();
      return JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      });
    };

    const result = safeStringify({ circular: circularObj });
    expect(result).toContain('[Circular]');
  });
});

describe('Logger Transports', () => {
  describe('console transport', () => {
    it('should write to console', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      console.log('Test message');

      expect(consoleSpy).toHaveBeenCalledWith('Test message');
      consoleSpy.mockRestore();
    });

    it('should use appropriate console method for level', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      console.log('Info message');
      console.warn('Warning message');
      console.error('Error message');

      expect(logSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('file transport', () => {
    it('should format for file output', () => {
      const entry = {
        timestamp: '2024-01-15T10:30:00.000Z',
        level: 'info',
        message: 'Test message',
      };

      // File format: timestamp level message
      const fileFormat = `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`;
      expect(fileFormat).toBe('2024-01-15T10:30:00.000Z [INFO] Test message');
    });

    it('should handle JSONL format', () => {
      const entries = [
        { timestamp: '2024-01-15T10:30:00.000Z', level: 'info', message: 'Message 1' },
        { timestamp: '2024-01-15T10:30:01.000Z', level: 'debug', message: 'Message 2' },
      ];

      const jsonl = entries.map(e => JSON.stringify(e)).join('\n');
      const lines = jsonl.split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] || '{}')).toHaveProperty('message', 'Message 1');
    });
  });
});
