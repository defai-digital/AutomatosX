# Phase 1 Week 6 Plan - Go Parser & Performance Caching

**Status**: Planned 📋
**Timeline**: Week 6 of P1 (Days 1-5)
**Date**: 2025-11-06
**Goal**: Add Go language support + Implement LRU caching for queries

---

## Week 6 Overview

### Primary Objectives
1. **Go Parser Integration** (Days 1-2) - Add tree-sitter-go parser with struct/interface support
2. **LRU Query Cache** (Days 3-4) - Implement caching to reduce duplicate searches
3. **Batch Indexing** (Day 5) - Optimize write performance with batch operations

### Success Metrics
- Go symbol extraction accuracy > 95%
- Cache hit rate > 60% for repeated queries
- Indexing throughput > 100 files/second (2x faster than current)
- Query latency reduced by 50% for cached queries
- All existing functionality maintained (no regressions)

---

## Day 1: Go Parser - Part 1 (Setup & Basic Symbols)

**Goal**: Install tree-sitter-go and extract basic Go symbols (func, struct, interface)

### Tasks

#### 1. Install Dependencies (15 min)
```bash
npm install tree-sitter-go@^0.21.0
```

**package.json**:
```json
{
  "dependencies": {
    "tree-sitter": "^0.21.1",
    "tree-sitter-typescript": "^0.23.2",
    "tree-sitter-python": "^0.21.0",
    "tree-sitter-go": "^0.21.0"
  }
}
```

#### 2. Create GoParserService (3 hours)
**Objective**: Implement Go parser extending BaseLanguageParser

**Implementation**:
```typescript
// src/parser/GoParserService.ts

import Parser from 'tree-sitter';
import Go from 'tree-sitter-go';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * GoParserService - Extracts symbols from Go source code
 */
export class GoParserService extends BaseLanguageParser {
  readonly language = 'go';
  readonly extensions = ['.go'];

  constructor() {
    super(Go);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
        return this.extractFunction(node);

      case 'method_declaration':
        return this.extractMethod(node);

      case 'type_declaration':
        return this.extractTypeDeclaration(node);

      case 'const_declaration':
        return this.extractConstDeclaration(node);

      case 'var_declaration':
        return this.extractVarDeclaration(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   * Example: func main() { ... }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract method declaration with receiver
   * Example: func (r *Receiver) Method() { ... }
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'method');
  }

  /**
   * Extract type declarations (struct, interface, alias)
   * Example:
   *   type User struct { ... }
   *   type Handler interface { ... }
   *   type UserID int
   */
  private extractTypeDeclaration(node: Parser.SyntaxNode): Symbol | null {
    // type_declaration has a type_spec child
    const typeSpec = node.childForFieldName('type_spec');
    if (!typeSpec) return null;

    const name = this.getFieldText(typeSpec, 'name');
    if (!name) return null;

    // Determine if it's a struct, interface, or type alias
    const typeNode = typeSpec.childForFieldName('type');
    if (!typeNode) {
      return this.createSymbol(typeSpec, name, 'type');
    }

    switch (typeNode.type) {
      case 'struct_type':
        return this.createSymbol(typeSpec, name, 'struct');

      case 'interface_type':
        return this.createSymbol(typeSpec, name, 'interface');

      default:
        return this.createSymbol(typeSpec, name, 'type');
    }
  }

  /**
   * Extract const declarations
   * Example:
   *   const MaxRetries = 3
   *   const (
   *     StatusOK = 200
   *     StatusError = 500
   *   )
   */
  private extractConstDeclaration(node: Parser.SyntaxNode): Symbol | null {
    // const_declaration can have multiple const_spec children
    const symbols: Symbol[] = [];
    const specs = node.descendantsOfType('const_spec');

    for (const spec of specs) {
      const name = this.getFieldText(spec, 'name');
      if (name) {
        symbols.push(this.createSymbol(spec, name, 'constant'));
      }
    }

    // Return first symbol (others will be collected via walkTree)
    return symbols.length > 0 ? symbols[0] : null;
  }

  /**
   * Extract var declarations
   * Example: var config Config
   */
  private extractVarDeclaration(node: Parser.SyntaxNode): Symbol | null {
    const specs = node.descendantsOfType('var_spec');

    for (const spec of specs) {
      const name = this.getFieldText(spec, 'name');
      if (name) {
        return this.createSymbol(spec, name, 'variable');
      }
    }

    return null;
  }
}
```

