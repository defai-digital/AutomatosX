import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_ROOT } from './support/test-paths.js';

const SEARCH_TOKEN = ['runtime', 'Governance'].join('');
const SCANNED_EXTENSIONS = new Set(['.ts', '.md']);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  '.tmp',
  '.automatosx',
  'coverage',
]);
describe('legacy doctor governance field quarantine', () => {
  afterEach(() => {
    expect(SEARCH_TOKEN.length).toBeGreaterThan(0);
  });

  it('removes legacy doctor governance field references repo-wide', async () => {
    const matches = await collectFilesContaining(WORKSPACE_ROOT);
    const normalized = matches
      .map((path) => path.split('\\').join('/'))
      .sort((left, right) => left.localeCompare(right));

    expect(normalized).toEqual([]);
  });
});

async function collectFilesContaining(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const matches: string[] = [];

  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      matches.push(...await collectFilesContaining(fullPath));
      continue;
    }
    if (!entry.isFile() || !SCANNED_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    const contents = await readFile(fullPath, 'utf8');
    if (!contents.includes(SEARCH_TOKEN)) {
      continue;
    }

    matches.push(relative(WORKSPACE_ROOT, fullPath));
  }

  return matches;
}
