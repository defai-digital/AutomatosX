/**
 * CLI Agent List Command Tests
 * Tests the "ax agent list" command functionality
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
 * Helper to create test project with agents
 */
async function createTestProject(testDir: string): Promise<void> {
  const automatosxDir = join(testDir, '.automatosx');
  await mkdir(automatosxDir, { recursive: true });
  await mkdir(join(automatosxDir, 'agents'), { recursive: true });
  await mkdir(join(automatosxDir, 'teams'), { recursive: true });

  // Create team configs
  const teams = [
    { name: 'core', displayName: 'Core Team', description: 'Core quality assurance team' },
    { name: 'engineering', displayName: 'Engineering Team', description: 'Software development team' },
    { name: 'business', displayName: 'Business Team', description: 'Product and business team' },
    { name: 'design', displayName: 'Design Team', description: 'Design and content team' }
  ];

  for (const team of teams) {
    const teamConfig = `name: ${team.name}
displayName: "${team.displayName}"
description: "${team.description}"
provider:
  primary: codex
sharedAbilities: []
`;
    await writeFile(join(automatosxDir, 'teams', `${team.name}.yaml`), teamConfig, 'utf-8');
  }
}

/**
 * Helper to create sample agent
 */
async function createAgent(testDir: string, name: string, displayName: string, team: string, role: string = 'AI Assistant'): Promise<void> {
  const agentConfig = `name: ${name}
displayName: "${displayName}"
team: ${team}
role: ${role}
description: Test agent for CLI testing
abilities: []
systemPrompt: |
  You are a helpful assistant.
`;
  await writeFile(join(testDir, '.automatosx', 'agents', `${name}.yaml`), agentConfig, 'utf-8');
}

