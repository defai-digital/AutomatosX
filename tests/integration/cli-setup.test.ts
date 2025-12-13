import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import { constants } from 'fs';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

describe('CLI: init command', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'automatosx-cli-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should initialize project in empty directory', async () => {
    const result = await runCLI(['setup', testDir]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AutomatosX set up successfully!');

    // Verify directory structure
    const automatosxDir = join(testDir, '.automatosx');
    await expect(pathExists(automatosxDir)).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'agents'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'teams'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'abilities'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'templates'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'memory'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'memory', 'exports'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'sessions'))).resolves.toBe(true);
    await expect(pathExists(join(automatosxDir, 'logs'))).resolves.toBe(true);

    // Verify config file
    const configPath = join(testDir, 'ax.config.json');
    await expect(pathExists(configPath)).resolves.toBe(true);
  }, 10000);

  it('should warn when already initialized without --force', async () => {
    // Initialize once
    await runCLI(['setup', testDir]);

    // Try to initialize again (should warn and exit with error)
    const result = await runCLI(['setup', testDir]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('already set up');
  }, 10000);

  it('should reinitialize with --force flag', async () => {
    // Initialize once
    await runCLI(['setup', testDir]);

    // Reinitialize with --force
    const result = await runCLI(['setup', testDir, '--force']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Re-running setup (--force flag detected)');
  }, 20000);
});

/**
 * Helper: Check if path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Run CLI command
 */
function runCLI(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
  });
}
