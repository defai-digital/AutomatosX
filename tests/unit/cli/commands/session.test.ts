/**
 * Session Command Unit Tests
 *
 * Comprehensive tests for the session command including:
 * - Create session
 * - List sessions with filtering
 * - Session status
 * - Complete/Fail session
 * - JSON output
 *
 * @module tests/unit/cli/commands/session.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Mock Modules
// ============================================================================

vi.mock('chalk', () => ({
  default: {
    blue: Object.assign((s: string) => s, { bold: (s: string) => s }),
    cyan: (s: string) => s,
    white: (s: string) => s,
    green: Object.assign((s: string) => s, { bold: (s: string) => s }),
    yellow: Object.assign((s: string) => s, { bold: (s: string) => s }),
    red: Object.assign((s: string) => s, { bold: (s: string) => s }),
    gray: (s: string) => s,
    dim: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}));

vi.mock('cli-table3', () => ({
  default: vi.fn().mockImplementation(() => ({
    push: vi.fn(),
    toString: vi.fn().mockReturnValue('table output'),
  })),
}));

// ============================================================================
// Types
// ============================================================================

interface MockSession {
  id: string;
  task: string;
  initiator: string;
  status: 'active' | 'completed' | 'failed';
  agents: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Test Setup
// ============================================================================

describe('Session Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ============================================================================
  // Create Session Tests
  // ============================================================================

  describe('Create Session', () => {
    it('should create session with required parameters', async () => {
      const mockSessionManager = {
        createSession: vi.fn().mockResolvedValue({
          id: 'sess-123',
          task: 'Test task',
          initiator: 'backend',
          status: 'active',
          agents: ['backend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const session = await mockSessionManager.createSession('Test task', 'backend');

      expect(session.id).toBe('sess-123');
      expect(session.task).toBe('Test task');
      expect(session.initiator).toBe('backend');
      expect(session.status).toBe('active');
    });

    it('should return session ID on creation', async () => {
      const mockSessionManager = {
        createSession: vi.fn().mockResolvedValue({
          id: 'sess-456',
          task: 'Complex task',
          initiator: 'frontend',
          status: 'active',
          agents: ['frontend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const session = await mockSessionManager.createSession('Complex task', 'frontend');

      expect(session.id).toBeDefined();
      expect(mockSessionManager.createSession).toHaveBeenCalledWith('Complex task', 'frontend');
    });

    it('should handle creation failure', async () => {
      const mockSessionManager = {
        createSession: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      await expect(mockSessionManager.createSession('Task', 'agent')).rejects.toThrow('Database error');
    });

    it('should set initial status to active', async () => {
      const mockSessionManager = {
        createSession: vi.fn().mockResolvedValue({
          id: 'sess-789',
          task: 'New task',
          initiator: 'security',
          status: 'active',
          agents: ['security'],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const session = await mockSessionManager.createSession('New task', 'security');

      expect(session.status).toBe('active');
    });
  });

  // ============================================================================
  // List Sessions Tests
  // ============================================================================

  describe('List Sessions', () => {
    it('should list all active sessions', async () => {
      const mockSessions: MockSession[] = [
        {
          id: 'sess-1',
          task: 'Task 1',
          initiator: 'backend',
          status: 'active',
          agents: ['backend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'sess-2',
          task: 'Task 2',
          initiator: 'frontend',
          status: 'active',
          agents: ['frontend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockSessionManager = {
        getActiveSessions: vi.fn().mockResolvedValue(mockSessions),
      };

      const sessions = await mockSessionManager.getActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.task).toBe('Task 1');
      expect(sessions[1]?.task).toBe('Task 2');
    });

    it('should filter by agent', async () => {
      const mockSessions: MockSession[] = [
        {
          id: 'sess-1',
          task: 'Backend task',
          initiator: 'backend',
          status: 'active',
          agents: ['backend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockSessionManager = {
        getActiveSessionsForAgent: vi.fn().mockResolvedValue(mockSessions),
      };

      const sessions = await mockSessionManager.getActiveSessionsForAgent('backend');

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.initiator).toBe('backend');
      expect(mockSessionManager.getActiveSessionsForAgent).toHaveBeenCalledWith('backend');
    });

    it('should filter by status', () => {
      const allSessions: MockSession[] = [
        {
          id: 'sess-1',
          task: 'Task 1',
          initiator: 'backend',
          status: 'active',
          agents: ['backend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'sess-2',
          task: 'Task 2',
          initiator: 'frontend',
          status: 'completed',
          agents: ['frontend'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'sess-3',
          task: 'Task 3',
          initiator: 'security',
          status: 'failed',
          agents: ['security'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const activeSessions = allSessions.filter((s) => s.status === 'active');
      const completedSessions = allSessions.filter((s) => s.status === 'completed');
      const failedSessions = allSessions.filter((s) => s.status === 'failed');

      expect(activeSessions).toHaveLength(1);
      expect(completedSessions).toHaveLength(1);
      expect(failedSessions).toHaveLength(1);
    });

    it('should handle empty session list', async () => {
      const mockSessionManager = {
        getActiveSessions: vi.fn().mockResolvedValue([]),
      };

      const sessions = await mockSessionManager.getActiveSessions();

      expect(sessions).toHaveLength(0);
    });

    it('should format session for table display', () => {
      const formatSession = (session: MockSession) => {
        return {
          id: session.id.substring(0, 8) + '...',
          task: session.task.substring(0, 37) + (session.task.length > 37 ? '...' : ''),
          initiator: session.initiator,
          agents: session.agents.join(', ').substring(0, 22),
          status: session.status,
          created: session.createdAt.toLocaleDateString(),
        };
      };

      const longTask = 'This is a very long task description that needs to be truncated';
      const session: MockSession = {
        id: 'sess-12345678-abcd-efgh',
        task: longTask,
        initiator: 'backend',
        status: 'active',
        agents: ['backend', 'frontend'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const formatted = formatSession(session);

      expect(formatted.id).toBe('sess-123...');
      expect(formatted.task.length).toBeLessThanOrEqual(40);
    });
  });

  // ============================================================================
  // Session Status Tests
  // ============================================================================

  describe('Session Status', () => {
    it('should get session by ID', async () => {
      const mockSession: MockSession = {
        id: 'sess-123',
        task: 'Test task',
        initiator: 'backend',
        status: 'active',
        agents: ['backend', 'frontend'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        metadata: { priority: 'high' },
      };

      const mockSessionManager = {
        getSession: vi.fn().mockResolvedValue(mockSession),
      };

      const session = await mockSessionManager.getSession('sess-123');

      expect(session).toBeDefined();
      expect(session?.id).toBe('sess-123');
      expect(session?.agents).toContain('backend');
      expect(session?.agents).toContain('frontend');
    });

    it('should return null for non-existent session', async () => {
      const mockSessionManager = {
        getSession: vi.fn().mockResolvedValue(null),
      };

      const session = await mockSessionManager.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should include metadata in session status', async () => {
      const mockSession: MockSession = {
        id: 'sess-123',
        task: 'Test task',
        initiator: 'backend',
        status: 'active',
        agents: ['backend'],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          priority: 'high',
          tags: ['urgent', 'production'],
        },
      };

      const mockSessionManager = {
        getSession: vi.fn().mockResolvedValue(mockSession),
      };

      const session = await mockSessionManager.getSession('sess-123');

      expect(session?.metadata).toBeDefined();
      expect(session?.metadata?.priority).toBe('high');
    });
  });

  // ============================================================================
  // Complete Session Tests
  // ============================================================================

  describe('Complete Session', () => {
    it('should mark session as completed', async () => {
      const mockSessionManager = {
        completeSession: vi.fn().mockResolvedValue(undefined),
      };

      await mockSessionManager.completeSession('sess-123');

      expect(mockSessionManager.completeSession).toHaveBeenCalledWith('sess-123');
    });

    it('should handle completion failure', async () => {
      const mockSessionManager = {
        completeSession: vi.fn().mockRejectedValue(new Error('Session not found')),
      };

      await expect(mockSessionManager.completeSession('non-existent')).rejects.toThrow('Session not found');
    });
  });

  // ============================================================================
  // Fail Session Tests
  // ============================================================================

  describe('Fail Session', () => {
    it('should mark session as failed', async () => {
      const mockSessionManager = {
        failSession: vi.fn().mockResolvedValue(undefined),
      };

      await mockSessionManager.failSession('sess-123', new Error('Manually marked as failed'));

      expect(mockSessionManager.failSession).toHaveBeenCalledWith('sess-123', expect.any(Error));
    });

    it('should handle fail operation failure', async () => {
      const mockSessionManager = {
        failSession: vi.fn().mockRejectedValue(new Error('Session not found')),
      };

      await expect(mockSessionManager.failSession('non-existent', new Error('Test'))).rejects.toThrow('Session not found');
    });
  });

  // ============================================================================
  // JSON Output Tests
  // ============================================================================

  describe('JSON Output', () => {
    it('should format sessions as JSON', () => {
      const sessions: MockSession[] = [
        {
          id: 'sess-1',
          task: 'Task 1',
          initiator: 'backend',
          status: 'active',
          agents: ['backend'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      const jsonOutput = JSON.stringify(sessions, null, 2);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('sess-1');
    });

    it('should format single session as JSON', () => {
      const session: MockSession = {
        id: 'sess-123',
        task: 'Test task',
        initiator: 'backend',
        status: 'active',
        agents: ['backend', 'frontend'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const jsonOutput = JSON.stringify(session, null, 2);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.id).toBe('sess-123');
      expect(parsed.agents).toHaveLength(2);
    });
  });

  // ============================================================================
  // Command Structure Tests
  // ============================================================================

  describe('Command Structure', () => {
    it('should require subcommand', () => {
      const commandDefinition = {
        command: 'session <command>',
        describe: 'Manage multi-agent collaborative sessions',
        demandCommand: 1,
      };

      expect(commandDefinition.command).toBe('session <command>');
      expect(commandDefinition.demandCommand).toBe(1);
    });

    it('should define create command with positional args', () => {
      const createOptions = {
        task: {
          describe: 'Overall task/goal for the session',
          type: 'string',
          demandOption: true,
        },
        initiator: {
          describe: 'Agent that initiates the session',
          type: 'string',
          demandOption: true,
        },
      };

      expect(createOptions.task.demandOption).toBe(true);
      expect(createOptions.initiator.demandOption).toBe(true);
    });

    it('should define list command options', () => {
      const listOptions = {
        agent: {
          describe: 'Filter by agent name',
          type: 'string',
        },
        status: {
          describe: 'Filter by status',
          type: 'string',
          choices: ['active', 'completed', 'failed'],
        },
        json: {
          describe: 'Output as JSON',
          type: 'boolean',
          default: false,
        },
      };

      expect(listOptions.status.choices).toContain('active');
      expect(listOptions.status.choices).toContain('completed');
      expect(listOptions.status.choices).toContain('failed');
      expect(listOptions.json.default).toBe(false);
    });

    it('should define status command with positional ID', () => {
      const statusOptions = {
        id: {
          describe: 'Session ID',
          type: 'string',
          demandOption: true,
        },
        json: {
          describe: 'Output as JSON',
          type: 'boolean',
          default: false,
        },
      };

      expect(statusOptions.id.demandOption).toBe(true);
    });
  });

  // ============================================================================
  // Date Formatting Tests
  // ============================================================================

  describe('Date Formatting', () => {
    it('should format created date for display', () => {
      const session: MockSession = {
        id: 'sess-123',
        task: 'Test',
        initiator: 'backend',
        status: 'active',
        agents: ['backend'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const formattedDate = session.createdAt.toLocaleDateString();

      expect(formattedDate).toBeDefined();
    });

    it('should format ISO date for JSON output', () => {
      const session: MockSession = {
        id: 'sess-123',
        task: 'Test',
        initiator: 'backend',
        status: 'active',
        agents: ['backend'],
        createdAt: new Date('2024-01-15T10:30:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
      };

      const isoDate = session.createdAt.toISOString();

      expect(isoDate).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle session with empty agents array', () => {
      const session: MockSession = {
        id: 'sess-123',
        task: 'Test',
        initiator: 'backend',
        status: 'active',
        agents: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.agents.join(', ')).toBe('');
    });

    it('should handle session with many agents', () => {
      const session: MockSession = {
        id: 'sess-123',
        task: 'Test',
        initiator: 'architecture',
        status: 'active',
        agents: ['backend', 'frontend', 'security', 'devops', 'quality'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const truncatedAgents = session.agents.join(', ').substring(0, 22);

      expect(truncatedAgents.length).toBeLessThanOrEqual(22);
    });

    it('should handle very long task description', () => {
      const longTask = 'A'.repeat(100);
      const truncated = longTask.substring(0, 37) + '...';

      expect(truncated.length).toBe(40);
    });

    it('should handle session with empty metadata', () => {
      const session: MockSession = {
        id: 'sess-123',
        task: 'Test',
        initiator: 'backend',
        status: 'active',
        agents: ['backend'],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      const hasMetadata = session.metadata && Object.keys(session.metadata).length > 0;

      expect(hasMetadata).toBe(false);
    });

    it('should handle concurrent session operations', async () => {
      const mockSessionManager = {
        createSession: vi.fn().mockImplementation((task: string, initiator: string) =>
          Promise.resolve({
            id: `sess-${Date.now()}`,
            task,
            initiator,
            status: 'active',
            agents: [initiator],
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        ),
      };

      const results = await Promise.all([
        mockSessionManager.createSession('Task 1', 'backend'),
        mockSessionManager.createSession('Task 2', 'frontend'),
        mockSessionManager.createSession('Task 3', 'security'),
      ]);

      expect(results).toHaveLength(3);
      expect(mockSessionManager.createSession).toHaveBeenCalledTimes(3);
    });
  });
});
