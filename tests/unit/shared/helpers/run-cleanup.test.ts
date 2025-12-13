/**
 * Tests for run-cleanup helper
 *
 * @module tests/unit/shared/helpers/run-cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanupResources,
  shutdownProcessManager,
  closeStdioStreams,
  type RunCleanupContext
} from '../../../../src/shared/helpers/run-cleanup.js';

// Mock logger
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock process manager
vi.mock('../../../../src/shared/process/process-manager.js', () => ({
  processManager: {
    shutdown: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('run-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupResources', () => {
    it('should clean up all resources when all managers provided', async () => {
      const mockMemoryManager = { close: vi.fn().mockResolvedValue(undefined) };
      const mockRouter = { destroy: vi.fn() };
      const mockContextManager = { cleanup: vi.fn().mockResolvedValue(undefined) };
      const mockContext = { id: 'test-context' };

      const ctx: RunCleanupContext = {
        memoryManager: mockMemoryManager,
        router: mockRouter,
        contextManager: mockContextManager,
        context: mockContext
      };

      await cleanupResources(ctx, false);

      expect(mockMemoryManager.close).toHaveBeenCalledTimes(1);
      expect(mockRouter.destroy).toHaveBeenCalledTimes(1);
      expect(mockContextManager.cleanup).toHaveBeenCalledWith(mockContext);
    });

    it('should handle null/undefined managers gracefully', async () => {
      const ctx: RunCleanupContext = {
        memoryManager: null,
        router: undefined,
        contextManager: null,
        context: undefined
      };

      // Should not throw
      await expect(cleanupResources(ctx, false)).resolves.toBeUndefined();
    });

    it('should skip context cleanup if context is undefined', async () => {
      const mockContextManager = { cleanup: vi.fn().mockResolvedValue(undefined) };

      const ctx: RunCleanupContext = {
        contextManager: mockContextManager,
        context: undefined
      };

      await cleanupResources(ctx, false);

      expect(mockContextManager.cleanup).not.toHaveBeenCalled();
    });

    it('should throw error when suppressErrors is false and cleanup fails', async () => {
      const mockMemoryManager = {
        close: vi.fn().mockRejectedValue(new Error('DB connection failed'))
      };

      const ctx: RunCleanupContext = {
        memoryManager: mockMemoryManager
      };

      await expect(cleanupResources(ctx, false)).rejects.toThrow('DB connection failed');
    });

    it('should suppress error when suppressErrors is true and cleanup fails', async () => {
      const mockMemoryManager = {
        close: vi.fn().mockRejectedValue(new Error('DB connection failed'))
      };
      const mockRouter = { destroy: vi.fn() };

      const ctx: RunCleanupContext = {
        memoryManager: mockMemoryManager,
        router: mockRouter
      };

      // Should not throw
      await expect(cleanupResources(ctx, true)).resolves.toBeUndefined();
      // Router should still be called after memory manager fails
      expect(mockRouter.destroy).toHaveBeenCalled();
    });

    it('should continue cleanup chain when one manager fails in suppress mode', async () => {
      const mockMemoryManager = {
        close: vi.fn().mockRejectedValue(new Error('Memory error'))
      };
      const mockRouter = {
        destroy: vi.fn().mockImplementation(() => {
          throw new Error('Router error');
        })
      };
      const mockContextManager = { cleanup: vi.fn().mockResolvedValue(undefined) };
      const mockContext = { id: 'test' };

      const ctx: RunCleanupContext = {
        memoryManager: mockMemoryManager,
        router: mockRouter,
        contextManager: mockContextManager,
        context: mockContext
      };

      await expect(cleanupResources(ctx, true)).resolves.toBeUndefined();

      // All cleanup functions should be attempted
      expect(mockMemoryManager.close).toHaveBeenCalled();
      expect(mockRouter.destroy).toHaveBeenCalled();
      expect(mockContextManager.cleanup).toHaveBeenCalled();
    });
  });

  describe('shutdownProcessManager', () => {
    it('should call processManager.shutdown with timeout', async () => {
      const { processManager } = await import('../../../../src/shared/process/process-manager.js');

      await shutdownProcessManager(5000);

      expect(processManager.shutdown).toHaveBeenCalledWith(5000);
    });

    it('should use default timeout of 3000ms', async () => {
      const { processManager } = await import('../../../../src/shared/process/process-manager.js');

      await shutdownProcessManager();

      expect(processManager.shutdown).toHaveBeenCalledWith(3000);
    });

    it('should not throw when shutdown fails', async () => {
      const { processManager } = await import('../../../../src/shared/process/process-manager.js');
      vi.mocked(processManager.shutdown).mockRejectedValueOnce(new Error('Shutdown failed'));

      // Should not throw
      await expect(shutdownProcessManager(3000)).resolves.toBeUndefined();
    });
  });

  describe('closeStdioStreams', () => {
    let originalStdout: typeof process.stdout;
    let originalStderr: typeof process.stderr;
    let mockStdoutEnd: ReturnType<typeof vi.fn>;
    let mockStderrEnd: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      originalStdout = process.stdout;
      originalStderr = process.stderr;
      mockStdoutEnd = vi.fn();
      mockStderrEnd = vi.fn();

      // Create mock streams
      Object.defineProperty(process, 'stdout', {
        value: { writable: true, end: mockStdoutEnd },
        writable: true
      });
      Object.defineProperty(process, 'stderr', {
        value: { writable: true, end: mockStderrEnd },
        writable: true
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'stdout', {
        value: originalStdout,
        writable: true
      });
      Object.defineProperty(process, 'stderr', {
        value: originalStderr,
        writable: true
      });
    });

    it('should close both stdout and stderr when writable', () => {
      closeStdioStreams();

      expect(mockStdoutEnd).toHaveBeenCalledTimes(1);
      expect(mockStderrEnd).toHaveBeenCalledTimes(1);
    });

    it('should not close stdout when not writable', () => {
      Object.defineProperty(process, 'stdout', {
        value: { writable: false, end: mockStdoutEnd },
        writable: true
      });

      closeStdioStreams();

      expect(mockStdoutEnd).not.toHaveBeenCalled();
      expect(mockStderrEnd).toHaveBeenCalled();
    });

    it('should not close stderr when not writable', () => {
      Object.defineProperty(process, 'stderr', {
        value: { writable: false, end: mockStderrEnd },
        writable: true
      });

      closeStdioStreams();

      expect(mockStdoutEnd).toHaveBeenCalled();
      expect(mockStderrEnd).not.toHaveBeenCalled();
    });
  });
});
