/**
 * ChunkDAO.test.ts
 * Tests for ChunkDAO and FTS5 full-text search
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ChunkDAO } from '../ChunkDAO.js';
import { FileDAO } from '../FileDAO.js';
import { runMigrations } from '../../migrations.js';
import { unlinkSync } from 'fs';
describe('ChunkDAO', () => {
    let db;
    let chunkDAO;
    let fileDAO;
    let testDbPath;
    beforeEach(() => {
        // Create fresh database for each test with unique name
        testDbPath = `./test-chunk-dao-${Date.now()}-${Math.random()}.db`;
        db = new Database(testDbPath);
        runMigrations(db);
        chunkDAO = new ChunkDAO(db);
        fileDAO = new FileDAO(db);
    });
    afterEach(() => {
        db.close();
        try {
            unlinkSync(testDbPath);
        }
        catch (e) {
            // Ignore if file doesn't exist
        }
    });
    describe('insert', () => {
        it('should insert a new chunk', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'function calculate() { return 42; }',
                language: 'typescript',
            });
            const chunkId = chunkDAO.insert({
                file_id: fileId,
                content: 'function calculate() { return 42; }',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            expect(chunkId).toBeGreaterThan(0);
        });
    });
    describe('search (FTS5)', () => {
        it('should find chunks by single term', () => {
            // Insert test data
            const fileId = fileDAO.insert({
                path: '/test/calculator.ts',
                content: 'function calculate() { return 42; }',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function calculate() { return 42; }',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            const results = chunkDAO.search('calculate');
            expect(results).toHaveLength(1);
            expect(results[0].content).toContain('calculate');
        });
        it('should find chunks with boolean OR', () => {
            const fileId = fileDAO.insert({
                path: '/test/mixed.ts',
                content: 'function calculate() {} function process() {}',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function calculate() {}',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function process() {}',
                start_line: 2,
                end_line: 2,
                chunk_type: 'function',
            });
            const results = chunkDAO.search('calculate OR process');
            expect(results.length).toBeGreaterThanOrEqual(1);
        });
        it('should find chunks with boolean AND', () => {
            const fileId = fileDAO.insert({
                path: '/test/and.ts',
                content: 'function test() { return true; }',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function test() { return true; }',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            const results = chunkDAO.search('function AND return');
            expect(results.length).toBeGreaterThan(0);
        });
        it('should return empty for no matches', () => {
            const results = chunkDAO.search('nonexistent');
            expect(results).toEqual([]);
        });
        it('should rank results by BM25', () => {
            const fileId = fileDAO.insert({
                path: '/test/rank.ts',
                content: 'function test() {}',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function test() {}',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            const results = chunkDAO.search('function');
            expect(results.length).toBeGreaterThan(0);
            // BM25 ranks are negative, more negative = less relevant
            expect(results[0].rank).toBeDefined();
        });
        it('should respect limit parameter', () => {
            const fileId = fileDAO.insert({
                path: '/test/limit.ts',
                content: 'function a() {} function b() {}',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function a() {}',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function b() {}',
                start_line: 2,
                end_line: 2,
                chunk_type: 'function',
            });
            const results = chunkDAO.search('function', 1);
            expect(results).toHaveLength(1);
        });
    });
    describe('findByFileId', () => {
        it('should find all chunks for a file', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'function a() {} function b() {}',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function a() {}',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function b() {}',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            const chunks = chunkDAO.findByFileId(fileId);
            expect(chunks).toHaveLength(2);
        });
    });
    describe('deleteByFileId', () => {
        it('should delete all chunks for a file', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'function a() {}',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'function a() {}',
                start_line: 1,
                end_line: 1,
                chunk_type: 'function',
            });
            chunkDAO.deleteByFileId(fileId);
            const chunks = chunkDAO.findByFileId(fileId);
            expect(chunks).toEqual([]);
        });
    });
    describe('FTS5 synchronization', () => {
        it('should automatically index new chunks in FTS5', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'const uniqueTerm = "test";',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'const uniqueTerm = "test";',
                start_line: 1,
                end_line: 1,
                chunk_type: 'variable',
            });
            // Should be able to search immediately
            const results = chunkDAO.search('uniqueTerm');
            expect(results).toHaveLength(1);
        });
        it('should remove from FTS5 when chunk deleted', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'const deleteTerm = "test";',
                language: 'typescript',
            });
            chunkDAO.insert({
                file_id: fileId,
                content: 'const deleteTerm = "test";',
                start_line: 1,
                end_line: 1,
                chunk_type: 'variable',
            });
            // Verify searchable
            let results = chunkDAO.search('deleteTerm');
            expect(results.length).toBeGreaterThan(0);
            // Delete all chunks for file
            chunkDAO.deleteByFileId(fileId);
            // Should no longer be searchable
            results = chunkDAO.search('deleteTerm');
            expect(results).toEqual([]);
        });
    });
});
//# sourceMappingURL=ChunkDAO.test.js.map