#### 3. Register Go Parser (15 min)
**Update ParserRegistry**:
```typescript
// src/parser/ParserRegistry.ts

import { GoParserService } from './GoParserService.js';

export class ParserRegistry {
  private registerDefaultParsers(): void {
    this.registerParser(new TypeScriptParserService());
    this.registerParser(new PythonParserService());
    this.registerParser(new GoParserService()); // NEW
  }
}
```

#### 4. Basic Tests (1.5 hours)
**Create test file**:
```typescript
// src/parser/__tests__/GoParserService.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { GoParserService } from '../GoParserService.js';

describe('GoParserService', () => {
  let parser: GoParserService;

  beforeEach(() => {
    parser = new GoParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('go');
    });

    it('should support Go file extensions', () => {
      expect(parser.extensions).toEqual(['.go']);
    });
  });

  describe('function parsing', () => {
    it('should extract function declarations', () => {
      const code = `
package main

func main() {
    println("Hello")
}

func helper(x int) string {
    return "test"
}
`;

      const result = parser.parse(code);
      expect(result.symbols).toHaveLength(2);

      const funcNames = result.symbols.map(s => s.name);
      expect(funcNames).toContain('main');
      expect(funcNames).toContain('helper');

      result.symbols.forEach(s => {
        expect(s.kind).toBe('function');
      });
    });
  });

  describe('struct parsing', () => {
    it('should extract struct type declarations', () => {
      const code = `
package models

type User struct {
    Name  string
    Email string
}

type Product struct {
    ID    int
    Price float64
}
`;

      const result = parser.parse(code);
      expect(result.symbols).toHaveLength(2);

      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs).toHaveLength(2);

      const structNames = structs.map(s => s.name);
      expect(structNames).toContain('User');
      expect(structNames).toContain('Product');
    });
  });

  describe('interface parsing', () => {
    it('should extract interface declarations', () => {
      const code = `
package services

type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}
`;

      const result = parser.parse(code);
      expect(result.symbols).toHaveLength(2);

      const interfaces = result.symbols.filter(s => s.kind === 'interface');
      expect(interfaces).toHaveLength(2);

      const interfaceNames = interfaces.map(s => s.name);
      expect(interfaceNames).toContain('Reader');
      expect(interfaceNames).toContain('Writer');
    });
  });
});
```

**Success Criteria**:
- ✅ tree-sitter-go installed
- ✅ GoParserService extracts functions, structs, interfaces
- ✅ Basic tests passing (10+ tests)
- ✅ Build successful

---

## Day 2: Go Parser - Part 2 (Methods & Constants)

**Goal**: Complete Go parser with methods, constants, and comprehensive tests

### Tasks

#### 1. Method Parsing Tests (1.5 hours)
```typescript
describe('method parsing', () => {
  it('should extract methods with receivers', () => {
    const code = `
package models

type User struct {
    Name string
}

func (u *User) GetName() string {
    return u.Name
}

func (u User) Validate() bool {
    return len(u.Name) > 0
}
`;

    const result = parser.parse(code);

    const methods = result.symbols.filter(s => s.kind === 'method');
    expect(methods).toHaveLength(2);

    const methodNames = methods.map(s => s.name);
    expect(methodNames).toContain('GetName');
    expect(methodNames).toContain('Validate');
  });
});
```

#### 2. Constant Parsing Tests (1 hour)
```typescript
describe('constant parsing', () => {
  it('should extract const declarations', () => {
    const code = `
package config

const MaxRetries = 3

const (
    StatusOK    = 200
    StatusError = 500
)
`;

    const result = parser.parse(code);

    const constants = result.symbols.filter(s => s.kind === 'constant');
    expect(constants).toHaveLength(3);

    const constNames = constants.map(s => s.name);
    expect(constNames).toContain('MaxRetries');
    expect(constNames).toContain('StatusOK');
    expect(constNames).toContain('StatusError');
  });
});
```

