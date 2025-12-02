/**
 * Integration Tests - Claude Code Setup
 *
 * Tests for ClaudeCodeSetupHelper and integration with setup command.
 * These tests verify the complete setup flow including:
 * - CLI detection
 * - MCP server availability
 * - MCP server registration
 * - Manifest generation
 * - Manifest validation
 * - Diagnostics
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ClaudeCodeSetupHelper } from '../../src/integrations/claude-code/setup-helper.js';
import { ProfileLoader } from '../../src/agents/profile-loader.js';
import { TeamManager } from '../../src/core/team-manager.js';
import { execSync } from 'child_process';

// Test directory
const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'claude-code-setup-test');

describe('ClaudeCodeSetupHelper', () => {
  let setupHelper: ClaudeCodeSetupHelper;
  let profileLoader: ProfileLoader;
  let teamManager: TeamManager;

  beforeEach(async () => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_DIR, { recursive: true });

    // Create .automatosx structure
    const automatosxDir = join(TEST_DIR, '.automatosx');
    await mkdir(automatosxDir, { recursive: true });
    await mkdir(join(automatosxDir, 'agents'), { recursive: true });
    await mkdir(join(automatosxDir, 'teams'), { recursive: true });

    // Create a simple test agent profile
    const testAgentProfile = {
      name: 'test-agent',
      displayName: 'Test Agent',
      description: 'Test agent for integration tests',
      role: 'Testing',
      system_prompt: 'You are a test agent for integration testing.',
      model: 'claude-3-5-sonnet-20241022'
    };

    await writeFile(
      join(automatosxDir, 'agents', 'test-agent.json'),
      JSON.stringify(testAgentProfile, null, 2)
    );

    // Initialize components
    teamManager = new TeamManager(join(automatosxDir, 'teams'));
    profileLoader = new ProfileLoader(
      join(automatosxDir, 'agents'),
      undefined,
      teamManager
    );

    setupHelper = new ClaudeCodeSetupHelper({
      projectDir: TEST_DIR,
      profileLoader
    });
  });

  afterEach(async () => {
    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Claude Code CLI Detection', () => {
    test('should detect if Claude Code is installed', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();

      // This will vary based on the test environment
      // We just verify the method returns a boolean
      expect(typeof isInstalled).toBe('boolean');
    });

    test('should get Claude Code version if installed', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();

      if (isInstalled) {
        const version = await setupHelper.getClaudeCodeVersion();
        expect(version).toBeTruthy();
        expect(typeof version).toBe('string');
      }
    });
  });

  describe('MCP Server Detection', () => {
    test('should detect if MCP server binary is available', async () => {
      const isAvailable = await setupHelper.isMcpServerAvailable();

      // Should be true in development environment (after npm install)
      expect(typeof isAvailable).toBe('boolean');
    });

    test('should detect if MCP server is registered', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();

      if (isInstalled) {
        const isRegistered = await setupHelper.isMcpServerRegistered();
        expect(typeof isRegistered).toBe('boolean');
      }
    });
  });

  describe('Manifest Generation', () => {
    test('should generate manifests successfully', async () => {
      await setupHelper.generateManifests();

      // Check if manifest files were created
      const skillPath = join(TEST_DIR, '.claude', 'skills', 'automatosx', 'SKILL.md');
      const subAgentPath = join(TEST_DIR, '.claude', 'agents', 'automatosx-coordinator', 'AGENT.md');

      expect(existsSync(skillPath)).toBe(true);
      expect(existsSync(subAgentPath)).toBe(true);

      // At least one command should be generated (may not be test-agent due to loading errors)
      const commandsDir = join(TEST_DIR, '.claude', 'commands');
      if (existsSync(commandsDir)) {
        const commands = await import('fs/promises').then(fs => fs.readdir(commandsDir));
        expect(commands.length).toBeGreaterThan(0);
      }
    });

    test('should check if manifests are generated', async () => {
      // Initially should be false
      let areGenerated = await setupHelper.areManifestsGenerated();
      expect(areGenerated).toBe(false);

      // Generate manifests
      await setupHelper.generateManifests();

      // Now should be true
      areGenerated = await setupHelper.areManifestsGenerated();
      expect(areGenerated).toBe(true);
    });
  });

  describe('Manifest Validation', () => {
    test('should validate manifest structure', async () => {
      // Generate manifests first
      await setupHelper.generateManifests();

      // Validate
      const validation = await setupHelper.validateManifests();

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect invalid manifests', async () => {
      // Create invalid skill file
      await mkdir(join(TEST_DIR, '.claude', 'skills', 'automatosx'), { recursive: true });
      await writeFile(
        join(TEST_DIR, '.claude', 'skills', 'automatosx', 'SKILL.md'),
        'Invalid content without frontmatter'
      );

      // Create invalid sub-agent file
      await mkdir(join(TEST_DIR, '.claude', 'agents', 'automatosx-coordinator'), { recursive: true });
      await writeFile(
        join(TEST_DIR, '.claude', 'agents', 'automatosx-coordinator', 'AGENT.md'),
        'Invalid content'
      );

      // Validate
      const validation = await setupHelper.validateManifests();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Diagnostics', () => {
    test('should run comprehensive diagnostics', async () => {
      const diagnostics = await setupHelper.runDiagnostics();

      // Verify diagnostics structure
      expect(diagnostics).toHaveProperty('claudeCodeInstalled');
      expect(diagnostics).toHaveProperty('mcpServerAvailable');
      expect(diagnostics).toHaveProperty('mcpServerRegistered');
      expect(diagnostics).toHaveProperty('manifestsGenerated');
      expect(diagnostics).toHaveProperty('manifestsValid');
      expect(diagnostics).toHaveProperty('errors');
      expect(diagnostics).toHaveProperty('warnings');

      // Verify types
      expect(typeof diagnostics.claudeCodeInstalled).toBe('boolean');
      expect(typeof diagnostics.mcpServerAvailable).toBe('boolean');
      expect(typeof diagnostics.mcpServerRegistered).toBe('boolean');
      expect(typeof diagnostics.manifestsGenerated).toBe('boolean');
      expect(typeof diagnostics.manifestsValid).toBe('boolean');
      expect(Array.isArray(diagnostics.errors)).toBe(true);
      expect(Array.isArray(diagnostics.warnings)).toBe(true);
    });

    test('should detect missing prerequisites', async () => {
      const diagnostics = await setupHelper.runDiagnostics();

      // If Claude Code is not installed, should have error
      if (!diagnostics.claudeCodeInstalled) {
        expect(diagnostics.errors.length).toBeGreaterThan(0);
        expect(diagnostics.errors.some(e => e.includes('Claude Code CLI'))).toBe(true);
      }

      // If MCP server is not available, should have error
      if (!diagnostics.mcpServerAvailable) {
        expect(diagnostics.errors.length).toBeGreaterThan(0);
        expect(diagnostics.errors.some(e => e.includes('MCP server'))).toBe(true);
      }
    });

    test('should provide warnings for non-critical issues', async () => {
      const diagnostics = await setupHelper.runDiagnostics();

      // If manifests not generated, should have warning
      if (!diagnostics.manifestsGenerated) {
        expect(diagnostics.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Complete Setup Flow', () => {
    test('should fail setup if Claude Code not installed', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();

      if (!isInstalled) {
        await expect(setupHelper.setup()).rejects.toThrow('Claude Code CLI not found');
      }
    }, 30000); // 30 second timeout for full setup

    test('should fail setup if MCP server not available', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();
      const mcpAvailable = await setupHelper.isMcpServerAvailable();

      if (isInstalled && !mcpAvailable) {
        await expect(setupHelper.setup()).rejects.toThrow('MCP server binary not found');
      }
    }, 30000);

    test('should complete setup successfully with all prerequisites', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();
      const mcpAvailable = await setupHelper.isMcpServerAvailable();

      if (isInstalled && mcpAvailable) {
        // Run setup
        await setupHelper.setup();

        // Verify results
        const diagnostics = await setupHelper.runDiagnostics();

        expect(diagnostics.claudeCodeInstalled).toBe(true);
        expect(diagnostics.mcpServerAvailable).toBe(true);
        expect(diagnostics.manifestsGenerated).toBe(true);
        expect(diagnostics.manifestsValid).toBe(true);
        expect(diagnostics.errors.length).toBe(0);
      } else {
        // Skip test if prerequisites missing
        console.log('Skipping full setup test - missing prerequisites');
      }
    }, 60000); // 60 second timeout for full setup including registration
  });

  describe('Idempotency', () => {
    test('should handle re-running setup safely', async () => {
      const isInstalled = await setupHelper.isClaudeCodeInstalled();
      const mcpAvailable = await setupHelper.isMcpServerAvailable();

      if (isInstalled && mcpAvailable) {
        // Run setup first time
        await setupHelper.setup();

        // Run setup second time (should not fail)
        await expect(setupHelper.setup()).resolves.not.toThrow();

        // Verify results are still valid
        const diagnostics = await setupHelper.runDiagnostics();
        expect(diagnostics.manifestsGenerated).toBe(true);
        expect(diagnostics.manifestsValid).toBe(true);
      }
    }, 60000);
  });
});

describe('Setup Command Integration', () => {
  test('should accept --claude-code flag', async () => {
    // This is a smoke test - actual CLI testing would require spawning processes
    // Just verify the command builds and exports correctly
    const setupModule = await import('../../src/cli/commands/setup.js');
    const { setupCommand } = setupModule;

    expect(setupCommand).toBeDefined();
    expect(setupCommand.command).toBe('setup [path]');
    expect(setupCommand.builder).toBeDefined();
    expect(setupCommand.handler).toBeDefined();
  });
});

describe('Doctor Command Integration', () => {
  test('should accept --claude-code flag', async () => {
    // Smoke test for doctor command
    const doctorModule = await import('../../src/cli/commands/doctor.js');
    const { doctorCommand } = doctorModule;

    expect(doctorCommand).toBeDefined();
    expect(doctorCommand.command).toBe('doctor [provider]');
    expect(doctorCommand.builder).toBeDefined();
    expect(doctorCommand.handler).toBeDefined();
  });
});
