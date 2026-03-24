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

export interface MigrateJsonToSqliteOptions {
  basePath?: string;
  /** Override the source JSON file path. */
  jsonFile?: string;
  /** Override the destination SQLite DB path. */
  dbFile?: string;
}

export interface MigrationResult {
  memory: number;
  policies: number;
  agents: number;
  semantic: number;
  feedback: number;
  sessions: number;
  skipped: boolean;
  reason?: string;
}

const DEFAULT_STATE_JSON = join('.automatosx', 'runtime', 'state.json');

export async function migrateJsonToSqlite(options: MigrateJsonToSqliteOptions = {}): Promise<MigrationResult> {
  const basePath = options.basePath ?? process.cwd();
  const jsonFile = options.jsonFile ?? join(basePath, DEFAULT_STATE_JSON);

  let raw: string;
  try {
    raw = await readFile(jsonFile, 'utf8');
  } catch {
    return { memory: 0, policies: 0, agents: 0, semantic: 0, feedback: 0, sessions: 0, skipped: true, reason: 'No state.json found — nothing to migrate.' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { memory: 0, policies: 0, agents: 0, semantic: 0, feedback: 0, sessions: 0, skipped: true, reason: 'state.json is not valid JSON — skipping migration.' };
  }

  const memory   = Array.isArray(parsed['memory'])   ? parsed['memory']   as never[]   : [];
  const policies = Array.isArray(parsed['policies']) ? parsed['policies'] as never[]   : [];
  const agents   = Array.isArray(parsed['agents'])   ? parsed['agents']   as never[]   : [];
  const semantic = Array.isArray(parsed['semantic']) ? parsed['semantic'] as never[]   : [];
  const feedback = Array.isArray(parsed['feedback']) ? parsed['feedback'] as never[]   : [];
  const sessions = Array.isArray(parsed['sessions']) ? parsed['sessions'] as never[]   : [];

  const store = new SqliteStateStore({ basePath, dbFile: options.dbFile });
  await store.importFromJson({ memory, policies, agents, semantic, feedback, sessions });
  store.close();

  return {
    memory:   memory.length,
    policies: policies.length,
    agents:   agents.length,
    semantic: semantic.length,
    feedback: feedback.length,
    sessions: sessions.length,
    skipped: false,
  };
}
