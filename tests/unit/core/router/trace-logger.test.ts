/**
 * Comprehensive tests for trace-logger.ts
 *
 * Tests for router trace logging functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import type { WriteStream } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn()
}));

import {
  RouterTraceLogger,
  createTraceLogger,
  getGlobalTracer,
  closeGlobalTracer,
  type TraceEvent
} from '../../../../src/core/router/trace-logger.js';

describe('trace-logger', () => {
  let mockStream: Partial<WriteStream>;
  const mockExistsSync = vi.mocked(existsSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockCreateWriteStream = vi.mocked(createWriteStream);

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset process event listeners mock
    vi.spyOn(process, 'on').mockImplementation(() => process);
    vi.spyOn(process, 'removeListener').mockImplementation(() => process);

    // Mock write stream
    mockStream = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      on: vi.fn().mockReturnThis()
    };

    mockCreateWriteStream.mockReturnValue(mockStream as WriteStream);
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up global tracer
    closeGlobalTracer();
  });

  describe('RouterTraceLogger', () => {
    describe('constructor', () => {
      it('should create log directory if it does not exist', () => {
        mockExistsSync.mockReturnValue(false);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        expect(mockMkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('.automatosx/logs'),
          { recursive: true }
        );

        tracer.close();
      });

      it('should not create directory if already exists', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        expect(mockMkdirSync).not.toHaveBeenCalled();

        tracer.close();
      });

      it('should not create directory if disabled', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: false
        });

        expect(mockMkdirSync).not.toHaveBeenCalled();

        tracer.close();
      });

      it('should register process event handlers', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function));
        expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

        tracer.close();
      });

      it('should default enabled to true', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace'
        });

        // Should be able to log (enabled by default)
        tracer.log({
          timestamp: new Date().toISOString(),
          phase: 'selection',
          data: {}
        });

        expect(mockCreateWriteStream).toHaveBeenCalled();

        tracer.close();
      });
    });

    describe('log', () => {
      it('should write event to stream as JSONL', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        const event: TraceEvent = {
          timestamp: '2024-01-01T00:00:00.000Z',
          phase: 'selection',
          provider: 'openai',
          data: { test: true }
        };

        tracer.log(event);

        expect(mockStream.write).toHaveBeenCalledWith(
          JSON.stringify(event) + '\n'
        );

        tracer.close();
      });

      it('should not write when disabled', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: false
        });

        tracer.log({
          timestamp: new Date().toISOString(),
          phase: 'selection',
          data: {}
        });

        expect(mockCreateWriteStream).not.toHaveBeenCalled();

        tracer.close();
      });

      it('should auto-flush when enabled', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: true
        });

        tracer.log({
          timestamp: new Date().toISOString(),
          phase: 'selection',
          data: {}
        });

        // Should have write called twice (once for data, once for flush)
        expect(mockStream.write).toHaveBeenCalledTimes(2);

        tracer.close();
      });

      it('should handle write errors gracefully', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        // First call creates stream, second call throws
        mockStream.write = vi.fn().mockImplementation(() => {
          throw new Error('Write failed');
        });

        // Should not throw
        expect(() => {
          tracer.log({
            timestamp: new Date().toISOString(),
            phase: 'selection',
            data: {}
          });
        }).not.toThrow();

        tracer.close();
      });
    });

    describe('logSelection', () => {
      it('should log provider selection event', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logSelection(
          ['openai', 'gemini', 'claude'],
          'openai',
          'lowest cost',
          { openai: 0.9, gemini: 0.8, claude: 0.7 }
        );

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"phase":"selection"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"provider":"openai"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"reason":"lowest cost"')
        );

        tracer.close();
      });

      it('should include spec context when provided', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logSelection(
          ['openai'],
          'openai',
          'policy match',
          undefined,
          { specId: 'spec-123', taskId: 'task-456' }
        );

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"specId":"spec-123"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"taskId":"task-456"')
        );

        tracer.close();
      });
    });

    describe('logPolicySelection', () => {
      it('should log policy-based selection event', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logPolicySelection(
          { goal: 'minimize_cost', constraints: { maxLatency: 5000 } },
          {
            passed: ['openai', 'gemini'],
            filtered: [{ provider: 'claude', reason: 'too expensive' }]
          },
          'openai'
        );

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"phase":"policy"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"goal":"minimize_cost"')
        );

        tracer.close();
      });

      it('should handle null selected provider', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logPolicySelection(
          { goal: 'test' },
          { passed: [], filtered: [] },
          null
        );

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"selected":null')
        );

        tracer.close();
      });
    });

    describe('logExecution', () => {
      it('should log execution event with metrics', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logExecution('openai', true, 1500, 0.005, {
          prompt: 100,
          completion: 50,
          total: 150
        });

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"phase":"execution"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"success":true')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"durationMs":1500')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"latencyBucket":"1s-2s"')
        );

        tracer.close();
      });

      it('should categorize latency buckets correctly', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        // Test different latency buckets
        const testCases = [
          { duration: 100, bucket: '<500ms' },
          { duration: 700, bucket: '500ms-1s' },
          { duration: 1500, bucket: '1s-2s' },
          { duration: 3000, bucket: '2s-5s' },
          { duration: 10000, bucket: '>5s' }
        ];

        for (const { duration, bucket } of testCases) {
          vi.clearAllMocks();
          mockCreateWriteStream.mockReturnValue(mockStream as WriteStream);

          tracer.logExecution('openai', true, duration, 0.001);

          expect(mockStream.write).toHaveBeenCalledWith(
            expect.stringContaining(`"latencyBucket":"${bucket}"`)
          );
        }

        tracer.close();
      });
    });

    describe('logDegradation', () => {
      it('should log degradation event', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logDegradation('rate limit', 'switched', 'openai', 'gemini');

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"phase":"degradation"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"reason":"rate limit"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"fromProvider":"openai"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"toProvider":"gemini"')
        );

        tracer.close();
      });

      it('should handle no toProvider', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logDegradation('error', 'failed', 'openai');

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"toProvider":null')
        );

        tracer.close();
      });
    });

    describe('logError', () => {
      it('should log error event with Error object', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        const error = new Error('Test error');
        tracer.logError(error, 'openai', { attempt: 3 });

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"phase":"error"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"error":"Test error"')
        );
        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"provider":"openai"')
        );

        tracer.close();
      });

      it('should log error event with string error', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true,
          autoFlush: false
        });

        tracer.logError('String error message');

        expect(mockStream.write).toHaveBeenCalledWith(
          expect.stringContaining('"error":"String error message"')
        );

        tracer.close();
      });
    });

    describe('close', () => {
      it('should remove process event listeners', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        tracer.close();

        expect(process.removeListener).toHaveBeenCalledWith('exit', expect.any(Function));
        expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(process.removeListener).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      });

      it('should end stream if open', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        // Trigger stream creation
        tracer.log({ timestamp: '', phase: 'selection', data: {} });

        tracer.close();

        expect(mockStream.end).toHaveBeenCalled();
      });

      it('should handle close when stream not created', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: false
        });

        // Should not throw
        expect(() => tracer.close()).not.toThrow();
      });
    });

    describe('setEnabled', () => {
      it('should enable tracing', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: false
        });

        tracer.setEnabled(true);

        // Now logging should work
        tracer.log({ timestamp: '', phase: 'selection', data: {} });

        expect(mockCreateWriteStream).toHaveBeenCalled();

        tracer.close();
      });

      it('should disable tracing and close stream', () => {
        mockExistsSync.mockReturnValue(true);

        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        // Create stream
        tracer.log({ timestamp: '', phase: 'selection', data: {} });

        tracer.setEnabled(false);

        expect(mockStream.end).toHaveBeenCalled();
      });
    });

    describe('getTraceFile', () => {
      it('should return trace file path', () => {
        const tracer = new RouterTraceLogger({
          workspacePath: '/test/workspace',
          enabled: true
        });

        const path = tracer.getTraceFile();

        expect(path).toContain('/test/workspace');
        expect(path).toContain('.automatosx/logs');
        expect(path).toContain('router.trace.jsonl');

        tracer.close();
      });
    });
  });

  describe('createTraceLogger', () => {
    it('should create RouterTraceLogger with defaults', () => {
      const tracer = createTraceLogger('/test/workspace');

      expect(tracer).toBeInstanceOf(RouterTraceLogger);
      expect(tracer.getTraceFile()).toContain('/test/workspace');

      tracer.close();
    });

    it('should create disabled tracer when enabled is false', () => {
      const tracer = createTraceLogger('/test/workspace', false);

      // Log should not create stream
      tracer.log({ timestamp: '', phase: 'selection', data: {} });

      expect(mockCreateWriteStream).not.toHaveBeenCalled();

      tracer.close();
    });
  });

  describe('getGlobalTracer', () => {
    it('should create global tracer on first call', () => {
      const tracer = getGlobalTracer('/test/workspace');

      expect(tracer).toBeInstanceOf(RouterTraceLogger);
    });

    it('should return same instance on subsequent calls', () => {
      const tracer1 = getGlobalTracer('/test/workspace');
      const tracer2 = getGlobalTracer();

      expect(tracer1).toBe(tracer2);
    });

    it('should throw if called without path and not initialized', () => {
      closeGlobalTracer(); // Ensure clean state

      expect(() => getGlobalTracer()).toThrow('Global tracer not initialized');
    });
  });

  describe('closeGlobalTracer', () => {
    it('should close and clear global tracer', () => {
      getGlobalTracer('/test/workspace');

      closeGlobalTracer();

      // Should throw because tracer is cleared
      expect(() => getGlobalTracer()).toThrow('Global tracer not initialized');
    });

    it('should handle close when no global tracer exists', () => {
      closeGlobalTracer(); // Ensure clean state

      // Should not throw
      expect(() => closeGlobalTracer()).not.toThrow();
    });
  });
});
