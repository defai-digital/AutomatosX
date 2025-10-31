/**
 * Orchestration Types - Unit Tests
 *
 * @group unit
 * @group types
 */

import { describe, it, expect } from 'vitest';
import type {
  DelegationRequest,
  DelegationResult,
  Session,
  OrchestrationConfig,
  OrchestrationMetadata
} from '../../../src/types/orchestration.js';
import {
  DelegationError,
  SessionError
} from '../../../src/types/orchestration.js';

describe('Orchestration Types', () => {
  describe('DelegationRequest', () => {
    it('should validate DelegationRequest structure', () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create login UI'
      };

      expect(request).toBeDefined();
      expect(request.fromAgent).toBe('backend');
      expect(request.toAgent).toBe('frontend');
      expect(request.task).toBe('Create login UI');
    });

    it('should support optional context fields', () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create login UI',
        context: {
          sessionId: 'test-session',
          requirements: ['Email field', 'Password field'],
          expectedOutputs: ['LoginForm.tsx'],
          sharedData: { apiEndpoint: '/api/auth' },
          delegationChain: ['backend']
        }
      };

      expect(request.context?.sessionId).toBe('test-session');
      expect(request.context?.requirements).toHaveLength(2);
      expect(request.context?.expectedOutputs).toHaveLength(1);
      expect(request.context?.sharedData?.apiEndpoint).toBe('/api/auth');
      expect(request.context?.delegationChain).toEqual(['backend']);
    });

    it('should support optional execution options', () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create login UI',
        options: {
          timeout: 30000,
          priority: 'high'
        }
      };

      expect(request.options?.timeout).toBe(30000);
      expect(request.options?.priority).toBe('high');
    });
  });

  describe('DelegationResult', () => {
    it('should validate DelegationResult structure', () => {
      const result: DelegationResult = {
        delegationId: 'del-123',
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'implement feature',
        status: 'success',
        success: true,
        response: {
          content: 'Task completed',
          tokensUsed: { prompt: 100, completion: 200, total: 300 },
          model: 'test-model',
          latencyMs: 1000,
          finishReason: 'stop'
        },
        duration: 5000,
        outputs: {
          files: ['LoginForm.tsx'],
          memoryIds: [1, 2],
          workspacePath: '/path/to/workspace'
        },
        startTime: new Date('2025-01-01T00:00:00Z'),
        endTime: new Date('2025-01-01T00:00:05Z')
      };

      expect(result.delegationId).toBe('del-123');
      expect(result.status).toBe('success');
      expect(result.outputs.files).toHaveLength(1);
      expect(result.outputs.memoryIds).toHaveLength(2);
      expect(result.duration).toBe(5000);
    });

    it('should support all status values', () => {
      const statuses: DelegationResult['status'][] = ['success', 'failure', 'timeout'];

      statuses.forEach(status => {
        const result: Partial<DelegationResult> = { status };
        expect(result.status).toBe(status);
      });
    });
  });

  describe('Session', () => {
    it('should validate Session structure', () => {
      const session: Session = {
        id: 'session-123',
        initiator: 'backend',
        task: 'Implement auth feature',
        agents: ['backend', 'frontend', 'security'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(session.id).toBe('session-123');
      expect(session.initiator).toBe('backend');
      expect(session.agents).toHaveLength(3);
      expect(session.status).toBe('active');
    });

    it('should support all session statuses', () => {
      const statuses: Session['status'][] = ['active', 'completed', 'failed'];

      statuses.forEach(status => {
        const session: Partial<Session> = { status };
        expect(session.status).toBe(status);
      });
    });

    it('should support optional metadata', () => {
      const session: Session = {
        id: 'session-123',
        initiator: 'backend',
        task: 'Test task',
        agents: ['backend'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          priority: 'high',
          tags: ['auth', 'feature']
        }
      };

      expect(session.metadata?.priority).toBe('high');
      expect(session.metadata?.tags).toEqual(['auth', 'feature']);
    });
  });

  describe('OrchestrationConfig', () => {
    it('should validate OrchestrationConfig structure', () => {
      const config: OrchestrationConfig = {
        maxDelegationDepth: 2
        // v5.2.0: canReadWorkspaces and canWriteToShared removed
        // All agents now have equal access to automatosx/PRD and automatosx/tmp
      };

      expect(config.maxDelegationDepth).toBe(2);
    });

    it('should allow minimal config', () => {
      const config: OrchestrationConfig = {
        maxDelegationDepth: 2
      };

      expect(config.maxDelegationDepth).toBe(2);
    });
  });

  describe('OrchestrationMetadata', () => {
    it('should validate OrchestrationMetadata structure', () => {
      const metadata: OrchestrationMetadata = {
        isDelegationEnabled: true,
        availableAgents: ['frontend', 'backend', 'data'],
        sharedWorkspace: '/path/to/shared',
        delegationChain: ['backend'],
        maxDelegationDepth: 2
      };

      expect(metadata.isDelegationEnabled).toBe(true);
      expect(metadata.availableAgents).toHaveLength(3);
      expect(metadata.sharedWorkspace).toBe('/path/to/shared');
      expect(metadata.delegationChain).toHaveLength(1);
      expect(metadata.maxDelegationDepth).toBe(2);
    });
  });

  describe('Error Types', () => {
    it('should create DelegationError with all fields', () => {
      const error = new DelegationError(
        'Delegation failed',
        'backend',
        'frontend',
        'unauthorized'
      );

      expect(error.name).toBe('DelegationError');
      expect(error.message).toBe('Delegation failed');
      expect(error.fromAgent).toBe('backend');
      expect(error.toAgent).toBe('frontend');
      expect(error.reason).toBe('unauthorized');
    });

    it('should support all DelegationError reasons', () => {
      const reasons: Array<DelegationError['reason']> = [
        'unauthorized',
        'not_found',
        'max_depth',
        'cycle',
        'timeout',
        'execution_failed'
      ];

      reasons.forEach(reason => {
        const error = new DelegationError('Test', 'from', 'to', reason);
        expect(error.reason).toBe(reason);
      });
    });

    it('should create SessionError with optional fields', () => {
      const error = new SessionError(
        'Session not found',
        'session-123',
        'not_found'
      );

      expect(error.name).toBe('SessionError');
      expect(error.message).toBe('Session not found');
      expect(error.sessionId).toBe('session-123');
      expect(error.reason).toBe('not_found');
    });

  });

  describe('Type Compatibility', () => {
    it('should ensure DelegationResult is compatible with ExecutionResult', () => {
      // This test verifies type structure compatibility
      const result: DelegationResult = {
        delegationId: 'del-123',
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'test task',
        status: 'success',
        success: true,
        response: {
          content: 'Done',
          tokensUsed: { prompt: 10, completion: 20, total: 30 },
          model: 'test-model',
          latencyMs: 1000,
          finishReason: 'stop'
        },
        duration: 1000,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      // Should have standard ExecutionResult fields
      expect(result.response).toBeDefined();
      expect(result.duration).toBeDefined();

      // Should have additional delegation fields
      expect(result.delegationId).toBeDefined();
      expect(result.outputs).toBeDefined();
    });
  });
});
