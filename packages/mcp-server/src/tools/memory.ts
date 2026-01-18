import type { MCPTool, ToolHandler } from '../types.js';
import { LIMIT_DEFAULT, LIMIT_MEMORY } from '@defai.digital/contracts';
import { successResponse, errorResponse } from '../utils/response.js';

// In-memory storage for demonstration
const memoryStore = new Map<string, { value: unknown; storedAt: string; namespace: string }>();

// ============================================================================
// Helper Functions
// ============================================================================

function getFullKey(namespace: string | undefined, key: string): string {
  return `${namespace ?? 'default'}:${key}`;
}

function getKeyPart(fullKey: string): string {
  return fullKey.split(':')[1] ?? fullKey;
}

function filterEntries(
  namespaceFilter?: string,
  prefixFilter?: string
): Array<{ fullKey: string; keyPart: string; data: { value: unknown; storedAt: string; namespace: string } }> {
  const results: Array<{ fullKey: string; keyPart: string; data: { value: unknown; storedAt: string; namespace: string } }> = [];
  for (const [fullKey, data] of memoryStore.entries()) {
    if (namespaceFilter !== undefined && data.namespace !== namespaceFilter) continue;
    const keyPart = getKeyPart(fullKey);
    if (prefixFilter !== undefined && !keyPart.startsWith(prefixFilter)) continue;
    results.push({ fullKey, keyPart, data });
  }
  return results;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const memoryStoreTool: MCPTool = {
  name: 'memory_store',
  description: 'Store a value in memory with a key',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The key to store the value under' },
      value: { type: 'object', description: 'The value to store' },
      namespace: { type: 'string', description: 'Optional namespace for the key' },
    },
    required: ['key', 'value'],
  },
  idempotent: true,
  retryableErrors: ['STORE_FAILED'],
};

export const memoryRetrieveTool: MCPTool = {
  name: 'memory_retrieve',
  description: 'Retrieve a value from memory by key',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The key to retrieve' },
      namespace: { type: 'string', description: 'Optional namespace for the key' },
    },
    required: ['key'],
  },
  idempotent: true,
};

export const memorySearchTool: MCPTool = {
  name: 'memory_search',
  description: 'Search memory for values matching a query',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      namespace: { type: 'string', description: 'Optional namespace to search in' },
      limit: { type: 'number', description: 'Maximum number of results', default: LIMIT_DEFAULT },
    },
    required: ['query'],
  },
  idempotent: true,
};

export const memoryListTool: MCPTool = {
  name: 'memory_list',
  description: 'List all keys in memory with optional namespace filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Optional namespace to filter keys' },
      limit: { type: 'number', description: 'Maximum number of keys to return', default: LIMIT_MEMORY },
      prefix: { type: 'string', description: 'Optional key prefix filter' },
    },
  },
  idempotent: true,
};

export const memoryDeleteTool: MCPTool = {
  name: 'memory_delete',
  description: 'Delete a key from memory. SIDE EFFECTS: Removes key from store. Idempotent - deleting non-existent key returns deleted=false.',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The key to delete' },
      namespace: { type: 'string', description: 'Optional namespace for the key' },
    },
    required: ['key'],
  },
  idempotent: true,
};

export const memoryExportTool: MCPTool = {
  name: 'memory_export',
  description: 'Export memory entries to JSON format. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Optional namespace to export' },
      prefix: { type: 'string', description: 'Optional key prefix filter' },
      includeMetadata: { type: 'boolean', description: 'Include storedAt and other metadata', default: true },
    },
  },
  idempotent: true,
};

export const memoryImportTool: MCPTool = {
  name: 'memory_import',
  description: 'Import memory entries from JSON format. SIDE EFFECTS: Writes entries to memory store.',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        description: 'Array of entries to import',
        items: {
          type: 'object',
          properties: { key: { type: 'string' }, value: { type: 'object' }, namespace: { type: 'string' } },
          required: ['key', 'value'],
        },
      },
      overwrite: { type: 'boolean', description: 'Overwrite existing keys', default: false },
      namespace: { type: 'string', description: 'Override namespace for all imported entries' },
    },
    required: ['data'],
  },
  idempotent: false,
};