#### 3. Complex Go Code Test (1.5 hours)
```typescript
describe('complex Go code', () => {
  it('should handle real-world Go code', () => {
    const code = `
package main

import (
    "fmt"
    "net/http"
)

type Server struct {
    Port int
}

func NewServer(port int) *Server {
    return &Server{Port: port}
}

func (s *Server) Start() error {
    return http.ListenAndServe(fmt.Sprintf(":%d", s.Port), nil)
}

type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}

const DefaultPort = 8080
`;

    const result = parser.parse(code);

    // Should extract: Server struct, NewServer function, Start method, Handler interface, DefaultPort constant
    expect(result.symbols.length).toBeGreaterThanOrEqual(5);

    const structs = result.symbols.filter(s => s.kind === 'struct');
    const functions = result.symbols.filter(s => s.kind === 'function');
    const methods = result.symbols.filter(s => s.kind === 'method');
    const interfaces = result.symbols.filter(s => s.kind === 'interface');
    const constants = result.symbols.filter(s => s.kind === 'constant');

    expect(structs.some(s => s.name === 'Server')).toBe(true);
    expect(functions.some(s => s.name === 'NewServer')).toBe(true);
    expect(methods.some(s => s.name === 'Start')).toBe(true);
    expect(interfaces.some(s => s.name === 'Handler')).toBe(true);
    expect(constants.some(s => s.name === 'DefaultPort')).toBe(true);
  });
});
```

#### 4. End-to-End Integration Test (1.5 hours)
```typescript
// src/services/__tests__/FileService-Go.test.ts

import { describe, it, expect } from 'vitest';
import { FileService } from '../FileService.js';

let counter = 0;
const u = (name: string) => `/test-go-${Date.now()}-${++counter}-${name}`;

describe('FileService - Go Integration', () => {
  const fileService = new FileService();

  it('should index Go file with structs and methods', () => {
    const code = `
package main

type Calculator struct {
    value int
}

func (c *Calculator) Add(x int) {
    c.value += x
}

func NewCalculator() *Calculator {
    return &Calculator{}
}
`;

    const filePath = u('calc.go');
    const result = fileService.indexFile(filePath, code);

    expect(result.symbolCount).toBe(3); // Calculator struct, Add method, NewCalculator function

    const file = fileService.getFileWithSymbols(filePath);
    expect(file).not.toBeNull();
    expect(file!.language).toBe('go');

    const symbolNames = file!.symbols.map(s => s.name);
    expect(symbolNames).toContain('Calculator');
    expect(symbolNames).toContain('Add');
    expect(symbolNames).toContain('NewCalculator');
  });

  it('should index multi-language project (TS + Python + Go)', () => {
    const tsCode = 'export class TSClass {}';
    const pyCode = 'class PyClass:\n    pass';
    const goCode = 'package main\n\ntype GoStruct struct {}';

    fileService.indexFile(u('file.ts'), tsCode);
    fileService.indexFile(u('file.py'), pyCode);
    fileService.indexFile(u('file.go'), goCode);

    const stats = fileService.getStats();

    // Should have symbols from all 3 languages
    expect(stats.totalSymbols).toBeGreaterThanOrEqual(3);
  });
});
```

**Success Criteria**:
- ✅ Go parser handles methods with receivers
- ✅ Go parser extracts constants and variables
- ✅ Comprehensive tests (20+ Go parser tests)
- ✅ End-to-end integration working
- ✅ 3 languages fully supported (TS, Python, Go)

---

## Day 3: LRU Cache - Part 1 (Implementation)

**Goal**: Implement LRU cache for query results

### Tasks

#### 1. Research & Design (30 min)
**Decision**: Use `lru-cache` npm package (battle-tested, 50M+ downloads/week)

**Install**:
```bash
npm install lru-cache@^10.0.0
npm install --save-dev @types/lru-cache
```

**Alternative**: Could implement custom LRU, but `lru-cache` provides:
- TTL (time-to-live) support
- Size-based eviction
- Automatic cleanup
- Well-tested edge cases

