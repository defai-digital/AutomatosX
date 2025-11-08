/**
 * FileDAO.test.ts
 * Tests for FileDAO database operations
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { FileDAO } from '../FileDAO.js';
import { runMigrations } from '../../migrations.js';
import { unlinkSync } from 'fs';
describe('FileDAO', () => {
    let db;
    let fileDAO;
    let testDbPath;
    beforeEach(() => {
        // Create fresh database for each test with unique name
        testDbPath = `./test-file-dao-${Date.now()}-${Math.random()}.db`;
        db = new Database(testDbPath);
        runMigrations(db);
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
        it('should insert a new file', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            expect(fileId).toBeGreaterThan(0);
        });
        it('should return different IDs for different files', () => {
            const id1 = fileDAO.insert({
                path: '/test/file1.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            const id2 = fileDAO.insert({
                path: '/test/file2.ts',
                content: 'const y = 2;',
                language: 'typescript',
            });
            expect(id1).not.toBe(id2);
        });
    });
    describe('findByPath', () => {
        it('should find file by path', () => {
            const insertedId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            const found = fileDAO.findByPath('/test/example.ts');
            expect(found).toBeDefined();
            expect(found?.id).toBe(insertedId);
            expect(found?.path).toBe('/test/example.ts');
            expect(found?.content).toBe('const x = 1;');
            expect(found?.language).toBe('typescript');
        });
        it('should return undefined for non-existent path', () => {
            const found = fileDAO.findByPath('/nonexistent/file.ts');
            expect(found).toBeUndefined();
        });
    });
    describe('update', () => {
        it('should update file content', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            fileDAO.update(fileId, {
                content: 'const x = 2;',
            });
            const found = fileDAO.findById(fileId);
            expect(found?.content).toBe('const x = 2;');
        });
        it('should update file path', () => {
            const fileId = fileDAO.insert({
                path: '/test/old.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            fileDAO.update(fileId, {
                path: '/test/new.ts',
            });
            const found = fileDAO.findById(fileId);
            expect(found?.path).toBe('/test/new.ts');
        });
    });
    describe('delete', () => {
        it('should delete file by ID', () => {
            const fileId = fileDAO.insert({
                path: '/test/example.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            fileDAO.delete(fileId);
            const found = fileDAO.findById(fileId);
            expect(found).toBeUndefined();
        });
        it('should delete nothing if ID does not exist', () => {
            // Should not throw
            expect(() => fileDAO.delete(9999)).not.toThrow();
        });
    });
    describe('findAll', () => {
        it('should return empty array when no files', () => {
            const files = fileDAO.findAll();
            expect(files).toEqual([]);
        });
        it('should return all files', () => {
            fileDAO.insert({
                path: '/test/file1.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            fileDAO.insert({
                path: '/test/file2.ts',
                content: 'const y = 2;',
                language: 'typescript',
            });
            const files = fileDAO.findAll();
            expect(files).toHaveLength(2);
        });
    });
    describe('clear', () => {
        it('should delete all files', () => {
            fileDAO.insert({
                path: '/test/file1.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            fileDAO.insert({
                path: '/test/file2.ts',
                content: 'const y = 2;',
                language: 'typescript',
            });
            fileDAO.clear();
            const files = fileDAO.findAll();
            expect(files).toEqual([]);
        });
    });
    describe('count', () => {
        it('should return 0 when no files', () => {
            expect(fileDAO.count()).toBe(0);
        });
        it('should return correct count', () => {
            fileDAO.insert({
                path: '/test/file1.ts',
                content: 'const x = 1;',
                language: 'typescript',
            });
            fileDAO.insert({
                path: '/test/file2.ts',
                content: 'const y = 2;',
                language: 'typescript',
            });
            expect(fileDAO.count()).toBe(2);
        });
    });
});
//# sourceMappingURL=FileDAO.test.js.map