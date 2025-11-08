/**
 * Database Performance Benchmarks
 *
 * Measures database operation performance (SQLite)
 * Targets:
 * - Insert: < 1ms per record
 * - Query: < 10ms for typical queries
 * - FTS search: < 50ms for full-text search
 */
import { describe, bench, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { FileDao } from '../database/FileDao.js';
import { SymbolDao } from '../database/SymbolDao.js';
import { ChunkDao } from '../database/ChunkDao.js';
import { runMigrations } from '../database/migrations.js';
import fs from 'fs';
import path from 'path';
const TEST_DB_PATH = path.join(process.cwd(), '.test-benchmark.db');
function setupTestDb() {
    // Clean up existing test DB
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
    const db = new Database(TEST_DB_PATH);
    runMigrations(db);
    return db;
}
function cleanupTestDb(db) {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
}
describe('FileDao Performance', () => {
    let db;
    let fileDao;
    beforeEach(() => {
        db = setupTestDb();
        fileDao = new FileDao(db);
    });
    afterEach(() => {
        cleanupTestDb(db);
    });
    bench('insert single file', () => {
        fileDao.insert({
            path: `/test/file-${Math.random()}.ts`,
            language: 'typescript',
            size: 1024,
            lastModified: Date.now(),
            lastIndexed: Date.now(),
        });
    });
    bench('insert 100 files (batch)', () => {
        const stmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        const insertMany = db.transaction((count) => {
            for (let i = 0; i < count; i++) {
                stmt.run(`/test/file-${i}.ts`, 'typescript', 1024, Date.now(), Date.now());
            }
        });
        insertMany(100);
    });
    bench('query file by path', () => {
        // Setup: insert 1000 files
        const stmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            stmt.run(`/test/file-${i}.ts`, 'typescript', 1024, Date.now(), Date.now());
        }
        // Benchmark query
        fileDao.getByPath('/test/file-500.ts');
    });
    bench('query files by language', () => {
        // Setup: insert 1000 files (mix of languages)
        const languages = ['typescript', 'python', 'go', 'java', 'rust'];
        const stmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            const lang = languages[i % languages.length];
            stmt.run(`/test/file-${i}.${lang}`, lang, 1024, Date.now(), Date.now());
        }
        // Benchmark query
        fileDao.getByLanguage('typescript');
    });
    bench('list all files (1000 records)', () => {
        // Setup: insert 1000 files
        const stmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            stmt.run(`/test/file-${i}.ts`, 'typescript', 1024, Date.now(), Date.now());
        }
        // Benchmark list
        fileDao.list();
    });
});
describe('SymbolDao Performance', () => {
    let db;
    let symbolDao;
    let fileDao;
    let fileId;
    beforeEach(() => {
        db = setupTestDb();
        symbolDao = new SymbolDao(db);
        fileDao = new FileDao(db);
        // Insert a test file
        fileId = fileDao.insert({
            path: '/test/file.ts',
            language: 'typescript',
            size: 1024,
            lastModified: Date.now(),
            lastIndexed: Date.now(),
        });
    });
    afterEach(() => {
        cleanupTestDb(db);
    });
    bench('insert single symbol', () => {
        symbolDao.insert({
            fileId,
            name: `function${Math.random()}`,
            kind: 'function',
            signature: 'function test(): void',
            startLine: 10,
            endLine: 20,
            docstring: null,
        });
    });
    bench('insert 100 symbols (batch)', () => {
        const stmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = db.transaction((count) => {
            for (let i = 0; i < count; i++) {
                stmt.run(fileId, `function${i}`, 'function', `function fn${i}(): void`, i * 10, i * 10 + 5, null);
            }
        });
        insertMany(100);
    });
    bench('query symbols by file_id', () => {
        // Setup: insert 100 symbols
        const stmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 100; i++) {
            stmt.run(fileId, `fn${i}`, 'function', `function fn${i}()`, i, i + 1, null);
        }
        // Benchmark query
        symbolDao.getByFileId(fileId);
    });
    bench('query symbol by name', () => {
        // Setup: insert 1000 symbols
        const stmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            stmt.run(fileId, `function${i}`, 'function', `function fn${i}()`, i, i + 1, null);
        }
        // Benchmark query
        symbolDao.getByName('function500');
    });
    bench('query symbols by kind', () => {
        // Setup: insert 500 functions + 500 classes
        const stmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 500; i++) {
            stmt.run(fileId, `fn${i}`, 'function', `function fn${i}()`, i, i + 1, null);
            stmt.run(fileId, `Class${i}`, 'class', `class C${i}`, i, i + 10, null);
        }
        // Benchmark query
        symbolDao.getByKind('function');
    });
});
describe('ChunkDao and FTS Performance', () => {
    let db;
    let chunkDao;
    let fileDao;
    let symbolDao;
    let fileId;
    let symbolId;
    beforeEach(() => {
        db = setupTestDb();
        chunkDao = new ChunkDao(db);
        fileDao = new FileDao(db);
        symbolDao = new SymbolDao(db);
        // Insert test file and symbol
        fileId = fileDao.insert({
            path: '/test/file.ts',
            language: 'typescript',
            size: 1024,
            lastModified: Date.now(),
            lastIndexed: Date.now(),
        });
        symbolId = symbolDao.insert({
            fileId,
            name: 'testFunction',
            kind: 'function',
            signature: 'function test(): void',
            startLine: 1,
            endLine: 10,
            docstring: null,
        });
    });
    afterEach(() => {
        cleanupTestDb(db);
    });
    bench('insert single chunk', () => {
        chunkDao.insert({
            fileId,
            symbolId,
            content: `function test${Math.random()}() {\n  return 42;\n}`,
            startLine: 1,
            endLine: 3,
            tokens: 10,
        });
    });
    bench('insert 100 chunks (batch)', () => {
        const stmt = db.prepare(`
      INSERT INTO chunks (file_id, symbol_id, content, start_line, end_line, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const insertMany = db.transaction((count) => {
            for (let i = 0; i < count; i++) {
                stmt.run(fileId, symbolId, `function test${i}() { return ${i}; }`, i * 5, i * 5 + 3, 15);
            }
        });
        insertMany(100);
    });
    bench('FTS search (simple keyword, 1000 chunks)', () => {
        // Setup: insert 1000 chunks with varied content
        const stmt = db.prepare(`
      INSERT INTO chunks (file_id, symbol_id, content, start_line, end_line, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            const content = i % 10 === 0
                ? `function authenticate() { return true; }` // 10% contain "authenticate"
                : `function test${i}() { return ${i}; }`;
            stmt.run(fileId, symbolId, content, i, i + 1, 20);
        }
        // Benchmark FTS search
        chunkDao.search('authenticate', 10);
    });
    bench('FTS search (phrase query, 1000 chunks)', () => {
        // Setup: insert 1000 chunks
        const stmt = db.prepare(`
      INSERT INTO chunks (file_id, symbol_id, content, start_line, end_line, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            const content = i % 20 === 0
                ? `async function fetchUserData() { return await api.get('/users'); }`
                : `function test${i}() { return ${i}; }`;
            stmt.run(fileId, symbolId, content, i, i + 1, 30);
        }
        // Benchmark phrase search
        chunkDao.search('"async function"', 10);
    });
    bench('FTS search (multi-term query, 1000 chunks)', () => {
        // Setup: insert 1000 chunks
        const stmt = db.prepare(`
      INSERT INTO chunks (file_id, symbol_id, content, start_line, end_line, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            const content = `function calculate${i}(a, b) { return a + b * ${i}; }`;
            stmt.run(fileId, symbolId, content, i, i + 1, 25);
        }
        // Benchmark multi-term search
        chunkDao.search('calculate return', 10);
    });
});
describe('Database Transaction Performance', () => {
    let db;
    beforeEach(() => {
        db = setupTestDb();
    });
    afterEach(() => {
        cleanupTestDb(db);
    });
    bench('1000 inserts WITHOUT transaction', () => {
        const stmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 1000; i++) {
            stmt.run(`/test/file-${i}.ts`, 'typescript', 1024, Date.now(), Date.now());
        }
    });
    bench('1000 inserts WITH transaction', () => {
        const stmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        const insertMany = db.transaction((count) => {
            for (let i = 0; i < count; i++) {
                stmt.run(`/test/file-${i}.ts`, 'typescript', 1024, Date.now(), Date.now());
            }
        });
        insertMany(1000);
    });
});
describe('Index Performance', () => {
    let db;
    beforeEach(() => {
        db = setupTestDb();
    });
    afterEach(() => {
        cleanupTestDb(db);
    });
    bench('query WITH index (idx_symbols_file_id)', () => {
        // Setup: insert 10000 symbols
        const fileStmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        const fileId = fileStmt.run('/test/file.ts', 'typescript', 1024, Date.now(), Date.now()).lastInsertRowid;
        const symbolStmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 10000; i++) {
            symbolStmt.run(fileId, `fn${i}`, 'function', `function fn${i}()`, i, i + 1, null);
        }
        // Benchmark: query should use idx_symbols_file_id
        db.prepare('SELECT * FROM symbols WHERE file_id = ?').all(fileId);
    });
    bench('query WITH index (idx_symbols_name)', () => {
        // Setup: insert 10000 symbols
        const fileStmt = db.prepare(`
      INSERT INTO files (path, language, size, last_modified, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `);
        const fileId = fileStmt.run('/test/file.ts', 'typescript', 1024, Date.now(), Date.now()).lastInsertRowid;
        const symbolStmt = db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (let i = 0; i < 10000; i++) {
            symbolStmt.run(fileId, `function${i}`, 'function', `function fn${i}()`, i, i + 1, null);
        }
        // Benchmark: query should use idx_symbols_name
        db.prepare('SELECT * FROM symbols WHERE name = ?').get('function5000');
    });
});
//# sourceMappingURL=database.bench.js.map