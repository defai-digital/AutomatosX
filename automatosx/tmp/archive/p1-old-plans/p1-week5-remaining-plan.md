# Phase 1 Week 5 - Remaining Days Plan

**Status**: Days 1-2 Completed ✅ | Days 3-5 Planned 📋
**Date**: 2025-11-06
**Goal**: Complete Multi-Language Foundation with Query Filters & Configuration

---

## Days 1-2 COMPLETED ✅

### Achievements
- ✅ Python parser with Tree-sitter integration
- ✅ Unified LanguageParser interface (TypeScript + Python)
- ✅ ParserRegistry for automatic language detection
- ✅ FileService integration with auto-detection
- ✅ 17 Python parser tests + 3 end-to-end tests
- ✅ **82/82 tests passing (100%)**

### Deliverables
- `src/parser/LanguageParser.ts` - Base interface
- `src/parser/PythonParserService.ts` - Python parser
- `src/parser/TypeScriptParserService.ts` - Refactored TS parser
- `src/parser/ParserRegistry.ts` - Multi-language registry
- `src/services/FileService.ts` - Updated to use registry

---

## Day 3: Query Filter Parser (Part 1)

**Goal**: Implement filter syntax parsing for `lang:`, `kind:`, `file:` filters

### Tasks

#### 1. Design Filter Grammar (1 hour)
**Objective**: Define the query filter syntax specification

**Grammar**:
```
query       := filter* search_term+
filter      := lang_filter | kind_filter | file_filter | negation
lang_filter := "lang:" language_name
kind_filter := "kind:" symbol_kind
file_filter := "file:" file_pattern
negation    := "-" filter

Examples:
  lang:python kind:function auth
  file:src/services/ -kind:test database
  lang:typescript kind:class User -file:test/
```

**Deliverables**:
- `docs/query-filter-syntax.md` - Specification document
- ADR for filter design decisions

**Code**:
```typescript
// src/types/QueryFilter.ts
export interface QueryFilters {
  languages?: string[];        // lang:python, lang:typescript
  kinds?: string[];            // kind:function, kind:class
  filePatterns?: string[];     // file:src/services/
  excludeLanguages?: string[]; // -lang:test
  excludeKinds?: string[];     // -kind:test
  excludeFiles?: string[];     // -file:node_modules/
}

export interface ParsedQuery {
  filters: QueryFilters;
  searchTerms: string;  // Remaining text after filters extracted
}
```

#### 2. Implement QueryFilterParser (3 hours)
**Objective**: Create parser to extract filters from query strings

**Implementation**:
```typescript
// src/services/QueryFilterParser.ts

export class QueryFilterParser {
  /**
   * Parse query string into filters and search terms
   *
   * Example:
   *   Input:  "lang:python kind:function authenticate user"
   *   Output: {
   *     filters: { languages: ['python'], kinds: ['function'] },
   *     searchTerms: "authenticate user"
   *   }
   */
  parse(query: string): ParsedQuery {
    const filters: QueryFilters = {
      languages: [],
      kinds: [],
      filePatterns: [],
      excludeLanguages: [],
      excludeKinds: [],
      excludeFiles: []
    };

    // Regex patterns
    const langPattern = /lang:(\w+)/g;
    const kindPattern = /kind:(\w+)/g;
    const filePattern = /file:([\w\/\.\*]+)/g;
    const negLangPattern = /-lang:(\w+)/g;
    const negKindPattern = /-kind:(\w+)/g;
    const negFilePattern = /-file:([\w\/\.\*]+)/g;

    // Extract filters
    let match;
    let remainingQuery = query;

    // Positive filters
    while ((match = langPattern.exec(query)) !== null) {
      filters.languages!.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    while ((match = kindPattern.exec(query)) !== null) {
      filters.kinds!.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    while ((match = filePattern.exec(query)) !== null) {
      filters.filePatterns!.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Negative filters
    while ((match = negLangPattern.exec(query)) !== null) {
      filters.excludeLanguages!.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    while ((match = negKindPattern.exec(query)) !== null) {
      filters.excludeKinds!.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    while ((match = negFilePattern.exec(query)) !== null) {
      filters.excludeFiles!.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Clean empty arrays
    Object.keys(filters).forEach(key => {
      if (Array.isArray(filters[key]) && filters[key].length === 0) {
        delete filters[key];
      }
    });

    return {
      filters,
      searchTerms: remainingQuery.trim()
    };
  }

  /**
   * Validate filter values
   */
  validate(filters: QueryFilters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate languages
    const validLanguages = ['typescript', 'javascript', 'python'];
    filters.languages?.forEach(lang => {
      if (!validLanguages.includes(lang.toLowerCase())) {
        errors.push(`Invalid language: ${lang}. Valid: ${validLanguages.join(', ')}`);
      }
    });

    // Validate kinds
    const validKinds = ['function', 'class', 'method', 'interface', 'type', 'variable', 'constant', 'enum'];
    filters.kinds?.forEach(kind => {
      if (!validKinds.includes(kind.toLowerCase())) {
        errors.push(`Invalid kind: ${kind}. Valid: ${validKinds.join(', ')}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

