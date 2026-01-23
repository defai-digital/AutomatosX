/**
 * Semantic Context MCP Tools
 *
 * Provides semantic storage and search capabilities via MCP.
 *
 * Invariants:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 * - INV-SEM-002: Search results sorted by similarity descending
 * - INV-SEM-003: Similarity scores normalized to [0, 1]
 * - INV-SEM-004: Namespace isolation
 */

import type { MCPTool, ToolHandler } from '../types.js';
import { LIMIT_DEFAULT, getErrorMessage } from '@defai.digital/contracts';

/**
 * Semantic store tool definition
 * INV-MCP-004: Idempotent - storing same key/content is safe to retry
 */
export const semanticStoreTool: MCPTool = {
  name: 'semantic_store',
  description: 'Store content with semantic indexing for similarity search. SIDE EFFECTS: Creates/updates entry. Idempotent - storing same key/content produces same result.',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Unique key for the content',
      },
      content: {
        type: 'string',
        description: 'Text content to store and index',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace for organization (default: "default")',
      },
      tags: {
        type: 'array',
        description: 'Optional tags for filtering',
        items: { type: 'string' },
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata to store with content',
      },
      forceRecompute: {
        type: 'boolean',
        description: 'Force recomputation of embedding even if content unchanged',
        default: false,
      },
    },
    required: ['key', 'content'],
  },
  idempotent: true,
  retryableErrors: ['EMBEDDING_FAILED', 'STORE_ERROR'],
};

/**
 * Semantic search tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const semanticSearchTool: MCPTool = {
  name: 'semantic_search',
  description: 'Search for semantically similar content. Returns results ranked by similarity. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query text',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace to search within',
      },
      topK: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        default: 10,
      },
      minSimilarity: {
        type: 'number',
        description: 'Minimum similarity threshold 0-1 (default: 0.7)',
        default: 0.7,
      },
      filterTags: {
        type: 'array',
        description: 'Filter results by tags (all tags must match)',
        items: { type: 'string' },
      },
      includeEmbeddings: {
        type: 'boolean',
        description: 'Include embedding vectors in results',
        default: false,
      },
    },
    required: ['query'],
  },
  idempotent: true,
};

/**
 * Semantic get tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const semanticGetTool: MCPTool = {
  name: 'semantic_get',
  description: 'Get a specific semantic item by key. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key of the item to retrieve',
      },
      namespace: {
        type: 'string',
        description: 'Namespace of the item (default: "default")',
      },
      includeEmbedding: {
        type: 'boolean',
        description: 'Include embedding vector in result',
        default: false,
      },
    },
    required: ['key'],
  },
  idempotent: true,
};

/**
 * Semantic list tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const semanticListTool: MCPTool = {
  name: 'semantic_list',
  description: 'List semantic items with optional filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Namespace to list (default: "default")',
      },
      keyPrefix: {
        type: 'string',
        description: 'Filter by key prefix',
      },
      filterTags: {
        type: 'array',
        description: 'Filter by tags',
        items: { type: 'string' },
      },
      limit: {
        type: 'number',
        description: 'Maximum items to return',
        default: LIMIT_DEFAULT,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
        default: 0,
      },
      orderBy: {
        type: 'string',
        description: 'Order by field',
        enum: ['createdAt', 'updatedAt', 'key'],
        default: 'createdAt',
      },
      orderDir: {
        type: 'string',
        description: 'Order direction',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
  },
  idempotent: true,
};

/**
 * Semantic delete tool definition
 * INV-MCP-004: Idempotent - deleting non-existent key returns deleted=false
 */
export const semanticDeleteTool: MCPTool = {
  name: 'semantic_delete',
  description: 'Delete a semantic item by key. SIDE EFFECTS: Removes item from store. Idempotent - deleting non-existent key returns deleted=false.',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key of the item to delete',
      },
      namespace: {
        type: 'string',
        description: 'Namespace of the item (default: "default")',
      },
    },
    required: ['key'],
  },
  idempotent: true,
};

/**
 * Semantic stats tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const semanticStatsTool: MCPTool = {
  name: 'semantic_stats',
  description: 'Get statistics about semantic storage. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Get stats for specific namespace (optional)',
      },
    },
  },
  idempotent: true,
};

/**
 * Semantic clear tool definition
 */
