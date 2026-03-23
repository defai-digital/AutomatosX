/**
 * Migration utility: import data from the legacy JSON state file into SQLite.
 *
 * Usage:
 *   import { migrateJsonToSqlite } from '@defai.digital/state-store';
 *   await migrateJsonToSqlite({ basePath: process.cwd() });
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SqliteStateStore } from './sqlite.js';
const DEFAULT_STATE_JSON = join('.automatosx', 'runtime', 'state.json');
export async function migrateJsonToSqlite(options = {}) {
    const basePath = options.basePath ?? process.cwd();
    const jsonFile = options.jsonFile ?? join(basePath, DEFAULT_STATE_JSON);
    let raw;
    try {
        raw = await readFile(jsonFile, 'utf8');
    }
    catch {
        return { memory: 0, policies: 0, agents: 0, semantic: 0, feedback: 0, sessions: 0, skipped: true, reason: 'No state.json found — nothing to migrate.' };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return { memory: 0, policies: 0, agents: 0, semantic: 0, feedback: 0, sessions: 0, skipped: true, reason: 'state.json is not valid JSON — skipping migration.' };
    }
    const memory = Array.isArray(parsed['memory']) ? parsed['memory'] : [];
    const policies = Array.isArray(parsed['policies']) ? parsed['policies'] : [];
    const agents = Array.isArray(parsed['agents']) ? parsed['agents'] : [];
    const semantic = Array.isArray(parsed['semantic']) ? parsed['semantic'] : [];
    const feedback = Array.isArray(parsed['feedback']) ? parsed['feedback'] : [];
    const sessions = Array.isArray(parsed['sessions']) ? parsed['sessions'] : [];
    const store = new SqliteStateStore({ basePath, dbFile: options.dbFile });
    await store.importFromJson({ memory, policies, agents, semantic, feedback, sessions });
    store.close();
    return {
        memory: memory.length,
        policies: policies.length,
        agents: agents.length,
        semantic: semantic.length,
        feedback: feedback.length,
        sessions: sessions.length,
        skipped: false,
    };
}
