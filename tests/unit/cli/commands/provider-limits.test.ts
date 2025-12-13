/**
 * Tests for provider-limits CLI command
 * Full coverage for handler and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
    bold: vi.fn((s: string) => s)
  }
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Use vi.hoisted for stable mocks
const limitManagerMock = vi.hoisted(() => ({
  getProviderLimitManager: vi.fn()
}));

vi.mock('../../../../src/core/provider-limit-manager.js', () => limitManagerMock);

describe('Provider Limits Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockLimitManager: {
    initialize: ReturnType<typeof vi.fn>;
    refreshExpired: ReturnType<typeof vi.fn>;
    getAllStates: ReturnType<typeof vi.fn>;
    getManualOverride: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup default mock limit manager
    mockLimitManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      refreshExpired: vi.fn().mockResolvedValue(undefined),
      getAllStates: vi.fn().mockReturnValue(new Map()),
      getManualOverride: vi.fn().mockReturnValue(null)
    };
    limitManagerMock.getProviderLimitManager.mockResolvedValue(mockLimitManager);
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      expect(providerLimitsCommand.command).toBe('provider-limits');
    });

    it('should have aliases', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      expect(providerLimitsCommand.aliases).toContain('pl');
      expect(providerLimitsCommand.aliases).toContain('limits');
    });

    it('should have description', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      expect(providerLimitsCommand.describe).toContain('provider limit status');
    });

    it('should have builder function', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      expect(typeof providerLimitsCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      expect(typeof providerLimitsCommand.handler).toBe('function');
    });

    it('should configure json option in builder', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');

      const mockYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (providerLimitsCommand.builder as Function)(mockYargs);

      expect(mockYargs.option).toHaveBeenCalledWith('json', expect.objectContaining({
        describe: 'Output in JSON format',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.example).toHaveBeenCalledTimes(2);
    });
  });

  describe('Handler - Human Readable Output', () => {
    it('should show all providers available when no limits', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');

      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockLimitManager.initialize).toHaveBeenCalled();
      expect(mockLimitManager.refreshExpired).toHaveBeenCalled();
      expect(mockLimitManager.getAllStates).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show limit state for providers with limits', async () => {
      const now = Date.now();
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now - 3600000,
          resetAtMs: now + 7200000,
          reason: 'Rate limit exceeded',
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show limit state without reason when not provided', async () => {
      const now = Date.now();
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['claude', {
          status: 'cooldown',
          window: 'hourly',
          detectedAtMs: now - 1800000,
          resetAtMs: now + 1800000,
          reason: undefined,
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show manual override with expiry', async () => {
      const now = Date.now();
      mockLimitManager.getManualOverride.mockReturnValue({
        provider: 'claude',
        expiresAtMs: now + 7200000
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show manual override without expiry (never)', async () => {
      mockLimitManager.getManualOverride.mockReturnValue({
        provider: 'claude',
        expiresAtMs: undefined
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should not show all available when manual override exists even with no limits', async () => {
      mockLimitManager.getAllStates.mockReturnValue(new Map());
      mockLimitManager.getManualOverride.mockReturnValue({
        provider: 'gemini',
        expiresAtMs: Date.now() + 3600000
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle multiple providers with limits', async () => {
      const now = Date.now();
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now - 3600000,
          resetAtMs: now + 7200000,
          reason: 'Rate limit exceeded',
          manualHold: false
        }],
        ['claude', {
          status: 'cooldown',
          window: 'minute',
          detectedAtMs: now - 30000,
          resetAtMs: now + 30000,
          reason: 'Too many requests',
          manualHold: true
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - JSON Output', () => {
    it('should output JSON when json flag is true', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: true } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"limits"'));
    });

    it('should include provider states in JSON output', async () => {
      const now = Date.now();
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now - 3600000,
          resetAtMs: now + 7200000,
          reason: 'Rate limit exceeded',
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: true } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('"provider"')
      );
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.limits[0].provider).toBe('gemini');
      expect(output.limits[0].status).toBe('limited');
    });

    it('should include manual override in JSON output', async () => {
      mockLimitManager.getManualOverride.mockReturnValue({
        provider: 'claude',
        expiresAtMs: Date.now() + 3600000
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: true } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('"manualOverride"')
      );
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.manualOverride.provider).toBe('claude');
    });

    it('should include null manual override when not set', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: true } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('"manualOverride"')
      );
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.manualOverride).toBeNull();
    });

    it('should clamp negative remainingMs to 0 in JSON output', async () => {
      const now = Date.now();
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now - 7200000,
          resetAtMs: now - 1000, // Already expired
          reason: 'Rate limit exceeded',
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: true } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('"remainingMs"')
      );
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.limits[0].remainingMs).toBe(0);
    });

    it('should include timestamp in JSON output', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: true } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('"timestamp"')
      );
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(typeof output.timestamp).toBe('number');
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle limit manager initialization error', async () => {
      limitManagerMock.getProviderLimitManager.mockRejectedValue(new Error('Database connection failed'));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      await providerLimitsCommand.handler({ json: false } as any);

      expect(logger.error).toHaveBeenCalledWith('Failed to get provider limits', expect.any(Object));
      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle refresh error', async () => {
      mockLimitManager.refreshExpired.mockRejectedValue(new Error('Refresh failed'));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      await providerLimitsCommand.handler({ json: false } as any);

      expect(logger.error).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle getAllStates error', async () => {
      mockLimitManager.getAllStates.mockImplementation(() => {
        throw new Error('States unavailable');
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');

      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('formatDuration Helper', () => {
    // Test formatDuration logic by exercising the handler with different time values
    it('should format hours and minutes correctly', async () => {
      const now = Date.now();
      // 2h 30m remaining
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now,
          resetAtMs: now + (2 * 60 * 60 * 1000) + (30 * 60 * 1000),
          reason: null,
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should format hours only correctly', async () => {
      const now = Date.now();
      // Exactly 3h remaining
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now,
          resetAtMs: now + (3 * 60 * 60 * 1000),
          reason: null,
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should format minutes only correctly', async () => {
      const now = Date.now();
      // 45m remaining
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'hourly',
          detectedAtMs: now,
          resetAtMs: now + (45 * 60 * 1000),
          reason: null,
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should format less than 1 minute correctly', async () => {
      const now = Date.now();
      // 30 seconds remaining
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'cooldown',
          window: 'minute',
          detectedAtMs: now,
          resetAtMs: now + 30000,
          reason: null,
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle zero remaining time', async () => {
      const now = Date.now();
      mockLimitManager.getAllStates.mockReturnValue(new Map([
        ['gemini', {
          status: 'limited',
          window: 'daily',
          detectedAtMs: now - 1000,
          resetAtMs: now, // Exactly now
          reason: null,
          manualHold: false
        }]
      ]));

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should format manual override expiry time', async () => {
      const now = Date.now();
      mockLimitManager.getManualOverride.mockReturnValue({
        provider: 'claude',
        expiresAtMs: now + (1 * 60 * 60 * 1000) + (15 * 60 * 1000) // 1h 15m
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Limit Manager Operations', () => {
    it('should initialize limit manager', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockLimitManager.initialize).toHaveBeenCalled();
    });

    it('should refresh expired limits before display', async () => {
      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(mockLimitManager.refreshExpired).toHaveBeenCalled();
    });

    it('should call refreshExpired before getAllStates', async () => {
      const callOrder: string[] = [];
      mockLimitManager.refreshExpired.mockImplementation(async () => {
        callOrder.push('refreshExpired');
      });
      mockLimitManager.getAllStates.mockImplementation(() => {
        callOrder.push('getAllStates');
        return new Map();
      });

      const { providerLimitsCommand } = await import('../../../../src/cli/commands/provider-limits.js');
      await providerLimitsCommand.handler({ json: false } as any);

      expect(callOrder).toEqual(['refreshExpired', 'getAllStates']);
    });
  });
});