#### 2. Create QueryCache Class (2.5 hours)
```typescript
// src/cache/QueryCache.ts

import { LRUCache } from 'lru-cache';
import { UnifiedSearchResult, QueryFilters } from '../types/index.js';

export interface CacheEntry {
  results: UnifiedSearchResult[];
  timestamp: number;
  hitCount: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * LRU cache for query results
 * Reduces duplicate searches and improves performance
 */
export class QueryCache {
  private cache: LRUCache<string, CacheEntry>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(options?: {
    maxSize?: number;
    ttl?: number; // milliseconds
  }) {
    const maxSize = options?.maxSize || 1000;
    const ttl = options?.ttl || 300000; // 5 minutes default

    this.cache = new LRUCache<string, CacheEntry>({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true, // Reset TTL on access
      dispose: () => {
        this.stats.evictions++;
      },
    });

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Generate cache key from query and filters
   */
  private getCacheKey(query: string, filters?: QueryFilters): string {
    const filterKey = filters ? JSON.stringify(filters) : '';
    return `${query}|${filterKey}`;
  }

  /**
   * Get cached results
   */
  get(query: string, filters?: QueryFilters): UnifiedSearchResult[] | null {
    const key = this.getCacheKey(query, filters);
    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;
      entry.hitCount++;
      return entry.results;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store results in cache
   */
  set(
    query: string,
    results: UnifiedSearchResult[],
    filters?: QueryFilters
  ): void {
    const key = this.getCacheKey(query, filters);

    const entry: CacheEntry = {
      results,
      timestamp: Date.now(),
      hitCount: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache entries for a specific file
   * Call this when a file is modified/reindexed
   */
  invalidateFile(filePath: string): number {
    let invalidatedCount = 0;

    // Iterate through cache and remove entries with matching file
    for (const [key, entry] of this.cache.entries()) {
      if (entry.results.some(r => r.file_path === filePath)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }
}
```

#### 3. Integrate Cache into FileService (2 hours)
```typescript
// src/services/FileService.ts

import { QueryCache } from '../cache/QueryCache.js';

export class FileService {
  private queryCache: QueryCache;

  constructor(options?: { cacheEnabled?: boolean }) {
    // ... existing code
    this.queryCache = new QueryCache({
      maxSize: 1000,
      ttl: 300000, // 5 minutes
    });
  }

  /**
   * Search with caching
   */
  search(query: string, limit: number = 10, forceIntent?: QueryIntent): SearchResponse {
    const startTime = performance.now();

    // Parse filters
    const parsed = this.filterParser.parse(query);

    // Check cache first
    const cachedResults = this.queryCache.get(parsed.searchTerms, parsed.filters);
    if (cachedResults) {
      return {
        results: cachedResults.slice(0, limit),
        query: parsed.searchTerms,
        filters: parsed.filters,
        intent: QueryIntent.SYMBOL, // Cached, don't reanalyze
        analysis: { intent: QueryIntent.SYMBOL, confidence: 1.0 },
        totalResults: cachedResults.length,
        searchTime: performance.now() - startTime,
        cached: true, // NEW field
      };
    }

    // Execute search (not cached)
    const analysis = this.queryRouter.analyze(parsed.searchTerms);
    const intent = forceIntent || analysis.intent;

    let results: UnifiedSearchResult[];
    // ... existing search logic

    // Store in cache
    this.queryCache.set(parsed.searchTerms, results, parsed.filters);

    const endTime = performance.now();

    return {
      results,
      query: parsed.searchTerms,
      filters: parsed.filters,
      intent,
      analysis,
      totalResults: results.length,
      searchTime: endTime - startTime,
      cached: false,
    };
  }

  /**
   * Index file with cache invalidation
   */
  indexFile(path: string, content: string): IndexResult {
    // Invalidate cache entries for this file
    this.queryCache.invalidateFile(path);

    // ... existing indexing logic
  }

  /**
   * Re-index file with cache invalidation
   */
  reindexFile(path: string, content: string): IndexResult {
    // Invalidate cache entries for this file
    this.queryCache.invalidateFile(path);

    // ... existing reindexing logic
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.queryCache.getStats();
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }
}
```

**Success Criteria**:
- ✅ lru-cache installed and configured
- ✅ QueryCache class implemented
- ✅ Cache integrated into FileService
- ✅ Cache invalidation on file changes

