/**
 * MCP Tool Tests: get_status
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGetStatusHandler } from '../../../../src/mcp/tools/get-status.js';

describe('MCP Tool: get_status', () => {
  let mockMemoryManager: any;
  let mockSessionManager: any;
  let mockRouter: any;

  beforeEach(() => {
    mockMemoryManager = {
      getStats: vi.fn()
    };

    mockSessionManager = {
      getActiveSessions: vi.fn(),
      getTotalSessionCount: vi.fn()
    };

    mockRouter = {
      getAvailableProviders: vi.fn()
    };
  });

  describe('Successful Status Check', () => {
    it('should return complete system status', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 150,
        dbSize: 1048576 // 1 MB
      });

      mockSessionManager.getActiveSessions.mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' }
      ]);

      mockSessionManager.getTotalSessionCount.mockResolvedValue(10);

      mockRouter.getAvailableProviders.mockResolvedValue([
        { name: 'codex' },
        { name: 'gemini' },
        { name: 'claude' }
      ]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      const result = await handler({});

      expect(result.version).toBeDefined();
      expect(result.providers).toEqual(['codex', 'gemini', 'claude']);
      expect(result.memory).toEqual({
        entries: 150,
        dbSize: '1 MB'
      });
      expect(result.sessions).toEqual({
        active: 2,
        total: 10
      });
    });

    it('should handle zero entries and sessions', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 0,
        dbSize: 0
      });

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);
      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      const result = await handler({});

      expect(result.memory).toEqual({
        entries: 0,
        dbSize: '0 B'
      });
      expect(result.sessions).toEqual({
        active: 0,
        total: 0
      });
      expect(result.providers).toEqual([]);
    });

    it('should handle single provider', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 0,
        dbSize: 0
      });

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);
      mockRouter.getAvailableProviders.mockResolvedValue([
        { name: 'claude' }
      ]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      const result = await handler({});

      expect(result.providers).toEqual(['claude']);
    });
  });

  describe('Database Size Formatting', () => {
    it('should format bytes correctly', async () => {
      const testCases = [
        { bytes: 0, expected: '0 B' },
        { bytes: 500, expected: '500 B' },
        { bytes: 1024, expected: '1 KB' },
        { bytes: 1536, expected: '1.5 KB' },
        { bytes: 1048576, expected: '1 MB' },
        { bytes: 1572864, expected: '1.5 MB' },
        { bytes: 1073741824, expected: '1 GB' }
      ];

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);
      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      for (const { bytes, expected } of testCases) {
        mockMemoryManager.getStats.mockResolvedValue({
          totalEntries: 0,
          dbSize: bytes
        });

        const result = await handler({});
        expect(result.memory.dbSize).toBe(expected);
      }
    });
  });

  describe('Version Detection', () => {
    it('should return version string', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 0,
        dbSize: 0
      });

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);
      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      const result = await handler({});

      // Version should be from package.json (single source of truth) or 'unknown'
      expect(typeof result.version).toBe('string');
      expect(result.version.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle memory stats failure', async () => {
      mockMemoryManager.getStats.mockRejectedValue(
        new Error('Database not accessible')
      );

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);
      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      await expect(handler({})).rejects.toThrow('Status check failed');
      await expect(handler({})).rejects.toThrow('Database not accessible');
    });

    it('should handle session manager failure', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 0,
        dbSize: 0
      });

      mockSessionManager.getActiveSessions.mockRejectedValue(
        new Error('Session file corrupted')
      );

      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      await expect(handler({})).rejects.toThrow('Status check failed');
    });

    it('should handle router failure', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 0,
        dbSize: 0
      });

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);

      mockRouter.getAvailableProviders.mockRejectedValue(
        new Error('Provider check failed')
      );

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      await expect(handler({})).rejects.toThrow('Status check failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large memory databases', async () => {
      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 1000000,
        dbSize: 5368709120 // 5 GB
      });

      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(0);
      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      const result = await handler({});

      expect(result.memory.entries).toBe(1000000);
      expect(result.memory.dbSize).toBe('5 GB');
    });

    it('should handle many active sessions', async () => {
      const manySessions = Array.from({ length: 50 }, (_, i) => ({
        id: `session-${i}`
      }));

      mockMemoryManager.getStats.mockResolvedValue({
        totalEntries: 0,
        dbSize: 0
      });

      mockSessionManager.getActiveSessions.mockResolvedValue(manySessions);
      mockSessionManager.getTotalSessionCount.mockResolvedValue(100);
      mockRouter.getAvailableProviders.mockResolvedValue([]);

      const handler = createGetStatusHandler({
        memoryManager: mockMemoryManager,
        sessionManager: mockSessionManager,
        router: mockRouter
      });

      const result = await handler({});

      expect(result.sessions).toEqual({
        active: 50,
        total: 100
      });
    });
  });
});
