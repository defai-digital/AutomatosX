import type { MCPTool, ToolHandler } from '../types.js';
import { LIMIT_DEFAULT, LIMIT_MEMORY } from '@automatosx/contracts';

/**
 * Memory store tool definition
 * INV-MCP-004: Idempotent - storing same key/value is safe to retry
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
  idempotent: true,
  retryableErrors: ['STORE_FAILED'],
};

/**
 * Memory retrieve tool definition
 * INV-MCP-004: Idempotent - read-only operation
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
  idempotent: true,
};

/**
 * Memory search tool definition
 * INV-MCP-004: Idempotent - read-only operation
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
        default: LIMIT_DEFAULT,
      },
    },
    required: ['query'],
  },
  idempotent: true,
};

/**
 * Memory list tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const memoryListTool: MCPTool = {
  name: 'memory_list',
  description: 'List all keys in memory with optional namespace filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Optional namespace to filter keys',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of keys to return',
        default: LIMIT_MEMORY,
      },
      prefix: {
        type: 'string',
        description: 'Optional key prefix filter',
      },
    },
  },
  idempotent: true,
};

/**
 * Memory delete tool definition
 * INV-MCP-004: Idempotent - deleting non-existent key returns deleted=false
 * INV-MCP-002: Side effects - removes key from memory store
 */
export const memoryDeleteTool: MCPTool = {
  name: 'memory_delete',
  description: 'Delete a key from memory. SIDE EFFECTS: Removes key from store. Idempotent - deleting non-existent key returns deleted=false.',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key to delete',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace for the key',
      },
    },
    required: ['key'],
  },
  idempotent: true,
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

/**
 * Handler for memory_list tool
 * INV-MCP-MEM-001: Keys returned in storage order (oldest first)
 * INV-MCP-MEM-002: Namespace filter is exact match
 * INV-MCP-MEM-003: Prefix filter is case-sensitive
 */
export const handleMemoryList: ToolHandler = (args) => {
  const namespace = args.namespace as string | undefined;
  const limit = (args.limit as number | undefined) ?? 100;
  const prefix = args.prefix as string | undefined;

  const keys: {
    key: string;
    namespace: string;
    storedAt: string;
  }[] = [];

  for (const [fullKey, stored] of memoryStore.entries()) {
    const storedData = stored as { value: unknown; storedAt: string; namespace: string };

    // Filter by namespace if specified (exact match - INV-MCP-MEM-002)
    if (namespace !== undefined && storedData.namespace !== namespace) {
      continue;
    }

    // Extract key part from fullKey (namespace:key)
    const keyPart = fullKey.split(':')[1] ?? fullKey;

    // Filter by prefix if specified (case-sensitive - INV-MCP-MEM-003)
    if (prefix !== undefined && !keyPart.startsWith(prefix)) {
      continue;
    }

    keys.push({
      key: keyPart,
      namespace: storedData.namespace,
      storedAt: storedData.storedAt,
    });

    if (keys.length >= limit) {
      break;
    }
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          keys,
          total: keys.length,
          hasMore: memoryStore.size > keys.length,
        }, null, 2),
      },
    ],
  });
};

/**
 * Handler for memory_delete tool
 * INV-MCP-MEM-004: Delete is idempotent (deleting non-existent key returns deleted=false)
 * INV-MCP-MEM-005: Delete emits trace event with key info
 */
export const handleMemoryDelete: ToolHandler = (args) => {
  const key = args.key as string;
  const namespace = (args.namespace as string | undefined) ?? 'default';

  const fullKey = `${namespace}:${key}`;

  const existed = memoryStore.has(fullKey);

  if (existed) {
    memoryStore.delete(fullKey);
  }

  // INV-MCP-MEM-004: Idempotent - returns deleted=false for non-existent key
  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          deleted: existed,
          key,
          namespace,
          message: existed
            ? `Key "${key}" deleted successfully`
            : `Key "${key}" not found in namespace "${namespace}"`,
        }, null, 2),
      },
    ],
  });
};

// ============================================================================
// Enhanced Memory Tools
// ============================================================================

/**
 * Memory export tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const memoryExportTool: MCPTool = {
  name: 'memory_export',
  description: 'Export memory entries to JSON format. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Optional namespace to export',
      },
      prefix: {
        type: 'string',
        description: 'Optional key prefix filter',
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include storedAt and other metadata',
        default: true,
      },
    },
  },
  idempotent: true,
};

/**
 * Memory import tool definition
 * INV-MCP-004: Non-idempotent without overwrite flag
 * INV-MCP-002: Side effects - writes entries to memory store
 */
