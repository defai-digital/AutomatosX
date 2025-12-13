/**
 * Gemini CLI Bridge Unit Tests
 *
 * Tests for MCP server discovery and registration between AutomatosX and Gemini CLI.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GeminiCLIBridge } from '../../../../src/integrations/gemini-cli/bridge.js';
import { ConfigManager } from '../../../../src/integrations/gemini-cli/config-manager.js';
import { GeminiCLIError, GeminiCLIErrorType } from '../../../../src/integrations/gemini-cli/types.js';
import * as fileReader from '../../../../src/integrations/gemini-cli/utils/file-reader.js';
import * as validation from '../../../../src/integrations/gemini-cli/utils/validation.js';

// Keep a mutable reference for the constructor mock (hoisted so vi.mock can see it)
const configManagerRef = vi.hoisted(() => ({ value: undefined as any }));

// Mock dependencies
vi.mock('../../../../src/integrations/gemini-cli/config-manager.js', () => {
  return {
    ConfigManager: vi.fn(function ConfigManagerMock(this: unknown) {
      return configManagerRef.value;
    })
  };
});
vi.mock('../../../../src/integrations/gemini-cli/utils/file-reader.js');
vi.mock('../../../../src/integrations/gemini-cli/utils/validation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/integrations/gemini-cli/utils/validation.js')>();
  return {
    ...actual,
    // Keep actual ALLOWED_COMMANDS but mock the functions
    ALLOWED_COMMANDS: actual.ALLOWED_COMMANDS,
    isValidServerName: vi.fn(),
    validateMCPServer: vi.fn(),
    validateGeminiConfig: vi.fn(),
    validateTomlCommand: vi.fn(),
    isValidCommandName: vi.fn(),
    sanitizeEnv: vi.fn(),
    hasWarnings: vi.fn(),
    getValidationSummary: vi.fn(),
  };
});
vi.mock('fs', () => ({
  access: vi.fn((_path, _mode, callback) => callback(null)),
  constants: { X_OK: 1 },
  realpath: vi.fn((_path, callback) => callback(null, '/usr/bin/node')),
}));

describe('GeminiCLIBridge', () => {
  let mockConfigManager: {
    readUserConfig: Mock;
    readProjectConfig: Mock;
    getMergedConfig: Mock;
    hasUserConfig: Mock;
    hasProjectConfig: Mock;
    getConfigStats: Mock;
    invalidateCache: Mock;
  };

  const mockUserConfig = {
    mcpServers: {
      'test-server': {
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      },
    },
  };

  const mockProjectConfig = {
    mcpServers: {
      'project-server': {
        command: 'python',
        args: ['server.py'],
        transport: 'stdio',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = {
      readUserConfig: vi.fn().mockResolvedValue(mockUserConfig),
      readProjectConfig: vi.fn().mockResolvedValue(mockProjectConfig),
      getMergedConfig: vi.fn().mockResolvedValue({
        mcpServers: {
          ...mockUserConfig.mcpServers,
          ...mockProjectConfig.mcpServers,
        },
      }),
      hasUserConfig: vi.fn().mockResolvedValue(true),
      hasProjectConfig: vi.fn().mockResolvedValue(true),
      getConfigStats: vi.fn().mockResolvedValue({
        hasUserConfig: true,
        hasProjectConfig: true,
        totalMCPServers: 2,
      }),
      invalidateCache: vi.fn(),
    };

    configManagerRef.value = mockConfigManager;

    // Mock validation
    (validation.isValidServerName as Mock).mockReturnValue(true);
    (validation.validateMCPServer as Mock).mockReturnValue({
      valid: true,
      errors: [],
    });

    // Mock file operations
    (fileReader.getUserConfigPath as Mock).mockReturnValue('/home/user/.gemini/config.json');
    (fileReader.getProjectConfigPath as Mock).mockReturnValue('/project/.gemini/config.json');
    (fileReader.readJsonFile as Mock).mockResolvedValue({});
    (fileReader.writeJsonFile as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    configManagerRef.value = undefined;
  });

  describe('constructor', () => {
    it('should create bridge with default config manager', () => {
      const bridge = new GeminiCLIBridge();
      expect(bridge).toBeDefined();
    });

    it('should create bridge with custom config manager', () => {
      const customManager = new ConfigManager();
      const bridge = new GeminiCLIBridge(customManager);
      expect(bridge).toBeDefined();
    });
  });

  describe('discoverMCPServers', () => {
    it('should discover all MCP servers from merged config', async () => {
      const bridge = new GeminiCLIBridge();
      const servers = await bridge.discoverMCPServers();

      expect(servers).toHaveLength(2);
      expect(servers.map((s) => s.name)).toContain('test-server');
      expect(servers.map((s) => s.name)).toContain('project-server');
    });

    it('should return empty array when no servers configured', async () => {
      mockConfigManager.getMergedConfig.mockResolvedValue({});
      mockConfigManager.readUserConfig.mockResolvedValue({});
      mockConfigManager.readProjectConfig.mockResolvedValue({});

      const bridge = new GeminiCLIBridge();
      const servers = await bridge.discoverMCPServers();

      expect(servers).toHaveLength(0);
    });

    it('should include server transport type', async () => {
      const bridge = new GeminiCLIBridge();
      const servers = await bridge.discoverMCPServers();

      expect(servers[0]?.transport).toBe('stdio');
    });

    it('should default transport to stdio when not specified', async () => {
      mockConfigManager.getMergedConfig.mockResolvedValue({
        mcpServers: {
          'no-transport': {
            command: 'node',
            args: [],
          },
        },
      });
      mockConfigManager.readUserConfig.mockResolvedValue({});
      mockConfigManager.readProjectConfig.mockResolvedValue({});

      const bridge = new GeminiCLIBridge();
      const servers = await bridge.discoverMCPServers();

      expect(servers[0]?.transport).toBe('stdio');
    });

    it('should warn about project overriding user servers', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Both configs have same server name
      mockConfigManager.readUserConfig.mockResolvedValue({
        mcpServers: { 'shared-server': { command: 'node', args: [] } },
      });
      mockConfigManager.readProjectConfig.mockResolvedValue({
        mcpServers: { 'shared-server': { command: 'python', args: [] } },
      });

      const bridge = new GeminiCLIBridge();
      await bridge.discoverMCPServers();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security Warning')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('discoverMCPServersByScope', () => {
    it('should discover servers from user scope only', async () => {
      const bridge = new GeminiCLIBridge();
      const servers = await bridge.discoverMCPServersByScope('user');

      expect(servers).toHaveLength(1);
      expect(servers[0]?.name).toBe('test-server');
      expect(servers[0]?.source).toBe('user');
    });

    it('should discover servers from project scope only', async () => {
      const bridge = new GeminiCLIBridge();
      const servers = await bridge.discoverMCPServersByScope('project');

      expect(servers).toHaveLength(1);
      expect(servers[0]?.name).toBe('project-server');
      expect(servers[0]?.source).toBe('project');
    });
  });

  describe('getDiscoveryStats', () => {
    it('should return discovery statistics', async () => {
      const bridge = new GeminiCLIBridge();
      const stats = await bridge.getDiscoveryStats();

      expect(stats.total).toBe(2);
      expect(stats.userScope).toBe(1);
      expect(stats.projectScope).toBe(1);
      expect(stats.byTransport).toBeDefined();
    });

    it('should count servers by transport type', async () => {
      mockConfigManager.readUserConfig.mockResolvedValue({
        mcpServers: {
          server1: { command: 'node', transport: 'stdio' },
          server2: { command: 'node', transport: 'sse' },
        },
      });
      mockConfigManager.readProjectConfig.mockResolvedValue({
        mcpServers: {
          server3: { command: 'node', transport: 'http' },
        },
      });

      const bridge = new GeminiCLIBridge();
      const stats = await bridge.getDiscoveryStats();

      expect(stats.byTransport.stdio).toBe(1);
      expect(stats.byTransport.sse).toBe(1);
      expect(stats.byTransport.http).toBe(1);
    });
  });

  describe('registerMCPServer', () => {
    it('should register a new MCP server', async () => {
      const bridge = new GeminiCLIBridge();

      await bridge.registerMCPServer({
        name: 'new-server',
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      });

      expect(fileReader.writeJsonFile).toHaveBeenCalled();
    });

    it('should throw error for invalid server name', async () => {
      (validation.isValidServerName as Mock).mockReturnValue(false);

      const bridge = new GeminiCLIBridge();

      await expect(
        bridge.registerMCPServer({
          name: 'Invalid Name!',
          command: 'node',
          args: [],
          transport: 'stdio',
        })
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should throw error for invalid server configuration', async () => {
      (validation.validateMCPServer as Mock).mockReturnValue({
        valid: false,
        errors: ['Command is required'],
      });

      const bridge = new GeminiCLIBridge();

      await expect(
        bridge.registerMCPServer({
          name: 'test-server',
          command: '',
          args: [],
          transport: 'stdio',
        })
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should throw error when server already exists without overwrite', async () => {
      (fileReader.readJsonFile as Mock).mockResolvedValue({
        mcpServers: {
          'existing-server': { command: 'node', args: [] },
        },
      });

      const bridge = new GeminiCLIBridge();

      await expect(
        bridge.registerMCPServer(
          {
            name: 'existing-server',
            command: 'node',
            args: [],
            transport: 'stdio',
          },
          { overwrite: false }
        )
      ).rejects.toThrow('already exists');
    });

    it('should allow overwriting existing server', async () => {
      (fileReader.readJsonFile as Mock).mockResolvedValue({
        mcpServers: {
          'existing-server': { command: 'node', args: [] },
        },
      });

      const bridge = new GeminiCLIBridge();

      await expect(
        bridge.registerMCPServer(
          {
            name: 'existing-server',
            command: 'python',
            args: [],
            transport: 'stdio',
          },
          { overwrite: true }
        )
      ).resolves.not.toThrow();
    });

    it('should register to project scope when specified', async () => {
      const bridge = new GeminiCLIBridge();

      await bridge.registerMCPServer(
        {
          name: 'project-server',
          command: 'node',
          args: [],
          transport: 'stdio',
        },
        { scope: 'project' }
      );

      expect(fileReader.writeJsonFile).toHaveBeenCalledWith(
        '/project/.gemini/config.json',
        expect.anything()
      );
    });

    it('should skip validation when validate option is false', async () => {
      const bridge = new GeminiCLIBridge();

      await bridge.registerMCPServer(
        {
          name: 'test-server',
          command: 'node',
          args: [],
          transport: 'stdio',
        },
        { validate: false }
      );

      expect(validation.validateMCPServer).not.toHaveBeenCalled();
    });

    it('should create new config if not exists', async () => {
      (fileReader.readJsonFile as Mock).mockRejectedValue(
        new GeminiCLIError(GeminiCLIErrorType.CONFIG_NOT_FOUND, 'Not found')
      );

      const bridge = new GeminiCLIBridge();

      await bridge.registerMCPServer({
        name: 'new-server',
        command: 'node',
        args: [],
        transport: 'stdio',
      });

      expect(fileReader.writeJsonFile).toHaveBeenCalled();
    });

    it('should invalidate cache after registration', async () => {
      const bridge = new GeminiCLIBridge();

      await bridge.registerMCPServer({
        name: 'test-server',
        command: 'node',
        args: [],
        transport: 'stdio',
      });

      expect(mockConfigManager.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('removeMCPServer', () => {
    it('should remove an existing MCP server', async () => {
      (fileReader.readJsonFile as Mock).mockResolvedValue({
        mcpServers: {
          'test-server': { command: 'node', args: [] },
        },
      });

      const bridge = new GeminiCLIBridge();
      await bridge.removeMCPServer('test-server');

      expect(fileReader.writeJsonFile).toHaveBeenCalled();
    });

    it('should throw error for non-existent server', async () => {
      (fileReader.readJsonFile as Mock).mockResolvedValue({
        mcpServers: {},
      });

      const bridge = new GeminiCLIBridge();

      await expect(bridge.removeMCPServer('nonexistent')).rejects.toThrow(
        'not found'
      );
    });

    it('should remove from correct scope', async () => {
      (fileReader.readJsonFile as Mock).mockResolvedValue({
        mcpServers: {
          'project-server': { command: 'python', args: [] },
        },
      });

      const bridge = new GeminiCLIBridge();
      await bridge.removeMCPServer('project-server', 'project');

      expect(fileReader.writeJsonFile).toHaveBeenCalledWith(
        '/project/.gemini/config.json',
        expect.anything()
      );
    });
  });

  describe('syncAutomatosXMCP', () => {
    it('should register automatosx MCP server', async () => {
      const bridge = new GeminiCLIBridge();
      await bridge.syncAutomatosXMCP();

      expect(fileReader.writeJsonFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          mcpServers: expect.objectContaining({
            automatosx: expect.objectContaining({
              command: 'ax',
              args: ['mcp'],
            }),
          }),
        })
      );
    });

    it('should overwrite by default', async () => {
      (fileReader.readJsonFile as Mock).mockResolvedValue({
        mcpServers: {
          automatosx: { command: 'old', args: [] },
        },
      });

      const bridge = new GeminiCLIBridge();
      await expect(bridge.syncAutomatosXMCP()).resolves.not.toThrow();
    });
  });

  describe('isAutomatosXMCPRegistered', () => {
    it('should return true when automatosx is registered', async () => {
      mockConfigManager.readUserConfig.mockResolvedValue({
        mcpServers: {
          automatosx: { command: 'ax', args: ['mcp'] },
        },
      });

      const bridge = new GeminiCLIBridge();
      const result = await bridge.isAutomatosXMCPRegistered();

      expect(result).toBe(true);
    });

    it('should return false when automatosx is not registered', async () => {
      mockConfigManager.readUserConfig.mockResolvedValue({
        mcpServers: {},
      });

      const bridge = new GeminiCLIBridge();
      const result = await bridge.isAutomatosXMCPRegistered();

      expect(result).toBe(false);
    });
  });

  describe('getMCPServer', () => {
    it('should get specific server by name', async () => {
      const bridge = new GeminiCLIBridge();
      const server = await bridge.getMCPServer('test-server');

      expect(server).toBeDefined();
      expect(server?.name).toBe('test-server');
    });

    it('should return undefined for non-existent server', async () => {
      const bridge = new GeminiCLIBridge();
      const server = await bridge.getMCPServer('nonexistent');

      expect(server).toBeUndefined();
    });

    it('should search specific scope when provided', async () => {
      const bridge = new GeminiCLIBridge();
      const server = await bridge.getMCPServer('project-server', 'project');

      expect(server?.name).toBe('project-server');
    });
  });

  describe('listMCPServerNames', () => {
    it('should list all server names', async () => {
      const bridge = new GeminiCLIBridge();
      const names = await bridge.listMCPServerNames();

      expect(names).toContain('test-server');
      expect(names).toContain('project-server');
    });

    it('should list server names from specific scope', async () => {
      const bridge = new GeminiCLIBridge();
      const names = await bridge.listMCPServerNames('user');

      expect(names).toContain('test-server');
      expect(names).not.toContain('project-server');
    });
  });

  describe('isGeminiCLIConfigured', () => {
    it('should return true when any config exists', async () => {
      const bridge = new GeminiCLIBridge();
      const result = await bridge.isGeminiCLIConfigured();

      expect(result).toBe(true);
    });

    it('should return false when no config exists', async () => {
      mockConfigManager.hasUserConfig.mockResolvedValue(false);
      mockConfigManager.hasProjectConfig.mockResolvedValue(false);

      const bridge = new GeminiCLIBridge();
      const result = await bridge.isGeminiCLIConfigured();

      expect(result).toBe(false);
    });
  });

  describe('getConfigStatus', () => {
    it('should return configuration status', async () => {
      mockConfigManager.readUserConfig.mockResolvedValue({
        mcpServers: {
          automatosx: { command: 'ax', args: ['mcp'] },
        },
      });

      const bridge = new GeminiCLIBridge();
      const status = await bridge.getConfigStatus();

      expect(status.configured).toBe(true);
      expect(status.hasUserConfig).toBe(true);
      expect(status.hasProjectConfig).toBe(true);
      expect(status.mcpServers).toBe(2);
      expect(status.automatosxRegistered).toBe(true);
    });
  });
});
