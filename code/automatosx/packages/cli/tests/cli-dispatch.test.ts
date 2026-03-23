import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CLI_COMMAND_NAMES, CLI_VERSION, executeCli, parseCommand, renderCommandResult } from '../src/index.js';

const execFileAsync = promisify(execFile);
type ExecError = Error & { stdout?: string; stderr?: string; code?: number };

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `cli-dispatch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('cli dispatch', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('parses global flags without consuming command-specific args', () => {
    const parsed = parseCommand([
      'review',
      'analyze',
      'src',
      '--focus',
      'security',
      '--output-dir',
      '/tmp/example',
      '--trace-id',
      'trace-001',
      '--session-id',
      'session-001',
      '--format',
      'json',
    ]);

    expect(parsed.command).toBe('review');
    expect(parsed.options.outputDir).toBe('/tmp/example');
    expect(parsed.options.traceId).toBe('trace-001');
    expect(parsed.options.sessionId).toBe('session-001');
    expect(parsed.options.format).toBe('json');
    expect(parsed.args).toEqual(['analyze', 'src', '--focus', 'security']);
  });

  it('dispatches version and renders json output', async () => {
    const result = await executeCli(['version', '--format', 'json']);
    const parsed = parseCommand(['version', '--format', 'json']);
    const rendered = renderCommandResult(result, parsed.options);

    expect(result.success).toBe(true);
    expect(rendered).toContain(`"version": "${CLI_VERSION}"`);
  });

  it('dispatches workflow and review commands through the unified entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const workflowResult = await executeCli([
      'list',
      '--workflow-dir',
      join(process.cwd(), 'workflows'),
      '--output-dir',
      tempDir,
    ]);
    expect(workflowResult.success).toBe(true);

    const describeResult = await executeCli([
      'list',
      'architect',
      '--workflow-dir',
      join(process.cwd(), 'workflows'),
      '--output-dir',
      tempDir,
    ]);
    expect(describeResult.success).toBe(true);
    expect(describeResult.message).toContain('Workflow: architect');

    const callResult = await executeCli([
      'call',
      'Summarize release risk.',
      '--output-dir',
      tempDir,
    ]);
    expect(callResult.success).toBe(true);
    expect(callResult.message).toContain('Execution mode: simulated');

    const statusResult = await executeCli([
      'status',
      '--output-dir',
      tempDir,
      '--limit',
      '5',
    ]);
    expect(statusResult.success).toBe(true);
    expect(statusResult.message).toContain('AutomatosX Status');

    const abilityResult = await executeCli([
      'ability',
      'list',
      '--category',
      'review',
      '--output-dir',
      tempDir,
    ]);
    expect(abilityResult.success).toBe(true);
    expect(abilityResult.message).toContain('code-review');

    const feedbackResult = await executeCli([
      'feedback',
      'overview',
      '--output-dir',
      tempDir,
    ]);
    expect(feedbackResult.success).toBe(true);
    expect(feedbackResult.message).toContain('Feedback overview');

    const sourceDir = join(tempDir, 'src');
    mkdirSync(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, 'sample.ts'), [
      'export function sample(value: any) {',
      '  console.log(value);',
      '  return value;',
      '}',
      '',
    ].join('\n'), 'utf8');

    const reviewResult = await executeCli([
      'review',
      'analyze',
      sourceDir,
      '--trace-id',
      'dispatch-review-001',
      '--output-dir',
      tempDir,
    ]);
    expect(reviewResult.success).toBe(true);

    const traceResult = await executeCli([
      'trace',
      'dispatch-review-001',
      '--output-dir',
      tempDir,
    ]);
    expect(traceResult.success).toBe(true);
    expect(traceResult.message).toContain('Workflow: review');

    const traceAnalysisResult = await executeCli([
      'trace',
      'analyze',
      'dispatch-review-001',
      '--output-dir',
      tempDir,
    ]);
    expect(traceAnalysisResult.success).toBe(true);
    expect(traceAnalysisResult.message).toContain('Trace analysis: dispatch-review-001');
    expect(traceAnalysisResult.message).toContain('Findings:');

    const sessionTraceResult = await executeCli([
      'review',
      'analyze',
      sourceDir,
      '--trace-id',
      'dispatch-review-002',
      '--session-id',
      'dispatch-session-001',
      '--output-dir',
      tempDir,
    ]);
    expect(sessionTraceResult.success).toBe(true);

    const bySessionResult = await executeCli([
      'trace',
      'by-session',
      'dispatch-session-001',
      '--output-dir',
      tempDir,
    ]);
    expect(bySessionResult.success).toBe(true);
    expect(bySessionResult.message).toContain('Session traces: dispatch-session-001');
    expect(bySessionResult.message).toContain('dispatch-review-002');

    const configResult = await executeCli([
      'config',
      'set',
      'providers.default',
      'gemini',
      '--output-dir',
      tempDir,
    ]);
    expect(configResult.success).toBe(true);

    const cleanupResult = await executeCli([
      'cleanup',
      'traces',
      '0',
      '--output-dir',
      tempDir,
    ]);
    expect(cleanupResult.success).toBe(true);
    expect(cleanupResult.message).toContain('Cleanup complete');

    const iterateResult = await executeCli([
      'iterate',
      'run',
      'ship',
      '--workflow-dir',
      join(process.cwd(), 'workflows'),
      '--output-dir',
      tempDir,
      '--max-iterations',
      '1',
    ]);
    expect(iterateResult.success).toBe(true);
    expect(iterateResult.message).toContain('Iterate completed after 1 iteration');

    const resumeSource = await executeCli([
      'review',
      'analyze',
      sourceDir,
      '--trace-id',
      'dispatch-review-resume-source',
      '--output-dir',
      tempDir,
    ]);
    expect(resumeSource.success).toBe(true);

    const resumeResult = await executeCli([
      'resume',
      'dispatch-review-resume-source',
      '--output-dir',
      tempDir,
    ]);
    expect(resumeResult.success).toBe(true);
    expect(resumeResult.message).toContain('Resumed trace dispatch-review-resume-source');
  });

  it('dispatches doctor through the unified entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await executeCli([
      'setup',
      '--output-dir',
      tempDir,
    ]);
    await executeCli([
      'init',
      '--output-dir',
      tempDir,
    ]);

    const result = await executeCli([
      'doctor',
      '--output-dir',
      tempDir,
      '--workflow-dir',
      join(process.cwd(), 'workflows'),
      '--format',
      'json',
    ]);

    expect(result.success).toBe(true);
    const data = result.data as { status: string; summary: { fail: number } };
    expect(data.status).toBe('warning');
    expect(data.summary.fail).toBe(0);
  });

  it('returns a clear failure for unknown commands', async () => {
    const result = await executeCli(['unknown-command']);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown command');
  });

  it('fails fast on invalid global flag usage', async () => {
    const missingValue = await executeCli(['list', '--output-dir']);
    expect(missingValue.success).toBe(false);
    expect(missingValue.message).toContain('Missing value for --output-dir.');

    const invalidFormat = await executeCli(['version', '--format', 'yaml']);
    expect(invalidFormat.success).toBe(false);
    expect(invalidFormat.message).toContain('Invalid value for --format');

    const invalidNumber = await executeCli(['trace', '--limit', 'abc']);
    expect(invalidNumber.success).toBe(false);
    expect(invalidNumber.message).toContain('Invalid value for --limit');
  });

  it('returns command-specific help for --help and help subcommand', async () => {
    const direct = await executeCli(['review', '--help']);
    expect(direct.success).toBe(true);
    expect(direct.message).toContain('AutomatosX v14 Help: review');
    expect(direct.message).toContain('ax review analyze <paths...>');

    const indirect = await executeCli(['help', 'session']);
    expect(indirect.success).toBe(true);
    expect(indirect.message).toContain('AutomatosX v14 Help: session');
    expect(indirect.message).toContain('ax session create --input <json-object>');
  });

  it('supports command-specific help for the full retained command surface', async () => {
    for (const command of CLI_COMMAND_NAMES) {
      const result = await executeCli([command, '--help']);
      expect(result.success).toBe(true);
      expect(result.message).toContain(`AutomatosX v14 Help: ${command}`);
      expect(result.message).toContain('Usage:');
    }
  });

  it('fails unknown help targets explicitly', async () => {
    const result = await executeCli(['help', 'not-a-command']);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown command: not-a-command');
  });

  it('runs the main entrypoint as a process', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const { stdout } = await execFileAsync('node', [
      'packages/cli/src/main.js',
      'version',
      '--format',
      'json',
    ], {
      cwd: process.cwd(),
    });

    expect(stdout).toContain(`"version": "${CLI_VERSION}"`);
  });

  it('runs call and status through the main entrypoint as a process', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const { stdout: callStdout } = await execFileAsync('node', [
      'packages/cli/src/main.js',
      'call',
      'Summarize release risk.',
      '--output-dir',
      tempDir,
    ], {
      cwd: process.cwd(),
    });
    expect(callStdout).toContain('Execution mode: simulated');

    const { stdout: statusStdout } = await execFileAsync('node', [
      'packages/cli/src/main.js',
      'status',
      '--output-dir',
      tempDir,
    ], {
      cwd: process.cwd(),
    });
    expect(statusStdout).toContain('AutomatosX Status');
  });

  it('runs doctor through the main entrypoint as a process', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await execFileAsync('node', [
      'packages/cli/src/main.js',
      'setup',
      '--output-dir',
      tempDir,
    ], {
      cwd: process.cwd(),
    });
    await execFileAsync('node', [
      'packages/cli/src/main.js',
      'init',
      '--output-dir',
      tempDir,
    ], {
      cwd: process.cwd(),
    });

    const { stdout } = await execFileAsync('node', [
      'packages/cli/src/main.js',
      'doctor',
      '--output-dir',
      tempDir,
      '--workflow-dir',
      join(process.cwd(), 'workflows'),
      '--format',
      'json',
    ], {
      cwd: process.cwd(),
    });

    expect(stdout).toContain('"status": "warning"');
    expect(stdout).toContain('"fail": 0');
  });

  it('returns process-level failures for invalid invocations', async () => {
    await expect(execFileAsync('node', [
      'packages/cli/src/main.js',
      'list',
      '--output-dir',
    ], {
      cwd: process.cwd(),
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Missing value for --output-dir.'),
    } satisfies Partial<ExecError>);
  });

  it('returns process-level failures for invalid command-specific arguments', async () => {
    await expect(execFileAsync('node', [
      'packages/cli/src/main.js',
      'review',
      'analyze',
      'packages/cli/src',
      '--focus',
      'unsafe',
    ], {
      cwd: process.cwd(),
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Review focus must be one of'),
    } satisfies Partial<ExecError>);
  });
});
