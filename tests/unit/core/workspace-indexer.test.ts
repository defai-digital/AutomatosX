import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { WorkspaceIndexer } from '@/core/workspace-indexer.js';

const workspace = join(process.cwd(), 'tmp', 'workspace-indexer');
const dbPath = join(workspace, '.automatosx', 'workspace', 'index.db');

beforeAll(async () => {
  await rm(workspace, { recursive: true, force: true });
  await mkdir(join(workspace, 'src'), { recursive: true });
  await mkdir(join(workspace, 'docs'), { recursive: true });
  await mkdir(join(workspace, 'tests'), { recursive: true });
  await mkdir(join(workspace, 'config'), { recursive: true });

  await writeFile(join(workspace, 'package.json'), JSON.stringify({
    name: 'workspace-indexer-test',
    version: '1.0.0',
    main: 'dist/index.js',
    dependencies: { react: '18.0.0' }
  }, null, 2));
  await writeFile(join(workspace, 'src', 'index.ts'), 'export const answer = 42;');
  await writeFile(join(workspace, 'docs', 'readme.md'), '# Docs');
  await writeFile(join(workspace, 'tests', 'sample.test.ts'), 'export {};');
  await writeFile(join(workspace, 'config', 'custom.config.js'), 'module.exports = {};');
});

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('WorkspaceIndexer', () => {
  it('indexes files and selects relevant matches', async () => {
    const indexer = new WorkspaceIndexer(workspace, { dbPath });
    const stats = await indexer.index({ force: true });

    expect(stats.totalFiles).toBe(5);
    expect(stats.sourceFiles).toBe(1);
    expect(stats.configFiles).toBeGreaterThanOrEqual(2); // package.json + custom config
    expect(stats.docFiles).toBe(1);
    expect(stats.lastIndexed).toBeGreaterThan(0);

    const summary = indexer.getProjectSummary();
    expect(summary?.framework).toBe('React');
    expect(summary?.entryPoints).toContain('dist/index.js');
    expect(summary?.configFiles).toContain('config/custom.config.js');

    const selected = await indexer.selectRelevantFiles('update config docs', { maxFiles: 3 });
    expect(selected).toContain('config/custom.config.js');
    expect(selected.some(f => f.endsWith('readme.md'))).toBe(true);

    indexer.close();
  });
});
