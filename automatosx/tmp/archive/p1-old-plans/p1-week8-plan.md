# Phase 1 Week 8: Semantic Reranking & ML Integration

**Duration**: 5 days
**Status**: Planned
**Prerequisites**: Week 7 complete (4 languages, config system, query filters)
**Created**: 2025-11-06

---

## Executive Summary

Week 8 introduces **semantic search** capabilities to enhance code intelligence with ML-powered reranking. This builds on the existing BM25 full-text search by adding embedding-based similarity scoring for more contextually relevant results.

**Key Deliverables**:
- ML library integration (@xenova/transformers)
- Embedding generation service for code chunks
- Hybrid scoring: BM25 + semantic similarity
- Optional `--semantic` flag for enhanced search
- Performance optimizations (batching, caching)

**Test Growth**: 202 → 225 tests (+23 new tests)
**Performance Target**: Semantic search < 200ms (with embedding cache)

---

## Day 1: ML Library Setup & Embedding Service (5 hours)

### Goals
- Research and select ML model for code embeddings
- Install and configure @xenova/transformers
- Create EmbeddingService for generating vector embeddings
- Write basic embedding tests

### Technical Details

**Model Selection**:
- **Primary**: `Xenova/all-MiniLM-L6-v2` (384-dim, 80MB)
  - Fast inference (< 50ms per chunk)
  - Good balance of size/performance
  - Widely used for semantic similarity
- **Alternative**: `Xenova/codebert-base` (768-dim, code-specific)

**Architecture**:
```typescript
// src/services/EmbeddingService.ts
export class EmbeddingService {
  private pipeline: Pipeline | null = null;
  private model: string = 'Xenova/all-MiniLM-L6-v2';

  async initialize(): Promise<void> {
    // Lazy load model on first use
    this.pipeline = await pipeline('feature-extraction', this.model);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Generate 384-dim embedding vector
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    // Batch processing for efficiency
  }

  cosineSimilarity(a: number[], b: number[]): number {
    // Calculate similarity score (0-1)
  }
}
```

### Dependencies
```bash
npm install @xenova/transformers
# Model auto-downloaded on first use (~80MB)
```

### Database Schema Changes
```sql
-- Add embedding column to chunks table (migration 004)
ALTER TABLE chunks ADD COLUMN embedding BLOB;
CREATE INDEX idx_chunks_embedding ON chunks(embedding) WHERE embedding IS NOT NULL;
```

### Tests (8 tests)
1. **EmbeddingService initialization**
   - Should load model successfully
   - Should cache model after first load
   - Should handle model loading errors

2. **Embedding generation**
   - Should generate 384-dim vector for text
   - Should generate consistent embeddings for same text
   - Should handle empty text gracefully

3. **Batch processing**
   - Should generate embeddings for batch of texts
   - Should be faster than individual calls (> 2x speedup)

### Deliverables
- `src/services/EmbeddingService.ts` (150 lines)
- `src/services/__tests__/EmbeddingService.test.ts` (8 tests)
- `src/database/migrations/004_add_embeddings.sql`
- Updated `ChunkDAO` with embedding storage support

### Time Breakdown
- Research & model selection: 1 hour
- EmbeddingService implementation: 2 hours
- Database migration: 1 hour
- Tests & validation: 1 hour

---

## Day 2: Embedding Generation Pipeline (5 hours)

### Goals
- Create background job for generating embeddings
- Update indexing pipeline to generate embeddings
- Add embedding cache to avoid recomputation
- Benchmark embedding generation performance

### Technical Details

**Embedding Generation Flow**:
```typescript
// src/services/EmbeddingPipeline.ts
export class EmbeddingPipeline {
  private embeddingService: EmbeddingService;
  private chunkDAO: ChunkDAO;
  private cache: LRUCache<string, number[]>;

  async generateForFile(fileId: number): Promise<number> {
    // Get all chunks for file
    // Generate embeddings in batches
    // Store in database
    // Return count of embeddings generated
  }

  async generateForChunk(chunkId: number): Promise<void> {
    // Generate single embedding
    // Store in database
    // Update cache
  }

  async reindexAll(batchSize: number = 50): Promise<void> {
    // Background job to generate all missing embeddings
    // Progress reporting
  }
}
```

**Integration with FileService**:
```typescript
// Updated FileService.indexFile()
indexFile(filePath: string, content: string): IndexResult {
  // ... existing indexing logic ...

  // Generate embeddings for chunks (async, non-blocking)
  if (config.embeddings.enabled) {
    this.embeddingPipeline.generateForFile(fileId).catch(console.error);
  }

  return result;
}
```

