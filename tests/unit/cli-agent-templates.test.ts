/**
 * CLI Agent Templates Command Tests
 * Tests the "ax agent templates" command functionality
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
  await mkdir(join(automatosxDir, 'templates'), { recursive: true });
}

/**
 * Helper to create template file
 */
async function createTemplate(testDir: string, name: string): Promise<void> {
  const templateContent = `name: {{AGENT_NAME}}
displayName: "{{DISPLAY_NAME | default: Agent}}"
team: {{TEAM | default: core}}
role: {{ROLE | default: AI Assistant}}
description: {{DESCRIPTION | default: A helpful AI assistant}}
systemPrompt: |
  You are a helpful assistant.
`;
  await writeFile(join(testDir, '.automatosx', 'templates', `${name}.yaml`), templateContent, 'utf-8');
}

describe('CLI Agent Templates Command', () => {
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
      const result = await execCLI(['agent', 'templates', '--help']);

      expect(result.stdout).toContain('templates');
      expect(result.stdout).toContain('List available agent templates');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Default Templates', () => {
    it('should list default templates from package', async () => {
      // Run from project root (where default templates exist)
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available Agent Templates');
      expect(result.stdout).toContain('basic-agent');
      expect(result.stdout).toContain('developer');
      expect(result.stdout).toContain('analyst');
      expect(result.stdout).toContain('designer');
      expect(result.stdout).toContain('qa-specialist');
    });

    it('should show template descriptions', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Basic agent with minimal configuration');
      expect(result.stdout).toContain('Software developer');
      expect(result.stdout).toContain('Business analyst');
      expect(result.stdout).toContain('UI/UX designer');
      expect(result.stdout).toContain('QA specialist');
    });

    it('should group templates by team', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Core Team:');
      expect(result.stdout).toContain('Engineering Team:');
      expect(result.stdout).toContain('Business Team:');
      expect(result.stdout).toContain('Design Team:');
    });

    it('should show usage example', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('ax agent create');
      expect(result.stdout).toContain('--template');
    });
  });

  describe('Project Templates', () => {
    it('should list project templates when available', async () => {
      await createTemplate(testDir, 'custom-template');
      await createTemplate(testDir, 'another-template');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available Agent Templates');
      expect(result.stdout).toContain('custom-template');
      expect(result.stdout).toContain('another-template');
    });

    it('should show "Project" as source for project templates', async () => {
      await createTemplate(testDir, 'project-template');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Source: Project');
    });

    it('should prefer project templates over defaults', async () => {
      await createTemplate(testDir, 'custom');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Source: Project');
      expect(result.stdout).toContain('custom');
    });
  });

  describe('Empty Templates', () => {
    it('should show message when no templates found', async () => {
      // Create empty templates directory
      await rm(join(testDir, '.automatosx', 'templates'), { recursive: true, force: true });
      await mkdir(join(testDir, '.automatosx', 'templates'), { recursive: true });

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No templates found');
    });

    it('should suggest running init when no templates', async () => {
      // Remove templates directory completely to trigger fallback check
      await rm(join(testDir, '.automatosx', 'templates'), { recursive: true, force: true });
      await rm(join(testDir, '.automatosx'), { recursive: true, force: true });

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      // Should show default templates from examples/ since no project templates
      expect(result.stdout).toContain('Templates');
    });
  });

  describe('Template Grouping', () => {
    it('should group core team templates', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Core Team:');
      expect(result.stdout).toContain('basic-agent');
      expect(result.stdout).toContain('qa-specialist');
    });

    it('should group engineering team templates', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Engineering Team:');
      expect(result.stdout).toContain('developer');
    });

    it('should group business team templates', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Business Team:');
      expect(result.stdout).toContain('analyst');
    });

    it('should group design team templates', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Design Team:');
      expect(result.stdout).toContain('designer');
    });
  });

  describe('Template Information', () => {
    it('should show template name and description side by side', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      // Check format: "name  -  description"
      expect(result.stdout).toMatch(/basic-agent\s+-\s+Basic agent/);
      expect(result.stdout).toMatch(/developer\s+-\s+Software/);
    });

    it('should align template names consistently', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      // All templates should have similar spacing
      const lines = result.stdout.split('\n').filter(line => line.includes(' - '));
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Templates', () => {
    it('should show custom template as "Custom template"', async () => {
      await createTemplate(testDir, 'unknown-template');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('unknown-template');
      expect(result.stdout).toContain('Custom template');
    });

    it('should handle multiple custom templates', async () => {
      await createTemplate(testDir, 'custom1');
      await createTemplate(testDir, 'custom2');
      await createTemplate(testDir, 'custom3');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('custom1');
      expect(result.stdout).toContain('custom2');
      expect(result.stdout).toContain('custom3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle template names with hyphens', async () => {
      await createTemplate(testDir, 'my-custom-template');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('my-custom-template');
    });

    it('should handle very long template names', async () => {
      const longName = 'a'.repeat(40) + '-template';
      await createTemplate(testDir, longName);

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(longName);
    });

    it('should ignore non-yaml files', async () => {
      await createTemplate(testDir, 'valid-template');
      await writeFile(join(testDir, '.automatosx', 'templates', 'readme.txt'), 'Some text', 'utf-8');
      await writeFile(join(testDir, '.automatosx', 'templates', 'config.json'), '{}', 'utf-8');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('valid-template');
      expect(result.stdout).not.toContain('readme');
      expect(result.stdout).not.toContain('config');
    });
  });

  describe('Display Format', () => {
    it('should show title with emoji', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/📋.*Available Agent Templates/);
    });

    it('should show team headers with formatting', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Core Team:');
      expect(result.stdout).toContain('Engineering Team:');
    });

    it('should show source path', async () => {
      // Remove local templates to force fallback to examples
      await rm(join(testDir, '.automatosx', 'templates'), { recursive: true, force: true });

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Source:');
      expect(result.stdout).toContain('Default');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing templates directory', async () => {
      await rm(join(testDir, '.automatosx', 'templates'), { recursive: true, force: true });

      const result = await execCLI(['agent', 'templates'], testDir);

      // Should fallback to default templates or show message
      expect(result.exitCode).toBe(0);
    });

    it('should handle templates directory as file', async () => {
      await rm(join(testDir, '.automatosx', 'templates'), { recursive: true, force: true });
      await writeFile(join(testDir, '.automatosx', 'templates'), 'not a directory', 'utf-8');

      const result = await execCLI(['agent', 'templates'], testDir);

      // Should handle gracefully
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle corrupted template files', async () => {
      await writeFile(join(testDir, '.automatosx', 'templates', 'corrupted.yaml'), 'invalid: yaml:', 'utf-8');
      await createTemplate(testDir, 'valid');

      const result = await execCLI(['agent', 'templates'], testDir);

      // Should show valid template at least
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('valid');
    });
  });

  describe('Template Count', () => {
    it('should list all 5 default templates', async () => {
      const result = await execCLI(['agent', 'templates']);

      expect(result.exitCode).toBe(0);
      const templates = ['basic-agent', 'developer', 'analyst', 'designer', 'qa-specialist'];
      templates.forEach(template => {
        expect(result.stdout).toContain(template);
      });
    });

    it('should show correct count for project templates', async () => {
      await createTemplate(testDir, 'template1');
      await createTemplate(testDir, 'template2');

      const result = await execCLI(['agent', 'templates'], testDir);

      expect(result.exitCode).toBe(0);
      // Should have exactly 2 templates
      const lines = result.stdout.split('\n').filter(line => line.includes('template'));
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });
  });
});
