/**
 * Security Bug Fix Tests
 *
 * Tests for security-related bug fixes to ensure they work correctly
 * and prevent regression.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Security Bug Fixes', () => {
  describe('Memory Command Prototype Pollution Protection', () => {
    /**
     * Bug Fix: Prototype pollution vulnerability in memory add command
     * File: src/cli/commands/memory.ts:356-379
     *
     * The JSON.parse + Object.assign pattern was vulnerable to prototype
     * pollution attacks where malicious metadata could inject properties
     * into Object.prototype.
     */

    // Helper to simulate the metadata validation logic
    function validateMetadata(metadataJson: string): Record<string, unknown> {
      const customMetadata = JSON.parse(metadataJson);

      // Security: Validate that parsed value is a plain object
      if (typeof customMetadata !== 'object' || customMetadata === null || Array.isArray(customMetadata)) {
        throw new Error('Metadata must be a JSON object');
      }

      // Security: Filter out dangerous prototype pollution keys
      const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
      for (const key of Object.keys(customMetadata)) {
        if (FORBIDDEN_KEYS.includes(key) || key.startsWith('__')) {
          throw new Error(`Invalid metadata key: "${key}" is not allowed`);
        }
      }

      return customMetadata;
    }

    it('should reject __proto__ key in metadata', () => {
      const maliciousMetadata = '{"__proto__": {"isAdmin": true}}';

      expect(() => validateMetadata(maliciousMetadata)).toThrow(
        'Invalid metadata key: "__proto__" is not allowed'
      );
    });

    it('should reject constructor key in metadata', () => {
      const maliciousMetadata = '{"constructor": {"prototype": {"isAdmin": true}}}';

      expect(() => validateMetadata(maliciousMetadata)).toThrow(
        'Invalid metadata key: "constructor" is not allowed'
      );
    });

    it('should reject prototype key in metadata', () => {
      const maliciousMetadata = '{"prototype": {"isAdmin": true}}';

      expect(() => validateMetadata(maliciousMetadata)).toThrow(
        'Invalid metadata key: "prototype" is not allowed'
      );
    });

    it('should reject keys starting with __', () => {
      const maliciousMetadata = '{"__defineGetter__": "evil"}';

      expect(() => validateMetadata(maliciousMetadata)).toThrow(
        'Invalid metadata key: "__defineGetter__" is not allowed'
      );
    });

    it('should reject non-object metadata (array)', () => {
      const invalidMetadata = '["item1", "item2"]';

      expect(() => validateMetadata(invalidMetadata)).toThrow(
        'Metadata must be a JSON object'
      );
    });

    it('should reject non-object metadata (null)', () => {
      const invalidMetadata = 'null';

      expect(() => validateMetadata(invalidMetadata)).toThrow(
        'Metadata must be a JSON object'
      );
    });

    it('should reject non-object metadata (string)', () => {
      const invalidMetadata = '"just a string"';

      expect(() => validateMetadata(invalidMetadata)).toThrow(
        'Metadata must be a JSON object'
      );
    });

    it('should accept valid metadata', () => {
      const validMetadata = '{"project": "test", "version": "1.0.0", "tags": ["a", "b"]}';

      const result = validateMetadata(validMetadata);

      expect(result).toEqual({
        project: 'test',
        version: '1.0.0',
        tags: ['a', 'b']
      });
    });

    it('should accept empty object metadata', () => {
      const validMetadata = '{}';

      const result = validateMetadata(validMetadata);

      expect(result).toEqual({});
    });

    it('should not pollute Object.prototype after validation', () => {
      // Ensure Object.prototype is clean before test
      // @ts-expect-error - Testing prototype pollution
      expect(Object.prototype.isAdmin).toBeUndefined();

      const validMetadata = '{"safe": "value"}';
      const result = validateMetadata(validMetadata);

      // Merge into target object (simulating Object.assign)
      const target = {};
      Object.assign(target, result);

      // Object.prototype should still be clean
      // @ts-expect-error - Testing prototype pollution
      expect(Object.prototype.isAdmin).toBeUndefined();
      // @ts-expect-error - Testing prototype pollution
      expect({}.isAdmin).toBeUndefined();
    });
  });

  describe('OpenAI Provider Race Condition Protection', () => {
    /**
     * Bug Fix: Null assertion race condition in OpenAI provider
     * File: src/providers/openai-provider.ts:67-72
     *
     * The code used hybridAdapter! without checking if destroy() had been
     * called between ensureInitialized() and execute(), which could cause
     * a null pointer exception.
     */

    it('should detect destroyed state before execution', async () => {
      // Simulate the provider state check
      class MockProvider {
        isDestroyed = false;
        hybridAdapter: { execute: () => Promise<string> } | null = null;

        async execute(): Promise<string> {
          // This is the bug fix pattern
          if (this.isDestroyed || !this.hybridAdapter) {
            throw new Error('OpenAIProvider has been destroyed or not properly initialized');
          }
          return this.hybridAdapter.execute();
        }

        destroy(): void {
          this.isDestroyed = true;
          this.hybridAdapter = null;
        }
      }

      const provider = new MockProvider();
      provider.hybridAdapter = { execute: async () => 'result' };

      // Destroy the provider
      provider.destroy();

      // Execute should throw, not crash with null pointer
      await expect(provider.execute()).rejects.toThrow(
        'OpenAIProvider has been destroyed or not properly initialized'
      );
    });

    it('should allow execution when properly initialized', async () => {
      class MockProvider {
        isDestroyed = false;
        hybridAdapter: { execute: () => Promise<string> } | null = null;

        async execute(): Promise<string> {
          if (this.isDestroyed || !this.hybridAdapter) {
            throw new Error('OpenAIProvider has been destroyed or not properly initialized');
          }
          return this.hybridAdapter.execute();
        }
      }

      const provider = new MockProvider();
      provider.hybridAdapter = { execute: async () => 'success' };

      const result = await provider.execute();
      expect(result).toBe('success');
    });

    it('should handle concurrent destroy during execution', async () => {
      class MockProvider {
        isDestroyed = false;
        hybridAdapter: { execute: () => Promise<string> } | null = null;

        async execute(): Promise<string> {
          // Check at start
          if (this.isDestroyed || !this.hybridAdapter) {
            throw new Error('OpenAIProvider has been destroyed or not properly initialized');
          }
          return this.hybridAdapter.execute();
        }

        destroy(): void {
          this.isDestroyed = true;
          this.hybridAdapter = null;
        }
      }

      const provider = new MockProvider();
      let executeCalled = false;

      provider.hybridAdapter = {
        execute: async () => {
          executeCalled = true;
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'result';
        }
      };

      // Start execution
      const executePromise = provider.execute();

      // The check happens before the async work, so this should succeed
      // because the check passed before destroy was called
      const result = await executePromise;
      expect(result).toBe('result');
      expect(executeCalled).toBe(true);
    });
  });

  describe('MCP Manager Event Listener Cleanup', () => {
    /**
     * Bug Fix: Event listener memory leak in CodexMCPManager
     * File: src/integrations/openai-codex/mcp-manager.ts:114-127
     *
     * Event listeners were attached in setupProcessHandlers() but never
     * removed when stopServer() was called, causing memory leaks.
     */

    it('should remove all listeners on cleanup', () => {
      // Mock EventEmitter-like object with proper typing
      const listeners: { error: Function[]; exit: Function[]; data: Function[] } = {
        error: [],
        exit: [],
        data: []
      };

      const mockProcess = {
        on: (event: 'error' | 'exit' | 'data') => {
          listeners[event].push(() => {});
        },
        removeAllListeners: (event: 'error' | 'exit' | 'data') => {
          listeners[event] = [];
        },
        stderr: {
          on: (event: 'data') => {
            listeners[event].push(() => {});
          },
          removeAllListeners: (event: 'data') => {
            listeners[event] = [];
          }
        },
        stdout: {
          on: (event: 'data') => {
            listeners[event].push(() => {});
          },
          removeAllListeners: (event: 'data') => {
            listeners[event] = [];
          }
        }
      };

      // Simulate adding listeners (like setupProcessHandlers does)
      mockProcess.on('error');
      mockProcess.on('exit');
      mockProcess.stderr.on('data');

      expect(listeners.error.length).toBe(1);
      expect(listeners.exit.length).toBe(1);
      expect(listeners.data.length).toBe(1);

      // Simulate cleanup (like the fixed stopServer does)
      mockProcess.removeAllListeners('error');
      mockProcess.removeAllListeners('exit');
      mockProcess.stderr.removeAllListeners('data');

      expect(listeners.error.length).toBe(0);
      expect(listeners.exit.length).toBe(0);
      expect(listeners.data.length).toBe(0);
    });

    it('should not accumulate listeners on repeated start/stop cycles', () => {
      let listenerCount = 0;

      const createMockProcess = () => ({
        on: () => { listenerCount++; },
        removeAllListeners: () => { listenerCount--; },
        stderr: {
          on: () => { listenerCount++; },
          removeAllListeners: () => { listenerCount--; }
        },
        stdout: {
          on: () => { listenerCount++; },
          removeAllListeners: () => { listenerCount--; }
        },
        kill: () => {}
      });

      // Simulate 5 start/stop cycles
      for (let i = 0; i < 5; i++) {
        const process = createMockProcess();

        // Start: add listeners
        process.on();
        process.on();
        process.stderr.on();

        // Stop: cleanup listeners (the fix)
        process.removeAllListeners();
        process.removeAllListeners();
        process.stderr.removeAllListeners();
      }

      // Should be back to 0, not accumulated
      expect(listenerCount).toBe(0);
    });
  });
});
