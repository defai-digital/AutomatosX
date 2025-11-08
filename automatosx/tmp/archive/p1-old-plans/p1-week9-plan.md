# Phase 1 Week 9: Progress UI & Compression

**Duration**: 5 days
**Status**: Planned
**Prerequisites**: Week 8 complete (semantic search, embeddings, ML integration)
**Created**: 2025-11-06

---

## Executive Summary

Week 9 focuses on **user experience improvements** and **storage optimization**. This week enhances the CLI with real-time progress tracking, implements chunk compression to reduce database size, and adds comprehensive error handling with helpful messages.

**Key Deliverables**:
- Real-time progress bars with ETA for indexing
- LZ4 compression for code chunks (50% space savings)
- Enhanced error messages with recovery suggestions
- Terminal UI improvements (colors, formatting, spinners)
- Incremental indexing (skip unchanged files)

**Test Growth**: 226 → 245 tests (+19 new tests)
**Storage Reduction**: ~50% with compression (10MB → 5MB per 1K files)
**UX Improvement**: Progress visibility, better error messages

---

## Day 1: Progress Tracking Infrastructure (5 hours)

### Goals
- Create ProgressTracker service for tracking operations
- Implement progress calculation with ETA
- Add progress event emitters
- Write progress tracking tests

### Technical Details

**ProgressTracker Service**:
```typescript
// src/services/ProgressTracker.ts
export interface ProgressUpdate {
  operation: string;
  current: number;
  total: number;
  percentage: number;
  eta: number; // seconds
  startTime: number;
  currentFile?: string;
  status: 'running' | 'completed' | 'failed';
}

export class ProgressTracker {
  private operations: Map<string, ProgressUpdate>;
  private listeners: Map<string, ProgressListener[]>;

  startOperation(
    operationId: string,
    operation: string,
    total: number
  ): void {
    this.operations.set(operationId, {
      operation,
      current: 0,
      total,
      percentage: 0,
      eta: 0,
      startTime: Date.now(),
      status: 'running'
    });
    this.emit(operationId);
  }

  updateProgress(
    operationId: string,
    current: number,
    currentFile?: string
  ): void {
    const progress = this.operations.get(operationId);
    if (!progress) return;

    const elapsed = (Date.now() - progress.startTime) / 1000;
    const rate = current / elapsed; // items per second
    const remaining = progress.total - current;
    const eta = remaining / rate;

    progress.current = current;
    progress.percentage = (current / progress.total) * 100;
    progress.eta = eta;
    progress.currentFile = currentFile;

    this.emit(operationId);
  }

  completeOperation(operationId: string): void {
    const progress = this.operations.get(operationId);
    if (progress) {
      progress.status = 'completed';
      progress.percentage = 100;
      this.emit(operationId);
    }
  }

  failOperation(operationId: string, error: Error): void {
    const progress = this.operations.get(operationId);
    if (progress) {
      progress.status = 'failed';
      this.emit(operationId);
    }
  }

  onProgress(operationId: string, listener: ProgressListener): void {
    if (!this.listeners.has(operationId)) {
      this.listeners.set(operationId, []);
    }
    this.listeners.get(operationId)!.push(listener);
  }

  private emit(operationId: string): void {
    const listeners = this.listeners.get(operationId) || [];
    const progress = this.operations.get(operationId);
    if (progress) {
      listeners.forEach(listener => listener(progress));
    }
  }
}
```

**Integration with FileService**:
```typescript
// Updated FileService.indexDirectory()
async indexDirectory(
  dirPath: string,
  progressCallback?: ProgressListener
): Promise<IndexDirectoryResult> {
  const files = await this.findFilesToIndex(dirPath);
  const operationId = `index-${Date.now()}`;

  this.progressTracker.startOperation(
    operationId,
    'Indexing files',
    files.length
  );

  if (progressCallback) {
    this.progressTracker.onProgress(operationId, progressCallback);
  }

  let indexed = 0;
  for (const file of files) {
    try {
      await this.indexFile(file.path, file.content);
      indexed++;
      this.progressTracker.updateProgress(operationId, indexed, file.path);
    } catch (error) {
      // Handle error, continue with next file
    }
  }

  this.progressTracker.completeOperation(operationId);

  return { indexed, failed: files.length - indexed };
}
```