---

## Day 4: LRU Cache - Part 2 (Testing & Optimization)

**Goal**: Test cache behavior and optimize performance

### Tasks

#### 1. Cache Unit Tests (2.5 hours)
```typescript
// src/cache/__tests__/QueryCache.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryCache } from '../QueryCache.js';

describe('QueryCache', () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = new QueryCache({ maxSize: 3, ttl: 1000 });
  });

  describe('basic operations', () => {
    it('should cache and retrieve results', () => {
      const results = [{ type: 'symbol', file_path: 'test.ts', line: 1, score: 1.0 }];

      cache.set('test query', results);
      const cached = cache.get('test query');

      expect(cached).toEqual(results);
    });

    it('should return null for cache miss', () => {
      const cached = cache.get('nonexistent query');
      expect(cached).toBeNull();
    });

    it('should handle query with filters', () => {
      const results = [{ type: 'symbol', file_path: 'test.ts', line: 1, score: 1.0 }];
      const filters = { languages: ['typescript'] };

      cache.set('test', results, filters);

      // Same query, same filters = hit
      expect(cache.get('test', filters)).toEqual(results);

      // Same query, different filters = miss
      expect(cache.get('test', { languages: ['python'] })).toBeNull();

      // Same query, no filters = miss
      expect(cache.get('test')).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries', () => {
      cache.set('query1', []);
      cache.set('query2', []);
      cache.set('query3', []);

      // Cache is full (max: 3)
      // Add query4, should evict query1
      cache.set('query4', []);

      expect(cache.get('query1')).toBeNull(); // Evicted
      expect(cache.get('query2')).not.toBeNull();
      expect(cache.get('query3')).not.toBeNull();
      expect(cache.get('query4')).not.toBeNull();
    });

    it('should update LRU on access', () => {
      cache.set('query1', []);
      cache.set('query2', []);
      cache.set('query3', []);

      // Access query1 to make it most recent
      cache.get('query1');

      // Add query4, should evict query2 (least recent)
      cache.set('query4', []);

      expect(cache.get('query1')).not.toBeNull(); // Still cached
      expect(cache.get('query2')).toBeNull(); // Evicted
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new QueryCache({ maxSize: 10, ttl: 50 }); // 50ms TTL

      shortCache.set('test', []);
      expect(shortCache.get('test')).not.toBeNull();

      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortCache.get('test')).toBeNull();
    });
  });

  describe('file invalidation', () => {
    it('should invalidate cache entries for modified file', () => {
      const results1 = [{ type: 'symbol', file_path: 'file1.ts', line: 1, score: 1.0 }];
      const results2 = [{ type: 'symbol', file_path: 'file2.ts', line: 1, score: 1.0 }];

      cache.set('query1', results1);
      cache.set('query2', results2);

      // Invalidate file1.ts
      const invalidated = cache.invalidateFile('file1.ts');

      expect(invalidated).toBe(1);
      expect(cache.get('query1')).toBeNull(); // Invalidated
      expect(cache.get('query2')).not.toBeNull(); // Still cached
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', () => {
      cache.set('query1', []);

      cache.get('query1'); // Hit
      cache.get('query1'); // Hit
      cache.get('query2'); // Miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });

    it('should track evictions', () => {
      cache.set('query1', []);
      cache.set('query2', []);
      cache.set('query3', []);
      cache.set('query4', []); // Evicts query1

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('cache clear', () => {
    it('should clear all cache entries', () => {
      cache.set('query1', []);
      cache.set('query2', []);

      cache.clear();

      expect(cache.get('query1')).toBeNull();
      expect(cache.get('query2')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });
});
```

