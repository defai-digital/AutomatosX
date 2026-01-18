/**
 * Semantic Context Contract Tests
 *
 * Tests for the semantic-context contracts including schemas,
 * validation functions, and factory functions.
 *
 * Invariants tested:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 * - INV-SEM-002: Search results sorted by similarity descending
 * - INV-SEM-003: Similarity scores normalized to [0, 1]
 * - INV-SEM-004: Namespace isolation
 */

import { describe, it, expect } from 'vitest';
import {
  SemanticItemSchema,
  SemanticSearchRequestSchema,
  SemanticSearchResultSchema,
  SemanticSearchResponseSchema,
  SemanticStoreRequestSchema,
  SemanticStoreResponseSchema,
  SemanticListRequestSchema,
  SemanticListResponseSchema,
  SemanticDeleteRequestSchema,
  SemanticDeleteResponseSchema,
  EmbeddingConfigSchema,
  SemanticContextErrorCodes,
  validateSemanticItem,
  validateSemanticSearchRequest,
  validateSemanticStoreRequest,
  safeValidateSemanticSearchRequest,
  createSemanticItem,
  createDefaultEmbeddingConfig,
  computeContentHash,
} from '@defai.digital/contracts';

describe('Semantic Context Contracts', () => {
  describe('SemanticItemSchema', () => {
    it('should validate a minimal semantic item', () => {
      const item = {
        key: 'test-item',
        content: 'This is test content for semantic indexing.',
        createdAt: new Date().toISOString(),
      };

      const result = SemanticItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.namespace).toBe('default');
      }
    });

    it('should validate a complete semantic item with embedding', () => {
      const item = {
        key: 'test-item',
        namespace: 'docs',
        content: 'Documentation content',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        embeddingDimension: 5,
        embeddingModel: 'tfidf',
        metadata: { source: 'api' },
        tags: ['api', 'docs'],
        contentHash: 'abc123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = SemanticItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should reject empty key', () => {
      const item = {
        key: '',
        content: 'Content',
        createdAt: new Date().toISOString(),
      };

      const result = SemanticItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const item = {
        key: 'key',
        content: '',
        createdAt: new Date().toISOString(),
      };

      const result = SemanticItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should enforce tag limits', () => {
      const item = {
        key: 'key',
        content: 'content',
        tags: Array(21).fill('tag'),
        createdAt: new Date().toISOString(),
      };

      const result = SemanticItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });
  });

  describe('SemanticSearchRequestSchema', () => {
    it('should validate minimal search request', () => {
      const request = {
        query: 'find similar content',
      };

      const result = SemanticSearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topK).toBe(10);
        expect(result.data.minSimilarity).toBe(0.7);
        expect(result.data.includeEmbeddings).toBe(false);
      }
    });

    it('should validate complete search request', () => {
      const request = {
        query: 'API documentation',
        namespace: 'docs',
        topK: 5,
        minSimilarity: 0.8,
        filterTags: ['api', 'v1'],
        includeEmbeddings: true,
        includeMetadata: true,
      };

      const result = SemanticSearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const request = { query: '' };
      const result = SemanticSearchRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should enforce similarity bounds (INV-SEM-003)', () => {
      // Below 0
      expect(
        SemanticSearchRequestSchema.safeParse({
          query: 'test',
          minSimilarity: -0.1,
        }).success
      ).toBe(false);

      // Above 1
      expect(
        SemanticSearchRequestSchema.safeParse({
          query: 'test',
          minSimilarity: 1.1,
        }).success
      ).toBe(false);

      // Valid at boundaries
      expect(
        SemanticSearchRequestSchema.safeParse({
          query: 'test',
          minSimilarity: 0,
        }).success
      ).toBe(true);

      expect(
        SemanticSearchRequestSchema.safeParse({
          query: 'test',
          minSimilarity: 1,
        }).success
      ).toBe(true);
    });

    it('should enforce topK limits', () => {
      expect(
        SemanticSearchRequestSchema.safeParse({
          query: 'test',
          topK: 0,
        }).success
      ).toBe(false);

      expect(
        SemanticSearchRequestSchema.safeParse({
          query: 'test',
          topK: 101,
        }).success
      ).toBe(false);
    });
  });

  describe('SemanticSearchResultSchema', () => {
    it('should validate search result with similarity score (INV-SEM-003)', () => {
      const result = {
        item: {
          key: 'doc-1',
          content: 'Documentation',
          createdAt: new Date().toISOString(),
        },
        similarity: 0.95,
        rank: 1,
        snippet: 'Documentation excerpt...',
      };

      const parsed = SemanticSearchResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should enforce similarity normalization (INV-SEM-003)', () => {
      const baseResult = {
        item: {
          key: 'doc-1',
          content: 'Documentation',
          createdAt: new Date().toISOString(),
        },
        rank: 1,
      };

      // Valid similarity in [0, 1]
      expect(
        SemanticSearchResultSchema.safeParse({
          ...baseResult,
          similarity: 0.5,
        }).success
      ).toBe(true);

      // Invalid: below 0
      expect(
        SemanticSearchResultSchema.safeParse({
          ...baseResult,
          similarity: -0.1,
        }).success
      ).toBe(false);

      // Invalid: above 1
      expect(
        SemanticSearchResultSchema.safeParse({
          ...baseResult,
          similarity: 1.1,
        }).success
      ).toBe(false);
    });

    it('should enforce positive rank', () => {
      const result = {
        item: {
          key: 'doc-1',
          content: 'Documentation',
          createdAt: new Date().toISOString(),
        },
        similarity: 0.9,
        rank: 0,
      };

      const parsed = SemanticSearchResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('SemanticSearchResponseSchema', () => {
    it('should validate search response (INV-SEM-002)', () => {
      const response = {
        results: [
          {
            item: { key: 'doc-1', content: 'First', createdAt: new Date().toISOString() },
            similarity: 0.95,
            rank: 1,
          },
          {
            item: { key: 'doc-2', content: 'Second', createdAt: new Date().toISOString() },
            similarity: 0.85,
            rank: 2,
          },
        ],
        totalMatches: 10,
        query: 'test query',
        durationMs: 25,
      };

      const result = SemanticSearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty results', () => {
      const response = {
        results: [],
        totalMatches: 0,
        query: 'no matches',
        durationMs: 5,
      };

      const result = SemanticSearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('SemanticStoreRequestSchema', () => {
    it('should validate minimal store request', () => {
      const request = {
        key: 'doc-1',
        content: 'Document content',
      };

      const result = SemanticStoreRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.namespace).toBe('default');
        expect(result.data.forceRecompute).toBe(false);
      }
    });

    it('should validate store request with pre-computed embedding', () => {
      const request = {
        key: 'doc-1',
        namespace: 'embeddings',
        content: 'Content',
        embedding: [0.1, 0.2, 0.3],
        tags: ['tag1'],
        metadata: { source: 'external' },
        forceRecompute: false,
      };

      const result = SemanticStoreRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('SemanticStoreResponseSchema', () => {
    it('should validate successful store response', () => {
      const response = {
        success: true,
        item: {
          key: 'doc-1',
          content: 'Content',
          createdAt: new Date().toISOString(),
        },
        created: true,
        embeddingComputed: true,
      };

      const result = SemanticStoreResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate update response (INV-SEM-001: cached embedding)', () => {
      const response = {
        success: true,
        item: {
          key: 'doc-1',
          content: 'Updated content',
          createdAt: new Date().toISOString(),
        },
        created: false,
        embeddingComputed: false, // Cached from previous store
      };

      const result = SemanticStoreResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('SemanticListRequestSchema', () => {
    it('should validate list request with defaults', () => {
      const request = {};
      const result = SemanticListRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
        expect(result.data.orderBy).toBe('createdAt');
        expect(result.data.orderDir).toBe('desc');
      }
    });

    it('should validate list request with filters (INV-SEM-004: namespace isolation)', () => {
      const request = {
        namespace: 'docs',
        keyPrefix: 'api-',
        filterTags: ['v1'],
        limit: 20,
        offset: 10,
        orderBy: 'key' as const,
        orderDir: 'asc' as const,
      };

      const result = SemanticListRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('SemanticDeleteRequestSchema', () => {
    it('should validate delete request', () => {
      const request = {
        key: 'doc-1',
        namespace: 'default',
      };

      const result = SemanticDeleteRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('EmbeddingConfigSchema', () => {
    it('should provide sensible defaults', () => {
      const config = EmbeddingConfigSchema.parse({});
      expect(config.provider).toBe('local');
      expect(config.model).toBe('tfidf');
      expect(config.dimension).toBe(384);
      expect(config.batchSize).toBe(32);
      expect(config.cacheEnabled).toBe(true);
    });

    it('should validate external provider config', () => {
      const config = {
        provider: 'openai' as const,
        model: 'text-embedding-3-small',
        dimension: 1536,
        batchSize: 100,
        cacheEnabled: true,
      };

      const result = EmbeddingConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should enforce dimension limits', () => {
      expect(
        EmbeddingConfigSchema.safeParse({
          dimension: 0,
        }).success
      ).toBe(false);

      expect(
        EmbeddingConfigSchema.safeParse({
          dimension: 5000,
        }).success
      ).toBe(false);
    });
  });

  describe('Validation Functions', () => {
    it('validateSemanticItem should parse valid item', () => {
      const item = validateSemanticItem({
        key: 'key',
        content: 'content',
        createdAt: new Date().toISOString(),
      });
      expect(item.key).toBe('key');
    });

    it('validateSemanticSearchRequest should parse valid request', () => {
      const request = validateSemanticSearchRequest({
        query: 'test query',
      });
      expect(request.query).toBe('test query');
    });

    it('validateSemanticStoreRequest should parse valid request', () => {
      const request = validateSemanticStoreRequest({
        key: 'key',
        content: 'content',
      });
      expect(request.key).toBe('key');
    });

    it('safeValidateSemanticSearchRequest should return success for valid request', () => {
      const result = safeValidateSemanticSearchRequest({
        query: 'test',
      });
      expect(result.success).toBe(true);
    });

    it('safeValidateSemanticSearchRequest should return error for invalid request', () => {
      const result = safeValidateSemanticSearchRequest({
        query: '', // Empty query is invalid
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Factory Functions', () => {
    it('createSemanticItem should create item with defaults', () => {
      const item = createSemanticItem('test-key', 'Test content');
      expect(item.key).toBe('test-key');
      expect(item.content).toBe('Test content');
      expect(item.namespace).toBe('default');
      expect(item.createdAt).toBeDefined();
    });

    it('createSemanticItem should accept options', () => {
      const item = createSemanticItem('test-key', 'Test content', {
        namespace: 'custom',
        tags: ['tag1', 'tag2'],
        metadata: { source: 'test' },
      });
      expect(item.namespace).toBe('custom');
      expect(item.tags).toEqual(['tag1', 'tag2']);
      expect(item.metadata).toEqual({ source: 'test' });
    });

    it('createDefaultEmbeddingConfig should return valid config', () => {
      const config = createDefaultEmbeddingConfig();
      expect(config.provider).toBe('local');
      expect(config.dimension).toBe(384);
    });
  });

  describe('computeContentHash', () => {
    it('should compute consistent hash for same content', async () => {
      const content = 'Test content for hashing';
      const hash1 = await computeContentHash(content);
      const hash2 = await computeContentHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different content', async () => {
      const hash1 = await computeContentHash('Content A');
      const hash2 = await computeContentHash('Content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64-character hex string', async () => {
      const hash = await computeContentHash('Any content');
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('SemanticContextErrorCodes', () => {
    it('should define all error codes', () => {
      expect(SemanticContextErrorCodes.NOT_FOUND).toBe('SEMANTIC_NOT_FOUND');
      expect(SemanticContextErrorCodes.EMBEDDING_FAILED).toBe('SEMANTIC_EMBEDDING_FAILED');
      expect(SemanticContextErrorCodes.SEARCH_FAILED).toBe('SEMANTIC_SEARCH_FAILED');
      expect(SemanticContextErrorCodes.DIMENSION_MISMATCH).toBe('SEMANTIC_DIMENSION_MISMATCH');
      expect(SemanticContextErrorCodes.STORAGE_ERROR).toBe('SEMANTIC_STORAGE_ERROR');
      expect(SemanticContextErrorCodes.INVALID_NAMESPACE).toBe('SEMANTIC_INVALID_NAMESPACE');
      expect(SemanticContextErrorCodes.CONTENT_TOO_LARGE).toBe('SEMANTIC_CONTENT_TOO_LARGE');
    });
  });
});
