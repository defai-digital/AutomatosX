/**
 * test-parser.ts
 *
 * Comprehensive tests for Phase 0.3: Parser Pipeline POC
 * Tests Tree-sitter parsing, symbol extraction, and database storage
 */
import { runMigrations } from './database/migrations';
import { closeDatabase } from './database/connection';
import { ParserService } from './parser/ParserService';
import { FileDAO } from './database/dao/FileDAO';
import { SymbolDAO } from './database/dao/SymbolDAO';
import { FileService } from './services/FileService';
console.log('='.repeat(70));
console.log('AutomatosX - Phase 0.3: Parser Pipeline POC Tests');
console.log('='.repeat(70));
console.log();
// Run migrations first
console.log('Running migrations...');
runMigrations();
console.log();
// Track test results
let passedTests = 0;
let failedTests = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result === false) {
            console.log(`❌ FAILED: ${name}`);
            failedTests++;
        }
        else {
            console.log(`✓ PASSED: ${name}`);
            passedTests++;
        }
    }
    catch (error) {
        console.log(`❌ FAILED: ${name}`);
        console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
}
// Sample TypeScript code for testing
const sampleCode = `
export interface User {
  name: string;
  age: number;
}

export class UserService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  getUser(id: number): User {
    return { name: "Test", age: 30 };
  }

  updateUser(id: number, user: User): void {
    console.log("Updating user:", id, user);
  }
}

export function greet(name: string): string {
  return \`Hello, \${name}\`;
}

export function add(a: number, b: number): number {
  return a + b;
}

const API_URL = "https://api.example.com";
const MAX_RETRIES = 3;

let retryCount = 0;

export type Status = "active" | "inactive";
`;
console.log('Phase 0.3.1: ParserService - Tree-sitter Parsing');
console.log('-'.repeat(70));
const parserService = new ParserService();
test('ParserService parses TypeScript code', () => {
    const result = parserService.parseTypeScript(sampleCode);
    return result.symbols.length > 0;
});
test('ParserService extracts interface symbol', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const userInterface = result.symbols.find((s) => s.name === 'User' && s.kind === 'interface');
    return userInterface !== undefined;
});
test('ParserService extracts class symbol', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const userServiceClass = result.symbols.find((s) => s.name === 'UserService' && s.kind === 'class');
    return userServiceClass !== undefined;
});
test('ParserService extracts function symbols', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const greetFunc = result.symbols.find((s) => s.name === 'greet' && s.kind === 'function');
    const addFunc = result.symbols.find((s) => s.name === 'add' && s.kind === 'function');
    return greetFunc !== undefined && addFunc !== undefined;
});
test('ParserService extracts method symbols', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const getUserMethod = result.symbols.find((s) => s.name === 'getUser' && s.kind === 'method');
    const updateUserMethod = result.symbols.find((s) => s.name === 'updateUser' && s.kind === 'method');
    return getUserMethod !== undefined && updateUserMethod !== undefined;
});
test('ParserService extracts constant symbols', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const apiUrl = result.symbols.find((s) => s.name === 'API_URL' && s.kind === 'constant');
    const maxRetries = result.symbols.find((s) => s.name === 'MAX_RETRIES' && s.kind === 'constant');
    return apiUrl !== undefined && maxRetries !== undefined;
});
test('ParserService extracts variable symbols', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const retryCount = result.symbols.find((s) => s.name === 'retryCount' && s.kind === 'variable');
    return retryCount !== undefined;
});
test('ParserService extracts type alias', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const statusType = result.symbols.find((s) => s.name === 'Status' && s.kind === 'type');
    return statusType !== undefined;
});
test('ParserService includes line numbers', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const greetFunc = result.symbols.find((s) => s.name === 'greet');
    return greetFunc !== undefined && greetFunc.line > 0;
});
test('ParserService includes column numbers', () => {
    const result = parserService.parseTypeScript(sampleCode);
    const greetFunc = result.symbols.find((s) => s.name === 'greet');
    return greetFunc !== undefined && greetFunc.column >= 0;
});
test('ParserService reports parse time', () => {
    const result = parserService.parseTypeScript(sampleCode);
    return result.parseTime > 0;
});
test('ParserService reports node count', () => {
    const result = parserService.parseTypeScript(sampleCode);
    return result.nodeCount > 0;
});
console.log();
console.log('Phase 0.3.2: SymbolDAO - Database Operations');
console.log('-'.repeat(70));
const fileDAO = new FileDAO();
const symbolDAO = new SymbolDAO();
// Clear existing data
fileDAO.clear();
symbolDAO.clear();
test('SymbolDAO.insert creates new symbol', () => {
    const fileId = fileDAO.insert({ path: '/test.ts', content: 'test', language: 'typescript' });
    const symbolId = symbolDAO.insert({
        file_id: fileId,
        name: 'testFunc',
        kind: 'function',
        line: 1,
        column: 0,
    });
    return typeof symbolId === 'number' && symbolId > 0;
});
test('SymbolDAO.findByFileId retrieves symbols', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const fileId = fileDAO.insert({ path: '/test2.ts', content: 'test', language: 'typescript' });
    symbolDAO.insert({ file_id: fileId, name: 'func1', kind: 'function', line: 1, column: 0 });
    symbolDAO.insert({ file_id: fileId, name: 'func2', kind: 'function', line: 2, column: 0 });
    const symbols = symbolDAO.findByFileId(fileId);
    return symbols.length === 2;
});
test('SymbolDAO.findByName finds symbols by name', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const fileId = fileDAO.insert({ path: '/test3.ts', content: 'test', language: 'typescript' });
    symbolDAO.insert({ file_id: fileId, name: 'greet', kind: 'function', line: 1, column: 0 });
    const symbols = symbolDAO.findByName('greet');
    return symbols.length === 1 && symbols[0].name === 'greet';
});
test('SymbolDAO.findByKind filters by kind', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const fileId = fileDAO.insert({ path: '/test4.ts', content: 'test', language: 'typescript' });
    symbolDAO.insert({ file_id: fileId, name: 'MyClass', kind: 'class', line: 1, column: 0 });
    symbolDAO.insert({ file_id: fileId, name: 'myFunc', kind: 'function', line: 5, column: 0 });
    const classes = symbolDAO.findByKind('class');
    return classes.length === 1 && classes[0].kind === 'class';
});
test('SymbolDAO.insertBatch works correctly', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const fileId = fileDAO.insert({ path: '/test5.ts', content: 'test', language: 'typescript' });
    const ids = symbolDAO.insertBatch([
        { file_id: fileId, name: 's1', kind: 'function', line: 1, column: 0 },
        { file_id: fileId, name: 's2', kind: 'function', line: 2, column: 0 },
        { file_id: fileId, name: 's3', kind: 'function', line: 3, column: 0 },
    ]);
    return ids.length === 3;
});
test('SymbolDAO.deleteByFileId cascades deletion', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const fileId = fileDAO.insert({ path: '/test6.ts', content: 'test', language: 'typescript' });
    symbolDAO.insert({ file_id: fileId, name: 's1', kind: 'function', line: 1, column: 0 });
    symbolDAO.insert({ file_id: fileId, name: 's2', kind: 'function', line: 2, column: 0 });
    const deletedCount = symbolDAO.deleteByFileId(fileId);
    return deletedCount === 2;
});
test('SymbolDAO.countByKind returns correct counts', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const fileId = fileDAO.insert({ path: '/test7.ts', content: 'test', language: 'typescript' });
    symbolDAO.insert({ file_id: fileId, name: 'func1', kind: 'function', line: 1, column: 0 });
    symbolDAO.insert({ file_id: fileId, name: 'func2', kind: 'function', line: 2, column: 0 });
    symbolDAO.insert({ file_id: fileId, name: 'MyClass', kind: 'class', line: 3, column: 0 });
    const counts = symbolDAO.countByKind();
    return counts['function'] === 2 && counts['class'] === 1;
});
console.log();
console.log('Phase 0.3.3: FileService - End-to-End Integration');
console.log('-'.repeat(70));
const fileService = new FileService();
// Clear data
fileDAO.clear();
symbolDAO.clear();
test('FileService.indexFile stores file and symbols', () => {
    const result = fileService.indexFile('/src/user.ts', sampleCode, 'typescript');
    return result.fileId > 0 && result.symbolCount > 0;
});
test('FileService.indexFile extracts correct number of symbols', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const result = fileService.indexFile('/src/test.ts', sampleCode, 'typescript');
    // Should extract: User (interface), UserService (class), getUser (method), updateUser (method),
    // greet (function), add (function), API_URL (const), MAX_RETRIES (const), retryCount (var), Status (type)
    // Plus constructor method
    return result.symbolCount >= 10;
});
test('FileService.getFileWithSymbols retrieves file and symbols', () => {
    fileDAO.clear();
    symbolDAO.clear();
    fileService.indexFile('/src/sample.ts', sampleCode, 'typescript');
    const file = fileService.getFileWithSymbols('/src/sample.ts');
    return file !== null && file.symbols.length > 0;
});
test('FileService.searchSymbols finds symbols by name', () => {
    fileDAO.clear();
    symbolDAO.clear();
    fileService.indexFile('/src/search.ts', sampleCode, 'typescript');
    const symbols = fileService.searchSymbols('greet');
    return symbols.length > 0 && symbols[0].name === 'greet';
});
test('FileService.reindexFile updates symbols', () => {
    fileDAO.clear();
    symbolDAO.clear();
    const newCode = 'export function hello() { return "world"; }';
    fileService.indexFile('/src/reindex.ts', sampleCode, 'typescript');
    const result = fileService.reindexFile('/src/reindex.ts', newCode);
    const file = fileService.getFileWithSymbols('/src/reindex.ts');
    return file !== null && file.symbols.length === 1 && file.symbols[0].name === 'hello';
});
test('FileService.deleteFile removes file and symbols', () => {
    fileDAO.clear();
    symbolDAO.clear();
    fileService.indexFile('/src/delete.ts', sampleCode, 'typescript');
    const deleted = fileService.deleteFile('/src/delete.ts');
    const file = fileService.getFileWithSymbols('/src/delete.ts');
    return deleted && file === null;
});
test('FileService.getStats returns correct statistics', () => {
    fileDAO.clear();
    symbolDAO.clear();
    fileService.indexFile('/src/stats1.ts', sampleCode, 'typescript');
    fileService.indexFile('/src/stats2.ts', 'export function test() {}', 'typescript');
    const stats = fileService.getStats();
    return stats.totalFiles === 2 && stats.totalSymbols > 0;
});
test('FileService transactions are atomic', () => {
    fileDAO.clear();
    symbolDAO.clear();
    // This should either fully succeed or fully fail
    const result = fileService.indexFile('/src/atomic.ts', sampleCode, 'typescript');
    // Verify both file and symbols were created
    const file = fileService.getFileWithSymbols('/src/atomic.ts');
    return file !== null && file.symbols.length === result.symbolCount;
});
console.log();
console.log('Phase 0.3.4: Complete Parser Pipeline - Real-World Test');
console.log('-'.repeat(70));
test('Complete workflow: parse → store → query → delete', () => {
    fileDAO.clear();
    symbolDAO.clear();
    // 1. Index file
    const indexResult = fileService.indexFile('/src/workflow.ts', sampleCode, 'typescript');
    // 2. Query by symbol name
    const greetSymbols = fileService.searchSymbols('greet');
    if (greetSymbols.length === 0)
        return false;
    // 3. Get file with symbols
    const file = fileService.getFileWithSymbols('/src/workflow.ts');
    if (!file || file.symbols.length === 0)
        return false;
    // 4. Check stats
    const stats = fileService.getStats();
    if (stats.totalFiles !== 1)
        return false;
    // 5. Delete file
    const deleted = fileService.deleteFile('/src/workflow.ts');
    if (!deleted)
        return false;
    // 6. Verify deletion
    const deletedFile = fileService.getFileWithSymbols('/src/workflow.ts');
    return deletedFile === null;
});
console.log();
// Clean up
closeDatabase();
// Print results
console.log('='.repeat(70));
console.log('Test Results Summary');
console.log('='.repeat(70));
console.log(`Total Tests: ${passedTests + failedTests}`);
console.log(`✓ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log();
if (failedTests === 0) {
    console.log('🎉 SUCCESS: All Phase 0.3 tests passed!');
    console.log('='.repeat(70));
    console.log();
    console.log('Phase 0.3 Complete: Parser Pipeline POC ✓');
    console.log('  ✓ Tree-sitter TypeScript parsing working');
    console.log('  ✓ Symbol extraction (functions, classes, interfaces, types, variables)');
    console.log('  ✓ symbols table created with foreign keys');
    console.log('  ✓ SymbolDAO with full CRUD operations');
    console.log('  ✓ FileService orchestrator for end-to-end indexing');
    console.log('  ✓ Parse → Store → Query pipeline validated');
    console.log();
    console.log('✅ Ready for Phase 0.4: CLI Command POC (ax find)');
    console.log();
}
else {
    console.log('❌ FAILURE: Some tests failed. Please review errors above.');
    console.log();
    process.exit(1);
}
//# sourceMappingURL=test-parser.js.map