describe('CLI Agent List Command', () => {
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
      const result = await execCLI(['agent', 'list', '--help']);

      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('List all agents');
      expect(result.stdout).toContain('--by-team');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Empty Agent List', () => {
    it('should show fallback agents when no local agents exist', async () => {
      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      // Should show fallback agents from examples/agents
      expect(result.stdout).toContain('Agents');
      expect(result.stdout).toContain('total');
    });
  });

  describe('List All Agents', () => {
    it('should list all agents grouped by team', async () => {
      // Create agents in different teams
      await createAgent(testDir, 'agent1', 'Agent One', 'core', 'QA Specialist');
      await createAgent(testDir, 'agent2', 'Agent Two', 'engineering', 'Backend Engineer');
      await createAgent(testDir, 'agent3', 'Agent Three', 'business', 'Product Manager');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      // Will include fallback agents + 3 local agents
      expect(result.stdout).toContain('Agents');
      expect(result.stdout).toContain('total');
      expect(result.stdout).toContain('Core Team');
      expect(result.stdout).toContain('Engineering Team');
      expect(result.stdout).toContain('Business Team');
      expect(result.stdout).toContain('agent1 (Agent One)');
      expect(result.stdout).toContain('agent2 (Agent Two)');
      expect(result.stdout).toContain('agent3 (Agent Three)');
    });

    it('should display agent roles when available', async () => {
      await createAgent(testDir, 'backend', 'Bob', 'engineering', 'Senior Backend Engineer');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('backend (Bob)');
      expect(result.stdout).toContain('Senior Backend Engineer');
    });

    it('should handle agents without display names', async () => {
      await createAgent(testDir, 'test-agent', '', 'core');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-agent');
    });

    it('should show usage hint at the end', async () => {
      await createAgent(testDir, 'agent1', 'Agent One', 'core');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ax agent show <name>');
    });
  });

  describe('Filter By Team', () => {
    beforeEach(async () => {
      await createAgent(testDir, 'core1', 'Core One', 'core');
      await createAgent(testDir, 'core2', 'Core Two', 'core');
      await createAgent(testDir, 'eng1', 'Eng One', 'engineering');
      await createAgent(testDir, 'bus1', 'Bus One', 'business');
    });

    it('should filter agents by core team', async () => {
      const result = await execCLI(['agent', 'list', '--by-team', 'core'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Core Team');
      expect(result.stdout).toContain('core1');
      expect(result.stdout).toContain('core2');
      expect(result.stdout).not.toContain('Engineering Team');
      expect(result.stdout).not.toContain('eng1');
    });

    it('should filter agents by engineering team', async () => {
      const result = await execCLI(['agent', 'list', '--by-team', 'engineering'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Engineering Team');
      expect(result.stdout).toContain('eng1');
      expect(result.stdout).not.toContain('Core Team');
      expect(result.stdout).not.toContain('core1');
    });

    it('should filter agents by business team', async () => {
      const result = await execCLI(['agent', 'list', '--by-team', 'business'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Business Team');
      expect(result.stdout).toContain('bus1');
    });

    it('should filter agents by design team', async () => {
      await createAgent(testDir, 'designer1', 'Designer', 'design');

      const result = await execCLI(['agent', 'list', '--by-team', 'design'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Design Team');
      expect(result.stdout).toContain('designer1');
    });

    it('should show research team when filtering', async () => {
      // Create research team first
      const researchTeam = `name: research
displayName: "Research Team"
provider:
  primary: codex
sharedAbilities: []
`;
      await writeFile(join(testDir, '.automatosx', 'teams', 'research.yaml'), researchTeam, 'utf-8');
      await createAgent(testDir, 'researcher1', 'Researcher', 'research');

      const result = await execCLI(['agent', 'list', '--by-team', 'research'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Research Team');
      expect(result.stdout).toContain('researcher1');
    });
  });

  describe('Multiple Agents Per Team', () => {
    it('should display count per team', async () => {
      await createAgent(testDir, 'eng1', 'Eng One', 'engineering');
      await createAgent(testDir, 'eng2', 'Eng Two', 'engineering');
      await createAgent(testDir, 'eng3', 'Eng Three', 'engineering');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      // Should show Engineering Team with some count (includes fallback agents)
      expect(result.stdout).toMatch(/Engineering Team \(\d+\)/);
      // Should include our test agents
      expect(result.stdout).toContain('eng1');
      expect(result.stdout).toContain('eng2');
      expect(result.stdout).toContain('eng3');
    });

    it('should list all agents in team', async () => {
      await createAgent(testDir, 'agent1', 'One', 'core');
      await createAgent(testDir, 'agent2', 'Two', 'core');
      await createAgent(testDir, 'agent3', 'Three', 'core');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      // Should show Core Team with some count (includes fallback agents)
      expect(result.stdout).toMatch(/Core Team \(\d+\)/);
      // Should include all our test agents
      expect(result.stdout).toContain('agent1');
      expect(result.stdout).toContain('agent2');
      expect(result.stdout).toContain('agent3');
    });
  });

  describe('Other Team', () => {
    it('should group agents without team as "Other"', async () => {
      // Create agent without team field
      const agentConfig = `name: no-team-agent
displayName: "No Team"
role: AI Assistant
description: Test agent without team
abilities: []
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'no-team-agent.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Other');
      expect(result.stdout).toContain('no-team-agent');
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted agent files gracefully', async () => {
      // Create valid agent
      await createAgent(testDir, 'valid-agent', 'Valid', 'core');

      // Create corrupted agent
      await writeFile(join(testDir, '.automatosx', 'agents', 'corrupted.yaml'), 'invalid: yaml: content:', 'utf-8');

      const result = await execCLI(['agent', 'list'], testDir);

      // Should still show valid agent
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('valid-agent');
    });

    it('should handle missing teams directory', async () => {
      await createAgent(testDir, 'agent1', 'Agent One', 'core');
      await rm(join(testDir, '.automatosx', 'teams'), { recursive: true, force: true });

      const result = await execCLI(['agent', 'list'], testDir);

      // Should still work with default team configuration
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Display Format', () => {
    it('should show total agent count', async () => {
      await createAgent(testDir, 'agent1', 'One', 'core');
      await createAgent(testDir, 'agent2', 'Two', 'engineering');
      await createAgent(testDir, 'agent3', 'Three', 'business');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      // Will include fallback agents + local agents
      expect(result.stdout).toContain('Agents');
      expect(result.stdout).toContain('total');
      expect(result.stdout).toContain('agent1');
      expect(result.stdout).toContain('agent2');
      expect(result.stdout).toContain('agent3');
    });

    it('should not show empty teams', async () => {
      await createAgent(testDir, 'agent1', 'One', 'core');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Core Team');
      expect(result.stdout).not.toContain('Engineering Team (0)');
      expect(result.stdout).not.toContain('Business Team (0)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(50);
      await createAgent(testDir, longName, 'Long Name', 'core');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(longName);
    });

    it('should handle special characters in display names', async () => {
      // Create agent with special characters (avoiding quotes that break YAML)
      const agentConfig = `name: agent1
displayName: "Agent <Special> & Name"
team: core
role: AI Assistant
description: Test agent for CLI testing
abilities: []
systemPrompt: |
  You are a helpful assistant.
`;
      await writeFile(join(testDir, '.automatosx', 'agents', 'agent1.yaml'), agentConfig, 'utf-8');

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent1');
      expect(result.stdout).toContain('Special');
    });

    it('should handle agents with very long roles', async () => {
      const longRole = 'A'.repeat(100) + ' Engineer';
      await createAgent(testDir, 'agent1', 'Agent', 'engineering', longRole);

      const result = await execCLI(['agent', 'list'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent1');
    });
  });
});
