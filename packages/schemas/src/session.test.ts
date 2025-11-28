/**
 * Session Schema Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  SessionTaskSchema,
  SessionState,
  SessionSchema,
  CheckpointSchema,
  CreateSessionInputSchema,
  AddTaskInputSchema,
  UpdateTaskInputSchema,
  SessionSummarySchema,
  DelegationRequestSchema,
  DelegationResultSchema,
  createSessionSummary,
  validateSession,
  validateCheckpoint,
  validateCreateSessionInput,
} from './session.js';

// Valid UUIDs for testing
const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_SESSION_ID_2 = '550e8400-e29b-41d4-a716-446655440001';
const TEST_CHECKPOINT_ID = '660e8400-e29b-41d4-a716-446655440000';
const TEST_TASK_ID = '770e8400-e29b-41d4-a716-446655440000';
const TEST_TASK_ID_2 = '770e8400-e29b-41d4-a716-446655440001';

describe('SessionState', () => {
  it('should accept valid states', () => {
    expect(SessionState.parse('active')).toBe('active');
    expect(SessionState.parse('paused')).toBe('paused');
    expect(SessionState.parse('completed')).toBe('completed');
    expect(SessionState.parse('failed')).toBe('failed');
    expect(SessionState.parse('cancelled')).toBe('cancelled');
  });

  it('should reject invalid state', () => {
    expect(() => SessionState.parse('invalid')).toThrow();
  });
});

describe('SessionTaskSchema', () => {
  const validTask = {
    id: TEST_TASK_ID,
    description: 'Build API endpoint',
    agentId: 'backend',
    status: 'pending',
  };

  it('should validate minimal task', () => {
    const result = SessionTaskSchema.parse(validTask);

    expect(result.id).toBe(validTask.id);
    expect(result.description).toBe('Build API endpoint');
    expect(result.status).toBe('pending');
  });

  it('should validate completed task', () => {
    const result = SessionTaskSchema.parse({
      ...validTask,
      status: 'completed',
      result: 'API endpoint created successfully',
      startedAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-02'),
      duration: 86400000,
    });

    expect(result.status).toBe('completed');
    expect(result.result).toContain('successfully');
    expect(result.duration).toBe(86400000);
  });

  it('should validate failed task', () => {
    const result = SessionTaskSchema.parse({
      ...validTask,
      status: 'failed',
      error: 'Connection timeout',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Connection timeout');
  });

  it('should validate task with parent', () => {
    const result = SessionTaskSchema.parse({
      ...validTask,
      parentTaskId: TEST_TASK_ID_2,
      delegatedFrom: 'product',
    });

    expect(result.parentTaskId).toBeDefined();
    expect(result.delegatedFrom).toBe('product');
  });

  it('should reject empty description', () => {
    expect(() => SessionTaskSchema.parse({
      ...validTask,
      description: '',
    })).toThrow();
  });
});

describe('SessionSchema', () => {
  const validSession = {
    id: TEST_SESSION_ID,
    name: 'Test Session',
    agents: ['backend'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should validate minimal session', () => {
    const result = SessionSchema.parse(validSession);

    expect(result.id).toBe(validSession.id);
    expect(result.name).toBe('Test Session');
    expect(result.state).toBe('active'); // default
    expect(result.tasks).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('should validate full session', () => {
    const result = SessionSchema.parse({
      ...validSession,
      description: 'Building a new feature',
      state: 'active',
      goal: 'Create user authentication',
      tasks: [{
        id: TEST_TASK_ID,
        description: 'Design API',
        agentId: 'backend',
        status: 'completed',
      }],
      tags: ['feature', 'auth'],
      metadata: { priority: 'high' },
    });

    expect(result.description).toBe('Building a new feature');
    expect(result.goal).toContain('authentication');
    expect(result.tasks).toHaveLength(1);
    expect(result.tags).toContain('feature');
  });

  it('should validate completed session', () => {
    const result = SessionSchema.parse({
      ...validSession,
      state: 'completed',
      completedAt: new Date(),
      duration: 3600000,
    });

    expect(result.state).toBe('completed');
    expect(result.completedAt).toBeDefined();
    expect(result.duration).toBe(3600000);
  });

  it('should reject session without agents', () => {
    expect(() => SessionSchema.parse({
      ...validSession,
      agents: [],
    })).toThrow();
  });

  it('should reject too long name', () => {
    expect(() => SessionSchema.parse({
      ...validSession,
      name: 'x'.repeat(201),
    })).toThrow();
  });
});

describe('CheckpointSchema', () => {
  const now = new Date();
  const validCheckpoint = {
    id: TEST_CHECKPOINT_ID,
    sessionId: TEST_SESSION_ID,
    createdAt: now,
    sessionState: {
      id: TEST_SESSION_ID,
      name: 'Test Session',
      agents: ['backend'],
      createdAt: now,
      updatedAt: now,
    },
    currentTaskIndex: 0,
  };

  it('should validate minimal checkpoint', () => {
    const result = CheckpointSchema.parse(validCheckpoint);

    expect(result.id).toBe(validCheckpoint.id);
    expect(result.name).toBe('auto'); // default
    expect(result.isAutoSave).toBe(true); // default
    expect(result.completedTaskIds).toEqual([]);
    expect(result.memoryEntryIds).toEqual([]);
  });

  it('should validate full checkpoint', () => {
    const result = CheckpointSchema.parse({
      ...validCheckpoint,
      name: 'before-delegation',
      completedTaskIds: [TEST_TASK_ID],
      contextSnapshot: { lastOutput: 'API created' },
      memoryEntryIds: [1, 2, 3],
      isAutoSave: false,
      metadata: { reason: 'manual' },
    });

    expect(result.name).toBe('before-delegation');
    expect(result.completedTaskIds).toHaveLength(1);
    expect(result.memoryEntryIds).toContain(2);
    expect(result.isAutoSave).toBe(false);
  });
});

describe('CreateSessionInputSchema', () => {
  it('should validate minimal input', () => {
    const result = CreateSessionInputSchema.parse({
      name: 'New Session',
      agents: ['backend'],
    });

    expect(result.name).toBe('New Session');
    expect(result.agents).toContain('backend');
  });

  it('should validate full input', () => {
    const result = CreateSessionInputSchema.parse({
      name: 'Feature Session',
      description: 'Building auth feature',
      agents: ['backend', 'security'],
      goal: 'Implement OAuth',
      tasks: [
        { description: 'Design API', agentId: 'backend' },
        { description: 'Security audit', agentId: 'security' },
      ],
      tags: ['feature', 'oauth'],
      metadata: { sprint: 5 },
    });

    expect(result.tasks).toHaveLength(2);
    expect(result.tags).toContain('oauth');
  });

  it('should reject empty name', () => {
    expect(() => CreateSessionInputSchema.parse({
      name: '',
      agents: ['backend'],
    })).toThrow();
  });
});

describe('AddTaskInputSchema', () => {
  it('should validate minimal input', () => {
    const result = AddTaskInputSchema.parse({
      sessionId: TEST_SESSION_ID,
      description: 'New task',
      agentId: 'backend',
    });

    expect(result.description).toBe('New task');
    expect(result.agentId).toBe('backend');
  });

  it('should validate input with parent', () => {
    const result = AddTaskInputSchema.parse({
      sessionId: TEST_SESSION_ID,
      description: 'Subtask',
      agentId: 'backend',
      parentTaskId: TEST_TASK_ID,
      metadata: { priority: 'high' },
    });

    expect(result.parentTaskId).toBeDefined();
  });
});

describe('UpdateTaskInputSchema', () => {
  it('should validate status update', () => {
    const result = UpdateTaskInputSchema.parse({
      sessionId: TEST_SESSION_ID,
      taskId: TEST_TASK_ID,
      status: 'running',
    });

    expect(result.status).toBe('running');
  });

  it('should validate completion update', () => {
    const result = UpdateTaskInputSchema.parse({
      sessionId: TEST_SESSION_ID,
      taskId: TEST_TASK_ID,
      status: 'completed',
      result: 'Task completed successfully',
    });

    expect(result.result).toContain('successfully');
  });

  it('should validate failure update', () => {
    const result = UpdateTaskInputSchema.parse({
      sessionId: TEST_SESSION_ID,
      taskId: TEST_TASK_ID,
      status: 'failed',
      error: 'Connection timeout',
    });

    expect(result.error).toContain('timeout');
  });
});

describe('SessionSummarySchema', () => {
  it('should validate summary', () => {
    const result = SessionSummarySchema.parse({
      id: TEST_SESSION_ID,
      name: 'Test Session',
      state: 'active',
      agentCount: 2,
      totalTasks: 5,
      completedTasks: 3,
      failedTasks: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.agentCount).toBe(2);
    expect(result.completedTasks).toBe(3);
  });
});

describe('createSessionSummary', () => {
  it('should create summary from session', () => {
    const session = {
      id: TEST_SESSION_ID as any,
      name: 'Test Session',
      state: 'active' as const,
      agents: ['backend', 'frontend'],
      tasks: [
        { id: TEST_TASK_ID, description: 'Task 1', agentId: 'backend', status: 'completed' as const },
        { id: TEST_TASK_ID_2, description: 'Task 2', agentId: 'frontend', status: 'failed' as const },
        { id: '880e8400-e29b-41d4-a716-446655440000', description: 'Task 3', agentId: 'backend', status: 'pending' as const },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    };

    const summary = createSessionSummary(session);

    expect(summary.id).toBe(TEST_SESSION_ID);
    expect(summary.agentCount).toBe(2);
    expect(summary.totalTasks).toBe(3);
    expect(summary.completedTasks).toBe(1);
    expect(summary.failedTasks).toBe(1);
  });
});

describe('DelegationRequestSchema', () => {
  it('should validate minimal request', () => {
    const result = DelegationRequestSchema.parse({
      fromAgent: 'backend',
      toAgent: 'frontend',
      task: 'Create UI component',
    });

    expect(result.fromAgent).toBe('backend');
    expect(result.toAgent).toBe('frontend');
    expect(result.context.delegationChain).toEqual([]);
  });

  it('should validate full request', () => {
    const result = DelegationRequestSchema.parse({
      fromAgent: 'backend',
      toAgent: 'frontend',
      task: 'Create UI component',
      context: {
        sharedData: { apiSpec: 'openapi.yaml' },
        requirements: ['responsive', 'accessible'],
        expectedOutputs: ['component.tsx'],
        sessionId: TEST_SESSION_ID,
        delegationChain: ['product'],
      },
      options: {
        timeout: 60000,
        priority: 'high',
        waitForResult: true,
      },
    });

    expect(result.context.requirements).toContain('responsive');
    expect(result.options.priority).toBe('high');
  });
});

describe('DelegationResultSchema', () => {
  it('should validate successful result', () => {
    const result = DelegationResultSchema.parse({
      success: true,
      request: {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI',
      },
      result: 'Component created',
      duration: 5000,
      completedBy: 'frontend',
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('Component created');
  });

  it('should validate failed result', () => {
    const result = DelegationResultSchema.parse({
      success: false,
      request: {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI',
      },
      error: 'Agent unavailable',
      duration: 100,
      completedBy: 'backend',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('unavailable');
  });
});

describe('validateSession', () => {
  it('should validate valid session', () => {
    const session = validateSession({
      id: TEST_SESSION_ID,
      name: 'Test',
      agents: ['backend'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(session.id).toBe(TEST_SESSION_ID);
  });
});

describe('validateCheckpoint', () => {
  it('should validate valid checkpoint', () => {
    const now = new Date();
    const checkpoint = validateCheckpoint({
      id: TEST_CHECKPOINT_ID,
      sessionId: TEST_SESSION_ID,
      createdAt: now,
      sessionState: {
        id: TEST_SESSION_ID,
        name: 'Test',
        agents: ['backend'],
        createdAt: now,
        updatedAt: now,
      },
      currentTaskIndex: 0,
    });

    expect(checkpoint.id).toBe(TEST_CHECKPOINT_ID);
  });
});

describe('validateCreateSessionInput', () => {
  it('should validate valid input', () => {
    const input = validateCreateSessionInput({
      name: 'Test Session',
      agents: ['backend'],
    });

    expect(input.name).toBe('Test Session');
  });
});
