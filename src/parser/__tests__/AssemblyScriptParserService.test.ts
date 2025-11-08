/**
 * AssemblyScriptParserService.test.ts
 *
 * Tests for AssemblyScript language parser
 * AssemblyScript uses TypeScript syntax, so tests verify TS grammar works with AS patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AssemblyScriptParserService } from '../AssemblyScriptParserService.js';
import * as fs from 'fs';
import * as path from 'path';

describe('AssemblyScriptParserService', () => {
  let parser: AssemblyScriptParserService;

  beforeEach(() => {
    parser = new AssemblyScriptParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('assemblyscript');
    });

    it('should support AssemblyScript file extensions', () => {
      expect(parser.extensions).toContain('.as.ts');
      // Note: .ts files are handled by TypeScriptParserService
      // AS uses .as.ts extension to distinguish from regular TypeScript
    });
  });

  describe('parse', () => {
    it('should parse empty file', () => {
      const result = parser.parse('');

      expect(result.symbols).toEqual([]);
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.nodeCount).toBeGreaterThanOrEqual(0);
    });

    it('should extract WebAssembly primitive type functions', () => {
      const code = `
export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function multiply(a: f32, b: f32): f32 {
  return a * b;
}

export function divide(a: f64, b: f64): f64 {
  return a / b;
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(3);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('add');
      expect(functionNames).toContain('multiply');
      expect(functionNames).toContain('divide');
    });

    it('should extract classes', () => {
      const code = `
export class Calculator {
  private result: i32 = 0;

  add(value: i32): void {
    this.result += value;
  }

  getResult(): i32 {
    return this.result;
  }
}

export class Counter {
  private count: i32 = 0;

  increment(): void {
    this.count += 1;
  }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(2);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('Calculator');
      expect(classNames).toContain('Counter');
    });

    it('should extract methods from classes', () => {
      const code = `
export class Calculator {
  add(value: i32): void {
    // implementation
  }

  subtract(value: i32): void {
    // implementation
  }

  multiply(value: i32): void {
    // implementation
  }
}
`;

      const result = parser.parse(code);

      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods.length).toBeGreaterThanOrEqual(3);

      const methodNames = methods.map(m => m.name);
      expect(methodNames.some(n => n.includes('Calculator.add'))).toBe(true);
      expect(methodNames.some(n => n.includes('Calculator.subtract'))).toBe(true);
      expect(methodNames.some(n => n.includes('Calculator.multiply'))).toBe(true);
    });

    it('should extract inline decorated functions', () => {
      const code = `
@inline
export function fastAdd(a: i32, b: i32): i32 {
  return a + b;
}

@inline
export function fastMultiply(a: f32, b: f32): f32 {
  return a * b;
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(2);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('fastAdd');
      expect(functionNames).toContain('fastMultiply');
    });

    it('should extract external declarations', () => {
      const code = `
@external("env", "log")
declare function log(value: i32): void;

@external("env", "consoleLog")
declare function consoleLog(message: string): void;
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(2);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('log');
      expect(functionNames).toContain('consoleLog');
    });

    it('should extract memory management functions', () => {
      const code = `
export function allocateMemory(size: i32): usize {
  return memory.allocate(size);
}

export function freeMemory(ptr: usize): void {
  memory.free(ptr);
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(2);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('allocateMemory');
      expect(functionNames).toContain('freeMemory');
    });

    it('should extract generic classes', () => {
      const code = `
export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }
}

export class Pair<K, V> {
  key: K;
  value: V;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(2);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain('Box');
      expect(classNames).toContain('Pair');
    });

    it('should extract operator overloaded methods', () => {
      const code = `
export class Vector2 {
  x: f64;
  y: f64;

  @operator("+")
  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  @operator("-")
  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThanOrEqual(1);
      expect(classes[0].name).toBe('Vector2');

      const methods = result.symbols.filter(s => s.kind === 'method' && s.name.includes('Vector2'));
      expect(methods.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract unsafe decorated functions', () => {
      const code = `
@unsafe
export function unsafeMemoryCopy(dest: usize, src: usize, len: usize): void {
  memory.copy(dest, src, len);
}

@unsafe
export function unsafeMemoryFill(dest: usize, value: u8, len: usize): void {
  memory.fill(dest, value, len);
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(2);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('unsafeMemoryCopy');
      expect(functionNames).toContain('unsafeMemoryFill');
    });

    it('should extract bitwise operation functions', () => {
      const code = `
export function bitwiseAnd(a: i32, b: i32): i32 {
  return a & b;
}

export function bitwiseOr(a: i32, b: i32): i32 {
  return a | b;
}

export function leftShift(value: i32, shift: i32): i32 {
  return value << shift;
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(3);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('bitwiseAnd');
      expect(functionNames).toContain('bitwiseOr');
      expect(functionNames).toContain('leftShift');
    });

    it('should include position information', () => {
      const code = `
export function add(a: i32, b: i32): i32 {
  return a + b;
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(1);

      const func = functions[0];
      expect(func.line).toBeGreaterThan(0);
      expect(func.column).toBeGreaterThanOrEqual(0);
      expect(func.endLine).toBeDefined();
      expect(func.endColumn).toBeDefined();
      expect(func.endLine).toBeGreaterThanOrEqual(func.line);
    });

    it('should extract array operation functions', () => {
      const code = `
export function sumArray(arr: Int32Array): i32 {
  let sum: i32 = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += unchecked(arr[i]);
  }
  return sum;
}

export function fillBuffer(buffer: Uint8Array, value: u8): void {
  for (let i = 0; i < buffer.length; i++) {
    unchecked(buffer[i] = value);
  }
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(2);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('sumArray');
      expect(functionNames).toContain('fillBuffer');
    });
  });

  describe('fixtures', () => {
    it('should parse sample-assemblyscript-basic.ts', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'assemblyscript', 'sample-assemblyscript-basic.ts');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract multiple symbols
      expect(result.symbols.length).toBeGreaterThan(20);

      const functions = result.symbols.filter(s => s.kind === 'function');
      const classes = result.symbols.filter(s => s.kind === 'class');
      const methods = result.symbols.filter(s => s.kind === 'method');

      expect(functions.length).toBeGreaterThanOrEqual(15);
      expect(classes.length).toBeGreaterThanOrEqual(3);
      expect(methods.length).toBeGreaterThanOrEqual(5);
    });

    it('should parse sample-assemblyscript-advanced.ts', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'assemblyscript', 'sample-assemblyscript-advanced.ts');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract multiple symbols including decorated functions
      expect(result.symbols.length).toBeGreaterThan(30);

      const functions = result.symbols.filter(s => s.kind === 'function');
      const classes = result.symbols.filter(s => s.kind === 'class');

      expect(functions.length).toBeGreaterThanOrEqual(10);
      expect(classes.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', () => {
      const code = `
export function incomplete_function(
  // Missing closing parenthesis and body
`;

      // Should not throw, tree-sitter is error-tolerant
      const result = parser.parse(code);

      expect(result.symbols).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid code', () => {
      const code = `
export function validFunction(): i32 {
  return 42;
}

export class InvalidClass {
  // Missing closing brace

export function anotherValidFunction(): string {
  return "test";
}
`;

      const result = parser.parse(code);

      // Should extract at least some valid symbols
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('performance', () => {
    it('should parse large files quickly', () => {
      // Generate a large AssemblyScript file
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`export function testFunction${i}(a: i32, b: i32): i32 {`);
        lines.push(`  return a + b + ${i};`);
        lines.push(`}`);
        lines.push('');
      }
      const code = lines.join('\n');

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(100);

      // Should parse in reasonable time (< 200ms for 100 functions)
      expect(result.parseTime).toBeLessThan(200);
    });
  });
});
