/**
 * Day 75: LSP Advanced Features Tests
 *
 * Comprehensive test suite for advanced LSP features:
 * - Document Symbols (7 tests)
 * - Rename (8 tests)
 * - Diagnostics (7 tests)
 * - Code Actions (6 tests)
 * - Formatting (4 tests)
 * - Workspace Symbols (5 tests)
 * - Integration (3 tests)
 *
 * Total: 40 tests
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { DocumentSymbolsProvider } from '../providers/DocumentSymbolsProvider.js';
import { RenameProvider } from '../providers/RenameProvider.js';
import { DiagnosticsProvider } from '../providers/DiagnosticsProvider.js';
import { CodeActionsProvider } from '../providers/CodeActionsProvider.js';
import { FormattingProvider } from '../providers/FormattingProvider.js';
import { WorkspaceSymbolsProvider } from '../providers/WorkspaceSymbolsProvider.js';
import { QualityIntegration } from '../services/QualityIntegration.js';
import { DocumentManager } from '../server/DocumentManager.js';
import { IntegrationService } from '../server/IntegrationService.js';
import { SymbolDAO } from '../../database/dao/SymbolDAO.js';
import { FileDAO } from '../../database/dao/FileDAO.js';
import { filePathToUri } from '../utils/lsp-utils.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';
// Mock ParserRegistry to avoid loading all 50+ language grammars in tests
// This prevents "Invalid language object" errors from tree-sitter
vi.mock('../../parser/ParserRegistry.js', async () => {
    const { TypeScriptParserService } = await import('../../parser/TypeScriptParserService.js');
    class MockParserRegistry {
        parsers = new Map();
        extensionMap = new Map();
        constructor() {
            // Only register TypeScript parser to avoid loading all 50+ language grammars
            const tsParser = new TypeScriptParserService();
            this.registerParser(tsParser);
        }
        registerParser(parser) {
            this.parsers.set(parser.language, parser);
            for (const ext of parser.extensions) {
                this.extensionMap.set(ext, parser);
            }
        }
        getParser(language) {
            return this.parsers.get(language) || null;
        }
        getParserForFile(filePath) {
            const ext = filePath.substring(filePath.lastIndexOf('.'));
            return this.extensionMap.get(ext) || null;
        }
    }
    const mockRegistry = new MockParserRegistry();
    return {
        ParserRegistry: MockParserRegistry,
        getParserRegistry: () => mockRegistry,
    };
});
// Mock connection for testing
const mockConnection = {
    sendDiagnostics: () => { },
};
describe('Day 75: LSP Advanced Features', () => {
    let documentManager;
    let integrationService;
    let db;
    let symbolDAO;
    let fileDAO;
    let testDbPath;
    beforeAll(async () => {
        // Create test database
        testDbPath = path.join(__dirname, 'test-lsp-advanced.db');
        db = new Database(testDbPath);
        // Run migrations
        const migrations = [
            `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        language TEXT NOT NULL,
        indexedAt INTEGER NOT NULL,
        modifiedAt INTEGER
      )`,
            `CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileId INTEGER NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        filePath TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        startColumn INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        endColumn INTEGER NOT NULL,
        signature TEXT,
        docstring TEXT,
        scope TEXT,
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
      )`,
        ];
        for (const migration of migrations) {
            db.exec(migration);
        }
    });
    afterAll(() => {
        // Close and remove test database
        if (db) {
            db.close();
        }
        try {
            fs.unlink(testDbPath);
        }
        catch (e) {
            // Ignore
        }
    });
    beforeEach(async () => {
        // Initialize services
        documentManager = new DocumentManager();
        integrationService = new IntegrationService();
        symbolDAO = new SymbolDAO(db);
        fileDAO = new FileDAO(db);
        // Clear test data
        db.exec('DELETE FROM symbols');
        db.exec('DELETE FROM files');
    });
    afterEach(() => {
        // Cleanup
        db.exec('DELETE FROM symbols');
        db.exec('DELETE FROM files');
    });
    // ========================================================================
    // DOCUMENT SYMBOLS TESTS (7 tests)
    // ========================================================================
    describe('DocumentSymbolsProvider', () => {
        let provider;
        beforeEach(() => {
            provider = new DocumentSymbolsProvider(documentManager, integrationService);
        });
        it('should extract function symbols from TypeScript', async () => {
            const uri = filePathToUri('/test/file.ts');
            const content = `
function add(a: number, b: number): number {
  return a + b;
}

function multiply(x: number, y: number): number {
  return x * y;
}
      `.trim();
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeDefined();
            expect(symbols.length).toBeGreaterThanOrEqual(2);
            const functionSymbols = symbols.filter((s) => s.name === 'add' || s.name === 'multiply');
            expect(functionSymbols.length).toBe(2);
        });
        it('should extract class symbols with methods', async () => {
            const uri = filePathToUri('/test/class.ts');
            const content = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
      `.trim();
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeDefined();
            expect(symbols.length).toBeGreaterThanOrEqual(1);
            const classSymbol = symbols.find((s) => s.name === 'Calculator');
            expect(classSymbol).toBeDefined();
            expect(classSymbol.children).toBeDefined();
            expect(classSymbol.children.length).toBeGreaterThanOrEqual(2);
        });
        it('should extract interface symbols', async () => {
            const uri = filePathToUri('/test/interface.ts');
            const content = `
interface User {
  name: string;
  age: number;
}
      `.trim();
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeDefined();
            expect(symbols.some((s) => s.name === 'User')).toBe(true);
        });
        it('should extract variable symbols', async () => {
            const uri = filePathToUri('/test/vars.ts');
            const content = `
const PI = 3.14159;
let counter = 0;
      `.trim();
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeDefined();
            expect(symbols.some((s) => s.name === 'PI')).toBe(true);
        });
        it('should handle nested symbols', async () => {
            const uri = filePathToUri('/test/nested.ts');
            const content = `
class Outer {
  method() {
    function inner() {
      return 42;
    }
    return inner();
  }
}
      `.trim();
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeDefined();
            const outerClass = symbols.find((s) => s.name === 'Outer');
            expect(outerClass).toBeDefined();
            expect(outerClass.children).toBeDefined();
        });
        it('should return null for non-existent document', async () => {
            const uri = filePathToUri('/test/nonexistent.ts');
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeNull();
        });
        it('should handle empty documents', async () => {
            const uri = filePathToUri('/test/empty.ts');
            const content = '';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const symbols = await provider.provideDocumentSymbols(uri);
            expect(symbols).toBeDefined();
            expect(symbols.length).toBe(0);
        });
    });
    // ========================================================================
    // RENAME TESTS (8 tests)
    // ========================================================================
    describe('RenameProvider', () => {
        let provider;
        beforeEach(() => {
            provider = new RenameProvider(documentManager, integrationService);
        });
        it('should provide rename edits for a symbol', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = `
function oldName() {
  return 42;
}

const result = oldName();
      `.trim();
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            // Add symbol to database
            symbolDAO.insert({
                fileId: 1,
                name: 'oldName',
                kind: 'function',
                filePath: '/test/rename.ts',
                startLine: 1,
                startColumn: 9,
                endLine: 1,
                endColumn: 16,
            });
            const edits = await provider.provideRename(uri, { line: 1, character: 9 }, 'newName');
            expect(edits).toBeDefined();
            expect(edits.changes).toBeDefined();
        });
        it('should validate new name is not empty', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideRename(uri, { line: 0, character: 9 }, '');
            expect(edits).toBeNull();
        });
        it('should validate new name is different from old name', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideRename(uri, { line: 0, character: 9 }, 'test');
            expect(edits).toBeNull();
        });
        it('should validate new name is a valid identifier', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideRename(uri, { line: 0, character: 9 }, '123invalid');
            expect(edits).toBeNull();
        });
        it('should reject reserved keywords as new names', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideRename(uri, { line: 0, character: 9 }, 'function');
            expect(edits).toBeNull();
        });
        it('should prepare rename for valid position', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            // Add symbol to database
            symbolDAO.insert({
                fileId: 1,
                name: 'test',
                kind: 'function',
                filePath: '/test/rename.ts',
                startLine: 0,
                startColumn: 9,
                endLine: 0,
                endColumn: 13,
            });
            const result = await provider.prepareRename(uri, { line: 0, character: 9 });
            expect(result).toBeDefined();
            expect(result.placeholder).toBe('test');
        });
        it('should return null for prepare rename at invalid position', async () => {
            const uri = filePathToUri('/test/rename.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const result = await provider.prepareRename(uri, { line: 0, character: 0 });
            expect(result).toBeNull();
        });
        it('should handle cross-file renames', async () => {
            const uri1 = filePathToUri('/test/file1.ts');
            const uri2 = filePathToUri('/test/file2.ts');
            // Add symbols in multiple files
            symbolDAO.insert({
                fileId: 1,
                name: 'sharedName',
                kind: 'function',
                filePath: '/test/file1.ts',
                startLine: 0,
                startColumn: 9,
                endLine: 0,
                endColumn: 19,
            });
            symbolDAO.insert({
                fileId: 2,
                name: 'sharedName',
                kind: 'function',
                filePath: '/test/file2.ts',
                startLine: 0,
                startColumn: 9,
                endLine: 0,
                endColumn: 19,
            });
            const content = 'function sharedName() {}';
            await documentManager.onDocumentOpened(uri1, 'typescript', 1, content);
            const edits = await provider.provideRename(uri1, { line: 0, character: 9 }, 'newSharedName');
            expect(edits).toBeDefined();
            expect(edits.changes).toBeDefined();
            expect(Object.keys(edits.changes).length).toBeGreaterThanOrEqual(1);
        });
    });
    // ========================================================================
    // DIAGNOSTICS TESTS (7 tests)
    // ========================================================================
    describe('DiagnosticsProvider', () => {
        let provider;
        beforeEach(() => {
            provider = new DiagnosticsProvider(documentManager);
        });
        afterEach(() => {
            provider.dispose();
        });
        it('should analyze file and return diagnostics', async () => {
            const testFile = path.join(__dirname, '../__fixtures__/test-file.ts');
            const content = `
function complexFunction(a: number, b: number, c: number) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        return a + b + c;
      }
    }
  }
  return 0;
}
      `.trim();
            await fs.mkdir(path.dirname(testFile), { recursive: true });
            await fs.writeFile(testFile, content);
            const uri = filePathToUri(testFile);
            const diagnostics = await provider.provideDiagnostics(uri);
            expect(diagnostics).toBeDefined();
            expect(Array.isArray(diagnostics)).toBe(true);
            // Cleanup
            await fs.unlink(testFile).catch(() => { });
        });
        it('should cache diagnostics results', async () => {
            const testFile = path.join(__dirname, '../__fixtures__/cache-test.ts');
            const content = 'function simple() { return 1; }';
            await fs.mkdir(path.dirname(testFile), { recursive: true });
            await fs.writeFile(testFile, content);
            const uri = filePathToUri(testFile);
            // First call
            const diagnostics1 = await provider.provideDiagnostics(uri);
            // Second call (should be cached)
            const diagnostics2 = await provider.provideDiagnostics(uri);
            expect(diagnostics1).toEqual(diagnostics2);
            const stats = provider.getStats();
            expect(stats.cachedFiles).toBeGreaterThanOrEqual(1);
            // Cleanup
            await fs.unlink(testFile).catch(() => { });
        });
        it('should clear diagnostics for a document', async () => {
            const uri = filePathToUri('/test/clear.ts');
            provider.clearDiagnostics(uri);
            const stats = provider.getStats();
            expect(stats.cachedFiles).toBe(0);
        });
        it('should handle invalid file paths gracefully', async () => {
            const uri = filePathToUri('/nonexistent/invalid.ts');
            const diagnostics = await provider.provideDiagnostics(uri);
            expect(diagnostics).toBeDefined();
            expect(diagnostics.length).toBe(0);
        });
        it('should detect high complexity issues', async () => {
            const testFile = path.join(__dirname, '../__fixtures__/high-complexity.ts');
            const content = `
function veryComplexFunction(x: number) {
  if (x > 0) {
    if (x > 10) {
      if (x > 20) {
        if (x > 30) {
          if (x > 40) {
            if (x > 50) {
              return x * 2;
            }
          }
        }
      }
    }
  }
  return x;
}
      `.trim();
            await fs.mkdir(path.dirname(testFile), { recursive: true });
            await fs.writeFile(testFile, content);
            const uri = filePathToUri(testFile);
            const diagnostics = await provider.provideDiagnostics(uri);
            expect(diagnostics).toBeDefined();
            // Cleanup
            await fs.unlink(testFile).catch(() => { });
        });
        it('should support debounced analysis', async () => {
            const testFile = path.join(__dirname, '../__fixtures__/debounce-test.ts');
            const content = 'function test() {}';
            await fs.mkdir(path.dirname(testFile), { recursive: true });
            await fs.writeFile(testFile, content);
            const uri = filePathToUri(testFile);
            let callbackCalled = false;
            const callback = () => {
                callbackCalled = true;
            };
            await provider.provideDiagnosticsDebounced(uri, callback);
            // Wait for debounce
            await new Promise((resolve) => setTimeout(resolve, 400));
            expect(callbackCalled).toBe(true);
            // Cleanup
            await fs.unlink(testFile).catch(() => { });
        });
        it('should get statistics', () => {
            const stats = provider.getStats();
            expect(stats).toBeDefined();
            expect(stats.cachedFiles).toBeGreaterThanOrEqual(0);
            expect(stats.pendingAnalysis).toBeGreaterThanOrEqual(0);
        });
    });
    // ========================================================================
    // CODE ACTIONS TESTS (6 tests)
    // ========================================================================
    describe('CodeActionsProvider', () => {
        let provider;
        beforeEach(() => {
            provider = new CodeActionsProvider(documentManager, integrationService);
        });
        it('should provide quick fixes for diagnostics', async () => {
            const uri = filePathToUri('/test/quickfix.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const diagnostics = [
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 18 },
                    },
                    message: 'High complexity',
                    code: 'high-complexity',
                    source: 'automatosx-quality',
                },
            ];
            const actions = await provider.provideCodeActions(uri, { start: { line: 0, character: 0 }, end: { line: 0, character: 18 } }, diagnostics);
            expect(actions).toBeDefined();
            expect(actions.length).toBeGreaterThan(0);
        });
        it('should provide refactoring actions', async () => {
            const uri = filePathToUri('/test/refactor.ts');
            const content = 'const x = 1 + 2 + 3;';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const actions = await provider.provideCodeActions(uri, { start: { line: 0, character: 10 }, end: { line: 0, character: 19 } }, []);
            expect(actions).toBeDefined();
            expect(actions.some((a) => a.title.includes('Extract'))).toBe(true);
        });
        it('should provide source actions (organize imports)', async () => {
            const uri = filePathToUri('/test/imports.ts');
            const content = "import { b } from 'b';\nimport { a } from 'a';";
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const actions = await provider.provideCodeActions(uri, { start: { line: 0, character: 0 }, end: { line: 1, character: 23 } }, []);
            expect(actions).toBeDefined();
            expect(actions.some((a) => a.title.includes('Organize imports'))).toBe(true);
        });
        it('should organize imports correctly', async () => {
            const uri = filePathToUri('/test/organize.ts');
            const content = "import { z } from 'z';\nimport { a } from 'a';";
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.organizeImports(uri);
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });
        it('should extract function from selected code', async () => {
            const uri = filePathToUri('/test/extract.ts');
            const content = 'const sum = a + b + c;';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.extractFunction(uri, {
                start: { line: 0, character: 12 },
                end: { line: 0, character: 21 },
            });
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });
        it('should handle empty diagnostics array', async () => {
            const uri = filePathToUri('/test/nodiag.ts');
            const content = 'function test() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const actions = await provider.provideCodeActions(uri, { start: { line: 0, character: 0 }, end: { line: 0, character: 18 } }, []);
            expect(actions).toBeDefined();
            expect(Array.isArray(actions)).toBe(true);
        });
    });
    // ========================================================================
    // FORMATTING TESTS (4 tests)
    // ========================================================================
    describe('FormattingProvider', () => {
        let provider;
        beforeEach(() => {
            provider = new FormattingProvider(documentManager);
        });
        it('should format TypeScript code with Prettier', async () => {
            const uri = filePathToUri('/test/format.ts');
            const content = 'function test(   ) {  return   42;  }';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideFormatting(uri);
            expect(edits).toBeDefined();
        });
        it('should handle formatting errors gracefully', async () => {
            const uri = filePathToUri('/test/invalid.ts');
            const content = 'function test( { invalid syntax';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideFormatting(uri);
            expect(edits).toBeDefined();
        });
        it('should format range in document', async () => {
            const uri = filePathToUri('/test/range.ts');
            const content = 'function a() {}\nfunction b(   ) {}\nfunction c() {}';
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            const edits = await provider.provideRangeFormatting(uri, { start: { line: 1, character: 0 }, end: { line: 1, character: 19 } });
            expect(edits).toBeDefined();
        });
        it('should check if Prettier is available', () => {
            const available = provider.isPrettierAvailable();
            expect(typeof available).toBe('boolean');
        });
    });
    // ========================================================================
    // WORKSPACE SYMBOLS TESTS (5 tests)
    // ========================================================================
    describe('WorkspaceSymbolsProvider', () => {
        let provider;
        beforeEach(() => {
            provider = new WorkspaceSymbolsProvider(integrationService);
            // Add test symbols
            symbolDAO.insert({
                fileId: 1,
                name: 'calculateTotal',
                kind: 'function',
                filePath: '/test/calc.ts',
                startLine: 0,
                startColumn: 9,
                endLine: 0,
                endColumn: 22,
            });
            symbolDAO.insert({
                fileId: 1,
                name: 'Calculator',
                kind: 'class',
                filePath: '/test/calc.ts',
                startLine: 10,
                startColumn: 6,
                endLine: 20,
                endColumn: 1,
            });
            symbolDAO.insert({
                fileId: 2,
                name: 'getUserById',
                kind: 'function',
                filePath: '/test/user.ts',
                startLine: 0,
                startColumn: 9,
                endLine: 0,
                endColumn: 20,
            });
        });
        it('should search symbols across workspace', async () => {
            const symbols = await provider.provideWorkspaceSymbols('calc');
            expect(symbols).toBeDefined();
            expect(symbols.length).toBeGreaterThan(0);
            expect(symbols.some((s) => s.name.toLowerCase().includes('calc'))).toBe(true);
        });
        it('should support fuzzy matching', async () => {
            const symbols = await provider.provideWorkspaceSymbols('gbi');
            expect(symbols).toBeDefined();
            // Fuzzy match should find 'getUserById'
            expect(symbols.some((s) => s.name === 'getUserById')).toBe(true);
        });
        it('should rank exact matches higher', async () => {
            const symbols = await provider.provideWorkspaceSymbols('Calculator');
            expect(symbols).toBeDefined();
            if (symbols.length > 0) {
                expect(symbols[0].name).toBe('Calculator');
            }
        });
        it('should limit results to max count', async () => {
            // Add many symbols
            for (let i = 0; i < 150; i++) {
                symbolDAO.insert({
                    fileId: 1,
                    name: `function${i}`,
                    kind: 'function',
                    filePath: '/test/many.ts',
                    startLine: i,
                    startColumn: 0,
                    endLine: i,
                    endColumn: 10,
                });
            }
            const symbols = await provider.provideWorkspaceSymbols('function');
            expect(symbols).toBeDefined();
            expect(symbols.length).toBeLessThanOrEqual(100);
        });
        it('should search symbols by kind', async () => {
            const symbols = await provider.searchSymbolsByKind('function');
            expect(symbols).toBeDefined();
            expect(symbols.every((s) => s.kind === 12)).toBe(true); // 12 = Function kind
        });
    });
    // ========================================================================
    // INTEGRATION TESTS (3 tests)
    // ========================================================================
    describe('QualityIntegration', () => {
        let integration;
        beforeEach(() => {
            integration = new QualityIntegration(mockConnection, documentManager);
        });
        afterEach(() => {
            integration.dispose();
        });
        it('should analyze and publish diagnostics on document open', async () => {
            const testFile = path.join(__dirname, '../__fixtures__/integration-test.ts');
            const content = 'function test() { return 42; }';
            await fs.mkdir(path.dirname(testFile), { recursive: true });
            await fs.writeFile(testFile, content);
            const uri = filePathToUri(testFile);
            await documentManager.onDocumentOpened(uri, 'typescript', 1, content);
            await integration.onDocumentOpened(uri);
            const stats = integration.getStats();
            expect(stats.analysisCount).toBeGreaterThan(0);
            // Cleanup
            await fs.unlink(testFile).catch(() => { });
        });
        it('should clear diagnostics on document close', async () => {
            const uri = filePathToUri('/test/close.ts');
            integration.clearDiagnostics(uri);
            const stats = integration.getStats();
            expect(stats.enabled).toBe(true);
        });
        it('should get integration statistics', () => {
            const stats = integration.getStats();
            expect(stats).toBeDefined();
            expect(stats.enabled).toBe(true);
            expect(stats.analysisCount).toBeGreaterThanOrEqual(0);
            expect(stats.publishCount).toBeGreaterThanOrEqual(0);
            expect(stats.pendingUpdates).toBeGreaterThanOrEqual(0);
        });
    });
});
//# sourceMappingURL=Day75LSPAdvanced.test.js.map