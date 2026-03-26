import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateJsonToSqlite } from '../src/migrate.js';
import { SqliteStateStore } from '../src/sqlite.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `state-sqlite-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('SqliteStateStore', () => {
  const tempDirs: string[] = [];
  function store(dir: string) { return new SqliteStateStore({ basePath: dir }); }

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  // -------------------------------------------------------------------------
  // Memory + FTS
  // -------------------------------------------------------------------------

  it('stores and retrieves memory by key/namespace', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeMemory({ key: 'version', namespace: 'release', value: { tag: 'v14.0.0' } });
    const entry = await s.getMemory('version', 'release');
    expect(entry).toMatchObject({ key: 'version', value: { tag: 'v14.0.0' } });
  });

  it('full-text search returns BM25-ranked results', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeMemory({ key: 'a', namespace: 'docs', value: 'authentication and authorization guide' });
    await s.storeMemory({ key: 'b', namespace: 'docs', value: 'database migration checklist' });
    await s.storeMemory({ key: 'c', namespace: 'docs', value: 'authentication token refresh flow' });

    const results = await s.searchMemory('authentication', 'docs');
    expect(results.length).toBeGreaterThanOrEqual(2);
    // both auth entries should appear, db migration should not
    const keys = results.map((r) => r.key);
    expect(keys).toContain('a');
    expect(keys).toContain('c');
  });

  it('updates existing memory entry in place', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeMemory({ key: 'cfg', namespace: 'app', value: { debug: false } });
    await s.storeMemory({ key: 'cfg', namespace: 'app', value: { debug: true } });
    const all = await s.listMemory('app');
    expect(all).toHaveLength(1);
    expect((all[0]?.value as Record<string, unknown>)['debug']).toBe(true);
  });

  it('deletes memory entry', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeMemory({ key: 'x', namespace: 'tmp', value: 1 });
    expect(await s.deleteMemory('x', 'tmp')).toBe(true);
    expect(await s.getMemory('x', 'tmp')).toBeUndefined();
    expect(await s.deleteMemory('x', 'tmp')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Agents
  // -------------------------------------------------------------------------

  it('registers agents idempotently and rejects conflicting duplicates', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    const first = await s.registerAgent({ agentId: 'arch', name: 'Architect', capabilities: ['design', 'review'] });
    const second = await s.registerAgent({ agentId: 'arch', name: 'Architect', capabilities: ['review', 'design'] });
    expect(second).toEqual(first);

    await expect(s.registerAgent({ agentId: 'arch', name: 'Architect', capabilities: ['ops'] }))
      .rejects.toThrow('already registered');

    expect(await s.listAgentCapabilities()).toEqual(['design', 'review']);
    expect(await s.removeAgent('arch')).toBe(true);
    expect(await s.getAgent('arch')).toBeUndefined();
  });

  it('lists all agent capabilities deduplicated across agents', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.registerAgent({ agentId: 'a1', name: 'A', capabilities: ['ship', 'review'] });
    await s.registerAgent({ agentId: 'a2', name: 'B', capabilities: ['review', 'test'] });
    expect(await s.listAgentCapabilities()).toEqual(['review', 'ship', 'test']);
  });

  // -------------------------------------------------------------------------
  // Policies
  // -------------------------------------------------------------------------

  it('registers and lists policies', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.registerPolicy({ policyId: 'safe-fs', name: 'Safe Filesystem', enabled: true });
    await s.registerPolicy({ policyId: 'no-secrets', name: 'No Secrets', enabled: false });
    const policies = await s.listPolicies();
    expect(policies).toHaveLength(2);
    expect(policies.find((p) => p.policyId === 'no-secrets')?.enabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Semantic search (TF cosine)
  // -------------------------------------------------------------------------

  it('semantic search returns relevant results by TF similarity', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeSemantic({ namespace: 'agents', key: 'arch', content: 'architecture design system planning', tags: ['design'] });
    await s.storeSemantic({ namespace: 'agents', key: 'qa',   content: 'regression testing quality assurance', tags: ['testing'] });

    const results = await s.searchSemantic('architecture planning', { namespace: 'agents', topK: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.key).toBe('arch');
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it('semantic stats group by namespace', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeSemantic({ namespace: 'ns1', key: 'a', content: 'foo bar', tags: ['t1', 't2'] });
    await s.storeSemantic({ namespace: 'ns1', key: 'b', content: 'baz qux', tags: ['t1'] });

    const stats = await s.semanticStats('ns1');
    expect(stats).toMatchObject([{ namespace: 'ns1', totalItems: 2 }]);
    expect(stats[0]?.uniqueTags).toBe(2);
  });

  it('clears semantic namespace', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.storeSemantic({ namespace: 'clear-me', key: 'a', content: 'x' });
    await s.storeSemantic({ namespace: 'clear-me', key: 'b', content: 'y' });
    const cleared = await s.clearSemantic('clear-me');
    expect(cleared).toBe(2);
    expect(await s.listSemantic({ namespace: 'clear-me' })).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Feedback
  // -------------------------------------------------------------------------

  it('stores and filters feedback by agent and limit', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.submitFeedback({ selectedAgent: 'arch', rating: 5, taskDescription: 'design review', outcome: 'accepted' });
    await s.submitFeedback({ selectedAgent: 'qa',   rating: 3, taskDescription: 'regression run',  outcome: 'partial' });
    await s.submitFeedback({ selectedAgent: 'arch', rating: 4, taskDescription: 'follow-up',       outcome: 'accepted' });

    const archHistory = await s.listFeedback({ agentId: 'arch' });
    expect(archHistory).toHaveLength(2);
    expect(archHistory.every((f) => f.selectedAgent === 'arch')).toBe(true);

    const limited = await s.listFeedback({ limit: 1 });
    expect(limited).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  it('persists full session lifecycle', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    const sess = await s.createSession({ sessionId: 'sess-001', task: 'Coordinate release', initiator: 'arch', workspace: '/repo' });
    expect(sess.status).toBe('active');

    await s.joinSession({ sessionId: sess.sessionId, agentId: 'qa', role: 'collaborator' });
    await s.leaveSession(sess.sessionId, 'qa');
    await s.completeSession(sess.sessionId, 'Done');

    const loaded = await s.getSession('sess-001');
    expect(loaded?.status).toBe('completed');
    expect(loaded?.summary).toBe('Done');
    expect(loaded?.participants.find((p) => p.agentId === 'qa')?.leftAt).toBeDefined();
  });

  it('fails a session with error message', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.createSession({ sessionId: 'sess-fail', task: 'Risky task', initiator: 'arch' });
    await s.failSession('sess-fail', 'Provider timeout');
    const loaded = await s.getSession('sess-fail');
    expect(loaded?.status).toBe('failed');
    expect(loaded?.error?.message).toBe('Provider timeout');
  });

  it('closes stuck sessions older than threshold', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.createSession({ sessionId: 'stuck-1', task: 'Old task', initiator: 'arch' });
    // Use maxAgeMs=0 so any session counts as stuck
    const closed = await s.closeStuckSessions(0);
    expect(closed).toMatchObject([{ sessionId: 'stuck-1', status: 'failed' }]);
    expect((await s.getSession('stuck-1'))?.error?.message).toBe('Auto-closed as stuck session');
  });

  it('lists sessions by status with newest entries first', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.createSession({ sessionId: 'active-old', task: 'Old active task', initiator: 'arch' });
    await s.createSession({ sessionId: 'active-new', task: 'New active task', initiator: 'arch' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await s.joinSession({ sessionId: 'active-new', agentId: 'qa', role: 'collaborator' });
    await s.createSession({ sessionId: 'failed-one', task: 'Failed task', initiator: 'arch' });
    await s.failSession('failed-one', 'boom');

    await expect(s.listSessionsByStatus('active')).resolves.toMatchObject([
      { sessionId: 'active-new', status: 'active' },
      { sessionId: 'active-old', status: 'active' },
    ]);
    await expect(s.getSessionStatusCounts()).resolves.toMatchObject({
      total: 3,
      active: 2,
      completed: 0,
      failed: 1,
    });
    await expect(s.countSessions()).resolves.toBe(3);
    await expect(s.countSessions('active')).resolves.toBe(2);
    await expect(s.countSessions('failed')).resolves.toBe(1);
  });

  it('prevents joining a completed session', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.createSession({ sessionId: 'done-1', task: 'Task', initiator: 'arch' });
    await s.completeSession('done-1');
    await expect(s.joinSession({ sessionId: 'done-1', agentId: 'qa' })).rejects.toThrow('not active');
  });

  // -------------------------------------------------------------------------
  // JSON migration
  // -------------------------------------------------------------------------

  it('imports data from JSON state and makes it queryable', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.importFromJson({
      memory: [{ key: 'migrated-key', namespace: 'import', value: { from: 'json' }, updatedAt: new Date().toISOString() }],
      agents: [{
        agentId: 'imported-agent', name: 'Imported', capabilities: ['run'],
        registrationKey: '{}', registeredAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
    });
    expect(await s.getMemory('migrated-key', 'import')).toMatchObject({ key: 'migrated-key' });
    expect(await s.getAgent('imported-agent')).toMatchObject({ agentId: 'imported-agent' });
  });

  it('skips migration when state.json is valid JSON but not an object', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const stateFile = join(dir, '.automatosx', 'runtime', 'state.json');
    mkdirSync(join(dir, '.automatosx', 'runtime'), { recursive: true });
    await writeFile(stateFile, '["not-an-object"]', 'utf8');

    await expect(migrateJsonToSqlite({ basePath: dir })).resolves.toMatchObject({
      skipped: true,
      reason: 'state.json is not valid JSON — skipping migration.',
    });
  });
});