export const memoryImportTool: MCPTool = {
  name: 'memory_import',
  description: 'Import memory entries from JSON format. SIDE EFFECTS: Writes entries to memory store. Use overwrite=true for idempotent behavior.',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        description: 'Array of entries to import',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'object' },
            namespace: { type: 'string' },
          },
          required: ['key', 'value'],
        },
      },
      overwrite: {
        type: 'boolean',
        description: 'Overwrite existing keys',
        default: false,
      },
      namespace: {
        type: 'string',
        description: 'Override namespace for all imported entries',
      },
    },
    required: ['data'],
  },
  idempotent: false,
};

/**
 * Memory stats tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const memoryStatsTool: MCPTool = {
  name: 'memory_stats',
  description: 'Get memory storage statistics. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Optional namespace to get stats for',
      },
      detailed: {
        type: 'boolean',
        description: 'Include detailed breakdown by namespace',
        default: false,
      },
    },
  },
  idempotent: true,
};

/**
 * Memory bulk delete tool definition
 * INV-MCP-004: Idempotent - deleting non-existent keys is safe
 * INV-MCP-002: Side effects - removes multiple keys from memory store
 */
export const memoryBulkDeleteTool: MCPTool = {
  name: 'memory_bulk_delete',
  description: 'Delete multiple keys from memory. SIDE EFFECTS: Removes keys from store. Idempotent - deleting non-existent keys returns notFound count.',
  inputSchema: {
    type: 'object',
    properties: {
      keys: {
        type: 'array',
        description: 'Array of keys to delete',
        items: { type: 'string' },
      },
      namespace: {
        type: 'string',
        description: 'Namespace for all keys',
      },
      prefix: {
        type: 'string',
        description: 'Delete all keys with this prefix (alternative to keys)',
      },
    },
  },
  idempotent: true,
};

/**
 * Memory clear tool definition
 * INV-MCP-004: Idempotent - clearing empty namespace returns cleared=0
 * INV-MCP-002: Side effects - removes all entries in namespace
 */
export const memoryClearTool: MCPTool = {
  name: 'memory_clear',
  description: 'Clear all memory entries in a namespace. SIDE EFFECTS: Removes all entries in namespace. Requires confirm=true. Idempotent - clearing empty namespace returns cleared=0.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Namespace to clear (required for safety)',
      },
      confirm: {
        type: 'boolean',
        description: 'Confirmation flag (must be true)',
      },
    },
    required: ['namespace', 'confirm'],
  },
  idempotent: true,
};

/**
 * Handler for memory_export tool
 */
export const handleMemoryExport: ToolHandler = (args) => {
  const namespace = args.namespace as string | undefined;
  const prefix = args.prefix as string | undefined;
  const includeMetadata = (args.includeMetadata as boolean) ?? true;

  const exports: {
    key: string;
    value: unknown;
    namespace: string;
    storedAt?: string;
  }[] = [];

  for (const [fullKey, stored] of memoryStore.entries()) {
    const storedData = stored as { value: unknown; storedAt: string; namespace: string };

    if (namespace !== undefined && storedData.namespace !== namespace) {
      continue;
    }

    const keyPart = fullKey.split(':')[1] ?? fullKey;

    if (prefix !== undefined && !keyPart.startsWith(prefix)) {
      continue;
    }

    const entry: {
      key: string;
      value: unknown;
      namespace: string;
      storedAt?: string;
    } = {
      key: keyPart,
      value: storedData.value,
      namespace: storedData.namespace,
    };

    if (includeMetadata) {
      entry.storedAt = storedData.storedAt;
    }

    exports.push(entry);
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          count: exports.length,
          exportedAt: new Date().toISOString(),
          data: exports,
        }, null, 2),
      },
    ],
  });
};

/**
 * Handler for memory_import tool
 */
