/**
 * Ability MCP Tools
 *
 * Tools for managing abilities - reusable knowledge modules for agents.
 * Uses the shared registry from registry-accessor.ts for unified ability management.
 */

import type { MCPTool, ToolHandler } from '../types.js';
import type { Ability, AbilityInjectionResult } from '@automatosx/contracts';
import type { AbilityFilter } from '@automatosx/ability-domain';
// Import from registry-accessor to avoid circular dependencies
import {
  getSharedAbilityRegistry,
  getSharedAbilityManager,
} from '../registry-accessor.js';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Ability list tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const abilityListTool: MCPTool = {
  name: 'ability_list',
  description: 'List available abilities with optional filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "languages", "engineering")',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (returns abilities matching any tag)',
      },
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled status',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of abilities to return',
        default: 50,
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      abilities: {
        type: 'array',
        description: 'List of ability summaries',
        items: {
          type: 'object',
          properties: {
            abilityId: { type: 'string' },
            displayName: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            priority: { type: 'number' },
            enabled: { type: 'boolean' },
          },
        },
      },
      total: { type: 'number', description: 'Total number of abilities' },
    },
    required: ['abilities', 'total'],
  },
  idempotent: true,
};

/**
 * Ability get tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const abilityGetTool: MCPTool = {
  name: 'ability_get',
  description: 'Get detailed information about a specific ability. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      abilityId: {
        type: 'string',
        description: 'The ID of the ability to retrieve',
      },
    },
    required: ['abilityId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      abilityId: { type: 'string' },
      displayName: { type: 'string' },
      version: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      content: { type: 'string' },
      author: { type: 'string' },
      source: { type: 'string' },
      requires: { type: 'array', items: { type: 'string' } },
      conflicts: { type: 'array', items: { type: 'string' } },
      applicableTo: { type: 'array', items: { type: 'string' } },
      excludeFrom: { type: 'array', items: { type: 'string' } },
      priority: { type: 'number' },
      enabled: { type: 'boolean' },
    },
    required: ['abilityId', 'content', 'enabled'],
  },
  idempotent: true,
};

/**
 * Ability inject tool definition
 * INV-MCP-004: Idempotent - returns computed content, no state changes
 */
export const abilityInjectTool: MCPTool = {
  name: 'ability_inject',
  description: 'Inject relevant abilities into a prompt based on task. Returns combined ability content for agent context. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The agent ID for applicability filtering',
      },
      task: {
        type: 'string',
        description: 'The task description to match abilities against',
      },
      coreAbilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Core ability IDs to always include',
      },
      maxAbilities: {
        type: 'number',
        description: 'Maximum number of abilities to inject',
        default: 10,
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum total tokens for injected content',
        default: 50000,
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include ability headers in combined content',
        default: false,
      },
    },
    required: ['agentId', 'task'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      injectedAbilities: { type: 'array', items: { type: 'string' } },
      combinedContent: { type: 'string' },
      tokenCount: { type: 'number' },
      truncated: { type: 'boolean' },
    },
    required: ['agentId', 'injectedAbilities', 'combinedContent'],
  },
  idempotent: true,
};

/**
 * Ability register tool definition
 * INV-MCP-004: Non-idempotent - creates new ability
 * INV-MCP-002: Side effects - modifies ability registry
 */
export const abilityRegisterTool: MCPTool = {
  name: 'ability_register',
  description: 'Register a new ability. SIDE EFFECTS: Creates new ability in registry. Overwrites if ability already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      abilityId: {
        type: 'string',
        description: 'Unique identifier (lowercase, dashes allowed)',
      },
      content: {
        type: 'string',
        description: 'The ability content/knowledge (max 50000 chars)',
      },
      displayName: {
        type: 'string',
        description: 'Human-readable display name',
      },
      description: {
        type: 'string',
        description: 'Brief description of the ability',
      },
      category: {
        type: 'string',
        description: 'Category for organization',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for filtering and matching',
      },
      priority: {
        type: 'number',
        description: 'Priority for load order (1-100, default 50)',
        default: 50,
      },
      enabled: {
        type: 'boolean',
        description: 'Whether ability is enabled',
        default: true,
      },
      applicableTo: {
        type: 'array',
        items: { type: 'string' },
        description: 'Agent IDs this ability applies to (* for all)',
      },
      excludeFrom: {
        type: 'array',
        items: { type: 'string' },
        description: 'Agent IDs to exclude this ability from',
      },
    },
    required: ['abilityId', 'content'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      registered: { type: 'boolean' },
      abilityId: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['registered', 'abilityId', 'message'],
  },
  idempotent: false,
};

/**
 * Ability remove tool definition
 * INV-MCP-004: Idempotent - removing non-existent ability returns removed=false
 * INV-MCP-002: Side effects - deletes ability from registry
 */
