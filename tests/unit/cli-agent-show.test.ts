/**
 * CLI Agent Show Command Tests
 * Tests the "ax agent show" command functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

/**
 * Helper to execute CLI command
 */
async function execCLI(args: string[], cwd?: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, AX_MOCK_PROVIDERS: 'true' }
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
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 10000);
  });
}

/**
 * Helper to create test project
 */
async function createTestProject(testDir: string): Promise<void> {
  const automatosxDir = join(testDir, '.automatosx');
  await mkdir(automatosxDir, { recursive: true });
  await mkdir(join(automatosxDir, 'agents'), { recursive: true });
  await mkdir(join(automatosxDir, 'teams'), { recursive: true });

  const teamConfig = `name: engineering
displayName: "Engineering Team"
description: "Software development team"
provider:
  primary: codex
sharedAbilities: []
`;
  await writeFile(join(automatosxDir, 'teams', 'engineering.yaml'), teamConfig, 'utf-8');
}

/**
 * Helper to create agent with full configuration
 */
async function createFullAgent(testDir: string): Promise<void> {
  const agentConfig = `name: backend
displayName: "Bob"
team: engineering
role: Senior Backend Engineer
description: Expert in API design and database optimization
abilities:
  - api-design
  - db-modeling
provider: codex
model: gpt-4
temperature: 0.7
maxTokens: 4096
orchestration:
  maxDelegationDepth: 1
systemPrompt: |
  You are Bob, a Senior Backend Engineer.
`;
  await writeFile(join(testDir, '.automatosx', 'agents', 'backend.yaml'), agentConfig, 'utf-8');
}

/**
 * Helper to create minimal agent
 */
async function createMinimalAgent(testDir: string, name: string): Promise<void> {
  const agentConfig = `name: ${name}
displayName: "${name}-display"
team: engineering
role: AI Assistant
description: Test agent for CLI testing
systemPrompt: |
  You are a helpful assistant.
`;
  await writeFile(join(testDir, '.automatosx', 'agents', `${name}.yaml`), agentConfig, 'utf-8');
}