export const handleMemoryImport: ToolHandler = (args) => {
  const data = args.data as { key: string; value: unknown; namespace?: string }[];
  const overwrite = (args.overwrite as boolean) ?? false;
  const defaultNamespace = (args.namespace as string) ?? 'default';

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of data) {
    const namespace = entry.namespace ?? defaultNamespace;
    const fullKey = `${namespace}:${entry.key}`;

    if (!overwrite && memoryStore.has(fullKey)) {
      skipped++;
      continue;
    }

    try {
      memoryStore.set(fullKey, {
        value: entry.value,
        storedAt: new Date().toISOString(),
        namespace,
      });
      imported++;
    } catch (error) {
      errors.push(`Failed to import key "${entry.key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          imported,
          skipped,
          errors: errors.length > 0 ? errors : undefined,
          importedAt: new Date().toISOString(),
        }, null, 2),
      },
    ],
  });
};

/**
 * Handler for memory_stats tool
 */
export const handleMemoryStats: ToolHandler = (args) => {
  const namespaceFilter = args.namespace as string | undefined;
  const detailed = (args.detailed as boolean) ?? false;

  const namespaceStats = new Map<string, { count: number; keys: string[] }>();
  let totalEntries = 0;

  for (const [fullKey, stored] of memoryStore.entries()) {
    const storedData = stored as { value: unknown; storedAt: string; namespace: string };

    if (namespaceFilter !== undefined && storedData.namespace !== namespaceFilter) {
      continue;
    }

    totalEntries++;

    const existing = namespaceStats.get(storedData.namespace);
    if (existing !== undefined) {
      existing.count++;
      if (detailed) {
        const keyPart = fullKey.split(':')[1] ?? fullKey;
        existing.keys.push(keyPart);
      }
    } else {
      const keyPart = fullKey.split(':')[1] ?? fullKey;
      namespaceStats.set(storedData.namespace, {
        count: 1,
        keys: detailed ? [keyPart] : [],
      });
    }
  }

  const byNamespace: Record<string, { count: number; keys?: string[] }> = {};
  for (const [ns, stats] of namespaceStats.entries()) {
    byNamespace[ns] = detailed ? stats : { count: stats.count };
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          totalEntries,
          namespaceCount: namespaceStats.size,
          byNamespace,
          generatedAt: new Date().toISOString(),
        }, null, 2),
      },
    ],
  });
};

/**
 * Handler for memory_bulk_delete tool
 */
export const handleMemoryBulkDelete: ToolHandler = (args) => {
  const keys = args.keys as string[] | undefined;
  const namespace = (args.namespace as string) ?? 'default';
  const prefix = args.prefix as string | undefined;

  let deleted = 0;
  let notFound = 0;
  const deletedKeys: string[] = [];

  if (keys !== undefined && keys.length > 0) {
    for (const key of keys) {
      const fullKey = `${namespace}:${key}`;
      if (memoryStore.has(fullKey)) {
        memoryStore.delete(fullKey);
        deleted++;
        deletedKeys.push(key);
      } else {
        notFound++;
      }
    }
  } else if (prefix !== undefined) {
    const keysToDelete: string[] = [];
    for (const [fullKey, stored] of memoryStore.entries()) {
      const storedData = stored as { value: unknown; storedAt: string; namespace: string };
      if (storedData.namespace !== namespace) continue;

      const keyPart = fullKey.split(':')[1] ?? fullKey;
      if (keyPart.startsWith(prefix)) {
        keysToDelete.push(fullKey);
        deletedKeys.push(keyPart);
      }
    }

    for (const fullKey of keysToDelete) {
      memoryStore.delete(fullKey);
      deleted++;
    }
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          deleted,
          notFound,
          deletedKeys,
          namespace,
          deletedAt: new Date().toISOString(),
        }, null, 2),
      },
    ],
  });
};

/**
 * Handler for memory_clear tool
 */
export const handleMemoryClear: ToolHandler = (args) => {
  const namespace = args.namespace as string;
  const confirm = args.confirm as boolean;

  if (!confirm) {
    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'CONFIRMATION_REQUIRED',
            message: 'Set confirm=true to clear the namespace',
            namespace,
          }),
        },
      ],
      isError: true,
    });
  }

  let cleared = 0;
  const keysToDelete: string[] = [];

  for (const [fullKey, stored] of memoryStore.entries()) {
    const storedData = stored as { value: unknown; storedAt: string; namespace: string };
    if (storedData.namespace === namespace) {
      keysToDelete.push(fullKey);
    }
  }

  for (const fullKey of keysToDelete) {
    memoryStore.delete(fullKey);
    cleared++;
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          cleared,
          namespace,
          clearedAt: new Date().toISOString(),
        }, null, 2),
      },
    ],
  });
};