export const abilityRemoveTool: MCPTool = {
  name: 'ability_remove',
  description: 'Remove an ability from the registry. SIDE EFFECTS: Deletes ability. Idempotent - removing non-existent ability returns removed=false.',
  inputSchema: {
    type: 'object',
    properties: {
      abilityId: {
        type: 'string',
        description: 'The ID of the ability to remove',
      },
    },
    required: ['abilityId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      removed: { type: 'boolean' },
      abilityId: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['removed', 'abilityId', 'message'],
  },
  idempotent: true,
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handler for ability_list tool
 */
export const handleAbilityList: ToolHandler = async (args) => {
  const category = args.category as string | undefined;
  const tags = args.tags as string[] | undefined;
  const enabled = args.enabled as boolean | undefined;
  const limit = (args.limit as number | undefined) ?? 50;

  try {
    const registry = await getSharedAbilityRegistry();

    // Build filter
    const filter: AbilityFilter = {};
    if (category !== undefined) filter.category = category;
    if (tags !== undefined && tags.length > 0) filter.tags = tags;
    if (enabled !== undefined) filter.enabled = enabled;

    const abilities = await registry.list(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    const abilitySummaries = abilities.slice(0, limit).map((a: Ability) => ({
      abilityId: a.abilityId,
      displayName: a.displayName,
      description: a.description,
      category: a.category,
      tags: a.tags,
      priority: a.priority,
      enabled: a.enabled,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              abilities: abilitySummaries,
              total: abilities.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'ABILITY_LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for ability_get tool
 */
export const handleAbilityGet: ToolHandler = async (args) => {
  const abilityId = args.abilityId as string;

  try {
    const registry = await getSharedAbilityRegistry();
    const ability = await registry.get(abilityId);

    if (ability === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'ABILITY_NOT_FOUND',
              message: `Ability "${abilityId}" not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              abilityId: ability.abilityId,
              displayName: ability.displayName,
              version: ability.version,
              description: ability.description,
              category: ability.category,
              tags: ability.tags,
              content: ability.content,
              author: ability.author,
              source: ability.source,
              requires: ability.requires,
              conflicts: ability.conflicts,
              applicableTo: ability.applicableTo,
              excludeFrom: ability.excludeFrom,
              priority: ability.priority,
              enabled: ability.enabled,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'ABILITY_GET_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for ability_inject tool
 */
export const handleAbilityInject: ToolHandler = async (args) => {
  const agentId = args.agentId as string;
  const task = args.task as string;
  const coreAbilities = args.coreAbilities as string[] | undefined;
  const maxAbilities = args.maxAbilities as number | undefined;
  const maxTokens = args.maxTokens as number | undefined;
  const includeMetadata = (args.includeMetadata as boolean | undefined) ?? false;

  try {
    const manager = await getSharedAbilityManager();

    // Build options object with only defined values
    const options: { maxAbilities?: number; maxTokens?: number; includeMetadata?: boolean } = {};
    if (maxAbilities !== undefined) options.maxAbilities = maxAbilities;
    if (maxTokens !== undefined) options.maxTokens = maxTokens;
    options.includeMetadata = includeMetadata;

    const result: AbilityInjectionResult = await manager.injectAbilities(
      agentId,
      task,
      coreAbilities,
      options
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agentId: result.agentId,
              injectedAbilities: result.injectedAbilities,
              combinedContent: result.combinedContent,
              tokenCount: result.tokenCount,
              truncated: result.truncated,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'ABILITY_INJECT_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for ability_register tool
 */
export const handleAbilityRegister: ToolHandler = async (args) => {
  const abilityId = args.abilityId as string;
  const content = args.content as string;
  const displayName = args.displayName as string | undefined;
  const description = args.description as string | undefined;
  const category = args.category as string | undefined;
  const tags = args.tags as string[] | undefined;
  const priority = (args.priority as number | undefined) ?? 50;
  const enabled = (args.enabled as boolean | undefined) ?? true;
  const applicableTo = args.applicableTo as string[] | undefined;
  const excludeFrom = args.excludeFrom as string[] | undefined;

  try {
    // Validate abilityId format
    const abilityIdPattern = /^[a-z][a-z0-9-]*$/;
    if (!abilityIdPattern.test(abilityId)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_ABILITY_ID',
              message: 'Ability ID must start with lowercase letter and contain only lowercase, digits, and dashes',
            }),
          },
        ],
        isError: true,
      };
    }

    const registry = await getSharedAbilityRegistry();

    const ability: Ability = {
      abilityId,
      content,
      displayName,
      description,
      category,
      tags,
      priority,
      enabled,
      applicableTo,
      excludeFrom,
    };

    await registry.register(ability);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              registered: true,
              abilityId,
              message: `Ability "${abilityId}" registered successfully`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'ABILITY_REGISTER_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for ability_remove tool
 */
export const handleAbilityRemove: ToolHandler = async (args) => {
  const abilityId = args.abilityId as string;

  try {
    const registry = await getSharedAbilityRegistry();
    const exists = await registry.exists(abilityId);

    if (!exists) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              removed: false,
              abilityId,
              message: `Ability "${abilityId}" not found`,
            }),
          },
        ],
      };
    }

    await registry.remove(abilityId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              removed: true,
              abilityId,
              message: `Ability "${abilityId}" removed successfully`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'ABILITY_REMOVE_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};
