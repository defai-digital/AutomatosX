/**
 * Migration utility: import data from the legacy JSON state file into SQLite.
 *
 * Usage:
 *   import { migrateJsonToSqlite } from '@defai.digital/state-store';
 *   await migrateJsonToSqlite({ basePath: process.cwd() });
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
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
const migrationRootSchema = z.record(z.string(), z.unknown());
const migrationArraySchema = z.array(z.unknown());

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
    const result = migrationRootSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      return { memory: 0, policies: 0, agents: 0, semantic: 0, feedback: 0, sessions: 0, skipped: true, reason: 'state.json is not valid JSON — skipping migration.' };
    }
    parsed = result.data;
  } catch {
    return { memory: 0, policies: 0, agents: 0, semantic: 0, feedback: 0, sessions: 0, skipped: true, reason: 'state.json is not valid JSON — skipping migration.' };
  }

  const memory = parseMigrationArray(parsed['memory']);
  const policies = parseMigrationArray(parsed['policies']);
  const agents = parseMigrationArray(parsed['agents']);
  const semantic = parseMigrationArray(parsed['semantic']);
  const feedback = parseMigrationArray(parsed['feedback']);
  const sessions = parseMigrationArray(parsed['sessions']);

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

function parseMigrationArray(value: unknown): never[] {
  const result = migrationArraySchema.safeParse(value);
  return result.success ? result.data as never[] : [];
}
