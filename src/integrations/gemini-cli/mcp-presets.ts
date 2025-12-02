/**
 * MCP Server Presets
 *
 * Pre-configured MCP servers for common services.
 */

import type { MCPServerConfig } from '../../types/gemini-mcp.js';

export const MCP_PRESETS: Record<string, MCPServerConfig> = {
  github: {
    name: 'github',
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
  filesystem: {
    name: 'filesystem',
    enabled: true,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/akiralam/code/AutomatosX'],
    config: {
      // Filesystem MCP config
      // Access to specified directory
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

  brave: {
    name: 'brave',
    enabled: false, // Disabled by default as it requires API key
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY || ''
    },
    config: {
      // Brave Search MCP config
      // Web search capabilities
    },
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000
    }
  }
};

export function getMCPPreset(name: string): MCPServerConfig | undefined {
  return MCP_PRESETS[name];
}

export function listMCPPresets(): string[] {
  return Object.keys(MCP_PRESETS);
}

export function getEnabledPresets(): MCPServerConfig[] {
  return Object.values(MCP_PRESETS).filter(preset => preset.enabled);
}