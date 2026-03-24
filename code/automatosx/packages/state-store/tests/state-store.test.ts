import { mkdirSync } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createStateStore } from '../src/index.js';
import { ensurePackageBuilt } from '../../../tests/support/ensure-built.js';

const execFileAsync = promisify(execFile);

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `state-store-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('state store', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('registers agents idempotently and rejects conflicting duplicates', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createStateStore({ basePath: tempDir });
    const first = await store.registerAgent({
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['design', 'review', 'design'],
      metadata: { team: 'platform', level: 2 },
    });
    const second = await store.registerAgent({
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['review', 'design'],
      metadata: { level: 2, team: 'platform' },
    });

    expect(second).toEqual(first);
    await expect(store.registerAgent({
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['ops'],
    })).rejects.toThrow('already registered');

    expect(await store.listAgentCapabilities()).toEqual(['design', 'review']);
    expect(await store.removeAgent('architect')).toBe(true);
    expect(await store.getAgent('architect')).toBeUndefined();
    expect(await store.removeAgent('architect')).toBe(false);
  });

  it('serializes concurrent writes across store instances', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const storeA = createStateStore({ basePath: tempDir });
    const storeB = createStateStore({ basePath: tempDir });

    await Promise.all([
      storeA.storeMemory({ namespace: 'release', key: 'latest', value: { version: '14.0.0' } }),
      storeB.registerPolicy({ policyId: 'bugfix', name: 'Bugfix' }),
      storeA.registerAgent({ agentId: 'qa', name: 'QA', capabilities: ['validate'] }),
      storeB.registerAgent({ agentId: 'release', name: 'Release', capabilities: ['ship'] }),
    ]);

    const [memory, policies, agents] = await Promise.all([
      storeA.listMemory('release'),
      storeA.listPolicies(),
      storeA.listAgents(),
    ]);

    expect(memory).toHaveLength(1);
    expect(policies).toHaveLength(1);
    expect(agents.map((agent) => agent.agentId)).toEqual(['qa', 'release']);
  });

  it('preserves writes across concurrent node processes', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await ensurePackageBuilt('state-store');

    const workerSource = [
      'import { createStateStore } from "./packages/state-store/dist/index.js";',
      'const store = createStateStore({ basePath: process.env.AX_BASE_PATH });',
      'const prefix = process.env.AX_PREFIX;',
      'for (let index = 0; index < 20; index += 1) {',
      '  await store.storeMemory({ namespace: "multi", key: `${prefix}-${index}`, value: { index, prefix } });',
      '  await new Promise((resolve) => setTimeout(resolve, index % 2 === 0 ? 2 : 1));',
      '}',
      '',
    ].join('\n');

    await Promise.all([
      execFileAsync('node', ['--input-type=module', '--eval', workerSource], {
        cwd: process.cwd(),
        env: { ...process.env, AX_BASE_PATH: tempDir, AX_PREFIX: 'proc-a' },
      }),
      execFileAsync('node', ['--input-type=module', '--eval', workerSource], {
        cwd: process.cwd(),
        env: { ...process.env, AX_BASE_PATH: tempDir, AX_PREFIX: 'proc-b' },
      }),
    ]);

    const store = createStateStore({ basePath: tempDir });
    const memory = await store.listMemory('multi');

    expect(memory).toHaveLength(40);
    expect(memory.some((entry) => entry.key === 'proc-a-0')).toBe(true);
    expect(memory.some((entry) => entry.key === 'proc-b-19')).toBe(true);
  });

  it('retrieves, searches, and deletes memory entries', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createStateStore({ basePath: tempDir });
    await store.storeMemory({ namespace: 'release', key: 'latest', value: { version: '14.0.0' } });
    await store.storeMemory({ namespace: 'qa', key: 'checkout', value: { target: 'checkout flow' } });

    const loaded = await store.getMemory('latest', 'release');
    expect(loaded).toMatchObject({
      key: 'latest',
      namespace: 'release',
    });

    const searched = await store.searchMemory('checkout');
    expect(searched).toMatchObject([
      {
        key: 'checkout',
        namespace: 'qa',
      },
    ]);

    expect(await store.deleteMemory('latest', 'release')).toBe(true);
    expect(await store.getMemory('latest', 'release')).toBeUndefined();
  });

  it('uses custom storageFile for the default sqlite backend', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const customDbFile = join(tempDir, 'custom', 'state-custom.db');
    const store = createStateStore({ basePath: tempDir, storageFile: customDbFile });
    await store.storeMemory({ namespace: 'release', key: 'latest', value: { version: '14.0.0' } });

    await expect(stat(customDbFile)).resolves.toMatchObject({
      isFile: expect.any(Function),
    });
  });

  it('stores, searches, lists, and clears semantic entries by namespace', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createStateStore({ basePath: tempDir });
    await store.storeSemantic({
      namespace: 'agents',
      key: 'architect-rollout',
      content: 'Architecture rollout planning and system design guidance',
      tags: ['architecture', 'planning'],
    });
    await store.storeSemantic({
      namespace: 'agents',
      key: 'qa-regression',
      content: 'Regression testing checklist for checkout flow',
      tags: ['qa', 'testing'],
    });

    const found = await store.searchSemantic('architecture planning', {
      namespace: 'agents',
      topK: 1,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      key: 'architect-rollout',
    });
    expect(found[0]?.score).toBeGreaterThan(0);

    const listed = await store.listSemantic({
      namespace: 'agents',
      filterTags: ['architecture'],
    });
    expect(listed).toMatchObject([
      {
        key: 'architect-rollout',
      },
    ]);

    const stats = await store.semanticStats('agents');
    expect(stats).toMatchObject([
      {
        namespace: 'agents',
        totalItems: 2,
      },
    ]);

    expect(await store.deleteSemantic('qa-regression', 'agents')).toBe(true);
    expect(await store.clearSemantic('agents')).toBe(1);
    expect(await store.listSemantic({ namespace: 'agents' })).toEqual([]);
  });

  it('stores and filters feedback entries', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createStateStore({ basePath: tempDir });
    await store.submitFeedback({
      selectedAgent: 'architect',
      rating: 5,
      taskDescription: 'Review rollout plan',
      outcome: 'accepted',
    });
    await store.submitFeedback({
      selectedAgent: 'qa',
      rating: 3,
      taskDescription: 'Regression run',
      outcome: 'partial',
    });

    const architectHistory = await store.listFeedback({ agentId: 'architect' });
    const allHistory = await store.listFeedback({ limit: 1 });

    expect(architectHistory).toMatchObject([
      {
        selectedAgent: 'architect',
        rating: 5,
      },
    ]);
    expect(allHistory).toHaveLength(1);
  });

  it('persists session lifecycle transitions', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createStateStore({ basePath: tempDir });
    const session = await store.createSession({
      sessionId: 'session-001',
      task: 'Coordinate release dry run',
      initiator: 'architect',
      workspace: '/repo',
    });

    await store.joinSession({
      sessionId: session.sessionId,
      agentId: 'qa',
      role: 'collaborator',
    });
    await store.leaveSession(session.sessionId, 'qa');
    await store.completeSession(session.sessionId, 'Dry run complete');

    const loaded = await store.getSession(session.sessionId);
    expect(loaded).toMatchObject({
      sessionId: 'session-001',
      status: 'completed',
      summary: 'Dry run complete',
      initiator: 'architect',
    });
    expect(loaded?.participants).toMatchObject([
      {
        agentId: 'architect',
        role: 'initiator',
      },
      {
        agentId: 'qa',
        role: 'collaborator',
      },
    ]);
    expect(loaded?.participants[1]?.leftAt).toBeDefined();
  });

  it('closes stuck active sessions', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createStateStore({ basePath: tempDir });
    await store.createSession({
      sessionId: 'session-stuck-001',
      task: 'Stuck task',
      initiator: 'architect',
    });

    const closed = await store.closeStuckSessions(0);
    expect(closed).toMatchObject([
      {
        sessionId: 'session-stuck-001',
        status: 'failed',
      },
    ]);

    const loaded = await store.getSession('session-stuck-001');
    expect(loaded).toMatchObject({
      sessionId: 'session-stuck-001',
      status: 'failed',
      error: {
        message: 'Auto-closed as stuck session',
      },
    });
  });
});
