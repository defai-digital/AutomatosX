/**
 * MCP Manager Unit Tests
 *
 * Tests for Claude Code MCP server management functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { MCPManager } from '../../../../src/integrations/claude-code/mcp-manager.js';
import { ClaudeCodeError, ClaudeCodeErrorType } from '../../../../src/integrations/claude-code/types.js';
import type { MCPManifest, ClaudeMCPServer } from '../../../../src/integrations/claude-code/types.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock fs (for constants)
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

describe('MCPManager', () => {
  let manager: MCPManager;

  beforeEach(() => {
    vol.reset();
    manager = new MCPManager();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('readManifest', () => {
    it('should read and parse a valid manifest file', async () => {
      const manifest: MCPManifest = {
        version: '1.0.0',
        mcpServers: {
          'test-server': { command: 'node', args: ['server.js'] },
        },
      };
      vol.fromJSON({
        '/test/manifest.json': JSON.stringify(manifest),
      });

      const result = await manager.readManifest('/test/manifest.json');

      expect(result).toEqual(manifest);
    });

    it('should throw ClaudeCodeError for invalid JSON', async () => {
      vol.fromJSON({
        '/test/invalid.json': 'not valid json {{{',
      });

      await expect(manager.readManifest('/test/invalid.json')).rejects.toThrow(
        ClaudeCodeError
      );
    });

    it('should throw ClaudeCodeError when file does not exist', async () => {
      await expect(manager.readManifest('/nonexistent.json')).rejects.toThrow(
        ClaudeCodeError
      );
    });

    it('should re-throw ClaudeCodeError if already ClaudeCodeError', async () => {
      vol.fromJSON({
        '/test/invalid.json': '{"invalid": json}',
      });

      try {
        await manager.readManifest('/test/invalid.json');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeCodeError);
        expect((error as ClaudeCodeError).type).toBe(ClaudeCodeErrorType.INVALID_CONFIG);
      }
    });
  });

  describe('writeManifest', () => {
    it('should write manifest to file', async () => {
      vol.fromJSON({
        '/test': null,
      });

      const manifest: MCPManifest = {
        version: '1.0.0',
        mcpServers: {
          server1: { command: 'node' },
        },
      };

      await manager.writeManifest('/test/manifest.json', manifest);

      const content = vol.readFileSync('/test/manifest.json', 'utf-8');
      expect(JSON.parse(content as string)).toEqual(manifest);
    });

    it('should throw ClaudeCodeError on write failure', async () => {
      // Don't create directory - will cause write to fail
      await expect(
        manager.writeManifest('/nonexistent/dir/manifest.json', { version: '1.0' })
      ).rejects.toThrow(ClaudeCodeError);
    });
  });

  describe('validateManifest', () => {
    it('should return valid for a valid manifest', () => {
      const manifest: MCPManifest = {
        version: '1.0.0',
        mcpServers: {
          server1: { command: 'node', args: ['server.js'] },
        },
      };

      const result = manager.validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for manifest with invalid server', () => {
      const manifest: MCPManifest = {
        version: '1.0.0',
        mcpServers: {
          server1: { command: '' }, // Empty command
        },
      };

      const result = manager.validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return warnings for missing version', () => {
      const manifest: MCPManifest = {
        mcpServers: {
          server1: { command: 'node' },
        },
      };

      const result = manager.validateManifest(manifest);

      expect(result.warnings).toContain('version is not specified');
    });
  });

  describe('validateServer', () => {
    it('should return valid for a valid server', () => {
      const server: ClaudeMCPServer = {
        command: 'node',
        args: ['server.js'],
      };

      const result = manager.validateServer(server, 'test-server');

      expect(result.valid).toBe(true);
    });

    it('should return invalid for server without command', () => {
      const server = {} as ClaudeMCPServer;

      const result = manager.validateServer(server, 'test-server');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server "test-server" missing required field: command');
    });

    it('should warn about sensitive environment variables', () => {
      const server: ClaudeMCPServer = {
        command: 'node',
        env: { API_KEY: 'secret123' },
      };

      const result = manager.validateServer(server, 'test-server');

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('installMCPConfig', () => {
    it('should install manifest files from source to target', async () => {
      const manifest: MCPManifest = {
        version: '1.0.0',
        mcpServers: {
          server1: { command: 'node' },
        },
      };

      vol.fromJSON({
        '/source/manifest1.json': JSON.stringify(manifest),
        '/project/.claude/mcp': null,
      });

      const count = await manager.installMCPConfig('/project', '/source', true);

      expect(count).toBe(1);
      expect(vol.existsSync('/project/.claude/mcp/manifest1.json')).toBe(true);
    });

    it('should skip non-json files', async () => {
      vol.fromJSON({
        '/source/readme.txt': 'Not a JSON file',
        '/source/manifest.json': JSON.stringify({ version: '1.0' }),
        '/project/.claude/mcp': null,
      });

      const count = await manager.installMCPConfig('/project', '/source', true);

      expect(count).toBe(1);
      expect(vol.existsSync('/project/.claude/mcp/readme.txt')).toBe(false);
    });

    it('should skip existing files when force is false', async () => {
      const originalManifest = JSON.stringify({ version: '1.0' });
      const newManifest = JSON.stringify({ version: '2.0' });

      vol.fromJSON({
        '/source/manifest.json': newManifest,
        '/project/.claude/mcp/manifest.json': originalManifest,
      });

      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const count = await manager.installMCPConfig('/project', '/source', false);

      expect(count).toBe(0);
      expect(vol.readFileSync('/project/.claude/mcp/manifest.json', 'utf-8')).toBe(
        originalManifest
      );
      warnSpy.mockRestore();
    });

    it('should overwrite existing files when force is true', async () => {
      const originalManifest = JSON.stringify({ version: '1.0' });
      const newManifest: MCPManifest = { version: '2.0', mcpServers: { s: { command: 'node' } } };

      vol.fromJSON({
        '/source/manifest.json': JSON.stringify(newManifest),
        '/project/.claude/mcp/manifest.json': originalManifest,
      });

      const count = await manager.installMCPConfig('/project', '/source', true);

      expect(count).toBe(1);
      const content = JSON.parse(
        vol.readFileSync('/project/.claude/mcp/manifest.json', 'utf-8') as string
      );
      expect(content.version).toBe('2.0');
    });

    it('should skip invalid manifests', async () => {
      vol.fromJSON({
        '/source/invalid.json': JSON.stringify({
          mcpServers: { '123invalid': { command: 'node' } }, // Invalid server name
        }),
        '/project/.claude/mcp': null,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const count = await manager.installMCPConfig('/project', '/source', true);

      expect(count).toBe(0);
      warnSpy.mockRestore();
    });

    it('should skip unreadable manifests', async () => {
      vol.fromJSON({
        '/source/bad.json': 'invalid json {{',
        '/project/.claude/mcp': null,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const count = await manager.installMCPConfig('/project', '/source', true);

      expect(count).toBe(0);
      warnSpy.mockRestore();
    });

    it('should throw ClaudeCodeError when source directory fails', async () => {
      await expect(
        manager.installMCPConfig('/project', '/nonexistent', true)
      ).rejects.toThrow(ClaudeCodeError);
    });

    it('should log warnings for manifests with validation warnings', async () => {
      const manifest: MCPManifest = {
        // No version - will cause warning
        mcpServers: {
          server1: { command: 'node', env: { API_KEY: 'secret' } }, // Sensitive env warning
        },
      };

      vol.fromJSON({
        '/source/manifest.json': JSON.stringify(manifest),
        '/project/.claude/mcp': null,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.installMCPConfig('/project', '/source', true);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('listServers', () => {
    it('should list all servers from manifests in project', async () => {
      const manifest: MCPManifest = {
        version: '1.0',
        mcpServers: {
          server1: { command: 'node', args: ['s1.js'] },
          server2: { command: 'python', args: ['s2.py'] },
        },
      };

      vol.fromJSON({
        '/project/.claude/mcp/manifest.json': JSON.stringify(manifest),
      });

      const servers = await manager.listServers('/project');

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('server1');
      expect(servers.map(s => s.name)).toContain('server2');
    });

    it('should return empty array when MCP directory does not exist', async () => {
      vol.fromJSON({
        '/project': null,
      });

      const servers = await manager.listServers('/project');

      expect(servers).toEqual([]);
    });

    it('should skip invalid JSON files', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/valid.json': JSON.stringify({
          mcpServers: { server1: { command: 'node' } },
        }),
        '/project/.claude/mcp/invalid.json': 'not json {{',
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const servers = await manager.listServers('/project');

      expect(servers).toHaveLength(1);
      expect(servers[0]?.name).toBe('server1');
      warnSpy.mockRestore();
    });

    it('should skip non-json files', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/manifest.json': JSON.stringify({
          mcpServers: { server1: { command: 'node' } },
        }),
        '/project/.claude/mcp/readme.md': '# README',
      });

      const servers = await manager.listServers('/project');

      expect(servers).toHaveLength(1);
    });

    it('should include source file in server info', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/custom.json': JSON.stringify({
          mcpServers: { server1: { command: 'node' } },
        }),
      });

      const servers = await manager.listServers('/project');

      expect(servers[0]?.source).toBe('custom.json');
    });

    it('should handle manifests without mcpServers', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/empty.json': JSON.stringify({
          version: '1.0',
        }),
      });

      const servers = await manager.listServers('/project');

      expect(servers).toHaveLength(0);
    });
  });

  describe('getMCPStats', () => {
    it('should return statistics for MCP servers', async () => {
      const manifest: MCPManifest = {
        mcpServers: {
          server1: { command: 'node' },
          server2: { command: 'python' },
          server3: { command: 'ruby' },
        },
      };

      vol.fromJSON({
        '/project/.claude/mcp/manifest.json': JSON.stringify(manifest),
      });

      const stats = await manager.getMCPStats('/project');

      expect(stats.total).toBe(3);
      expect(stats.projectScope).toBe(3);
      expect(stats.globalScope).toBe(0);
      expect(stats.byTransport['stdio']).toBe(3);
    });

    it('should return zero stats for empty project', async () => {
      vol.fromJSON({
        '/project': null,
      });

      const stats = await manager.getMCPStats('/project');

      expect(stats.total).toBe(0);
      expect(stats.projectScope).toBe(0);
    });
  });

  describe('getServer', () => {
    it('should return server by name', async () => {
      const server: ClaudeMCPServer = {
        command: 'node',
        args: ['server.js'],
        env: { PORT: '3000' },
      };

      vol.fromJSON({
        '/project/.claude/mcp/manifest.json': JSON.stringify({
          mcpServers: { 'my-server': server },
        }),
      });

      const result = await manager.getServer('/project', 'my-server');

      expect(result).toEqual(server);
    });

    it('should return undefined for non-existent server', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/manifest.json': JSON.stringify({
          mcpServers: { 'other-server': { command: 'node' } },
        }),
      });

      const result = await manager.getServer('/project', 'my-server');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no MCP directory', async () => {
      vol.fromJSON({
        '/project': null,
      });

      const result = await manager.getServer('/project', 'any-server');

      expect(result).toBeUndefined();
    });
  });

  describe('hasMCPDir', () => {
    it('should return true when MCP directory exists', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/manifest.json': '{}',
      });

      const result = await manager.hasMCPDir('/project');

      expect(result).toBe(true);
    });

    it('should return false when MCP directory does not exist', async () => {
      vol.fromJSON({
        '/project/.claude': null,
      });

      const result = await manager.hasMCPDir('/project');

      expect(result).toBe(false);
    });
  });

  describe('countManifests', () => {
    it('should count JSON manifest files', async () => {
      vol.fromJSON({
        '/project/.claude/mcp/manifest1.json': '{}',
        '/project/.claude/mcp/manifest2.json': '{}',
        '/project/.claude/mcp/readme.md': '# README',
      });

      const count = await manager.countManifests('/project');

      expect(count).toBe(2);
    });

    it('should return 0 when no MCP directory', async () => {
      vol.fromJSON({
        '/project': null,
      });

      const count = await manager.countManifests('/project');

      expect(count).toBe(0);
    });

    it('should return 0 on error', async () => {
      // Create a situation that would throw
      const count = await manager.countManifests('/totally/invalid/path/that/causes/error');

      expect(count).toBe(0);
    });
  });
});

describe('defaultMCPManager', () => {
  it('should export a default manager instance', async () => {
    const { defaultMCPManager, MCPManager: MM } = await import(
      '../../../../src/integrations/claude-code/mcp-manager.js'
    );

    expect(defaultMCPManager).toBeInstanceOf(MM);
  });
});
