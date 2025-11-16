/**
 * CLI Agent Create Command Tests
 * Tests the "ax agent create" command functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises';
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
      env: { ...process.env, AUTOMATOSX_MOCK_PROVIDERS: 'true' }
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

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 10000);
  });
}

/**
 * Helper to create test project structure
 */
async function createTestProject(testDir: string): Promise<void> {
  // Create .automatosx directory structure
  const automatosxDir = join(testDir, '.automatosx');
  await mkdir(automatosxDir, { recursive: true });
  await mkdir(join(automatosxDir, 'agents'), { recursive: true });
  await mkdir(join(automatosxDir, 'teams'), { recursive: true });
  await mkdir(join(automatosxDir, 'templates'), { recursive: true });

  // Create a sample team config
  const teamConfig = `name: engineering
displayName: "Engineering Team"
description: "Software development team"
provider:
  primary: codex
  fallbackChain: [codex, gemini, claude]
sharedAbilities:
  - code-generation
`;
  await writeFile(join(automatosxDir, 'teams', 'engineering.yaml'), teamConfig, 'utf-8');

  // Create core team for template default
  const coreTeamConfig = `name: core
displayName: "Core Team"
description: "Core quality assurance team"
provider:
  primary: claude
sharedAbilities: []
`;
  await writeFile(join(automatosxDir, 'teams', 'core.yaml'), coreTeamConfig, 'utf-8');

  // Create a basic template
  const basicTemplate = `name: {{AGENT_NAME}}
displayName: "{{DISPLAY_NAME | default: Agent}}"
team: {{TEAM | default: core}}
role: {{ROLE | default: AI Assistant}}
description: {{DESCRIPTION | default: A helpful AI assistant}}
abilities: []
systemPrompt: |
  You are a helpful AI assistant.
`;
  await writeFile(join(automatosxDir, 'templates', 'basic-agent.yaml'), basicTemplate, 'utf-8');
}

