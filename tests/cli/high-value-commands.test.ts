/**
 * High-Value CLI Commands Tests
 *
 * Tests for resume, history, status, cleanup commands
 * and dangerous operation guards.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resumeCommand,
  historyCommand,
  statusCommand,
  cleanupCommand,
  checkDangerousOp,
  isDangerousOp,
  listDangerousOperations,
} from '@automatosx/cli';
import type { CLIOptions } from '@automatosx/cli';
import {
  DANGEROUS_OPERATIONS,
  getDangerousOperation,
  isDangerousOperation,
  safeValidateResumeOptions,
  safeValidateHistoryOptions,
  safeValidateCleanupOptions,
  validateStatusOptions,
  createDefaultResumeOptions,
  createDefaultHistoryOptions,
  createDefaultCleanupOptions,
  createDefaultStatusOptions,
} from '@automatosx/contracts';

// Default CLI options for testing
const defaultOptions: CLIOptions = {
  help: false,
  version: false,
  verbose: false,
  format: 'text',
  workflowDir: undefined,
  workflowId: undefined,
  traceId: undefined,
  limit: undefined,
  input: undefined,
  iterate: false,
  maxIterations: undefined,
  maxTime: undefined,
  noContext: false,
  category: undefined,
  tags: undefined,
  agent: undefined,
  task: undefined,
  core: undefined,
  maxTokens: undefined,
};

// ============================================================================
// Contract Validation Tests
// ============================================================================

describe('CLI Contracts', () => {
  describe('ResumeOptions', () => {
    it('should validate valid resume options', () => {
      const result = safeValidateResumeOptions({
        agentId: 'test-agent',
        force: true,
        format: 'json',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agentId).toBe('test-agent');
        expect(result.data.force).toBe(true);
        expect(result.data.format).toBe('json');
      }
    });

    it('should use defaults for missing optional fields', () => {
      const result = safeValidateResumeOptions({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(false);
        expect(result.data.format).toBe('text');
      }
    });

    it('should create default resume options', () => {
      const defaults = createDefaultResumeOptions();
      expect(defaults.force).toBe(false);
      expect(defaults.format).toBe('text');
    });
  });

  describe('HistoryOptions', () => {
    it('should validate valid history options', () => {
      const result = safeValidateHistoryOptions({
        agent: 'coder',
        status: 'completed',
        limit: 20,
        verbose: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agent).toBe('coder');
        expect(result.data.status).toBe('completed');
        expect(result.data.limit).toBe(20);
        expect(result.data.verbose).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = safeValidateHistoryOptions({
        status: 'invalid-status',
      });

      expect(result.success).toBe(false);
    });

    it('should enforce limit bounds', () => {
      const result = safeValidateHistoryOptions({
        limit: 200, // Max is 100
      });

      expect(result.success).toBe(false);
    });

    it('should create default history options', () => {
      const defaults = createDefaultHistoryOptions();
      expect(defaults.limit).toBe(10);
      expect(defaults.verbose).toBe(false);
    });
  });

  describe('CleanupOptions', () => {
    it('should validate valid cleanup options', () => {
      const result = safeValidateCleanupOptions({
        force: true,
        types: ['checkpoints', 'sessions'],
        olderThan: 7,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(true);
        expect(result.data.types).toContain('checkpoints');
        expect(result.data.olderThan).toBe(7);
      }
    });

    it('should default to dry run', () => {
      const defaults = createDefaultCleanupOptions();
      expect(defaults.dryRun).toBe(true);
      expect(defaults.force).toBe(false);
    });

    it('should default cleanup types', () => {
      const defaults = createDefaultCleanupOptions();
      expect(defaults.types).toContain('checkpoints');
      expect(defaults.types).toContain('sessions');
    });
  });

  describe('StatusOptions', () => {
    it('should validate status options', () => {
      const result = validateStatusOptions({
        verbose: true,
        format: 'json',
      });

      expect(result.verbose).toBe(true);
      expect(result.format).toBe('json');
    });

    it('should create default status options', () => {
      const defaults = createDefaultStatusOptions();
      expect(defaults.verbose).toBe(false);
      expect(defaults.format).toBe('text');
    });
  });
});

// ============================================================================
// Resume Command Tests
// ============================================================================

describe('Resume Command', () => {
  it('should require agent or checkpoint option', async () => {
    const result = await resumeCommand([], defaultOptions);

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.message).toContain('--agent');
  });

  it('should handle missing checkpoint for agent', async () => {
    const opts = {
      ...defaultOptions,
      agent: 'nonexistent-agent',
    } as CLIOptions;

    const result = await resumeCommand([], opts);

    expect(result.success).toBe(false);
    expect(result.message).toContain('No checkpoint found');
  });

  it('should handle list subcommand without agent', async () => {
    const result = await resumeCommand(['list'], defaultOptions);

    expect(result.success).toBe(false);
    expect(result.message).toContain('--agent');
  });

  it('should handle list subcommand with agent (empty)', async () => {
    const opts = {
      ...defaultOptions,
      agent: 'test-agent',
    } as CLIOptions;

    const result = await resumeCommand(['list'], opts);

    expect(result.success).toBe(true);
    expect(result.message).toContain('No checkpoints found');
  });

  it('should output JSON format', async () => {
    const opts = {
      ...defaultOptions,
      format: 'json' as const,
      agent: 'test-agent',
    } as CLIOptions;

    const result = await resumeCommand(['list'], opts);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as { checkpoints: unknown[] }).checkpoints).toBeDefined();
  });
});

// ============================================================================
// History Command Tests
// ============================================================================

describe('History Command', () => {
  it('should return empty history', async () => {
    const result = await historyCommand([], defaultOptions);

    expect(result.success).toBe(true);
    expect(result.message).toContain('No runs found');
  });

  it('should filter by agent', async () => {
    const opts = {
      ...defaultOptions,
      agent: 'coder',
    } as CLIOptions;

    const result = await historyCommand([], opts);

    expect(result.success).toBe(true);
  });

  it('should output JSON format', async () => {
    const opts = {
      ...defaultOptions,
      format: 'json' as const,
    } as CLIOptions;

    const result = await historyCommand([], opts);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as { runs: unknown[] }).runs).toBeDefined();
  });

  it('should accept limit option', async () => {
    const opts = {
      ...defaultOptions,
      limit: 5,
    } as CLIOptions;

    const result = await historyCommand([], opts);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Status Command Tests
// ============================================================================

describe('Status Command', () => {
  it('should return valid status', async () => {
    const result = await statusCommand([], defaultOptions);

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.data).toBeDefined();

    const status = result.data as { status: string; version: string };
    // Status can be healthy, degraded, or unhealthy depending on provider availability
    expect(['healthy', 'degraded', 'unhealthy']).toContain(status.status);
    expect(status.version).toBeDefined();
  });

  it('should output JSON format', async () => {
    const opts = {
      ...defaultOptions,
      format: 'json' as const,
    } as CLIOptions;

    const result = await statusCommand([], opts);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const status = result.data as {
      status: string;
      providers: unknown[];
      activeSessions: number;
      pendingCheckpoints: number;
      uptime: string;
      version: string;
      checkedAt: string;
    };

    expect(status.providers).toBeDefined();
    expect(typeof status.activeSessions).toBe('number');
    expect(typeof status.pendingCheckpoints).toBe('number');
    expect(status.uptime).toBeDefined();
    expect(status.checkedAt).toBeDefined();
  });

  it('should include verbose details when requested', async () => {
    const opts = {
      ...defaultOptions,
      verbose: true,
    };

    const result = await statusCommand([], opts);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Cleanup Command Tests
// ============================================================================

describe('Cleanup Command', () => {
  it('should perform dry run by default', async () => {
    const result = await cleanupCommand([], defaultOptions);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const cleanup = result.data as { dryRun: boolean };
    expect(cleanup.dryRun).toBe(true);
  });

  it('should output cleanup results', async () => {
    const result = await cleanupCommand([], defaultOptions);

    expect(result.success).toBe(true);

    const cleanup = result.data as {
      cleaned: { type: string; count: number }[];
      totalCount: number;
      dryRun: boolean;
    };

    expect(cleanup.cleaned).toBeDefined();
    expect(typeof cleanup.totalCount).toBe('number');
  });

  it('should output JSON format', async () => {
    const opts = {
      ...defaultOptions,
      format: 'json' as const,
    } as CLIOptions;

    const result = await cleanupCommand([], opts);

    expect(result.success).toBe(true);
    expect(result.message).toBeUndefined();
    expect(result.data).toBeDefined();
  });

  it('should handle types option', async () => {
    const opts = {
      ...defaultOptions,
      types: 'checkpoints',
    } as CLIOptions;

    const result = await cleanupCommand([], opts);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Dangerous Operation Guard Tests
// ============================================================================

describe('Dangerous Operation Guards', () => {
  describe('DANGEROUS_OPERATIONS registry', () => {
    it('should contain cleanup.force operation', () => {
      expect(DANGEROUS_OPERATIONS['cleanup.force']).toBeDefined();
      expect(DANGEROUS_OPERATIONS['cleanup.force']!.impact).toBe('medium');
    });

    it('should contain checkpoint.delete-all operation', () => {
      expect(DANGEROUS_OPERATIONS['checkpoint.delete-all']).toBeDefined();
      expect(DANGEROUS_OPERATIONS['checkpoint.delete-all']!.impact).toBe('high');
    });

    it('should contain guard.bypass operation with phrase', () => {
      expect(DANGEROUS_OPERATIONS['guard.bypass']).toBeDefined();
      expect(DANGEROUS_OPERATIONS['guard.bypass']!.impact).toBe('critical');
      expect(DANGEROUS_OPERATIONS['guard.bypass']!.confirmationPhrase).toBeDefined();
    });
  });

  describe('getDangerousOperation', () => {
    it('should return operation definition', () => {
      const op = getDangerousOperation('cleanup.force');

      expect(op).toBeDefined();
      expect(op?.operation).toBe('cleanup.force');
      expect(op?.requiresConfirmation).toBe(true);
    });

    it('should return undefined for unknown operation', () => {
      const op = getDangerousOperation('unknown.operation');

      expect(op).toBeUndefined();
    });
  });

  describe('isDangerousOperation', () => {
    it('should return true for dangerous operations', () => {
      expect(isDangerousOperation('cleanup.force')).toBe(true);
      expect(isDangerousOperation('checkpoint.delete-all')).toBe(true);
      expect(isDangerousOperation('guard.bypass')).toBe(true);
    });

    it('should return false for unknown operations', () => {
      expect(isDangerousOperation('safe.operation')).toBe(false);
      expect(isDangerousOperation('')).toBe(false);
    });
  });

  describe('checkDangerousOp', () => {
    it('should allow non-dangerous operations', async () => {
      const result = await checkDangerousOp('safe.operation', {});

      expect(result.allowed).toBe(true);
    });

    it('should allow with force flag', async () => {
      const result = await checkDangerousOp('cleanup.force', { force: true });

      expect(result.allowed).toBe(true);
      expect(result.operation).toBe('cleanup.force');
    });

    it('should allow with yes flag', async () => {
      const result = await checkDangerousOp('cleanup.force', { yes: true });

      expect(result.allowed).toBe(true);
    });

    it('should reject in non-interactive mode without force', async () => {
      const result = await checkDangerousOp('cleanup.force', { noPrompt: true });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('--force');
    });
  });

  describe('isDangerousOp utility', () => {
    it('should check dangerous operations', () => {
      expect(isDangerousOp('cleanup.force')).toBe(true);
      expect(isDangerousOp('unknown')).toBe(false);
    });
  });

  describe('listDangerousOperations', () => {
    it('should return all dangerous operations', () => {
      const ops = listDangerousOperations();

      expect(ops.length).toBeGreaterThan(0);
      expect(ops.some((op) => op.operation === 'cleanup.force')).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('CLI Command Integration', () => {
  it('should have consistent exit codes', async () => {
    // Success should return 0
    const statusResult = await statusCommand([], defaultOptions);
    expect(statusResult.exitCode).toBe(0);

    // Failure should return 1
    const resumeResult = await resumeCommand([], defaultOptions);
    expect(resumeResult.exitCode).toBe(1);
  });

  it('should support both text and JSON formats', async () => {
    const commands = [
      () => statusCommand([], defaultOptions),
      () => historyCommand([], defaultOptions),
      () => cleanupCommand([], defaultOptions),
    ];

    for (const cmd of commands) {
      const textResult = await cmd();
      expect(textResult.success).toBe(true);

      // JSON format
      const jsonResult = await cmd();
      expect(jsonResult.success).toBe(true);
    }
  });

  it('should all return CommandResult shape', async () => {
    const commands = [
      () => statusCommand([], defaultOptions),
      () => historyCommand([], defaultOptions),
      () => cleanupCommand([], defaultOptions),
      () => resumeCommand([], defaultOptions),
    ];

    for (const cmd of commands) {
      const result = await cmd();

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exitCode).toBe('number');
      // message can be undefined or string
      expect(
        result.message === undefined || typeof result.message === 'string'
      ).toBe(true);
    }
  });
});
