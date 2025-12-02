/**
 * E2E Test Helpers
 *
 * Provides utilities for end-to-end testing of complete workflows
 */

import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * E2E test environment
 */
export interface E2ETestEnv {
  testDir: string;
  cliPath: string;
  configPath: string;
  agentsDir: string;
  memoryDbPath: string;
}

/**
 * Create isolated test environment
 */
export async function createTestEnv(): Promise<E2ETestEnv> {
  const testDir = join(tmpdir(), `automatosx-e2e-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  const automatosxDir = join(testDir, '.automatosx');
  const agentsDir = join(automatosxDir, 'agents');
  const abilitiesDir = join(automatosxDir, 'abilities');
  const memoryDir = join(automatosxDir, 'memory');

  await mkdir(agentsDir, { recursive: true });
  await mkdir(abilitiesDir, { recursive: true });
  await mkdir(memoryDir, { recursive: true });

  const cliPath = join(process.cwd(), 'dist', 'index.js');
  const configPath = join(automatosxDir, 'config.json');
  const memoryDbPath = join(automatosxDir, 'memory.db');

  // Create default config (matching DEFAULT_CONFIG structure)
  const defaultConfig = {
    version: '5.0.0',
    providers: {
      'claude-code': {
        enabled: true,
        priority: 1,
        timeout: 120000,
        command: 'claude'
      },
      'gemini-cli': {
        enabled: true,
        priority: 2,
        timeout: 180000,
        command: 'gemini'
      }
    },
    memory: {
      maxEntries: 10000,
      persistPath: '.automatosx/memory',
      autoCleanup: true,
      cleanupDays: 30
    },
    workspace: {
      basePath: '.automatosx/workspaces',
      autoCleanup: true,
      cleanupDays: 7,
      maxFiles: 100
    },
    logging: {
      level: 'info',
      path: '.automatosx/logs',
      console: true
    }
  };

  await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

  return {
    testDir,
    cliPath,
    configPath,
    agentsDir,
    memoryDbPath
  };
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnv(env: E2ETestEnv): Promise<void> {
  await rm(env.testDir, { recursive: true, force: true });
}

/**
 * Create agent profile
 */
export async function createAgentProfile(
  env: E2ETestEnv,
  name: string,
  options: {
    role?: string;
    description?: string;
    systemPrompt?: string;
    abilities?: string[];
    provider?: string;
    temperature?: number;
    team?: string;
  } = {}
): Promise<string> {
  // Build profile without team field for test env (allows fallback to defaults)
  const profileLines = [
    `name: ${name}`,
    `role: ${options.role || 'assistant'}`,
    `description: "${options.description || `Test agent: ${name}`}"`,
    `systemPrompt: "${options.systemPrompt || 'You are a helpful assistant.'}"`,
    `abilities: ${JSON.stringify(options.abilities || [])}`,
    `provider: ${options.provider || 'claude'}`,
    `temperature: ${options.temperature ?? 0.7}`
  ];

  // Only add team if explicitly specified
  if (options.team) {
    profileLines.splice(1, 0, `team: ${options.team}`);
  }

  const profile = profileLines.join('\n') + '\n';

  const profilePath = join(env.agentsDir, `${name}.yaml`);
  await writeFile(profilePath, profile);
  return profilePath;
}

/**
 * Create ability file
 */
export async function createAbility(
  env: E2ETestEnv,
  name: string,
  content: string
): Promise<string> {
  const abilitiesDir = join(env.testDir, '.automatosx', 'abilities');
  await mkdir(abilitiesDir, { recursive: true });

  const abilityPath = join(abilitiesDir, `${name}.md`);
  await writeFile(abilityPath, content);
  return abilityPath;
}

/**
 * Execute CLI command
 */
export async function execCLI(
  env: E2ETestEnv,
  args: string[],
  options: {
    timeout?: number;
    mockProviders?: boolean;
    input?: string;
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const execEnv = {
    ...process.env,
    ...(options.mockProviders !== false && { AX_MOCK_PROVIDERS: 'true' })
  };

  // Add --config flag if not present and command needs it
  const finalArgs = [...args];

  if (!finalArgs.includes('--config') && !finalArgs.includes('-c')) {
    // Insert --config at the beginning (after no command, before first arg)
    finalArgs.unshift('--config', env.configPath);
  }

  try {
    const result = await execFileAsync('node', [env.cliPath, ...finalArgs], {
      cwd: env.testDir,
      env: execEnv,
      timeout: options.timeout || 15000,
      killSignal: 'SIGTERM'
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

/**
 * Execute CLI command with streaming (for interactive commands)
 */
export async function execCLIInteractive(
  env: E2ETestEnv,
  args: string[],
  options: {
    timeout?: number;
    mockProviders?: boolean;
    input?: string[];
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const execEnv = {
      ...process.env,
      ...(options.mockProviders !== false && { AX_MOCK_PROVIDERS: 'true' })
    };

    const child = spawn('node', [env.cliPath, ...args], {
      cwd: env.testDir,
      env: execEnv
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Send input if provided
    if (options.input && options.input.length > 0) {
      setTimeout(() => {
        options.input!.forEach((line, index) => {
          setTimeout(() => {
            child.stdin.write(line + '\n');
            if (index === options.input!.length - 1) {
              child.stdin.end();
            }
          }, index * 100);
        });
      }, 1000);
    }

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    child.on('error', (err) => {
      reject(err);
    });

    // Timeout
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        stdout,
        stderr,
        exitCode: 124 // Timeout exit code
      });
    }, options.timeout || 15000);

    child.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * Read config file
 */
export async function readConfig(env: E2ETestEnv): Promise<any> {
  const content = await readFile(env.configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Update config file
 */
export async function updateConfig(env: E2ETestEnv, updates: any): Promise<void> {
  const config = await readConfig(env);
  const updated = { ...config, ...updates };
  await writeFile(env.configPath, JSON.stringify(updated, null, 2));
}

/**
 * Add memory entry via CLI
 */
export async function addMemory(
  env: E2ETestEnv,
  content: string,
  type: 'task' | 'code' | 'document' | 'conversation' | 'other' = 'task'
): Promise<string> {
  // Add database path
  const memoryDbPath = join(env.testDir, '.automatosx', 'memory', 'memory.db');
  const result = await execCLI(env, ['memory', 'add', content, '--type', type, '--db', memoryDbPath]);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to add memory: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * List memory entries via CLI
 */
export async function listMemory(
  env: E2ETestEnv,
  options: {
    type?: string;
    limit?: number;
  } = {}
): Promise<string> {
  const args = ['memory', 'list'];
  if (options.type) args.push('--type', options.type);
  if (options.limit) args.push('--limit', String(options.limit));

  // Add database path
  const memoryDbPath = join(env.testDir, '.automatosx', 'memory', 'memory.db');
  args.push('--db', memoryDbPath);

  const result = await execCLI(env, args);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to list memory: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(options.errorMessage || 'Condition not met within timeout');
}

/**
 * Assert CLI output contains expected text
 */
export function assertOutputContains(output: string, expected: string | RegExp): void {
  if (typeof expected === 'string') {
    if (!output.includes(expected)) {
      throw new Error(`Expected output to contain "${expected}", but got:\n${output}`);
    }
  } else {
    if (!expected.test(output)) {
      throw new Error(`Expected output to match ${expected}, but got:\n${output}`);
    }
  }
}

/**
 * Assert CLI command succeeded
 */
export function assertSuccess(result: { exitCode: number; stderr: string; stdout?: string }): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed with exit code ${result.exitCode}:\n` +
      `STDERR:\n${result.stderr}\n` +
      `STDOUT:\n${result.stdout || '(empty)'}`
    );
  }
}

/**
 * Assert CLI command failed
 */
export function assertFailure(result: { exitCode: number }): void {
  if (result.exitCode === 0) {
    throw new Error('Expected command to fail, but it succeeded');
  }
}
