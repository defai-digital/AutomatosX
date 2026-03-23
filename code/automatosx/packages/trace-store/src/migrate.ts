/**
 * Migration utility: import data from the legacy JSON traces file into SQLite.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SqliteTraceStore } from './sqlite.js';
import type { TraceRecord } from './index.js';

export interface MigrateTraceJsonToSqliteOptions {
  basePath?: string;
  jsonFile?: string;
  dbFile?: string;
}

export interface TraceMigrationResult {
  traces: number;
  skipped: boolean;
  reason?: string;
}

const DEFAULT_TRACE_JSON = join('.automatosx', 'runtime', 'traces.json');

export async function migrateTraceJsonToSqlite(options: MigrateTraceJsonToSqliteOptions = {}): Promise<TraceMigrationResult> {
  const basePath = options.basePath ?? process.cwd();
  const jsonFile = options.jsonFile ?? join(basePath, DEFAULT_TRACE_JSON);

  let raw: string;
  try {
    raw = await readFile(jsonFile, 'utf8');
  } catch {
    return { traces: 0, skipped: true, reason: 'No traces.json found — nothing to migrate.' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { traces: 0, skipped: true, reason: 'traces.json is not valid JSON — skipping migration.' };
  }

  const records: TraceRecord[] = Array.isArray(parsed['traces']) ? parsed['traces'] as TraceRecord[] : [];

  const store = new SqliteTraceStore({ basePath, dbFile: options.dbFile });
  await store.importFromJson(records);
  store.close();

  return { traces: records.length, skipped: false };
}