### Configuration
```json
// .axrc.json
{
  "embeddings": {
    "enabled": true,
    "model": "Xenova/all-MiniLM-L6-v2",
    "batchSize": 50,
    "cacheSize": 1000,
    "generateOnIndex": true
  }
}
```

### Tests (6 tests)
1. **Pipeline generation**
   - Should generate embeddings for all chunks in file
   - Should batch process chunks efficiently
   - Should skip chunks with existing embeddings

2. **Cache behavior**
   - Should cache embeddings after generation
   - Should retrieve from cache on subsequent calls
   - Should respect cache size limit

3. **Error handling**
   - Should handle ML model errors gracefully
   - Should continue processing on individual chunk failures

### Deliverables
- `src/services/EmbeddingPipeline.ts` (200 lines)
- `src/services/__tests__/EmbeddingPipeline.test.ts` (6 tests)
- Updated `FileService` with embedding generation
- Configuration schema updates

### Performance Targets
- Embedding generation: < 50ms per chunk
- Batch processing: > 2x faster than individual (< 25ms per chunk)
- Cache hit rate: > 70%

### Time Breakdown
- Pipeline implementation: 2 hours
- FileService integration: 1 hour
- Cache optimization: 1 hour
- Tests & benchmarks: 1 hour

---

## Day 3: Semantic Search Implementation (5 hours)

### Goals
- Implement semantic similarity search
- Create hybrid scoring (BM25 + semantic)
- Add `--semantic` flag to CLI/API
- Write semantic search tests

### Technical Details

**Semantic Search Flow**:
```typescript
// src/services/SemanticSearch.ts
export class SemanticSearch {
  private embeddingService: EmbeddingService;
  private chunkDAO: ChunkDAO;

  async search(
    query: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<SemanticSearchResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // 2. Get all chunks with embeddings
    const chunks = await this.chunkDAO.findWithEmbeddings();

    // 3. Calculate cosine similarity for each chunk
    const scored = chunks.map(chunk => ({
      ...chunk,
      similarity: this.embeddingService.cosineSimilarity(
        queryEmbedding,
        chunk.embedding
      )
    }));

    // 4. Filter by threshold and sort
    return scored
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}
```

**Hybrid Scoring**:
```typescript
// src/services/HybridSearch.ts
export class HybridSearch {
  private chunkDAO: ChunkDAO;
  private semanticSearch: SemanticSearch;

  async search(
    query: string,
    limit: number = 10,
    semanticWeight: number = 0.5 // 0 = BM25 only, 1 = semantic only
  ): Promise<HybridSearchResult[]> {
    // 1. BM25 search (fast, keyword-based)
    const bm25Results = await this.chunkDAO.search(query, limit * 2);

    // 2. Semantic search (contextual, slower)
    const semanticResults = await this.semanticSearch.search(query, limit * 2);

    // 3. Combine and rerank
    const combined = this.mergeResults(bm25Results, semanticResults);
    const reranked = combined.map(result => ({
      ...result,
      hybridScore:
        (1 - semanticWeight) * result.bm25Score +
        semanticWeight * result.semanticScore
    }));

    // 4. Sort by hybrid score
    return reranked
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);
  }
}
```

**FileService Integration**:
```typescript
// Add semantic search intent
enum SearchIntent {
  SYMBOL = 'symbol',
  NATURAL = 'natural',
  HYBRID = 'hybrid',
  SEMANTIC = 'semantic' // NEW
}

// Update search method
search(
  query: string,
  limit: number = 10,
  options: SearchOptions = {}
): SearchResponse {
  const { forceIntent, semantic = false, semanticWeight = 0.5 } = options;

  if (semantic) {
    return this.executeSemanticSearch(query, limit, semanticWeight);
  }

  // ... existing logic ...
}
```

### Tests (5 tests)
1. **Semantic search**
   - Should find semantically similar chunks
   - Should rank by cosine similarity
   - Should respect similarity threshold

2. **Hybrid search**
   - Should combine BM25 and semantic scores
   - Should weight scores correctly
   - Should deduplicate results

3. **Integration**
   - Should work with filters (lang:, kind:)
   - Should handle missing embeddings gracefully

### Deliverables
- `src/services/SemanticSearch.ts` (150 lines)
- `src/services/HybridSearch.ts` (200 lines)
- `src/services/__tests__/SemanticSearch.test.ts` (5 tests)
- Updated `FileService` with semantic search support

### Time Breakdown
- Semantic search implementation: 2 hours
- Hybrid scoring: 1.5 hours
- FileService integration: 0.5 hour
- Tests: 1 hour

---

