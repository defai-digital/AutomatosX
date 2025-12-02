import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

describe('CLI: status command', () => {
  it('should display system status', async () => {
    const result = await runCLI(['status']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AutomatosX Status');
    expect(result.stdout).toContain('System:');
    expect(result.stdout).toContain('Version:');
  }, 30000);

  it('should show verbose output with --verbose', async () => {
    const result = await runCLI(['status', '--verbose']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Process Uptime');
    expect(result.stdout).toContain('Performance:');
  }, 30000);

  it('should output JSON with --json', async () => {
    const result = await runCLI(['status', '--json']);

    expect(result.exitCode).toBe(0);

    // Should be valid JSON
    const json = JSON.parse(result.stdout);
    expect(json).toHaveProperty('system');
    expect(json).toHaveProperty('providers');
    expect(json).toHaveProperty('router');
  }, 30000);
});

function runCLI(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 25000  // 25 second timeout
    });

    let stdout = '';
    let stderr = '';

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('CLI command timed out after 25 seconds'));
    }, 25000);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