export const memoryStatsTool: MCPTool = {
  name: 'memory_stats',
  description: 'Get memory storage statistics. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Optional namespace to get stats for' },
      detailed: { type: 'boolean', description: 'Include detailed breakdown by namespace', default: false },
    },
  },
  idempotent: true,
};

export const memoryBulkDeleteTool: MCPTool = {
  name: 'memory_bulk_delete',
  description: 'Delete multiple keys from memory. SIDE EFFECTS: Removes keys from store.',
  inputSchema: {
    type: 'object',
    properties: {
      keys: { type: 'array', description: 'Array of keys to delete', items: { type: 'string' } },
      namespace: { type: 'string', description: 'Namespace for all keys' },
      prefix: { type: 'string', description: 'Delete all keys with this prefix' },
    },
  },
  idempotent: true,
};

export const memoryClearTool: MCPTool = {
  name: 'memory_clear',
  description: 'Clear all memory entries in a namespace. SIDE EFFECTS: Removes all entries. Requires confirm=true.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Namespace to clear (required for safety)' },
      confirm: { type: 'boolean', description: 'Confirmation flag (must be true)' },
    },
    required: ['namespace', 'confirm'],
  },
  idempotent: true,
};

// ============================================================================
// Handlers
// ============================================================================

export const handleMemoryStore: ToolHandler = (args) => {
  const key = args.key as string;
  const value = args.value as Record<string, unknown>;
  const namespace = (args.namespace as string | undefined) ?? 'default';

  try {
    memoryStore.set(getFullKey(namespace, key), { value, storedAt: new Date().toISOString(), namespace });
    return Promise.resolve(successResponse(`Stored key: ${key}`, { key, namespace }));
  } catch (error) {
    return Promise.resolve(errorResponse('STORE_FAILED', error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const handleMemoryRetrieve: ToolHandler = (args) => {
  const key = args.key as string;
  const namespace = (args.namespace as string | undefined) ?? 'default';
  const stored = memoryStore.get(getFullKey(namespace, key));

  if (stored === undefined) {
    return Promise.resolve(successResponse(`Key not found: ${key}`, { found: false, key, namespace }));
  }
  return Promise.resolve(successResponse(`Retrieved key: ${key}`, { found: true, key, namespace, value: stored.value, storedAt: stored.storedAt }));
};

export const handleMemorySearch: ToolHandler = (args) => {
  const query = args.query as string;
  const namespace = args.namespace as string | undefined;
  const limit = (args.limit as number | undefined) ?? 10;

  const results = filterEntries(namespace)
    .filter(e => e.keyPart.includes(query))
    .slice(0, limit)
    .map(e => ({ key: e.keyPart, namespace: e.data.namespace, value: e.data.value, storedAt: e.data.storedAt }));

  return Promise.resolve(successResponse(`Found ${results.length} matches`, { query, namespace: namespace ?? 'all', count: results.length, results }));
};

export const handleMemoryList: ToolHandler = (args) => {
  const namespace = args.namespace as string | undefined;
  const limit = (args.limit as number | undefined) ?? 100;
  const prefix = args.prefix as string | undefined;

  const keys = filterEntries(namespace, prefix)
    .slice(0, limit)
    .map(e => ({ key: e.keyPart, namespace: e.data.namespace, storedAt: e.data.storedAt }));

  return Promise.resolve(successResponse(`Listed ${keys.length} keys`, { keys, total: keys.length, hasMore: memoryStore.size > keys.length }));
};

export const handleMemoryDelete: ToolHandler = (args) => {
  const key = args.key as string;
  const namespace = (args.namespace as string | undefined) ?? 'default';
  const fullKey = getFullKey(namespace, key);
  const existed = memoryStore.delete(fullKey);

  return Promise.resolve(successResponse(existed ? `Deleted key: ${key}` : `Key not found: ${key}`, { deleted: existed, key, namespace }));
};

export const handleMemoryExport: ToolHandler = (args) => {
  const namespace = args.namespace as string | undefined;
  const prefix = args.prefix as string | undefined;
  const includeMetadata = (args.includeMetadata as boolean) ?? true;

  const data = filterEntries(namespace, prefix).map(e => ({
    key: e.keyPart,
    value: e.data.value,
    namespace: e.data.namespace,
    ...(includeMetadata ? { storedAt: e.data.storedAt } : {}),
  }));

  return Promise.resolve(successResponse(`Exported ${data.length} entries`, { count: data.length, exportedAt: new Date().toISOString(), data }));
};

export const handleMemoryImport: ToolHandler = (args) => {
  const data = args.data as { key: string; value: unknown; namespace?: string }[];
  const overwrite = (args.overwrite as boolean) ?? false;
  const defaultNamespace = (args.namespace as string) ?? 'default';

  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const entry of data) {
    const namespace = entry.namespace ?? defaultNamespace;
    const fullKey = getFullKey(namespace, entry.key);

    if (!overwrite && memoryStore.has(fullKey)) {
      skipped++;
      continue;
    }

    try {
      memoryStore.set(fullKey, { value: entry.value, storedAt: new Date().toISOString(), namespace });
      imported++;
    } catch (error) {
      errors.push(`${entry.key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return Promise.resolve(successResponse(`Imported ${imported} entries`, { imported, skipped, errors: errors.length > 0 ? errors : undefined }));
};

export const handleMemoryStats: ToolHandler = (args) => {
  const namespaceFilter = args.namespace as string | undefined;
  const detailed = (args.detailed as boolean) ?? false;

  const stats = new Map<string, { count: number; keys: string[] }>();
  let total = 0;

  for (const { keyPart, data } of filterEntries(namespaceFilter)) {
    total++;
    const existing = stats.get(data.namespace);
    if (existing) {
      existing.count++;
      if (detailed) existing.keys.push(keyPart);
    } else {
      stats.set(data.namespace, { count: 1, keys: detailed ? [keyPart] : [] });
    }
  }

  const byNamespace: Record<string, { count: number; keys?: string[] }> = {};
  for (const [ns, s] of stats) {
    byNamespace[ns] = detailed ? s : { count: s.count };
  }

  return Promise.resolve(successResponse(`${total} entries in ${stats.size} namespaces`, { totalEntries: total, namespaceCount: stats.size, byNamespace }));
};

export const handleMemoryBulkDelete: ToolHandler = (args) => {
  const keys = args.keys as string[] | undefined;
  const namespace = (args.namespace as string) ?? 'default';
  const prefix = args.prefix as string | undefined;

  const deletedKeys: string[] = [];
  let notFound = 0;

  if (keys && keys.length > 0) {
    for (const key of keys) {
      if (memoryStore.delete(getFullKey(namespace, key))) {
        deletedKeys.push(key);
      } else {
        notFound++;
      }
    }
  } else if (prefix) {
    for (const { fullKey, keyPart, data } of filterEntries(namespace, prefix)) {
      if (data.namespace === namespace) {
        memoryStore.delete(fullKey);
        deletedKeys.push(keyPart);
      }
    }
  }

  return Promise.resolve(successResponse(`Deleted ${deletedKeys.length} keys`, { deleted: deletedKeys.length, notFound, deletedKeys, namespace }));
};

export const handleMemoryClear: ToolHandler = (args) => {
  const namespace = args.namespace as string;
  const confirm = args.confirm as boolean;

  if (!confirm) {
    return Promise.resolve(errorResponse('CONFIRMATION_REQUIRED', 'Set confirm=true to clear the namespace', { namespace }));
  }

  const keysToDelete = filterEntries(namespace).map(e => e.fullKey);
  for (const key of keysToDelete) {
    memoryStore.delete(key);
  }

  return Promise.resolve(successResponse(`Cleared ${keysToDelete.length} entries`, { cleared: keysToDelete.length, namespace }));
};