**Tests**:
```typescript
// src/services/__tests__/QueryFilterParser.test.ts

describe('QueryFilterParser', () => {
  let parser: QueryFilterParser;

  beforeEach(() => {
    parser = new QueryFilterParser();
  });

  it('should parse language filter', () => {
    const result = parser.parse('lang:python authenticate user');
    expect(result.filters.languages).toEqual(['python']);
    expect(result.searchTerms).toBe('authenticate user');
  });

  it('should parse multiple filters', () => {
    const result = parser.parse('lang:python kind:function file:src/ auth');
    expect(result.filters.languages).toEqual(['python']);
    expect(result.filters.kinds).toEqual(['function']);
    expect(result.filters.filePatterns).toEqual(['src/']);
    expect(result.searchTerms).toBe('auth');
  });

  it('should parse negation filters', () => {
    const result = parser.parse('auth -kind:test -file:node_modules/');
    expect(result.filters.excludeKinds).toEqual(['test']);
    expect(result.filters.excludeFiles).toEqual(['node_modules/']);
  });

  it('should handle query without filters', () => {
    const result = parser.parse('authenticate user');
    expect(result.filters).toEqual({});
    expect(result.searchTerms).toBe('authenticate user');
  });
});
```

#### 3. Documentation (30 min)
- Update README with filter syntax examples
- Add JSDoc comments to all public methods

**Success Criteria**:
- ✅ QueryFilterParser parses all filter types correctly
- ✅ Validation catches invalid filter values
- ✅ All parser tests passing (15+ tests)

---

## Day 4: Query Filter Integration (Part 2)

**Goal**: Integrate filters into search functions with SQL filtering

### Tasks

#### 1. Update SymbolDAO with Filters (2 hours)
**Objective**: Add filter support to symbol search queries

**Implementation**:
```typescript
// src/database/dao/SymbolDAO.ts

export class SymbolDAO {
  /**
   * Find symbols with optional filters
   */
  findWithFile(
    name: string,
    filters?: QueryFilters
  ): Array<SymbolWithFile> {
    let sql = `
      SELECT
        s.id, s.name, s.kind, s.line, s.column,
        f.path as file_path, f.language
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE s.name = ?
    `;

    const params: any[] = [name];

    // Apply language filter
    if (filters?.languages && filters.languages.length > 0) {
      const placeholders = filters.languages.map(() => '?').join(',');
      sql += ` AND f.language IN (${placeholders})`;
      params.push(...filters.languages);
    }

    // Apply kind filter
    if (filters?.kinds && filters.kinds.length > 0) {
      const placeholders = filters.kinds.map(() => '?').join(',');
      sql += ` AND s.kind IN (${placeholders})`;
      params.push(...filters.kinds);
    }

    // Apply file pattern filter
    if (filters?.filePatterns && filters.filePatterns.length > 0) {
      const fileConditions = filters.filePatterns
        .map(() => 'f.path LIKE ?')
        .join(' OR ');
      sql += ` AND (${fileConditions})`;
      params.push(...filters.filePatterns.map(p => `%${p}%`));
    }

    // Apply exclusion filters
    if (filters?.excludeLanguages && filters.excludeLanguages.length > 0) {
      const placeholders = filters.excludeLanguages.map(() => '?').join(',');
      sql += ` AND f.language NOT IN (${placeholders})`;
      params.push(...filters.excludeLanguages);
    }

    if (filters?.excludeKinds && filters.excludeKinds.length > 0) {
      const placeholders = filters.excludeKinds.map(() => '?').join(',');
      sql += ` AND s.kind NOT IN (${placeholders})`;
      params.push(...filters.excludeKinds);
    }

    if (filters?.excludeFiles && filters.excludeFiles.length > 0) {
      const fileConditions = filters.excludeFiles
        .map(() => 'f.path NOT LIKE ?')
        .join(' AND ');
      sql += ` AND (${fileConditions})`;
      params.push(...filters.excludeFiles.map(p => `%${p}%`));
    }

    sql += ' ORDER BY s.name, f.path';

    const db = getDatabase();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as SymbolWithFile[];
  }
}
```

