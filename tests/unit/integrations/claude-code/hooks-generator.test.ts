/**
 * Unit tests for HooksGenerator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HooksGenerator } from '../../../../src/integrations/claude-code/hooks-generator.js';

describe('HooksGenerator', () => {
  let tmpDir: string;
  let gen: HooksGenerator;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ax-hooks-test-'));
    gen = new HooksGenerator({ projectDir: tmpDir });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates hook scripts in .claude/hooks/', async () => {
    const result = await gen.generate();

    expect(result.hooksDir).toBe(join(tmpDir, '.claude', 'hooks'));
    expect(result.scriptsWritten.length).toBeGreaterThan(0);
    expect(result.scriptsWritten).toContain('pre-tool-use.sh');
    expect(result.scriptsWritten).toContain('post-tool-use.sh');
    expect(result.scriptsWritten).toContain('session-start.sh');
    expect(result.scriptsWritten).toContain('session-end.sh');
  });

  it('scripts are executable', async () => {
    await gen.generate();
    const scriptPath = join(tmpDir, '.claude', 'hooks', 'pre-tool-use.sh');
    await expect(access(scriptPath, constants.X_OK)).resolves.toBeUndefined();
  });

  it('scripts contain correct shebang', async () => {
    await gen.generate();
    const content = await readFile(
      join(tmpDir, '.claude', 'hooks', 'pre-tool-use.sh'),
      'utf-8'
    );
    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  it('skips existing scripts when force=false (default)', async () => {
    await gen.generate();
    const result2 = await gen.generate();
    expect(result2.scriptsSkipped.length).toBeGreaterThan(0);
    expect(result2.scriptsWritten.length).toBe(0);
  });

  it('overwrites existing scripts when force=true', async () => {
    await gen.generate();
    const forceGen = new HooksGenerator({ projectDir: tmpDir, force: true });
    const result = await forceGen.generate();
    expect(result.scriptsWritten.length).toBeGreaterThan(0);
    expect(result.scriptsSkipped.length).toBe(0);
  });

  it('writes hook config into settings.json (creates .claude/ if needed)', async () => {
    // No pre-creation of .claude/ or settings.json — the generator must create them
    await gen.generate();

    const settings = JSON.parse(
      await readFile(join(tmpDir, '.claude', 'settings.json'), 'utf-8')
    );
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks['PreToolUse']).toBeDefined();
    expect(settings.hooks['SessionStart']).toBeDefined();
  });

  it('merges hook config with existing settings.json', async () => {
    // When settings.json already has content, hooks should be merged not overwritten
    const { mkdir: fsMkdir, writeFile: fsWriteFile } = await import('fs/promises');
    await fsMkdir(join(tmpDir, '.claude'), { recursive: true });
    await fsWriteFile(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['mcp__automatosx__*'] } }),
      'utf-8'
    );

    await gen.generate();

    const settings = JSON.parse(
      await readFile(join(tmpDir, '.claude', 'settings.json'), 'utf-8')
    );
    // Original permissions preserved
    expect(settings.permissions?.allow).toContain('mcp__automatosx__*');
    // Hooks added
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks['PreToolUse']).toBeDefined();
  });

  it('buildHooksConfig includes all default events', () => {
    const config = gen.buildHooksConfig();
    expect(config['PreToolUse']).toBeDefined();
    expect(config['PostToolUse']).toBeDefined();
    expect(config['SessionStart']).toBeDefined();
    expect(config['SessionEnd']).toBeDefined();
  });

  it('PreToolUse hook has matcher .*', () => {
    const config = gen.buildHooksConfig();
    const matchers = config['PreToolUse'];
    expect(matchers).toBeDefined();
    expect(matchers![0]?.matcher).toBe('.*');
  });

  it('areHooksGenerated returns false before generate', async () => {
    expect(await gen.areHooksGenerated()).toBe(false);
  });

  it('areHooksGenerated returns true after generate', async () => {
    await gen.generate();
    expect(await gen.areHooksGenerated()).toBe(true);
  });

  it('respects custom enabledEvents', async () => {
    const customGen = new HooksGenerator({
      projectDir: tmpDir,
      enabledEvents: ['SessionStart'],
    });
    const result = await customGen.generate();
    expect(result.scriptsWritten).toContain('session-start.sh');
    expect(result.scriptsWritten).not.toContain('pre-tool-use.sh');
  });
});
