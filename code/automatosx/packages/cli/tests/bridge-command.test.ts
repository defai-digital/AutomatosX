import { mkdirSync } from 'node:fs';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeCli } from '../src/index.js';
import { bridgeCommand } from '../src/commands/bridge.js';
import type { CLIOptions } from '../src/types.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `bridge-command-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
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
    sessionId: undefined,
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
    status: undefined,
    compact: false,
    team: undefined,
    provider: undefined,
    outputDir: undefined,
    basePath: undefined,
    dryRun: false,
    quiet: false,
    ...overrides,
  };
}

async function writeBridgeDefinition(basePath: string, content: unknown, relativePath = join('.automatosx', 'bridges', 'sample', 'bridge.json')): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return path;
}

async function writeScriptFile(basePath: string, relativePath: string, content: string): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  await chmod(path, 0o755);
  return path;
}

async function writeWorkspaceConfig(basePath: string, content: unknown): Promise<void> {
  const path = join(basePath, '.automatosx', 'config.json');
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
}

describe('bridge command', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('lists workspace-local bridge definitions through the unified CLI entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'sample-bridge',
      name: 'Sample Bridge',
      version: '0.1.0',
      description: 'Expose a local script as a bridge.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './scripts/sample.sh',
      },
      capabilities: ['internal-tools'],
      skills: [
        {
          skillId: 'sample-bridge-skill',
          dispatch: 'bridge',
        },
      ],
    });

    const result = await executeCli(['bridge', 'list', '--output-dir', tempDir]);

    expect(result.success).toBe(true);
    expect(result.message).toContain('sample-bridge [script] v0.1.0');
  });

  it('installs a local bridge bundle and records provenance in the canonical bridge definition', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourceDir = join(tempDir, 'fixtures', 'external-bridge');
    await writeScriptFile(sourceDir, 'echo.js', [
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));",
      '',
    ].join('\n'));
    await writeBridgeDefinition(sourceDir, {
      schemaVersion: 1,
      bridgeId: 'external-bridge',
      name: 'External Bridge',
      version: '0.1.0',
      description: 'Install a local bridge bundle.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, 'bridge.json');

    const installResult = await bridgeCommand(['install', sourceDir], defaultOptions({ outputDir: tempDir }));
    expect(installResult.success).toBe(true);
    expect(installResult.message).toContain('Installed bridge: external-bridge');

    const installedRaw = await readFile(join(tempDir, '.automatosx', 'bridges', 'external-bridge', 'bridge.json'), 'utf8');
    expect(installedRaw).toContain('"importer": "ax.bridge.install"');
    expect(installedRaw).toContain('"type": "local-bridge-bundle"');

    const runResult = await bridgeCommand(['run', 'external-bridge', 'hello'], defaultOptions({ outputDir: tempDir }));
    expect(runResult.success).toBe(true);
    expect(runResult.message).toContain('Bridge executed: external-bridge');
    expect(runResult.message).toContain('"args":["hello"]');
  });

  it('installs denied bridges by default but surfaces trust warnings', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourceDir = join(tempDir, 'fixtures', 'remote-bridge');
    await writeScriptFile(sourceDir, 'echo.js', [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(sourceDir, {
      schemaVersion: 1,
      bridgeId: 'remote-install-bridge',
      name: 'Remote Install Bridge',
      version: '0.1.0',
      description: 'Carries remote provenance metadata.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/remote-install-bridge',
      },
    }, 'bridge.json');

    const result = await bridgeCommand(['install', sourceDir], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Installed bridge: remote-install-bridge');
    expect(result.message).toContain('Trust: denied');
    expect(result.message).toContain('Warning:');
    expect(result.data).toMatchObject({
      trust: expect.objectContaining({
        allowed: false,
        state: 'denied',
      }),
      warnings: [
        expect.stringContaining('installed, but trust is currently denied'),
      ],
    });

    const installedRaw = await readFile(join(tempDir, '.automatosx', 'bridges', 'remote-install-bridge', 'bridge.json'), 'utf8');
    expect(installedRaw).toContain('"bridgeId": "remote-install-bridge"');
  });

  it('rejects denied bridge installs when --require-trusted is set', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourceDir = join(tempDir, 'fixtures', 'remote-strict-bridge');
    await writeScriptFile(sourceDir, 'echo.js', [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(sourceDir, {
      schemaVersion: 1,
      bridgeId: 'remote-strict-bridge',
      name: 'Remote Strict Bridge',
      version: '0.1.0',
      description: 'Requires explicit trust on install.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/remote-strict-bridge',
      },
    }, 'bridge.json');

    const result = await bridgeCommand(['install', sourceDir, '--require-trusted'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Bridge install denied: remote-strict-bridge');
    await expect(readFile(join(tempDir, '.automatosx', 'bridges', 'remote-strict-bridge', 'bridge.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects denied bridge installs when workspace config enables strict admission', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourceDir = join(tempDir, 'fixtures', 'remote-config-bridge');
    await writeScriptFile(sourceDir, 'echo.js', [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(sourceDir, {
      schemaVersion: 1,
      bridgeId: 'remote-config-bridge',
      name: 'Remote Config Bridge',
      version: '0.1.0',
      description: 'Workspace config forces strict install admission.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/remote-config-bridge',
      },
    }, 'bridge.json');
    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        install: {
          rejectDenied: true,
        },
      },
    });

    const result = await bridgeCommand(['install', sourceDir], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Bridge install denied: remote-config-bridge');
    await expect(readFile(join(tempDir, '.automatosx', 'bridges', 'remote-config-bridge', 'bridge.json'), 'utf8')).rejects.toThrow();
  });

  it('suppresses denied install warnings when workspace config disables them', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourceDir = join(tempDir, 'fixtures', 'remote-quiet-bridge');
    await writeScriptFile(sourceDir, 'echo.js', [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(sourceDir, {
      schemaVersion: 1,
      bridgeId: 'remote-quiet-bridge',
      name: 'Remote Quiet Bridge',
      version: '0.1.0',
      description: 'Denied trust warning is suppressed.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/remote-quiet-bridge',
      },
    }, 'bridge.json');
    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        install: {
          warnOnDenied: false,
        },
      },
    });

    const result = await bridgeCommand(['install', sourceDir], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Installed bridge: remote-quiet-bridge');
    expect(result.message).toContain('Trust: denied');
    expect(result.message).not.toContain('Warning:');
    expect(result.data).toMatchObject({
      warnings: [],
    });
  });

  it('inspects a discovered bridge by id', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'inspect-bridge',
      name: 'Inspect Bridge',
      version: '1.2.3',
      description: 'Inspect bridge metadata.',
      kind: 'command',
      entrypoint: {
        type: 'command',
        command: 'inspect-bridge',
      },
    });

    const result = await bridgeCommand(['inspect', 'inspect-bridge'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Bridge: inspect-bridge');
    expect(result.message).toContain('"command": "inspect-bridge"');
  });

  it('fails validation when a bridge definition is invalid', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'broken-bridge',
      name: 'Broken Bridge',
      version: '0.0.1',
      description: 'Missing entrypoint detail.',
      kind: 'service',
      entrypoint: {
        type: 'command',
      },
    });

    const result = await bridgeCommand(['validate'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Bridge validation failed.');
    expect(result.message).toContain('entrypoint');
  });

  it('runs a script bridge and forwards arguments', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'sample', 'echo.js'), [
      "const payload = {",
      "  args: process.argv.slice(2),",
      "  cwd: process.cwd(),",
      "};",
      "process.stdout.write(`${JSON.stringify(payload)}\\n`);",
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'run-bridge',
      name: 'Run Bridge',
      version: '0.1.0',
      description: 'Execute a local script bridge.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
        args: ['preset'],
      },
    }, join('.automatosx', 'bridges', 'sample', 'bridge.json'));

    const result = await bridgeCommand(['run', 'run-bridge', 'user-arg'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Bridge executed: run-bridge');
    expect(result.message).toContain('"args":["preset","user-arg"]');
  });

  it('returns a structured failure when bridge execution exits non-zero', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'sample', 'fail.js'), [
      "process.stderr.write('bridge failed\\n');",
      'process.exit(2);',
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'failing-bridge',
      name: 'Failing Bridge',
      version: '0.1.0',
      description: 'Fail during execution.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './fail.js',
      },
    }, join('.automatosx', 'bridges', 'sample', 'bridge.json'));

    const result = await bridgeCommand(['run', 'failing-bridge'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Bridge execution failed: failing-bridge');
    expect(result.message).toContain('Exit code: 2');
    expect(result.message).toContain('bridge failed');
  });

  it('blocks bridges that require explicit trust until the workspace allowlists them', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'sample', 'echo.js'), [
      "process.stdout.write('trusted bridge\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'trusted-bridge',
      name: 'Trusted Bridge',
      version: '0.1.0',
      description: 'Requires explicit trust.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      approval: {
        mode: 'prompt',
      },
    }, join('.automatosx', 'bridges', 'sample', 'bridge.json'));

    const blocked = await bridgeCommand(['run', 'trusted-bridge'], defaultOptions({ outputDir: tempDir }));
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('requires explicit trust');

    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        trust: {
          trustedBridgeIds: ['trusted-bridge'],
        },
      },
    });

    const allowed = await bridgeCommand(['run', 'trusted-bridge'], defaultOptions({ outputDir: tempDir }));
    expect(allowed.success).toBe(true);
    expect(allowed.message).toContain('Bridge executed: trusted-bridge');
    expect(allowed.message).toContain('trusted bridge');
  });

  it('blocks bridges with remote source metadata unless the workspace trusts the source', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'sample', 'echo.js'), [
      "process.stdout.write('remote bridge\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'remote-bridge',
      name: 'Remote Bridge',
      version: '0.1.0',
      description: 'Derived from a remote source.',
      kind: 'script',
      source: {
        type: 'git',
        ref: 'https://github.com/example/internal-bridge.git',
      },
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, join('.automatosx', 'bridges', 'sample', 'bridge.json'));

    const blocked = await bridgeCommand(['run', 'remote-bridge'], defaultOptions({ outputDir: tempDir }));
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('remote source');

    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        trust: {
          trustedSourcePrefixes: ['https://github.com/example/'],
        },
      },
    });

    const allowed = await bridgeCommand(['run', 'remote-bridge'], defaultOptions({ outputDir: tempDir }));
    expect(allowed.success).toBe(true);
    expect(allowed.message).toContain('Bridge executed: remote-bridge');
  });

  it('allows prompt-approved bridges when their source prefix is trusted', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'sample', 'echo.js'), [
      "process.stdout.write('source-trusted bridge\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'source-trusted-bridge',
      name: 'Source Trusted Bridge',
      version: '0.1.0',
      description: 'Requires explicit trust but comes from a trusted source.',
      kind: 'script',
      source: {
        type: 'git',
        ref: 'https://github.com/example/internal-bridge.git',
      },
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      approval: {
        mode: 'prompt',
      },
    }, join('.automatosx', 'bridges', 'sample', 'bridge.json'));

    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        trust: {
          trustedSourcePrefixes: ['https://github.com/example/'],
        },
      },
    });

    const result = await bridgeCommand(['run', 'source-trusted-bridge'], defaultOptions({ outputDir: tempDir }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('Bridge executed: source-trusted-bridge');
    expect(result.message).toContain('source-trusted bridge');
  });
});