export const semanticClearTool: MCPTool = {
  name: 'semantic_clear',
  description: 'Clear all semantic items in a namespace. SIDE EFFECTS: Removes all items. Requires confirm=true.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Namespace to clear (required)',
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

// ============================================================================
// In-Memory Implementation
// ============================================================================

import { getSemanticManager } from '../shared-dependencies.js';

/**
 * Handler for semantic_store tool
 * INV-SEM-001: Validates input types before use
 */
export const handleSemanticStore: ToolHandler = async (args) => {
  // INV-SEM-001: Validate required string inputs
  if (typeof args.key !== 'string' || args.key.length === 0) {
    return {
      content: [{ type: 'text', text: 'Error: key must be a non-empty string' }],
      isError: true,
    };
  }
  if (typeof args.content !== 'string') {
    return {
      content: [{ type: 'text', text: 'Error: content must be a string' }],
      isError: true,
    };
  }

  const key = args.key;
  const content = args.content;
  const namespace = typeof args.namespace === 'string' ? args.namespace : undefined;
  const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === 'string') : undefined;
  const metadata = args.metadata !== null && typeof args.metadata === 'object' && !Array.isArray(args.metadata)
    ? args.metadata as Record<string, unknown>
    : undefined;
  const forceRecompute = typeof args.forceRecompute === 'boolean' ? args.forceRecompute : false;

  try {
    const manager = getSemanticManager();
    const storeRequest: Parameters<typeof manager.store>[0] = {
      key,
      content,
      namespace: namespace ?? 'default',
      forceRecompute,
    };
    if (tags) storeRequest.tags = tags;
    if (metadata) storeRequest.metadata = metadata;
    const result = await manager.store(storeRequest);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            key,
            namespace: namespace ?? 'default',
            created: result.created,
            embeddingComputed: result.embeddingComputed,
            embeddingDimension: result.item?.embeddingDimension,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error storing content: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for semantic_search tool
 */
export const handleSemanticSearch: ToolHandler = async (args) => {
  const query = args.query as string;
  const namespace = args.namespace as string | undefined;
  const topK = (args.topK as number) ?? 10;
  const minSimilarity = (args.minSimilarity as number) ?? 0.7;
  const filterTags = args.filterTags as string[] | undefined;
  const includeEmbeddings = (args.includeEmbeddings as boolean) ?? false;

  try {
    const manager = getSemanticManager();
    const searchRequest: Parameters<typeof manager.search>[0] = {
      query,
      topK,
      minSimilarity,
      includeEmbeddings,
      includeMetadata: true,
    };
    if (namespace) searchRequest.namespace = namespace;
    if (filterTags) searchRequest.filterTags = filterTags;
    const result = await manager.search(searchRequest);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            namespace: namespace ?? 'all',
            totalMatches: result.totalMatches,
            durationMs: result.durationMs,
            results: result.results.map((r) => ({
              key: r.item.key,
              namespace: r.item.namespace,
              similarity: r.similarity.toFixed(4),
              rank: r.rank,
              snippet: r.snippet,
              tags: r.item.tags,
              embedding: includeEmbeddings ? r.item.embedding : undefined,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error searching: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for semantic_get tool
 */
export const handleSemanticGet: ToolHandler = async (args) => {
  const key = args.key as string;
  const namespace = (args.namespace as string) ?? 'default';
  const includeEmbedding = (args.includeEmbedding as boolean) ?? false;

  try {
    const manager = getSemanticManager();
    const item = await manager.get(key, namespace);

    if (!item) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              found: false,
              key,
              namespace,
              message: `Item not found: ${namespace}:${key}`,
            }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            found: true,
            key: item.key,
            namespace: item.namespace,
            content: item.content,
            tags: item.tags,
            metadata: item.metadata,
            embeddingDimension: item.embeddingDimension,
            embeddingModel: item.embeddingModel,
            contentHash: item.contentHash,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            embedding: includeEmbedding ? item.embedding : undefined,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting item: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for semantic_list tool
 */
export const handleSemanticList: ToolHandler = async (args) => {
  const namespace = (args.namespace as string) ?? 'default';
  const keyPrefix = args.keyPrefix as string | undefined;
  const filterTags = args.filterTags as string[] | undefined;
  const limit = (args.limit as number) ?? 10;
  const offset = (args.offset as number) ?? 0;
  const orderBy = (args.orderBy as 'createdAt' | 'updatedAt' | 'key') ?? 'createdAt';
  const orderDir = (args.orderDir as 'asc' | 'desc') ?? 'desc';

  try {
    const manager = getSemanticManager();
    const result = await manager.list({
      namespace,
      keyPrefix,
      filterTags,
      limit,
      offset,
      orderBy,
      orderDir,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            namespace,
            total: result.total,
            hasMore: result.hasMore,
            items: result.items.map((item) => ({
              key: item.key,
              contentLength: item.content.length,
              tags: item.tags,
              embeddingDimension: item.embeddingDimension,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing items: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for semantic_delete tool
 */
export const handleSemanticDelete: ToolHandler = async (args) => {
  const key = args.key as string;
  const namespace = (args.namespace as string) ?? 'default';

  try {
    const manager = getSemanticManager();
    const result = await manager.delete(key, namespace);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deleted: result.deleted,
            key,
            namespace,
            message: result.deleted
              ? `Item "${key}" deleted successfully`
              : `Item "${key}" not found in namespace "${namespace}"`,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error deleting item: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for semantic_stats tool
 */
export const handleSemanticStats: ToolHandler = async (args) => {
  const namespace = args.namespace as string | undefined;

  try {
    const manager = getSemanticManager();
    const stats = await manager.getStats(namespace);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalItems: stats.totalItems,
            itemsWithEmbeddings: stats.itemsWithEmbeddings,
            embeddingDimension: stats.embeddingDimension,
            embeddingModel: stats.embeddingModel,
            namespace: stats.namespace,
            namespaces: stats.namespaces,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting stats: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for semantic_clear tool
 */
export const handleSemanticClear: ToolHandler = async (args) => {
  const namespace = args.namespace as string;
  const confirm = args.confirm as boolean;

  if (!confirm) {
    return {
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
    };
  }

  try {
    const manager = getSemanticManager();
    const cleared = await manager.clear(namespace);

    return {
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
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error clearing namespace: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};
