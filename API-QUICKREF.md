# API Quick Reference

AutomatosX v2 CLI command reference and query syntax guide.

## Table of Contents

- [CLI Commands](#cli-commands)
- [Query Filter Syntax](#query-filter-syntax)
- [Configuration](#configuration)
- [Performance Tips](#performance-tips)
- [Troubleshooting](#troubleshooting)

---

## CLI Commands

### ax find

Search codebase with optional filters.

```bash
ax find <query> [options]
```

**Options**:
- `-l, --limit <n>` - Maximum results (default: 10)
- `-v, --verbose` - Show detailed output

**Examples**:
```bash
# Natural language search
ax find "function that validates email addresses"

# Symbol search
ax find getUserById

# With language filter
ax find "lang:python authentication"

# With kind filter
ax find "kind:function getUserById"

# With file filter
ax find "file:src/auth/ login"

# Combine multiple filters
ax find "lang:python kind:function file:src/ authentication"

# Exclude with negation
ax find "-lang:test -file:*.spec.ts handleUser"

# Limit results
ax find "getUserById" --limit 5

# Verbose output
ax find "getUserById" --verbose
```

**Query Intent Detection**:
- **Symbol**: Single identifier (e.g., `getUserById`)
- **Natural**: Multi-word phrase (e.g., `"function that handles login"`)
- **Hybrid**: Mix of both

---

### ax def

Find symbol definition.

```bash
ax def <symbol> [options]
```

**Options**:
- `-v, --verbose` - Show file content around definition

**Examples**:
```bash
# Find definition
ax def getUserById

# With context
ax def getUserById --verbose
```

---

### ax flow

Show call flow for a function.

```bash
ax flow <function>
```

**Examples**:
```bash
ax flow handleUserLogin
ax flow processPayment
```

---

### ax lint

Run code linting.

```bash
ax lint [pattern]
```

**Examples**:
```bash
# Lint all TypeScript files
ax lint src/**/*.ts

# Lint specific directory
ax lint src/auth/

# Lint single file
ax lint src/utils/validation.ts
```

---

### ax index

Index codebase for searching.

```bash
ax index [directory] [options]
```

**Options**:
- `-e, --extensions <exts>` - File extensions (comma-separated)

**Examples**:
```bash
# Index current directory
ax index .

# Index specific directory
ax index ./src

# Index with specific extensions
ax index ./src -e .ts,.js,.py

# Index multiple directories
ax index ./src ./lib
```

---

### ax watch

Auto-index with file watching.

```bash
ax watch [directory]
```

**Examples**:
```bash
# Watch current directory
ax watch .

# Watch specific directory
ax watch ./src
```

**Behavior**:
- Watches for file changes (create, modify, delete)
- Auto-reindexes changed files
- Runs continuously until stopped (Ctrl+C)

---

### ax status

Show index and cache statistics.

```bash
ax status [options]
```

**Options**:
- `-v, --verbose` - Show detailed breakdown

**Examples**:
```bash
# Basic statistics
ax status

# Detailed statistics
ax status --verbose
ax status -v
```

**Output**:
- Files indexed
- Symbols extracted
- Search chunks
- Cache statistics (hits, misses, hit rate)
- Symbols by kind (verbose)
- Chunks by type (verbose)

---

## Query Filter Syntax

### Language Filters

Filter results by programming language.

**Syntax**: `lang:<language>` or `-lang:<language>`

**Supported Languages**:
- `typescript` - TypeScript files (.ts, .tsx)
- `javascript` - JavaScript files (.js, .jsx, .mjs, .cjs)
- `python` - Python files (.py, .pyi)

**Examples**:
```bash
# Include Python files only
ax find "lang:python authentication"

# Include TypeScript files only
ax find "lang:typescript getUserById"

# Exclude test files
ax find "-lang:test handleUser"
```

---

### Kind Filters

Filter results by symbol kind.

**Syntax**: `kind:<symbol-kind>` or `-kind:<symbol-kind>`

**Supported Kinds**:
- `function` - Functions
- `class` - Classes
- `method` - Methods
- `interface` - Interfaces
- `constant` - Constants
- `variable` - Variables

**Examples**:
```bash
# Functions only
ax find "kind:function getUserById"

# Classes only
ax find "kind:class User"

# Methods only
ax find "kind:method handleSubmit"

# Exclude constants
ax find "-kind:constant MAX_USERS"
```

---

### File Path Filters

Filter results by file path pattern.

**Syntax**: `file:<pattern>` or `-file:<pattern>`

**Pattern Matching**:
- Supports wildcards: `*` (any characters), `?` (single character)
- Supports directory paths: `src/auth/`
- Supports file extensions: `*.ts`, `*.py`

**Examples**:
```bash
# Files in specific directory
ax find "file:src/auth/ login"

# TypeScript files only
ax find "file:*.ts getUserById"

# Exclude spec files
ax find "-file:*.spec.ts handleUser"

# Exclude test directories
ax find "-file:**/test/** getUserById"
```

---

### Combining Filters

Combine multiple filters for precise results.

**Examples**:
```bash
# Python functions in src/ directory
ax find "lang:python kind:function file:src/ authentication"

# TypeScript classes, exclude tests
ax find "lang:typescript kind:class -file:*.test.ts User"

# Methods in auth directory, exclude constants
ax find "kind:method file:src/auth/ -kind:constant handle"
```

---

## Configuration

### Config File Locations

AutomatosX loads configuration in this order (later overrides earlier):

1. **Defaults** - Built-in default values
2. **Global** - `~/.automatosx/config.json`
3. **Project** - `./automatosx.config.json` or `./.automatosx.json`
4. **Environment** - `AUTOMATOSX_*` environment variables

### Config File Format

Create `automatosx.config.json` in your project root:

```json
{
  "version": "1.0.0",
  "languages": {
    "typescript": {
      "enabled": true,
      "extensions": [".ts", ".tsx"],
      "excludePatterns": ["**/*.d.ts"],
      "maxFileSize": 1048576
    },
    "javascript": {
      "enabled": true,
      "extensions": [".js", ".jsx", ".mjs", ".cjs"]
    },
    "python": {
      "enabled": true,
      "extensions": [".py", ".pyi"]
    }
  },
  "search": {
    "defaultLimit": 10,
    "maxLimit": 100,
    "enableSymbolSearch": true,
    "enableNaturalSearch": true,
    "enableHybridSearch": true
  },
  "indexing": {
    "chunkSize": 512,
    "chunkOverlap": 50,
    "maxFileSize": 1048576,
    "excludePatterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/*.min.js"
    ],
    "followSymlinks": false,
    "respectGitignore": true
  },
  "database": {
    "path": ".automatosx/db/code-intelligence.db",
    "inMemory": false,
    "wal": true,
    "busyTimeout": 5000,
    "cacheSize": -2000
  },
  "performance": {
    "enableCache": true,
    "cacheMaxSize": 1000,
    "cacheTTL": 300000,
    "batchSize": 100,
    "maxConcurrency": 4
  },
  "logging": {
    "level": "info",
    "enableFileLogging": false,
    "logFilePath": ".automatosx/logs/app.log"
  }
}
```

### Environment Variables

Override configuration with environment variables:

```bash
# Search configuration
export AUTOMATOSX_SEARCH_DEFAULT_LIMIT=25
export AUTOMATOSX_SEARCH_MAX_LIMIT=200

# Database configuration
export AUTOMATOSX_DATABASE_WAL=false
export AUTOMATOSX_DATABASE_PATH=".ax/db/index.db"

# Performance configuration
export AUTOMATOSX_PERFORMANCE_CACHE_MAX_SIZE=5000
export AUTOMATOSX_PERFORMANCE_CACHE_TTL=600000

# Indexing configuration
export AUTOMATOSX_INDEXING_EXCLUDE_PATTERNS='["**/test/**","**/*.spec.ts"]'
```

**Naming Convention**:
- Prefix: `AUTOMATOSX_`
- Section: UPPERCASE (e.g., `SEARCH`, `DATABASE`)
- Key: SNAKE_CASE (e.g., `DEFAULT_LIMIT`, `MAX_SIZE`)

---

## Performance Tips

### 1. Use Query Caching

Repeated queries are 10-100x faster due to caching.

```bash
# First query (cache miss): ~5ms
ax find "getUserById"

# Repeated query (cache hit): <1ms
ax find "getUserById"
```

**Monitor cache performance**:
```bash
ax status --verbose
```

### 2. Filter Early

Use filters to narrow results at SQL level (2x faster).

```bash
# Slow (no filter)
ax find "getUserById"  # Searches all files

# Fast (with filter)
ax find "lang:typescript getUserById"  # Only TypeScript files
```

### 3. Batch Index

Index entire directory at once for best performance.

```bash
# Good - batch index
ax index ./src

# Less efficient - individual files
ax index ./src/file1.ts
ax index ./src/file2.ts
```

### 4. Use Watch Mode

Keep index updated during active development.

```bash
ax watch ./src
```

### 5. Optimize Exclude Patterns

Exclude unnecessary files to reduce index size.

```json
{
  "indexing": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/coverage/**",
      "**/*.min.js"
    ]
  }
}
```

### 6. Monitor Index Size

Check index statistics regularly.

```bash
ax status --verbose
```

**Healthy Index**:
- Reasonable file count (not indexing node_modules)
- Good cache hit rate (>50%)
- Fast query times (<5ms uncached)

---

## Troubleshooting

### No Results Found

**Symptoms**: Query returns no results

**Solutions**:
1. Check if files are indexed:
   ```bash
   ax status
   ```

2. Re-index if needed:
   ```bash
   ax index ./src
   ```

3. Try different search terms:
   ```bash
   # Try partial matching
   ax find "getUser"  # Instead of "getUserById"

   # Try natural language
   ax find "function that gets user by id"
   ```

4. Check filter syntax:
   ```bash
   # Wrong
   ax find "language:python"  # Should be "lang:"

   # Correct
   ax find "lang:python"
   ```

5. Verify file is in indexed directory:
   ```bash
   ax status --verbose
   ```

### Slow Queries

**Symptoms**: Queries take >100ms

**Solutions**:
1. Check cache hit rate:
   ```bash
   ax status --verbose
   ```

2. Clear and rebuild cache if hit rate is low:
   ```bash
   # Stop watch mode if running
   # Re-index to rebuild
   ax index ./src
   ```

3. Use filters to narrow search:
   ```bash
   ax find "lang:typescript kind:function getUserById"
   ```

4. Check index size:
   ```bash
   ax status
   ```
   - If too large, optimize exclude patterns

5. Ensure database indices are applied:
   - Migrations run automatically on first use
   - Check `.automatosx/db/schema_migrations` table

### Permission Errors

**Symptoms**: `EACCES` or permission denied errors

**Solutions**:
1. Check file permissions:
   ```bash
   ls -la .automatosx/
   ```

2. Fix permissions:
   ```bash
   chmod +r <file>  # Add read permission
   chmod +w <file>  # Add write permission
   ```

3. Check directory ownership:
   ```bash
   ls -la .automatosx/
   ```

4. Run with appropriate privileges (avoid sudo unless necessary)

### Database Locked

**Symptoms**: `database is locked` error

**Solutions**:
1. Stop watch mode:
   - Press Ctrl+C to stop `ax watch`

2. Clear database:
   ```bash
   rm -rf .automatosx/db
   ```

3. Re-index:
   ```bash
   ax index ./src
   ```

4. Check disk space:
   ```bash
   df -h
   ```

### Index Not Updating

**Symptoms**: New files not showing in search

**Solutions**:
1. Check if watch mode is running:
   ```bash
   ps aux | grep "ax watch"
   ```

2. Manually re-index:
   ```bash
   ax index ./src
   ```

3. Clear cache:
   - Stop and restart watch mode
   - Or delete `.automatosx/db` and re-index

---

## Getting Help

**Documentation**:
- README: `./README.md`
- CHANGELOG: `./CHANGELOG.md`
- P1 Action Plan: `./automatosx/PRD/p1-final-action-plan.md`

**Support**:
- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share tips

**Version Info**:
```bash
ax --version
```

**Debug Mode**:
```bash
# Enable verbose logging
export AUTOMATOSX_LOGGING_LEVEL=debug
ax find "query"
```

---

**AutomatosX v2.0.0** - API Quick Reference

Last updated: 2025-11-06
