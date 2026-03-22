import { mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { reviewCommand, } from '../src/commands/index.js';
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `review-command-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function defaultOptions(overrides = {}) {
    return {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
        iterate: false,
        maxIterations: undefined,
        maxTime: undefined,
        noContext: false,
        category: undefined,
        tags: undefined,
        agent: undefined,
        task: undefined,
        core: undefined,
        maxTokens: undefined,
        refresh: undefined,
        compact: false,
        team: undefined,
        provider: 'claude',
        outputDir: undefined,
        dryRun: false,
        quiet: false,
        ...overrides,
    };
}
describe('review command', () => {
    const tempDirs = [];
    afterEach(async () => {
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('analyzes files, writes artifacts, and lists review traces', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const sourceDir = join(tempDir, 'src');
        mkdirSync(sourceDir, { recursive: true });
        await writeFile(join(sourceDir, 'sample.ts'), [
            'export function sample(value: any) {',
            '  console.log(value);',
            '  // TODO: remove debug path',
            '  return eval("value");',
            '}',
            '',
        ].join('\n'), 'utf8');
        const analyze = await reviewCommand([
            'analyze',
            sourceDir,
            '--focus',
            'all',
        ], defaultOptions({
            outputDir: tempDir,
            traceId: 'review-trace-001',
        }));
        expect(analyze.success).toBe(true);
        expect(analyze.message).toContain('review-trace-001');
        const data = analyze.data;
        expect(data.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
            'security.dynamic-eval',
            'maintainability.console-log',
            'maintainability.todo',
            'maintainability.any-type',
        ]));
        expect(await readFile(data.reportPath, 'utf8')).toContain('security.dynamic-eval');
        expect(JSON.parse(await readFile(data.dataPath, 'utf8'))).toMatchObject({
            traceId: 'review-trace-001',
        });
        const listed = await reviewCommand(['list'], defaultOptions({ outputDir: tempDir }));
        expect(listed.success).toBe(true);
        expect(listed.message).toContain('review-trace-001');
    });
});
