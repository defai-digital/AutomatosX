/**
 * MCP Server Presets
 *
 * Pre-configured MCP servers for common services.
 */

import type { MCPServerConfig } from '../../types/gemini-mcp.js';

export const MCP_PRESETS: Record<string, MCPServerConfig> = {
  github: {
    name: 'github',
    enabled: false, // Disabled by default - requires GITHUB_PERSONAL_ACCESS_TOKEN
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || ''
    },
    config: {
      // GitHub MCP config
      // Requires GitHub token in environment
    },
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000
    }
  },

  slack: {
    name: 'slack',
    enabled: false, // Disabled by default - requires SLACK_BOT_TOKEN and SLACK_APP_TOKEN
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: {
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || '',
      SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN || ''
    },
    config: {
      // Slack MCP config
      // Requires Slack tokens in environment
    },
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000
    }
  },

  database: {
    name: 'database',
    enabled: false, // Disabled by default - requires DATABASE_URL
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || ''
    },
    config: {
      // Database MCP config
      // Configurable connection string
    },
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000
    }
  },
  // FIXED (v11.2.7): Use getter function instead of static value to avoid
  // capturing process.cwd() at module load time. The getMCPPreset() function
  // should be used to get a fresh copy with the current working directory.
  filesystem: {
    name: 'filesystem',
    enabled: true,
    command: 'npx',
    // Note: args is a template, actual cwd should be injected at runtime
    // via getMCPPresetWithCwd() or similar pattern
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    config: {
      // Filesystem MCP config
      // Access to current working directory
    },
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000
    }
  },

  puppeteer: {
    name: 'puppeteer',
    enabled: false, // Disabled by default as it requires more setup
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    config: {
      // Puppeteer MCP config
      // Web automation capabilities
    },
    healthCheck: {
      enabled: true,
      interval: 60000, // 1 minute
      timeout: 10000
    }
  },

};

export function getMCPPreset(name: string): MCPServerConfig | undefined {
  const preset = MCP_PRESETS[name];
  if (!preset) return undefined;

  // FIXED (v11.2.7): Inject current working directory for filesystem preset
  if (name === 'filesystem' && preset.args) {
    return {
      ...preset,
      args: [...preset.args, process.cwd()]
    };
  }

  return preset;
}

export function listMCPPresets(): string[] {
  return Object.keys(MCP_PRESETS);
}

export function getEnabledPresets(): MCPServerConfig[] {
  // FIXED (v11.2.7): Use getMCPPreset to ensure runtime values (like cwd) are injected
  return Object.keys(MCP_PRESETS)
    .filter(name => MCP_PRESETS[name]?.enabled)
    .map(name => getMCPPreset(name)!)
    .filter(preset => preset !== undefined);
}