#### 2. Update ChunkDAO with Filters (2 hours)
**Objective**: Add filter support to FTS5 search

**Implementation**:
```typescript
// src/database/dao/ChunkDAO.ts

export class ChunkDAO {
  /**
   * Search chunks with filters
   */
  search(
    query: string,
    limit: number = 10,
    filters?: QueryFilters
  ): ChunkSearchResult[] {
    let sql = `
      SELECT
        c.id, c.file_id, c.content, c.start_line, c.end_line, c.chunk_type,
        f.path as file_path, f.language,
        fts.rank
      FROM chunks_fts fts
      JOIN chunks c ON fts.rowid = c.id
      JOIN files f ON c.file_id = f.id
      WHERE chunks_fts MATCH ?
    `;

    const params: any[] = [query];

    // Apply filters (same logic as SymbolDAO)
    if (filters?.languages && filters.languages.length > 0) {
      const placeholders = filters.languages.map(() => '?').join(',');
      sql += ` AND f.language IN (${placeholders})`;
      params.push(...filters.languages);
    }

    // ... (same filter logic)

    sql += ' ORDER BY fts.rank LIMIT ?';
    params.push(limit);

    const db = getDatabase();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as ChunkSearchResult[];
  }
}
```

#### 3. Update FileService (2 hours)
**Objective**: Integrate QueryFilterParser into search methods

**Implementation**:
```typescript
// src/services/FileService.ts

export class FileService {
  private filterParser: QueryFilterParser;

  constructor() {
    // ... existing code
    this.filterParser = new QueryFilterParser();
  }

  /**
   * Search with automatic filter parsing
   */
  search(query: string, limit: number = 10): SearchResponse {
    const startTime = performance.now();

    // Parse filters from query
    const parsed = this.filterParser.parse(query);

    // Validate filters
    const validation = this.filterParser.validate(parsed.filters);
    if (!validation.valid) {
      throw new Error(`Invalid filters: ${validation.errors.join(', ')}`);
    }

    // Analyze remaining search terms for intent
    const analysis = this.queryRouter.analyze(parsed.searchTerms);

    // Execute search with filters
    let results: UnifiedSearchResult[];
    switch (analysis.intent) {
      case QueryIntent.SYMBOL:
        results = this.executeSymbolSearch(parsed.searchTerms, limit, parsed.filters);
        break;
      case QueryIntent.NATURAL:
        results = this.executeNaturalSearch(parsed.searchTerms, limit, parsed.filters);
        break;
      case QueryIntent.HYBRID:
        results = this.executeHybridSearch(parsed.searchTerms, limit, parsed.filters);
        break;
    }

    const endTime = performance.now();

    return {
      results,
      query: parsed.searchTerms,
      filters: parsed.filters,
      intent: analysis.intent,
      analysis,
      totalResults: results.length,
      searchTime: endTime - startTime,
    };
  }

  private executeSymbolSearch(
    query: string,
    limit: number,
    filters?: QueryFilters
  ): UnifiedSearchResult[] {
    const symbolResults = this.symbolDAO.findWithFile(query, filters);
    // ... rest of implementation
  }

  private executeNaturalSearch(
    query: string,
    limit: number,
    filters?: QueryFilters
  ): UnifiedSearchResult[] {
    const chunkResults = this.chunkDAO.search(query, limit, filters);
    // ... rest of implementation
  }
}
```

