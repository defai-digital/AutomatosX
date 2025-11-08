/**
 * FileService-Python.simple.test.ts
 *
 * Simple end-to-end test for Python file indexing
 */

import { describe, it, expect } from 'vitest';
import { FileService } from '../FileService.js';

// Helper to generate unique file paths
let counter = 0;
const u = (name: string) => `/test-py-${Date.now()}-${++counter}-${name}`;

describe('FileService - Python End-to-End', () => {
  const fileService = new FileService();

  it('should index and retrieve Python file with classes and functions', () => {
    const code = `
class Calculator:
    def add(self, a, b):
        return a + b

def multiply(x, y):
    return x * y
`;

    const filePath = u('calc.py');
    const result = fileService.indexFile(filePath, code);

    expect(result.symbolCount).toBe(3); // Calculator, add, multiply
    expect(result.chunkCount).toBeGreaterThan(0);

    const file = fileService.getFileWithSymbols(filePath);
    expect(file).not.toBeNull();
    expect(file!.language).toBe('python');
    expect(file!.symbols).toHaveLength(3);

    const symbolNames = file!.symbols.map(s => s.name);
    expect(symbolNames).toContain('Calculator');
    expect(symbolNames).toContain('add');
    expect(symbolNames).toContain('multiply');
  });

  it('should distinguish Python functions from methods', () => {
    const code = `
def standalone():
    pass

class MyClass:
    def my_method(self):
        pass
`;

    const filePath = u('methods.py');
    fileService.indexFile(filePath, code);

    const file = fileService.getFileWithSymbols(filePath);
    const functions = file!.symbols.filter(s => s.kind === 'function');
    const methods = file!.symbols.filter(s => s.kind === 'method');

    expect(functions).toHaveLength(1);
    expect(functions[0].name).toBe('standalone');

    expect(methods).toHaveLength(1);
    expect(methods[0].name).toBe('my_method');
  });

  it('should index both TypeScript and Python files correctly', () => {
    const tsCode = 'export function tsFunc() {}';
    const pyCode = 'def py_func():\n    pass';

    const tsPath = u('file.ts');
    const pyPath = u('file.py');

    fileService.indexFile(tsPath, tsCode);
    fileService.indexFile(pyPath, pyCode);

    const tsFile = fileService.getFileWithSymbols(tsPath);
    const pyFile = fileService.getFileWithSymbols(pyPath);

    expect(tsFile!.language).toBe('typescript');
    expect(pyFile!.language).toBe('python');

    expect(tsFile!.symbols[0].name).toBe('tsFunc');
    expect(pyFile!.symbols[0].name).toBe('py_func');
  });
});
