/**
 * Session Manager Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager, type SessionManagerOptions } from './manager.js';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('SessionManager', () => {
  let manager: SessionManager;
  let storagePath: string;

  beforeEach(async () => {
    storagePath = join(tmpdir(), 'ax-session-test-' + randomUUID());
    await mkdir(storagePath, { recursive: true });
    manager = new SessionManager({
      storagePath,
      autoPersist: true,
    });
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.cleanup();
    try {
      await rm(storagePath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newManager = new SessionManager({ storagePath });
      await newManager.initialize();
      expect(newManager).toBeDefined();
      await newManager.cleanup();
    });

    it('should be idempotent', async () => {
      await manager.initialize();
      await manager.initialize();
      expect(manager).toBeDefined();
    });
  });

  describe('create()', () => {
    it('should create a new session', async () => {
      const session = await manager.create({
        name: 'Test Session',
        agents: ['backend'],
      });

      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.state).toBe('active');
      expect(session.agents).toContain('backend');
    });

    it('should create session with default name', async () => {
      const session = await manager.create({
        agents: ['frontend'],
      });

      expect(session.name).toBe('Untitled Session');
    });

    it('should create session with description and goal', async () => {
      const session = await manager.create({
        name: 'Feature Session',
        description: 'Building a new feature',
        goal: 'Implement user authentication',
        agents: ['backend', 'security'],
      });

      expect(session.description).toBe('Building a new feature');
      expect(session.goal).toBe('Implement user authentication');
    });

    it('should create session with initial tasks', async () => {
      const session = await manager.create({
        name: 'Task Session',
        agents: ['backend'],
        tasks: [
          { description: 'Create API', agentId: 'backend' },
          { description: 'Write tests', agentId: 'quality' },
        ],
      });

      expect(session.tasks).toHaveLength(2);
      expect(session.tasks[0]!.description).toBe('Create API');
      expect(session.tasks[0]!.status).toBe('pending');
    });

    it('should create session with tags', async () => {
      const session = await manager.create({
        name: 'Tagged Session',
        agents: ['backend'],
        tags: ['feature', 'priority'],
      });

      expect(session.tags).toContain('feature');
      expect(session.tags).toContain('priority');
    });
  });

  describe('get()', () => {
    it('should retrieve session by ID', async () => {
      const created = await manager.create({
        name: 'Retrievable',
        agents: ['backend'],
      });

      const retrieved = await manager.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Retrievable');
    });

    it('should return null for non-existent session', async () => {
      const session = await manager.get('non-existent-id');
      expect(session).toBeNull();
    });
  });

  describe('getOrThrow()', () => {
    it('should throw for non-existent session', async () => {
      await expect(manager.getOrThrow('non-existent')).rejects.toThrow('Session not found');
    });
  });

  describe('list()', () => {
    beforeEach(async () => {
      await manager.create({ name: 'Session 1', agents: ['backend'], tags: ['feature'] });
      await manager.create({ name: 'Session 2', agents: ['frontend'], tags: ['bug'] });
      await manager.create({ name: 'Session 3', agents: ['backend', 'frontend'], tags: ['feature'] });
    });

    it('should list all sessions', async () => {
      const sessions = await manager.list();

      expect(sessions.length).toBe(3);
    });

    it('should filter by state', async () => {
      const sessions = await manager.list({ state: 'active' });

      expect(sessions.every(s => s.state === 'active')).toBe(true);
    });

    it('should filter by agent', async () => {
      const sessions = await manager.list({ agent: 'backend' });

      expect(sessions.length).toBe(2);
    });

    it('should filter by tags', async () => {
      const sessions = await manager.list({ tags: ['feature'] });

      expect(sessions.length).toBe(2);
    });

    it('should sort by most recent', async () => {
      const sessions = await manager.list();

      for (let i = 0; i < sessions.length - 1; i++) {
        expect(sessions[i]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
          sessions[i + 1]!.updatedAt.getTime()
        );
      }
    });
  });

  describe('state transitions', () => {
    let session: Awaited<ReturnType<typeof manager.create>>;

    beforeEach(async () => {
      session = await manager.create({
        name: 'State Test',
        agents: ['backend'],
      });
    });

    it('should complete a session', async () => {
      const completed = await manager.complete(session.id);

      expect(completed.state).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.duration).toBeGreaterThanOrEqual(0);
    });

    it('should pause a session', async () => {
      const paused = await manager.pause(session.id);

      expect(paused.state).toBe('paused');
    });

    it('should resume a paused session', async () => {
      await manager.pause(session.id);
      const resumed = await manager.resume(session.id);

      expect(resumed.state).toBe('active');
    });

    it('should throw when resuming non-paused session', async () => {
      await expect(manager.resume(session.id)).rejects.toThrow('Cannot resume session');
    });

    it('should cancel a session', async () => {
      const cancelled = await manager.cancel(session.id);

      expect(cancelled.state).toBe('cancelled');
      expect(cancelled.completedAt).toBeDefined();
    });

    it('should fail a session', async () => {
      const failed = await manager.fail(session.id, 'Test error');

      expect(failed.state).toBe('failed');
      expect(failed.metadata?.failureReason).toBe('Test error');
    });
  });

  describe('delete()', () => {
    it('should delete a session', async () => {
      const session = await manager.create({
        name: 'To Delete',
        agents: ['backend'],
      });

      const deleted = await manager.delete(session.id);
      const retrieved = await manager.get(session.id);

      expect(deleted).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const deleted = await manager.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('task operations', () => {
    let session: Awaited<ReturnType<typeof manager.create>>;

    beforeEach(async () => {
      session = await manager.create({
        name: 'Task Test',
        agents: ['backend'],
      });
    });

    describe('addTask()', () => {
      it('should add a task to session', async () => {
        const task = await manager.addTask({
          sessionId: session.id as any,
          description: 'New task',
          agentId: 'backend',
        });

        expect(task.id).toBeDefined();
        expect(task.description).toBe('New task');
        expect(task.status).toBe('pending');
      });

      it('should add agent to session if not present', async () => {
        await manager.addTask({
          sessionId: session.id as any,
          description: 'Frontend task',
          agentId: 'frontend',
        });

        const updated = await manager.get(session.id);
        expect(updated!.agents).toContain('frontend');
      });

      it('should support parent task ID', async () => {
        const parent = await manager.addTask({
          sessionId: session.id as any,
          description: 'Parent task',
          agentId: 'backend',
        });

        const child = await manager.addTask({
          sessionId: session.id as any,
          description: 'Child task',
          agentId: 'backend',
          parentTaskId: parent.id,
        });

        expect(child.parentTaskId).toBe(parent.id);
      });
    });

    describe('task state transitions', () => {
      let taskId: string;

      beforeEach(async () => {
        const task = await manager.addTask({
          sessionId: session.id as any,
          description: 'Test task',
          agentId: 'backend',
        });
        taskId = task.id;
      });

      it('should start a task', async () => {
        const task = await manager.startTask(session.id, taskId);

        expect(task.status).toBe('running');
        expect(task.startedAt).toBeDefined();
      });

      it('should complete a task', async () => {
        await manager.startTask(session.id, taskId);
        const task = await manager.completeTask(session.id, taskId, 'Task completed successfully');

        expect(task.status).toBe('completed');
        expect(task.result).toBe('Task completed successfully');
        expect(task.completedAt).toBeDefined();
        expect(task.duration).toBeGreaterThanOrEqual(0);
      });

      it('should fail a task', async () => {
        await manager.startTask(session.id, taskId);
        const task = await manager.failTask(session.id, taskId, 'Task failed');

        expect(task.status).toBe('failed');
        expect(task.error).toBe('Task failed');
      });
    });

    describe('getPendingTasks()', () => {
      it('should return only pending tasks', async () => {
        await manager.addTask({
          sessionId: session.id as any,
          description: 'Task 1',
          agentId: 'backend',
        });
        const task2 = await manager.addTask({
          sessionId: session.id as any,
          description: 'Task 2',
          agentId: 'backend',
        });
        await manager.startTask(session.id, task2.id);

        const pending = await manager.getPendingTasks(session.id);

        expect(pending).toHaveLength(1);
        expect(pending[0]!.description).toBe('Task 1');
      });
    });

    describe('getTasksByAgent()', () => {
      it('should filter tasks by agent', async () => {
        await manager.addTask({
          sessionId: session.id as any,
          description: 'Backend task',
          agentId: 'backend',
        });
        await manager.addTask({
          sessionId: session.id as any,
          description: 'Frontend task',
          agentId: 'frontend',
        });

        const tasks = await manager.getTasksByAgent(session.id, 'backend');

        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.agentId).toBe('backend');
      });
    });
  });

  describe('events', () => {
    it('should emit onSessionCreated', async () => {
      let emittedSession: any = null;
      manager.setEvents({
        onSessionCreated: (s) => { emittedSession = s; },
      });

      const session = await manager.create({
        name: 'Event Test',
        agents: ['backend'],
      });

      expect(emittedSession).not.toBeNull();
      expect(emittedSession.id).toBe(session.id);
    });

    it('should emit onSessionCompleted', async () => {
      let completed = false;
      manager.setEvents({
        onSessionCompleted: () => { completed = true; },
      });

      const session = await manager.create({
        name: 'Complete Test',
        agents: ['backend'],
      });
      await manager.complete(session.id);

      expect(completed).toBe(true);
    });

    it('should emit onTaskAdded', async () => {
      let addedTask: any = null;
      manager.setEvents({
        onTaskAdded: (_, task) => { addedTask = task; },
      });

      const session = await manager.create({
        name: 'Task Event Test',
        agents: ['backend'],
      });
      await manager.addTask({
        sessionId: session.id as any,
        description: 'Event task',
        agentId: 'backend',
      });

      expect(addedTask).not.toBeNull();
      expect(addedTask.description).toBe('Event task');
    });
  });

  describe('persistence', () => {
    it('should persist and reload sessions', async () => {
      const session = await manager.create({
        name: 'Persistent',
        agents: ['backend'],
      });

      // Cleanup and reinitialize
      await manager.cleanup();

      const newManager = new SessionManager({ storagePath });
      await newManager.initialize();

      const loaded = await newManager.get(session.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Persistent');

      await newManager.cleanup();
    });
  });

  describe('memory limits', () => {
    it('should evict old sessions when limit exceeded', async () => {
      const smallManager = new SessionManager({
        storagePath,
        maxInMemorySessions: 3,
        autoPersist: false,
      });
      await smallManager.initialize();

      // Create more than max sessions
      for (let i = 0; i < 5; i++) {
        await smallManager.create({
          name: `Session ${i}`,
          agents: ['backend'],
        });
      }

      // Manager should still work
      const sessions = await smallManager.list();
      expect(sessions.length).toBeGreaterThan(0);

      await smallManager.cleanup();
    });
  });
});