#### 2. Cache Integration Tests (1.5 hours)
```typescript
// src/services/__tests__/FileService-Cache.test.ts

describe('FileService - Cache Integration', () => {
  const fileService = new FileService();

  it('should cache search results', () => {
    fileService.indexFile(u('test.ts'), 'function myFunc() {}');

    // First search - miss
    const result1 = fileService.search('myFunc');
    expect(result1.cached).toBe(false);

    // Second search - hit
    const result2 = fileService.search('myFunc');
    expect(result2.cached).toBe(true);
    expect(result2.searchTime).toBeLessThan(result1.searchTime);
  });

  it('should invalidate cache on file reindex', () => {
    const path = u('test.ts');
    fileService.indexFile(path, 'function oldFunc() {}');

    // Cache the search
    fileService.search('oldFunc');

    // Reindex file
    fileService.reindexFile(path, 'function newFunc() {}');

    // Old search should be cache miss
    const result = fileService.search('oldFunc');
    expect(result.cached).toBe(false);
  });

  it('should achieve > 60% cache hit rate on repeated queries', () => {
    fileService.indexFile(u('test.ts'), 'function test() {}');

    // Perform 10 searches (1 unique, 9 repeats)
    fileService.search('test'); // Miss
    for (let i = 0; i < 9; i++) {
      fileService.search('test'); // Hits
    }

    const stats = fileService.getCacheStats();
    expect(stats.hitRate).toBeGreaterThan(0.6);
  });
});
```

#### 3. Performance Benchmarks (1.5 hours)
```typescript
// src/benchmarks/cache-performance.bench.ts

import { describe, bench } from 'vitest';
import { FileService } from '../services/FileService.js';

describe('Cache Performance', () => {
  const fileService = new FileService();

  // Index sample data
  for (let i = 0; i < 100; i++) {
    fileService.indexFile(
      `/bench-${i}.ts`,
      `function func${i}() { return ${i}; }`
    );
  }

  bench('search without cache (first query)', () => {
    fileService.clearCache();
    fileService.search('func50');
  });

  bench('search with cache (repeated query)', () => {
    fileService.search('func50'); // Cached
  });

  bench('cache invalidation', () => {
    fileService.reindexFile('/bench-50.ts', 'function func50_new() {}');
  });
});
```

#### 4. Cache Configuration (30 min)
**Add to config schema**:
```typescript
// src/types/schemas/config.ts

export const SearchConfigSchema = z.object({
  cacheEnabled: z.boolean().default(true),
  cacheSize: z.number().min(100).max(10000).default(1000),
  cacheTTL: z.number().min(10000).max(3600000).default(300000), // 5 min default
  // ... existing fields
});
```

**Success Criteria**:
- ✅ 15+ cache tests passing
- ✅ Cache hit rate > 60% on repeated queries
- ✅ Cached queries 50%+ faster than uncached
- ✅ Cache invalidation working correctly
- ✅ Performance benchmarks showing improvement

---

## Day 5: Batch Indexing Optimization

**Goal**: Implement batch insert operations for 2x indexing speedup

### Tasks

#### 1. Update DAOs for Batch Insert (2 hours)
```typescript
// src/database/dao/SymbolDAO.ts

export class SymbolDAO {
  /**
   * Batch insert symbols (optimized)
   */
  insertBatch(symbols: SymbolInput[]): number[] {
    if (symbols.length === 0) return [];

    const db = getDatabase();

    // Use single prepared statement for all inserts
    const stmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, line, column, end_line, end_column)
      VALUES (@file_id, @name, @kind, @line, @column, @end_line, @end_column)
    `);

    const ids: number[] = [];

    // Batch insert in transaction
    const insertMany = db.transaction((items: SymbolInput[]) => {
      for (const symbol of items) {
        const result = stmt.run(symbol);
        ids.push(result.lastInsertRowid as number);
      }
    });

    insertMany(symbols);

    return ids;
  }
}
```

Similar updates for ChunkDAO.

#### 2. Benchmark Batch vs Individual Inserts (1 hour)
```typescript
// src/benchmarks/batch-insert.bench.ts

