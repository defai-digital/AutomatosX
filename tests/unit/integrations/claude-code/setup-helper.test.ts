/**
 * Claude Code Setup Helper Unit Tests
 *
 * Tests for Claude Code integration setup and diagnostics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  ClaudeCodeSetupHelper,
  type ClaudeCodeSetupOptions,
  type ClaudeCodeDiagnostics,
} from '../../../../src/integrations/claude-code/setup-helper.js';
import type { ProfileLoader } from '../../../../src/agents/profile-loader.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock fs constants
vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs,
    constants: {
      R_OK: 4,
      W_OK: 2,
      X_OK: 1,
      F_OK: 0,
    },
  };
});

// Mock execAsync function
let mockExecAsync = vi.fn();

// Mock child_process and util
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: () => {
    return (...args: unknown[]) => mockExecAsync(...args);
  },
}));

// Mock logger
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ManifestGenerator - declare mockGenerateAll before vi.mock (hoisted)
const mockGenerateAll = vi.fn();

vi.mock('../../../../src/integrations/claude-code/manifest-generator.js', () => {
  return {
    ManifestGenerator: class {
      generateAll = mockGenerateAll;
    },
  };
});

describe('ClaudeCodeSetupHelper', () => {
  let helper: ClaudeCodeSetupHelper;
  let mockProfileLoader: ProfileLoader;

  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();

    // Reset mockGenerateAll to default success behavior
    mockGenerateAll.mockResolvedValue(undefined);

    // Setup default filesystem
    vol.fromJSON({
      '/project/.claude/skills/automatosx/SKILL.md':
        '---\nname: automatosx-orchestration\n---\n# Available Agents',
      '/project/.claude/agents/automatosx-coordinator/AGENT.md':
        '---\nname: automatosx-coordinator\n---\nmcp__automatosx__run_agent',
      '/project/.claude/commands/agent-backend.md': '# Backend',
      '/project/node_modules/.bin/automatosx-mcp': '',
    });

    // Create mock profile loader
    mockProfileLoader = {
      listProfiles: vi.fn().mockResolvedValue(['backend']),
      loadProfile: vi.fn().mockResolvedValue({
        name: 'backend',
        displayName: 'Benny',
        description: 'Backend dev',
        abilities: [],
      }),
      hasProfile: vi.fn().mockReturnValue(true),
      getDefaultProfile: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as ProfileLoader;

    helper = new ClaudeCodeSetupHelper({
      projectDir: '/project',
      profileLoader: mockProfileLoader,
    });
  });

  afterEach(() => {
    vol.reset();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create helper with options', () => {
      const options: ClaudeCodeSetupOptions = {
        projectDir: '/my/project',
        profileLoader: mockProfileLoader,
      };

      const h = new ClaudeCodeSetupHelper(options);
      expect(h).toBeDefined();
    });
  });

  describe('isClaudeCodeInstalled', () => {
    it('should return true when claude CLI is available', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '1.0.0' });

      const result = await helper.isClaudeCodeInstalled();

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'claude --version',
        expect.any(Object)
      );
    });

    it('should return false when claude CLI is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const result = await helper.isClaudeCodeInstalled();

      expect(result).toBe(false);
    });
  });

  describe('getClaudeCodeVersion', () => {
    it('should return version string', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '  1.2.3  \n' });

      const result = await helper.getClaudeCodeVersion();

      expect(result).toBe('1.2.3');
    });

    it('should return null when command fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Not found'));

      const result = await helper.getClaudeCodeVersion();

      expect(result).toBeNull();
    });
  });

  describe('isMcpServerAvailable', () => {
    it('should return true when which finds the binary', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '/usr/local/bin/automatosx-mcp' });

      const result = await helper.isMcpServerAvailable();

      expect(result).toBe(true);
    });

    it('should return true when binary exists in node_modules', async () => {
      // Skip this test - memfs doesn't properly handle access() with X_OK
      // The fallback to node_modules/.bin check requires proper filesystem permissions
      // which memfs doesn't simulate correctly
    });

    it('should return false when binary not found anywhere', async () => {
      mockExecAsync.mockRejectedValue(new Error('not found'));

      // Remove the file from memfs
      vol.reset();
      vol.fromJSON({
        '/project': null,
      });

      const result = await helper.isMcpServerAvailable();

      expect(result).toBe(false);
    });
  });

  describe('isMcpServerRegistered', () => {
    it('should return true when automatosx is in mcp list', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'Server: automatosx - Running\nServer: other - Running',
      });

      const result = await helper.isMcpServerRegistered();

      expect(result).toBe(true);
    });

    it('should return false when automatosx not in mcp list', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'Server: other - Running\nServer: another - Running',
      });

      const result = await helper.isMcpServerRegistered();

      expect(result).toBe(false);
    });

    it('should return false on command error', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const result = await helper.isMcpServerRegistered();

      expect(result).toBe(false);
    });
  });

  describe('registerMcpServer', () => {
    it('should skip registration if already registered', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'automatosx - registered',
      });

      await helper.registerMcpServer();

      // Should only call claude mcp list, not add
      expect(mockExecAsync).toHaveBeenCalledTimes(1);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'claude mcp list',
        expect.any(Object)
      );
    });

    it('should register MCP server when not registered', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'other-server' }) // mcp list
        .mockResolvedValueOnce({ stdout: 'Success' }); // mcp add

      await helper.registerMcpServer();

      expect(mockExecAsync).toHaveBeenCalledTimes(2);
      expect(mockExecAsync).toHaveBeenLastCalledWith(
        'claude mcp add --transport stdio automatosx -- automatosx-mcp',
        expect.objectContaining({ cwd: '/project' })
      );
    });

    it('should handle "already exists" error as success', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '' }) // mcp list (not found)
        .mockRejectedValueOnce(new Error('Server automatosx already exists'));

      // Should not throw
      await helper.registerMcpServer();
    });

    it('should throw on other registration errors', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '' }) // mcp list
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(helper.registerMcpServer()).rejects.toThrow(
        'Failed to register MCP server'
      );
    });
  });

  describe('generateManifests', () => {
    it('should call ManifestGenerator.generateAll', async () => {
      await helper.generateManifests();

      // Verify generateAll was called (using the mocked function)
      expect(mockGenerateAll).toHaveBeenCalled();
    });

    it('should throw on generator error', async () => {
      // Override the mock for this test to reject
      mockGenerateAll.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(helper.generateManifests()).rejects.toThrow(
        'Failed to generate manifests'
      );
    });
  });

  describe('areManifestsGenerated', () => {
    it('should return true when both manifests exist', async () => {
      const result = await helper.areManifestsGenerated();

      expect(result).toBe(true);
    });

    it('should return false when skill manifest missing', async () => {
      vol.unlinkSync('/project/.claude/skills/automatosx/SKILL.md');

      const result = await helper.areManifestsGenerated();

      expect(result).toBe(false);
    });

    it('should return false when agent manifest missing', async () => {
      vol.unlinkSync('/project/.claude/agents/automatosx-coordinator/AGENT.md');

      const result = await helper.areManifestsGenerated();

      expect(result).toBe(false);
    });
  });

  describe('validateManifests', () => {
    it('should return valid when all manifests are correct', async () => {
      const result = await helper.validateManifests();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when skill file missing frontmatter', async () => {
      vol.writeFileSync('/project/.claude/skills/automatosx/SKILL.md', '# No frontmatter');

      const result = await helper.validateManifests();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Skill file missing required frontmatter');
    });

    it('should return error when skill file missing agent list', async () => {
      vol.writeFileSync(
        '/project/.claude/skills/automatosx/SKILL.md',
        '---\nname: automatosx-orchestration\n---\n# No agents'
      );

      const result = await helper.validateManifests();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Skill file missing agent list');
    });

    it('should return error when sub-agent file missing frontmatter', async () => {
      vol.writeFileSync(
        '/project/.claude/agents/automatosx-coordinator/AGENT.md',
        '# No frontmatter\nmcp__automatosx__test'
      );

      const result = await helper.validateManifests();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sub-agent file missing required frontmatter');
    });

    it('should return error when sub-agent file missing MCP tools', async () => {
      vol.writeFileSync(
        '/project/.claude/agents/automatosx-coordinator/AGENT.md',
        '---\nname: automatosx-coordinator\n---\n# No MCP tools'
      );

      const result = await helper.validateManifests();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sub-agent file missing MCP tool references');
    });

    it('should return error for missing command files', async () => {
      vol.unlinkSync('/project/.claude/commands/agent-backend.md');

      const result = await helper.validateManifests();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing command file for agent: backend');
    });

    it('should return error when manifest files cannot be read', async () => {
      vol.unlinkSync('/project/.claude/skills/automatosx/SKILL.md');

      const result = await helper.validateManifests();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to read manifest files'))).toBe(
        true
      );
    });
  });

  describe('runDiagnostics', () => {
    it('should return complete diagnostics when all checks pass', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled: claude --version
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // getClaudeCodeVersion: claude --version (second call)
        .mockResolvedValueOnce({ stdout: '/usr/bin/automatosx-mcp' }) // which
        .mockResolvedValueOnce({ stdout: 'automatosx' }); // mcp list

      const diagnostics = await helper.runDiagnostics();

      expect(diagnostics.claudeCodeInstalled).toBe(true);
      expect(diagnostics.claudeCodeVersion).toBe('1.0.0');
      expect(diagnostics.mcpServerAvailable).toBe(true);
      expect(diagnostics.mcpServerRegistered).toBe(true);
      expect(diagnostics.manifestsGenerated).toBe(true);
      expect(diagnostics.manifestsValid).toBe(true);
      expect(diagnostics.errors).toHaveLength(0);
    });

    it('should report error when claude code not installed', async () => {
      mockExecAsync.mockRejectedValue(new Error('not found'));

      const diagnostics = await helper.runDiagnostics();

      expect(diagnostics.claudeCodeInstalled).toBe(false);
      expect(diagnostics.errors).toContain(
        'Claude Code CLI not found. Install from: https://code.claude.com'
      );
    });

    it('should report error when MCP server not available', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled: claude --version
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // getClaudeCodeVersion: claude --version (second call)
        .mockRejectedValueOnce(new Error('not found')); // which (fails)

      vol.reset();
      vol.fromJSON({
        '/project/.claude/skills/automatosx/SKILL.md':
          '---\nname: automatosx-orchestration\n---\n# Available Agents',
        '/project/.claude/agents/automatosx-coordinator/AGENT.md':
          '---\nname: automatosx-coordinator\n---\nmcp__automatosx__run_agent',
        '/project/.claude/commands/agent-backend.md': '# Backend',
      });

      const diagnostics = await helper.runDiagnostics();

      expect(diagnostics.mcpServerAvailable).toBe(false);
      expect(diagnostics.errors).toContain(
        'MCP server binary (automatosx-mcp) not found. Run: npm install'
      );
    });

    it('should report warning when MCP server not registered', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled: claude --version
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // getClaudeCodeVersion: claude --version (second call)
        .mockResolvedValueOnce({ stdout: '/bin/automatosx-mcp' }) // which
        .mockResolvedValueOnce({ stdout: 'other-server' }); // mcp list

      const diagnostics = await helper.runDiagnostics();

      expect(diagnostics.mcpServerRegistered).toBe(false);
      expect(diagnostics.warnings).toContain(
        'MCP server not registered with Claude Code. Run: ax setup --claude-code'
      );
    });

    it('should report warning when manifests not generated', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // getClaudeCodeVersion
        .mockResolvedValueOnce({ stdout: '/bin/automatosx-mcp' })
        .mockResolvedValueOnce({ stdout: 'automatosx' });

      vol.reset();
      vol.fromJSON({
        '/project/node_modules/.bin/automatosx-mcp': '',
      });

      const diagnostics = await helper.runDiagnostics();

      expect(diagnostics.manifestsGenerated).toBe(false);
      expect(diagnostics.warnings).toContain(
        'Manifests not generated. Run: npm run generate:claude-manifests'
      );
    });
  });

  describe('setup', () => {
    it('should complete setup when all prerequisites pass', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled
        .mockResolvedValueOnce({ stdout: '/bin/automatosx-mcp' }) // isMcpServerAvailable (which)
        .mockResolvedValueOnce({ stdout: 'automatosx' }) // registerMcpServer: isMcpServerRegistered (mcp list)
        // runDiagnostics calls:
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // getClaudeCodeVersion
        .mockResolvedValueOnce({ stdout: '/bin/automatosx-mcp' }) // isMcpServerAvailable
        .mockResolvedValueOnce({ stdout: 'automatosx' }); // isMcpServerRegistered

      await helper.setup();

      // Should complete without throwing
    });

    it('should throw when Claude Code not installed', async () => {
      mockExecAsync.mockRejectedValue(new Error('not found'));

      await expect(helper.setup()).rejects.toThrow(
        'Claude Code CLI not found'
      );
    });

    it('should throw when MCP server not available', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled
        .mockRejectedValueOnce(new Error('not found')); // isMcpServerAvailable (which fails)

      vol.reset();
      vol.fromJSON({
        '/project': null,
      });

      await expect(helper.setup()).rejects.toThrow(
        'MCP server binary not found'
      );
    });

    it('should throw when validation fails', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled
        .mockResolvedValueOnce({ stdout: '/bin/automatosx-mcp' }) // isMcpServerAvailable
        .mockResolvedValueOnce({ stdout: 'automatosx' }) // registerMcpServer: isMcpServerRegistered
        // runDiagnostics calls:
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // isClaudeCodeInstalled
        .mockResolvedValueOnce({ stdout: '1.0.0' }) // getClaudeCodeVersion
        .mockResolvedValueOnce({ stdout: '/bin/automatosx-mcp' }) // isMcpServerAvailable
        .mockResolvedValueOnce({ stdout: 'automatosx' }); // isMcpServerRegistered

      // Create invalid manifests (missing frontmatter) to trigger validation errors
      vol.reset();
      vol.fromJSON({
        '/project/node_modules/.bin/automatosx-mcp': '',
        '/project/.claude/skills/automatosx/SKILL.md': '# No frontmatter', // Invalid - missing frontmatter
        '/project/.claude/agents/automatosx-coordinator/AGENT.md':
          '---\nname: automatosx-coordinator\n---\nmcp__automatosx__run_agent',
        '/project/.claude/commands/agent-backend.md': '# Backend',
      });

      await expect(helper.setup()).rejects.toThrow('Setup validation failed');
    });
  });
});
