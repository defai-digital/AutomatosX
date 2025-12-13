/**
 * Init Command Tests
 *
 * Verifies that init creates required files even when .automatosx does not exist.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { constants } from 'node:fs';
import { initCommand } from '../../src/cli/commands/init.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe('Init Command', () => {
  let cwdBackup: string;
  let tempDir: string;

  beforeEach(async () => {
    cwdBackup = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), 'ax-init-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(cwdBackup);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates .automatosx and CUSTOM.md when missing', async () => {
    // Ensure directory is missing before running
    expect(await pathExists(join(tempDir, '.automatosx'))).toBe(false);

    await initCommand.handler({ force: false, skipUpdate: true, _: [], $0: '' });

    const automatosxDir = join(tempDir, '.automatosx');
    const customMdPath = join(automatosxDir, 'CUSTOM.md');

    expect(await pathExists(automatosxDir)).toBe(true);
    expect(await pathExists(customMdPath)).toBe(true);
  });
});
