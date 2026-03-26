import { mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  WORKFLOW_COMMAND_DEFINITIONS,
  architectCommand,
  auditCommand,
  getWorkflowCommandDefinition,
  helpCommand,
  qaCommand,
  releaseCommand,
  sessionCommand,
  shipCommand,
  traceCommand,
} from '../src/commands/index.js';
import { getCommandHelp } from '../src/cli-help.js';
import { getCommandHandler, getCommandManifestEntry } from '../src/command-manifest.js';
import { getWorkflowCatalogEntry } from '../src/workflow-adapter.js';
import type { CLIOptions } from '../src/types.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `workflow-commands-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function defaultOptions(overrides: Partial<CLIOptions> = {}): CLIOptions {
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

describe('workflow commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('registers ship and architect as stable first-class workflow commands', () => {
    const commands = WORKFLOW_COMMAND_DEFINITIONS.map((definition) => definition.command);
    const shipCatalog = getWorkflowCatalogEntry('ship');
    const shipDefinition = getWorkflowCommandDefinition('ship');
    const shipManifest = getCommandManifestEntry('ship');
    const shipHandler = getCommandHandler('ship');

    expect(commands).toContain('ship');
    expect(commands).toContain('architect');
    expect(commands).toContain('audit');
    expect(commands).toContain('qa');
    expect(commands).toContain('release');
    expect(WORKFLOW_COMMAND_DEFINITIONS.every((definition) => definition.stable)).toBe(true);
    expect(shipDefinition).toMatchObject({
      command: 'ship',
      stable: true,
      handler: shipCommand,
    });
    expect(getWorkflowCommandDefinition('architect')).toMatchObject({
      command: 'architect',
      stable: true,
      handler: architectCommand,
    });
    expect(shipDefinition?.description).toBe(shipCatalog?.description);
    expect(shipManifest?.description).toBe(shipCatalog?.description);
    expect(shipHandler).toBe(shipCommand);
  });

  it('runs audit, qa, and release as first-class workflow commands with shared trace/artifact behavior', async () => {
    const commandCases: Array<{
      name: 'audit' | 'qa' | 'release';
      handler: typeof auditCommand;
      args: string[];
      traceId: string;
    }> = [
      {
        name: 'audit',
        handler: auditCommand,
        args: ['--scope', 'src/core'],
        traceId: 'audit-trace-001',
      },
      {
        name: 'qa',
        handler: qaCommand,
        args: ['--target', 'checkout', '--url', 'https://localhost:3000'],
        traceId: 'qa-trace-001',
      },
      {
        name: 'release',
        handler: releaseCommand,
        args: ['--release-version', '14.0.0'],
        traceId: 'release-trace-001',
      },
    ];

    for (const commandCase of commandCases) {
      const tempDir = createTempDir();
      tempDirs.push(tempDir);

      const result = await commandCase.handler(
        commandCase.args,
        defaultOptions({
          outputDir: tempDir,
          traceId: commandCase.traceId,
        }),
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain(`Workflow ${commandCase.name} dispatched with trace ${commandCase.traceId}`);

      const data = result.data as {
        traceId?: string;
        manifestPath?: string;
        workflow?: {
          workflowId?: string;
          traceId?: string;
        };
      };

      expect(data.traceId).toBe(commandCase.traceId);
      expect(data.workflow?.workflowId).toBe(commandCase.name);
      expect(data.workflow?.traceId).toBe(commandCase.traceId);

      const manifest = JSON.parse(await readFile(data.manifestPath ?? '', 'utf8')) as {
        status?: string;
        traceId?: string;
        workflow?: { id?: string };
      };

      expect(manifest.status).toBe('dispatched');
      expect(manifest.traceId).toBe(commandCase.traceId);
      expect(manifest.workflow?.id).toBe(commandCase.name);
    }
  });

  it('keeps first-class workflow traces queryable from the workspace runtime store', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    mkdirSync(join(tempDir, 'workflows'), { recursive: true });
    await writeFile(
      join(tempDir, 'workflows', 'audit.json'),
      `${JSON.stringify({
        workflowId: 'audit',
        name: 'Audit Workflow',
        version: '1.0.0',
        steps: [
          {
            stepId: 'inspect-scope',
            type: 'prompt',
            config: {
              prompt: 'Inspect audit scope.',
            },
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const workflowResult = await auditCommand(
      ['--scope', 'src/core'],
      defaultOptions({
        traceId: 'audit-trace-visible-001',
        basePath: tempDir,
      }),
    );

    expect(workflowResult.success).toBe(true);
    expect(workflowResult.message).toContain('Workflow audit dispatched with trace audit-trace-visible-001');

    const traceResult = await traceCommand(
      ['audit-trace-visible-001'],
      defaultOptions({ basePath: tempDir }),
    );

    expect(traceResult.success).toBe(true);
    expect(traceResult.message).toContain('Trace: audit-trace-visible-001');
    expect(traceResult.message).toContain('Workflow: audit');
    expect(traceResult.message).toContain('Status: completed');
  });

  it('auto-creates real sessions for first-class workflows when sessionId is provided', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const workflowResult = await auditCommand(
      ['--scope', 'src/core'],
      defaultOptions({
        basePath: tempDir,
        traceId: 'audit-session-trace-001',
        sessionId: 'workflow-session-001',
      }),
    );

    expect(workflowResult.success).toBe(true);
    expect(workflowResult.message).toContain('Workflow audit dispatched with trace audit-session-trace-001');

    const sessionResult = await sessionCommand(
      ['get', 'workflow-session-001'],
      defaultOptions({ basePath: tempDir }),
    );

    expect(sessionResult.success).toBe(true);
    expect(sessionResult.message).toContain('Session: workflow-session-001');
    expect(sessionResult.message).toContain('Task: Run workflow: audit');
    expect(sessionResult.message).toContain('Initiator: cli');
    expect(sessionResult.message).toContain('Status: active');
  });

  it('does not couple runtime base path to output-dir for first-class workflows', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const traceId = 'audit-trace-output-dir-only-001';

    const workflowResult = await auditCommand(
      ['--scope', 'src/core'],
      defaultOptions({
        outputDir: tempDir,
        traceId,
      }),
    );

    expect(workflowResult.success).toBe(true);
    expect(workflowResult.message).toContain(`Workflow audit dispatched with trace ${traceId}`);

    const traceResult = await traceCommand([traceId], defaultOptions());

    expect(traceResult.success).toBe(true);
    expect(traceResult.message).toContain(`Trace: ${traceId}`);
    expect(traceResult.message).toContain('Workflow: audit');
    expect(traceResult.message).toContain('Status: completed');
  });

  it('returns workflow-first help and quickstart content', async () => {
    const result = await helpCommand([], defaultOptions());

    expect(result.success).toBe(true);
    expect(result.message).toContain('Workflow-first default surface');
    expect(result.message).toContain('ax ship');
    expect(result.message).toContain('ax architect');
    expect(result.message).toContain('ax audit');
    expect(result.message).toContain('ax qa');
    expect(result.message).toContain('ax release');
    expect(result.message).toContain('ax setup');
    expect(result.message).toContain('ax list');
    expect(result.message).toContain('ax trace');
    expect(result.message).toContain('ax discuss');
    expect(result.message).toContain('ax agent');
    expect(result.message).toContain('ax mcp');
    expect(result.message).toContain('ax session');
    expect(result.message).toContain('ax review');
    expect(result.message).toContain('ax governance');

    const data = result.data as {
      workflowFirst?: boolean;
      quickstart?: string;
      commands?: Array<{ command: string; stable: boolean }>;
    };

    expect(data.workflowFirst).toBe(true);
    expect(data.quickstart).toContain('Use --dry-run');
    expect(data.commands?.map((entry) => entry.command)).toEqual(expect.arrayContaining([
      'ship',
      'architect',
      'audit',
      'qa',
      'release',
      'setup',
      'list',
      'trace',
      'discuss',
      'agent',
      'mcp',
      'session',
      'review',
    ]));
    expect(data.commands?.every((entry) => entry.stable)).toBe(true);
  });

  it('renders workflow-specific command help with ownership and examples', () => {
    const help = getCommandHelp('architect');
    const qaHelp = getCommandHelp('qa');
    const releaseHelp = getCommandHelp('release');

    expect(help).toContain('AutomatosX v14 Help: architect');
    expect(help).toContain('Owner agent: architect');
    expect(help).toContain('Required inputs: request or input');
    expect(help).toContain('Artifacts: architecture proposal, ADR draft, phased implementation plan, risk matrix');
    expect(help).toContain('Examples:');
    expect(help).toContain('ax architect --request "Design tenant-isolated billing"');
    expect(qaHelp).toContain('Required inputs: target and url');
    expect(releaseHelp).toContain('Required inputs: releaseVersion');
    expect(releaseHelp).toContain('Optional inputs: commits, target');
  });

  it('runs first-class workflows from bundled shared definitions when no local workflow directory exists', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const result = await shipCommand(
        ['--scope', 'checkout'],
        defaultOptions({
          basePath: tempDir,
          traceId: 'ship-bundled-trace-001',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Workflow ship dispatched with trace ship-bundled-trace-001');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('runs ship dry-run through dispatch and writes preview artifacts', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await shipCommand(
      ['--scope', 'checkout'],
      defaultOptions({
        dryRun: true,
        outputDir: tempDir,
        traceId: 'ship-trace-001',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('Dry-run completed for ship');

    const data = result.data as {
      traceId?: string;
      manifestPath?: string;
      summaryPath?: string;
      workflow?: {
        traceId?: string;
      };
    };

    expect(data.traceId).toBe('ship-trace-001');
    expect(data.workflow?.traceId).toBe('ship-trace-001');

    const manifest = JSON.parse(await readFile(data.manifestPath ?? '', 'utf8')) as {
      status?: string;
      traceId?: string;
    };
    const summary = JSON.parse(await readFile(data.summaryPath ?? '', 'utf8')) as {
      status?: string;
      traceId?: string;
    };

    expect(manifest.status).toBe('preview');
    expect(summary.status).toBe('preview');
    expect(manifest.traceId).toBe('ship-trace-001');
    expect(summary.traceId).toBe('ship-trace-001');
  });

  it('runs architect through the shared adapter and returns dispatched artifacts with trace propagation', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await architectCommand(
      ['--request', 'Design auth system'],
      defaultOptions({
        outputDir: tempDir,
        traceId: 'architect-trace-001',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('Workflow architect dispatched with trace architect-trace-001');

    const data = result.data as {
      traceId?: string;
      manifestPath?: string;
      summaryPath?: string;
      workflow?: {
        traceId?: string;
        workflowId?: string;
      };
    };

    expect(data.traceId).toBe('architect-trace-001');
    expect(data.workflow?.traceId).toBe('architect-trace-001');
    expect(data.workflow?.workflowId).toBe('architect');

    const manifest = JSON.parse(await readFile(data.manifestPath ?? '', 'utf8')) as {
      status?: string;
      traceId?: string;
      workflow?: { id?: string };
    };

    expect(manifest.status).toBe('dispatched');
    expect(manifest.traceId).toBe('architect-trace-001');
    expect(manifest.workflow?.id).toBe('architect');
  });
});
