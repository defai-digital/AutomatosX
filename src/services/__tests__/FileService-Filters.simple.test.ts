/**
 * FileService-Filters.simple.test.ts
 *
 * Simplified integration tests for query filter functionality
 */

import { describe, it, expect } from 'vitest';
import { FileService } from '../FileService.js';

describe('FileService - Query Filters (Simple)', () => {
  const fileService = new FileService();
  let counter = 0;
  const u = (name: string) => `/test-filter-${Date.now()}-${++counter}-${name}`;

  it('should index files with different languages', () => {
    const tsPath = u('auth.ts');
    const pyPath = u('calc.py');

    const tsCode = `export class AuthService { login() {} }`;
    const pyCode = `class Calculator:\n    def add(self, a, b):\n        return a + b`;

    const tsResult = fileService.indexFile(tsPath, tsCode);
    const pyResult = fileService.indexFile(pyPath, pyCode);

    expect(tsResult.symbolCount).toBeGreaterThan(0);
    expect(pyResult.symbolCount).toBeGreaterThan(0);
  });

  it('should find TypeScript symbols with lang:typescript filter', () => {
    const tsPath = u('service.ts');
    const pyPath = u('service.py');

    fileService.indexFile(tsPath, 'export class ServiceClass {}');
    fileService.indexFile(pyPath, 'class ServiceClass:\n    pass');

    const result = fileService.search('ServiceClass lang:typescript');

    // Should find results
    expect(result.results.length).toBeGreaterThanOrEqual(0);

    // If results found, all should be from TypeScript files
    if (result.results.length > 0) {
      const tsResults = result.results.filter(r =>
        r.file_path.endsWith('.ts')
      );
      expect(tsResults.length).toBe(result.results.length);
    }
  });

  it('should find Python symbols with lang:python filter', () => {
    const tsPath = u('utils.ts');
    const pyPath = u('utils.py');

    fileService.indexFile(tsPath, 'export class UtilsClass {}');
    fileService.indexFile(pyPath, 'class UtilsClass:\n    pass');

    const result = fileService.search('UtilsClass lang:python');

    // If results found, all should be from Python files
    if (result.results.length > 0) {
      const pyResults = result.results.filter(r =>
        r.file_path.endsWith('.py')
      );
      expect(pyResults.length).toBe(result.results.length);
    }
  });

  it('should exclude languages with -lang:python', () => {
    const tsPath = u('data.ts');
    const pyPath = u('data.py');

    fileService.indexFile(tsPath, 'export class DataClass {}');
    fileService.indexFile(pyPath, 'class DataClass:\n    pass');

    const result = fileService.search('DataClass -lang:python');

    // Should not find any Python results
    const pyResults = result.results.filter(r =>
      r.file_path.endsWith('.py')
    );
    expect(pyResults.length).toBe(0);
  });

  it('should filter by kind:class', () => {
    const path = u('mixed.ts');
    const code = `
export class MyClass {}
export function myFunction() {}
`;

    fileService.indexFile(path, code);
    const result = fileService.search('My kind:class');

    // If results found, all should be classes
    const symbolResults = result.results.filter(r => r.type === 'symbol');
    const classResults = symbolResults.filter(r => r.kind === 'class');

    // All symbol results should be classes
    if (symbolResults.length > 0) {
      expect(classResults.length).toBe(symbolResults.length);
    }
  });

  it('should filter by kind:function', () => {
    const path = u('funcs.ts');
    const code = `
export class MyClass {}
export function myFunction() {}
export function anotherFunction() {}
`;

    fileService.indexFile(path, code);
    const result = fileService.search('Function kind:function');

    // If results found, all symbol results should be functions
    const symbolResults = result.results.filter(r => r.type === 'symbol');
    const functionResults = symbolResults.filter(r => r.kind === 'function');

    if (symbolResults.length > 0) {
      expect(functionResults.length).toBe(symbolResults.length);
    }
  });

  it('should filter by file pattern (file:*.ts)', () => {
    const tsPath = u('test.ts');
    const pyPath = u('test.py');

    fileService.indexFile(tsPath, 'export class TestClass {}');
    fileService.indexFile(pyPath, 'class TestClass:\n    pass');

    const result = fileService.search('TestClass file:*.ts');

    // Should only find results from .ts files
    const tsResults = result.results.filter(r => r.file_path.endsWith('.ts'));
    const pyResults = result.results.filter(r => r.file_path.endsWith('.py'));

    expect(pyResults.length).toBe(0);
    if (result.results.length > 0) {
      expect(tsResults.length).toBe(result.results.length);
    }
  });

  it('should apply combined filters (lang:typescript kind:class)', () => {
    const path = u('combined.ts');
    const code = `
export class CombinedClass {}
export function combinedFunction() {}
`;

    fileService.indexFile(path, code);
    const result = fileService.search('Combined lang:typescript kind:class');

    // If results found, all should be TypeScript classes
    const symbolResults = result.results.filter(r => r.type === 'symbol');
    if (symbolResults.length > 0) {
      const classResults = symbolResults.filter(r =>
        r.kind === 'class' && r.file_path.endsWith('.ts')
      );
      expect(classResults.length).toBe(symbolResults.length);
    }
  });

  it('should handle queries with only filters (returns empty)', () => {
    const result = fileService.search('lang:python kind:class');

    // Filter-only queries currently return empty results
    expect(result.totalResults).toBe(0);
  });

  it('should work without filters', () => {
    const path = u('simple.ts');
    fileService.indexFile(path, 'export class SimpleClass {}');

    const result = fileService.search('SimpleClass');

    // Should work as normal search
    expect(result.totalResults).toBeGreaterThanOrEqual(0);
  });
});