describe('Batch Insert Performance', () => {
  bench('individual inserts (100 symbols)', () => {
    for (let i = 0; i < 100; i++) {
      symbolDAO.insert({ /* ... */ });
    }
  });

  bench('batch insert (100 symbols)', () => {
    const symbols = Array.from({ length: 100 }, (_, i) => ({ /* ... */ }));
    symbolDAO.insertBatch(symbols);
  });
});
```

#### 3. Integration & Testing (1.5 hours)
- Test batch insert correctness
- Verify transaction rollback on errors
- Measure throughput improvement

#### 4. Documentation & Cleanup (30 min)
- Update README with Week 6 achievements
- Document cache usage
- Add performance metrics

**Success Criteria**:
- ✅ Batch inserts 2x faster than individual
- ✅ Indexing throughput > 100 files/second
- ✅ All batch insert tests passing
- ✅ No regressions in existing functionality

---

## Week 6 Deliverables

### Code (15 new files)
1. `src/parser/GoParserService.ts` - Go parser
2. `src/parser/__tests__/GoParserService.test.ts` - Go parser tests
3. `src/services/__tests__/FileService-Go.test.ts` - Go integration tests
4. `src/cache/QueryCache.ts` - LRU cache implementation
5. `src/cache/__tests__/QueryCache.test.ts` - Cache tests
6. `src/services/__tests__/FileService-Cache.test.ts` - Cache integration tests
7. `src/benchmarks/cache-performance.bench.ts` - Cache benchmarks
8. `src/benchmarks/batch-insert.bench.ts` - Batch insert benchmarks

### Tests
- 20+ Go parser tests
- 15+ cache tests
- 5+ integration tests
- 2+ benchmark suites
- **Target: 117 → 155+ total tests**

### Performance Improvements
- Go language support (3 languages total)
- Cache hit rate > 60%
- Query latency reduced 50% (cached)
- Indexing throughput 2x faster (batch inserts)

---

## Success Metrics

| Metric | P0 Baseline | Week 5 Target | Week 6 Target | Measurement |
|--------|-------------|---------------|---------------|-------------|
| Supported languages | 1 (TS/JS) | 2 (+ Python) | 3 (+ Go) | Parser count |
| Query cache hit rate | N/A | N/A | > 60% | Cache stats |
| Cached query latency | N/A | N/A | 50% reduction | Benchmark |
| Indexing throughput | ~40 files/sec | ~40 files/sec | > 100 files/sec | Throughput test |
| Test coverage | ~75% | ~80% | ~85% | Vitest coverage |

---

## Risk Mitigation

### Medium Risks
1. **Go parser complexity** - Go has unique features (receivers, goroutines)
   - Mitigation: Focus on core symbols first (func, struct, interface)
   - Defer advanced features (goroutines, channels) to P1.1

2. **Cache memory usage** - Large caches could consume significant memory
   - Mitigation: Default 1000 entries (~10MB), configurable max size
   - LRU eviction prevents unbounded growth

3. **Cache invalidation bugs** - Stale cache could return wrong results
   - Mitigation: Conservative invalidation (entire file), comprehensive tests
   - Clear cache on any error

### Low Risks
1. **LRU library bugs** - lru-cache is well-tested
2. **Performance regression** - Continuous benchmarking catches issues

---

## Week 7 Preview

### Rust Parser & Config Enhancements
- tree-sitter-rust integration
- Rust-specific symbols (impl, trait, mod)
- Enhanced configuration validation
- Config init command (`ax config init`)

**Preparation**:
- Research tree-sitter-rust AST structure
- Study Rust symbol resolution patterns
- Plan config CLI commands

---

## Daily Execution Checklist

### Day 1
- [ ] Install tree-sitter-go
- [ ] Implement GoParserService (func, struct, interface)
- [ ] Write 10+ basic tests
- [ ] All tests passing

### Day 2
- [ ] Add method and constant parsing
- [ ] Write 10+ advanced tests
- [ ] Create end-to-end Go integration test
- [ ] Verify 3-language support

### Day 3
- [ ] Install lru-cache
- [ ] Implement QueryCache class
- [ ] Integrate cache into FileService
- [ ] Test cache hit/miss behavior

### Day 4
- [ ] Write 15+ cache tests
- [ ] Test cache invalidation
- [ ] Run performance benchmarks
- [ ] Verify > 60% hit rate

### Day 5
- [ ] Implement batch insert for DAOs
- [ ] Benchmark batch vs individual
- [ ] Verify 2x throughput improvement
- [ ] Update documentation

---

**Total Estimated Time**: ~20 hours over 5 days
**Expected Test Count**: 155+ tests (82 current + 50 Week 5 + 40 Week 6)
**Expected Outcome**: 3 languages, query caching, 2x faster indexing