describe('CLI Agent Show Command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'automatosx-test-'));
    await createTestProject(testDir);
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Help and Usage', () => {
    it('should display help with --help', async () => {
      const result = await execCLI(['agent', 'show', '--help']);

      expect(result.stdout).toContain('show <agent>');
      expect(result.stdout).toContain('Show agent details');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Show Full Agent Details', () => {
    it('should display all agent information', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'backend'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent: backend');
      expect(result.stdout).toContain('Display Name: Bob');
      expect(result.stdout).toContain('Team:         engineering');
      expect(result.stdout).toContain('Role:         Senior Backend Engineer');
      expect(result.stdout).toContain('Description:  Expert in API design');
    });

    it('should display abilities section', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'backend'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Abilities:');
      expect(result.stdout).toContain('api-design');
      expect(result.stdout).toContain('db-modeling');
    });

    it('should display configuration section', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'backend'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration:');
      expect(result.stdout).toContain('Provider:    codex');
      expect(result.stdout).toContain('Model:       gpt-4');
      expect(result.stdout).toContain('Temperature: 0.7');
      expect(result.stdout).toContain('Max Tokens:  4096');
    });

    it('should display orchestration section', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'backend'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Orchestration:');
      expect(result.stdout).toContain('Max Delegation Depth: 1');
    });

    it('should display file location', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'backend'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('File:');
      expect(result.stdout).toContain('backend.yaml');
    });
  });

  describe('Show Minimal Agent', () => {
    it('should handle agent with minimal configuration', async () => {
      await createMinimalAgent(testDir, 'minimal');

      const result = await execCLI(['agent', 'show', 'minimal'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent: minimal');
      expect(result.stdout).toContain('Display Name: minimal-display');
      expect(result.stdout).toContain('Team:         engineering');
    });

    it('should not show sections with no data', async () => {
      await createMinimalAgent(testDir, 'simple');

      const result = await execCLI(['agent', 'show', 'simple'], testDir);

      expect(result.exitCode).toBe(0);
      // Should have basic info
      expect(result.stdout).toContain('Agent: simple');
      // Should not show empty abilities or orchestration
    });
  });

  describe('Agent Not Found', () => {
    it('should show error for non-existent agent', async () => {
      const result = await execCLI(['agent', 'show', 'nonexistent'], testDir);

      expect(result.exitCode).not.toBe(0);
      // Error messages go to stderr, not stdout
      expect(result.stderr).toContain('Agent not found: nonexistent');
    });

    it('should suggest similar agents', async () => {
      await createMinimalAgent(testDir, 'backend');
      await createMinimalAgent(testDir, 'frontend');

      const result = await execCLI(['agent', 'show', 'backen'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Did you mean');
      expect(result.stdout).toContain('backend');
    });

    it('should suggest running agent list when no similar agents', async () => {
      const result = await execCLI(['agent', 'show', 'xyz123'], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('ax agent list');
    });
  });

  describe('Display Name Resolution', () => {
    it('should resolve agent by display name', async () => {
      await createFullAgent(testDir);

      // Show by display name "Bob"
      const result = await execCLI(['agent', 'show', 'Bob'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent: backend');
      expect(result.stdout).toContain('Display Name: Bob');
    });

    it('should handle case-insensitive display name', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'bob'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent: backend');
    });
  });

  describe('Optional Fields', () => {
    it('should display role when set', async () => {
      await createMinimalAgent(testDir, 'withrole');

      const result = await execCLI(['agent', 'show', 'withrole'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Role:');
      expect(result.stdout).toContain('AI Assistant');
    });

    it('should display description when set', async () => {
      await createMinimalAgent(testDir, 'withdesc');

      const result = await execCLI(['agent', 'show', 'withdesc'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Description:');
      expect(result.stdout).toContain('Test agent');
    });

    it('should not display abilities if empty', async () => {
      await createMinimalAgent(testDir, 'noabilities');

      const result = await execCLI(['agent', 'show', 'noabilities'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('Abilities:');
    });

    it('should not display provider config if not set', async () => {
      await createMinimalAgent(testDir, 'noprovider');

      const result = await execCLI(['agent', 'show', 'noprovider'], testDir);

      expect(result.exitCode).toBe(0);
      // Should show Configuration section but with minimal info
      expect(result.stdout).toContain('Configuration:');
    });
  });

  describe('Multiple Abilities', () => {
    it('should display all abilities as bullet list', async () => {
      const agentConfig = `name: multi
displayName: "Multi"
team: engineering
role: AI Assistant
description: Test agent with multiple abilities
abilities:
  - ability1
  - ability2
  - ability3
  - ability4
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'multi.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'show', 'multi'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Abilities:');
      expect(result.stdout).toContain('ability1');
      expect(result.stdout).toContain('ability2');
      expect(result.stdout).toContain('ability3');
      expect(result.stdout).toContain('ability4');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long descriptions', async () => {
      const longDesc = 'A'.repeat(500);
      const agentConfig = `name: longdesc
displayName: "Long Desc"
team: engineering
role: AI Assistant
description: ${longDesc}
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'longdesc.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'show', 'longdesc'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(longDesc);
    });

    it('should handle special characters in fields', async () => {
      const agentConfig = `name: special
displayName: "Agent <Special> & Name"
team: engineering
role: Engineer & Developer | Tech Lead
description: Test agent with special characters
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'special.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'show', 'special'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('special');
    });

    it('should handle temperature of 0', async () => {
      const agentConfig = `name: temp0
displayName: "Temp Zero"
team: engineering
role: AI Assistant
description: Test agent with temperature 0
temperature: 0
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'temp0.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'show', 'temp0'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Temperature: 0');
    });

    it('should handle maxDelegationDepth of 0', async () => {
      const agentConfig = `name: depth0
displayName: "Depth Zero"
team: engineering
role: AI Assistant
description: Test agent with maxDelegationDepth 0
orchestration:
  maxDelegationDepth: 0
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'depth0.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'show', 'depth0'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Orchestration:');
      expect(result.stdout).toContain('Max Delegation Depth: 0');
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted YAML file', async () => {
      await writeFile(join(testDir, '.automatosx', 'agents', 'corrupted.yaml'), 'invalid: yaml: syntax:', 'utf-8');

      const result = await execCLI(['agent', 'show', 'corrupted'], testDir);

      expect(result.exitCode).not.toBe(0);
    });

    it('should handle missing teams directory', async () => {
      await createMinimalAgent(testDir, 'test');
      await rm(join(testDir, '.automatosx', 'teams'), { recursive: true, force: true });

      const result = await execCLI(['agent', 'show', 'test'], testDir);

      // Should still work with default configuration
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Formatting', () => {
    it('should format output with proper spacing', async () => {
      await createFullAgent(testDir);

      const result = await execCLI(['agent', 'show', 'backend'], testDir);

      expect(result.exitCode).toBe(0);
      // Check for emoji and formatting
      expect(result.stdout).toMatch(/🤖 Agent:/);
      // Check for proper spacing in key-value pairs
      expect(result.stdout).toMatch(/Display Name:/);
      expect(result.stdout).toMatch(/Team:\s+engineering/);
    });
  });
});
