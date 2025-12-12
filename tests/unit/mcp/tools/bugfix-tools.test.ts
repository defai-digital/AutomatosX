/**
 * MCP Bugfix Tools Tests
 *
 * Tests for bugfix_scan and bugfix_run MCP tools.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createBugfixScanHandler } from '../../../../src/mcp/tools/bugfix-scan.js';
import { createBugfixRunHandler } from '../../../../src/mcp/tools/bugfix-run.js';
import type { BugFinding } from '../../../../src/core/bugfix/types.js';

// Track constructor calls for assertions
let lastDetectorConfig: any = null;
let lastControllerConfig: any = null;

// Mock the bugfix modules with proper class mocks
vi.mock('../../../../src/core/bugfix/bug-detector.js', () => {
  const MockBugDetector = vi.fn().mockImplementation(function(this: any, config: any) {
    lastDetectorConfig = config;
    this.scan = vi.fn().mockResolvedValue([]);
    return this;
  });

  return {
    BugDetector: MockBugDetector,
    createDefaultBugfixConfig: vi.fn().mockImplementation((options: any) => ({
      bugTypes: options?.bugTypes || ['timer_leak', 'missing_destroy'],
      excludePatterns: options?.excludePatterns || ['node_modules', 'dist'],
      maxBugs: options?.maxBugs || 10,
      dryRun: options?.dryRun || false,
      requireTests: options?.requireTests || false,
      requireTypecheck: options?.requireTypecheck !== false,
    }))
  };
});

vi.mock('../../../../src/core/bugfix/bugfix-controller.js', () => {
  const MockBugfixController = vi.fn().mockImplementation(function(this: any, config: any) {
    lastControllerConfig = config;
    this.execute = vi.fn().mockResolvedValue({
      sessionId: 'mock-session',
      stats: { bugsFound: 0, bugsFixed: 0, bugsFailed: 0, bugsSkipped: 0, successRate: 0, totalDurationMs: 0, bugsBySeverity: {} },
      finalState: 'COMPLETE',
      findings: [],
      attempts: []
    });
    return this;
  });

  return {
    BugfixController: MockBugfixController
  };
});

// Mock streaming notifier
vi.mock('../../../../src/mcp/streaming-notifier.js', () => ({
  sendMcpProgress: vi.fn(),
  sendMcpProgressBegin: vi.fn().mockReturnValue('progress-token'),
  sendMcpProgressEnd: vi.fn()
}));

describe('MCP Bugfix Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDetectorConfig = null;
    lastControllerConfig = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================
  // bugfix_scan tests
  // ==========================================
  describe('bugfix_scan', () => {
    it('should scan and return findings', async () => {
      const mockFindings: BugFinding[] = [
        {
          id: 'bug-1',
          file: 'src/service.ts',
          lineStart: 10,
          lineEnd: 15,
          type: 'timer_leak',
          severity: 'high',
          message: 'setInterval without cleanup',
          confidence: 0.95,
          fixStrategy: 'add_cleanup',
          context: 'setInterval(() => tick(), 1000)',
          detectionMethod: 'ast',
          detectedAt: new Date().toISOString()
        },
        {
          id: 'bug-2',
          file: 'src/emitter.ts',
          lineStart: 20,
          lineEnd: 25,
          type: 'missing_destroy',
          severity: 'medium',
          message: 'EventEmitter without destroy method',
          confidence: 0.85,
          context: 'class MyEmitter extends EventEmitter',
          detectionMethod: 'ast',
          detectedAt: new Date().toISOString()
        }
      ];

      const { BugDetector } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue(mockFindings);
        return this;
      });

      const handler = createBugfixScanHandler();
      const result = await handler({});

      expect(result.total).toBe(2);
      expect(result.findings).toHaveLength(2);
      expect(result.bySeverity.high).toBe(1);
      expect(result.bySeverity.medium).toBe(1);
      expect(result.byType['timer_leak']).toBe(1);
      expect(result.byType['missing_destroy']).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should filter by minimum severity', async () => {
      const mockFindings: BugFinding[] = [
        {
          id: 'bug-1',
          file: 'src/a.ts',
          lineStart: 1,
          lineEnd: 5,
          type: 'timer_leak',
          severity: 'low',
          message: 'Low severity issue',
          confidence: 0.7,
          context: 'setInterval code',
          detectionMethod: 'regex',
          detectedAt: new Date().toISOString()
        },
        {
          id: 'bug-2',
          file: 'src/b.ts',
          lineStart: 1,
          lineEnd: 5,
          type: 'timer_leak',
          severity: 'high',
          message: 'High severity issue',
          confidence: 0.9,
          context: 'setInterval code',
          detectionMethod: 'ast',
          detectedAt: new Date().toISOString()
        },
        {
          id: 'bug-3',
          file: 'src/c.ts',
          lineStart: 1,
          lineEnd: 5,
          type: 'timer_leak',
          severity: 'critical',
          message: 'Critical issue',
          confidence: 0.99,
          context: 'setInterval code',
          detectionMethod: 'ast',
          detectedAt: new Date().toISOString()
        }
      ];

      const { BugDetector } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue(mockFindings);
        return this;
      });

      const handler = createBugfixScanHandler();
      const result = await handler({ minSeverity: 'high' });

      // Should only include high and critical
      expect(result.findings).toHaveLength(2);
      expect(result.findings.every(f => f.severity === 'high' || f.severity === 'critical')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const mockFindings: BugFinding[] = Array.from({ length: 100 }, (_, i) => ({
        id: `bug-${i}`,
        file: `src/file${i}.ts`,
        lineStart: i,
        lineEnd: i + 5,
        type: 'timer_leak' as const,
        severity: 'low' as const,
        message: `Issue ${i}`,
        confidence: 0.8,
        context: 'setInterval code',
        detectionMethod: 'regex' as const,
        detectedAt: new Date().toISOString()
      }));

      const { BugDetector } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue(mockFindings);
        return this;
      });

      const handler = createBugfixScanHandler();
      const result = await handler({ limit: 10 });

      expect(result.total).toBe(100);
      expect(result.findings).toHaveLength(10);
    });

    it('should filter by bug types', async () => {
      const { BugDetector, createDefaultBugfixConfig } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue([]);
        return this;
      });

      const handler = createBugfixScanHandler();
      await handler({ types: ['timer_leak'] });

      expect(createDefaultBugfixConfig).toHaveBeenCalledWith(
        expect.objectContaining({ bugTypes: ['timer_leak'] })
      );
    });

    it('should use custom path', async () => {
      const mockScan = vi.fn().mockResolvedValue([]);
      const { BugDetector } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = mockScan;
        return this;
      });

      const handler = createBugfixScanHandler();
      await handler({ path: '/custom/path' });

      expect(mockScan).toHaveBeenCalledWith('/custom/path');
    });

    it('should handle scan failure', async () => {
      const { BugDetector } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockRejectedValue(new Error('Scan failed'));
        return this;
      });

      const handler = createBugfixScanHandler();

      await expect(handler({})).rejects.toThrow('Bug scan failed: Scan failed');
    });

    it('should indicate hasAutoFix correctly', async () => {
      const mockFindings: BugFinding[] = [
        {
          id: 'bug-1',
          file: 'src/a.ts',
          lineStart: 1,
          lineEnd: 5,
          type: 'timer_leak',
          severity: 'high',
          message: 'Has fix',
          confidence: 0.9,
          fixStrategy: 'add_cleanup',
          context: 'setInterval code',
          detectionMethod: 'ast',
          detectedAt: new Date().toISOString()
        },
        {
          id: 'bug-2',
          file: 'src/b.ts',
          lineStart: 1,
          lineEnd: 5,
          type: 'custom',
          severity: 'low',
          message: 'No fix',
          confidence: 0.8,
          context: 'custom code pattern',
          detectionMethod: 'pattern',
          detectedAt: new Date().toISOString()
          // No fixStrategy
        }
      ];

      const { BugDetector } = await import('../../../../src/core/bugfix/bug-detector.js');
      vi.mocked(BugDetector).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue(mockFindings);
        return this;
      });

      const handler = createBugfixScanHandler();
      const result = await handler({});

      expect(result.findings[0]?.hasAutoFix).toBe(true);
      expect(result.findings[1]?.hasAutoFix).toBe(false);
    });
  });

  // ==========================================
  // bugfix_run tests
  // ==========================================
  describe('bugfix_run', () => {
    it('should execute bugfix workflow', async () => {
      const mockResult = {
        sessionId: 'session-123',
        stats: {
          bugsFound: 5,
          bugsFixed: 3,
          bugsFailed: 1,
          bugsSkipped: 1,
          successRate: 0.6,
          totalDurationMs: 5000,
          bugsBySeverity: {
            low: 1,
            medium: 2,
            high: 1,
            critical: 1
          }
        },
        finalState: 'COMPLETE',
        findings: [
          { id: 'bug-1', file: 'src/a.ts', lineStart: 10, type: 'timer_leak', message: 'Fixed' }
        ],
        attempts: [
          { bugId: 'bug-1', status: 'verified' }
        ]
      };

      const { BugfixController } = await import('../../../../src/core/bugfix/bugfix-controller.js');
      vi.mocked(BugfixController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue(mockResult);
        return this;
      });

      const handler = createBugfixRunHandler();
      const result = await handler({});

      expect(result.sessionId).toBe('session-123');
      expect(result.bugsFound).toBe(5);
      expect(result.bugsFixed).toBe(3);
      expect(result.bugsFailed).toBe(1);
      expect(result.bugsSkipped).toBe(1);
      expect(result.successRate).toBe(0.6);
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should support dry run mode', async () => {
      const { BugfixController } = await import('../../../../src/core/bugfix/bugfix-controller.js');
      vi.mocked(BugfixController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'dry-run-session',
          stats: {
            bugsFound: 2,
            bugsFixed: 0,
            bugsFailed: 0,
            bugsSkipped: 2,
            successRate: 0,
            totalDurationMs: 1000,
            bugsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
          },
          finalState: 'COMPLETE',
          findings: [],
          attempts: []
        });
        return this;
      });

      const handler = createBugfixRunHandler();
      const result = await handler({ dryRun: true });

      expect(result.bugsFixed).toBe(0);
      // Verify BugfixController was called with dryRun config
      expect(BugfixController).toHaveBeenCalled();
      const callArgs = vi.mocked(BugfixController).mock.calls[0]?.[0];
      expect(callArgs?.config?.dryRun).toBe(true);
    });

    it('should respect maxBugs parameter', async () => {
      const { BugfixController } = await import('../../../../src/core/bugfix/bugfix-controller.js');
      vi.mocked(BugfixController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          stats: {
            bugsFound: 5,
            bugsFixed: 5,
            bugsFailed: 0,
            bugsSkipped: 0,
            successRate: 1,
            totalDurationMs: 2000,
            bugsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
          },
          finalState: 'COMPLETE',
          findings: [],
          attempts: []
        });
        return this;
      });

      const handler = createBugfixRunHandler();
      await handler({ maxBugs: 5 });

      expect(BugfixController).toHaveBeenCalled();
      const callArgs = vi.mocked(BugfixController).mock.calls[0]?.[0];
      expect(callArgs?.config?.maxBugs).toBe(5);
    });

    it('should configure typecheck and test requirements', async () => {
      const { BugfixController } = await import('../../../../src/core/bugfix/bugfix-controller.js');
      vi.mocked(BugfixController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          stats: {
            bugsFound: 0,
            bugsFixed: 0,
            bugsFailed: 0,
            bugsSkipped: 0,
            successRate: 0,
            totalDurationMs: 100,
            bugsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
          },
          finalState: 'COMPLETE',
          findings: [],
          attempts: []
        });
        return this;
      });

      const handler = createBugfixRunHandler();
      await handler({
        requireTypecheck: false,
        requireTests: true
      });

      expect(BugfixController).toHaveBeenCalled();
      const callArgs = vi.mocked(BugfixController).mock.calls[0]?.[0];
      expect(callArgs?.config?.requireTypecheck).toBe(false);
      expect(callArgs?.config?.requireTests).toBe(true);
    });

    it('should handle execution failure', async () => {
      const { BugfixController } = await import('../../../../src/core/bugfix/bugfix-controller.js');
      vi.mocked(BugfixController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockRejectedValue(new Error('Execution failed'));
        return this;
      });

      const handler = createBugfixRunHandler();

      await expect(handler({})).rejects.toThrow('Bugfix run failed: Execution failed');
    });

    it('should include error in output on partial failure', async () => {
      const { BugfixController } = await import('../../../../src/core/bugfix/bugfix-controller.js');
      vi.mocked(BugfixController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          stats: {
            bugsFound: 3,
            bugsFixed: 1,
            bugsFailed: 2,
            bugsSkipped: 0,
            successRate: 0.33,
            totalDurationMs: 3000,
            bugsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
          },
          finalState: 'PARTIAL_COMPLETE',
          findings: [],
          attempts: [],
          error: 'Some fixes failed verification'
        });
        return this;
      });

      const handler = createBugfixRunHandler();
      const result = await handler({});

      expect(result.error).toBe('Some fixes failed verification');
      expect(result.finalState).toBe('PARTIAL_COMPLETE');
    });
  });
});