## Day 4: Performance Optimization & Caching (4 hours)

### Goals
- Optimize embedding storage and retrieval
- Add embedding cache with LRU eviction
- Implement approximate nearest neighbor (ANN) search
- Benchmark performance improvements

### Technical Details

**Embedding Cache**:
```typescript
// src/cache/EmbeddingCache.ts
export class EmbeddingCache {
  private cache: LRUCache<number, number[]>; // chunkId -> embedding
  private queryCache: LRUCache<string, number[]>; // query -> embedding

  constructor(maxSize: number = 10000) {
    this.cache = new LRUCache({ max: maxSize });
    this.queryCache = new LRUCache({ max: 1000 });
  }

  getChunkEmbedding(chunkId: number): number[] | null;
  setChunkEmbedding(chunkId: number, embedding: number[]): void;

  getQueryEmbedding(query: string): number[] | null;
  setQueryEmbedding(query: string, embedding: number[]): void;

  invalidateChunk(chunkId: number): void;
  getStats(): CacheStats;
}
```

**Optimized Similarity Calculation**:
```typescript
// Use SIMD-like optimizations
function cosineSimilarityOptimized(a: number[], b: number[]): number {
  // Pre-computed norms for faster calculation
  // Unrolled loops for better performance
  // Early termination for low similarity
}
```

**Approximate Nearest Neighbor (Optional)**:
```typescript
// For large codebases (> 10K chunks), use ANN index
// Library: hnswlib-node or faiss
// Trade-off: ~95% accuracy for 10x speed

export class ANNIndex {
  private index: HNSWIndex;

  async build(embeddings: number[][]): Promise<void>;
  async search(query: number[], k: number): Promise<number[]>;
}
```

### Tests (4 tests)
1. **Embedding cache**
   - Should cache and retrieve embeddings
   - Should evict LRU entries
   - Should track hit/miss stats

2. **Performance**
   - Should improve query time by > 50% with cache
   - Similarity calculation should be < 1ms per comparison

### Deliverables
- `src/cache/EmbeddingCache.ts` (150 lines)
- `src/cache/__tests__/EmbeddingCache.test.ts` (4 tests)
- Optimized similarity functions
- Performance benchmarks

### Performance Targets
- Cached embedding retrieval: < 1ms
- Cache hit rate: > 70%
- Semantic search with cache: < 100ms (vs 200ms uncached)

### Time Breakdown
- Cache implementation: 1.5 hours
- Similarity optimization: 1 hour
- Benchmarking: 1 hour
- Tests: 0.5 hour

---

## Day 5: CLI Integration & Documentation (4 hours)

### Goals
- Add `--semantic` flag to search commands
- Create semantic search examples
- Write documentation for semantic features
- Integration tests for CLI

### Technical Details

**CLI Updates**:
```typescript
// src/cli/commands/search.ts
export const searchCommand = {
  command: 'search <query>',
  describe: 'Search code with optional semantic ranking',
  builder: (yargs) => {
    return yargs
      .positional('query', { type: 'string', describe: 'Search query' })
      .option('semantic', {
        type: 'boolean',
        default: false,
        describe: 'Enable semantic search (ML-powered)'
      })
      .option('semantic-weight', {
        type: 'number',
        default: 0.5,
        describe: 'Weight for semantic vs BM25 (0-1)'
      })
      .option('limit', {
        type: 'number',
        default: 10,
        describe: 'Maximum results'
      });
  },
  handler: async (argv) => {
    const fileService = new FileService();
    const result = await fileService.search(argv.query, argv.limit, {
      semantic: argv.semantic,
      semanticWeight: argv.semanticWeight
    });

    // Display results with scores
    console.log(`Found ${result.totalResults} results (${result.searchTime}ms)`);
    if (argv.semantic) {
      console.log(`Semantic search enabled (weight: ${argv.semanticWeight})`);
    }

    result.results.forEach(r => {
      console.log(`${r.file_path}:${r.line} (score: ${r.score.toFixed(3)})`);
      if (r.semanticScore) {
        console.log(`  BM25: ${r.bm25Score.toFixed(3)}, Semantic: ${r.semanticScore.toFixed(3)}`);
      }
    });
  }
};
```

**Example Usage**:
```bash
# Standard search (BM25 only)
ax search "authentication"

# Semantic search
ax search "authentication" --semantic

# Hybrid search with custom weight
ax search "authentication" --semantic --semantic-weight 0.7

# With filters
ax search "auth lang:typescript kind:function" --semantic
```

### Documentation

**File**: `docs/semantic-search-guide.md`