describe('CLI Agent Create Command', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await mkdtemp(join(tmpdir(), 'automatosx-test-'));
    await createTestProject(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Help and Usage', () => {
    it('should display help with --help', async () => {
      const result = await execCLI(['agent', 'create', '--help']);

      expect(result.stdout).toContain('create <agent>');
      expect(result.stdout).toContain('Create a new agent from template');
      expect(result.stdout).toContain('--template');
      expect(result.stdout).toContain('--display-name');
      expect(result.stdout).toContain('--role');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Agent Creation - Happy Path', () => {
    it('should create agent with default template', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'test-agent',
        '--display-name',
        'Test Agent',
        '--role',
        'Test Role'
      ], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent \'test-agent\' created successfully');

      // Verify file was created
      const agentFile = join(testDir, '.automatosx', 'agents', 'test-agent.yaml');
      expect(existsSync(agentFile)).toBe(true);

      // Verify content
      const content = await readFile(agentFile, 'utf-8');
      expect(content).toContain('name: test-agent');
      expect(content).toContain('displayName: "Test Agent"');
      expect(content).toContain('role: Test Role');
    });

    it('should create agent with specific template', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'my-agent',
        '--template',
        'basic-agent',
        '--display-name',
        'My Agent',
        '--team',
        'engineering'
      ], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent \'my-agent\' created successfully');

      // Verify file was created
      const agentFile = join(testDir, '.automatosx', 'agents', 'my-agent.yaml');
      expect(existsSync(agentFile)).toBe(true);

      // Verify content
      const content = await readFile(agentFile, 'utf-8');
      expect(content).toContain('name: my-agent');
      expect(content).toContain('team: engineering');
    });

    it('should create agent with description', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'desc-agent',
        '--description',
        'A test agent with description',
        '--display-name',
        'Desc Agent'
      ], testDir);

      expect(result.exitCode).toBe(0);

      const agentFile = join(testDir, '.automatosx', 'agents', 'desc-agent.yaml');
      const content = await readFile(agentFile, 'utf-8');
      expect(content).toContain('description: A test agent with description');
    });

    it('should use agent name as display name if not provided', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'auto-name'
      ], testDir);

      expect(result.exitCode).toBe(0);

      const agentFile = join(testDir, '.automatosx', 'agents', 'auto-name.yaml');
      const content = await readFile(agentFile, 'utf-8');
      expect(content).toContain('displayName: "auto-name"');
    });
  });

  describe('Agent Name Validation', () => {
    it('should reject agent name with uppercase letters', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'TestAgent'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Invalid agent name');
      expect(result.stdout).toContain('lowercase');
    });

    it('should reject agent name with spaces', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'test agent'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
    });

    it('should reject agent name starting with number', async () => {
      const result = await execCLI([
        'agent',
        'create',
        '123agent'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Invalid agent name');
    });

    it('should reject agent name with special characters', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'test@agent'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
    });

    it('should accept agent name with hyphens', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'test-agent-name',
        '--display-name',
        'Test Agent'
      ], testDir);

      expect(result.exitCode).toBe(0);
    });

    it('should accept agent name with numbers', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'agent123',
        '--display-name',
        'Agent 123'
      ], testDir);

      expect(result.exitCode).toBe(0);
    });

    it('should reject agent name that is too short', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'a'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('2-50 characters');
    });
  });

  describe('Agent Already Exists', () => {
    it('should reject creating duplicate agent', async () => {
      // Create first agent
      await execCLI([
        'agent',
        'create',
        'existing-agent',
        '--display-name',
        'Existing'
      ], testDir);

      // Try to create duplicate
      const result = await execCLI([
        'agent',
        'create',
        'existing-agent',
        '--display-name',
        'Another'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('Agent already exists');
    });
  });

  describe('Template Not Found', () => {
    it('should show error when template does not exist', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'test-agent',
        '--template',
        'nonexistent-template'
      ], testDir);

      expect(result.exitCode).not.toBe(0);
      // Error messages go to stderr, not stdout
      expect(result.stderr).toContain('Template not found');
    });
  });

  describe('Template Variable Substitution', () => {
    it('should replace all template variables', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'vars-agent',
        '--display-name',
        'Variables Agent',
        '--role',
        'Test Role',
        '--description',
        'Test Description',
        '--team',
        'engineering'
      ], testDir);

      expect(result.exitCode).toBe(0);

      const agentFile = join(testDir, '.automatosx', 'agents', 'vars-agent.yaml');
      const content = await readFile(agentFile, 'utf-8');

      expect(content).toContain('name: vars-agent');
      expect(content).toContain('displayName: "Variables Agent"');
      expect(content).toContain('role: Test Role');
      expect(content).toContain('description: Test Description');
      expect(content).toContain('team: engineering');
    });

    it('should use default values for missing variables', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'defaults-agent'
      ], testDir);

      expect(result.exitCode).toBe(0);

      const agentFile = join(testDir, '.automatosx', 'agents', 'defaults-agent.yaml');
      const content = await readFile(agentFile, 'utf-8');

      // Should use default values from template
      expect(content).toContain('role: AI Assistant');
      expect(content).toContain('description: A helpful AI assistant');
      expect(content).toContain('team: core');
    });
  });

  describe('Success Messages', () => {
    it('should display success message with details', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'success-agent',
        '--display-name',
        'Success Agent',
        '--team',
        'engineering'
      ], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('created successfully');
      expect(result.stdout).toContain('Display Name: Success Agent');
      expect(result.stdout).toContain('Team:         engineering');
      expect(result.stdout).toContain('Next steps:');
      expect(result.stdout).toContain('ax agent show success-agent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle agent directory not existing', async () => {
      // Remove agents directory
      await rm(join(testDir, '.automatosx', 'agents'), { recursive: true, force: true });

      const result = await execCLI([
        'agent',
        'create',
        'new-agent',
        '--display-name',
        'New Agent'
      ], testDir);

      expect(result.exitCode).toBe(0);

      // Directory should be created
      const agentFile = join(testDir, '.automatosx', 'agents', 'new-agent.yaml');
      expect(existsSync(agentFile)).toBe(true);
    });

    it('should handle long agent names (up to 50 chars)', async () => {
      const longName = 'a'.repeat(50);
      const result = await execCLI([
        'agent',
        'create',
        longName,
        '--display-name',
        'Long Name'
      ], testDir);

      expect(result.exitCode).toBe(0);
    });

    it('should reject agent names over 50 characters', async () => {
      const tooLongName = 'a'.repeat(51);
      const result = await execCLI([
        'agent',
        'create',
        tooLongName
      ], testDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain('2-50 characters');
    });
  });

  describe('Alias Support', () => {
    it('should accept -t as alias for --template', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'alias-agent',
        '-t',
        'basic-agent',
        '--display-name',
        'Alias Agent'
      ], testDir);

      expect(result.exitCode).toBe(0);
    });

    it('should accept -d as alias for --display-name', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'alias2-agent',
        '-d',
        'Alias 2'
      ], testDir);

      expect(result.exitCode).toBe(0);

      const agentFile = join(testDir, '.automatosx', 'agents', 'alias2-agent.yaml');
      const content = await readFile(agentFile, 'utf-8');
      expect(content).toContain('displayName: "Alias 2"');
    });

    it('should accept -r as alias for --role', async () => {
      const result = await execCLI([
        'agent',
        'create',
        'alias3-agent',
        '-r',
        'Test Role'
      ], testDir);

      expect(result.exitCode).toBe(0);

      const agentFile = join(testDir, '.automatosx', 'agents', 'alias3-agent.yaml');
      const content = await readFile(agentFile, 'utf-8');
      expect(content).toContain('role: Test Role');
    });
  });
});
