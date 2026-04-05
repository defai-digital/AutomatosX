import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import {
  CLI_COMMAND_NAMES,
  CLI_VERSION,
  executeCli,
  executeParsedCli,
  parseCommand,
  renderCommandResult,
} from '../src/index.js';
import { ensurePackageBuilt } from '../../../tests/support/ensure-built.js';
import {
  CLI_ENTRY_PATH,
  CLI_PACKAGE_ROOT,
  CLI_WORKFLOW_DIR,
  createCliTestTempDir,
} from './support/test-paths.js';

const execFileAsync = promisify(execFile);
type ExecError = Error & { stdout?: string; stderr?: string; code?: number };
const PROCESS_TEST_TIMEOUT_MS = 20_000;

function createTempDir(): string {
  return createCliTestTempDir('cli-dispatch');
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
    expect(parsed.options.status).toBeUndefined();
    expect(parsed.options.format).toBe('json');
    expect(parsed.args).toEqual(['analyze', 'src', '--focus', 'security']);
  });

  it('parses advertised history status filters as global options', () => {
    const parsed = parseCommand(['history', '--status', 'failed', '--limit', '5']);

    expect(parsed.command).toBe('history');
    expect(parsed.options.status).toBe('failed');
    expect(parsed.options.limit).toBe(5);
    expect(parsed.args).toEqual([]);
  });

  it('accepts negative numeric values for string flags and as positional args', () => {
    // Regression: previously `normalizeFlagToken('-5')` returned `{ name: '5' }`
    // so the parser rejected `-5` as "Missing value for --task". Numeric
    // literals must be treated as values, not short flags.
    const taskFlag = parseCommand(['history', '--task', '-5']);
    expect(taskFlag.parseError).toBeUndefined();
    expect(taskFlag.options.task).toBe('-5');

    const decimal = parseCommand(['history', '--task', '-0.5']);
    expect(decimal.parseError).toBeUndefined();
    expect(decimal.options.task).toBe('-0.5');

    const leadingDot = parseCommand(['history', '--task', '-.25']);
    expect(leadingDot.parseError).toBeUndefined();
    expect(leadingDot.options.task).toBe('-.25');

    // And as a positional argument.
    const positional = parseCommand(['call', '-42']);
    expect(positional.parseError).toBeUndefined();
    expect(positional.args).toContain('-42');

    // Letter-prefixed single-dash tokens must still normalise to flag names —
    // they fall through to the positional list only if the flag is unknown,
    // which confirms the numeric guard does not break letter short-flag
    // handling. Here `--verbose` is the long form and must still win.
    const longVerbose = parseCommand(['history', '--verbose']);
    expect(longVerbose.options.verbose).toBe(true);
  });

  it('parses inline global flags without consuming inline command-specific flags', () => {
    const parsed = parseCommand([
      'review',
      'analyze',
      'src',
      '--focus=security',
      '--output-dir=/tmp/example-inline',
      '--trace-id=trace-inline-001',
      '--format=json',
      '--tags=architecture,audit',
      '--limit=2',
    ]);

    expect(parsed.command).toBe('review');
    expect(parsed.options.outputDir).toBe('/tmp/example-inline');
    expect(parsed.options.traceId).toBe('trace-inline-001');
    expect(parsed.options.format).toBe('json');
    expect(parsed.options.tags).toEqual(['architecture', 'audit']);
    expect(parsed.options.limit).toBe(2);
    expect(parsed.args).toEqual(['analyze', 'src', '--focus=security']);
  });

  it('dispatches version and renders json output', async () => {
    const result = await executeCli(['version', '--format', 'json']);
    const parsed = parseCommand(['version', '--format', 'json']);
    const rendered = renderCommandResult(result, parsed.options);

    expect(result.success).toBe(true);
    expect(rendered).toContain(`"version": "${CLI_VERSION}"`);
  });

  it('preserves global max-tokens for call through the unified entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await executeCli([
      'call',
      'Summarize release risk.',
      '--max-tokens',
      '42',
      '--trace-id',
      'dispatch-call-max-tokens-001',
      '--output-dir',
      tempDir,
    ]);

    expect(result.success).toBe(true);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await expect(runtime.getTrace('dispatch-call-max-tokens-001')).resolves.toMatchObject({
      traceId: 'dispatch-call-max-tokens-001',
      workflowId: 'call',
      input: expect.objectContaining({
        maxTokens: 42,
      }),
    });
  });

  it('supports inline global max-tokens through the unified entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await executeCli([
      'call',
      'Summarize release risk.',
      '--max-tokens=41',
      '--trace-id=dispatch-call-inline-max-tokens-001',
      '--output-dir',
      tempDir,
    ]);

    expect(result.success).toBe(true);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await expect(runtime.getTrace('dispatch-call-inline-max-tokens-001')).resolves.toMatchObject({
      traceId: 'dispatch-call-inline-max-tokens-001',
      workflowId: 'call',
      input: expect.objectContaining({
        maxTokens: 41,
      }),
    });
  });

  it('treats --version as a true global flag after the command name', async () => {
    const result = await executeCli(['status', '--version']);

    expect(result.success).toBe(true);
    expect(result.message).toBe(`AutomatosX v${CLI_VERSION}`);
    expect(result.data).toEqual({ version: CLI_VERSION });
  });

  it('executes an already parsed command without reparsing', async () => {
    const parsed = parseCommand(['version', '--format', 'json']);
    const result = await executeParsedCli(parsed);
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
      CLI_WORKFLOW_DIR,
      '--output-dir',
      tempDir,
    ]);
    expect(workflowResult.success).toBe(true);

    const describeResult = await executeCli([
      'list',
      'architect',
      '--workflow-dir',
      CLI_WORKFLOW_DIR,
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
      CLI_WORKFLOW_DIR,
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

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.runDiscussion({
      topic: 'Preserve provider budget',
      traceId: 'dispatch-discuss-resume-source',
      providers: ['claude', 'gemini', 'grok'],
      minProviders: 3,
      surface: 'cli',
    });

    const resumedDiscussResult = await executeCli([
      'resume',
      'dispatch-discuss-resume-source',
      '--trace-id',
      'dispatch-discuss-resume-target',
      '--output-dir',
      tempDir,
    ]);
    expect(resumedDiscussResult.success).toBe(true);

    const resumedDiscussTrace = await runtime.getTrace('dispatch-discuss-resume-target');
    expect(resumedDiscussTrace?.input).toMatchObject({
      minProviders: 3,
      providers: ['claude', 'gemini', 'grok'],
    });

    const quickResult = await runtime.runDiscussionQuick({
      topic: 'Quick resume path',
      traceId: 'dispatch-discuss-quick-source',
      providers: ['claude', 'gemini'],
      surface: 'cli',
    });
    expect(quickResult.success).toBe(true);

    const resumedQuickResult = await executeCli([
      'resume',
      'dispatch-discuss-quick-source',
      '--trace-id',
      'dispatch-discuss-quick-target',
      '--output-dir',
      tempDir,
    ]);
    expect(resumedQuickResult.success).toBe(true);

    const resumedQuickTrace = await runtime.getTrace('dispatch-discuss-quick-target');
    expect(resumedQuickTrace).toMatchObject({
      traceId: 'dispatch-discuss-quick-target',
      workflowId: 'discuss.quick',
      status: 'completed',
    });

    const recursiveResult = await runtime.runDiscussionRecursive({
      topic: 'Recursive resume path',
      subtopics: ['risk', 'validation'],
      traceId: 'dispatch-discuss-recursive-source',
      providers: ['claude', 'gemini'],
      minProviders: 2,
      surface: 'cli',
    });
    expect(recursiveResult.success).toBe(true);

    const resumedRecursiveResult = await executeCli([
      'resume',
      'dispatch-discuss-recursive-source',
      '--trace-id',
      'dispatch-discuss-recursive-target',
      '--output-dir',
      tempDir,
    ]);
    expect(resumedRecursiveResult.success).toBe(true);

    const resumedRecursiveTrace = await runtime.getTrace('dispatch-discuss-recursive-target');
    expect(resumedRecursiveTrace).toMatchObject({
      traceId: 'dispatch-discuss-recursive-target',
      workflowId: 'discuss.recursive',
      status: 'completed',
    });
    expect(resumedRecursiveTrace?.input).toMatchObject({
      subtopics: ['risk', 'validation'],
      minProviders: 2,
      providers: ['claude', 'gemini'],
    });
  });

  it('dispatches doctor through the unified entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await executeCli([
      'setup',
      '--output-dir',
      tempDir,
    ]);

    const result = await executeCli([
      'doctor',
      '--output-dir',
      tempDir,
      '--workflow-dir',
      CLI_WORKFLOW_DIR,
      '--format',
      'json',
    ]);

    expect(result.success).toBe(true);
    const data = result.data as {
      status: string;
      summary: { fail: number };
      governance: unknown;
    };
    expect(data.status).toBe('warning');
    expect(data.summary.fail).toBe(0);
    expect(RuntimeGovernanceAggregateSchema.parse(data.governance)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
  }, PROCESS_TEST_TIMEOUT_MS);

  it('does not emit a legacy doctor governance alias in json output', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await executeCli([
      'setup',
      '--output-dir',
      tempDir,
    ]);

    const result = await executeCli([
      'doctor',
      '--output-dir',
      tempDir,
      '--workflow-dir',
      CLI_WORKFLOW_DIR,
      '--format',
      'json',
    ]);

    expect(result.success).toBe(true);
    const data = result.data as {
      governance: unknown;
    };
    expect(RuntimeGovernanceAggregateSchema.parse(data.governance)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
    expect(data).not.toHaveProperty(['runtime', 'Governance'].join(''));
  }, PROCESS_TEST_TIMEOUT_MS);

  it('dispatches memory and semantic commands with command-local flags', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const memorySetResult = await executeCli([
      'memory',
      'set',
      'project.config',
      '--namespace',
      'agents',
      '--input',
      '{"provider":"claude","enabled":true}',
      '--output-dir',
      tempDir,
    ]);
    expect(memorySetResult.success).toBe(true);
    expect(memorySetResult.message).toContain('Memory stored: project.config');

    const memoryGetResult = await executeCli([
      'memory',
      'get',
      'project.config',
      '--namespace',
      'agents',
      '--output-dir',
      tempDir,
    ]);
    expect(memoryGetResult.success).toBe(true);
    expect(memoryGetResult.message).toContain('Namespace: agents');
    expect(memoryGetResult.message).toContain('"provider": "claude"');

    const semanticStoreResult = await executeCli([
      'semantic',
      'store',
      'arch.decision',
      '--content',
      'We use event sourcing for audit trails',
      '--tags',
      'architecture,audit',
      '--namespace',
      'architecture',
      '--input',
      '{"owner":"platform"}',
      '--output-dir',
      tempDir,
    ]);
    expect(semanticStoreResult.success).toBe(true);
    expect(semanticStoreResult.message).toContain('Semantic entry stored: arch.decision');
    expect(semanticStoreResult.message).toContain('Tags: architecture, audit');

    const semanticListResult = await executeCli([
      'semantic',
      'list',
      '--namespace',
      'architecture',
      '--tags',
      'architecture',
      '--limit',
      '1',
      '--output-dir',
      tempDir,
    ]);
    expect(semanticListResult.success).toBe(true);
    expect(semanticListResult.message).toContain('arch.decision');
    expect(semanticListResult.data).toEqual([
      expect.objectContaining({
        key: 'arch.decision',
        namespace: 'architecture',
        tags: ['architecture', 'audit'],
      }),
    ]);
  });

  it('returns validation errors for invalid structured memory and semantic input', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const invalidMemoryResult = await executeCli([
      'memory',
      'set',
      'project.config',
      '--input',
      '{bad-json}',
      '--output-dir',
      tempDir,
    ]);
    expect(invalidMemoryResult.success).toBe(false);
    expect(invalidMemoryResult.message).toContain('Invalid JSON in --input. Provide a valid JSON value.');

    const invalidSemanticResult = await executeCli([
      'semantic',
      'store',
      'arch.decision',
      '--content',
      'We use event sourcing for audit trails',
      '--input',
      '[]',
      '--output-dir',
      tempDir,
    ]);
    expect(invalidSemanticResult.success).toBe(false);
    expect(invalidSemanticResult.message).toContain('Semantic metadata input must be a JSON object.');
  });

  it('dispatches parallel plan and run with advertised task-array input and local aliases', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['architecture', 'planning'],
      metadata: { provider: 'claude' },
    });
    await runtime.registerAgent({
      agentId: 'qa',
      name: 'QA',
      capabilities: ['testing', 'regression'],
      metadata: { provider: 'claude' },
    });

    const planResult = await executeCli([
      'parallel',
      'plan',
      '--input',
      '[{"taskId":"design","agentId":"architect","task":"Design rollout"},{"taskId":"verify","agentId":"qa","dependencies":["design"]}]',
      '--output-dir',
      tempDir,
    ]);
    expect(planResult.success).toBe(true);
    expect(planResult.message).toContain('Parallel plan valid');
    expect(planResult.message).toContain('Layer 1: design');
    expect(planResult.message).toContain('Layer 2: verify');

    const runResult = await executeCli([
      'parallel',
      'run',
      '--tasks',
      '[{"taskId":"design","agentId":"architect","task":"Design rollout","provider":"claude"},{"taskId":"verify","agentId":"qa","dependencies":["design"],"provider":"claude"}]',
      '--max-concurrent',
      '2',
      '--failure-strategy',
      'failSafe',
      '--result-aggregation',
      'merge',
      '--trace',
      'parallel-cli-run-001',
      '--session',
      'parallel-cli-session-001',
      '--output-dir',
      tempDir,
    ]);
    expect(runResult.success).toBe(true);
    expect(runResult.message).toContain('Parallel run complete');
    expect(runResult.message).toContain('Trace: parallel-cli-run-001');
    expect(runResult.message).toContain('Strategy: failSafe');

    const runData = runResult.data as {
      traceId: string;
      success: boolean;
      aggregatedResult?: Record<string, unknown>;
      results: Array<{ taskId: string; status: string }>;
    };
    expect(runData.traceId).toBe('parallel-cli-run-001');
    expect(runData.success).toBe(true);
    expect(runData.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: 'design', status: 'completed' }),
      expect.objectContaining({ taskId: 'verify', status: 'completed' }),
    ]));
    expect(runData.aggregatedResult).toMatchObject({
      design: expect.any(String),
      verify: expect.any(String),
    });

    const trace = await runtime.getTrace('parallel-cli-run-001');
    expect(trace).toMatchObject({
      traceId: 'parallel-cli-run-001',
      workflowId: 'parallel.run',
      metadata: expect.objectContaining({
        sessionId: 'parallel-cli-session-001',
      }),
    });
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

  it('fails fast on invalid command-specific flags for history and monitor', async () => {
    const historyResult = await executeCli(['history', '--bogus']);
    expect(historyResult.success).toBe(false);
    expect(historyResult.message).toContain('Unknown history flag: --bogus.');

    const monitorResult = await executeCli(['monitor', '--bogus']);
    expect(monitorResult.success).toBe(false);
    expect(monitorResult.message).toContain('Unknown monitor flag: --bogus.');
  });

  it('fails fast on invalid command-specific args for config, trace, and cleanup', async () => {
    const configResult = await executeCli(['config', 'show', '--bogus']);
    expect(configResult.success).toBe(false);
    expect(configResult.message).toContain('Unknown config flag: --bogus.');

    const traceResult = await executeCli(['trace', 'tree', 'trace-1', 'extra']);
    expect(traceResult.success).toBe(false);
    expect(traceResult.message).toContain('Usage: ax trace tree <trace-id>');

    const cleanupResult = await executeCli(['cleanup', '--bogus']);
    expect(cleanupResult.success).toBe(false);
    expect(cleanupResult.message).toContain('Unknown cleanup flag: --bogus.');
  });

  it('fails fast on invalid command-specific args for doctor and update', async () => {
    const doctorResult = await executeCli(['doctor', '--bogus']);
    expect(doctorResult.success).toBe(false);
    expect(doctorResult.message).toContain('Unknown doctor flag: --bogus.');

    const updateResult = await executeCli(['update', '--bogus']);
    expect(updateResult.success).toBe(false);
    expect(updateResult.message).toContain('Unknown update flag: --bogus.');
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
    await ensurePackageBuilt('cli');

    const { stdout } = await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'version',
      '--format',
      'json',
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });

    expect(stdout).toContain(`"version": "${CLI_VERSION}"`);
  }, PROCESS_TEST_TIMEOUT_MS);

  it('runs call and status through the main entrypoint as a process', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await ensurePackageBuilt('cli');

    const { stdout: callStdout } = await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'call',
      'Summarize release risk.',
      '--output-dir',
      tempDir,
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });
    expect(callStdout).toContain('Execution mode: simulated');

    const { stdout: statusStdout } = await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'status',
      '--output-dir',
      tempDir,
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });
    expect(statusStdout).toContain('AutomatosX Status');
  }, PROCESS_TEST_TIMEOUT_MS);

  it('runs doctor through the main entrypoint as a process', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await ensurePackageBuilt('cli');

    await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'setup',
      '--output-dir',
      tempDir,
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });

    const { stdout } = await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'doctor',
      '--output-dir',
      tempDir,
      '--workflow-dir',
      CLI_WORKFLOW_DIR,
      '--format',
      'json',
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });

    expect(stdout).toContain('"status": "warning"');
    expect(stdout).toContain('"fail": 0');
  }, PROCESS_TEST_TIMEOUT_MS);

  it('runs doctor without a legacy governance alias through the main entrypoint as a process', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await ensurePackageBuilt('cli');

    await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'setup',
      '--output-dir',
      tempDir,
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });

    const { stdout } = await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'doctor',
      '--output-dir',
      tempDir,
      '--workflow-dir',
      CLI_WORKFLOW_DIR,
      '--format',
      'json',
    ], {
      cwd: CLI_PACKAGE_ROOT,
    });

    const parsed = JSON.parse(stdout) as {
      success: boolean;
      data?: {
        governance?: unknown;
      };
    };

    expect(parsed.success).toBe(true);
    expect(RuntimeGovernanceAggregateSchema.parse(parsed.data?.governance)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
    expect(parsed.data).not.toHaveProperty(['runtime', 'Governance'].join(''));
  }, PROCESS_TEST_TIMEOUT_MS);

  it('returns process-level failures for invalid invocations', async () => {
    await ensurePackageBuilt('cli');
    await expect(execFileAsync('node', [
      CLI_ENTRY_PATH,
      'list',
      '--output-dir',
    ], {
      cwd: CLI_PACKAGE_ROOT,
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Missing value for --output-dir.'),
    } satisfies Partial<ExecError>);
  }, PROCESS_TEST_TIMEOUT_MS);

  it('returns process-level failures for invalid command-specific arguments', async () => {
    await ensurePackageBuilt('cli');
    await expect(execFileAsync('node', [
      CLI_ENTRY_PATH,
      'review',
      'analyze',
      'packages/cli/src',
      '--focus',
      'unsafe',
    ], {
      cwd: CLI_PACKAGE_ROOT,
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Review focus must be one of'),
    } satisfies Partial<ExecError>);
  }, PROCESS_TEST_TIMEOUT_MS);
});
