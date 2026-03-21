/**
 * Unit tests for McpProjectConfigGenerator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { McpProjectConfigGenerator } from '../../../../src/integrations/claude-code/mcp-project-config.js';

describe('McpProjectConfigGenerator', () => {
  let tmpDir: string;
  let gen: McpProjectConfigGenerator;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ax-mcp-project-test-'));
    gen = new McpProjectConfigGenerator(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .mcp.json with automatosx stdio entry', async () => {
    const result = await gen.generate();

    expect(result.created).toBe(true);
    const raw = JSON.parse(await readFile(result.path, 'utf-8'));
    expect(raw.mcpServers.automatosx).toBeDefined();
    expect(raw.mcpServers.automatosx.type).toBe('stdio');
    expect(raw.mcpServers.automatosx.command).toBe('automatosx');
    expect(raw.mcpServers.automatosx.args).toContain('mcp');
  });

  it('merges automatosx entry without removing other servers', async () => {
    await writeFile(
      join(tmpDir, '.mcp.json'),
      JSON.stringify({ mcpServers: { github: { type: 'http', url: 'https://example.com' } } }),
      'utf-8'
    );

    const result = await gen.generate();

    expect(result.created).toBe(false);
    expect(result.merged).toBe(true);
    const raw = JSON.parse(await readFile(result.path, 'utf-8'));
    expect(raw.mcpServers.github).toBeDefined();
    expect(raw.mcpServers.automatosx).toBeDefined();
  });

  it('isGenerated returns false when .mcp.json absent', async () => {
    expect(await gen.isGenerated()).toBe(false);
  });

  it('isGenerated returns true after generate()', async () => {
    await gen.generate();
    expect(await gen.isGenerated()).toBe(true);
  });
});
