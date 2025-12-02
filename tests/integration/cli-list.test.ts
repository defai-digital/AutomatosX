import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

describe('CLI: list command', () => {
  let testDir: string;

  beforeAll(async () => {
    // Create test directory with sample agents and abilities
    testDir = await mkdtemp(join(tmpdir(), 'automatosx-list-test-'));

    const automatosxDir = join(testDir, '.automatosx');
    await mkdir(join(automatosxDir, 'agents'), { recursive: true });
    await mkdir(join(automatosxDir, 'abilities'), { recursive: true });

    // Create sample agent
    await writeFile(
      join(automatosxDir, 'agents', 'test-agent.yaml'),
      'name: test-agent\ndisplayName: "Test Agent"\ndescription: "A test agent"'
    );

    // Create sample ability
    await writeFile(
      join(automatosxDir, 'abilities', 'test-ability.md'),
      '# Test Ability\n\nA test ability for testing.'
    );
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should list agents', async () => {
    const result = await runCLI(['list', 'agents'], testDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Available Agents');
    expect(result.stdout).toContain('Test Agent'); // displayName is shown now
    expect(result.stdout).toContain('A test agent');
  }, 10000);

  it('should list abilities', async () => {
    const result = await runCLI(['list', 'abilities'], testDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Available Abilities');
    expect(result.stdout).toContain('Test Ability');
  }, 10000);

  it('should list providers', async () => {
    const result = await runCLI(['list', 'providers'], testDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Available Providers');
    expect(result.stdout).toContain('claude');
  }, 10000);

  it('should fail with invalid list type', async () => {
    const result = await runCLI(['list', 'invalid'], testDir);

    expect(result.exitCode).toBe(1);
  }, 10000);
});

function runCLI(args: string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd,
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
