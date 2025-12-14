import type { MCPTool, ToolHandler } from '../types.js';

/**
 * Memory store tool definition
 */
export const memoryStoreTool: MCPTool = {
  name: 'memory_store',
  description: 'Store a value in memory with a key',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key to store the value under',
      },
      value: {
        type: 'object',
        description: 'The value to store',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace for the key',
      },
    },
    required: ['key', 'value'],
  },
};

/**
 * Memory retrieve tool definition
 */
export const memoryRetrieveTool: MCPTool = {
  name: 'memory_retrieve',
  description: 'Retrieve a value from memory by key',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key to retrieve',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace for the key',
      },
    },
    required: ['key'],
  },
};

/**
 * Memory search tool definition
 */
export const memorySearchTool: MCPTool = {
  name: 'memory_search',
  description: 'Search memory for values matching a query',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace to search in',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
      },
    },
    required: ['query'],
  },
};

// In-memory storage for demonstration
const memoryStore = new Map<string, unknown>();

/**
 * Handler for memory_store tool
 */
export const handleMemoryStore: ToolHandler = (args) => {
  const key = args.key as string;
  const value = args.value as Record<string, unknown>;
  const namespace = (args.namespace as string | undefined) ?? 'default';

  const fullKey = `${namespace}:${key}`;

  try {
    memoryStore.set(fullKey, {
      value,
      storedAt: new Date().toISOString(),
      namespace,
    });

    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            key,
            namespace,
            message: `Value stored successfully at key: ${key}`,
          }, null, 2),
        },
      ],
    });
  } catch (error) {
    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: `Error storing value: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    });
  }
};

/**
 * Handler for memory_retrieve tool
 */
export const handleMemoryRetrieve: ToolHandler = (args) => {
  const key = args.key as string;
  const namespace = (args.namespace as string | undefined) ?? 'default';

  const fullKey = `${namespace}:${key}`;

  const stored = memoryStore.get(fullKey) as
    | { value: unknown; storedAt: string; namespace: string }
    | undefined;

  if (stored === undefined) {
    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            found: false,
            key,
            namespace,
            message: `No value found for key: ${key}`,
          }, null, 2),
        },
      ],
    });
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          found: true,
          key,
          namespace,
          value: stored.value,
          storedAt: stored.storedAt,
        }, null, 2),
      },
    ],
  });
};

/**
 * Handler for memory_search tool
 */
export const handleMemorySearch: ToolHandler = (args) => {
  const query = args.query as string;
  const namespace = args.namespace as string | undefined;
  const limit = (args.limit as number | undefined) ?? 10;

  const results: {
    key: string;
    namespace: string;
    value: unknown;
    storedAt: string;
  }[] = [];

  for (const [fullKey, stored] of memoryStore.entries()) {
    const storedData = stored as { value: unknown; storedAt: string; namespace: string };

    // Filter by namespace if specified
    if (namespace !== undefined && storedData.namespace !== namespace) {
      continue;
    }

    // Simple substring search in key
    const keyPart = fullKey.split(':')[1] ?? fullKey;
    if (keyPart.includes(query)) {
      results.push({
        key: keyPart,
        namespace: storedData.namespace,
        value: storedData.value,
        storedAt: storedData.storedAt,
      });
    }

    if (results.length >= limit) {
      break;
    }
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          query,
          namespace: namespace ?? 'all',
          count: results.length,
          results,
        }, null, 2),
      },
    ],
  });
};
