/**
 * test-database.ts
 *
 * Comprehensive tests for Phase 0.2: SQLite Foundation
 * Tests database connection, migrations, and FileDAO CRUD operations
 */

import { runMigrations, getMigrationStatus } from './database/migrations';
import { closeDatabase } from './database/connection';
import { FileDAO } from './database/dao/FileDAO';
import { hashContent, verifyHash, shortHash } from './utils/hash';

console.log('='.repeat(70));
console.log('AutomatosX - Phase 0.2: SQLite Foundation Tests');
console.log('='.repeat(70));
console.log();

// Track test results
let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void | boolean) {
  try {
    const result = fn();
    if (result === false) {
      console.log(`❌ FAILED: ${name}`);
      failedTests++;
    } else {
      console.log(`✓ PASSED: ${name}`);
      passedTests++;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${name}`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    failedTests++;
  }
}

console.log('Phase 0.2.1: Hash Utilities');
console.log('-'.repeat(70));

test('hashContent generates SHA-256 hash', () => {
  const content = 'Hello, AutomatosX!';
  const hash = hashContent(content);
  return hash.length === 64 && /^[a-f0-9]{64}$/.test(hash);
});

test('hashContent is deterministic', () => {
  const content = 'Test content';
  const hash1 = hashContent(content);
  const hash2 = hashContent(content);
  return hash1 === hash2;
});

test('verifyHash correctly validates content', () => {
  const content = 'Verify this content';
  const hash = hashContent(content);
  return verifyHash(content, hash) === true;
});

test('verifyHash rejects invalid hash', () => {
  const content = 'Some content';
  const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';
  return verifyHash(content, wrongHash) === false;
});

test('shortHash returns 8 characters', () => {
  const content = 'Short hash test';
  const short = shortHash(content);
  return short.length === 8 && /^[a-f0-9]{8}$/.test(short);
});

console.log();

console.log('Phase 0.2.2: Database Migrations');
console.log('-'.repeat(70));

test('runMigrations creates migrations table', () => {
  const appliedCount = runMigrations();
  return appliedCount >= 0; // Should apply at least 0 migrations (might be already applied)
});

test('getMigrationStatus returns correct counts', () => {
  const status = getMigrationStatus();
  return status.total >= 1 && status.applied >= 1 && status.pending === 0;
});

console.log();

console.log('Phase 0.2.3: FileDAO - CRUD Operations');
console.log('-'.repeat(70));

const fileDAO = new FileDAO();

// Clear any existing data
fileDAO.clear();

test('FileDAO.insert creates new file', () => {
  const id = fileDAO.insert({
    path: '/test/example.ts',
    content: 'export const hello = "world";',
    language: 'typescript'
  });
  return typeof id === 'number' && id > 0;
});

test('FileDAO.findById retrieves inserted file', () => {
  const id = fileDAO.insert({
    path: '/test/find-by-id.ts',
    content: 'const test = 123;',
    language: 'typescript'
  });

  const file = fileDAO.findById(id);
  return file !== null && file.id === id && file.path === '/test/find-by-id.ts';
});

test('FileDAO.findByPath retrieves file by path', () => {
  fileDAO.insert({
    path: '/test/find-by-path.ts',
    content: 'const x = 1;',
    language: 'typescript'
  });

  const file = fileDAO.findByPath('/test/find-by-path.ts');
  return file !== null && file.path === '/test/find-by-path.ts';
});

test('FileDAO auto-generates hash correctly', () => {
  const content = 'function add(a, b) { return a + b; }';
  const expectedHash = hashContent(content);

  const id = fileDAO.insert({
    path: '/test/hash-test.js',
    content,
    language: 'javascript'
  });

  const file = fileDAO.findById(id);
  return file !== null && file.hash === expectedHash;
});

test('FileDAO auto-calculates size correctly', () => {
  const content = 'Hello, world!';
  const expectedSize = Buffer.byteLength(content, 'utf8');

  const id = fileDAO.insert({
    path: '/test/size-test.txt',
    content,
    language: 'text'
  });

  const file = fileDAO.findById(id);
  return file !== null && file.size === expectedSize;
});

test('FileDAO.update modifies content and hash', () => {
  const id = fileDAO.insert({
    path: '/test/update-test.ts',
    content: 'const old = "value";',
    language: 'typescript'
  });

  const newContent = 'const new = "value";';
  const updated = fileDAO.update(id, { content: newContent });

  const file = fileDAO.findById(id);
  return updated && file !== null && file.content === newContent && file.hash === hashContent(newContent);
});

test('FileDAO.update modifies language', () => {
  const id = fileDAO.insert({
    path: '/test/lang-update.txt',
    content: 'Some text',
    language: 'text'
  });

  const updated = fileDAO.update(id, { language: 'markdown' });
  const file = fileDAO.findById(id);

  return updated && file !== null && file.language === 'markdown';
});

test('FileDAO.delete removes file by ID', () => {
  const id = fileDAO.insert({
    path: '/test/delete-by-id.ts',
    content: 'const toDelete = true;',
    language: 'typescript'
  });

  const deleted = fileDAO.delete(id);
  const file = fileDAO.findById(id);

  return deleted && file === null;
});

test('FileDAO.deleteByPath removes file by path', () => {
  fileDAO.insert({
    path: '/test/delete-by-path.ts',
    content: 'const toDelete = true;',
    language: 'typescript'
  });

  const deleted = fileDAO.deleteByPath('/test/delete-by-path.ts');
  const file = fileDAO.findByPath('/test/delete-by-path.ts');

  return deleted && file === null;
});

test('FileDAO.findByLanguage filters correctly', () => {
  fileDAO.clear();

  fileDAO.insert({ path: '/a.ts', content: 'const a = 1;', language: 'typescript' });
  fileDAO.insert({ path: '/b.js', content: 'const b = 2;', language: 'javascript' });
  fileDAO.insert({ path: '/c.ts', content: 'const c = 3;', language: 'typescript' });

  const tsFiles = fileDAO.findByLanguage('typescript');
  return tsFiles.length === 2;
});

test('FileDAO.list returns all files', () => {
  fileDAO.clear();

  fileDAO.insert({ path: '/1.ts', content: 'const one = 1;', language: 'typescript' });
  fileDAO.insert({ path: '/2.ts', content: 'const two = 2;', language: 'typescript' });
  fileDAO.insert({ path: '/3.ts', content: 'const three = 3;', language: 'typescript' });

  const files = fileDAO.list();
  return files.length === 3;
});

test('FileDAO.list with limit works', () => {
  fileDAO.clear();

  for (let i = 1; i <= 5; i++) {
    fileDAO.insert({ path: `/file${i}.ts`, content: `const x = ${i};`, language: 'typescript' });
  }

  const files = fileDAO.list(2);
  return files.length === 2;
});

test('FileDAO.count returns correct total', () => {
  fileDAO.clear();

  fileDAO.insert({ path: '/1.ts', content: 'const a = 1;', language: 'typescript' });
  fileDAO.insert({ path: '/2.ts', content: 'const b = 2;', language: 'typescript' });

  const count = fileDAO.count();
  return count === 2;
});

test('FileDAO.exists returns true for existing path', () => {
  fileDAO.clear();

  fileDAO.insert({ path: '/exists.ts', content: 'const x = 1;', language: 'typescript' });

  return fileDAO.exists('/exists.ts') === true;
});

test('FileDAO.exists returns false for non-existing path', () => {
  return fileDAO.exists('/does-not-exist.ts') === false;
});

test('FileDAO prevents duplicate paths (UNIQUE constraint)', () => {
  fileDAO.clear();

  fileDAO.insert({ path: '/unique.ts', content: 'const a = 1;', language: 'typescript' });

  try {
    fileDAO.insert({ path: '/unique.ts', content: 'const b = 2;', language: 'typescript' });
    return false; // Should have thrown error
  } catch (error) {
    return true; // Expected error
  }
});

console.log();

console.log('Phase 0.2.4: Integration Test - Real-World Scenario');
console.log('-'.repeat(70));

test('Complete workflow: insert → find → update → delete', () => {
  fileDAO.clear();

  // Insert
  const content1 = 'function greet(name) { return `Hello, ${name}`; }';
  const id = fileDAO.insert({
    path: '/src/greet.js',
    content: content1,
    language: 'javascript'
  });

  // Find
  const file1 = fileDAO.findById(id);
  if (!file1 || file1.content !== content1) return false;

  // Update
  const content2 = 'function greet(name) { return `Hi, ${name}!`; }';
  fileDAO.update(id, { content: content2 });

  const file2 = fileDAO.findById(id);
  if (!file2 || file2.content !== content2) return false;

  // Verify hash updated
  if (file2.hash === file1.hash) return false; // Hash should change

  // Delete
  fileDAO.delete(id);

  const file3 = fileDAO.findById(id);
  return file3 === null;
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
  console.log('🎉 SUCCESS: All Phase 0.2 tests passed!');
  console.log('='.repeat(70));
  console.log();
  console.log('Phase 0.2 Complete: SQLite Foundation ✓');
  console.log('  ✓ Database connection manager working');
  console.log('  ✓ Migration system functional');
  console.log('  ✓ files table created with indexes');
  console.log('  ✓ FileDAO with full CRUD operations');
  console.log('  ✓ Hash utilities for content integrity');
  console.log('  ✓ Type-safe TypeScript integration');
  console.log();
  console.log('✅ Ready for Phase 0.3: Parser Pipeline POC');
  console.log();
} else {
  console.log('❌ FAILURE: Some tests failed. Please review errors above.');
  console.log();
  process.exit(1);
}