Topics:
1. What is semantic search?
2. When to use semantic vs keyword search
3. Performance considerations
4. Configuration options
5. Examples and best practices

**File**: `docs/embeddings-architecture.md`

Topics:
1. ML model selection
2. Embedding generation pipeline
3. Storage and caching strategy
4. Hybrid scoring algorithm

### Tests (0 tests - manual CLI testing)
- Manual verification of CLI flags
- Integration test with real codebase
- Performance testing with large repos

### Deliverables
- Updated CLI with `--semantic` flag
- `docs/semantic-search-guide.md`
- `docs/embeddings-architecture.md`
- Updated README with semantic search examples

### Time Breakdown
- CLI updates: 1 hour
- Documentation: 2 hours
- Testing & examples: 1 hour

---

## Cumulative Progress Tracking

### Test Count Evolution
| Milestone | Tests | Cumulative | Pass Rate |
|-----------|-------|------------|-----------|
| Week 7 End | - | 202 | 100% |
| Week 8 Day 1 | +8 | 210 | Target: 100% |
| Week 8 Day 2 | +6 | 216 | Target: 100% |
| Week 8 Day 3 | +5 | 221 | Target: 100% |
| Week 8 Day 4 | +4 | 225 | Target: 100% |
| Week 8 Day 5 | +0 | 225 | Target: 100% |

### Feature Progression
| Week | Major Features |
|------|----------------|
| Week 7 | 4 languages, config system, query filters |
| Week 8 | ML embeddings, semantic search, hybrid scoring |

### Performance Evolution
| Metric | Week 7 | Week 8 Target |
|--------|--------|---------------|
| Query latency (P95) | < 5ms | < 100ms (semantic), < 5ms (BM25) |
| Cache hit rate | > 60% | > 70% (embeddings) |
| Search accuracy | BM25 baseline | +20% with semantic |

---

## File Deliverables Summary

### New Files (12 files)
1. `src/services/EmbeddingService.ts` - ML model wrapper
2. `src/services/__tests__/EmbeddingService.test.ts` - 8 tests
3. `src/services/EmbeddingPipeline.ts` - Background embedding generation
4. `src/services/__tests__/EmbeddingPipeline.test.ts` - 6 tests
5. `src/services/SemanticSearch.ts` - Semantic similarity search
6. `src/services/HybridSearch.ts` - Hybrid BM25+semantic
7. `src/services/__tests__/SemanticSearch.test.ts` - 5 tests
8. `src/cache/EmbeddingCache.ts` - LRU cache for embeddings
9. `src/cache/__tests__/EmbeddingCache.test.ts` - 4 tests
10. `src/database/migrations/004_add_embeddings.sql` - Database schema
11. `docs/semantic-search-guide.md` - User documentation
12. `docs/embeddings-architecture.md` - Technical documentation

### Modified Files (5 files)
1. `src/services/FileService.ts` - Semantic search integration
2. `src/database/dao/ChunkDAO.ts` - Embedding storage methods
3. `src/types/schemas/config.ts` - Embedding config schema
4. `src/cli/commands/search.ts` - Add --semantic flag
5. `README.md` - Semantic search examples

---

## Dependencies & Prerequisites

### External Dependencies
```bash
npm install @xenova/transformers@^2.6.0
# Optional: hnswlib-node for ANN (if needed)
```

**Model Download**: ~80MB on first use (Xenova/all-MiniLM-L6-v2)

### Internal Prerequisites
- ✅ Week 7 complete (config system, 4 languages)
- ✅ ChunkDAO with FTS5 search
- ✅ FileService with unified search
- ✅ LRU cache implementation (Week 6)

---

## Success Criteria

### Functional Requirements
- [ ] Embedding generation for all indexed chunks
- [ ] Semantic search returns contextually relevant results
- [ ] Hybrid scoring combines BM25 and semantic scores correctly
- [ ] CLI `--semantic` flag works end-to-end
- [ ] All 225 tests passing

### Performance Requirements
- [ ] Embedding generation: < 50ms per chunk
- [ ] Semantic search (cached): < 100ms
- [ ] Semantic search (uncached): < 200ms
- [ ] Cache hit rate: > 70%

### Quality Requirements
- [ ] Semantic search improves relevance by 20%+ (user study)
- [ ] No regression in BM25 search performance
- [ ] Graceful fallback when ML model unavailable
- [ ] Clear documentation with examples

---

## Risk Register

### High Priority Risks
**None identified** - Semantic search is optional feature

### Medium Priority Risks

1. **Model download size (80MB)**
   - Impact: High (slow first-time setup)
   - Likelihood: High
   - Mitigation:
     - Document expected download
     - Provide offline model option
     - Cache model in npm package (if licensing allows)