#### 4. Integration Tests (1 hour)
**Tests**:
```typescript
// src/services/__tests__/FileService-Filters.test.ts

describe('FileService - Query Filters', () => {
  it('should filter by language', () => {
    // Index TS and Python files
    fileService.indexFile(u('file1.ts'), 'function tsFunc() {}');
    fileService.indexFile(u('file2.py'), 'def py_func():\n    pass');

    // Search with language filter
    const results = fileService.search('lang:python func');

    // Should only find Python results
    expect(results.results.every(r => r.file_path.endsWith('.py'))).toBe(true);
  });

  it('should filter by kind', () => {
    fileService.indexFile(u('code.ts'), `
      class MyClass {}
      function myFunction() {}
    `);

    const results = fileService.search('kind:class My');
    expect(results.results.every(r => r.kind === 'class')).toBe(true);
  });

  it('should combine multiple filters', () => {
    const results = fileService.search('lang:python kind:function file:src/ auth');

    results.results.forEach(r => {
      expect(r.file_path).toContain('src/');
      expect(r.kind).toBe('function');
    });
  });

  it('should handle negation filters', () => {
    const results = fileService.search('auth -kind:test -file:test/');

    results.results.forEach(r => {
      expect(r.kind).not.toBe('test');
      expect(r.file_path).not.toContain('test/');
    });
  });
});
```

**Success Criteria**:
- ✅ Filters work with symbol search
- ✅ Filters work with natural language search
- ✅ Multiple filters can be combined
- ✅ Negation filters work correctly
- ✅ Filter queries are 2x faster than unfiltered (early SQL filtering)
- ✅ All integration tests passing (10+ tests)

---

## Day 5: Configuration System

**Goal**: Implement configuration loading with Zod validation

### Tasks

#### 1. Create Zod Configuration Schema (1 hour)
**Objective**: Define type-safe configuration schema

**Implementation**:
```typescript
// src/types/schemas/config.ts

import { z } from 'zod';

export const IndexingConfigSchema = z.object({
  extensions: z.array(z.string()).default([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.pyi'
  ]),
  ignored: z.array(z.string()).default([
    'node_modules',
    '.git',
    'dist',
    'build',
    '__pycache__',
    '.venv'
  ]),
  concurrency: z.number().min(1).max(16).default(3),
  batchSize: z.number().min(10).max(1000).default(100),
});

export const SearchConfigSchema = z.object({
  cacheEnabled: z.boolean().default(true),
  cacheSize: z.number().default(1000),
  cacheTTL: z.number().default(300000), // 5 minutes
  semanticEnabled: z.boolean().default(false),
  semanticAlpha: z.number().min(0).max(1).default(0.6),
});

export const PerformanceConfigSchema = z.object({
  compression: z.boolean().default(false),
  parallelIndexing: z.boolean().default(true),
  maxWorkers: z.number().min(1).max(16).default(4),
});

export const UIConfigSchema = z.object({
  progressBars: z.boolean().default(true),
  colorOutput: z.boolean().default(true),
  verboseErrors: z.boolean().default(false),
});

export const ConfigSchema = z.object({
  indexing: IndexingConfigSchema.default({}),
  search: SearchConfigSchema.default({}),
  performance: PerformanceConfigSchema.default({}),
  ui: UIConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type IndexingConfig = z.infer<typeof IndexingConfigSchema>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
```

#### 2. Implement Configuration Loader (3 hours)
**Objective**: Load config from files with hierarchy and env overrides

