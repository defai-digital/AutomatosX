# Semantic Context Invariants

## Overview

This document defines the behavioral invariants for the Semantic Context domain.
These invariants MUST be enforced by all implementations.

## Invariant Categories

- `001-099`: Storage invariants
- `100-199`: Search invariants
- `200-299`: Embedding invariants

---

## INV-SEM-001: Embedding Caching

**Category**: Storage

**Statement**: Embeddings MUST be computed on store and cached until content changes.

**Rationale**: Embedding computation is expensive; caching reduces latency and costs.

**Enforcement**:
- Content hash computed and stored with item
- On update, compare content hash
- Only recompute embedding if hash differs or `forceRecompute=true`

**Test Scenarios**:
1. Store item → embedding computed once
2. Update with same content → embedding not recomputed
3. Update with new content → embedding recomputed
4. `forceRecompute=true` → embedding always recomputed

---

## INV-SEM-002: Search Result Ordering

**Category**: Search

**Statement**: Search results MUST be sorted by similarity score in descending order.

**Rationale**: Most relevant results should appear first for efficient retrieval.

**Enforcement**:
- Sort results by similarity before returning
- Assign rank based on sorted position
- Verify ordering in contract tests

**Test Scenarios**:
1. Search returns results → ordered by similarity descending
2. Equal similarity → secondary sort by recency
3. Rank field matches sorted position

---

## INV-SEM-003: Similarity Score Normalization

**Category**: Search

**Statement**: Similarity scores MUST be normalized to the [0, 1] range.

**Rationale**: Consistent scoring enables threshold-based filtering and comparison.

**Enforcement**:
- Normalize raw similarity scores before returning
- 0 = no similarity, 1 = exact match
- minSimilarity filter applied after normalization

**Normalization Methods**:
- Cosine similarity: Already in [-1, 1], map to [0, 1] via `(score + 1) / 2`
- Dot product: Divide by max possible value
- Euclidean: Convert distance to similarity via `1 / (1 + distance)`

**Test Scenarios**:
1. All returned scores in [0, 1] range
2. Identical content → similarity = 1.0
3. Completely unrelated → similarity near 0

---

## INV-SEM-004: Namespace Isolation

**Category**: Storage

**Statement**: Items in different namespaces MUST be completely isolated.

**Rationale**: Enables multi-tenant usage and context separation.

**Enforcement**:
- All operations scoped to namespace
- Search never returns cross-namespace results
- Delete only affects specified namespace

**Test Scenarios**:
1. Store in namespace A → not visible in namespace B search
2. Delete in namespace A → namespace B items unaffected
3. List in namespace A → only returns namespace A items

---

## INV-SEM-100: Search Latency

**Category**: Search

**Statement**: Search operations SHOULD complete within 500ms for typical queries.

**Rationale**: Real-time usage requires low latency.

**Guidance** (not strict enforcement):
- Use approximate nearest neighbor (ANN) for large datasets
- Index optimization for frequently searched namespaces
- Consider query caching for repeated searches

---

## INV-SEM-101: Empty Query Handling

**Category**: Search

**Statement**: Empty or whitespace-only queries MUST return an error, not empty results.

**Rationale**: Prevents accidental full-table scans and clarifies intent.

**Enforcement**:
- Validate query string before search
- Return validation error for empty queries
- Trim whitespace before length check

---

## INV-SEM-200: Embedding Dimension Consistency

**Category**: Embedding

**Statement**: All embeddings in a namespace MUST have the same dimension.

**Rationale**: Similarity computation requires equal dimensions.

**Enforcement**:
- Store embedding dimension with namespace config
- Validate incoming embeddings against config
- Error if dimension mismatch

**Test Scenarios**:
1. First item sets dimension → subsequent items must match
2. Pre-computed embedding with wrong dimension → error

---

## INV-SEM-201: Embedding Model Consistency

**Category**: Embedding

**Statement**: Embeddings computed with different models MUST NOT be mixed in the same namespace.

**Rationale**: Different models have incompatible vector spaces.

**Enforcement**:
- Track embedding model per namespace
- Warn or error on model mismatch
- Allow explicit namespace migration

---

## Compliance Verification

All implementations must pass the contract test suite at:
`tests/contract/semantic-context.test.ts`

Test coverage requirements:
- Each invariant has at least one dedicated test
- Edge cases for boundary conditions
- Performance tests for latency guidance
