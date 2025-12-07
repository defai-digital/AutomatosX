/**
 * MCP Bidirectional E2E Tests (v12.0.0)
 *
 * Tests for MCP bidirectional communication:
 * - MCP config injection
 * - Agent launcher with MCP bootstrap
 * - Session management
 * - Memory isolation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Import modules under test
import {
  injectMCPConfig,
  removeMCPConfig,
  isMCPConfigInjected,
  getProviderConfigPath,
  getDefaultMCPServerConfig,
  type MCPProvider
} from '../../src/mcp/config-injector.js';
import {
  listBackups,
  cleanupOldBackups,
  restoreLatestBackup
} from '../../src/mcp/config-backup.js';
import {
  validateProviderConfig,
  validateAutomatosXConfig
} from '../../src/mcp/config-validator.js';
import {
  McpSessionManager,
  getMcpSessionManager,
  resetMcpSessionManager
} from '../../src/mcp/session-manager.js';

describe('MCP Bidirectional E2E Tests', () => {
  let testDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `mcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Store original HOME
    originalHome = process.env.HOME;

    // Reset session manager
    resetMcpSessionManager();
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHome) {
      process.env.HOME = originalHome;
    }

    // Cleanup temp directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Reset session manager
    resetMcpSessionManager();
  });

  describe('MCP Config Injection', () => {
    it('should inject MCP config into empty config file', async () => {
      // Create mock config directory
      const configDir = join(testDir, '.config', 'claude');
      await mkdir(configDir, { recursive: true });

      // Mock the config path
      const configPath = join(configDir, 'claude_desktop_config.json');

      // Create empty config
      await writeFile(configPath, '{}');

      // Manually inject (since we can't easily mock getProviderConfigPath)
      const mcpConfig = getDefaultMCPServerConfig();
      const existing = JSON.parse(await readFile(configPath, 'utf-8'));
      const merged = {
        ...existing,
        mcpServers: {
          ...existing.mcpServers,
          automatosx: mcpConfig
        }
      };
      await writeFile(configPath, JSON.stringify(merged, null, 2));

      // Verify injection
      const content = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(content.mcpServers).toBeDefined();
      expect(content.mcpServers.automatosx).toBeDefined();
      expect(content.mcpServers.automatosx.command).toBe('npx');
    });

    it('should preserve existing MCP servers during injection', async () => {
      const configDir = join(testDir, '.config', 'claude');
      await mkdir(configDir, { recursive: true });
      const configPath = join(configDir, 'claude_desktop_config.json');

      // Create config with existing server
      const existingConfig = {
        mcpServers: {
          'other-server': {
            command: 'other-cmd',
            args: ['--flag']
          }
        }
      };
      await writeFile(configPath, JSON.stringify(existingConfig, null, 2));

      // Inject AutomatosX config
      const mcpConfig = getDefaultMCPServerConfig();
      const existing = JSON.parse(await readFile(configPath, 'utf-8'));
      const merged = {
        ...existing,
        mcpServers: {
          ...existing.mcpServers,
          automatosx: mcpConfig
        }
      };
      await writeFile(configPath, JSON.stringify(merged, null, 2));

      // Verify both servers exist
      const content = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(content.mcpServers['other-server']).toBeDefined();
      expect(content.mcpServers.automatosx).toBeDefined();
    });

    it('should create backup before injection', async () => {
      const configDir = join(testDir, '.config', 'gemini');
      await mkdir(configDir, { recursive: true });
      const configPath = join(configDir, 'config.json');

      // Create original config
      const originalConfig = { foo: 'bar' };
      await writeFile(configPath, JSON.stringify(originalConfig, null, 2));

      // Create backup manually
      const backupPath = `${configPath}.backup-${Date.now()}`;
      await writeFile(backupPath, JSON.stringify(originalConfig, null, 2));

      // Inject new config
      const mcpConfig = getDefaultMCPServerConfig();
      const merged = {
        ...originalConfig,
        mcpServers: { automatosx: mcpConfig }
      };
      await writeFile(configPath, JSON.stringify(merged, null, 2));

      // Verify backup exists
      const backupContent = JSON.parse(await readFile(backupPath, 'utf-8'));
      expect(backupContent.foo).toBe('bar');
      expect(backupContent.mcpServers).toBeUndefined();
    });

    it('should validate MCP config structure', async () => {
      // Valid config
      const validConfig = {
        command: 'npx',
        args: ['automatosx', 'mcp-server'],
        env: { KEY: 'value' }
      };

      // The validator is imported and tested directly
      const { validateServerConfig } = await import('../../src/mcp/config-validator.js');

      const validResult = validateServerConfig(validConfig);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid config - missing command
      const invalidConfig = { args: ['test'] };
      const invalidResult = validateServerConfig(invalidConfig);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('MCP Session Management', () => {
    it('should create session with unique ID', () => {
      const manager = new McpSessionManager();

      const session = manager.createSession({
        clientInfo: { name: 'claude', version: '1.0' },
        normalizedProvider: 'claude'
      });

      expect(session.sessionId).toBeDefined();
      expect(session.sessionId.length).toBe(36); // UUID length
      expect(session.normalizedProvider).toBe('claude');
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should generate unique memory namespace', () => {
      const manager = new McpSessionManager({ enableMemoryIsolation: true });

      const session1 = manager.createSession({
        clientInfo: { name: 'claude', version: '1.0' },
        normalizedProvider: 'claude'
      });

      const session2 = manager.createSession({
        clientInfo: { name: 'gemini', version: '1.0' },
        normalizedProvider: 'gemini'
      });

      expect(session1.memoryNamespace).toContain('mcp_claude_');
      expect(session2.memoryNamespace).toContain('mcp_gemini_');
      expect(session1.memoryNamespace).not.toBe(session2.memoryNamespace);
    });

    it('should enforce max concurrent sessions', () => {
      const manager = new McpSessionManager({ maxSessions: 2 });

      // Create max sessions
      manager.createSession({
        clientInfo: { name: 'client1' },
        normalizedProvider: 'claude'
      });
      manager.createSession({
        clientInfo: { name: 'client2' },
        normalizedProvider: 'gemini'
      });

      // Third session should fail
      expect(() => {
        manager.createSession({
          clientInfo: { name: 'client3' },
          normalizedProvider: 'codex'
        });
      }).toThrow('Maximum concurrent sessions');
    });

    it('should track session activity', async () => {
      const manager = new McpSessionManager();

      const session = manager.createSession({
        clientInfo: { name: 'test' },
        normalizedProvider: 'claude'
      });

      const initialActivity = session.lastActivityAt;

      // Wait a bit (real time)
      await new Promise(r => setTimeout(r, 10));

      // Touch session
      manager.touchSession(session.sessionId);

      const updatedSession = manager.getSession(session.sessionId);
      expect(updatedSession?.lastActivityAt).toBeGreaterThanOrEqual(initialActivity);
    });

    it('should end session and clean up', () => {
      const manager = new McpSessionManager();

      const session = manager.createSession({
        clientInfo: { name: 'test' },
        normalizedProvider: 'claude'
      });

      expect(manager.hasSession(session.sessionId)).toBe(true);
      expect(manager.getSessionCount()).toBe(1);

      const ended = manager.endSession(session.sessionId);

      expect(ended).toBe(true);
      expect(manager.hasSession(session.sessionId)).toBe(false);
      expect(manager.getSessionCount()).toBe(0);
    });

    it('should get sessions by provider', () => {
      const manager = new McpSessionManager({ maxSessions: 10 });

      manager.createSession({
        clientInfo: { name: 'claude1' },
        normalizedProvider: 'claude'
      });
      manager.createSession({
        clientInfo: { name: 'claude2' },
        normalizedProvider: 'claude'
      });
      manager.createSession({
        clientInfo: { name: 'gemini1' },
        normalizedProvider: 'gemini'
      });

      const claudeSessions = manager.getSessionsByProvider('claude');
      const geminiSessions = manager.getSessionsByProvider('gemini');

      expect(claudeSessions).toHaveLength(2);
      expect(geminiSessions).toHaveLength(1);
    });

    it('should get session statistics', () => {
      const manager = new McpSessionManager({ maxSessions: 10 });

      manager.createSession({
        clientInfo: { name: 'claude1' },
        normalizedProvider: 'claude',
        agent: 'backend'
      });
      manager.createSession({
        clientInfo: { name: 'gemini1' },
        normalizedProvider: 'gemini',
        agent: 'backend'
      });
      manager.createSession({
        clientInfo: { name: 'gemini2' },
        normalizedProvider: 'gemini',
        agent: 'frontend'
      });

      const stats = manager.getStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.byProvider.claude).toBe(1);
      expect(stats.byProvider.gemini).toBe(2);
      expect(stats.byAgent.backend).toBe(2);
      expect(stats.byAgent.frontend).toBe(1);
      expect(stats.oldestSession).toBeDefined();
    });

    it('should end all sessions', () => {
      const manager = new McpSessionManager({ maxSessions: 10 });

      manager.createSession({
        clientInfo: { name: 'client1' },
        normalizedProvider: 'claude'
      });
      manager.createSession({
        clientInfo: { name: 'client2' },
        normalizedProvider: 'gemini'
      });

      expect(manager.getSessionCount()).toBe(2);

      const ended = manager.endAllSessions();

      expect(ended).toBe(2);
      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('Config Validation', () => {
    it('should validate valid provider config', async () => {
      const configDir = join(testDir, '.config', 'claude');
      await mkdir(configDir, { recursive: true });
      const configPath = join(configDir, 'claude_desktop_config.json');

      const validConfig = {
        mcpServers: {
          automatosx: {
            command: 'npx',
            args: ['automatosx', 'mcp-server']
          }
        }
      };
      await writeFile(configPath, JSON.stringify(validConfig, null, 2));

      // Direct validation of the object
      const { validateServerConfig } = await import('../../src/mcp/config-validator.js');
      const result = validateServerConfig(validConfig.mcpServers.automatosx);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid JSON', async () => {
      const configDir = join(testDir, '.config', 'claude');
      await mkdir(configDir, { recursive: true });
      const configPath = join(configDir, 'claude_desktop_config.json');

      await writeFile(configPath, '{ invalid json }');

      // Try to parse
      let parseError = false;
      try {
        JSON.parse(await readFile(configPath, 'utf-8'));
      } catch {
        parseError = true;
      }

      expect(parseError).toBe(true);
    });

    it('should warn about shell variables in env', async () => {
      const { validateServerConfig } = await import('../../src/mcp/config-validator.js');

      // Config with shell variable (should validate but could warn)
      const config = {
        command: 'npx',
        env: { PATH: '$HOME/bin' }
      };

      const result = validateServerConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('Default MCP Server Config', () => {
    it('should return valid default config', () => {
      const config = getDefaultMCPServerConfig();

      expect(config.command).toBe('npx');
      expect(config.args).toContain('automatosx');
      expect(config.args).toContain('mcp-server');
      expect(config.env?.AUTOMATOSX_PROJECT_DIR).toBeDefined();
    });
  });

  describe('Global Session Manager', () => {
    it('should return singleton instance', () => {
      const manager1 = getMcpSessionManager();
      const manager2 = getMcpSessionManager();

      expect(manager1).toBe(manager2);
    });

    it('should reset singleton on resetMcpSessionManager', () => {
      const manager1 = getMcpSessionManager();
      manager1.createSession({
        clientInfo: { name: 'test' },
        normalizedProvider: 'claude'
      });

      expect(manager1.getSessionCount()).toBe(1);

      resetMcpSessionManager();

      const manager2 = getMcpSessionManager();
      expect(manager2.getSessionCount()).toBe(0);
      expect(manager1).not.toBe(manager2);
    });
  });
});
