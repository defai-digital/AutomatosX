/**
 * Semantic Context Domain Tests
 *
 * Tests for the semantic-context domain including:
 * - Embedding service
 * - Similarity computation
 * - Semantic manager
 * - In-memory store
 *
 * Invariants tested:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 * - INV-SEM-002: Search results sorted by similarity descending
 * - INV-SEM-003: Similarity scores normalized to [0, 1]
 * - INV-SEM-004: Namespace isolation
 * - INV-SEM-200: Consistent dimension within namespace
 */
export {};
//# sourceMappingURL=semantic-context.test.d.ts.map