### Tests (5 tests)
1. **Progress calculation**
   - Should calculate percentage correctly
   - Should estimate ETA based on current rate
   - Should update ETA as progress changes

2. **Operation tracking**
   - Should track multiple operations independently
   - Should emit events on progress updates
   - Should mark operations as completed/failed

3. **Event listeners**
   - Should notify all registered listeners
   - Should handle listener errors gracefully

### Deliverables
- `src/services/ProgressTracker.ts` (150 lines)
- `src/services/__tests__/ProgressTracker.test.ts` (5 tests)
- Updated `FileService` with progress tracking
- Progress types in `src/types/Progress.ts`

### Time Breakdown
- ProgressTracker implementation: 2 hours
- FileService integration: 1.5 hours
- Tests: 1.5 hours

---

## Day 2: Terminal UI Components (5 hours)

### Goals
- Create progress bar component for CLI
- Add spinners and visual indicators
- Implement color-coded output
- Add terminal UI tests

### Technical Details

**Progress Bar Component**:
```typescript
// src/cli/components/ProgressBar.ts
import chalk from 'chalk';

export class ProgressBar {
  private width: number = 40;
  private stream = process.stderr;

  render(progress: ProgressUpdate): void {
    const filled = Math.floor((progress.percentage / 100) * this.width);
    const empty = this.width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percent = chalk.bold(`${progress.percentage.toFixed(1)}%`);
    const eta = this.formatETA(progress.eta);
    const rate = this.formatRate(progress.current, progress.startTime);

    const line = `${bar} ${percent} ${eta} ${rate}`;

    if (progress.currentFile) {
      const fileName = chalk.cyan(this.truncate(progress.currentFile, 60));
      this.stream.write(`\r${line}\n${fileName}`);
      this.stream.write('\x1b[1A'); // Move cursor up
    } else {
      this.stream.write(`\r${line}`);
    }
  }

  clear(): void {
    this.stream.write('\r' + ' '.repeat(this.width + 50) + '\r');
  }

  complete(message: string, duration: number): void {
    this.clear();
    const check = chalk.green('✓');
    const time = chalk.gray(`(${duration.toFixed(1)}s)`);
    this.stream.write(`${check} ${message} ${time}\n`);
  }

  private formatETA(seconds: number): string {
    if (seconds < 60) {
      return chalk.gray(`ETA: ${Math.ceil(seconds)}s`);
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return chalk.gray(`ETA: ${mins}m ${secs}s`);
  }

  private formatRate(current: number, startTime: number): string {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = current / elapsed;
    return chalk.gray(`(${rate.toFixed(1)}/s)`);
  }

  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return '...' + str.slice(-(maxLen - 3));
  }
}
```

**Spinner Component**:
```typescript
// src/cli/components/Spinner.ts
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;

  start(message: string): void {
    this.interval = setInterval(() => {
      const frame = chalk.cyan(this.frames[this.frameIndex]);
      process.stderr.write(`\r${frame} ${message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stderr.write('\r' + ' '.repeat(100) + '\r');
    if (message) {
      console.log(chalk.green('✓'), message);
    }
  }
}
```

**CLI Output Formatter**:
```typescript
// src/cli/utils/formatter.ts
export class OutputFormatter {
  static success(message: string): string {
    return `${chalk.green('✓')} ${message}`;
  }

  static error(message: string): string {
    return `${chalk.red('✗')} ${message}`;
  }

  static warning(message: string): string {
    return `${chalk.yellow('⚠')} ${message}`;
  }

  static info(message: string): string {
    return `${chalk.blue('ℹ')} ${message}`;
  }

  static code(code: string): string {
    return chalk.gray.bold(code);
  }

  static path(path: string): string {
    return chalk.cyan(path);
  }

  static number(num: number): string {
    return chalk.yellow(num.toLocaleString());
  }

