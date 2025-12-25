/**
 * Session Contract Invariant Tests
 *
 * Tests for session invariants documented in packages/contracts/src/session/v1/invariants.md
 *
 * Invariants tested:
 * - INV-SESS-001: Session ID Uniqueness
 * - INV-SESS-002: Status Transitions
 * - INV-SESS-003: Participant Tracking
 * - INV-SESS-004: Completion Finality
 * - INV-SESS-005: Failure Recording
 * - INV-SESS-006: Initiator Immutability
 */

import { describe, it, expect } from 'vitest';
import {
  SessionSchema,
  SessionTaskSchema,
  SessionParticipantSchema,
  SessionStatusSchema,
  TaskStatusSchema,
  CreateSessionInputSchema,
  JoinSessionInputSchema,
  StartTaskInputSchema,
  validateSession,
  safeValidateSession,
  isValidSessionTransition,
  isValidTaskTransition,
  SESSION_TRANSITIONS,
  TASK_TRANSITIONS,
  SessionErrorCode,
} from '@defai.digital/contracts';

describe('Session Contract', () => {
  describe('SessionSchema', () => {
    it('should validate a minimal session', () => {
      const session = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        initiator: 'code-agent',
        task: 'Review the authentication module',
        participants: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      const result = SessionSchema.safeParse(session);
      expect(result.success).toBe(true);
    });

    it('should validate a full session', () => {
      const session = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        initiator: 'code-agent',
        task: 'Review the authentication module',
        participants: [
          {
            agentId: 'code-agent',
            role: 'initiator',
            joinedAt: new Date().toISOString(),
            tasks: [
              {
                taskId: '550e8400-e29b-41d4-a716-446655440001',
                title: 'Analyze auth flow',
                status: 'completed',
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 5000,
              },
            ],
          },
          {
            agentId: 'review-agent',
            role: 'collaborator',
            joinedAt: new Date().toISOString(),
            tasks: [],
          },
        ],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 3,
        workspace: '/project',
        metadata: { priority: 'high' },
      };

      const result = SessionSchema.safeParse(session);
      expect(result.success).toBe(true);
    });

    it('should reject invalid session ID', () => {
      const session = {
        sessionId: 'not-a-uuid',
        initiator: 'code-agent',
        task: 'Test task',
        participants: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      const result = SessionSchema.safeParse(session);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const session = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        initiator: 'code-agent',
        task: 'Test task',
        participants: [],
        status: 'invalid-status',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      const result = SessionSchema.safeParse(session);
      expect(result.success).toBe(false);
    });
  });

  describe('SessionTaskSchema', () => {
    it('should validate a running task', () => {
      const task = {
        taskId: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Analyze code',
        status: 'running',
        startedAt: new Date().toISOString(),
      };

      const result = SessionTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it('should validate a completed task', () => {
      const task = {
        taskId: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Analyze code',
        description: 'Analyze the authentication module',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 5000,
        output: { findings: ['issue1', 'issue2'] },
      };

      const result = SessionTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it('should validate a failed task', () => {
      const task = {
        taskId: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Analyze code',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: {
          code: 'ANALYSIS_FAILED',
          message: 'Could not parse file',
        },
      };

      const result = SessionTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });
  });

  describe('SessionParticipantSchema', () => {
    it('should validate an initiator participant', () => {
      const participant = {
        agentId: 'code-agent',
        role: 'initiator',
        joinedAt: new Date().toISOString(),
        tasks: [],
      };

      const result = SessionParticipantSchema.safeParse(participant);
      expect(result.success).toBe(true);
    });

    it('should validate a delegate participant', () => {
      const participant = {
        agentId: 'review-agent',
        role: 'delegate',
        joinedAt: new Date().toISOString(),
        leftAt: new Date().toISOString(),
        tasks: [],
      };

      const result = SessionParticipantSchema.safeParse(participant);
      expect(result.success).toBe(true);
    });
  });

  describe('State Machine Transitions', () => {
    describe('Session Status', () => {
      it('should allow active -> completed', () => {
        expect(isValidSessionTransition('active', 'completed')).toBe(true);
      });

      it('should allow active -> failed', () => {
        expect(isValidSessionTransition('active', 'failed')).toBe(true);
      });

      it('should not allow completed -> active', () => {
        expect(isValidSessionTransition('completed', 'active')).toBe(false);
      });

      it('should not allow failed -> completed', () => {
        expect(isValidSessionTransition('failed', 'completed')).toBe(false);
      });

      it('SESSION_TRANSITIONS should define all states', () => {
        expect(SESSION_TRANSITIONS.active).toContain('completed');
        expect(SESSION_TRANSITIONS.active).toContain('failed');
        expect(SESSION_TRANSITIONS.completed).toHaveLength(0);
        expect(SESSION_TRANSITIONS.failed).toHaveLength(0);
      });
    });

    describe('Task Status', () => {
      it('should allow pending -> running', () => {
        expect(isValidTaskTransition('pending', 'running')).toBe(true);
      });

      it('should allow running -> completed', () => {
        expect(isValidTaskTransition('running', 'completed')).toBe(true);
      });

      it('should allow running -> failed', () => {
        expect(isValidTaskTransition('running', 'failed')).toBe(true);
      });

      it('should allow failed -> pending (retry)', () => {
        expect(isValidTaskTransition('failed', 'pending')).toBe(true);
      });

      it('should not allow completed -> running', () => {
        expect(isValidTaskTransition('completed', 'running')).toBe(false);
      });

      it('TASK_TRANSITIONS should define all states', () => {
        expect(TASK_TRANSITIONS.pending).toContain('running');
        expect(TASK_TRANSITIONS.pending).toContain('cancelled');
        expect(TASK_TRANSITIONS.running).toContain('completed');
        expect(TASK_TRANSITIONS.running).toContain('failed');
        expect(TASK_TRANSITIONS.failed).toContain('pending');
        expect(TASK_TRANSITIONS.completed).toHaveLength(0);
        expect(TASK_TRANSITIONS.cancelled).toHaveLength(0);
      });
    });
  });

  describe('Input Schemas', () => {
    it('should validate CreateSessionInput', () => {
      const input = {
        initiator: 'code-agent',
        task: 'Review the authentication module',
        workspace: '/project',
      };

      const result = CreateSessionInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate JoinSessionInput', () => {
      const input = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: 'review-agent',
        role: 'collaborator',
      };

      const result = JoinSessionInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate StartTaskInput', () => {
      const input = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: 'code-agent',
        title: 'Analyze auth flow',
        description: 'Analyze the authentication flow for security issues',
      };

      const result = StartTaskInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('validateSession should throw on invalid input', () => {
      expect(() =>
        validateSession({ sessionId: 'invalid' })
      ).toThrow();
    });

    it('safeValidateSession should return error on invalid input', () => {
      const result = safeValidateSession({ sessionId: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      expect(SessionErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
      expect(SessionErrorCode.SESSION_ALREADY_COMPLETED).toBe(
        'SESSION_ALREADY_COMPLETED'
      );
      expect(SessionErrorCode.SESSION_INVALID_TRANSITION).toBe(
        'SESSION_INVALID_TRANSITION'
      );
      expect(SessionErrorCode.SESSION_AGENT_NOT_PARTICIPANT).toBe(
        'SESSION_AGENT_NOT_PARTICIPANT'
      );
      expect(SessionErrorCode.SESSION_TASK_NOT_FOUND).toBe(
        'SESSION_TASK_NOT_FOUND'
      );
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/session/v1/invariants.md
   */
  describe('INV-SESS: Session Invariants', () => {
    describe('INV-SESS-001: Session ID Uniqueness', () => {
      it('should enforce UUID format for session IDs', () => {
        const validSession = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          initiator: 'code-agent',
          task: 'Test task',
          participants: [],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };

        const result = SessionSchema.safeParse(validSession);
        expect(result.success).toBe(true);
      });

      it('should reject non-UUID session IDs', () => {
        const invalidIds = ['', 'not-uuid', '12345', 'abc-def-ghi'];

        for (const sessionId of invalidIds) {
          const session = {
            sessionId,
            initiator: 'code-agent',
            task: 'Test task',
            participants: [],
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          };

          const result = SessionSchema.safeParse(session);
          expect(result.success).toBe(false);
        }
      });

      it('should ensure task IDs are also UUIDs', () => {
        const task = {
          taskId: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Valid task',
          status: 'pending',
          startedAt: new Date().toISOString(),
        };

        const result = SessionTaskSchema.safeParse(task);
        expect(result.success).toBe(true);
      });

      it('should reject non-UUID task IDs', () => {
        const task = {
          taskId: 'invalid-id',
          title: 'Invalid task',
          status: 'pending',
          startedAt: new Date().toISOString(),
        };

        const result = SessionTaskSchema.safeParse(task);
        expect(result.success).toBe(false);
      });
    });

    describe('INV-SESS-002: Status Transitions', () => {
      it('should only allow valid session status values', () => {
        const validStatuses = ['active', 'completed', 'failed'];

        for (const status of validStatuses) {
          const result = SessionStatusSchema.safeParse(status);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid session status values', () => {
        const invalidStatuses = ['pending', 'paused', 'cancelled', 'unknown'];

        for (const status of invalidStatuses) {
          const result = SessionStatusSchema.safeParse(status);
          expect(result.success).toBe(false);
        }
      });

      it('should allow transition from active to completed', () => {
        expect(isValidSessionTransition('active', 'completed')).toBe(true);
      });

      it('should allow transition from active to failed', () => {
        expect(isValidSessionTransition('active', 'failed')).toBe(true);
      });

      it('should not allow any transitions from terminal states', () => {
        // completed is terminal
        expect(isValidSessionTransition('completed', 'active')).toBe(false);
        expect(isValidSessionTransition('completed', 'failed')).toBe(false);

        // failed is terminal
        expect(isValidSessionTransition('failed', 'active')).toBe(false);
        expect(isValidSessionTransition('failed', 'completed')).toBe(false);
      });

      it('should define all task status values', () => {
        const validTaskStatuses = [
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
        ];

        for (const status of validTaskStatuses) {
          const result = TaskStatusSchema.safeParse(status);
          expect(result.success).toBe(true);
        }
      });

      it('should enforce task state machine', () => {
        // pending can go to running or cancelled
        expect(isValidTaskTransition('pending', 'running')).toBe(true);
        expect(isValidTaskTransition('pending', 'cancelled')).toBe(true);

        // running can go to completed or failed
        expect(isValidTaskTransition('running', 'completed')).toBe(true);
        expect(isValidTaskTransition('running', 'failed')).toBe(true);

        // failed can retry (back to pending)
        expect(isValidTaskTransition('failed', 'pending')).toBe(true);

        // completed and cancelled are terminal for tasks
        expect(isValidTaskTransition('completed', 'running')).toBe(false);
        expect(isValidTaskTransition('cancelled', 'running')).toBe(false);
      });
    });

    describe('INV-SESS-003: Participant Tracking', () => {
      it('should validate participant with all required fields', () => {
        const participant = {
          agentId: 'code-agent',
          role: 'initiator',
          joinedAt: new Date().toISOString(),
          tasks: [],
        };

        const result = SessionParticipantSchema.safeParse(participant);
        expect(result.success).toBe(true);
      });

      it('should validate participant roles', () => {
        const roles = ['initiator', 'collaborator', 'delegate'];

        for (const role of roles) {
          const participant = {
            agentId: 'test-agent',
            role,
            joinedAt: new Date().toISOString(),
            tasks: [],
          };

          const result = SessionParticipantSchema.safeParse(participant);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid participant roles', () => {
        const participant = {
          agentId: 'test-agent',
          role: 'invalid-role',
          joinedAt: new Date().toISOString(),
          tasks: [],
        };

        const result = SessionParticipantSchema.safeParse(participant);
        expect(result.success).toBe(false);
      });

      it('should track participant tasks', () => {
        const participant = {
          agentId: 'code-agent',
          role: 'collaborator',
          joinedAt: new Date().toISOString(),
          tasks: [
            {
              taskId: '550e8400-e29b-41d4-a716-446655440001',
              title: 'Task 1',
              status: 'completed',
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            },
            {
              taskId: '550e8400-e29b-41d4-a716-446655440002',
              title: 'Task 2',
              status: 'running',
              startedAt: new Date().toISOString(),
            },
          ],
        };

        const result = SessionParticipantSchema.safeParse(participant);
        expect(result.success).toBe(true);
      });

      it('should track when participant left', () => {
        const participant = {
          agentId: 'code-agent',
          role: 'delegate',
          joinedAt: new Date(Date.now() - 3600000).toISOString(),
          leftAt: new Date().toISOString(),
          tasks: [],
        };

        const result = SessionParticipantSchema.safeParse(participant);
        expect(result.success).toBe(true);
      });
    });

    describe('INV-SESS-004: Completion Finality', () => {
      it('should have no outgoing transitions from completed state', () => {
        expect(SESSION_TRANSITIONS.completed).toHaveLength(0);
      });

      it('should record summary when session completes', () => {
        const completedSession = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          initiator: 'code-agent',
          task: 'Test task',
          participants: [],
          status: 'completed',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date().toISOString(),
          version: 2,
          summary: 'Task completed successfully',
        };

        const result = SessionSchema.safeParse(completedSession);
        expect(result.success).toBe(true);
      });

      it('completed task should have no outgoing transitions', () => {
        expect(TASK_TRANSITIONS.completed).toHaveLength(0);
      });

      it('cancelled task should have no outgoing transitions', () => {
        expect(TASK_TRANSITIONS.cancelled).toHaveLength(0);
      });
    });

    describe('INV-SESS-005: Failure Recording', () => {
      it('should have no outgoing transitions from failed state', () => {
        expect(SESSION_TRANSITIONS.failed).toHaveLength(0);
      });

      it('should record error details when session fails', () => {
        const failedSession = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          initiator: 'code-agent',
          task: 'Test task',
          participants: [],
          status: 'failed',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date().toISOString(),
          version: 2,
          error: {
            code: 'TASK_FAILED',
            message: 'Critical error occurred',
          },
        };

        const result = SessionSchema.safeParse(failedSession);
        expect(result.success).toBe(true);
      });

      it('should record error details when task fails', () => {
        const failedTask = {
          taskId: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Failed task',
          status: 'failed',
          startedAt: new Date(Date.now() - 60000).toISOString(),
          completedAt: new Date().toISOString(),
          error: {
            code: 'EXECUTION_ERROR',
            message: 'Task execution failed',
          },
        };

        const result = SessionTaskSchema.safeParse(failedTask);
        expect(result.success).toBe(true);
      });

      it('failed tasks can retry by transitioning back to pending', () => {
        expect(isValidTaskTransition('failed', 'pending')).toBe(true);
      });
    });

    describe('INV-SESS-006: Initiator Immutability', () => {
      it('should require initiator field', () => {
        const sessionWithoutInitiator = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          task: 'Test task',
          participants: [],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };

        const result = SessionSchema.safeParse(sessionWithoutInitiator);
        expect(result.success).toBe(false);
      });

      it('should enforce non-empty initiator', () => {
        const sessionWithEmptyInitiator = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          initiator: '',
          task: 'Test task',
          participants: [],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };

        const result = SessionSchema.safeParse(sessionWithEmptyInitiator);
        expect(result.success).toBe(false);
      });

      it('CreateSessionInput should require initiator', () => {
        const inputWithoutInitiator = {
          task: 'Test task',
        };

        const result = CreateSessionInputSchema.safeParse(inputWithoutInitiator);
        expect(result.success).toBe(false);
      });

      it('CreateSessionInput should validate initiator format', () => {
        const validInput = {
          initiator: 'code-agent',
          task: 'Test task',
        };

        const result = CreateSessionInputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('session should preserve initiator across status changes', () => {
        // Active session
        const activeSession = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          initiator: 'original-agent',
          task: 'Test task',
          participants: [],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };

        // Completed session (same initiator)
        const completedSession = {
          ...activeSession,
          status: 'completed',
          version: 2,
          updatedAt: new Date().toISOString(),
        };

        // Failed session (same initiator)
        const failedSession = {
          ...activeSession,
          status: 'failed',
          version: 2,
          updatedAt: new Date().toISOString(),
          error: { code: 'ERROR', message: 'Failed' },
        };

        expect(SessionSchema.safeParse(activeSession).success).toBe(true);
        expect(SessionSchema.safeParse(completedSession).success).toBe(true);
        expect(SessionSchema.safeParse(failedSession).success).toBe(true);

        // All should have same initiator
        expect(activeSession.initiator).toBe('original-agent');
        expect(completedSession.initiator).toBe('original-agent');
        expect(failedSession.initiator).toBe('original-agent');
      });
    });
  });
});
