/**
 * Session Domain Tests
 *
 * Tests for session store and manager functionality.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionStore, SessionVersionConflictError, createSessionStore, DefaultSessionManager, SessionError, createSessionManager, DEFAULT_SESSION_DOMAIN_CONFIG, } from '@defai.digital/session-domain';
import { SessionErrorCode } from '@defai.digital/contracts';
describe('Session Domain', () => {
    describe('InMemorySessionStore', () => {
        let store;
        beforeEach(() => {
            store = new InMemorySessionStore();
        });
        describe('create', () => {
            it('should create a session with valid input', async () => {
                const session = await store.create({
                    initiator: 'code-agent',
                    task: 'Review authentication module',
                });
                expect(session.sessionId).toBeDefined();
                expect(session.initiator).toBe('code-agent');
                expect(session.task).toBe('Review authentication module');
                expect(session.status).toBe('active');
                expect(session.participants).toHaveLength(1);
                expect(session.participants[0].agentId).toBe('code-agent');
                expect(session.participants[0].role).toBe('initiator');
                expect(session.version).toBe(1);
            });
            it('should create session with workspace and metadata', async () => {
                const session = await store.create({
                    initiator: 'code-agent',
                    task: 'Test task',
                    workspace: '/project',
                    metadata: { priority: 'high' },
                });
                expect(session.workspace).toBe('/project');
                expect(session.metadata).toEqual({ priority: 'high' });
            });
        });
        describe('get', () => {
            it('should return session by ID', async () => {
                const created = await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const retrieved = await store.get(created.sessionId);
                expect(retrieved).toBeDefined();
                expect(retrieved?.sessionId).toBe(created.sessionId);
            });
            it('should return undefined for non-existent session', async () => {
                const result = await store.get('non-existent-id');
                expect(result).toBeUndefined();
            });
        });
        describe('update', () => {
            it('should update session with correct version', async () => {
                const session = await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const updated = {
                    ...session,
                    status: 'completed',
                    version: session.version + 1,
                };
                await store.update(session.sessionId, updated);
                const retrieved = await store.get(session.sessionId);
                expect(retrieved?.status).toBe('completed');
            });
            it('should throw on version conflict', async () => {
                const session = await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const staleUpdate = {
                    ...session,
                    status: 'completed',
                    version: 5, // Wrong version
                };
                await expect(store.update(session.sessionId, staleUpdate)).rejects.toThrow(SessionVersionConflictError);
            });
            it('should throw for non-existent session', async () => {
                const fakeSession = {
                    sessionId: 'non-existent',
                    initiator: 'agent',
                    task: 'Test',
                    participants: [],
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    appliedPolicies: [],
                };
                await expect(store.update('non-existent', fakeSession)).rejects.toThrow();
            });
        });
        describe('delete', () => {
            it('should delete a session', async () => {
                const session = await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await store.delete(session.sessionId);
                const retrieved = await store.get(session.sessionId);
                expect(retrieved).toBeUndefined();
            });
        });
        describe('list', () => {
            beforeEach(async () => {
                await store.create({
                    initiator: 'agent-1',
                    task: 'Task 1',
                    workspace: '/project-a',
                });
                await store.create({
                    initiator: 'agent-2',
                    task: 'Task 2',
                    workspace: '/project-b',
                });
            });
            it('should list all sessions', async () => {
                const sessions = await store.list();
                expect(sessions).toHaveLength(2);
            });
            it('should filter by initiator', async () => {
                const sessions = await store.list({ initiator: 'agent-1' });
                expect(sessions).toHaveLength(1);
                expect(sessions[0].initiator).toBe('agent-1');
            });
            it('should filter by workspace', async () => {
                const sessions = await store.list({ workspace: '/project-a' });
                expect(sessions).toHaveLength(1);
                expect(sessions[0].workspace).toBe('/project-a');
            });
            it('should limit results', async () => {
                const sessions = await store.list({ limit: 1 });
                expect(sessions).toHaveLength(1);
            });
        });
        describe('findActiveForAgent', () => {
            it('should find active session for agent', async () => {
                const session = await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const found = await store.findActiveForAgent('agent-1');
                expect(found).toBeDefined();
                expect(found?.sessionId).toBe(session.sessionId);
            });
            it('should return undefined for non-participant', async () => {
                await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const found = await store.findActiveForAgent('agent-2');
                expect(found).toBeUndefined();
            });
            it('should filter by workspace', async () => {
                await store.create({
                    initiator: 'agent-1',
                    task: 'Test',
                    workspace: '/project-a',
                });
                const found = await store.findActiveForAgent('agent-1', '/project-b');
                expect(found).toBeUndefined();
            });
        });
        describe('size and clear', () => {
            it('should return correct size', async () => {
                expect(store.size).toBe(0);
                await store.create({ initiator: 'agent-1', task: 'Task 1' });
                expect(store.size).toBe(1);
                await store.create({ initiator: 'agent-2', task: 'Task 2' });
                expect(store.size).toBe(2);
            });
            it('should clear all sessions', async () => {
                await store.create({ initiator: 'agent-1', task: 'Task 1' });
                await store.create({ initiator: 'agent-2', task: 'Task 2' });
                store.clear();
                expect(store.size).toBe(0);
            });
        });
    });
    describe('DefaultSessionManager', () => {
        let store;
        let manager;
        beforeEach(() => {
            store = new InMemorySessionStore();
            manager = new DefaultSessionManager(store, DEFAULT_SESSION_DOMAIN_CONFIG);
        });
        describe('createSession', () => {
            it('should create a session', async () => {
                const session = await manager.createSession({
                    initiator: 'code-agent',
                    task: 'Review code',
                });
                expect(session.sessionId).toBeDefined();
                expect(session.status).toBe('active');
            });
        });
        describe('getSession', () => {
            it('should get session by ID', async () => {
                const created = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const retrieved = await manager.getSession(created.sessionId);
                expect(retrieved?.sessionId).toBe(created.sessionId);
            });
        });
        describe('joinSession', () => {
            it('should add participant to session', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const updated = await manager.joinSession({
                    sessionId: session.sessionId,
                    agentId: 'agent-2',
                    role: 'collaborator',
                });
                expect(updated.participants).toHaveLength(2);
                expect(updated.participants[1].agentId).toBe('agent-2');
            });
            it('should return existing session if already joined', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const result = await manager.joinSession({
                    sessionId: session.sessionId,
                    agentId: 'agent-1', // Already initiator
                    role: 'collaborator',
                });
                expect(result.participants).toHaveLength(1);
            });
            it('should throw for non-existent session', async () => {
                await expect(manager.joinSession({
                    sessionId: 'non-existent',
                    agentId: 'agent-1',
                    role: 'collaborator',
                })).rejects.toThrow(SessionError);
            });
            it('should throw for completed session', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await manager.completeSession(session.sessionId);
                await expect(manager.joinSession({
                    sessionId: session.sessionId,
                    agentId: 'agent-2',
                    role: 'collaborator',
                })).rejects.toThrow(SessionError);
            });
        });
        describe('leaveSession', () => {
            it('should mark participant as left', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await manager.joinSession({
                    sessionId: session.sessionId,
                    agentId: 'agent-2',
                    role: 'collaborator',
                });
                const updated = await manager.leaveSession(session.sessionId, 'agent-2');
                const leftParticipant = updated.participants.find((p) => p.agentId === 'agent-2');
                expect(leftParticipant?.leftAt).toBeDefined();
            });
            it('should throw for non-participant', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await expect(manager.leaveSession(session.sessionId, 'agent-999')).rejects.toThrow(SessionError);
            });
        });
        describe('startTask', () => {
            it('should create task for participant', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const task = await manager.startTask({
                    sessionId: session.sessionId,
                    agentId: 'agent-1',
                    title: 'Analyze code',
                    description: 'Analyze the authentication module',
                });
                expect(task.taskId).toBeDefined();
                expect(task.title).toBe('Analyze code');
                expect(task.status).toBe('running');
                expect(task.startedAt).toBeDefined();
            });
            it('should throw for non-participant', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await expect(manager.startTask({
                    sessionId: session.sessionId,
                    agentId: 'non-participant',
                    title: 'Task',
                })).rejects.toThrow(SessionError);
            });
            it('should throw for completed session', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await manager.completeSession(session.sessionId);
                await expect(manager.startTask({
                    sessionId: session.sessionId,
                    agentId: 'agent-1',
                    title: 'Task',
                })).rejects.toThrow(SessionError);
            });
        });
        describe('completeTask', () => {
            it('should mark task as completed', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const task = await manager.startTask({
                    sessionId: session.sessionId,
                    agentId: 'agent-1',
                    title: 'Task 1',
                });
                const completed = await manager.completeTask({
                    sessionId: session.sessionId,
                    taskId: task.taskId,
                    output: { result: 'success' },
                });
                expect(completed.status).toBe('completed');
                expect(completed.completedAt).toBeDefined();
                expect(completed.durationMs).toBeGreaterThanOrEqual(0);
                expect(completed.output).toEqual({ result: 'success' });
            });
            it('should throw for non-existent task', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await expect(manager.completeTask({
                    sessionId: session.sessionId,
                    taskId: 'non-existent',
                })).rejects.toThrow(SessionError);
            });
        });
        describe('failTask', () => {
            it('should mark task as failed', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const task = await manager.startTask({
                    sessionId: session.sessionId,
                    agentId: 'agent-1',
                    title: 'Task 1',
                });
                const failed = await manager.failTask({
                    sessionId: session.sessionId,
                    taskId: task.taskId,
                    error: {
                        code: 'TASK_FAILED',
                        message: 'Analysis failed',
                    },
                });
                expect(failed.status).toBe('failed');
                expect(failed.error?.code).toBe('TASK_FAILED');
            });
        });
        describe('completeSession', () => {
            it('should mark session as completed', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const completed = await manager.completeSession(session.sessionId, 'All tasks done');
                expect(completed.status).toBe('completed');
                expect(completed.completedAt).toBeDefined();
                expect(completed.metadata?.summary).toBe('All tasks done');
            });
            it('should throw for non-existent session', async () => {
                await expect(manager.completeSession('non-existent')).rejects.toThrow(SessionError);
            });
            it('should throw for already completed session', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await manager.completeSession(session.sessionId);
                await expect(manager.completeSession(session.sessionId)).rejects.toThrow(SessionError);
            });
        });
        describe('failSession', () => {
            it('should mark session as failed', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                const failed = await manager.failSession(session.sessionId, {
                    code: 'SESSION_ERROR',
                    message: 'Critical failure',
                });
                expect(failed.status).toBe('failed');
                const error = failed.metadata?.error;
                expect(error?.code).toBe('SESSION_ERROR');
            });
            it('should not allow transition from failed', async () => {
                const session = await manager.createSession({
                    initiator: 'agent-1',
                    task: 'Test',
                });
                await manager.failSession(session.sessionId, {
                    code: 'ERROR',
                    message: 'Failed',
                });
                await expect(manager.completeSession(session.sessionId)).rejects.toThrow(SessionError);
            });
        });
        describe('listSessions', () => {
            it('should list all sessions', async () => {
                await manager.createSession({ initiator: 'agent-1', task: 'Task 1' });
                await manager.createSession({ initiator: 'agent-2', task: 'Task 2' });
                const sessions = await manager.listSessions();
                expect(sessions).toHaveLength(2);
            });
            it('should filter sessions', async () => {
                await manager.createSession({ initiator: 'agent-1', task: 'Task 1' });
                const session2 = await manager.createSession({
                    initiator: 'agent-2',
                    task: 'Task 2',
                });
                await manager.completeSession(session2.sessionId);
                const active = await manager.listSessions({ status: 'active' });
                expect(active).toHaveLength(1);
            });
        });
    });
    describe('createSessionStore', () => {
        it('should create an InMemorySessionStore', () => {
            const store = createSessionStore();
            expect(store).toBeInstanceOf(InMemorySessionStore);
        });
    });
    describe('createSessionManager', () => {
        it('should create a DefaultSessionManager', () => {
            const store = createSessionStore();
            const manager = createSessionManager(store, DEFAULT_SESSION_DOMAIN_CONFIG);
            expect(manager).toBeInstanceOf(DefaultSessionManager);
        });
    });
    describe('SessionError', () => {
        it('should have correct properties', () => {
            const error = new SessionError(SessionErrorCode.SESSION_NOT_FOUND, 'Session not found');
            expect(error.code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
            expect(error.message).toBe('Session not found');
            expect(error.name).toBe('SessionError');
        });
    });
    describe('SessionVersionConflictError', () => {
        it('should have correct properties', () => {
            const error = new SessionVersionConflictError('session-1', 1, 3);
            expect(error.sessionId).toBe('session-1');
            expect(error.expectedVersion).toBe(1);
            expect(error.actualVersion).toBe(3);
            expect(error.name).toBe('SessionVersionConflictError');
        });
    });
});
//# sourceMappingURL=session-domain.test.js.map