  static table(headers: string[], rows: string[][]): string {
    // ASCII table rendering
  }
}
```

### Dependencies
```bash
npm install chalk@^5.0.0
npm install -D @types/node
```

### Tests (4 tests)
1. **Progress bar rendering**
   - Should render progress bar correctly
   - Should format ETA and rate
   - Should truncate long file names

2. **Spinner**
   - Should animate frames
   - Should clear on stop

3. **Output formatter**
   - Should format different message types
   - Should apply correct colors

### Deliverables
- `src/cli/components/ProgressBar.ts` (120 lines)
- `src/cli/components/Spinner.ts` (60 lines)
- `src/cli/utils/formatter.ts` (80 lines)
- `src/cli/__tests__/ProgressBar.test.ts` (4 tests)
- Updated CLI commands with progress UI

### Time Breakdown
- Progress bar implementation: 2 hours
- Spinner & formatter: 1.5 hours
- CLI integration: 0.5 hour
- Tests: 1 hour

---

## Day 3: LZ4 Compression Implementation (5 hours)

### Goals
- Implement LZ4 compression for code chunks
- Update database schema for compressed storage
- Add compression/decompression to ChunkDAO
- Write compression tests and benchmarks

### Technical Details

**Compression Service**:
```typescript
// src/services/CompressionService.ts
import lz4 from 'lz4';

export class CompressionService {
  /**
   * Compress text using LZ4
   * @returns Buffer with compressed data
   */
  compress(text: string): Buffer {
    const input = Buffer.from(text, 'utf-8');
    const output = Buffer.alloc(lz4.encodeBound(input.length));
    const compressedSize = lz4.encodeBlock(input, output);
    return output.slice(0, compressedSize);
  }

  /**
   * Decompress LZ4 data
   * @returns Original text
   */
  decompress(compressed: Buffer, uncompressedSize: number): string {
    const output = Buffer.alloc(uncompressedSize);
    lz4.decodeBlock(compressed, output);
    return output.toString('utf-8');
  }

  /**
   * Calculate compression ratio
   */
  compressionRatio(original: string, compressed: Buffer): number {
    return compressed.length / Buffer.byteLength(original, 'utf-8');
  }
}
```

**Database Schema Updates**:
```sql
-- Migration 005: Add compression support
-- src/database/migrations/005_add_compression.sql

-- Add compression metadata columns
ALTER TABLE chunks ADD COLUMN is_compressed INTEGER DEFAULT 0;
ALTER TABLE chunks ADD COLUMN uncompressed_size INTEGER;

-- Create index for compression queries
CREATE INDEX idx_chunks_compressed ON chunks(is_compressed);

