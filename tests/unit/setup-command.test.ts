// @ts-nocheck
/**
 * Setup Command Unit Tests
 *
 * Tests the setup command handler directly for coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { constants } from 'fs';
import { setupCommand } from '../../src/cli/commands/setup.js';

describe('Setup Command', () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `setup-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Handler', () => {
    it('should have correct command definition', () => {
      expect(setupCommand.command).toBe('setup [path]');
      expect(setupCommand.describe).toBeDefined();
    });

    it('should initialize project in new directory', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      // Verify .automatosx directory structure
      const automatosxDir = join(testDir, '.automatosx');
      await expect(pathExists(automatosxDir)).resolves.toBe(true);
      await expect(pathExists(join(automatosxDir, 'agents'))).resolves.toBe(true);
      await expect(pathExists(join(automatosxDir, 'abilities'))).resolves.toBe(true);
      await expect(pathExists(join(automatosxDir, 'memory'))).resolves.toBe(true);
      await expect(pathExists(join(automatosxDir, 'logs'))).resolves.toBe(true);

      // v5.2.0: Workspace directories are NOT created during init (lazy initialization)
      // They are created on-demand by WorkspaceManager when first needed
      // Therefore we don't check for automatosx/PRD/ or automatosx/tmp/ here

      // Verify config file
      const configPath = join(testDir, 'automatosx.config.json');
      await expect(pathExists(configPath)).resolves.toBe(true);

      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(config.providers).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.workspace).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should exit with error if already initialized without force', async () => {
      // First initialization
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      // Try to initialize again without force
      await expect(
        setupCommand.handler({ path: testDir, force: false, _: [], $0: '' })
      ).rejects.toThrow('process.exit(1)');
    });

    it('should reinitialize with --force flag', async () => {
      // First initialization
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      // Reinitialize with force
      await expect(
        setupCommand.handler({ path: testDir, force: true, _: [], $0: '' })
      ).resolves.not.toThrow();

      // Directory should still exist
      const automatosxDir = join(testDir, '.automatosx');
      await expect(pathExists(automatosxDir)).resolves.toBe(true);
    });

    it('should create example agents', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const agentsDir = join(testDir, '.automatosx', 'agents');
      // v5.0.11: Updated to check for specialized default agents (not templates)
      const agents = ['backend.yaml', 'frontend.yaml', 'quality.yaml'];

      for (const agent of agents) {
        await expect(pathExists(join(agentsDir, agent))).resolves.toBe(true);
      }
    });

    it('should create example abilities', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const abilitiesDir = join(testDir, '.automatosx', 'abilities');

      // Check abilities directory exists (abilities are optional)
      await expect(pathExists(abilitiesDir)).resolves.toBe(true);
    });

    it('should create or update .gitignore', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const gitignorePath = join(testDir, '.gitignore');
      await expect(pathExists(gitignorePath)).resolves.toBe(true);

      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toContain('# AutomatosX');
      expect(content).toContain('.automatosx/memory/');
      expect(content).toContain('.automatosx/logs/');
      // v5.2.0: Changed from .automatosx/workspaces/ to automatosx/tmp/
      expect(content).toContain('automatosx/tmp/');
    });

    it('should handle error when directory creation fails', async () => {
      // Use a platform-specific invalid path
      // On Windows: Use reserved device name
      // On Unix: Use path under /root (permission denied)
      const invalidPath = process.platform === 'win32'
        ? 'CON:\\invalid-path-' + Date.now()  // CON is a reserved name on Windows
        : '/root/cannot-create-this-path-' + Date.now();

      await expect(
        setupCommand.handler({ path: invalidPath, force: false, _: [], $0: '' })
      ).rejects.toThrow();
    });

    it('should create team configuration files', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const teamsDir = join(testDir, '.automatosx', 'teams');
      await expect(pathExists(teamsDir)).resolves.toBe(true);

      // Check for at least one team file (the exact number may vary)
      const teamFiles = ['core.yaml', 'engineering.yaml', 'business.yaml', 'design.yaml', 'research.yaml'];
      let foundTeamFile = false;
      for (const file of teamFiles) {
        if (await pathExists(join(teamsDir, file))) {
          foundTeamFile = true;
          break;
        }
      }
      expect(foundTeamFile).toBe(true);
    });

    it('should create agent templates directory', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const templatesDir = join(testDir, '.automatosx', 'templates');
      await expect(pathExists(templatesDir)).resolves.toBe(true);
    });

    it('should display correct version in output', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      // Check that console.log was called with version info
      expect(consoleLogSpy).toHaveBeenCalled();
      const versionCalls = consoleLogSpy.mock.calls
        .flat()
        .filter(call => typeof call === 'string' && call.includes('AutomatosX v'));
      expect(versionCalls.length).toBeGreaterThan(0);
    });

    it('should create session and memory export directories', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const sessionsDir = join(testDir, '.automatosx', 'sessions');
      const memoryExportsDir = join(testDir, '.automatosx', 'memory', 'exports');

      await expect(pathExists(sessionsDir)).resolves.toBe(true);
      await expect(pathExists(memoryExportsDir)).resolves.toBe(true);
    });

    it('should setup Claude Code integration', async () => {
      await setupCommand.handler({ path: testDir, force: false, _: [], $0: '' });

      const claudeDir = join(testDir, '.claude');
      const mcpDir = join(claudeDir, 'mcp');

      await expect(pathExists(claudeDir)).resolves.toBe(true);
      // No commands directory created anymore - using natural language only
      await expect(pathExists(mcpDir)).resolves.toBe(true);
    });
  });

  describe('Builder', () => {
    it('should configure positional path argument', () => {
      const yargsStub = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };

      setupCommand.builder(yargsStub as any);

      expect(yargsStub.positional).toHaveBeenCalledWith('path', expect.objectContaining({
        describe: expect.any(String),
        type: 'string',
        default: '.'
      }));
    });

    it('should configure force option', () => {
      const yargsStub = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };

      setupCommand.builder(yargsStub as any);

      expect(yargsStub.option).toHaveBeenCalledWith('force', expect.objectContaining({
        alias: 'f',
        describe: expect.any(String),
        type: 'boolean',
        default: false
      }));
    });
  });
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
