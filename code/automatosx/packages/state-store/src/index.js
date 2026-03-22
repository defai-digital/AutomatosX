import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const DEFAULT_STATE_STORE_FILE = join('.automatosx', 'runtime', 'state.json');
const stateStoreQueues = new Map();
const LOCK_WAIT_TIMEOUT_MS = 5_000;
const LOCK_STALE_AFTER_MS = 60_000;
const LOCK_RETRY_DELAY_MS = 10;
export class FileStateStore {
    storageFile;
    constructor(config = {}) {
        this.storageFile = config.storageFile ?? join(config.basePath ?? process.cwd(), DEFAULT_STATE_STORE_FILE);
    }
    async storeMemory(entry) {
        return this.withMutation(async (data) => {
            const stored = {
                key: entry.key,
                namespace: entry.namespace,
                value: entry.value,
                updatedAt: new Date().toISOString(),
            };
            const index = data.memory.findIndex((item) => item.key === stored.key && item.namespace === stored.namespace);
            if (index >= 0) {
                data.memory[index] = stored;
            }
            else {
                data.memory.push(stored);
            }
            return stored;
        });
    }
    async listMemory(namespace) {
        const data = await this.readConsistentData();
        return data.memory.filter((entry) => namespace === undefined || entry.namespace === namespace);
    }
    async getMemory(key, namespace) {
        const data = await this.readConsistentData();
        return data.memory.find((entry) => entry.key === key && entry.namespace === namespace);
    }
    async searchMemory(query, namespace) {
        const normalized = query.trim().toLowerCase();
        const data = await this.readConsistentData();
        const matches = data.memory.filter((entry) => {
            if (namespace !== undefined && entry.namespace !== namespace) {
                return false;
            }
            if (normalized === '') {
                return true;
            }
            const haystack = [
                entry.key,
                entry.namespace ?? '',
                safeStringify(entry.value),
            ].join('\n').toLowerCase();
            return haystack.includes(normalized);
        });
        return matches.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }
    async deleteMemory(key, namespace) {
        return this.withMutation(async (data) => {
            const originalLength = data.memory.length;
            data.memory = data.memory.filter((entry) => !(entry.key === key && entry.namespace === namespace));
            return data.memory.length !== originalLength;
        });
    }
    async registerPolicy(entry) {
        return this.withMutation(async (data) => {
            const stored = {
                policyId: entry.policyId,
                name: entry.name,
                enabled: entry.enabled ?? true,
                metadata: entry.metadata,
                updatedAt: new Date().toISOString(),
            };
            const index = data.policies.findIndex((item) => item.policyId === stored.policyId);
            if (index >= 0) {
                data.policies[index] = stored;
            }
            else {
                data.policies.push(stored);
            }
            return stored;
        });
    }
    async listPolicies() {
        const data = await this.readConsistentData();
        return [...data.policies];
    }
    async registerAgent(entry) {
        return this.withMutation(async (data) => {
            const normalized = normalizeAgentRegistration(entry);
            const existing = data.agents.find((agent) => agent.agentId === normalized.agentId);
            if (existing !== undefined) {
                if (existing.registrationKey !== normalized.registrationKey) {
                    throw new Error(`Agent "${normalized.agentId}" is already registered with a different configuration`);
                }
                return existing;
            }
            const timestamp = new Date().toISOString();
            const stored = {
                ...normalized,
                registeredAt: timestamp,
                updatedAt: timestamp,
            };
            data.agents.push(stored);
            return stored;
        });
    }
    async getAgent(agentId) {
        const data = await this.readConsistentData();
        return data.agents.find((agent) => agent.agentId === agentId);
    }
    async listAgents() {
        const data = await this.readConsistentData();
        return [...data.agents].sort((left, right) => left.agentId.localeCompare(right.agentId));
    }
    async removeAgent(agentId) {
        return this.withMutation(async (data) => {
            const originalLength = data.agents.length;
            data.agents = data.agents.filter((agent) => agent.agentId !== agentId);
            return data.agents.length !== originalLength;
        });
    }
    async listAgentCapabilities() {
        const data = await this.readConsistentData();
        return Array.from(new Set(data.agents.flatMap((agent) => agent.capabilities))).sort((left, right) => left.localeCompare(right));
    }
    async storeSemantic(entry) {
        return this.withMutation(async (data) => {
            const stored = {
                key: entry.key,
                namespace: entry.namespace,
                content: entry.content,
                tags: normalizeTags(entry.tags),
                metadata: entry.metadata === undefined ? undefined : sortRecord(entry.metadata),
                tokenFreq: computeTokenFreq(entry.content),
                updatedAt: new Date().toISOString(),
            };
            const index = data.semantic.findIndex((item) => item.key === stored.key && item.namespace === stored.namespace);
            if (index >= 0) {
                data.semantic[index] = stored;
            }
            else {
                data.semantic.push(stored);
            }
            return stored;
        });
    }
    async searchSemantic(query, options = {}) {
        const data = await this.readConsistentData();
        const queryFreq = computeTokenFreq(query);
        const filterTags = normalizeTags(options.filterTags);
        const minSimilarity = options.minSimilarity ?? 0;
        const ranked = data.semantic
            .filter((entry) => {
            if (options.namespace !== undefined && entry.namespace !== options.namespace) {
                return false;
            }
            if (filterTags.length > 0 && !filterTags.every((tag) => entry.tags.includes(tag))) {
                return false;
            }
            return true;
        })
            .map((entry) => ({
            ...entry,
            score: scoreSemanticSimilarity(queryFreq, entry.tokenFreq),
        }))
            .filter((entry) => entry.score >= minSimilarity)
            .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt) || left.key.localeCompare(right.key));
        if (options.topK === undefined) {
            return ranked;
        }
        return ranked.slice(0, Math.max(0, options.topK));
    }
    async getSemantic(key, namespace) {
        const data = await this.readConsistentData();
        return data.semantic.find((entry) => entry.key === key && entry.namespace === namespace);
    }
    async listSemantic(options = {}) {
        const filterTags = normalizeTags(options.filterTags);
        const data = await this.readConsistentData();
        const listed = data.semantic
            .filter((entry) => {
            if (options.namespace !== undefined && entry.namespace !== options.namespace) {
                return false;
            }
            if (options.keyPrefix !== undefined && !entry.key.startsWith(options.keyPrefix)) {
                return false;
            }
            if (filterTags.length > 0 && !filterTags.every((tag) => entry.tags.includes(tag))) {
                return false;
            }
            return true;
        })
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.key.localeCompare(right.key));
        if (options.limit === undefined) {
            return listed;
        }
        return listed.slice(0, Math.max(0, options.limit));
    }
    async deleteSemantic(key, namespace) {
        return this.withMutation(async (data) => {
            const originalLength = data.semantic.length;
            data.semantic = data.semantic.filter((entry) => !(entry.key === key && entry.namespace === namespace));
            return data.semantic.length !== originalLength;
        });
    }
    async clearSemantic(namespace) {
        return this.withMutation(async (data) => {
            const originalLength = data.semantic.length;
            data.semantic = data.semantic.filter((entry) => entry.namespace !== namespace);
            return originalLength - data.semantic.length;
        });
    }
    async semanticStats(namespace) {
        const data = await this.readConsistentData();
        const scoped = data.semantic.filter((entry) => namespace === undefined || entry.namespace === namespace);
        const grouped = new Map();
        for (const entry of scoped) {
            const key = entry.namespace ?? 'default';
            const items = grouped.get(key) ?? [];
            items.push(entry);
            grouped.set(key, items);
        }
        return [...grouped.entries()]
            .map(([key, items]) => {
            const tagSet = new Set(items.flatMap((entry) => entry.tags));
            const lastUpdatedAt = [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.updatedAt;
            return {
                namespace: key,
                totalItems: items.length,
                totalTags: items.reduce((sum, entry) => sum + entry.tags.length, 0),
                uniqueTags: tagSet.size,
                lastUpdatedAt,
            };
        })
            .sort((left, right) => left.namespace.localeCompare(right.namespace));
    }
    async createSession(entry) {
        return this.withMutation(async (data) => {
            const now = new Date().toISOString();
            const sessionId = entry.sessionId ?? randomUUID();
            const session = {
                sessionId,
                task: entry.task,
                initiator: entry.initiator,
                status: 'active',
                workspace: entry.workspace,
                metadata: entry.metadata,
                participants: [
                    {
                        agentId: entry.initiator,
                        role: 'initiator',
                        joinedAt: now,
                    },
                ],
                createdAt: now,
                updatedAt: now,
            };
            const existingIndex = data.sessions.findIndex((item) => item.sessionId === sessionId);
            if (existingIndex >= 0) {
                data.sessions[existingIndex] = session;
            }
            else {
                data.sessions.push(session);
            }
            return session;
        });
    }
    async getSession(sessionId) {
        const data = await this.readConsistentData();
        return data.sessions.find((session) => session.sessionId === sessionId);
    }
    async listSessions() {
        const data = await this.readConsistentData();
        return [...data.sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }
    async joinSession(entry) {
        return this.withMutation(async (data) => {
            const session = requireSession(data, entry.sessionId);
            ensureActiveSession(session);
            const now = new Date().toISOString();
            const existing = session.participants.find((participant) => participant.agentId === entry.agentId);
            if (existing !== undefined) {
                existing.role = entry.role ?? existing.role;
                existing.leftAt = undefined;
                session.updatedAt = now;
                return session;
            }
            session.participants.push({
                agentId: entry.agentId,
                role: entry.role ?? 'collaborator',
                joinedAt: now,
            });
            session.updatedAt = now;
            return session;
        });
    }
    async leaveSession(sessionId, agentId) {
        return this.withMutation(async (data) => {
            const session = requireSession(data, sessionId);
            const participant = session.participants.find((entry) => entry.agentId === agentId && entry.leftAt === undefined);
            if (participant === undefined) {
                throw new Error(`Participant "${agentId}" is not active in session "${sessionId}"`);
            }
            participant.leftAt = new Date().toISOString();
            session.updatedAt = participant.leftAt;
            return session;
        });
    }
    async completeSession(sessionId, summary) {
        return this.withMutation(async (data) => {
            const session = requireSession(data, sessionId);
            ensureActiveSession(session);
            session.status = 'completed';
            session.summary = summary;
            session.updatedAt = new Date().toISOString();
            return session;
        });
    }
    async failSession(sessionId, message) {
        return this.withMutation(async (data) => {
            const session = requireSession(data, sessionId);
            ensureActiveSession(session);
            session.status = 'failed';
            session.error = { message };
            session.updatedAt = new Date().toISOString();
            return session;
        });
    }
    async closeStuckSessions(maxAgeMs = 86_400_000) {
        return this.withMutation(async (data) => {
            const threshold = Date.now() - maxAgeMs;
            const closed = [];
            for (const session of data.sessions) {
                if (session.status !== 'active') {
                    continue;
                }
                const updatedAt = Date.parse(session.updatedAt);
                if (Number.isNaN(updatedAt) || updatedAt > threshold) {
                    continue;
                }
                const now = new Date().toISOString();
                session.status = 'failed';
                session.error = { message: 'Auto-closed as stuck session' };
                session.updatedAt = now;
                closed.push(session);
            }
            return closed;
        });
    }
    async readConsistentData() {
        await waitForQueue(this.storageFile, stateStoreQueues);
        return this.readData();
    }
    async withMutation(mutate) {
        return enqueueExclusive(this.storageFile, stateStoreQueues, async () => {
            const data = await this.readData();
            const result = await mutate(data);
            await this.writeData(data);
            return result;
        });
    }
    async readData() {
        try {
            const raw = await readFile(this.storageFile, 'utf8');
            const parsed = JSON.parse(raw);
            return {
                memory: Array.isArray(parsed.memory) ? parsed.memory : [],
                policies: Array.isArray(parsed.policies) ? parsed.policies : [],
                agents: Array.isArray(parsed.agents) ? parsed.agents : [],
                semantic: Array.isArray(parsed.semantic) ? parsed.semantic : [],
                sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
            };
        }
        catch {
            return {
                memory: [],
                policies: [],
                agents: [],
                semantic: [],
                sessions: [],
            };
        }
    }
    async writeData(data) {
        await mkdir(dirname(this.storageFile), { recursive: true });
        const tempFile = `${this.storageFile}.${process.pid}.${randomUUID()}.tmp`;
        await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
        await rename(tempFile, this.storageFile);
    }
}
export function createStateStore(config) {
    return new FileStateStore(config);
}
function requireSession(data, sessionId) {
    const session = data.sessions.find((entry) => entry.sessionId === sessionId);
    if (session === undefined) {
        throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
}
function ensureActiveSession(session) {
    if (session.status !== 'active') {
        throw new Error(`Session "${session.sessionId}" is not active`);
    }
}
function normalizeAgentRegistration(entry) {
    const capabilities = Array.from(new Set((entry.capabilities ?? []).map((capability) => capability.trim()).filter((capability) => capability.length > 0)))
        .sort((left, right) => left.localeCompare(right));
    const metadata = entry.metadata === undefined ? undefined : sortRecord(entry.metadata);
    const registrationKey = JSON.stringify({
        agentId: entry.agentId,
        name: entry.name,
        capabilities,
        metadata,
    });
    return {
        agentId: entry.agentId,
        name: entry.name,
        capabilities,
        metadata,
        registrationKey,
    };
}
function normalizeTags(tags) {
    return Array.from(new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0)))
        .sort((left, right) => left.localeCompare(right));
}
function computeTokenFreq(content) {
    const tokens = content
        .toLowerCase()
        .split(/[^a-z0-9_-]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
    const freq = {};
    for (const token of tokens) {
        freq[token] = (freq[token] ?? 0) + 1;
    }
    return freq;
}
function scoreSemanticSimilarity(queryFreq, itemFreq) {
    const queryTerms = Object.keys(queryFreq);
    const itemTerms = Object.keys(itemFreq);
    if (queryTerms.length === 0 || itemTerms.length === 0) {
        return 0;
    }
    let dot = 0;
    let queryMagnitude = 0;
    let itemMagnitude = 0;
    for (const value of Object.values(queryFreq)) {
        queryMagnitude += value * value;
    }
    for (const value of Object.values(itemFreq)) {
        itemMagnitude += value * value;
    }
    for (const term of queryTerms) {
        dot += (queryFreq[term] ?? 0) * (itemFreq[term] ?? 0);
    }
    if (dot === 0 || queryMagnitude === 0 || itemMagnitude === 0) {
        return 0;
    }
    return Number((dot / (Math.sqrt(queryMagnitude) * Math.sqrt(itemMagnitude))).toFixed(4));
}
function sortRecord(record) {
    return Object.fromEntries(Object.entries(record)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, normalizeValue(value)]));
}
function normalizeValue(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeValue(entry));
    }
    if (value !== null && typeof value === 'object') {
        return sortRecord(value);
    }
    return value;
}
function safeStringify(value) {
    try {
        return JSON.stringify(value) ?? '';
    }
    catch {
        return String(value);
    }
}
async function waitForQueue(storageFile, queueMap) {
    const pending = queueMap.get(storageFile);
    if (pending !== undefined) {
        await pending;
    }
}
async function enqueueExclusive(storageFile, queueMap, operation) {
    const previous = queueMap.get(storageFile) ?? Promise.resolve();
    let releaseCurrent = () => { };
    const current = new Promise((resolve) => {
        releaseCurrent = resolve;
    });
    const queueTail = previous.then(() => current);
    queueMap.set(storageFile, queueTail);
    await previous;
    try {
        return await withCrossProcessLock(storageFile, operation);
    }
    finally {
        releaseCurrent();
        if (queueMap.get(storageFile) === queueTail) {
            queueMap.delete(storageFile);
        }
    }
}
async function withCrossProcessLock(storageFile, operation) {
    const release = await acquireLock(storageFile);
    try {
        return await operation();
    }
    finally {
        await release();
    }
}
async function acquireLock(storageFile) {
    const lockDir = `${storageFile}.lock`;
    const ownerFile = join(lockDir, 'owner.json');
    const startTime = Date.now();
    await mkdir(dirname(storageFile), { recursive: true });
    for (;;) {
        try {
            await mkdir(lockDir);
            await writeFile(ownerFile, `${JSON.stringify({
                pid: process.pid,
                acquiredAt: new Date().toISOString(),
            }, null, 2)}\n`, 'utf8');
            return async () => {
                await rm(lockDir, { recursive: true, force: true });
            };
        }
        catch (error) {
            if (!isAlreadyExistsError(error)) {
                throw error;
            }
            if (await isStaleLock(lockDir, LOCK_STALE_AFTER_MS)) {
                await rm(lockDir, { recursive: true, force: true });
                continue;
            }
            if (Date.now() - startTime >= LOCK_WAIT_TIMEOUT_MS) {
                throw new Error(`Timed out acquiring state store lock for ${storageFile}`);
            }
            await delay(LOCK_RETRY_DELAY_MS);
        }
    }
}
async function isStaleLock(lockDir, staleAfterMs) {
    try {
        const info = await stat(lockDir);
        return Date.now() - info.mtimeMs > staleAfterMs;
    }
    catch {
        return false;
    }
}
function isAlreadyExistsError(error) {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'EEXIST';
}
async function delay(ms) {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