-- Backward compatibility: existing chunks are uncompressed
UPDATE chunks SET is_compressed = 0 WHERE is_compressed IS NULL;
```

**Updated ChunkDAO**:
```typescript
// Updated ChunkDAO with compression support
export class ChunkDAO {
  private compressionService: CompressionService;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
    this.compressionService = new CompressionService();
  }

  insert(chunk: ChunkInput, compress: boolean = true): number {
    let content = chunk.content;
    let isCompressed = 0;
    let uncompressedSize = Buffer.byteLength(content, 'utf-8');

    if (compress && uncompressedSize > 100) { // Compress if > 100 bytes
      const compressed = this.compressionService.compress(content);

      // Only use compression if it actually saves space
      if (compressed.length < uncompressedSize * 0.9) {
        content = compressed.toString('base64');
        isCompressed = 1;
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO chunks (
        file_id, content, start_line, end_line,
        chunk_type, symbol_id, is_compressed, uncompressed_size
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      chunk.file_id,
      content,
      chunk.start_line,
      chunk.end_line,
      chunk.chunk_type,
      chunk.symbol_id || null,
      isCompressed,
      uncompressedSize
    );

    return result.lastInsertRowid as number;
  }

  findById(id: number): ChunkRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM chunks WHERE id = ?
    `);
    const record = stmt.get(id) as ChunkRecordRaw | undefined;

    if (!record) return null;

    return this.decompressChunk(record);
  }

  private decompressChunk(record: ChunkRecordRaw): ChunkRecord {
    if (record.is_compressed) {
      const compressed = Buffer.from(record.content, 'base64');
      const decompressed = this.compressionService.decompress(
        compressed,
        record.uncompressed_size
      );
      return { ...record, content: decompressed };
    }
    return record as ChunkRecord;
  }

  // Update search to handle compressed chunks
  search(query: string, limit: number = 10, filters?: QueryFilters): ChunkSearchResult[] {
    // FTS5 searches uncompressed content automatically
    // We decompress results after retrieval
    const results = this.searchRaw(query, limit, filters);
    return results.map(r => this.decompressChunk(r));
  }
}
```

**Configuration**:
```json
// .axrc.json
{
  "storage": {
    "compression": {
      "enabled": true,
      "algorithm": "lz4",
      "minSize": 100,
      "threshold": 0.9
    }
  }
}
```

### Dependencies
```bash
npm install lz4@^0.6.5
npm install -D @types/lz4
```

### Tests (6 tests)
1. **Compression service**
   - Should compress and decompress text correctly
   - Should calculate compression ratio
   - Should handle edge cases (empty, small text)

2. **ChunkDAO compression**
   - Should store compressed chunks
   - Should decompress on retrieval
   - Should skip compression for small chunks
   - Should only compress if space savings > 10%

3. **Backward compatibility**
   - Should read uncompressed legacy chunks
   - Should handle mixed compressed/uncompressed

### Deliverables
- `src/services/CompressionService.ts` (100 lines)
- `src/services/__tests__/CompressionService.test.ts` (6 tests)
- `src/database/migrations/005_add_compression.sql`
- Updated `ChunkDAO` with compression support
- Configuration schema updates

### Performance Benchmarks
| Metric | Target | Notes |
|--------|--------|-------|
| Compression ratio | ~50% | For typical code |
| Compression speed | > 100 MB/s | LZ4 fast mode |
| Decompression speed | > 500 MB/s | LZ4 very fast |
| Database size | -50% | For 1K files |

### Time Breakdown
- Compression service: 1.5 hours
- ChunkDAO integration: 2 hours
- Migration & config: 0.5 hour
- Tests & benchmarks: 1 hour

---

## Day 4: Incremental Indexing & Error Handling (5 hours)

### Goals
- Implement incremental indexing (skip unchanged files)
- Add file hash comparison for change detection
- Enhance error messages with recovery suggestions
- Write error handling tests

### Technical Details

**Incremental Indexing**:
```typescript
// src/services/IncrementalIndexer.ts
export class IncrementalIndexer {
  private fileDAO: FileDAO;

  async shouldReindex(filePath: string, content: string): Promise<boolean> {
    const existing = this.fileDAO.findByPath(filePath);

    if (!existing) {
      return true; // New file, must index
    }

    const currentHash = hashContent(content);

    if (existing.hash === currentHash) {
      return false; // Unchanged, skip
    }

    return true; // Changed, reindex
  }

  async indexChangedFiles(
    dirPath: string,
    progressCallback?: ProgressListener
  ): Promise<IncrementalIndexResult> {
    const files = await this.findFilesToIndex(dirPath);

    const toIndex = [];
    const skipped = [];

    for (const file of files) {
      if (await this.shouldReindex(file.path, file.content)) {
        toIndex.push(file);
      } else {
        skipped.push(file);
      }
    }

    // Index only changed files
    const result = await this.indexFiles(toIndex, progressCallback);

    return {
      indexed: result.indexed,
      skipped: skipped.length,
      failed: result.failed,
      total: files.length
    };
  }

  async getIndexStatus(dirPath: string): Promise<IndexStatus> {
    const files = await this.findFilesToIndex(dirPath);
    const indexed = this.fileDAO.findAll();

    return {
      totalFiles: files.length,
      indexedFiles: indexed.length,
      outdatedFiles: this.getOutdatedCount(files, indexed),
      newFiles: this.getNewFilesCount(files, indexed)
    };
  }
}
```

**Enhanced Error Handling**:
```typescript
// src/errors/CodeIntelligenceError.ts
export class CodeIntelligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public recovery?: string[],
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CodeIntelligenceError';
  }

  format(): string {
    let output = `${chalk.red('Error')}: ${this.message}\n`;

    if (this.context) {
      output += chalk.gray('\nContext:\n');
      for (const [key, value] of Object.entries(this.context)) {
        output += chalk.gray(`  ${key}: ${value}\n`);
      }
    }

    if (this.recovery && this.recovery.length > 0) {
      output += chalk.yellow('\nPossible solutions:\n');
      this.recovery.forEach((suggestion, i) => {
        output += chalk.yellow(`  ${i + 1}. ${suggestion}\n`);
      });
    }

    return output;
  }
}

// Error factory functions
export const Errors = {
  fileNotFound(path: string): CodeIntelligenceError {
    return new CodeIntelligenceError(
      `File not found: ${path}`,
      'FILE_NOT_FOUND',
      [
        'Check if the file path is correct',
        'Verify file exists and is readable',
        'Try using an absolute path'
      ],
      { path }
    );
  },

  parserError(filePath: string, language: string, error: Error): CodeIntelligenceError {
    return new CodeIntelligenceError(
      `Failed to parse ${language} file: ${filePath}`,
      'PARSER_ERROR',
      [
        'Check if the file has valid syntax',
        'Try running a linter on the file',
        `Verify ${language} parser is installed`,
        'File may contain unsupported language features'
      ],
      { filePath, language, originalError: error.message }
    );
  },

  databaseError(operation: string, error: Error): CodeIntelligenceError {
    return new CodeIntelligenceError(
      `Database error during ${operation}`,
      'DATABASE_ERROR',
      [
        'Check if database file is not corrupted',
        'Try running: ax db repair',
        'Ensure sufficient disk space',
        'Check file permissions'
      ],
      { operation, originalError: error.message }
    );
  },

  embeddingError(error: Error): CodeIntelligenceError {
    return new CodeIntelligenceError(
      'Failed to generate embeddings',
      'EMBEDDING_ERROR',
      [
        'Check if @xenova/transformers is installed',
        'Try: npm install @xenova/transformers',
        'Verify sufficient memory (model requires ~100MB)',
        'Disable embeddings in config if not needed'
      ],
      { originalError: error.message }
    );
  },

  configError(path: string, error: Error): CodeIntelligenceError {
    return new CodeIntelligenceError(
      `Invalid configuration file: ${path}`,
      'CONFIG_ERROR',
      [
        'Check JSON syntax with: cat .axrc.json | jq',
        'Run: ax config validate',
        'Compare with template: ax config init --dry-run',
        'Delete config to use defaults'
      ],
      { path, originalError: error.message }
    );
  }
};
```

**Graceful Degradation**:
```typescript
// src/services/FileService.ts
async indexFileWithRecovery(
  filePath: string,
  content: string
): Promise<IndexResult> {
  try {
    return await this.indexFile(filePath, content);
  } catch (error) {
    if (error instanceof ParserError) {
      // Try fallback: index without symbols, just chunks
      return await this.indexFileTextOnly(filePath, content);
    }
    throw error;
  }
}
```

### Tests (4 tests)
1. **Incremental indexing**
   - Should skip unchanged files
   - Should reindex changed files
   - Should detect new files
   - Should update index status

2. **Error handling**
   - Should format errors with recovery suggestions
   - Should provide context for debugging
   - Should gracefully degrade on parser failures

### Deliverables
- `src/services/IncrementalIndexer.ts` (200 lines)
- `src/services/__tests__/IncrementalIndexer.test.ts` (4 tests)
- `src/errors/CodeIntelligenceError.ts` (150 lines)
- Enhanced error handling across services
- Updated CLI with better error messages

### Time Breakdown
- Incremental indexing: 2.5 hours
- Error handling framework: 1.5 hours
- Tests: 1 hour

---

## Day 5: CLI Polish & Documentation (4 hours)

### Goals
- Integrate all UI components into CLI commands
- Add `--progress` flag to commands
- Create user guide for new features
- Write CLI integration tests

### Technical Details

**Updated CLI Commands**:
```typescript
// src/cli/commands/index.ts
export const indexCommand = {
  command: 'index [path]',
  describe: 'Index a directory or file',
  builder: (yargs) => {
    return yargs
      .positional('path', {
        type: 'string',
        default: '.',
        describe: 'Path to index'
      })
      .option('progress', {
        type: 'boolean',
        default: true,
        describe: 'Show progress bar'
      })
      .option('incremental', {
        type: 'boolean',
        default: true,
        describe: 'Skip unchanged files'
      })
      .option('compression', {
        type: 'boolean',
        default: true,
        describe: 'Compress chunks'
      })
      .option('parallel', {
        type: 'number',
        default: 4,
        describe: 'Parallel workers'
      });
  },
  handler: async (argv) => {
    const spinner = new Spinner();
    spinner.start('Analyzing directory...');

    const fileService = new FileService();
    const files = await fileService.findFilesToIndex(argv.path);

    spinner.stop();

    if (files.length === 0) {
      console.log(OutputFormatter.warning('No files to index'));
      return;
    }

    console.log(OutputFormatter.info(`Found ${files.length} files`));

    if (argv.progress) {
      const progressBar = new ProgressBar();

      const result = await fileService.indexDirectory(argv.path, (progress) => {
        progressBar.render(progress);
      });

      progressBar.complete(
        `Indexed ${result.indexed} files`,
        (Date.now() - startTime) / 1000
      );

      if (result.skipped > 0) {
        console.log(OutputFormatter.info(`Skipped ${result.skipped} unchanged files`));
      }

      if (result.failed > 0) {
        console.log(OutputFormatter.warning(`Failed to index ${result.failed} files`));
      }
    } else {
      // Silent mode
      const result = await fileService.indexDirectory(argv.path);
      console.log(JSON.stringify(result));
    }
  }
};
```

**Status Command**:
```typescript
// src/cli/commands/status.ts
export const statusCommand = {
  command: 'status [path]',
  describe: 'Show indexing status',
  handler: async (argv) => {
    const indexer = new IncrementalIndexer();
    const status = await indexer.getIndexStatus(argv.path);

    console.log(chalk.bold('\nIndex Status\n'));

    const table = [
      ['Total files:', OutputFormatter.number(status.totalFiles)],
      ['Indexed:', chalk.green(status.indexedFiles)],
      ['Outdated:', chalk.yellow(status.outdatedFiles)],
      ['New:', chalk.cyan(status.newFiles)],
      ['Coverage:', `${((status.indexedFiles / status.totalFiles) * 100).toFixed(1)}%`]
    ];

    table.forEach(([label, value]) => {
      console.log(`  ${label.padEnd(15)} ${value}`);
    });

    // Storage stats
    const dbSize = await fileService.getDatabaseSize();
    console.log(chalk.bold('\nStorage\n'));
    console.log(`  Database size:  ${formatBytes(dbSize)}`);
    console.log(`  Compression:    ${status.compressionRatio.toFixed(1)}x`);

    // Recommendations
    if (status.outdatedFiles > 0) {
      console.log('\n' + OutputFormatter.warning(
        `Run 'ax index' to update ${status.outdatedFiles} outdated files`
      ));
    }
  }
};
```

### Documentation

**File**: `docs/progress-ui-guide.md`

Topics:
1. Progress bars and visual indicators
2. Incremental indexing workflow
3. Compression benefits and trade-offs
4. Error messages and recovery
5. CLI options reference

**File**: `docs/compression-architecture.md`

Topics:
1. LZ4 compression algorithm
2. When compression is applied
3. Performance characteristics
4. Storage savings analysis
5. Backward compatibility

### Deliverables
- Updated CLI commands with progress UI
- `docs/progress-ui-guide.md`
- `docs/compression-architecture.md`
- Updated README with Week 9 features
- CLI examples and screenshots (ASCII art)

### Time Breakdown
- CLI integration: 1.5 hours
- Documentation: 2 hours
- Testing & polish: 0.5 hour

---

## Cumulative Progress Tracking

### Test Count Evolution
| Milestone | Tests | Cumulative | Pass Rate |
|-----------|-------|------------|-----------|
| Week 8 End | - | 226 | 100% |
| Week 9 Day 1 | +5 | 231 | Target: 100% |
| Week 9 Day 2 | +4 | 235 | Target: 100% |
| Week 9 Day 3 | +6 | 241 | Target: 100% |
| Week 9 Day 4 | +4 | 245 | Target: 100% |
| Week 9 Day 5 | +0 | 245 | Target: 100% |

### Feature Progression
| Week | Major Features |
|------|----------------|
| Week 8 | ML embeddings, semantic search |
| Week 9 | Progress UI, compression, incremental indexing |

### Performance Evolution
| Metric | Week 8 | Week 9 Target |
|--------|--------|---------------|
| Database size | 10MB/1K files | 5MB/1K files (-50%) |
| Index time (incremental) | N/A | 10x faster (skip unchanged) |
| UX quality | Basic | Progress bars, colors, ETAs |

---

## File Deliverables Summary

### New Files (13 files)
1. `src/services/ProgressTracker.ts` - Progress tracking service
2. `src/services/__tests__/ProgressTracker.test.ts` - 5 tests
3. `src/cli/components/ProgressBar.ts` - Progress bar UI
4. `src/cli/components/Spinner.ts` - Loading spinner
5. `src/cli/utils/formatter.ts` - Output formatting utilities
6. `src/cli/__tests__/ProgressBar.test.ts` - 4 tests
7. `src/services/CompressionService.ts` - LZ4 compression
8. `src/services/__tests__/CompressionService.test.ts` - 6 tests
9. `src/services/IncrementalIndexer.ts` - Smart reindexing
10. `src/services/__tests__/IncrementalIndexer.test.ts` - 4 tests
11. `src/errors/CodeIntelligenceError.ts` - Enhanced errors
12. `docs/progress-ui-guide.md` - User documentation
13. `docs/compression-architecture.md` - Technical docs

### Modified Files (7 files)
1. `src/services/FileService.ts` - Progress & incremental indexing
2. `src/database/dao/ChunkDAO.ts` - Compression support
3. `src/cli/commands/index.ts` - Progress UI
4. `src/cli/commands/status.ts` - Status display
5. `src/types/schemas/config.ts` - Compression config
6. `src/database/migrations/005_add_compression.sql` - Schema changes
7. `README.md` - Feature updates

---

## Dependencies & Prerequisites

### External Dependencies
```bash
npm install chalk@^5.0.0
npm install lz4@^0.6.5
npm install -D @types/lz4
```

**Total Size**: ~2MB

### Internal Prerequisites
- ✅ Week 8 complete (embeddings, semantic search)
- ✅ FileService with indexing pipeline
- ✅ ChunkDAO with storage operations
- ✅ CLI framework with commands

---

## Success Criteria

### Functional Requirements
- [ ] Progress bars show real-time indexing progress with ETA
- [ ] Compression reduces database size by ~50%
- [ ] Incremental indexing skips unchanged files correctly
- [ ] Error messages provide actionable recovery steps
- [ ] All 245 tests passing

### Performance Requirements
- [ ] Incremental indexing 10x faster than full reindex
- [ ] Compression ratio: ~50% for typical code
- [ ] Compression/decompression: < 5ms overhead per chunk
- [ ] Progress updates: < 1ms overhead

### UX Requirements
- [ ] Clear visual feedback during operations
- [ ] Color-coded output for different message types
- [ ] Helpful error messages with recovery suggestions
- [ ] Status command shows actionable insights

---

## Risk Register

### High Priority Risks
**None identified** - Week 9 is mostly UX improvements

### Medium Priority Risks

1. **Terminal compatibility issues**
   - Impact: Medium (broken progress bars on some terminals)
   - Likelihood: Medium
   - Mitigation:
     - Test on common terminals (iTerm, Terminal.app, Windows Terminal)
     - Provide `--no-progress` fallback
     - Detect terminal capabilities

2. **Compression performance overhead**
   - Impact: Medium (slower indexing)
   - Likelihood: Low
   - Mitigation:
     - LZ4 is very fast (> 100 MB/s)
     - Only compress chunks > 100 bytes
     - Make compression optional

3. **Incremental indexing false negatives**
   - Impact: High (missed updates)
   - Likelihood: Low
   - Mitigation:
     - Hash-based change detection
     - `--force` flag to override
     - Comprehensive tests

### Low Priority Risks
- Color output on non-color terminals (graceful degradation)
- Progress bar flicker on slow systems (throttle updates)
- Database migration failures (backup & rollback)

---

## Performance Targets Summary

### Progress UI
| Operation | Target | Notes |
|-----------|--------|-------|
| Progress update | < 1ms | Per file indexed |
| ETA calculation | < 1ms | Averaged over last 10 files |
| Terminal refresh | 60 FPS | Smooth animations |

### Compression
| Metric | Target | Notes |
|--------|--------|-------|
| Compression ratio | ~50% | For typical code |
| Compression speed | > 100 MB/s | LZ4 fast mode |
| Decompression speed | > 500 MB/s | LZ4 decode |
| Space savings | -50% | 10MB → 5MB per 1K files |

### Incremental Indexing
| Metric | Target | Notes |
|--------|--------|-------|
| Change detection | < 1ms/file | Hash comparison |
| Speedup | 10x | Skip 90% unchanged files |
| Accuracy | 100% | No false negatives |

---

## Example Usage

### Progress Bar
```bash
# Index with progress bar
ax index src/

# Output:
# ████████████████████░░░░░░░░░░░░░░░░░░░░ 52.3% ETA: 12s (45.2/s)
# src/services/FileService.ts
```

### Status Command
```bash
ax status

# Output:
# Index Status
#
#   Total files:    1,234
#   Indexed:        1,150
#   Outdated:       42
#   New:            42
#   Coverage:       93.2%
#
# Storage
#
#   Database size:  5.2 MB
#   Compression:    2.1x
#
# ⚠ Run 'ax index' to update 42 outdated files
```

### Error Message
```bash
ax index broken.ts

# Output:
# Error: Failed to parse typescript file: broken.ts
#
# Context:
#   filePath: broken.ts
#   language: typescript
#   originalError: Unexpected token
#
# Possible solutions:
#   1. Check if the file has valid syntax
#   2. Try running a linter on the file
#   3. Verify typescript parser is installed
#   4. File may contain unsupported language features
```

---

## Next Steps (Immediate Actions)

### Ready to Execute
**Current Status**: Week 8 ✅ Complete (prerequisite)

**Next Task**: Week 9 Day 1 - Progress Tracking Infrastructure
1. Create ProgressTracker service
2. Implement progress calculation with ETA
3. Add event emitters for progress updates
4. Integrate with FileService
5. Write 5 tests

**Estimated time**: 5 hours

---

## Key Decisions & Trade-offs

### Technical Decisions
1. **LZ4 over gzip**: Prioritize speed over compression ratio (LZ4 10x faster)
2. **Hash-based change detection**: Content hash vs mtime (more reliable)
3. **Client-side compression**: Compress on write, decompress on read
4. **Progress bar in stderr**: Keeps stdout clean for piping

### Performance Trade-offs
1. **Compression overhead**: +5ms per chunk vs -50% storage
2. **Progress updates**: Small overhead for better UX
3. **Color output**: Slightly slower but much better readability

### Feature Prioritization
1. **Week 9 (P1.2)**: UX improvements (progress, compression)
2. **Week 10 (P1.3)**: Final polish and optimization
3. **P2**: Advanced features (cross-project, plugins)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Status**: Planning Complete, Ready for Execution
**Prerequisites**: Week 8 completion (semantic search, embeddings)
**Next Review**: End of Week 9