**Implementation**:
```typescript
// src/config/ConfigLoader.ts

import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigSchema, type Config } from '../types/schemas/config.js';

export class ConfigLoader {
  /**
   * Load configuration with hierarchy:
   * 1. Default values (from Zod schema)
   * 2. Global config (~/.axrc.json)
   * 3. Project config (.automatosx/config.json)
   * 4. Environment variables (AX_*)
   */
  load(projectRoot?: string): Config {
    // Start with defaults
    let config: Partial<Config> = {};

    // 1. Load global config
    const globalConfigPath = path.join(os.homedir(), '.axrc.json');
    if (fs.existsSync(globalConfigPath)) {
      const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
      config = this.mergeConfigs(config, globalConfig);
    }

    // 2. Load project config
    if (projectRoot) {
      const projectConfigPath = path.join(projectRoot, '.automatosx', 'config.json');
      if (fs.existsSync(projectConfigPath)) {
        const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
        config = this.mergeConfigs(config, projectConfig);
      }
    }

    // 3. Apply environment variable overrides
    config = this.applyEnvOverrides(config);

    // 4. Validate and apply defaults
    const validated = ConfigSchema.parse(config);

    return validated;
  }

  /**
   * Merge two config objects (deep merge)
   */
  private mergeConfigs(base: Partial<Config>, override: Partial<Config>): Partial<Config> {
    const merged = { ...base };

    for (const key of Object.keys(override)) {
      const k = key as keyof Config;
      if (typeof override[k] === 'object' && !Array.isArray(override[k])) {
        merged[k] = { ...base[k], ...override[k] } as any;
      } else {
        merged[k] = override[k] as any;
      }
    }

    return merged;
  }

  /**
   * Apply environment variable overrides
   * Format: AX_<SECTION>_<KEY>=value
   * Example: AX_INDEXING_CONCURRENCY=8
   */
  private applyEnvOverrides(config: Partial<Config>): Partial<Config> {
    const result = { ...config };

    // Indexing overrides
    if (process.env.AX_INDEXING_CONCURRENCY) {
      result.indexing = result.indexing || {};
      result.indexing.concurrency = parseInt(process.env.AX_INDEXING_CONCURRENCY, 10);
    }

    if (process.env.AX_INDEXING_BATCH_SIZE) {
      result.indexing = result.indexing || {};
      result.indexing.batchSize = parseInt(process.env.AX_INDEXING_BATCH_SIZE, 10);
    }

    // Search overrides
    if (process.env.AX_SEARCH_CACHE_ENABLED) {
      result.search = result.search || {};
      result.search.cacheEnabled = process.env.AX_SEARCH_CACHE_ENABLED === 'true';
    }

    if (process.env.AX_SEARCH_SEMANTIC_ENABLED) {
      result.search = result.search || {};
      result.search.semanticEnabled = process.env.AX_SEARCH_SEMANTIC_ENABLED === 'true';
    }

    // Performance overrides
    if (process.env.AX_PERFORMANCE_MAX_WORKERS) {
      result.performance = result.performance || {};
      result.performance.maxWorkers = parseInt(process.env.AX_PERFORMANCE_MAX_WORKERS, 10);
    }

    return result;
  }

  /**
   * Create default config file template
   */
  createTemplate(outputPath: string): void {
    const template = {
      indexing: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.py'],
        ignored: ['node_modules', '.git', 'dist'],
        concurrency: 3,
        batchSize: 100
      },
      search: {
        cacheEnabled: true,
        cacheSize: 1000,
        cacheTTL: 300000,
        semanticEnabled: false
      },
      performance: {
        compression: false,
        parallelIndexing: true,
        maxWorkers: 4
      },
      ui: {
        progressBars: true,
        colorOutput: true,
        verboseErrors: false
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));
  }
}
```

#### 3. Configuration Tests (1 hour)
**Tests**:
```typescript
// src/config/__tests__/ConfigLoader.test.ts

describe('ConfigLoader', () => {
  it('should load default configuration', () => {
    const loader = new ConfigLoader();
    const config = loader.load();

    expect(config.indexing.concurrency).toBe(3);
    expect(config.search.cacheEnabled).toBe(true);
  });

  it('should override with environment variables', () => {
    process.env.AX_INDEXING_CONCURRENCY = '8';

    const loader = new ConfigLoader();
    const config = loader.load();

    expect(config.indexing.concurrency).toBe(8);

    delete process.env.AX_INDEXING_CONCURRENCY;
  });

  it('should validate configuration schema', () => {
    const loader = new ConfigLoader();

    // Invalid concurrency
    expect(() => {
      ConfigSchema.parse({
        indexing: { concurrency: 20 } // Max is 16
      });
    }).toThrow();
  });

  it('should create config template', () => {
    const loader = new ConfigLoader();
    const tempPath = '/tmp/test-config.json';

    loader.createTemplate(tempPath);

    expect(fs.existsSync(tempPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
    expect(content.indexing).toBeDefined();

    fs.unlinkSync(tempPath);
  });
});
```

#### 4. Create .axrc.json Template (30 min)
**Deliverables**:
- `.axrc.json.template` in project root
- Documentation in README

**Template**:
```json
{
  "$schema": "./src/types/schemas/config.schema.json",
  "indexing": {
    "extensions": [".ts", ".tsx", ".js", ".jsx", ".py"],
    "ignored": ["node_modules", ".git", "dist", "build"],
    "concurrency": 3,
    "batchSize": 100
  },
  "search": {
    "cacheEnabled": true,
    "cacheSize": 1000,
    "cacheTTL": 300000,
    "semanticEnabled": false,
    "semanticAlpha": 0.6
  },
  "performance": {
    "compression": false,
    "parallelIndexing": true,
    "maxWorkers": 4
  },
  "ui": {
    "progressBars": true,
    "colorOutput": true,
    "verboseErrors": false
  }
}
```

