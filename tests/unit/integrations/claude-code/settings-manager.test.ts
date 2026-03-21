/**
 * Unit tests for SettingsManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { SettingsManager } from '../../../../src/integrations/claude-code/settings-manager.js';

describe('SettingsManager', () => {
  let tmpDir: string;
  let manager: SettingsManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ax-settings-test-'));
    manager = new SettingsManager(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates settings.json with schema and permissions when absent', async () => {
    const result = await manager.writeMcpPermissions();

    expect(result.created).toBe(true);
    expect(result.permissionsAdded.length).toBeGreaterThan(0);
    expect(result.permissionsAdded).toContain('mcp__automatosx__run_agent');

    const raw = JSON.parse(await readFile(result.path, 'utf-8'));
    expect(raw.$schema).toContain('schemastore.org');
    expect(raw.permissions.allow).toContain('mcp__automatosx__run_agent');
  });

  it('merges permissions without removing existing entries', async () => {
    const claudeDir = join(tmpDir, '.claude');
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      join(claudeDir, 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['SomeOtherTool', 'mcp__automatosx__run_agent'] },
        someUserKey: 'preserved',
      }),
      'utf-8'
    );

    const result = await manager.writeMcpPermissions();

    expect(result.created).toBe(false);
    const raw = JSON.parse(await readFile(result.path, 'utf-8'));
    // User key preserved
    expect(raw.someUserKey).toBe('preserved');
    // Existing entry not duplicated
    const count = raw.permissions.allow.filter(
      (e: string) => e === 'mcp__automatosx__run_agent'
    ).length;
    expect(count).toBe(1);
    // Pre-existing non-automatosx entry preserved
    expect(raw.permissions.allow).toContain('SomeOtherTool');
    // Other automatosx tools added
    expect(raw.permissions.allow).toContain('mcp__automatosx__search_memory');
  });

  it('hasAutomatosXPermissions returns false when file absent', async () => {
    expect(await manager.hasAutomatosXPermissions()).toBe(false);
  });

  it('hasAutomatosXPermissions returns true after writeMcpPermissions', async () => {
    await manager.writeMcpPermissions();
    expect(await manager.hasAutomatosXPermissions()).toBe(true);
  });
});