2. **Embedding generation performance**
   - Impact: High (slow indexing)
   - Likelihood: Medium
   - Mitigation:
     - Background processing
     - Batch optimization
     - User can disable embeddings

3. **Memory usage for large codebases**
   - Impact: Medium
   - Likelihood: Medium
   - Mitigation:
     - LRU cache with configurable size
     - Option to store embeddings on disk only
     - ANN index for very large repos (> 10K chunks)

### Low Priority Risks
- ML model accuracy for code (mitigated by hybrid approach)
- Breaking changes in @xenova/transformers (pin version)
- Cross-platform model loading issues (well-tested library)

---

## Performance Targets Summary

### Embedding Generation
| Operation | Target | Notes |
|-----------|--------|-------|
| Single chunk | < 50ms | With model loaded |
| Batch (50 chunks) | < 25ms/chunk | 2x speedup |
| Model loading | < 2s | First use only |

### Search Performance
| Search Type | Target | Notes |
|-------------|--------|-------|
| BM25 only | < 5ms | No change |
| Semantic (cached) | < 100ms | With embedding cache |
| Semantic (uncached) | < 200ms | Generate query embedding |
| Hybrid | < 150ms | Combined approach |

### Storage
| Metric | Target | Notes |
|--------|--------|-------|
| Embedding size | 1.5KB/chunk | 384 floats × 4 bytes |
| Cache memory | < 50MB | 10K embeddings |
| Database growth | +30% | For 1K chunks |

---

## Next Steps (Immediate Actions)

### Ready to Execute
**Current Status**: Week 7 ✅ Complete

**Next Task**: Week 8 Day 1 - ML Library Setup
1. Research model options (Xenova/all-MiniLM-L6-v2 vs codebert)
2. Install @xenova/transformers
3. Create EmbeddingService class
4. Write 8 embedding tests
5. Estimated time: 5 hours

**Command to Start**:
```bash
# Install ML library
npm install @xenova/transformers

# Verify installation
node -e "import('@xenova/transformers').then(console.log)"

# Start Day 1 implementation
# 1. Create EmbeddingService.ts
# 2. Initialize model pipeline
# 3. Implement embedding generation
```

---

## Alternative Approaches Considered

### Model Selection
**Considered**:
1. ✅ **Xenova/all-MiniLM-L6-v2** (selected)
   - Pros: Fast, small, general-purpose
   - Cons: Not code-specific

2. Xenova/codebert-base
   - Pros: Trained on code
   - Cons: 2x larger, slower

3. OpenAI embeddings API
   - Pros: State-of-art quality
   - Cons: Requires API key, cost, network latency

**Decision**: Start with all-MiniLM-L6-v2, add codebert as config option

### Storage Strategy
**Considered**:
1. ✅ **SQLite BLOB column** (selected)
   - Pros: Simple, integrated
   - Cons: Limited vector operations

2. Separate vector database (Pinecone, Weaviate)
   - Pros: Optimized for vectors
   - Cons: Extra dependency, complexity

3. File-based storage (JSON/binary)
   - Pros: Simple
   - Cons: Slow, hard to query

**Decision**: SQLite BLOB for MVP, ANN index for scale

---

## Long-term Roadmap Preview

### Week 9 (Progress UI & Compression)
- Progress bars with ETA for embedding generation
- LZ4 chunk compression
- Enhanced error messages
- Terminal UI improvements

### Week 10 (Optimization & Polish)
- Parallel indexing with workers
- Query optimization
- Documentation & examples
- P1 completion

---

## Key Decisions & Trade-offs

### Technical Decisions
1. **Client-side ML vs API**: Client-side for privacy and cost
2. **Hybrid scoring default**: Combine BM25 + semantic for best results
3. **Optional feature**: Semantic search opt-in, doesn't break existing workflows
4. **Model size**: Prioritize speed over accuracy (384-dim vs 768-dim)

### Performance Trade-offs
1. **Embedding generation**: Async/background to not block indexing
2. **Cache size**: Default 10K embeddings (~50MB) vs unlimited
3. **Similarity calculation**: Exact cosine vs approximate (ANN) for large repos

### Feature Prioritization
1. **Week 8 (P1.1)**: Core semantic search
2. **Week 9 (P1.1)**: UI/UX improvements
3. **Week 10 (P1.1)**: Polish and optimization
4. **P2**: Cross-language semantic search, fine-tuned models

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Status**: Planning Complete, Ready for Execution
**Prerequisites**: Week 7 completion (4 languages, config system)
**Next Review**: End of Week 8
