# AutomatosX v2

> Production-ready code intelligence for TypeScript & Python projects

[![Tests](https://img.shields.io/badge/tests-165%20passing-brightgreen)](./src)
[![Coverage](https://img.shields.io/badge/coverage-85%25-green)](./src)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)

AutomatosX v2 is a high-performance code intelligence engine that indexes and searches your codebase using Tree-sitter AST parsing and SQLite FTS5 full-text search.

## ✨ Features

- 🔍 **Multi-language search** - TypeScript, JavaScript, Python with more coming soon
- ⚡ **Lightning fast** - Query caching delivers 10-100x speedup for repeated searches
- 🎯 **Advanced filtering** - Filter by language, symbol kind, or file path
- 📊 **Smart indexing** - Batch operations process 2000+ files/sec
- 🎨 **Professional UX** - Color-coded output, progress indicators, helpful error messages
- ⚙️ **Flexible configuration** - Hierarchical config system with environment variable support
- 🧪 **Production quality** - 165 tests passing, 85%+ coverage, zero known bugs

## 🚀 Quick Start

### Installation

```bash
npm install -g automatosx-v2
```

### Basic Usage

```bash
# Index your codebase
ax index ./src

# Search for code
ax find "getUserById"

# Search with filters
ax find "lang:python authentication"

# Find symbol definition
ax def getUserById

# Show index statistics
ax status
```

## 📚 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ax find <query>` | Search code with optional filters | `ax find "lang:python login"` |
| `ax def <symbol>` | Find symbol definition | `ax def getUserById` |
| `ax flow <function>` | Show call flow | `ax flow handleLogin` |
| `ax lint [pattern]` | Code linting | `ax lint src/**/*.ts` |
| `ax index [dir]` | Index codebase | `ax index ./src` |
| `ax watch [dir]` | Auto-index with file watching | `ax watch ./src` |
| `ax status` | Show index & cache statistics | `ax status --verbose` |

## 🔎 Query Syntax

### Natural Language Search

```bash
ax find "function that validates email addresses"
ax find "class for user authentication"
```

### Symbol Search

```bash
ax find getUserById
ax find UserService
```

### Language Filters

```bash
ax find "lang:python authentication"      # Python files only
ax find "lang:typescript getUserById"     # TypeScript files only
ax find "-lang:test handleUser"           # Exclude test files
```

### Kind Filters

```bash
ax find "kind:function getUserById"       # Functions only
ax find "kind:class User"                 # Classes only
ax find "-kind:constant MAX_USERS"        # Exclude constants
```

### File Path Filters

```bash
ax find "file:src/auth/ login"            # Files in src/auth/
ax find "file:*.ts getUserById"           # TypeScript files only
ax find "-file:*.spec.ts handleUser"      # Exclude spec files
```

### Combining Filters

```bash
ax find "lang:python kind:function file:src/ authentication"
```

## ⚙️ Configuration

Create `automatosx.config.json` in your project root:

```json
{
  "languages": {
    "typescript": { "enabled": true },
    "javascript": { "enabled": true },
    "python": { "enabled": true }
  },
  "search": {
    "defaultLimit": 10,
    "maxLimit": 100
  },
  "indexing": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**"
    ],
    "maxFileSize": 1048576
  },
  "database": {
    "path": ".automatosx/db/code-intelligence.db"
  },
  "performance": {
    "enableCache": true,
    "cacheMaxSize": 1000,
    "cacheTTL": 300000
  }
}
```

### Environment Variables

Override config values with environment variables:

```bash
export AUTOMATOSX_SEARCH_DEFAULT_LIMIT=25
export AUTOMATOSX_DATABASE_WAL=false
export AUTOMATOSX_INDEXING_EXCLUDE_PATTERNS='["**/test/**"]'
```

## 📈 Performance

AutomatosX v2 delivers significant performance improvements:

| Metric | Value |
|--------|-------|
| Query latency (cached) | <1ms |
| Query latency (uncached) | <5ms (P95) |
| Indexing throughput | 2000+ files/sec |
| Cache hit rate | 60%+ typical |
| Test coverage | 85%+ |
| Tests passing | 165/165 (100%) |

### Performance Tips

1. **Use caching** - Repeated queries are 10-100x faster
2. **Filter early** - Use `lang:`, `kind:`, `file:` to narrow results
3. **Batch index** - Index entire directory at once for best performance
4. **Watch mode** - Use for active development to keep index updated
5. **Monitor cache** - Check hit rate with `ax status -v`

## 🏗️ Architecture

AutomatosX v2 uses a multi-layer architecture:

```
┌─────────────────────────────────────┐
│         CLI Layer (Commander)        │
│  (Commands, Args, Output Formatting) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Service Layer (TypeScript)      │
│ (FileService, ConfigLoader, Caching) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Parser Layer (Tree-sitter)        │
│  (TS/JS/Python AST → Symbol Extract) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Database Layer (SQLite FTS5)      │
│ (Files, Symbols, Chunks, Full-Text)  │
└──────────────────────────────────────┘
```

**Key Components**:
- **Parser Layer**: Tree-sitter for AST parsing (TypeScript, JavaScript, Python)
- **Database Layer**: SQLite with FTS5 for full-text search and BM25 ranking
- **Service Layer**: FileService orchestrates indexing and search
- **Query Router**: Intelligent query intent detection (symbol vs natural language)
- **Cache Layer**: LRU cache with TTL for query result caching
- **Configuration**: Zod-based validation with hierarchical loading

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test FileService
```

**Test Statistics**:
- Total tests: 165
- Pass rate: 100%
- Coverage: 85%+
- Test categories: Parser, DAO, Service, Cache, Config, CLI, Integration

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build CLI
npm run build:cli

# Run CLI locally
npm run cli -- find "query"

# Run tests
npm test

# Clean build artifacts
npm run clean
```

## 📖 Documentation

- **[P1 Final Action Plan](./automatosx/PRD/p1-final-action-plan.md)** - Comprehensive implementation plan
- **[CHANGELOG](./CHANGELOG.md)** - Version history and release notes
- **[API Quick Reference](./API-QUICKREF.md)** - Command reference and examples

## 🗺️ Roadmap

### v2.1 (Planned)
- Go language support
- Configuration CLI tools (`ax config validate`, `ax config init`)

### v2.2 (Planned)
- Rust language support
- Additional language parsers based on demand

### P2 / v3.0 (Future)
- ML semantic search with hybrid BM25+semantic scoring
- Cross-project search
- Language Server Protocol (LSP) integration
- Desktop application

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

Built with:
- [Tree-sitter](https://tree-sitter.github.io/) - Incremental parsing system
- [SQLite](https://www.sqlite.org/) - Embedded database with FTS5
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal string styling

---

**AutomatosX v2.0.0** - Production-ready code intelligence

Made with ❤️ by the AutomatosX team
