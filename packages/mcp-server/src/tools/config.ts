/**
 * MCP Config Tools
 *
 * Exposes configuration operations via MCP for programmatic access.
 * Per PRD Section 13: MCP Integration
 */

import type { MCPTool, MCPToolResult, ToolHandler } from '../types.js';
import {
  createConfigStore,
  getValue,
  setValue,
} from '@defai.digital/config-domain';
import { getErrorMessage } from '@defai.digital/contracts';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * config_get tool - Get configuration value
 * INV-MCP-004: Idempotent - read-only operation
 */
export const configGetTool: MCPTool = {
  name: 'config_get',
  description: 'Get a configuration value by path. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Config path (e.g., "logLevel", "providers.0.providerId")',
      },
      scope: {
        type: 'string',
        description: 'Config scope: global, local, or merged',
        enum: ['global', 'local', 'merged'],
        default: 'merged',
      },
    },
    required: ['path'],
  },
  idempotent: true,
};

/**
 * config_set tool - Set configuration value
 * INV-MCP-004: Idempotent - setting same value twice has same result
 * INV-MCP-002: Side effects - writes to config file
 */
export const configSetTool: MCPTool = {
  name: 'config_set',
  description: 'Set a configuration value. SIDE EFFECTS: Writes to config file on disk. Idempotent - setting same value twice produces same result.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Config path to set',
      },
      value: {
        type: 'string',
        description: 'Value to set (JSON string for complex values)',
      },
      scope: {
        type: 'string',
        description: 'Config scope: global or local',
        enum: ['global', 'local'],
        default: 'global',
      },
    },
    required: ['path', 'value'],
  },
  idempotent: true,
};

/**
 * config_show tool - Show full configuration
 * INV-MCP-004: Idempotent - read-only operation
 */
export const configShowTool: MCPTool = {
  name: 'config_show',
  description: 'Show the full configuration. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'Config scope: global, local, or merged',
        enum: ['global', 'local', 'merged'],
        default: 'merged',
      },
    },
  },
  idempotent: true,
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handles config_get tool calls
 */
export const handleConfigGet: ToolHandler = async (
  args: Record<string, unknown>
): Promise<MCPToolResult> => {
  const path = args.path as string;
  const scope = (args.scope as 'global' | 'local' | 'merged') ?? 'merged';

  try {
    const store = createConfigStore();

    let config;
    if (scope === 'merged') {
      config = await store.readMerged();
    } else {
      config = await store.read(scope);
    }

    if (config === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              path,
              value: undefined,
              scope,
              found: false,
            }),
          },
        ],
      };
    }

    const value = getValue(config, path);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            path,
            value,
            scope,
            found: value !== undefined,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting config: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handles config_set tool calls
 */
export const handleConfigSet: ToolHandler = async (
  args: Record<string, unknown>
): Promise<MCPToolResult> => {
  const path = args.path as string;
  const valueStr = args.value as string;
  const scope = (args.scope as 'global' | 'local') ?? 'global';

  try {
    // Parse value (try JSON first, fallback to string)
    let value: unknown;
    try {
      value = JSON.parse(valueStr);
    } catch {
      // Not JSON, use as string
      // Handle boolean strings
      if (valueStr === 'true') value = true;
      else if (valueStr === 'false') value = false;
      // Handle number strings
      else if (/^-?\d+(\.\d+)?$/.test(valueStr)) value = Number(valueStr);
      else value = valueStr;
    }

    const store = createConfigStore();

    // Read existing config
    let config = await store.read(scope);
    if (config === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: `No ${scope} configuration found. Run "ax setup" first.`,
          },
        ],
        isError: true,
      };
    }

    // Get old value
    const oldValue = getValue(config, path);

    // Set new value
    config = setValue(config, path, value);

    // Write config
    await store.write(config, scope);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            path,
            oldValue,
            newValue: value,
            scope,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error setting config: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handles config_show tool calls
 */
export const handleConfigShow: ToolHandler = async (
  args: Record<string, unknown>
): Promise<MCPToolResult> => {
  const scope = (args.scope as 'global' | 'local' | 'merged') ?? 'merged';

  try {
    const store = createConfigStore();

    let config;
    if (scope === 'merged') {
      config = await store.readMerged();
    } else {
      config = await store.read(scope);
    }

    if (config === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: `No ${scope} configuration found. Run "ax setup" first.`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(config, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error showing config: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};