**Success Criteria**:
- ✅ Configuration loads from all sources (defaults, files, env)
- ✅ Zod validation catches invalid values
- ✅ Configuration loading < 10ms
- ✅ Template generation works
- ✅ All config tests passing (8+ tests)

---

## Week 5 Success Metrics

### Functional Deliverables
- ✅ **Day 1-2**: Python parser with 95%+ accuracy (COMPLETED)
- ✅ **Day 3**: Query filter parser with full syntax support
- ✅ **Day 4**: Filter integration with symbol and FTS5 search
- ✅ **Day 5**: Configuration system with Zod validation

### Performance Targets
- Filter queries 2x faster than unfiltered (SQL-level filtering)
- Configuration loading < 10ms
- All operations remain < 100ms P95

### Quality Metrics
- **Test Coverage**: 85%+ (current: ~75%)
- **All Tests Passing**: 100% (current: 82/82)
- **New Tests**: 35+ (15 filter parser + 10 integration + 8 config + 2 docs)

### Code Deliverables
**New Files** (9 total):
1. `src/types/QueryFilter.ts` - Filter type definitions
2. `src/services/QueryFilterParser.ts` - Filter parser
3. `src/services/__tests__/QueryFilterParser.test.ts` - Parser tests
4. `src/services/__tests__/FileService-Filters.test.ts` - Integration tests
5. `src/types/schemas/config.ts` - Zod schema
6. `src/config/ConfigLoader.ts` - Config loader
7. `src/config/__tests__/ConfigLoader.test.ts` - Config tests
8. `.axrc.json.template` - Config template
9. `docs/query-filter-syntax.md` - Filter documentation

**Modified Files** (4 total):
1. `src/database/dao/SymbolDAO.ts` - Add filter parameters
2. `src/database/dao/ChunkDAO.ts` - Add filter parameters
3. `src/services/FileService.ts` - Integrate QueryFilterParser
4. `README.md` - Add filter syntax examples

---

## Dependencies & Prerequisites

### NPM Packages
- ✅ `zod` - Already in dependencies (runtime validation)
- No new dependencies needed!

### Existing Code
- ✅ SymbolDAO with findWithFile()
- ✅ ChunkDAO with search()
- ✅ FileService with search methods
- ✅ QueryRouter for intent detection

---

## Risk Mitigation

### Medium Risks
1. **Filter query performance** - Mitigated by SQL-level filtering before FTS5
2. **Complex filter combinations** - Mitigated by comprehensive test coverage
3. **Config file conflicts** - Mitigated by clear hierarchy documentation

### Low Risks
1. **Zod validation overhead** - < 1ms for typical configs
2. **Breaking changes** - Filters are additive, existing queries still work

---

## Next Steps After Week 5

### Week 6 Preview (Go Parser & Caching)
- **Days 1-2**: Go parser with tree-sitter-go
- **Days 3-4**: LRU cache implementation
- **Day 5**: Batch indexing optimizations

### Preparation
- Research tree-sitter-go API
- Evaluate LRU cache libraries (lru-cache vs custom)
- Plan batch insert strategies

---

## Daily Checklist

### Day 3
- [ ] Write query filter grammar specification
- [ ] Implement QueryFilterParser class
- [ ] Write 15+ parser tests
- [ ] All tests passing

### Day 4
- [ ] Update SymbolDAO with filter parameters
- [ ] Update ChunkDAO with filter parameters
- [ ] Integrate QueryFilterParser into FileService
- [ ] Write 10+ integration tests
- [ ] Verify 2x speedup on filtered queries

### Day 5
- [ ] Create Zod configuration schema
- [ ] Implement ConfigLoader with hierarchy
- [ ] Write 8+ config tests
- [ ] Create .axrc.json template
- [ ] Update README documentation

---

**Total Estimated Time**:
- Day 3: 4.5 hours
- Day 4: 7 hours
- Day 5: 5.5 hours
- **Total**: ~17 hours over 3 days

**Expected Outcome**:
- 100% of Week 5 goals completed
- 117+ tests passing (82 current + 35 new)
- Ready to start Week 6 (Go parser)
