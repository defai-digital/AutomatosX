/**
 * Migration utility: import data from the legacy JSON traces file into SQLite.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SqliteTraceStore } from './sqlite.js';
const DEFAULT_TRACE_JSON = join('.automatosx', 'runtime', 'traces.json');
export async function migrateTraceJsonToSqlite(options = {}) {
    const basePath = options.basePath ?? process.cwd();
    const jsonFile = options.jsonFile ?? join(basePath, DEFAULT_TRACE_JSON);
    let raw;
    try {
        raw = await readFile(jsonFile, 'utf8');
    }
    catch {
        return { traces: 0, skipped: true, reason: 'No traces.json found — nothing to migrate.' };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return { traces: 0, skipped: true, reason: 'traces.json is not valid JSON — skipping migration.' };
    }
    const records = Array.isArray(parsed['traces']) ? parsed['traces'] : [];
    const store = new SqliteTraceStore({ basePath, dbFile: options.dbFile });
    await store.importFromJson(records);
    store.close();
    return { traces: records.length, skipped: false };
}
